
import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration is missing." },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");
    const accessToken = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!accessToken) {
      return NextResponse.json(
        { error: "Please log in again." },
        { status: 401 }
      );
    }

    // Verify the caller's Supabase access token.
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Your session is invalid. Please log in again." },
        { status: 401 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Require a currently active HDLink subscription.
    const now = new Date().toISOString();

    const { data: subscriptions, error: subscriptionError } =
      await admin
        .from("subscriptions")
        .select("id, plan_id, expires_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gt("expires_at", now)
        .order("expires_at", { ascending: false })
        .limit(20);

    if (subscriptionError) {
      console.error("Link token subscription check failed:", subscriptionError);
      return NextResponse.json(
        { error: "Could not verify your subscription." },
        { status: 500 }
      );
    }

    if (!subscriptions?.length) {
      return NextResponse.json(
        { error: "An active HDLink subscription is required." },
        { status: 403 }
      );
    }

    const planIds = [...new Set(subscriptions.map((s) => Number(s.plan_id)))];

    const { data: plans, error: plansError } = await admin
      .from("plans")
      .select("id, source, is_active")
      .in("id", planIds)
      .eq("source", "hdlink")
      .eq("is_active", true);

    if (plansError) {
      console.error("Link token plan check failed:", plansError);
      return NextResponse.json(
        { error: "Could not verify your HDLink plan." },
        { status: 500 }
      );
    }

    const validPlanIds = new Set((plans || []).map((p) => Number(p.id)));
    const validSubscription = subscriptions.some((s) =>
      validPlanIds.has(Number(s.plan_id))
    );

    if (!validSubscription) {
      return NextResponse.json(
        { error: "An active HDLink subscription is required." },
        { status: 403 }
      );
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Expire previous unused tokens for this user.
    const { error: expireError } = await admin
      .from("telegram_link_tokens")
      .update({ used_at: now })
      .eq("user_id", user.id)
      .is("used_at", null);

    if (expireError) {
      console.error("Could not expire previous link tokens:", expireError);
      return NextResponse.json(
        { error: "Could not prepare a new linking token." },
        { status: 500 }
      );
    }

    const { error: insertError } = await admin
      .from("telegram_link_tokens")
      .insert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error("Could not save link token:", insertError);
      return NextResponse.json(
        { error: "Could not create a linking token." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      token: rawToken,
      expiresAt,
    });
  } catch (error) {
    console.error("Telegram link token error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
