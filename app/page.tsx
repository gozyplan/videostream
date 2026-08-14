"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Plan = {
  id: number;
  name: string;
  duration_days: number;
  price: number;
  description?: string | null;
  is_active: boolean;
};

type Video = {
  id: string;
  title: string;
  thumbnail_url: string;
  video_url: string;
  duration: number;
};

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState("");

  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);

  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [userLoggedIn, setUserLoggedIn] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [utr, setUtr] = useState("");

  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    loadPlans();
    loadVideos();
    checkUserAndSubscription();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkUserAndSubscription();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadPlans() {
    setLoadingPlans(true);
    setPlansError("");

    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("is_active", true)
      .order("duration_days", { ascending: true });

    if (error) {
      console.error("Plans error:", error);
      setPlansError(error.message);
      setLoadingPlans(false);
      return;
    }

    setPlans(data || []);
    setLoadingPlans(false);
  }

  async function loadVideos() {
    setLoadingVideos(true);

    try {
      const response = await fetch("/api/bunny-videos", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Videos load नहीं हुए");
      }

      setVideos((data.videos || []).slice(0, 8));
    } catch (error) {
      console.error("Videos error:", error);
    } finally {
      setLoadingVideos(false);
    }
  }

  async function checkUserAndSubscription() {
    setCheckingSubscription(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUserLoggedIn(false);
      setHasActiveSubscription(false);
      setCheckingSubscription(false);
      return;
    }

    setUserLoggedIn(true);

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, status, starts_at, expires_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("expires_at", now)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Subscription error:", error);
      setHasActiveSubscription(false);
      setCheckingSubscription(false);
      return;
    }

    setHasActiveSubscription(!!data);
    setCheckingSubscription(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();

    setUserLoggedIn(false);
    setHasActiveSubscription(false);

    window.location.reload();
  }

  function handleBuyPlan(plan: Plan) {
    if (!userLoggedIn) {
      window.location.href = "/auth/login";
      return;
    }

    setSelectedPlan(plan);
    setUtr("");
    setPaymentMessage("");
    setPaymentError("");
  }

  async function submitPaymentRequest() {
    setPaymentError("");
    setPaymentMessage("");

    if (!selectedPlan) {
      setPaymentError("Please select a plan.");
      return;
    }

    if (!utr.trim()) {
      setPaymentError("Please enter your UTR / Transaction ID.");
      return;
    }

    setSubmittingPayment(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setPaymentError("Please login before submitting your payment.");
      setSubmittingPayment(false);
      return;
    }

    const { error } = await supabase.from("payment_requests").insert({
      user_id: user.id,
      plan_id: selectedPlan.id,
      utr: utr.trim(),
      status: "pending",
    });

    if (error) {
      console.error("Payment request error:", error);
      setPaymentError(error.message);
      setSubmittingPayment(false);
      return;
    }

    setPaymentMessage(
      "Payment request submitted successfully. Your payment will be verified manually."
    );

    setUtr("");
    setSubmittingPayment(false);
  }

  function formatDuration(seconds: number) {
    if (!seconds || seconds <= 0) return "";

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#070707]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-black text-black">
              V
            </div>

            <div>
              <div className="text-lg font-bold tracking-tight">
                VideoStream
              </div>

              <div className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Premium
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#home"
              className="text-sm text-white/90 transition hover:text-white"
            >
              Home
            </a>

            <a
              href="#videos"
              className="text-sm text-white/60 transition hover:text-white"
            >
              Videos
            </a>

            <a
              href="#features"
              className="text-sm text-white/60 transition hover:text-white"
            >
              Features
            </a>

            <a
              href="#plans"
              className="text-sm text-white/60 transition hover:text-white"
            >
              Plans
            </a>

            <a
              href="#about"
              className="text-sm text-white/60 transition hover:text-white"
            >
              About
            </a>
          </div>

          <div className="flex items-center gap-3">
            {!checkingSubscription && userLoggedIn ? (
              <>
                {hasActiveSubscription && (
                  <a
                    href="/premium"
                    className="hidden rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2 text-xs font-semibold text-green-300 transition hover:bg-green-500/15 sm:block"
                  >
                    ✓ Premium Active
                  </a>
                )}

                <button
                  onClick={handleLogout}
                  className="hidden rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium transition hover:bg-white/10 sm:block"
                >
                  Logout
                </button>
              </>
            ) : (
              <a
                href="/auth/login"
                className="hidden rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium transition hover:bg-white/10 sm:block"
              >
                Login
              </a>
            )}

            <a
              href="#plans"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/85"
            >
              Get Started
            </a>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg border border-white/10 px-3 py-2 md:hidden"
            >
              ☰
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-white/10 bg-[#0b0b0b] px-5 py-5 md:hidden">
            <div className="flex flex-col gap-5 text-sm">
              <a href="#home" onClick={() => setMenuOpen(false)}>
                Home
              </a>

              <a href="#videos" onClick={() => setMenuOpen(false)}>
                Videos
              </a>

              <a href="#features" onClick={() => setMenuOpen(false)}>
                Features
              </a>

              <a href="#plans" onClick={() => setMenuOpen(false)}>
                Plans
              </a>

              <a href="#about" onClick={() => setMenuOpen(false)}>
                About
              </a>

              {userLoggedIn ? (
                <button
                  onClick={handleLogout}
                  className="text-left"
                >
                  Logout
                </button>
              ) : (
                <a href="/auth/login">Login</a>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section id="home" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.13),transparent_45%)]" />

        <div className="relative mx-auto max-w-7xl px-5 pb-24 pt-24 lg:px-8 lg:pb-32 lg:pt-32">
          <div className="max-w-4xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/70">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              Premium video streaming
            </div>

            <h1 className="text-5xl font-black leading-[0.95] tracking-[-0.04em] sm:text-6xl lg:text-8xl">
              Watch more.
              <br />
              <span className="text-white/35">
                Experience more.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-7 text-white/50 sm:text-lg">
              Discover premium videos, exclusive content and a
              smooth streaming experience — all in one place.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#videos"
                className="rounded-full bg-white px-7 py-4 text-center text-sm font-bold text-black transition hover:scale-[1.02]"
              >
                Explore Videos
              </a>

              <a
                href="#plans"
                className="rounded-full border border-white/15 bg-white/[0.03] px-7 py-4 text-center text-sm font-semibold transition hover:bg-white/10"
              >
                View Plans →
              </a>
            </div>

            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 text-sm text-white/40">
              <span>✓ No Ads</span>
              <span>✓ Full Watch</span>
              <span>✓ HD Streaming</span>
              <span>✓ Secure Access</span>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-white/10 md:grid-cols-4">
          <div className="px-5 py-8 text-center">
            <div className="text-2xl font-black">8+</div>
            <p className="mt-1 text-xs text-white/35">
              Featured Videos
            </p>
          </div>

          <div className="px-5 py-8 text-center">
            <div className="text-2xl font-black">HD</div>
            <p className="mt-1 text-xs text-white/35">
              Streaming Quality
            </p>
          </div>

          <div className="px-5 py-8 text-center">
            <div className="text-2xl font-black">24/7</div>
            <p className="mt-1 text-xs text-white/35">
              Access
            </p>
          </div>

          <div className="px-5 py-8 text-center">
            <div className="text-2xl font-black">0</div>
            <p className="mt-1 text-xs text-white/35">
              Ads
            </p>
          </div>
        </div>
      </section>

      {/* VIDEOS */}
      <section
        id="videos"
        className="mx-auto max-w-7xl px-5 py-20 lg:px-8"
      >
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
              Discover
            </p>

            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Featured Videos
            </h2>

            <p className="mt-3 text-sm text-white/40">
              Preview the library. Subscribe for full access.
            </p>
          </div>

          <div className="hidden rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/50 sm:block">
            Premium Library
          </div>
        </div>

        {loadingVideos ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              >
                <div className="aspect-video animate-pulse bg-white/10" />

                <div className="space-y-3 p-5">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/40">
            Videos अभी उपलब्ध नहीं हैं।
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {videos.map((video, index) => (
              <div
                key={video.id}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition duration-300 hover:-translate-y-1 hover:border-white/20"
              >
                {/* THUMBNAIL */}
                <div className="relative aspect-video overflow-hidden bg-black">
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className={`h-full w-full object-cover transition duration-500 ${
                      hasActiveSubscription
                        ? "group-hover:scale-105"
                        : "scale-105 blur-[5px] brightness-[0.55] group-hover:blur-[4px]"
                    }`}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />

                  <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
                    {index === 0 ? "Featured" : "Premium"}
                  </div>

                  {video.duration > 0 && (
                    <div className="absolute bottom-3 right-3 rounded-md bg-black/80 px-2 py-1 text-xs">
                      {formatDuration(video.duration)}
                    </div>
                  )}

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-2xl transition duration-300 group-hover:scale-110">
                      {hasActiveSubscription ? "▶" : "🔒"}
                    </div>
                  </div>

                  {!hasActiveSubscription && (
                    <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-[10px] font-semibold text-white/80 backdrop-blur">
                      Premium access required
                    </div>
                  )}
                </div>

                {/* DETAILS */}
                <div className="p-5">
                  <h3 className="line-clamp-1 font-bold">
                    {video.title}
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-white/40">
                    Premium video • Full access required
                  </p>

                  {hasActiveSubscription ? (
                    <a
                      href="/premium"
                      className="mt-5 block w-full rounded-full bg-white py-3 text-center text-sm font-bold text-black transition hover:bg-white/85"
                    >
                      Watch Now
                    </a>
                  ) : (
                    <a
                      href="#plans"
                      className="mt-5 block w-full rounded-full border border-white/15 bg-white/[0.04] py-3 text-center text-sm font-bold transition hover:bg-white/10"
                    >
                      Unlock Video
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* PREMIUM BANNER */}
      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-8 sm:p-12">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
              Premium Access
            </p>

            <h2 className="mt-3 text-3xl font-bold sm:text-5xl">
              Unlock the full experience.
            </h2>

            <p className="mt-4 max-w-2xl leading-7 text-white/50">
              Watch the complete premium library with an
              uninterrupted streaming experience.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/70">
                ✓ No Ads
              </span>

              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/70">
                ✓ Full Watch
              </span>

              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/70">
                ✓ HD Streaming
              </span>

              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/70">
                ✓ Premium Library
              </span>
            </div>

            <a
              href="#plans"
              className="mt-8 inline-block rounded-full bg-white px-6 py-3 text-sm font-bold text-black"
            >
              Choose Your Plan
            </a>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        id="features"
        className="mx-auto max-w-7xl px-5 py-24 lg:px-8"
      >
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
            Premium Features
          </p>

          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Everything you need.
          </h2>

          <p className="mt-4 text-white/45">
            A clean and premium streaming experience designed for
            uninterrupted viewing.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: "🚫",
              title: "No Ads",
              text: "Enjoy your premium content without distracting advertisements.",
            },
            {
              icon: "▶",
              title: "Full Watch",
              text: "Premium members get complete access to available videos.",
            },
            {
              icon: "⚡",
              title: "Fast Streaming",
              text: "Smooth playback powered by a global video delivery network.",
            },
            {
              icon: "HD",
              title: "HD Quality",
              text: "Enjoy supported videos in high-quality streaming.",
            },
            {
              icon: "🔒",
              title: "Secure Access",
              text: "Your premium access is connected to your account.",
            },
            {
              icon: "♾",
              title: "Large Library",
              text: "Access the growing premium video collection.",
            },
            {
              icon: "📱",
              title: "Mobile Friendly",
              text: "Enjoy a responsive experience on phones, tablets and desktop.",
            },
            {
              icon: "✨",
              title: "Exclusive Content",
              text: "Premium-only content available to active subscribers.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20 hover:bg-white/[0.05]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-sm font-bold">
                {feature.icon}
              </div>

              <h3 className="mt-5 font-bold">
                {feature.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/40">
                {feature.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* PLANS */}
      <section
        id="plans"
        className="border-t border-white/10 bg-white/[0.015]"
      >
        <div className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
              Simple Pricing
            </p>

            <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Choose your access
            </h2>

            <p className="mt-4 text-white/45">
              Pick the duration that works best for you.
            </p>
          </div>

          {loadingPlans && (
            <div className="py-12 text-center text-white/50">
              Loading plans...
            </div>
          )}

          {!loadingPlans && plansError && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center">
              <p className="font-semibold text-red-300">
                Plans load नहीं हो पाए।
              </p>

              <p className="mt-2 text-sm text-red-200/60">
                {plansError}
              </p>
            </div>
          )}

          {!loadingPlans &&
            !plansError &&
            plans.length === 0 && (
              <div className="py-12 text-center text-white/50">
                अभी कोई active plan उपलब्ध नहीं है।
              </div>
            )}

          {!loadingPlans &&
            !plansError &&
            plans.length > 0 && (
              <div className="grid gap-5 md:grid-cols-3">
                {plans.slice(0, 3).map((plan, index) => (
                  <div
                    key={plan.id}
                    className={`relative rounded-3xl border p-7 ${
                      index === 1
                        ? "border-white/40 bg-white/[0.08] shadow-2xl"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    {index === 1 && (
                      <div className="absolute right-5 top-5 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black">
                        Most Popular
                      </div>
                    )}

                    <p className="text-sm text-white/50">
                      {plan.name}
                    </p>

                    <div className="mt-5 flex items-end gap-2">
                      <span className="text-5xl font-black">
                        ₹{Number(plan.price).toFixed(0)}
                      </span>
                    </div>

                    <p className="mt-4 min-h-12 text-sm leading-6 text-white/45">
                      Premium access for {plan.duration_days} days.
                    </p>

                    <button
                      onClick={() => handleBuyPlan(plan)}
                      className="mt-7 w-full rounded-full bg-white py-3.5 text-sm font-bold text-black transition hover:bg-white/85"
                    >
                      {hasActiveSubscription
                        ? "Choose Plan"
                        : "Buy Plan"}
                    </button>

                    <div className="mt-6 space-y-3 border-t border-white/10 pt-6 text-sm text-white/60">
                      <p>✓ No Ads</p>
                      <p>✓ Full Watch</p>
                      <p>✓ HD Streaming</p>
                      <p>✓ Secure Premium Access</p>
                      <p>✓ Active for {plan.duration_days} days</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </section>

      {/* PAYMENT MODAL */}
      {selectedPlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-[#111111] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                  Payment
                </p>

                <h3 className="mt-1 text-2xl font-bold">
                  {selectedPlan.name}
                </h3>
              </div>

              <button
                onClick={() => setSelectedPlan(null)}
                className="rounded-full border border-white/10 px-3 py-2 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <p className="text-sm text-white/50">
                Amount to pay
              </p>

              <p className="mt-1 text-4xl font-black">
                ₹{Number(selectedPlan.price).toFixed(0)}
              </p>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm font-semibold">
                Scan the payment QR to pay
              </p>

              <div className="mx-auto mt-4 flex w-fit items-center justify-center rounded-2xl bg-white p-4">
                <img
                  src="/navi-qr.png"
                  alt="Payment QR"
                  className="h-56 w-56 object-contain"
                />
              </div>

              <p className="mt-3 text-xs leading-5 text-white/40">
                Pay exactly ₹
                {Number(selectedPlan.price).toFixed(0)} and keep
                your transaction ID / UTR.
              </p>
            </div>

            <div className="mt-6">
              <label className="text-sm font-semibold">
                UTR / Transaction ID
              </label>

              <input
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                placeholder="Enter your UTR / Transaction ID"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/30"
              />
            </div>

            {paymentError && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {paymentError}
              </div>
            )}

            {paymentMessage && (
              <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">
                {paymentMessage}
              </div>
            )}

            <button
              onClick={submitPaymentRequest}
              disabled={submittingPayment}
              className="mt-5 w-full rounded-full bg-white py-3.5 text-sm font-bold text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submittingPayment
                ? "Submitting..."
                : "I Have Paid — Submit Request"}
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-white/30">
              Your plan will be activated after payment
              verification.
            </p>
          </div>
        </div>
      )}

      {/* ABOUT */}
      <section id="about" className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white font-black text-black">
                V
              </div>

              <h3 className="font-bold">
                VideoStream
              </h3>

              <p className="mt-3 text-sm leading-6 text-white/40">
                A modern premium video streaming platform built
                for a clean and smooth viewing experience.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                Platform
              </h3>

              <div className="mt-4 space-y-3 text-sm text-white/40">
                <p>No Ads</p>
                <p>Full Watch</p>
                <p>HD Streaming</p>
                <p>Premium Videos</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold">
                Support
              </h3>

              <div className="mt-4 space-y-3 text-sm text-white/40">
                <p>Help Center</p>
                <p>Contact Us</p>
                <p>Terms & Privacy</p>
              </div>
            </div>
          </div>

          <div className="mt-16 border-t border-white/10 pt-7 text-xs text-white/30">
            © 2026 VideoStream. All rights reserved.
          </div>
        </div>
      </section>
    </main>
  );
}