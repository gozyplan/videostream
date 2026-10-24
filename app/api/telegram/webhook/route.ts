
import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatIdValue = process.env.TELEGRAM_CHAT_ID;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return (
    left.length === right.length &&
    timingSafeEqual(left, right)
  );
}

async function telegram(method: string, body: object) {
  if (!botToken) {
    throw new Error("Telegram bot is not configured.");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      result.description || `Telegram ${method} failed.`
    );
  }

  return result.result;
}

export async function GET() {
  return NextResponse.json({
    route: "Telegram webhook",
    configured: Boolean(
      botToken && chatIdValue && webhookSecret && admin
    ),
  });
}

export async function POST(request: Request) {
  try {
    if (!botToken || !chatIdValue || !webhookSecret || !admin) {
      return NextResponse.json(
        { error: "Webhook server configuration is missing." },
        { status: 500 }
      );
    }

    const suppliedSecret = request.headers.get(
      "x-telegram-bot-api-secret-token"
    );

    if (
      !suppliedSecret ||
      !safeEqual(suppliedSecret, webhookSecret)
    ) {
      return NextResponse.json(
        { error: "Unauthorized webhook request." },
        { status: 401 }
      );
    }

    const update = await request.json();
    const channelId = Number(chatIdValue);

    if (!Number.isSafeInteger(channelId)) {
      return NextResponse.json(
        { error: "Invalid Telegram channel configuration." },
        { status: 500 }
      );
    }

    // Handle actual channel membership updates.
    const memberUpdate = update?.chat_member;

    if (memberUpdate) {
      const updatedChatId = Number(memberUpdate.chat?.id);
      const telegramUserId = Number(
        memberUpdate.new_chat_member?.user?.id
      );

      if (
        updatedChatId !== channelId ||
        !Number.isSafeInteger(telegramUserId)
      ) {
        return NextResponse.json({ ok: true });
      }

      const oldStatus = memberUpdate.old_chat_member?.status;
      const newStatus = memberUpdate.new_chat_member?.status;

      const wasMember = ["member", "administrator", "creator"].includes(
        oldStatus
      );

      const isMember = ["member", "administrator", "creator"].includes(
        newStatus
      );

      if (!wasMember && isMember) {
        const now = new Date().toISOString();

        const { data: membership, error: membershipError } =
          await admin
            .from("telegram_memberships")
            .select("id, user_id, joined_at, removed_at")
            .eq("telegram_chat_id", channelId)
            .eq("telegram_user_id", telegramUserId)
            .is("removed_at", null)
            .maybeSingle();

        if (membershipError) {
          console.error(
            "Join membership lookup failed:",
            membershipError
          );

          return NextResponse.json(
            { error: "Could not verify channel membership." },
            { status: 500 }
          );
        }

        if (membership && !membership.joined_at) {
          // Confirm the subscription is still active before recording
          // the channel join.
          const { data: subscriptions, error: subError } =
            await admin
              .from("subscriptions")
              .select("id, plan_id")
              .eq("user_id", membership.user_id)
              .eq("status", "active")
              .gt("expires_at", now);

          if (subError) {
            console.error(
              "Join subscription check failed:",
              subError
            );

            return NextResponse.json(
              { error: "Could not verify subscription." },
              { status: 500 }
            );
          }

          const planIds = [
            ...new Set(
              (subscriptions || []).map((s) => Number(s.plan_id))
            ),
          ];

          let hasHdlinkPlan = false;

          if (planIds.length > 0) {
            const { data: plans, error: planError } = await admin
              .from("plans")
              .select("id")
              .in("id", planIds)
              .eq("source", "hdlink")
              .eq("is_active", true);

            if (planError) {
              console.error(
                "Join plan check failed:",
                planError
              );

              return NextResponse.json(
                { error: "Could not verify HDLink plan." },
                { status: 500 }
              );
            }

            const validIds = new Set(
              (plans || []).map((p) => Number(p.id))
            );

            hasHdlinkPlan = (subscriptions || []).some((s) =>
              validIds.has(Number(s.plan_id))
            );
          }

          if (hasHdlinkPlan) {
            const { error: updateError } = await admin
              .from("telegram_memberships")
              .update({
                joined_at: now,
                updated_at: now,
              })
              .eq("id", membership.id)
              .is("joined_at", null)
              .is("removed_at", null);

            if (updateError) {
              console.error(
                "Join confirmation update failed:",
                updateError
              );

              return NextResponse.json(
                { error: "Could not confirm channel join." },
                { status: 500 }
              );
            }
          } else {
            // No valid subscription: revoke the pending invite and
            // remove the user from the private channel.
            try {
              await telegram("banChatMember", {
                chat_id: channelId,
                user_id: telegramUserId,
              });

              await telegram("unbanChatMember", {
                chat_id: channelId,
                user_id: telegramUserId,
                only_if_banned: true,
              });
            } catch (removeError) {
              console.error(
                "Could not remove unentitled Telegram member:",
                removeError
              );
            }
          }
        }
      }

      return NextResponse.json({ ok: true });
    }

    // Process /start TOKEN messages sent privately to the bot.
    const message = update?.message;
    const text = message?.text;

    if (
      typeof text !== "string" ||
      !/^\/start(?:@\w+)?\s+[a-f0-9]{64}$/i.test(text)
    ) {
      return NextResponse.json({ ok: true });
    }

    const telegramUserId = Number(message?.from?.id);
    const privateChatId = Number(message?.chat?.id);

    if (
      !Number.isSafeInteger(telegramUserId) ||
      telegramUserId <= 0 ||
      message?.from?.is_bot ||
      message?.chat?.type !== "private" ||
      privateChatId !== telegramUserId
    ) {
      return NextResponse.json({ ok: true });
    }

    const rawToken = text.trim().split(/\s+/).pop()!;
    const tokenHash = createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const now = new Date().toISOString();

    const { data: linkToken, error: tokenError } = await admin
      .from("telegram_link_tokens")
      .select("id, user_id")
      .eq("token_hash", tokenHash)
      .gt("expires_at", now)
      .is("used_at", null)
      .maybeSingle();

    if (tokenError) {
      console.error("Link token lookup failed:", tokenError);

      return NextResponse.json(
        { error: "Could not verify link token." },
        { status: 500 }
      );
    }

    if (!linkToken) {
      await telegram("sendMessage", {
        chat_id: privateChatId,
        text: "This linking link is invalid, expired, or already used. Please create a new link from your HDLink account.",
      });

      return NextResponse.json({ ok: true });
    }

    // Atomically consume the one-time token.
    const { data: reserved, error: reserveError } = await admin
      .from("telegram_link_tokens")
      .update({ used_at: now })
      .eq("id", linkToken.id)
      .is("used_at", null)
      .gt("expires_at", now)
      .select("id, user_id")
      .maybeSingle();

    if (reserveError || !reserved) {
      await telegram("sendMessage", {
        chat_id: privateChatId,
        text: "This linking token has already been used or expired. Please create a new link from HDLink.",
      });

      return NextResponse.json({ ok: true });
    }

    // Recheck the subscription when the token is redeemed.
    const { data: subscriptions, error: subError } = await admin
      .from("subscriptions")
      .select("id, plan_id")
      .eq("user_id", reserved.user_id)
      .eq("status", "active")
      .gt("expires_at", now);

    if (subError) {
      console.error("Subscription verification failed:", subError);

      return NextResponse.json(
        { error: "Could not verify subscription." },
        { status: 500 }
      );
    }

    const planIds = [
      ...new Set(
        (subscriptions || []).map((s) => Number(s.plan_id))
      ),
    ];

    let hasHdlinkPlan = false;

    if (planIds.length > 0) {
      const { data: plans, error: planError } = await admin
        .from("plans")
        .select("id")
        .in("id", planIds)
        .eq("source", "hdlink")
        .eq("is_active", true);

      if (planError) {
        console.error("Plan verification failed:", planError);

        return NextResponse.json(
          { error: "Could not verify HDLink plan." },
          { status: 500 }
        );
      }

      const validIds = new Set(
        (plans || []).map((p) => Number(p.id))
      );

      hasHdlinkPlan = (subscriptions || []).some((s) =>
        validIds.has(Number(s.plan_id))
      );
    }

    if (!hasHdlinkPlan) {
      await telegram("sendMessage", {
        chat_id: privateChatId,
        text: "An active HDLink subscription is required to connect Telegram.",
      });

      return NextResponse.json({ ok: true });
    }

    // Create a short-lived, single-use channel invite.
    const invite = await telegram("createChatInviteLink", {
      chat_id: channelId,
      member_limit: 1,
      expire_date: Math.floor(Date.now() / 1000) + 600,
      name: `HDLink-${String(reserved.user_id).slice(0, 8)}`,
    });

    const inviteLink = invite?.invite_link;

    if (
      typeof inviteLink !== "string" ||
      !inviteLink.startsWith("https://t.me/")
    ) {
      throw new Error("Telegram did not return a valid invite link.");
    }

    const { data: existing, error: existingError } = await admin
      .from("telegram_memberships")
      .select("id, joined_at, removed_at")
      .eq("user_id", reserved.user_id)
      .eq("telegram_chat_id", channelId)
      .maybeSingle();

    if (existingError) {
      throw new Error("Could not check existing Telegram membership.");
    }

    const membershipValues = {
      telegram_user_id: telegramUserId,
      telegram_chat_id: channelId,
      invite_link: inviteLink,
      // Never claim the user has joined merely because an invite was sent.
      joined_at:
        existing && !existing.removed_at
          ? existing.joined_at
          : null,
      removed_at: null,
      updated_at: now,
    };

    if (existing) {
      const { error } = await admin
        .from("telegram_memberships")
        .update(membershipValues)
        .eq("id", existing.id);

      if (error) {
        throw new Error("Could not update Telegram membership.");
      }
    } else {
      const { error } = await admin
        .from("telegram_memberships")
        .insert({
          user_id: reserved.user_id,
          ...membershipValues,
        });

      if (error) {
        throw new Error("Could not save Telegram membership.");
      }
    }

    await telegram("sendMessage", {
      chat_id: privateChatId,
      text:
        "Your HDLink Telegram invite is ready. Join within 10 minutes using this Telegram account:\n\n" +
        inviteLink +
        "\n\nYour membership will be confirmed after Telegram reports that you joined.",
      disable_web_page_preview: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);

    return NextResponse.json(
      { error: "Telegram webhook processing failed." },
      { status: 500 }
    );
  }
}
