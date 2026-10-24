
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;
const CRON_SECRET = process.env.CRON_SECRET!;

type TelegramResult = {
  ok: boolean;
  description?: string;
};

async function telegram(
  method: string,
  body: Record<string, unknown>
) {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  const result =
    (await response.json()) as TelegramResult;

  if (!response.ok || !result.ok) {
    throw new Error(
      result.description || `Telegram ${method} failed`
    );
  }

  return result;
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");

  if (
    !CRON_SECRET ||
    authorization !== `Bearer ${CRON_SECRET}`
  ) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !BOT_TOKEN ||
    !CHAT_ID
  ) {
    return NextResponse.json(
      { error: "Required environment variables are missing" },
      { status: 500 }
    );
  }

  const chatId = Number(CHAT_ID);

  if (!Number.isSafeInteger(chatId) || chatId === 0) {
    return NextResponse.json(
      { error: "TELEGRAM_CHAT_ID is invalid" },
      { status: 500 }
    );
  }

  const now = new Date().toISOString();

  // Include older expired subscriptions as well as newly
  // expired active subscriptions.
  const { data: expired, error } = await supabase
    .from("subscriptions")
    .select("id, user_id, expires_at, status, plans!inner(source)")
    .in("status", ["active", "expired"])
    .eq("plans.source", "hdlink")
    .not("expires_at", "is", null)
    .lte("expires_at", now)
    .order("expires_at", { ascending: true })
    .limit(1000);

  if (error) {
    console.error("Expired subscription query failed:", error);

    return NextResponse.json(
      { error: "Could not load expired subscriptions" },
      { status: 500 }
    );
  }

  let checked = 0;
  let removed = 0;
  let skipped = 0;
  let missingMembership = 0;
  const errors: string[] = [];
  const processedUsers = new Set<string>();

  for (const subscription of expired ?? []) {
    checked++;

    const userId = String(subscription.user_id);

    try {
      // Process each user only once in this run.
      if (processedUsers.has(userId)) {
        continue;
      }

      processedUsers.add(userId);

      // Do not remove users who have another valid HDLink
      // subscription. A null expiry is treated as non-expiring.
      const { data: valid, error: validError } = await supabase
        .from("subscriptions")
        .select("id, expires_at, plans!inner(source)")
        .eq("user_id", subscription.user_id)
        .eq("status", "active")
        .eq("plans.source", "hdlink")
        .or(`expires_at.gt.${now},expires_at.is.null`)
        .limit(1);

      if (validError) {
        throw validError;
      }

      if (valid && valid.length > 0) {
        skipped++;

        // Close the old expired subscription if it is still
        // marked active. Keep the valid subscription untouched.
        const { error: statusError } = await supabase
          .from("subscriptions")
          .update({ status: "expired" })
          .eq("user_id", subscription.user_id)
          .eq("status", "active")
          .lte("expires_at", now);

        if (statusError) {
          throw statusError;
        }

        continue;
      }

      // Find this user's active Telegram membership record.
      const { data: membership, error: membershipError } =
        await supabase
          .from("telegram_memberships")
          .select(
            "id, telegram_user_id, telegram_chat_id, removed_at"
          )
          .eq("user_id", subscription.user_id)
          .eq("telegram_chat_id", chatId)
          .is("removed_at", null)
          .limit(1)
          .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (!membership) {
        // There is no active membership record to remove.
        // Still close the user's expired subscriptions.
        missingMembership++;

        const { error: statusError } = await supabase
          .from("subscriptions")
          .update({ status: "expired" })
          .eq("user_id", subscription.user_id)
          .eq("status", "active")
          .not("expires_at", "is", null)
          .lte("expires_at", now);

        if (statusError) {
          throw statusError;
        }

        continue;
      }

      const telegramUserId = Number(membership.telegram_user_id);

      if (
        !Number.isSafeInteger(telegramUserId) ||
        telegramUserId <= 0
      ) {
        throw new Error("Invalid telegram_user_id in membership");
      }

      // Ban and immediately unban to remove the user without
      // permanently blocking a future invitation.
      await telegram("banChatMember", {
        chat_id: chatId,
        user_id: telegramUserId,
      });

      await telegram("unbanChatMember", {
        chat_id: chatId,
        user_id: telegramUserId,
        only_if_banned: true,
      });

      // Mark membership removed only after Telegram succeeds.
      const { error: updateMembershipError } = await supabase
        .from("telegram_memberships")
        .update({
          removed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", membership.id)
        .is("removed_at", null);

      if (updateMembershipError) {
        throw updateMembershipError;
      }

      removed++;

      // Mark expired subscriptions for this user as expired.
      const { error: updateSubscriptionError } = await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("user_id", subscription.user_id)
        .eq("status", "active")
        .not("expires_at", "is", null)
        .lte("expires_at", now);

      if (updateSubscriptionError) {
        throw updateSubscriptionError;
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
