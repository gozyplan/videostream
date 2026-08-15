import { supabase } from "@/lib/supabase";

export async function enablePushNotifications() {
  try {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      console.log("Push notifications are not supported.");
      return false;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log("User is not logged in.");
      return false;
    }

    const permission =
      await Notification.requestPermission();

    if (permission !== "granted") {
      console.log("Notification permission denied.");
      return false;
    }

    const registration =
      await navigator.serviceWorker.register("/sw.js");

    await navigator.serviceWorker.ready;

    let subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      const vapidPublicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        console.error(
          "NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing."
        );
        return false;
      }

      const applicationServerKey =
        urlBase64ToUint8Array(
          vapidPublicKey
        );

      subscription =
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
    }

    const response = await fetch(
      "/api/save-push-subscription",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          subscription:
            subscription.toJSON(),
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error(
        "Failed to save subscription:",
        result
      );

      return false;
    }

    console.log(
      "Push notification subscription saved."
    );

    return true;
  } catch (error) {
    console.error(
      "Enable push notification error:",
      error
    );

    return false;
  }
}

function urlBase64ToUint8Array(
  base64String: string
) {
  const padding =
    "=".repeat(
      (4 -
        (base64String.length % 4)) %
        4
    );

  const base64 =
    (
      base64String +
      padding
    )
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const rawData =
    window.atob(base64);

  return Uint8Array.from(
    [...rawData].map(
      (char) => char.charCodeAt(0)
    )
  );
}