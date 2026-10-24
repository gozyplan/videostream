import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TelegramResult = {
  ok: boolean;
  description?: string;
};

type Subscription = {
  id: number | string;
  user_id: string;
  plan_id: number | string;
  expires_at: string | null;
  status: string;
};

type Membership = {
  id: number | string;
  telegram_user_id: number | string;
  telegram_chat_id: number | string;
  removed_at: string | null;
};

function jsonError(
  message: string,
  status: number,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    { error: message, ...extra },
    { status }
  );
}

async function telegram(
  botToken: string,
  method: string,
  body: Record<string, unknown>
) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  const result = (await response.json()) as TelegramResult;

  if (!response.ok || !result.ok) {
    throw new Error(
      result.description || `Telegram ${method} failed`
    );
  }

  return result;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return jsonError("Unauthorized", 401);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatIdValue = process.env.TELEGRAM_CHAT_ID;

  const missingVariables = [
    !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
    !botToken && "TELEGRAM_BOT_TOKEN",
    !chatIdValue && "TELEGRAM_CHAT_ID",
  ].filter(Boolean);

  if (missingVariables.length > 0) {
    return jsonError("Required environment variables are missing", 500, {
      missing: missingVariables,
    });
  }

  const chatId = Number(chatIdValue);

  if (!Number.isSafeInteger(chatId) || chatId === 0) {
    return jsonError("TELEGRAM_CHAT_ID is invalid", 500);
  }

  const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const now = new Date().toISOString();

  // Find active HDLink plans separately; no subscriptions-plans
  // foreign-key relationship is required.
  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select("id")
    .eq("source", "hdlink")
    .eq("is_active", true);

  if (plansError) {
    console.error("HDLink plans query failed:", plansError);

    return jsonError("Could not load HDLink plans", 500, {
      code: plansError.code,
      details: plansError.message,
      hint: plansError.hint,
    });
  }

  const planIds = (plans ?? []).map((plan) => plan.id);

  if (planIds.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No active HDLink plans found",
      checked: 0,
      removed: 0,
      skipped: 0,
      missingMembership: 0,
      errors: [],
      checkedAt: now,
    });
  }

  const { data: expired, error: expiredError } = await supabase
    .from("subscriptions")
    .select("id, user_id, plan_id, expires_at, status")
    .in("plan_id", planIds)
    .in("status", ["active", "expired"])
    .not("expires_at", "is", null)
    .lte("expires_at", now)
    .order("expires_at", { ascending: true })
    .limit(1000);

  if (expiredError) {
    console.error("Expired subscription query failed:", expiredError);

    return jsonError("Could not load expired subscriptions", 500, {
      code: expiredError.code,
      details: expiredError.message,
      hint: expiredError.hint,
    });
  }

  let checked = 0;
  let removed = 0;
  let skipped = 0;
  let missingMembership = 0;

  const errors: string[] = [];
  const processedUsers = new Set<string>();

  for (const subscription of (expired ?? []) as Subscription[]) {
    checked++;

    const userId = String(subscription.user_id);

    if (processedUsers.has(userId)) {
      continue;
    }

    processedUsers.add(userId);

    try {
      // Keep members who have another valid active HDLink plan.
      const { data: valid, error: validError } = await supabase
        .from("subscriptions")
        .select("id, expires_at, plan_id")
        .eq("user_id", subscription.user_id)
        .in("plan_id", planIds)
        .eq("status", "active")
        .or(`expires_at.gt.${now},expires_at.is.null`)
        .limit(1);

      if (validError) {
        throw new Error(
          `Valid subscription query failed (${validError.code}): ${validError.message}`
        );
      }

      if (valid && valid.length > 0) {
        skipped++;

        const { error: statusError } = await supabase
          .from("subscriptions")
          .update({ status: "expired" })
          .eq("user_id", subscription.user_id)
          .in("plan_id", planIds)
          .eq("status", "active")
          .not("expires_at", "is", null)
          .lte("expires_at", now);

        if (statusError) {
          throw new Error(
            `Could not update expired subscriptions: ${statusError.message}`
          );
        }

        continue;
      }

      const {
        data: membership,
        error: membershipError,
      } = await supabase
        .from("telegram_memberships")
        .select("id, telegram_user_id, telegram_chat_id, removed_at")
        .eq("user_id", subscription.user_id)
        .eq("telegram_chat_id", chatId)
        .is("removed_at", null)
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        throw new Error(
          `Membership query failed (${membershipError.code}): ${membershipError.message}`
        );
      }

      if (!membership) {
        missingMembership++;

        const { error: statusError } = await supabase
          .from("subscriptions")
          .update({ status: "expired" })
          .eq("user_id", subscription.user_id)
          .in("plan_id", planIds)
          .eq("status", "active")
          .not("expires_at", "is", null)
          .lte("expires_at", now);

        if (statusError) {
          throw new Error(
            `Could not expire subscription: ${statusError.message}`
          );
        }

        continue;
      }

      const member = membership as Membership;
      const telegramUserId = Number(member.telegram_user_id);

      if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) {
        throw new Error("Invalid telegram_user_id in membership");
      }

      // Ban and immediately unban to remove access without
      // permanently blocking a future invitation.
      await telegram(botToken!, "banChatMember", {
        chat_id: chatId,
        user_id: telegramUserId,
      });

      await telegram(botToken!, "unbanChatMember", {
        chat_id: chatId,
        user_id: telegramUserId,
        only_if_banned: true,
      });

      const removedAt = new Date().toISOString();

      const { error: membershipUpdateError } = await supabase
        .from("telegram_memberships")
        .update({
          removed_at: removedAt,
          updated_at: removedAt,
        })
        .eq("id", member.id)
        .is("removed_at", null);

      if (membershipUpdateError) {
        throw new Error(
          `Telegram removal succeeded but membership update failed: ${membershipUpdateError.message}`
        );
      }

      removed++;

      const { error: subscriptionUpdateError } = await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("user_id", subscription.user_id)
        .in("plan_id", planIds)
        .eq("status", "active")
        .not("expires_at", "is", null)
        .lte("expires_at", now);

      if (subscriptionUpdateError) {
        throw new Error(
          `Telegram removal succeeded but subscription update failed: ${subscriptionUpdateError.message}`
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";

      console.error(
        `Expiry processing failed for subscription ${subscription.id}:`,
        message
      );

      errors.push(`${subscription.id}: ${message}`);
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    checked,
    removed,
    skipped,
    missingMembership,
    errors,
    checkedAt: now,
  });
}
