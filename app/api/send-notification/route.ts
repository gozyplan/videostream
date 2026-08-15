import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      userId,
      title,
      message,
      url = "/",
    } = body;

    if (!userId || !title || !message) {
      return NextResponse.json(
        {
          error:
            "userId, title and message are required.",
        },
        { status: 400 }
      );
    }

    const { data: subscriptions, error } =
      await supabase
        .from("push_subscriptions")
        .select(
          "id, endpoint, p256dh, auth"
        )
        .eq("user_id", userId);

    if (error) {
      console.error(
        "Subscription fetch error:",
        error
      );

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (
      !subscriptions ||
      subscriptions.length === 0
    ) {
      return NextResponse.json({
        success: true,
        message:
          "No push subscription found for this user.",
      });
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url,
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint:
                subscription.endpoint,
              keys: {
                p256dh:
                  subscription.p256dh,
                auth:
                  subscription.auth,
              },
            },
            payload
          );

          return {
            success: true,
            id: subscription.id,
          };
        } catch (error: any) {
          console.error(
            "Push send error:",
            error
          );

          // Subscription expired/invalid
          if (
            error?.statusCode === 404 ||
            error?.statusCode === 410
          ) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq(
                "id",
                subscription.id
              );
          }

          return {
            success: false,
            id: subscription.id,
          };
        }
      })
    );

    const successful = results.filter(
      (result) =>
        result.status === "fulfilled" &&
        result.value.success
    ).length;

    return NextResponse.json({
      success: true,
      sent: successful,
      total: subscriptions.length,
    });
  } catch (error: any) {
    console.error(
      "Send notification error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Notification failed.",
      },
      { status: 500 }
    );
  }
}