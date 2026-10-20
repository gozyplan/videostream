
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;
const CRON_SECRET = process.env.CRON_SECRET!;

async function telegram(method: string, body: Record<string, unknown>) {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram ${method} failed`);
  }

  return result;
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!CRON_SECRET || authorization !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!BOT_TOKEN || !CHAT_ID) {
    return NextResponse.json(
      { error: "Telegram environment variables are missing" },
      { status: 500 }
    );
  }

  const now = new Date().toISOString();

  const { data: expired, error } = await supabase
    .from("subscriptions")
    .select("id, user_id, expires_at, plans!inner(source)")
    .eq("status", "active")
    .eq("plans.source", "hdlink")
    .lte("expires_at", now);

  if (error) {
    console.error("Expired subscription query failed:", error);
    return NextResponse.json(
      { error: "Could not load expired subscriptions" },
      { status: 500 }
    );
  }

  let removed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const subscription of expired ?? []) {
    try {
      // Don't remove a user who has another valid HDLink subscription.
      const { data: valid, error: validError } = await supabase
        .from("subscriptions")
        .select("id, plans!inner(source)")
        .eq("user_id", subscription.user_id)
        .eq("status", "active")
        .eq("plans.source", "hdlink")
        .gt("expires_at", now)
        .limit(1);

      if (validError) throw validError;

      if (valid && valid.length > 0) {
        skipped++;
        continue;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("telegram_memberships")
        .select("id, telegram_user_id, telegram_chat_id, removed_at")
        .eq("user_id", subscription.user_id)
        .eq("telegram_chat_id", Number(CHAT_ID))
        .is("removed_at", null)
        .maybeSingle();

      if (membershipError) throw membershipError;

      if (membership) {
        // Ban, then immediately unban: remove from channel without
        // permanently preventing the member from joining again later.
        await telegram("banChatMember", {
          chat_id: Number(CHAT_ID),
          user_id: Number(membership.telegram_user_id),
        });

        await telegram("unbanChatMember", {
          chat_id: Number(CHAT_ID),
          user_id: Number(membership.telegram_user_id),
          only_if_banned: true,
        });

        const { error: updateMembershipError } = await supabase
          .from("telegram_memberships")
          .update({
            removed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", membership.id);

        if (updateMembershipError) throw updateMembershipError;

        removed++;
      }

      const { error: updateSubscriptionError } = await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("id", subscription.id)
        .eq("status", "active");

      if (updateSubscriptionError) throw updateSubscriptionError;
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
    checked: expired?.length ?? 0,
    removed,
    skipped,
    errors,
  });
}
