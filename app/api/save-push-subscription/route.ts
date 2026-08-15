import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      userId,
      subscription,
    } = body;

    if (!userId || !subscription) {
      return NextResponse.json(
        {
          error: "userId and subscription are required.",
        },
        { status: 400 }
      );
    }

    const endpoint = subscription.endpoint;
    const p256dh = subscription.keys?.p256dh;
    const auth = subscription.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        {
          error: "Invalid push subscription.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint,
          p256dh,
          auth,
        },
        {
          onConflict: "endpoint",
        }
      );

    if (error) {
      console.error(
        "Save push subscription error:",
        error
      );

      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Push subscription saved.",
    });
  } catch (error: any) {
    console.error(
      "Push subscription API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to save push subscription.",
      },
      { status: 500 }
    );
  }
}