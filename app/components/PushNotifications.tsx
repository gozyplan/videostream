"use client";

import { useEffect } from "react";
import { enablePushNotifications } from "@/lib/push-notifications";

export default function PushNotifications() {
  useEffect(() => {
    const enable = async () => {
      await enablePushNotifications();
    };

    enable();
  }, []);

  return null;
}