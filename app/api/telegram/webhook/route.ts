
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
    throw new Error(result.description || `Telegram ${method} failed.`);
  }

  return result.result;
}

export async function GET() {
  return NextResponse.json({
    route: "Telegram webhook",
    configured: Boolean(
      botToken &&
      chatIdValue &&
      webhookSecret &&
      admin
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
    const message = update?.message;
    const text = message?.text;

    // Ignore updates that are not /start messages.
    if (
      typeof text !== "string" ||
      !/^\/start(?:@\w+)?\s+[a-f0-9]{64}$/i.test(text)
    ) {
      return NextResponse.json({ ok: true });
    }

    const telegramUserId = Number(message?.from?.id);
    const chatType = message?.chat?.type;
    const telegramPrivateChatId = Number(message?.chat?.id);

    if (
      !Number.isSafeInteger(telegramUserId) ||
      telegramUserId <= 0 ||
      chatType !== "private" ||
      telegramPrivateChatId !== telegramUserId
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
      .select("id, user_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .gt("expires_at", now)
      .is("used_at", null)
      .maybeSingle();

    if (tokenError) {
      console.error("Telegram token lookup failed:", tokenError);
      return NextResponse.json(
        { error: "Could not verify link token." },
        { status: 500 }
      );
    }

    if (!linkToken) {
      await telegram("sendMessage", {
        chat_id: telegramPrivateChatId,
        text: "This linking link is invalid or expired. Please create a new link from your HDLink account.",
      });

      return NextResponse.json({ ok: true });
    }

    const channelId = Number(chatIdValue);

    if (!Number.isSafeInteger(channelId)) {
      return NextResponse.json(
        { error: "Invalid Telegram channel configuration." },
        { status: 500 }
      );
    }

    // Reserve the token atomically so it cannot be reused.
    const { data: reservedToken, error: reserveError } = await admin
      .from("telegram_link_tokens")
      .update({ used_at: now })
      .eq("id", linkToken.id)
      .is("used_at", null)
      .gt("expires_at", now)
      .select("id, user_id")
      .maybeSingle();

    if (reserveError || !reservedToken) {
      await telegram("sendMessage", {
        chat_id: telegramPrivateChatId,
        text: "This linking link has already been used or expired. Please create a new one from HDLink.",
      });

      return NextResponse.json({ ok: true });
    }

    // Generate a single-use invite. The user must join the channel
    // before a membership record is created.
    const invite = await telegram("createChatInviteLink", {
      chat_id: channelId,
      member_limit: 1,
      expire_date: Math.floor(Date.now() / 1000) + 10 * 60,
      name: `HDLink-${String(reservedToken.user_id).slice(0, 8)}`,
    });

    const inviteLink = invite?.invite_link;

    if (typeof inviteLink !== "string" || !inviteLink.startsWith("https://t.me/")) {
      throw new Error("Telegram did not return a valid invite link.");
    }

    // Store a pending membership. Expiry removal uses the Telegram ID.
    const { data: existing, error: existingError } = await admin
      .from("telegram_memberships")
      .select("id")
      .eq("user_id", reservedToken.user_id)
      .eq("telegram_chat_id", channelId)
      .maybeSingle();

    if (existingError) {
      throw new Error("Could not check existing Telegram membership.");
    }

    const membershipValues = {
      telegram_user_id: telegramUserId,
      telegram_chat_id: channelId,
      invite_link: inviteLink,
      joined_at: now,
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
          user_id: reservedToken.user_id,
          ...membershipValues,
        });

      if (error) {
        throw new Error("Could not save Telegram membership.");
      }
    }

    await telegram("sendMessage", {
      chat_id: telegramPrivateChatId,
      text: "Your HDLink Telegram link is ready. Use this one-time invite within 10 minutes:\n\n" +
        inviteLink +
        "\n\nPlease join using this Telegram account.",
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
