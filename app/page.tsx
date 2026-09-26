"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Plan = {
  id: number;
  name: string;
  price: number;
  duration_days: number;
  description?: string | null;
  is_active: boolean;
  source?: string | null;
};

type Video = {
  id: string | number;
  title: string;
  thumbnail_url?: string;
  video_url?: string;
  duration?: string | number;
};

type User = {
  id: string;
  email?: string | null;
};

const TELEGRAM_URL =
  "https://t.me/+IVAeTBOoSMdhZTQ1";

const WHATSAPP_URL =
  "https://whatsapp.com/channel/0029VavGkVeCsU9MFBcyX91V";

const PLAN_CONFIG = [
  {
    key: "day",
    price: 210,
    duration: 1,
    title: "1 Day",
    subtitle: "Quick Access",
    badge: "QUICK ACCESS",
  },
  {
    key: "three-months",
    price: 550,
    duration: 90,
    title: "3 Months",
    subtitle: "90 Days Premium",
    badge: "MOST POPULAR",
  },
  {
    key: "lifetime",
    price: 850,
    duration: null,
    title: "Lifetime Access",
    subtitle: "Unlimited Access",
    badge: "VIP • LIFETIME",
  },
] as const;

export default function HDLinkHomePage() {
  return (
    <Suspense fallback={null}>
      <HDLinkPage />
    </Suspense>
  );
}

function HDLinkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlPlanId = searchParams.get("plan");

  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);

  const [selectedPlan, setSelectedPlan] =
    useState<Plan | null>(null);

  const [utr, setUtr] = useState("");

  const [loadingVideos, setLoadingVideos] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [paymentSubmitted, setPaymentSubmitted] =
    useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [pendingPaymentId, setPendingPaymentId] =
    useState<number | null>(null);

  const [hasActivePlan, setHasActivePlan] =
    useState(false);

  const [checkingSubscription, setCheckingSubscription] =
    useState(true);

  useEffect(() => {
    initializeFast();
  }, []);

  useEffect(() => {
    if (!urlPlanId || plans.length === 0) {
      return;
    }

    const id = Number(urlPlanId);

    if (!Number.isFinite(id)) {
      router.replace("/");
      return;
    }

    const plan = plans.find(
      (item) => item.id === id
    );

    if (!plan) {
      localStorage.removeItem(
        "hdlink_pending_plan_id"
      );

      router.replace("/");
      return;
    }

    localStorage.setItem(
      "hdlink_pending_plan_id",
      String(plan.id)
    );

    if (user) {
      setSelectedPlan(plan);
    }
  }, [
    urlPlanId,
    plans,
    user,
    router,
  ]);

  useEffect(() => {
    if (
      !paymentSubmitted ||
      !pendingPaymentId
    ) {
      return;
    }

    let stopped = false;

    async function checkStatus() {
      const {
        data,
        error: paymentError,
      } = await supabase
        .from("payment_requests")
        .select(
          "id,status,user_id,plan_id"
        )
        .eq(
          "id",
          pendingPaymentId
        )
        .maybeSingle();

      if (
        stopped ||
        paymentError ||
        !data
      ) {
        return;
      }

      if (data.status === "approved") {
        localStorage.removeItem(
          "hdlink_pending_payment_id"
        );

        localStorage.removeItem(
          "hdlink_pending_plan_id"
        );

        setPaymentSubmitted(false);

        router.replace("/premium");

        return;
      }

      if (data.status === "rejected") {
        setPaymentSubmitted(false);
        setMessage("");

        setError(
          "Your payment was rejected. Please check your payment details and submit again."
        );

        localStorage.removeItem(
          "hdlink_pending_payment_id"
        );
      }
    }

    checkStatus();

    const interval = window.setInterval(
      checkStatus,
      4000
    );

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [
    paymentSubmitted,
    pendingPaymentId,
    router,
  ]);
async function initializeFast() {
  try {
    // Public home page par getUser() ki jagah getSession()
    // use karo. Logged-out user ke liye error nahi aayega.
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error(
        "HDLink session error:",
        sessionError
      );
    }

    const currentUser = session?.user ?? null;

    if (currentUser) {
      const currentUserData: User = {
        id: currentUser.id,
        email: currentUser.email,
      };

      setUser(currentUserData);

      await checkHDLinkSubscription(
        currentUser.id
      );
    } else {
      // User logged out hai — normal condition
      setUser(null);
      setHasActivePlan(false);
      setCheckingSubscription(false);
    }
  } catch (error) {
    console.error(
      "HDLink initialization error:",
      error
    );

    setUser(null);
    setHasActivePlan(false);
    setCheckingSubscription(false);
  }

  // Public data
  await Promise.all([
    loadPlans(),
    loadVideos(),
  ]);
}

  // =========================================================
  // CHECK ACTIVE HDLINK SUBSCRIPTION
  // =========================================================

  async function checkHDLinkSubscription(
    userId: string
  ) {
    setCheckingSubscription(true);

    try {
      const now =
        new Date().toISOString();

      /*
       * IMPORTANT:
       *
       * We do NOT query subscriptions.source here.
       *
       * Some Supabase databases do not have a source
       * column inside subscriptions.
       *
       * Instead:
       *
       * 1. Find user's active subscriptions.
       * 2. Get their plan_id values.
       * 3. Check those plan IDs inside plans table.
       * 4. Only plans with source = "hdlink" count.
       */

      const {
        data: subscriptionData,
        error: subscriptionError,
      } = await supabase
        .from("subscriptions")
        .select(
          "id,status,expires_at,plan_id"
        )
        .eq(
          "user_id",
          userId
        )
        .eq(
          "status",
          "active"
        )
        .gt(
          "expires_at",
          now
        )
        .order(
          "expires_at",
          {
            ascending: false,
          }
        );

      if (subscriptionError) {
        console.error(
          "HDLink subscription query failed:",
          subscriptionError.message ||
            subscriptionError
        );

        setHasActivePlan(false);
        return;
      }

      if (
        !subscriptionData ||
        subscriptionData.length === 0
      ) {
        setHasActivePlan(false);
        return;
      }

      const subscriptionPlanIds =
        subscriptionData
          .map(
            (subscription) =>
              Number(
                subscription.plan_id
              )
          )
          .filter(
            (id) =>
              Number.isFinite(id)
          );

      if (
        subscriptionPlanIds.length === 0
      ) {
        setHasActivePlan(false);
        return;
      }

      /*
       * Find only HDLink plans.
       *
       * We intentionally do not require is_active = true
       * here because an already purchased subscription
       * should remain valid until expires_at even if the
       * plan is later disabled for new purchases.
       */

      const {
        data: hdlinkPlans,
        error: planError,
      } = await supabase
        .from("plans")
        .select(
          "id,source"
        )
        .in(
          "id",
          subscriptionPlanIds
        )
        .eq(
          "source",
          "hdlink"
        );

      if (planError) {
        console.error(
          "HDLink subscription plan check failed:",
          planError.message ||
            planError
        );

        setHasActivePlan(false);
        return;
      }

      if (
        !hdlinkPlans ||
        hdlinkPlans.length === 0
      ) {
        setHasActivePlan(false);
        return;
      }

      const hdlinkPlanIds =
        hdlinkPlans.map(
          (plan) =>
            Number(plan.id)
        );

      const hasValidHDLinkSubscription =
        subscriptionData.some(
          (subscription) =>
            hdlinkPlanIds.includes(
              Number(
                subscription.plan_id
              )
            ) &&
            new Date(
              subscription.expires_at
            ).getTime() >
              Date.now()
        );

      setHasActivePlan(
        hasValidHDLinkSubscription
      );
    } catch (error: any) {
      console.error(
        "HDLink subscription check failed:",
        error?.message ||
          error
      );

      setHasActivePlan(false);
    } finally {
      setCheckingSubscription(false);
    }
  }

  // =========================================================
  // LOAD HDLINK PLANS
  // =========================================================

  async function loadPlans() {
    const {
      data,
      error: planError,
    } = await supabase
      .from("plans")
      .select(
        "id,name,price,duration_days,description,is_active,source"
      )
      .eq(
        "is_active",
        true
      )
      .eq(
        "source",
        "hdlink"
      )
      .order(
        "price",
        {
          ascending: true,
        }
      );

    if (planError) {
      console.error(
        "HDLink plans error:",
        planError
      );

      setPlans([]);
      return;
    }

    const databasePlans =
      (data || []) as Plan[];

    const matched: Plan[] = [];

    for (const config of PLAN_CONFIG) {
      let plan:
        | Plan
        | undefined;

      if (config.key === "day") {
        plan =
          databasePlans.find(
            (item) =>
              Number(
                item.price
              ) === 210 &&
              Number(
                item.duration_days
              ) === 1
          );
      }

      if (
        config.key ===
        "three-months"
      ) {
        plan =
          databasePlans.find(
            (item) =>
              Number(
                item.price
              ) === 550 &&
              Number(
                item.duration_days
              ) === 90
          );
      }

      if (
        config.key ===
        "lifetime"
      ) {
        plan =
          databasePlans.find(
            (item) => {
              const name =
                String(
                  item.name ||
                    ""
                ).toLowerCase();

              const duration =
                Number(
                  item.duration_days
                );

              return (
                Number(
                  item.price
                ) === 850 &&
                (
                  name.includes(
                    "life"
                  ) ||
                  name.includes(
                    "lifetime"
                  ) ||
                  duration >=
                    3650
                )
              );
            }
          );
      }

      if (plan) {
        matched.push({
          ...plan,
          name:
            config.title,
          price:
            config.price,
        });
      }
    }

    setPlans(matched);
  }

  // =========================================================
  // LOAD VIDEOS
  // =========================================================

  async function loadVideos() {
    setLoadingVideos(true);

    try {
      const response =
        await fetch(
          "/api/bunny-videos",
          {
            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Videos unavailable."
        );
      }

      let loaded: Video[] =
        [];

      if (
        Array.isArray(
          data
        )
      ) {
        loaded =
          data;
      } else if (
        Array.isArray(
          data?.videos
        )
      ) {
        loaded =
          data.videos;
      } else if (
        Array.isArray(
          data?.items
        )
      ) {
        loaded =
          data.items;
      }

      setVideos(
        loaded.slice(
          0,
          12
        )
      );
    } catch (err) {
      console.error(
        "Video preview error:",
        err
      );

      setVideos([]);
    } finally {
      setLoadingVideos(
        false
      );
    }
  }

  // =========================================================
  // FIND PLAN
  // =========================================================

  function findPlan(
    key: string
  ) {
    if (
      key === "day"
    ) {
      return (
        plans.find(
          (p) =>
            Number(
              p.price
            ) === 210 &&
            Number(
              p.duration_days
            ) === 1
        ) ||
        null
      );
    }

    if (
      key ===
      "three-months"
    ) {
      return (
        plans.find(
          (p) =>
            Number(
              p.price
            ) === 550 &&
            Number(
              p.duration_days
            ) === 90
        ) ||
        null
      );
    }

    if (
      key === "lifetime"
    ) {
      return (
        plans.find(
          (p) =>
            Number(
              p.price
            ) === 850
        ) ||
        null
      );
    }

    return null;
  }

  // =========================================================
  // SELECT PLAN
  // =========================================================

  function selectPlan(
    key: string
  ) {
    setError("");
    setMessage("");
    setUtr("");

    const plan =
      findPlan(key);

    if (!plan) {
      setError(
        "This HDLink plan is not configured in Supabase yet."
      );

      return;
    }

    localStorage.setItem(
      "hdlink_pending_plan_id",
      String(
        plan.id
      )
    );

    if (!user) {
      router.push(
        `/auth/register?plan=${encodeURIComponent(
          String(plan.id)
        )}`
      );

      return;
    }

    setSelectedPlan(
      plan
    );

    router.replace(
      `/?plan=${encodeURIComponent(
        String(plan.id)
      )}`,
      {
        scroll: false,
      }
    );
  }

  // =========================================================
  // SUBMIT PAYMENT
  // =========================================================

  async function submitPayment(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!selectedPlan) {
      setError(
        "Please select a plan."
      );

      return;
    }

    if (!user) {
      router.push(
        `/auth/register?plan=${encodeURIComponent(
          String(
            selectedPlan.id
          )
        )}`
      );

      return;
    }

    const transactionId =
      utr.trim();

    if (
      transactionId.length <
      6
    ) {
      setError(
        "Please enter a valid UTR / Transaction ID."
      );

      return;
    }

    setSubmitting(true);

    try {
      const {
        data: duplicate,
        error:
          duplicateError,
      } = await supabase
        .from(
          "payment_requests"
        )
        .select(
          "id,status"
        )
        .eq(
          "utr",
          transactionId
        )
        .maybeSingle();

      if (duplicateError) {
        throw duplicateError;
      }

      if (duplicate) {
        setError(
          "This UTR / Transaction ID has already been submitted."
        );

        return;
      }

      const {
        data: inserted,
        error:
          insertError,
      } = await supabase
        .from(
          "payment_requests"
        )
        .insert({
          user_id:
            user.id,
          plan_id:
            selectedPlan.id,
          utr:
            transactionId,
          status:
            "pending",
          source:
            "hdlink",
        })
        .select(
          "id,user_id,plan_id,status"
        )
        .single();

      if (insertError) {
        throw insertError;
      }

      if (inserted) {
        setPendingPaymentId(
          inserted.id
        );

        localStorage.setItem(
          "hdlink_pending_payment_id",
          String(
            inserted.id
          )
        );
      }

      localStorage.setItem(
        "hdlink_pending_plan_id",
        String(
          selectedPlan.id
        )
      );

      setPaymentSubmitted(
        true
      );

      setMessage(
        "Payment submitted. Waiting for admin approval."
      );
    } catch (err: any) {
      console.error(
        "Payment submit error:",
        err
      );

      setError(
        err?.message ||
          "Payment could not be submitted."
      );
    } finally {
      setSubmitting(
        false
      );
    }
  }

  // =========================================================
  // CLOSE PAYMENT
  // =========================================================

  function closePayment() {
    if (submitting) {
      return;
    }

    setSelectedPlan(
      null
    );

    setUtr("");

    setError("");

    setMessage("");

    setPaymentSubmitted(
      false
    );

    setPendingPaymentId(
      null
    );

    localStorage.removeItem(
      "hdlink_pending_plan_id"
    );

    router.replace(
      "/"
    );
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  async function logout() {
    await supabase.auth.signOut();

    setUser(null);
    setHasActivePlan(
      false
    );

    localStorage.removeItem(
      "hdlink_pending_plan_id"
    );

    localStorage.removeItem(
      "hdlink_pending_payment_id"
    );

    window.location.href =
      "/";
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#030303] text-white">

      {/* BACKGROUND */}

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-250px] h-[650px] w-[900px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[160px]" />

        <div className="absolute right-[-200px] top-[600px] h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[150px]" />

        <div className="absolute bottom-[-250px] left-[-200px] h-[500px] w-[500px] rounded-full bg-fuchsia-500/10 blur-[150px]" />
      </div>

      {/* NAVBAR */}

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">

          <button
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              })
            }
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg font-black text-black shadow-xl">
              H
            </div>

            <div className="text-left">
              <div className="text-lg font-black">
                HDLink
              </div>

              <div className="text-[9px] uppercase tracking-[0.3em] text-white/30">
                VIP Premium
              </div>
            </div>
          </button>

          <div className="flex items-center gap-3">

            {user &&
              !checkingSubscription &&
              hasActivePlan && (
                <button
                  onClick={() =>
                    router.push(
                      "/premium"
                    )
                  }
                  className="rounded-full bg-violet-500 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 hover:bg-violet-400"
                >
                  👑 Premium
                </button>
              )}

            <a
              href="#plans"
              className="hidden rounded-full border border-white/10 px-5 py-2.5 text-xs font-bold text-white/70 transition hover:bg-white/10 sm:block"
            >
              Plans
            </a>

            {user ? (
              <button
                onClick={logout}
                className="rounded-full border border-white/10 px-4 py-2.5 text-xs font-bold text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                Logout
              </button>
            ) : (
              <button
                onClick={() =>
                  router.push(
                    "/auth/register"
                  )
                }
                className="rounded-full bg-white px-5 py-2.5 text-xs font-black text-black transition hover:bg-white/90"
              >
                Create Account
              </button>
            )}

          </div>
        </div>
      </nav>

      {/* HERO */}

      <section className="relative z-10 min-h-[calc(100vh-80px)] px-5 pb-20 pt-20 sm:pt-28">
        <div className="mx-auto max-w-7xl">

          <div className="max-w-6xl">

            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-2 text-xs font-bold text-violet-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
              HDLink VIP Premium Access
            </div>

            <h1 className="text-5xl font-black leading-[0.95] tracking-[-0.06em] sm:text-7xl lg:text-8xl xl:text-9xl">
              Unlimited.
              <br />
              Premium.
              <br />
              <span className="text-white/35">
                HDLink.
              </span>
            </h1>

            <p className="mt-8 max-w-4xl text-base leading-8 text-white/50 sm:text-lg">
              Unlock the complete HDLink premium
              experience with premium video access,
              exclusive updates, VIP community access
              and secure account-based access.
              Get premium access, stay updated with
              the latest releases and enjoy the
              complete HDLink VIP experience.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">

              <button
                onClick={() =>
                  document
                    .getElementById(
                      "plans"
                    )
                    ?.scrollIntoView({
                      behavior:
                        "smooth",
                    })
                }
                className="rounded-full bg-white px-7 py-4 text-sm font-black text-black shadow-2xl transition hover:-translate-y-1"
              >
                View Premium Plans →
              </button>

              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-sky-400/30 bg-sky-400/10 px-7 py-4 text-sm font-black text-sky-200 transition hover:bg-sky-400/20"
              >
                ✈️ Join Telegram
              </a>

            </div>

          </div>

          <div className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            {[
              [
                "10,000+",
                "Telegram Video Updates",
              ],
              [
                "VIP",
                "Premium Community",
              ],
              [
                "24/7",
                "Premium Access",
              ],
              [
                "1 Account",
                "Secure Account Access",
              ],
            ].map(
              ([number, text]) => (
                <div
                  key={text}
                  className="rounded-3xl border border-white/10 bg-white/[0.035] p-6"
                >
                  <div className="text-3xl font-black">
                    {number}
                  </div>

                  <div className="mt-2 text-xs text-white/35">
                    {text}
                  </div>
                </div>
              )
            )}

          </div>

        </div>
      </section>

      {/* COMMUNITY */}

      <section className="relative z-10 border-y border-white/10 bg-white/[0.015] px-5 py-16">
        <div className="mx-auto max-w-7xl">

          <div className="max-w-3xl">

            <div className="text-xs font-black uppercase tracking-[0.3em] text-white/30">
              HDLink Community
            </div>

            <h2 className="mt-3 text-3xl font-black sm:text-5xl">
              Stay connected.
              <br />
              Never miss an update.
            </h2>

            <p className="mt-5 text-sm leading-7 text-white/40">
              Join the official HDLink channels for
              updates, announcements, new releases,
              premium notifications and community
              updates.
            </p>

          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">

            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-[30px] border border-sky-400/20 bg-gradient-to-br from-sky-500/15 to-white/[0.03] p-7 transition hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="text-4xl">
                  ✈️
                </div>

                <span className="rounded-full bg-sky-400/10 px-3 py-1 text-[10px] font-bold text-sky-200">
                  OFFICIAL
                </span>
              </div>

              <h3 className="mt-7 text-2xl font-black">
                Telegram Channel
              </h3>

              <p className="mt-3 text-sm leading-6 text-white/40">
                Get HDLink updates, new video
                notifications, announcements and
                premium community updates.
              </p>

              <div className="mt-6 font-bold text-sky-300">
                Join Telegram →
              </div>
            </a>

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-[30px] border border-green-400/20 bg-gradient-to-br from-green-500/15 to-white/[0.03] p-7 transition hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="text-4xl">
                  💬
                </div>

                <span className="rounded-full bg-green-400/10 px-3 py-1 text-[10px] font-bold text-green-200">
                  OFFICIAL
                </span>
              </div>

              <h3 className="mt-7 text-2xl font-black">
                WhatsApp Channel
              </h3>

              <p className="mt-3 text-sm leading-6 text-white/40">
                Follow HDLink directly on WhatsApp
                for important updates, announcements
                and new premium notifications.
              </p>

              <div className="mt-6 font-bold text-green-300">
                Join WhatsApp →
              </div>
            </a>

          </div>

        </div>
      </section>

      {/* VIDEO PREVIEWS */}

      <section className="relative z-10 px-5 py-20">
        <div className="mx-auto max-w-7xl">

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

            <div>
              <div className="text-xs font-black uppercase tracking-[0.3em] text-white/30">
                Premium Preview
              </div>

              <h2 className="mt-3 text-3xl font-black sm:text-5xl">
                See what awaits you.
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/40">
                Explore a blurred preview of the
                HDLink premium library. Full premium
                access becomes available after
                activation.
              </p>
            </div>

            <div className="rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-2 text-xs font-bold text-violet-200">
              🔒 PREMIUM CONTENT
            </div>

          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

            {loadingVideos
              ? Array.from({
                  length: 12,
                }).map(
                  (_, index) => (
                    <div
                      key={index}
                      className="aspect-video animate-pulse rounded-3xl bg-white/[0.06]"
                    />
                  )
                )
              : videos.length > 0
              ? videos.map(
                  (video, index) => (
                    <button
                      key={String(
                        video.id
                      )}
                      onClick={() =>
                        document
                          .getElementById(
                            "plans"
                          )
                          ?.scrollIntoView({
                            behavior:
                              "smooth",
                          })
                      }
                      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] text-left"
                    >
                      <div className="relative aspect-video overflow-hidden">

                        {video.thumbnail_url ? (
                          <img
                            src={
                              video.thumbnail_url
                            }
                            alt=""
                            loading="lazy"
                            className="h-full w-full scale-110 object-cover blur-[7px] brightness-50 transition duration-500 group-hover:scale-125"
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-violet-900/40 via-black to-blue-900/40" />
                        )}

                        <div className="absolute inset-0 bg-black/30" />

                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-black/60 text-xl backdrop-blur-xl">
                            🔒
                          </div>
                        </div>

                        <div className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur">
                          Premium Preview
                        </div>

                      </div>

                      <div className="p-4">
                        <div className="line-clamp-1 text-sm font-bold text-white/80">
                          {video.title ||
                            `Premium Video ${
                              index + 1
                            }`}
                        </div>

                        <div className="mt-2 text-[10px] text-violet-300/70">
                          🔒 Unlock with Premium
                        </div>
                      </div>
                    </button>
                  )
                )
              : Array.from({
                  length: 12,
                }).map(
                  (_, index) => (
                    <button
                      key={index}
                      onClick={() =>
                        document
                          .getElementById(
                            "plans"
                          )
                          ?.scrollIntoView({
                            behavior:
                              "smooth",
                          })
                      }
                      className="relative aspect-video overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-900/30 via-black to-blue-900/30"
                    >
                      <div className="absolute inset-0 backdrop-blur-md" />

                      <div className="relative flex h-full flex-col items-center justify-center">
                        <div className="text-3xl">
                          🔒
                        </div>

                        <div className="mt-3 text-xs font-bold text-white/60">
                          Premium Video
                        </div>
                      </div>
                    </button>
                  )
                )}

          </div>

        </div>
      </section>

      {/* PLANS */}

      <section
        id="plans"
        className="relative z-10 border-t border-white/10 px-5 py-24"
      >
        <div className="mx-auto max-w-7xl">

          <div className="mx-auto max-w-3xl text-center">

            <div className="inline-flex rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-2 text-xs font-bold text-violet-200">
              VIP PREMIUM PLANS
            </div>

            <h2 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
              Choose your access.
            </h2>

            <p className="mt-5 text-sm leading-7 text-white/40 sm:text-base">
              Simple plans. Secure account-based
              access. Manual payment verification.
              Choose the access that works for you.
            </p>

          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">

            {PLAN_CONFIG.map(
              (config) => {
                const plan =
                  findPlan(
                    config.key
                  );

                const lifetime =
                  config.key ===
                  "lifetime";

                const popular =
                  config.key ===
                  "three-months";

                return (
                  <div
                    key={
                      config.key
                    }
                    className={`relative overflow-hidden rounded-[35px] border p-7 shadow-2xl transition hover:-translate-y-2 ${
                      popular
                        ? "border-violet-400/40 bg-gradient-to-b from-violet-500/15 to-white/[0.03]"
                        : lifetime
                        ? "border-amber-400/30 bg-gradient-to-b from-amber-500/10 to-white/[0.03]"
                        : "border-white/10 bg-white/[0.035]"
                    }`}
                  >

                    {popular && (
                      <div className="absolute right-5 top-5 rounded-full bg-violet-400 px-3 py-1 text-[9px] font-black text-black">
                        ⭐ MOST POPULAR
                      </div>
                    )}

                    {lifetime && (
                      <div className="absolute right-5 top-5 rounded-full bg-amber-300 px-3 py-1 text-[9px] font-black text-black">
                        👑 VIP LIFETIME
                      </div>
                    )}

                    <div className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
                      {config.badge}
                    </div>

                    <h3 className="mt-8 text-2xl font-black">
                      {config.title}
                    </h3>

                    <div className="mt-5">
                      <span className="text-5xl font-black">
                        ₹{config.price}
                      </span>

                      <span className="ml-2 text-sm text-white/30">
                        / access
                      </span>
                    </div>

                    <p className="mt-4 text-sm text-white/40">
                      {config.subtitle}
                    </p>

                    <div className="mt-7 space-y-3">
                      {[
                        "Premium video access",
                        "Account based access",
                        "Manual payment verification",
                        "HDLink premium library",
                        lifetime
                          ? "Lifetime VIP access"
                          : "Secure premium account",
                      ].map(
                        (feature) => (
                          <div
                            key={
                              feature
                            }
                            className="flex items-center gap-3 text-sm text-white/65"
                          >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-400/10 text-[10px] text-green-300">
                              ✓
                            </span>

                            {feature}
                          </div>
                        )
                      )}
                    </div>

                    <button
                      onClick={() =>
                        selectPlan(
                          config.key
                        )
                      }
                      disabled={
                        !plan
                      }
                      className={`mt-9 w-full rounded-full py-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        lifetime
                          ? "bg-amber-300 text-black hover:bg-amber-200"
                          : "bg-white text-black hover:bg-white/90"
                      }`}
                    >
                      Pay Now — ₹
                      {config.price} →
                    </button>

                    {!plan && (
                      <p className="mt-3 text-center text-[10px] text-red-300/70">
                        Plan not configured
                      </p>
                    )}

                    <p className="mt-4 text-center text-[10px] text-white/25">
                      Secure account-based purchase
                      • Admin verification
                    </p>

                  </div>
                );
              }
            )}

          </div>

          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-5 text-center text-xs text-white/35">
            🔐 Payment is manually verified.
            Premium access activates after admin
            approval.
          </div>

        </div>
      </section>

      {/* FINAL CTA */}

      <section className="relative z-10 px-5 pb-24">
        <div className="mx-auto max-w-7xl">

          <div className="overflow-hidden rounded-[40px] border border-violet-400/20 bg-gradient-to-br from-violet-500/15 via-white/[0.04] to-blue-500/10 p-8 text-center sm:p-14">

            <div className="text-5xl">
              👑
            </div>

            <h2 className="mt-6 text-3xl font-black sm:text-5xl">
              Ready to unlock HDLink?
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/40">
              Choose your plan, create your secure
              account and activate premium access
              after payment verification.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">

              <button
                onClick={() =>
                  document
                    .getElementById(
                      "plans"
                    )
                    ?.scrollIntoView({
                      behavior:
                        "smooth",
                    })
                }
                className="rounded-full bg-white px-8 py-4 text-sm font-black text-black"
              >
                View Plans →
              </button>

              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-sky-400/30 bg-sky-400/10 px-8 py-4 text-sm font-black text-sky-200"
              >
                ✈️ Telegram
              </a>

            </div>

          </div>

        </div>
      </section>

      {/* FOOTER */}

      <footer className="relative z-10 border-t border-white/10 px-5 py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-center sm:flex-row sm:text-left">

          <div>
            <div className="font-black">
              HDLink
            </div>

            <div className="mt-1 text-xs text-white/25">
              VIP Premium Access
            </div>
          </div>

          <div className="text-xs text-white/25">
            Premium access • Secure account •
            Manual verification
          </div>

        </div>
      </footer>

      {/* PAYMENT MODAL */}

      {selectedPlan && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/90 p-5 backdrop-blur-xl">

          <div className="w-full max-w-lg rounded-[35px] border border-white/10 bg-[#0b0b0b] p-7 shadow-2xl sm:p-9">

            <div className="flex items-start justify-between gap-5">

              <div>
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
                  Payment
                </div>

                <h2 className="mt-2 text-3xl font-black">
                  {selectedPlan.name}
                </h2>
              </div>

              <button
                onClick={
                  closePayment
                }
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/50 hover:bg-white/10"
              >
                ✕
              </button>

            </div>

            <div className="mt-7 rounded-3xl border border-violet-400/20 bg-violet-400/10 p-5">

              <div className="text-xs text-white/35">
                Amount to Pay
              </div>

              <div className="mt-1 text-4xl font-black">
                ₹{selectedPlan.price}
              </div>

            </div>

            {/* QR PAYMENT */}

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-center">

              <div className="text-xs font-bold uppercase tracking-wider text-white/30">
                Scan & Pay
              </div>

              <div className="mt-4 flex justify-center">

                <div className="rounded-3xl bg-white p-3 shadow-2xl">
                  <img
                    src="/hdlink-qr.png"
                    alt="HDLink Payment QR Code"
                    className="h-64 w-64 object-contain sm:h-72 sm:w-72"
                  />
                </div>

              </div>

              <p className="mt-4 text-xs leading-5 text-white/40">
                Scan this QR code using any supported
                UPI app and pay exactly{" "}
                <span className="font-bold text-white/80">
                  ₹{selectedPlan.price}
                </span>
                .
              </p>

            </div>

            {/* PAYMENT INSTRUCTIONS */}

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">

              <div className="text-xs font-bold uppercase tracking-wider text-white/30">
                Payment Instructions
              </div>

              <p className="mt-3 text-sm leading-6 text-white/45">
                Complete the payment using the QR
                code above and enter your UTR /
                Transaction ID below. Your payment
                will be manually verified by the admin.
              </p>

            </div>

            <form
              onSubmit={
                submitPayment
              }
              className="mt-6"
            >

              <label className="text-xs font-bold text-white/50">
                UTR / Transaction ID
              </label>

              <input
                value={utr}
                onChange={(e) =>
                  setUtr(
                    e.target.value
                  )
                }
                placeholder="Enter UTR / Transaction ID"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30"
              />

              {error && (
                <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                  {error}
                </div>
              )}

              {message && (
                <div className="mt-4 rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-5 w-full rounded-full bg-white py-4 text-sm font-black text-black disabled:opacity-50"
              >
                {submitting
                  ? "Submitting..."
                  : `Submit Payment — ₹${selectedPlan.price}`}
              </button>

            </form>

          </div>
        </div>
      )}

      {/* PAYMENT WAITING */}

      {paymentSubmitted && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 p-5 backdrop-blur-xl">

          <div className="w-full max-w-md rounded-[35px] border border-white/10 bg-[#0b0b0b] p-8 text-center shadow-2xl">

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-green-400/20 bg-green-400/10 text-3xl text-green-300">
              ✓
            </div>

            <h2 className="mt-7 text-3xl font-black">
              Payment Submitted
            </h2>

            <p className="mt-4 text-sm leading-7 text-white/40">
              Your payment request has been
              submitted successfully.
            </p>

            <div className="mt-7 rounded-3xl border border-white/10 bg-white/[0.03] p-5">

              <div className="text-xs text-white/30">
                Status
              </div>

              <div className="mt-2 font-bold text-yellow-300">
                ⏳ Waiting for Admin Approval
              </div>

              <p className="mt-3 text-xs leading-6 text-white/30">
                This page automatically checks your
                payment status.
              </p>

            </div>

          </div>
        </div>
      )}

    </main>
  );
}