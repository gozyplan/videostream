"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Plan = {
  id: number;
  name: string;
  duration_days: number;
  price: number;
  description: string | null;
};

type Video = {
  id: string | number;
  title: string;
  thumbnail_url: string;
  video_url?: string;
  duration?: string | number;
};

type Subscription = {
  id: number;
  plan_id: number;
  status: string;
  expires_at: string;
};

export default function HDLinkPage() {
  const router = useRouter();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);

  const [selectedPlan, setSelectedPlan] =
    useState<Plan | null>(null);

  const [user, setUser] = useState<any>(null);

  const [subscription, setSubscription] =
    useState<Subscription | null>(null);

  const [utr, setUtr] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  const [paymentSubmitted, setPaymentSubmitted] =
    useState(false);

  const [checkingApproval, setCheckingApproval] =
    useState(false);

  const [error, setError] = useState("");

  const [urlPlanId, setUrlPlanId] =
    useState<string | null>(null);

  const [urlPlanHandled, setUrlPlanHandled] =
    useState(false);

  /* =========================================================
     INITIAL
  ========================================================= */

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    setUrlPlanId(params.get("plan"));
  }, []);

  useEffect(() => {
    loadEverything();
  }, []);

  async function loadEverything() {
    setLoading(true);

    await Promise.all([
      loadPlans(),
      loadVideos(),
      checkUser(),
    ]);

    setLoading(false);
  }

  /* =========================================================
     PLANS
  ========================================================= */

  async function loadPlans() {
    setLoadingPlans(true);

    const { data, error } = await supabase
      .from("plans")
      .select(
        "id,name,duration_days,price,description"
      )
      .eq("source", "hdlink")
      .eq("is_active", true)
      .order("duration_days", {
        ascending: true,
      });

    if (error) {
      console.error(
        "HDLink plans error:",
        error
      );

      setError(
        "Plans could not be loaded."
      );

      setLoadingPlans(false);
      return;
    }

    setPlans(data || []);
    setLoadingPlans(false);
  }

  /* =========================================================
     VIDEOS
  ========================================================= */

  async function loadVideos() {
    setLoadingVideos(true);

    try {
      const response = await fetch(
        "/api/bunny-videos",
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Videos could not be loaded."
        );
      }

      const data = await response.json();

      let loadedVideos: Video[] = [];

      if (Array.isArray(data)) {
        loadedVideos = data;
      } else if (
        Array.isArray(data?.videos)
      ) {
        loadedVideos = data.videos;
      } else if (
        Array.isArray(data?.items)
      ) {
        loadedVideos = data.items;
      }

      setVideos(
        loadedVideos.slice(0, 8)
      );
    } catch (err) {
      console.error(
        "HDLink video error:",
        err
      );

      setVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  }

  /* =========================================================
     USER
  ========================================================= */

  async function checkUser() {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    setUser(currentUser);

    if (currentUser) {
      await loadSubscription(
        currentUser.id
      );
    }
  }

  /* =========================================================
     AUTH STATE
  ========================================================= */

  useEffect(() => {
    const {
      data: { subscription: authListener },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser =
          session?.user ?? null;

        setUser(currentUser);

        if (currentUser) {
          await loadSubscription(
            currentUser.id
          );
        } else {
          setSubscription(null);
        }
      }
    );

    return () => {
      authListener.unsubscribe();
    };
  }, []);

  /* =========================================================
     SUBSCRIPTION
  ========================================================= */

  async function loadSubscription(
    userId: string
  ) {
    const now =
      new Date().toISOString();

    const { data, error } =
      await supabase
        .from("subscriptions")
        .select(
          "id,plan_id,status,expires_at"
        )
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("expires_at", now)
        .order("expires_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (error) {
      console.error(
        "HDLink subscription error:",
        error
      );

      setSubscription(null);
      return null;
    }

    setSubscription(data);
    return data;
  }

  const hasPremium =
    !!subscription &&
    subscription.status === "active" &&
    new Date(
      subscription.expires_at
    ).getTime() > Date.now();

  /* =========================================================
     URL PLAN HANDLER
  ========================================================= */

  useEffect(() => {
    if (
      !urlPlanId ||
      plans.length === 0 ||
      urlPlanHandled
    ) {
      return;
    }

    const planId = Number(urlPlanId);

    if (!Number.isFinite(planId)) {
      setError(
        "Invalid selected plan."
      );

      setUrlPlanHandled(true);
      return;
    }

    const matchedPlan = plans.find(
      (plan) => plan.id === planId
    );

    if (!matchedPlan) {
      setError(
        "The selected plan is no longer available."
      );

      setUrlPlanHandled(true);
      return;
    }

    if (hasPremium) {
      localStorage.removeItem(
        "hdlink_pending_plan_id"
      );

      setUrlPlanHandled(true);

      router.replace(
        "/hdlink/premium"
      );

      return;
    }

    localStorage.setItem(
      "hdlink_pending_plan_id",
      String(matchedPlan.id)
    );

    if (!user) {
      setUrlPlanHandled(true);

      window.location.href =
        `/hdlink/auth/register?plan=${encodeURIComponent(
          String(matchedPlan.id)
        )}`;

      return;
    }

    setSelectedPlan(matchedPlan);
    setError("");
    setUrlPlanHandled(true);
  }, [
    urlPlanId,
    plans,
    user,
    hasPremium,
    urlPlanHandled,
    router,
  ]);

  /* =========================================================
     RESTORE PLAN
  ========================================================= */

  useEffect(() => {
    if (
      urlPlanId ||
      plans.length === 0 ||
      selectedPlan ||
      urlPlanHandled
    ) {
      return;
    }

    const savedPlanId =
      localStorage.getItem(
        "hdlink_pending_plan_id"
      );

    if (!savedPlanId) {
      return;
    }

    const planId = Number(savedPlanId);

    if (!Number.isFinite(planId)) {
      localStorage.removeItem(
        "hdlink_pending_plan_id"
      );

      return;
    }

    const savedPlan = plans.find(
      (plan) => plan.id === planId
    );

    if (!savedPlan) {
      localStorage.removeItem(
        "hdlink_pending_plan_id"
      );

      return;
    }

    if (hasPremium) {
      localStorage.removeItem(
        "hdlink_pending_plan_id"
      );

      return;
    }

    if (!user) {
      window.location.href =
        `/hdlink/auth/register?plan=${encodeURIComponent(
          String(savedPlan.id)
        )}`;

      return;
    }

    setSelectedPlan(savedPlan);
  }, [
    plans,
    urlPlanId,
    selectedPlan,
    user,
    hasPremium,
    urlPlanHandled,
  ]);

  /* =========================================================
     SELECT PLAN
  ========================================================= */

  function selectPlan(plan: Plan) {
    setError("");
    setUtr("");
    setPaymentSubmitted(false);

    localStorage.setItem(
      "hdlink_pending_plan_id",
      String(plan.id)
    );

    if (!user) {
      goToRegister(plan);
      return;
    }

    setSelectedPlan(plan);
  }

  /* =========================================================
     LOGIN
  ========================================================= */

  function goToLogin(
    plan?: Plan | null
  ) {
    const targetPlan =
      plan || selectedPlan;

    if (targetPlan) {
      localStorage.setItem(
        "hdlink_pending_plan_id",
        String(targetPlan.id)
      );

      window.location.href =
        `/hdlink/auth/login?plan=${encodeURIComponent(
          String(targetPlan.id)
        )}`;

      return;
    }

    window.location.href =
      "/hdlink/auth/login";
  }

  /* =========================================================
     REGISTER
  ========================================================= */

  function goToRegister(
    plan?: Plan | null
  ) {
    const targetPlan =
      plan || selectedPlan;

    if (targetPlan) {
      localStorage.setItem(
        "hdlink_pending_plan_id",
        String(targetPlan.id)
      );

      window.location.href =
        `/hdlink/auth/register?plan=${encodeURIComponent(
          String(targetPlan.id)
        )}`;

      return;
    }

    window.location.href =
      "/hdlink/auth/register";
  }

  /* =========================================================
     CLOSE PAYMENT
  ========================================================= */

  function closePayment() {
    if (submitting) {
      return;
    }

    setSelectedPlan(null);
    setUtr("");
    setError("");
    setPaymentSubmitted(false);

    localStorage.removeItem(
      "hdlink_pending_plan_id"
    );

    if (urlPlanId) {
      router.replace("/hdlink");
    }
  }

  /* =========================================================
     VIDEO
  ========================================================= */

  function handleVideoClick(
    video: Video
  ) {
    if (hasPremium) {
      if (video.video_url) {
        window.open(
          video.video_url,
          "_blank",
          "noopener,noreferrer"
        );
      } else {
        router.push(
          "/hdlink/premium"
        );
      }

      return;
    }

    const popularPlan =
      plans.find(
        (plan) =>
          plan.duration_days === 15
      ) || plans[0];

    if (popularPlan) {
      selectPlan(popularPlan);
    }
  }

  /* =========================================================
     PAYMENT
  ========================================================= */

  async function handlePaymentSubmit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError("");

    const plan = selectedPlan;

    if (!plan) {
      setError(
        "Please select a plan."
      );
      return;
    }

    const paymentPlan: Plan = plan;

    if (!user) {
      goToRegister(paymentPlan);
      return;
    }

    const transactionId =
      utr.trim();

    if (!transactionId) {
      setError(
        "Please enter your UTR / Transaction ID."
      );
      return;
    }

    if (transactionId.length < 6) {
      setError(
        "Please enter a valid UTR / Transaction ID."
      );
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: existingPayment,
        error: duplicateError,
      } = await supabase
        .from("payment_requests")
        .select("id,status")
        .eq("utr", transactionId)
        .maybeSingle();

      if (duplicateError) {
        console.error(
          "Duplicate UTR error:",
          duplicateError
        );

        setError(
          "Could not verify the transaction ID. Please try again."
        );

        return;
      }

      if (existingPayment) {
        setError(
          "This UTR / Transaction ID has already been submitted."
        );

        return;
      }

      const {
        data: insertedPayment,
        error: insertError,
      } = await supabase
        .from("payment_requests")
        .insert({
          user_id: user.id,
          plan_id: paymentPlan.id,
          utr: transactionId,
          status: "pending",
          source: "hdlink",
        })
        .select(
          "id,user_id,plan_id,utr,status,source"
        )
        .single();

      if (insertError) {
        console.error(
          "HDLink payment insert error:",
          insertError
        );

        setError(
          insertError.message ||
            "Payment request could not be submitted."
        );

        return;
      }

      if (insertedPayment) {
        localStorage.setItem(
          "hdlink_pending_payment_id",
          String(
            insertedPayment.id
          )
        );
      }

      localStorage.setItem(
        "hdlink_pending_plan_id",
        String(paymentPlan.id)
      );

      setPaymentSubmitted(true);
      setCheckingApproval(true);
    } catch (err) {
      console.error(
        "HDLink payment error:",
        err
      );

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* =========================================================
     PAYMENT POLLING
  ========================================================= */

  useEffect(() => {
    if (
      !paymentSubmitted ||
      !user ||
      !selectedPlan
    ) {
      return;
    }

    /*
     * IMPORTANT:
     * Capture selectedPlan into a non-null variable.
     * This fixes TypeScript TS18047.
     */
    const paymentPlan: Plan =
      selectedPlan;

    const currentUser = user;

    let stopped = false;

    async function checkPaymentStatus() {
      try {
        const pendingId =
          localStorage.getItem(
            "hdlink_pending_payment_id"
          );

        let paymentQuery;

        if (pendingId) {
          paymentQuery =
            supabase
              .from(
                "payment_requests"
              )
              .select(
                "id,user_id,plan_id,utr,status,source"
              )
              .eq(
                "id",
                Number(pendingId)
              )
              .eq(
                "user_id",
                currentUser.id
              )
              .maybeSingle();
        } else {
          paymentQuery =
            supabase
              .from(
                "payment_requests"
              )
              .select(
                "id,user_id,plan_id,utr,status,source"
              )
              .eq(
                "user_id",
                currentUser.id
              )
              .eq(
                "plan_id",
                paymentPlan.id
              )
              .eq(
                "source",
                "hdlink"
              )
              .order("id", {
                ascending: false,
              })
              .limit(1)
              .maybeSingle();
        }

        const {
          data: payment,
          error: paymentError,
        } = await paymentQuery;

        if (paymentError) {
          console.error(
            "Payment status error:",
            paymentError
          );
          return;
        }

        if (!payment || stopped) {
          return;
        }

        if (
          payment.status ===
            "approved" ||
          payment.status ===
            "active"
        ) {
          const activeSubscription =
            await loadSubscription(
              currentUser.id
            );

          if (
            activeSubscription &&
            new Date(
              activeSubscription.expires_at
            ).getTime() >
              Date.now()
          ) {
            stopped = true;

            localStorage.removeItem(
              "hdlink_pending_plan_id"
            );

            localStorage.removeItem(
              "hdlink_pending_payment_id"
            );

            setCheckingApproval(false);

            router.replace(
              "/hdlink/premium"
            );

            return;
          }
        }

        if (
          payment.status ===
            "rejected" ||
          payment.status ===
            "failed"
        ) {
          stopped = true;

          setCheckingApproval(false);
          setPaymentSubmitted(false);

          localStorage.removeItem(
            "hdlink_pending_payment_id"
          );

          setError(
            "Your payment request was rejected. Please submit a new payment request."
          );
        }
      } catch (err) {
        console.error(
          "Approval checking error:",
          err
        );
      }
    }

    checkPaymentStatus();

    const interval =
      window.setInterval(
        checkPaymentStatus,
        4000
      );

    return () => {
      stopped = true;

      window.clearInterval(
        interval
      );
    };
  }, [
    paymentSubmitted,
    user,
    selectedPlan,
    router,
  ]);

  /* =========================================================
     FEATURES
  ========================================================= */

  const features = useMemo(
    () => [
      {
        icon: "⚡",
        title: "Quick activation",
        text: "Submit your payment UTR and wait for manual verification.",
      },
      {
        icon: "🔐",
        title: "Account protected",
        text: "Your premium access is connected directly to your account.",
      },
      {
        icon: "🎬",
        title: "Premium library",
        text: "Unlock premium video content after approval.",
      },
      {
        icon: "📱",
        title: "Mobile friendly",
        text: "HDLink is designed to work smoothly on phones and desktops.",
      },
      {
        icon: "✓",
        title: "Manual verification",
        text: "Every payment request is checked before premium access.",
      },
      {
        icon: "🚀",
        title: "Automatic detection",
        text: "Your account is checked automatically after payment approval.",
      },
    ],
    []
  );

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070707] text-white">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-black text-black shadow-2xl">
            H
          </div>

          <div className="mx-auto mt-6 h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-white" />

          <p className="mt-4 text-sm text-white/40">
            Loading HDLink...
          </p>
        </div>
      </main>
    );
  }

  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#070707] text-white">

      {/* BACKGROUND */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-300px] h-[700px] w-[1000px] -translate-x-1/2 rounded-full bg-violet-600/[0.10] blur-[160px]" />

        <div className="absolute right-[-250px] top-[400px] h-[600px] w-[600px] rounded-full bg-blue-600/[0.06] blur-[150px]" />

        <div className="absolute bottom-[-300px] left-[-250px] h-[600px] w-[600px] rounded-full bg-fuchsia-600/[0.05] blur-[150px]" />
      </div>

      {/* NAVBAR */}

      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#070707]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

          <button
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              })
            }
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-black text-black">
              H
            </div>

            <div className="text-left">
              <div className="text-base font-black tracking-tight">
                HDLink
              </div>

              <div className="text-[8px] font-bold uppercase tracking-[0.3em] text-white/30">
                Premium Access
              </div>
            </div>
          </button>

          <nav className="hidden items-center gap-7 md:flex">
            <button
              onClick={() =>
                document
                  .getElementById("plans")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
              className="text-sm text-white/45 transition hover:text-white"
            >
              Plans
            </button>

            <button
              onClick={() =>
                document
                  .getElementById("videos")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
              className="text-sm text-white/45 transition hover:text-white"
            >
              Videos
            </button>

            <button
              onClick={() =>
                document
                  .getElementById("features")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
              className="text-sm text-white/45 transition hover:text-white"
            >
              Features
            </button>
          </nav>

          <div className="flex items-center gap-2">
            {hasPremium ? (
              <button
                onClick={() =>
                  router.push(
                    "/hdlink/premium"
                  )
                }
                className="rounded-full bg-white px-4 py-2.5 text-xs font-black text-black transition hover:bg-white/90 sm:px-5"
              >
                Premium →
              </button>
            ) : user ? (
              <button
                onClick={() =>
                  document
                    .getElementById("plans")
                    ?.scrollIntoView({
                      behavior: "smooth",
                    })
                }
                className="rounded-full bg-white px-4 py-2.5 text-xs font-black text-black transition hover:bg-white/90 sm:px-5"
              >
                Get Access
              </button>
            ) : (
              <>
                <button
                  onClick={() =>
                    goToLogin()
                  }
                  className="hidden rounded-full border border-white/10 px-4 py-2.5 text-xs font-bold text-white/60 transition hover:bg-white/5 hover:text-white sm:block"
                >
                  Login
                </button>

                <button
                  onClick={() =>
                    document
                      .getElementById("plans")
                      ?.scrollIntoView({
                        behavior: "smooth",
                      })
                  }
                  className="rounded-full bg-white px-4 py-2.5 text-xs font-black text-black transition hover:bg-white/90 sm:px-5"
                >
                  Get Access
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}

      <section className="relative z-10 px-4 pb-10 pt-14 sm:px-6 sm:pb-14 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-7xl">

          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">

            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-bold text-white/60">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.7)]" />
                HDLink is live
              </div>

              <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                Premium access.
                <br />
                <span className="text-white/35">
                  Simple &amp; fast.
                </span>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-7 text-white/45 sm:text-lg">
                Choose a plan, complete your
                payment and unlock the HDLink
                premium library after approval.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    document
                      .getElementById("plans")
                      ?.scrollIntoView({
                        behavior: "smooth",
                      })
                  }
                  className="rounded-full bg-white px-7 py-4 text-sm font-black text-black shadow-2xl transition hover:scale-[1.02]"
                >
                  View Plans →
                </button>

                <button
                  onClick={() =>
                    document
                      .getElementById("videos")
                      ?.scrollIntoView({
                        behavior: "smooth",
                      })
                  }
                  className="rounded-full border border-white/10 bg-white/[0.04] px-7 py-4 text-sm font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Explore Videos
                </button>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/30">
                <span>✓ Secure payment</span>
                <span>✓ Manual verification</span>
                <span>✓ Account based access</span>
              </div>
            </div>

            {/* HERO PREVIEW */}

            <div className="relative">
              <div className="absolute -inset-5 rounded-[40px] bg-violet-500/[0.06] blur-3xl" />

              <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04] p-2 shadow-2xl">
                <div className="relative aspect-[16/10] overflow-hidden rounded-[24px] bg-[#111]">

                  {videos[0]?.thumbnail_url ? (
                    <img
                      src={
                        videos[0]
                          .thumbnail_url
                      }
                      alt="HDLink Premium"
                      className="h-full w-full scale-110 object-cover blur-[6px] opacity-60"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-violet-500/20 via-black to-blue-500/10" />
                  )}

                  <div className="absolute inset-0 bg-black/60" />

                  <div className="absolute left-5 top-5 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/60 backdrop-blur-xl">
                    HDLink Premium
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-2xl backdrop-blur-xl">
                      🔒
                    </div>
                  </div>

                  <div className="absolute bottom-5 left-5 right-5">
                    <div className="rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl">
                      <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/30">
                        Premium Library
                      </div>

                      <div className="mt-2 text-lg font-black">
                        {hasPremium
                          ? "Premium access active"
                          : "Unlock premium videos"}
                      </div>

                      <div className="mt-1 text-xs text-white/35">
                        {hasPremium
                          ? "Your account is ready."
                          : "Choose a plan below to continue."}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* PLANS */}

      <section
        id="plans"
        className="relative z-10 px-4 py-14 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">

          <div className="text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
              Simple pricing
            </div>

            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              Choose your plan
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/40">
              No complicated packages. Pick the
              duration that works for you and get
              premium HDLink access.
            </p>
          </div>

          {error && !selectedPlan && (
            <div className="mx-auto mt-7 max-w-xl rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-center text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="mt-10 grid gap-5 md:grid-cols-3">

            {loadingPlans ? (
              Array.from({
                length: 3,
              }).map((_, index) => (
                <div
                  key={index}
                  className="h-[330px] animate-pulse rounded-[28px] border border-white/10 bg-white/[0.03]"
                />
              ))
            ) : plans.length > 0 ? (
              plans.map((plan) => {
                const popular =
                  plan.duration_days === 15;

                const oneDay =
                  plan.duration_days === 1;

                const thirtyDay =
                  plan.duration_days === 30;

                return (
                  <div
                    key={plan.id}
                    className={`relative overflow-hidden rounded-[28px] border p-7 transition duration-300 hover:-translate-y-1 ${
                      popular
                        ? "border-white/30 bg-white/[0.09] shadow-2xl shadow-white/[0.04]"
                        : "border-white/10 bg-white/[0.035] hover:border-white/20"
                    }`}
                  >

                    {popular && (
                      <div className="absolute right-5 top-5 rounded-full bg-white px-3 py-1.5 text-[9px] font-black text-black">
                        ⭐ MOST POPULAR
                      </div>
                    )}

                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                      {oneDay
                        ? "Quick Access"
                        : thirtyDay
                        ? "Best Value"
                        : "Popular Choice"}
                    </div>

                    <div className="mt-7 flex items-end gap-2">
                      <span className="text-5xl font-black tracking-tight">
                        ₹{plan.price}
                      </span>

                      <span className="mb-2 text-xs text-white/30">
                        / plan
                      </span>
                    </div>

                    <div className="mt-3 text-lg font-bold">
                      {plan.name}
                    </div>

                    <div className="mt-1 text-xs text-white/35">
                      {plan.duration_days} day
                      {plan.duration_days !== 1
                        ? "s"
                        : ""}{" "}
                      premium access
                    </div>

                    <div className="my-6 h-px bg-white/10" />

                    <div className="space-y-3 text-xs text-white/50">

                      <div className="flex gap-2">
                        <span className="text-emerald-400">
                          ✓
                        </span>
                        Premium video access
                      </div>

                      <div className="flex gap-2">
                        <span className="text-emerald-400">
                          ✓
                        </span>
                        Account based access
                      </div>

                      <div className="flex gap-2">
                        <span className="text-emerald-400">
                          ✓
                        </span>
                        Manual payment verification
                      </div>

                    </div>

                    <button
                      onClick={() =>
                        selectPlan(plan)
                      }
                      className={`mt-7 w-full rounded-full px-5 py-4 text-sm font-black transition ${
                        popular
                          ? "bg-white text-black hover:bg-white/90"
                          : "border border-white/10 bg-white/[0.07] text-white hover:bg-white/[0.12]"
                      }`}
                    >
                      Get {plan.name} →
                    </button>

                    {plan.description && (
                      <p className="mt-4 text-center text-[10px] leading-5 text-white/25">
                        {plan.description}
                      </p>
                    )}

                  </div>
                );
              })
            ) : (
              <>
                {[
                  {
                    name: "1 Day",
                    price: 30,
                    days: 1,
                  },
                  {
                    name: "15 Days",
                    price: 90,
                    days: 15,
                  },
                  {
                    name: "30 Days",
                    price: 120,
                    days: 30,
                  },
                ].map(
                  (fallback, index) => (
                    <div
                      key={fallback.days}
                      className={`rounded-[28px] border p-7 ${
                        index === 1
                          ? "border-white/30 bg-white/[0.09]"
                          : "border-white/10 bg-white/[0.035]"
                      }`}
                    >

                      <div className="text-xs font-bold text-white/35">
                        {index === 1
                          ? "⭐ MOST POPULAR"
                          : "HDLink ACCESS"}
                      </div>

                      <div className="mt-7 text-5xl font-black">
                        ₹{fallback.price}
                      </div>

                      <div className="mt-3 text-lg font-bold">
                        {fallback.name}
                      </div>

                      <div className="mt-1 text-xs text-white/35">
                        Premium access
                      </div>

                      <button
                        className="mt-8 w-full rounded-full bg-white px-5 py-4 text-sm font-black text-black"
                        onClick={() =>
                          setError(
                            "Plans are currently loading. Please refresh the page."
                          )
                        }
                      >
                        Get Access →
                      </button>

                    </div>
                  )
                )}
              </>
            )}

          </div>

          <div className="mx-auto mt-7 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-center text-xs text-white/30">
            🔐 Payment is manually verified.
            Your premium access activates after
            admin approval.
          </div>

        </div>
      </section>

      {/* HOW IT WORKS */}

      <section className="relative z-10 border-y border-white/[0.07] bg-white/[0.015] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">

          <div className="text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
              Easy process
            </div>

            <h2 className="mt-3 text-3xl font-black">
              Get premium in 3 steps
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">

            {[
              {
                number: "01",
                title: "Choose a plan",
                text: "Select 1 Day, 15 Days or 30 Days from the plans above.",
              },
              {
                number: "02",
                title: "Make payment",
                text: "Scan the QR code and submit your UTR / Transaction ID.",
              },
              {
                number: "03",
                title: "Get approved",
                text: "After admin approval, your premium access activates automatically.",
              },
            ].map((step) => (
              <div
                key={step.number}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="text-xs font-black text-white/25">
                  {step.number}
                </div>

                <h3 className="mt-5 text-base font-bold">
                  {step.title}
                </h3>

                <p className="mt-2 text-xs leading-6 text-white/35">
                  {step.text}
                </p>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* VIDEOS */}

      <section
        id="videos"
        className="relative z-10 px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                Premium library
              </div>

              <h2 className="mt-3 text-3xl font-black sm:text-4xl">
                Explore the library
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-white/40">
                Preview the HDLink library before
                unlocking your premium access.
              </p>
            </div>

            <button
              onClick={() => {
                if (hasPremium) {
                  router.push(
                    "/hdlink/premium"
                  );
                } else {
                  document
                    .getElementById("plans")
                    ?.scrollIntoView({
                      behavior: "smooth",
                    });
                }
              }}
              className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-black text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            >
              {hasPremium
                ? "Open Premium →"
                : "Unlock Library →"}
            </button>

          </div>

          <div className="mt-9">

            {loadingVideos ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({
                  length: 8,
                }).map((_, index) => (
                  <div
                    key={index}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                  >
                    <div className="aspect-video animate-pulse bg-white/10" />

                    <div className="space-y-2 p-4">
                      <div className="h-4 animate-pulse rounded bg-white/10" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : videos.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">

                <div className="text-4xl">
                  🎬
                </div>

                <h3 className="mt-4 text-xl font-bold">
                  Premium library
                </h3>

                <p className="mt-2 text-sm text-white/35">
                  Video previews are
                  currently unavailable.
                </p>

              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                {videos.map(
                  (video, index) => (
                    <button
                      key={String(
                        video.id
                      )}
                      onClick={() =>
                        handleVideoClick(
                          video
                        )
                      }
                      className="group text-left"
                    >

                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition duration-300 group-hover:-translate-y-1 group-hover:border-white/20">

                        <div className="relative aspect-video overflow-hidden bg-[#111]">

                          {video.thumbnail_url ? (
                            <img
                              src={
                                video.thumbnail_url
                              }
                              alt={
                                video.title ||
                                `Premium Video ${
                                  index + 1
                                }`
                              }
                              className={`h-full w-full object-cover transition duration-500 ${
                                hasPremium
                                  ? "group-hover:scale-110"
                                  : "scale-105 blur-[5px] opacity-60 group-hover:scale-110"
                              }`}
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-white/10 to-black" />
                          )}

                          {!hasPremium && (
                            <>
                              <div className="absolute inset-0 bg-black/50" />

                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-black/50 text-xl backdrop-blur-xl">
                                  🔒
                                </div>
                              </div>

                              <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-white/65 backdrop-blur-xl">
                                Premium
                              </div>
                            </>
                          )}

                          {hasPremium && (
                            <div className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-black">
                              Watch
                            </div>
                          )}

                          {video.duration && (
                            <div className="absolute bottom-3 right-3 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold text-white/75">
                              {String(
                                video.duration
                              )}
                            </div>
                          )}

                        </div>

                        <div className="p-4">

                          <h3 className="line-clamp-2 text-sm font-bold leading-5 text-white/90">
                            {video.title ||
                              `Premium Video ${
                                index + 1
                              }`}
                          </h3>

                          <div className="mt-3 flex items-center justify-between">

                            <span className="text-[10px] text-white/25">
                              HDLink Premium
                            </span>

                            <span className="text-[10px] font-black text-white/45">
                              {hasPremium
                                ? "Watch →"
                                : "Unlock →"}
                            </span>

                          </div>

                        </div>

                      </div>

                    </button>
                  )
                )}

              </div>
            )}

          </div>
        </div>
      </section>

      {/* FEATURES */}

      <section
        id="features"
        className="relative z-10 border-t border-white/[0.07] px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">

          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
              Why HDLink
            </div>

            <h2 className="mt-3 text-3xl font-black sm:text-4xl">
              Everything stays simple
            </h2>
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {features.map(
              (feature) => (
                <div
                  key={
                    feature.title
                  }
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/[0.05]"
                >

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.08] text-lg">
                    {feature.icon}
                  </div>

                  <h3 className="mt-5 text-sm font-bold">
                    {feature.title}
                  </h3>

                  <p className="mt-2 text-xs leading-6 text-white/35">
                    {feature.text}
                  </p>

                </div>
              )
            )}

          </div>
        </div>
      </section>

      {/* FINAL CTA */}

      <section className="relative z-10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">

          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.045] p-8 sm:p-12">

            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-violet-500/[0.08] blur-[100px]" />

            <div className="relative flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-center">

              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                  HDLink Premium
                </div>

                <h2 className="mt-3 text-3xl font-black sm:text-4xl">
                  Ready to unlock?
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-6 text-white/40">
                  Pick your plan and start
                  your premium access journey.
                </p>
              </div>

              <button
                onClick={() =>
                  document
                    .getElementById("plans")
                    ?.scrollIntoView({
                      behavior: "smooth",
                    })
                }
                className="rounded-full bg-white px-7 py-4 text-sm font-black text-black transition hover:bg-white/90"
              >
                Choose Your Plan →
              </button>

            </div>
          </div>

        </div>
      </section>

      {/* PAYMENT MODAL */}

      {selectedPlan &&
        user &&
        !paymentSubmitted && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/90 p-4 backdrop-blur-xl">

            <div className="my-5 max-h-[95vh] w-full max-w-md overflow-y-auto rounded-[30px] border border-white/10 bg-[#0c0c0c] p-6 shadow-2xl sm:p-8">

              <div className="flex items-start justify-between gap-5">

                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30">
                    HDLink Payment
                  </div>

                  <h2 className="mt-2 text-2xl font-black">
                    {selectedPlan.name}
                  </h2>

                  <p className="mt-1 text-sm text-white/35">
                    ₹{selectedPlan.price}{" "}
                    •{" "}
                    {selectedPlan.duration_days}{" "}
                    days
                  </p>
                </div>

                <button
                  onClick={
                    closePayment
                  }
                  disabled={
                    submitting
                  }
                  className="text-2xl text-white/30 transition hover:text-white disabled:opacity-40"
                >
                  ×
                </button>

              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between">

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/25">
                      Selected plan
                    </div>

                    <div className="mt-1 text-sm font-bold">
                      {selectedPlan.name}
                    </div>
                  </div>

                  <div className="text-2xl font-black">
                    ₹{selectedPlan.price}
                  </div>

                </div>
              </div>

              <div className="mt-5 rounded-3xl bg-white p-4">
                <img
                  src="/hdlink-qr.png"
                  alt="HDLink Payment QR"
                  className="mx-auto h-auto w-full max-w-[280px]"
                />
              </div>

              <div className="mt-3 text-center text-xs text-white/30">
                Scan QR and pay exactly{" "}
                <span className="font-bold text-white/60">
                  ₹{selectedPlan.price}
                </span>
              </div>

              <form
                onSubmit={
                  handlePaymentSubmit
                }
                className="mt-6"
              >

                <label
                  htmlFor="hdlink-utr"
                  className="mb-2 block text-sm font-bold text-white/70"
                >
                  UTR / Transaction ID
                </label>

                <input
                  id="hdlink-utr"
                  type="text"
                  value={utr}
                  onChange={(e) =>
                    setUtr(
                      e.target.value
                    )
                  }
                  placeholder="Enter UTR / Transaction ID"
                  disabled={
                    submitting
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30 disabled:opacity-50"
                />

                {error && (
                  <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-6 text-red-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    submitting
                  }
                  className="mt-5 w-full rounded-full bg-white px-5 py-4 text-sm font-black text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? "Submitting..."
                    : "Submit Payment Request"}
                </button>

              </form>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-center text-[11px] leading-5 text-white/30">
                After submitting your UTR,
                your payment will be manually
                verified by the admin.
              </div>

            </div>
          </div>
        )}

      {/* PAYMENT WAITING */}

      {paymentSubmitted && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-5 backdrop-blur-2xl">

          <div className="w-full max-w-md">

            <div className="overflow-hidden rounded-[35px] border border-white/10 bg-[#0c0c0c] p-8 text-center shadow-2xl sm:p-10">

              <div className="relative mx-auto h-24 w-24">

                <div className="absolute inset-0 animate-ping rounded-full border border-white/10" />

                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/15 bg-white/[0.06]">

                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl font-black text-black">
                    ✓
                  </div>

                </div>
              </div>

              <div className="mt-7">

                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                  Payment Request
                </div>

                <h2 className="mt-3 text-3xl font-black">
                  Request Submitted
                </h2>

                <p className="mt-4 text-sm leading-7 text-white/40">
                  Your payment request was
                  successfully submitted.
                </p>

              </div>

              {selectedPlan && (
                <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.04] p-4">

                  <div className="flex items-center justify-between">

                    <div className="text-left">

                      <div className="text-[9px] uppercase tracking-wider text-white/25">
                        Selected Plan
                      </div>

                      <div className="mt-1 text-sm font-bold">
                        {selectedPlan.name}
                      </div>

                    </div>

                    <div className="text-xl font-black">
                      ₹{selectedPlan.price}
                    </div>

                  </div>

                </div>
              )}

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5">

                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10">

                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-white" />

                </div>

                <h3 className="mt-4 text-base font-bold">
                  Waiting for approval
                </h3>

                <p className="mt-2 text-xs leading-6 text-white/30">
                  Your payment is being manually
                  reviewed. Keep this page open.
                </p>

              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/30">

                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

                {checkingApproval
                  ? "Checking approval..."
                  : "Waiting..."}

              </div>

              <div className="mt-7 border-t border-white/10 pt-6">

                <p className="text-xs leading-5 text-white/20">
                  Once approved, your Premium
                  access will activate automatically.
                </p>

              </div>

            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}

      <footer className="relative z-10 border-t border-white/[0.07] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 sm:flex-row sm:items-center">

          <div>
            <div className="font-black">
              HDLink
            </div>

            <div className="mt-1 text-[10px] text-white/25">
              Premium streaming access
            </div>
          </div>

          <div className="text-[10px] text-white/20">
            Secure payments • Manual verification
          </div>

        </div>
      </footer>

    </main>
  );
}