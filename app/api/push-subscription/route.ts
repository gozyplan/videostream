import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      user_id,
      endpoint,
      p256dh,
      auth,
    } = body;

    if (!user_id || !endpoint || !p256dh || !auth) {
      return NextResponse.json(
        {
          error: "Missing push subscription data",
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id,
          endpoint,
          p256dh,
          auth,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "endpoint",
        }
      );

    if (error) {
      console.error(
        "Push subscription save error:",
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
      message: "Push subscription saved",
    });
  } catch (error: any) {
    console.error("Push API error:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong",
      },
      { status: 500 }
    );
  }
}