"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Subscription = {
  id: number;
  plan_id: number;
  status: string;
  expires_at: string;
};

type Plan = {
  id: number;
  name: string;
  price: number;
  duration_days: number;
  source: string | null;
};

const TELEGRAM_CHANNEL_URL =
  "https://t.me/+cbNYXxM7PhAxZDJl";

export default function HDLinkPremiumPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] =
    useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    initialize();

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function initialize() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !currentUser) {
        router.replace("/hdlink/auth/login");
        return;
      }

      setUser(currentUser);

      const activeSubscription =
        await loadSubscription(currentUser.id);

      if (!activeSubscription) {
        router.replace("/hdlink");
        return;
      }
    } catch (err) {
      console.error(
        "HDLink Premium initialization error:",
        err
      );

      setError(
        "Premium access could not be verified. Please refresh the page."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSubscription(userId: string) {
    const now = new Date().toISOString();

    try {
      const {
        data: subscriptionRows,
        error: subscriptionError,
      } = await supabase
        .from("subscriptions")
        .select(
          "id, plan_id, status, expires_at"
        )
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("expires_at", now)
        .order("expires_at", {
          ascending: false,
        });

      if (subscriptionError) {
        console.error(
          "HDLink subscription query error:",
          subscriptionError
        );

        setSubscription(null);
        setPlan(null);

        setError(
          "Your HDLink subscription could not be verified."
        );

        return null;
      }

      if (
        !subscriptionRows ||
        subscriptionRows.length === 0
      ) {
        setSubscription(null);
        setPlan(null);

        return null;
      }

      const planIds = subscriptionRows
        .map((item) => Number(item.plan_id))
        .filter((id) => Number.isFinite(id));

      if (planIds.length === 0) {
        setSubscription(null);
        setPlan(null);

        return null;
      }

      const {
        data: planRows,
        error: planError,
      } = await supabase
        .from("plans")
        .select(
          "id, name, price, duration_days, source"
        )
        .in("id", planIds)
        .eq("source", "hdlink")
        .eq("is_active", true);

      if (planError) {
        console.error(
          "HDLink plan verification error:",
          planError
        );

        setSubscription(null);
        setPlan(null);

        setError(
          "Your HDLink plan could not be verified."
        );

        return null;
      }

      if (!planRows || planRows.length === 0) {
        setSubscription(null);
        setPlan(null);

        return null;
      }

      const matchingSubscription =
        subscriptionRows.find((subscriptionItem) =>
          planRows.some(
            (planItem) =>
              Number(planItem.id) ===
              Number(subscriptionItem.plan_id)
          )
        );

      if (!matchingSubscription) {
        setSubscription(null);
        setPlan(null);

        return null;
      }

      const matchingPlan =
        planRows.find(
          (planItem) =>
            Number(planItem.id) ===
            Number(
              matchingSubscription.plan_id
            )
        );

      if (!matchingPlan) {
        setSubscription(null);
        setPlan(null);

        return null;
      }

      const subscriptionData: Subscription = {
        id: Number(matchingSubscription.id),
        plan_id: Number(
          matchingSubscription.plan_id
        ),
        status:
          matchingSubscription.status,
        expires_at:
          matchingSubscription.expires_at,
      };

      const planData: Plan = {
        id: Number(matchingPlan.id),
        name:
          matchingPlan.name ||
          "HDLink Premium",
        price: Number(
          matchingPlan.price || 0
        ),
        duration_days: Number(
          matchingPlan.duration_days || 0
        ),
        source: matchingPlan.source,
      };

      setSubscription(subscriptionData);
      setPlan(planData);

      return subscriptionData;
    } catch (err) {
      console.error(
        "HDLink subscription unexpected error:",
        err
      );

      setSubscription(null);
      setPlan(null);

      setError(
        "Premium subscription verification failed."
      );

      return null;
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error(
        "HDLink logout error:",
        err
      );
    }

    localStorage.removeItem(
      "hdlink_pending_plan_id"
    );

    localStorage.removeItem(
      "hdlink_pending_payment_id"
    );

    window.location.href = "/hdlink";
  }

  function formatExpiryDate(date: string) {
    return new Date(date).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  function getRemainingDays(date: string) {
    const expiry = new Date(date).getTime();
    const now = Date.now();

    const difference = expiry - now;

    if (difference <= 0) {
      return 0;
    }

    return Math.ceil(
      difference /
        (1000 * 60 * 60 * 24)
    );
  }

  const isPremium =
    !!subscription &&
    subscription.status === "active" &&
    new Date(
      subscription.expires_at
    ).getTime() > Date.now();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-5 text-white">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-black text-black">
            H
          </div>

          <div className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white" />

          <p className="mt-5 text-sm text-white/40">
            Checking HDLink Premium access...
          </p>
        </div>
      </main>
    );
  }

  if (!isPremium) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-5 text-white">
        <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-black text-black">
            H
          </div>

          <h1 className="mt-6 text-2xl font-black">
            Premium Access Required
          </h1>

          <p className="mt-3 text-sm leading-6 text-white/40">
            Your HDLink Premium subscription
            is not currently active.
          </p>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-left text-sm leading-6 text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={() =>
              router.push("/hdlink")
            }
            className="mt-7 w-full rounded-full bg-white px-6 py-4 text-sm font-black text-black transition hover:bg-white/85"
          >
            Get HDLink Premium →
          </button>

          <button
            onClick={() =>
              router.push(
                "/hdlink/auth/login"
              )
            }
            className="mt-3 w-full rounded-full border border-white/10 px-6 py-4 text-sm font-bold text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      {/* Background */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-300px] h-[700px] w-[900px] -translate-x-1/2 rounded-full bg-purple-500/[0.08] blur-[160px]" />

        <div className="absolute right-[-200px] top-[500px] h-[500px] w-[500px] rounded-full bg-blue-500/[0.05] blur-[140px]" />

        <div className="absolute bottom-[-250px] left-[-200px] h-[500px] w-[500px] rounded-full bg-pink-500/[0.04] blur-[140px]" />
      </div>

      {/* Navbar */}

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050505]/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 lg:px-8">
          <button
            onClick={() =>
              router.push("/hdlink")
            }
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg font-black text-black">
              H
            </div>

            <div className="text-left">
              <div className="text-lg font-black">
                HDLink
              </div>

              <div className="text-[9px] font-semibold uppercase tracking-[0.3em] text-white/30">
                Premium
              </div>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border border-green-400/20 bg-green-400/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-green-300 sm:block">
              ✓ Premium Active
            </div>

            <button
              onClick={handleLogout}
              className="rounded-full border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main */}

      <section className="relative z-10 px-5 pb-20 pt-16 sm:pt-24">
        <div className="mx-auto max-w-5xl">
          {/* Hero */}

          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-white text-3xl font-black text-black shadow-2xl">
              H
            </div>

            <div className="mx-auto mt-7 inline-flex items-center gap-2 rounded-full border border-green-400/20 bg-green-400/[0.06] px-5 py-2.5 text-xs font-bold text-green-300">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              Premium Access Active
            </div>

            <h1 className="mt-7 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
              Welcome to
              <br />
              <span className="text-white/40">
                HDLink Premium.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/45 sm:text-base">
              Your HDLink Premium access is
              active. Join the official HDLink
              Telegram community to receive
              updates and announcements.
            </p>
          </div>

          {/* Subscription Information */}

          <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                Access Status
              </div>

              <div className="mt-3 text-lg font-black text-green-300">
                Active
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                Plan
              </div>

              <div className="mt-3 text-lg font-black">
                {plan?.name ||
                  "HDLink Premium"}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                Expires
              </div>

              <div className="mt-3 text-lg font-black">
                {subscription
                  ? formatExpiryDate(
                      subscription.expires_at
                    )
                  : "-"}
              </div>
            </div>
          </div>

          {/* Telegram */}

          <div className="mx-auto mt-10 max-w-3xl">
            <div className="overflow-hidden rounded-[32px] border border-sky-400/20 bg-gradient-to-br from-sky-500/[0.14] via-white/[0.04] to-transparent p-7 shadow-2xl sm:p-10">
              <div className="text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-[#229ED9] text-3xl shadow-xl">
                  ✈️
                </div>

                <div className="mt-7 text-[10px] font-bold uppercase tracking-[0.25em] text-sky-300/70">
                  Premium Community
                </div>

                <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                  Join HDLink Telegram
                </h2>

                <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/40">
                  Join our official Telegram
                  community to receive HDLink
                  updates, announcements and
                  important information about
                  your Premium access.
                </p>

                <a
                  href={TELEGRAM_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#229ED9] px-8 py-4 text-sm font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-[#168dcc] hover:shadow-2xl active:scale-[0.98] sm:w-auto"
                >
                  ✈️ Join Telegram
                  <span className="text-lg">
                    →
                  </span>
                </a>

                <p className="mt-4 text-[11px] text-white/25">
                  Official HDLink Telegram
                  community
                </p>
              </div>
            </div>
          </div>

          {/* Rules */}

          <div className="mx-auto mt-8 max-w-3xl">
            <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-7 sm:p-9">
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">
                Telegram Rules
              </div>

              <h2 className="mt-3 text-2xl font-black">
                How Telegram access works
              </h2>

              <div className="mt-7 space-y-4">
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-black">
                    1
                  </div>

                  <div>
                    <h3 className="font-bold">
                      Active Premium required
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-white/40">
                      You can use HDLink Premium
                      while your subscription is
                      active.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-black">
                    2
                  </div>

                  <div>
                    <h3 className="font-bold">
                      Join using the official button
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-white/40">
                      Use the Join Telegram button
                      above to enter the official
                      HDLink community.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-black">
                    3
                  </div>

                  <div>
                    <h3 className="font-bold">
                      One Premium account
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-white/40">
                      Your Premium access is linked
                      to your HDLink account.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-black">
                    4
                  </div>

                  <div>
                    <h3 className="font-bold">
                      Expiry
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-white/40">
                      When your Premium subscription
                      expires, your HDLink Premium
                      access will become inactive.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-black">
                    5
                  </div>

                  <div>
                    <h3 className="font-bold">
                      Telegram membership
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-white/40">
                      Telegram removal after expiry
                      is handled by the HDLink
                      Telegram automation/bot system.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Expiry Card */}

          {subscription && (
            <div className="mx-auto mt-8 max-w-3xl rounded-[30px] border border-purple-400/20 bg-purple-500/[0.06] p-7 sm:p-9">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-purple-300/60">
                    Premium Valid Until
                  </div>

                  <div className="mt-2 text-2xl font-black">
                    {formatExpiryDate(
                      subscription.expires_at
                    )}
                  </div>

                  <p className="mt-2 text-sm text-white/40">
                    Your current Premium access
                    has approximately{" "}
                    <span className="font-bold text-white/70">
                      {getRemainingDays(
                        subscription.expires_at
                      )}{" "}
                      days
                    </span>{" "}
                    remaining.
                  </p>
                </div>

                <div className="w-fit rounded-full border border-green-400/20 bg-green-400/10 px-5 py-3 text-xs font-black text-green-300">
                  ✓ ACTIVE
                </div>
              </div>
            </div>
          )}

          {/* Account */}

          <div className="mx-auto mt-8 max-w-3xl rounded-[30px] border border-white/10 bg-white/[0.03] p-7 sm:p-9">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">
                  Account
                </div>

                <h2 className="mt-2 text-xl font-black">
                  HDLink Premium Account
                </h2>

                {user?.email && (
                  <p className="mt-2 text-sm text-white/35">
                    {user.email}
                  </p>
                )}
              </div>

              <button
                onClick={handleLogout}
                className="rounded-full border border-white/10 bg-white/[0.04] px-6 py-3.5 text-sm font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}

      <footer className="relative z-10 border-t border-white/10 px-5 py-10">
        <div className="mx-auto flex max-w-5xl flex-col justify-between gap-3 text-center sm:flex-row sm:text-left">
          <div>
            <div className="font-bold">
              HDLink
            </div>

            <div className="mt-1 text-xs text-white/25">
              Premium access
            </div>
          </div>

          <div className="text-xs text-white/25">
            Secure account • Premium access
          </div>
        </div>
      </footer>
    </main>
  );
}