import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const {
      userId,
      type,
      planName,
    } = body;

    if (
      !userId ||
      !type
    ) {
      return NextResponse.json(
        {
          error:
            "userId and type are required.",
        },
        {
          status: 400,
        }
      );
    }

    let title = "";
    let message = "";
    let url = "/";

    if (type === "approved") {
      title = "Payment Approved ✓";
      message = `Your ${planName || "premium"} plan has been approved. Premium access is now active.`;
      url = "/premium";
    }

    if (type === "rejected") {
      title = "Payment Rejected";
      message = `Your payment request for ${planName || "the selected plan"} was rejected. Please check your payment details and try again.`;
      url = "/#plans";
    }

    if (!title) {
      return NextResponse.json(
        {
          error:
            "Invalid notification type.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: subscriptions,
      error: subscriptionError,
    } = await supabaseAdmin
      .from("push_subscriptions")
      .select(
        "id, endpoint, p256dh, auth"
      )
      .eq(
        "user_id",
        userId
      );

    if (subscriptionError) {
      console.error(
        "Push subscription query error:",
        subscriptionError
      );

      return NextResponse.json(
        {
          error:
            subscriptionError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !subscriptions ||
      subscriptions.length === 0
    ) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message:
          "User has no push subscription.",
      });
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url,
    });

    let sent = 0;

    for (
      const subscription of subscriptions
    ) {
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

        sent++;
      } catch (error: any) {
        console.error(
          "Push send error:",
          error
        );

        // Remove expired/invalid subscription
        if (
          error?.statusCode === 404 ||
          error?.statusCode === 410
        ) {
          await supabaseAdmin
            .from(
              "push_subscriptions"
            )
            .delete()
            .eq(
              "id",
              subscription.id
            );
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent,
    });
  } catch (error: any) {
    console.error(
      "Payment notification API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Notification failed.",
      },
      {
        status: 500,
      }
    );
  }
}