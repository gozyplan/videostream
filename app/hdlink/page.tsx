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
  const [loadingPlans, setLoadingPlans] =
    useState(true);
  const [loadingVideos, setLoadingVideos] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [showPlans, setShowPlans] =
    useState(false);

  const [paymentSubmitted, setPaymentSubmitted] =
    useState(false);

  const [checkingApproval, setCheckingApproval] =
    useState(false);

  const [error, setError] = useState("");

  const [urlPlanId, setUrlPlanId] =
    useState<string | null>(null);

  const [urlPlanHandled, setUrlPlanHandled] =
    useState(false);

  // ============================================================
  // READ URL PLAN WITHOUT useSearchParams
  // This avoids Next.js production Suspense error.
  // ============================================================

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const plan = params.get("plan");

    setUrlPlanId(plan);
  }, []);

  // ============================================================
  // INITIAL LOAD
  // ============================================================

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

  // ============================================================
  // LOAD PLANS
  // ============================================================

  async function loadPlans() {
    setLoadingPlans(true);

    const {
      data,
      error: plansError,
    } = await supabase
      .from("plans")
      .select(
        "id,name,duration_days,price,description"
      )
      .eq("source", "hdlink")
      .eq("is_active", true)
      .order("duration_days", {
        ascending: true,
      });

    if (plansError) {
      console.error(
        "HDLink plans error:",
        plansError
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

  // ============================================================
  // LOAD VIDEOS
  // ============================================================

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

  // ============================================================
  // CHECK USER
  // ============================================================

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

  // ============================================================
  // AUTH STATE
  // ============================================================

  useEffect(() => {
    const {
      data: {
        subscription: authSubscription,
      },
    } =
      supabase.auth.onAuthStateChange(
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
      authSubscription.unsubscribe();
    };
  }, []);

  // ============================================================
  // LOAD ACTIVE SUBSCRIPTION
  // ============================================================

  async function loadSubscription(
    userId: string
  ) {
    const now =
      new Date().toISOString();

    const {
      data,
      error: subscriptionError,
    } = await supabase
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

    if (subscriptionError) {
      console.error(
        "Subscription error:",
        subscriptionError
      );

      setSubscription(null);

      return null;
    }

    setSubscription(data);

    return data;
  }

  // ============================================================
  // PREMIUM CHECK
  // ============================================================

  const hasPremium =
    !!subscription &&
    subscription.status === "active" &&
    new Date(
      subscription.expires_at
    ).getTime() > Date.now();

  // ============================================================
  // HANDLE PLAN FROM URL
  // ============================================================

  useEffect(() => {
    if (
      !urlPlanId ||
      plans.length === 0 ||
      urlPlanHandled
    ) {
      return;
    }

    const planId = Number(
      urlPlanId
    );

    if (!Number.isFinite(planId)) {
      setError(
        "Invalid selected plan."
      );

      setUrlPlanHandled(true);

      return;
    }

    const matchedPlan = plans.find(
      (plan) =>
        plan.id === planId
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
        "/premium"
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
        `/auth/register?hdlink=1&plan=${encodeURIComponent(
          String(matchedPlan.id)
        )}`;

      return;
    }

    setSelectedPlan(
      matchedPlan
    );

    setShowPlans(false);
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

  // ============================================================
  // RESTORE SAVED PLAN
  // ============================================================

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

    const planId = Number(
      savedPlanId
    );

    if (!Number.isFinite(planId)) {
      localStorage.removeItem(
        "hdlink_pending_plan_id"
      );

      return;
    }

    const savedPlan = plans.find(
      (plan) =>
        plan.id === planId
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
        `/auth/register?hdlink=1&plan=${encodeURIComponent(
          String(savedPlan.id)
        )}`;

      return;
    }

    setSelectedPlan(
      savedPlan
    );
  }, [
    plans,
    urlPlanId,
    selectedPlan,
    user,
    hasPremium,
    urlPlanHandled,
  ]);

  // ============================================================
  // SELECT PLAN
  // ============================================================

  function selectPlan(
    plan: Plan
  ) {
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
    setShowPlans(false);
  }

  // ============================================================
  // OPEN PLANS
  // ============================================================

  function openPlans() {
    setError("");

    if (plans.length === 0) {
      setError(
        "No plans are currently available."
      );

      return;
    }

    setShowPlans(true);
  }

  // ============================================================
  // CLOSE PLANS
  // ============================================================

  function closePlans() {
    setShowPlans(false);
  }

  // ============================================================
  // CLOSE PAYMENT
  // ============================================================

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
      router.replace(
        "/hdlink"
      );
    }
  }

  // ============================================================
  // LOGIN
  // ============================================================

  function goToLogin(
    plan?: Plan | null
  ) {
    const targetPlan =
      plan || selectedPlan;

    if (targetPlan) {
      const planId =
        String(targetPlan.id);

      localStorage.setItem(
        "hdlink_pending_plan_id",
        planId
      );

      window.location.href =
        `/auth/login?hdlink=1&plan=${encodeURIComponent(
          planId
        )}`;

      return;
    }

    window.location.href =
      "/auth/login";
  }

  // ============================================================
  // REGISTER
  // ============================================================

  function goToRegister(
    plan?: Plan | null
  ) {
    const targetPlan =
      plan || selectedPlan;

    if (targetPlan) {
      const planId =
        String(targetPlan.id);

      localStorage.setItem(
        "hdlink_pending_plan_id",
        planId
      );

      window.location.href =
        `/auth/register?hdlink=1&plan=${encodeURIComponent(
          planId
        )}`;

      return;
    }

    window.location.href =
      "/auth/register";
  }

  // ============================================================
  // VIDEO CLICK
  // ============================================================

  function handleVideoClick(
    _video: Video
  ) {
    if (hasPremium) {
      router.push(
        "/premium"
      );

      return;
    }

    openPlans();
  }

  // ============================================================
  // PAYMENT SUBMIT
  // ============================================================

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

    if (!user) {
      goToRegister(plan);

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
      // ======================================================
      // DUPLICATE UTR
      // ======================================================

      const {
        data: existingPayment,
        error: duplicateError,
      } = await supabase
        .from("payment_requests")
        .select(
          "id,status"
        )
        .eq(
          "utr",
          transactionId
        )
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

      // ======================================================
      // INSERT PAYMENT
      // ======================================================

      const {
        data: insertedPayment,
        error: insertError,
      } = await supabase
        .from("payment_requests")
        .insert({
          user_id:
            user.id,

          plan_id:
            plan.id,

          utr:
            transactionId,

          status:
            "pending",

          source:
            "hdlink",
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
        String(plan.id)
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

  // ============================================================
  // PAYMENT APPROVAL CHECK
  // ============================================================

  useEffect(() => {
    if (
      !paymentSubmitted ||
      !user ||
      !selectedPlan
    ) {
      return;
    }

    const plan = selectedPlan;

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
                Number(
                  pendingId
                )
              )
              .eq(
                "user_id",
                user.id
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
                user.id
              )
              .eq(
                "plan_id",
                plan.id
              )
              .eq(
                "source",
                "hdlink"
              )
              .order(
                "id",
                {
                  ascending:
                    false,
                }
              )
              .limit(1)
              .maybeSingle();
        }

        const {
          data: payment,
          error:
            paymentError,
        } =
          await paymentQuery;

        if (paymentError) {
          console.error(
            "Payment status error:",
            paymentError
          );

          return;
        }

        if (
          !payment ||
          stopped
        ) {
          return;
        }

        // ====================================================
        // APPROVED
        // ====================================================

        if (
          payment.status ===
            "approved" ||
          payment.status ===
            "active"
        ) {
          const activeSubscription =
            await loadSubscription(
              user.id
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

            setCheckingApproval(
              false
            );

            router.replace(
              "/premium"
            );

            return;
          }
        }

        // ====================================================
        // REJECTED
        // ====================================================

        if (
          payment.status ===
            "rejected" ||
          payment.status ===
            "failed"
        ) {
          stopped = true;

          setCheckingApproval(
            false
          );

          setPaymentSubmitted(
            false
          );

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

  // ============================================================
  // FEATURES
  // ============================================================

  const features = useMemo(
    () => [
      {
        title:
          "Premium HD video access",
        text:
          "Access premium videos after your payment is approved.",
      },
      {
        title:
          "Secure account access",
        text:
          "Your premium access is connected to your account.",
      },
      {
        title:
          "Manual payment verification",
        text:
          "Every payment request is reviewed before activation.",
      },
      {
        title:
          "Fast approval detection",
        text:
          "Once approved, your account is checked automatically.",
      },
      {
        title:
          "Direct Premium access",
        text:
          "After approval you are automatically redirected to Premium.",
      },
      {
        title:
          "Protected video library",
        text:
          "Locked previews remain protected until premium access is active.",
      },
    ],
    []
  );

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-black">
            H
          </div>

          <div className="mx-auto mt-5 h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-white" />

          <p className="mt-4 text-sm text-white/40">
            Loading HDLink...
          </p>
        </div>
      </main>
    );
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050505] text-white">

      {/* BACKGROUND */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-250px] h-[650px] w-[900px] -translate-x-1/2 rounded-full bg-purple-500/[0.08] blur-[150px]" />

        <div className="absolute right-[-200px] top-[500px] h-[500px] w-[500px] rounded-full bg-blue-500/[0.05] blur-[140px]" />

        <div className="absolute bottom-[-250px] left-[-200px] h-[500px] w-[500px] rounded-full bg-pink-500/[0.04] blur-[140px]" />
      </div>

      {/* NAVBAR */}

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050505]/75 backdrop-blur-2xl">
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
              <div className="text-lg font-black tracking-tight">
                HDLink
              </div>

              <div className="text-[9px] font-semibold uppercase tracking-[0.3em] text-white/30">
                Premium Streaming
              </div>
            </div>
          </button>

          <div className="hidden items-center gap-8 md:flex">
            <button
              onClick={() =>
                document
                  .getElementById(
                    "videos"
                  )
                  ?.scrollIntoView({
                    behavior:
                      "smooth",
                  })
              }
              className="text-sm text-white/50 transition hover:text-white"
            >
              Videos
            </button>

            <button
              onClick={openPlans}
              className="text-sm text-white/50 transition hover:text-white"
            >
              Plans
            </button>

            <button
              onClick={() =>
                document
                  .getElementById(
                    "features"
                  )
                  ?.scrollIntoView({
                    behavior:
                      "smooth",
                  })
              }
              className="text-sm text-white/50 transition hover:text-white"
            >
              Features
            </button>
          </div>

          <div className="flex items-center gap-3">
            {hasPremium ? (
              <button
                onClick={() =>
                  router.push(
                    "/premium"
                  )
                }
                className="rounded-full bg-white px-5 py-2.5 text-xs font-black text-black transition hover:bg-white/90"
              >
                Open Premium →
              </button>
            ) : user ? (
              <button
                onClick={openPlans}
                className="rounded-full bg-white px-5 py-2.5 text-xs font-bold text-black transition hover:bg-white/90"
              >
                Get Premium
              </button>
            ) : (
              <>
                <button
                  onClick={() =>
                    goToLogin()
                  }
                  className="hidden rounded-full border border-white/10 px-5 py-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/5 hover:text-white sm:block"
                >
                  Login
                </button>

                <button
                  onClick={openPlans}
                  className="rounded-full bg-white px-5 py-2.5 text-xs font-bold text-black transition hover:bg-white/90"
                >
                  Get Premium
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}

      <section className="relative z-10 px-5 pb-20 pt-20 sm:pb-28 sm:pt-28">
        <div className="mx-auto max-w-7xl">

          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">

            <div>

              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/60 backdrop-blur-xl">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                HDLink Premium is live
              </div>

              <h1 className="max-w-4xl text-5xl font-black tracking-[-0.04em] sm:text-6xl lg:text-7xl">
                Premium videos.
                <br />
                <span className="text-white/40">
                  One simple access.
                </span>
              </h1>

              <p className="mt-7 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
                Explore premium video previews,
                choose your plan and unlock
                HDLink access after secure
                payment verification.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">

                {hasPremium ? (
                  <button
                    onClick={() =>
                      router.push(
                        "/premium"
                      )
                    }
                    className="rounded-full bg-white px-7 py-4 text-sm font-black text-black shadow-2xl transition hover:scale-[1.02]"
                  >
                    Open Premium →
                  </button>
                ) : (
                  <button
                    onClick={openPlans}
                    className="rounded-full bg-white px-7 py-4 text-sm font-black text-black shadow-2xl transition hover:scale-[1.02]"
                  >
                    Unlock Premium →
                  </button>
                )}

                <button
                  onClick={() =>
                    document
                      .getElementById(
                        "videos"
                      )
                      ?.scrollIntoView({
                        behavior:
                          "smooth",
                      })
                  }
                  className="rounded-full border border-white/10 bg-white/[0.04] px-7 py-4 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Explore previews
                </button>

              </div>

              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/30">
                <span>
                  ✓ Secure payment
                </span>

                <span>
                  ✓ Manual verification
                </span>

                <span>
                  ✓ Account based access
                </span>
              </div>

            </div>

            <div className="relative">

              <div className="absolute -inset-5 rounded-[40px] bg-white/[0.03] blur-2xl" />

              <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-2 shadow-2xl">

                <div className="relative aspect-video overflow-hidden rounded-[25px] bg-[#111]">

                  {videos[0]?.thumbnail_url ? (
                    <img
                      src={
                        videos[0]
                          .thumbnail_url
                      }
                      alt="HDLink premium preview"
                      className="h-full w-full scale-110 object-cover blur-[5px] opacity-60"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-white/10 to-black" />
                  )}

                  <div className="absolute inset-0 bg-black/55" />

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-xl">
                      <span className="text-2xl">
                        🔒
                      </span>
                    </div>
                  </div>

                  <div className="absolute bottom-5 left-5 right-5">

                    <div className="rounded-2xl border border-white/10 bg-black/50 p-4 backdrop-blur-xl">

                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                        Premium Preview
                      </div>

                      <div className="mt-2 text-lg font-bold">
                        {hasPremium
                          ? "Premium access active"
                          : "Unlock to watch"}
                      </div>

                      <div className="mt-1 text-xs text-white/40">
                        {hasPremium
                          ? "Your account has premium access."
                          : "Premium content is protected."}
                      </div>

                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>
      </section>

      {/* VIDEO SECTION */}

      <section
        id="videos"
        className="relative z-10 border-t border-white/10 px-5 py-20 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

            <div>
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
                Premium library
              </div>

              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Explore what&apos;s inside
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-white/40">
                Preview the premium library before
                choosing your plan.
              </p>
            </div>

            <button
              onClick={
                hasPremium
                  ? () =>
                      router.push(
                        "/premium"
                      )
                  : openPlans
              }
              className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            >
              {hasPremium
                ? "Open Premium →"
                : "View Plans →"}
            </button>

          </div>

          <div className="mt-10">

            {loadingVideos ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                {Array.from({
                  length: 8,
                }).map(
                  (_, index) => (
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
                  )
                )}

              </div>
            ) : videos.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">

                <div className="text-4xl">
                  🎬
                </div>

                <h3 className="mt-4 text-xl font-bold">
                  Premium library
                </h3>

                <p className="mt-2 text-sm text-white/40">
                  Video previews are currently unavailable.
                </p>

              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                {videos.map(
                  (
                    video,
                    index
                  ) => (
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
                                `Premium video ${
                                  index + 1
                                }`
                              }
                              className={`h-full w-full object-cover transition duration-500 ${
                                hasPremium
                                  ? "group-hover:scale-110"
                                  : "scale-105 blur-[4px] opacity-65 group-hover:scale-110"
                              }`}
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-white/10 to-black" />
                          )}

                          {!hasPremium && (
                            <>
                              <div className="absolute inset-0 bg-black/45" />

                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-black/45 text-xl shadow-xl backdrop-blur-xl">
                                  🔒
                                </div>
                              </div>

                              <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 backdrop-blur-xl">
                                Premium
                              </div>
                            </>
                          )}

                          {hasPremium && (
                            <div className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-black">
                              Watch
                            </div>
                          )}

                          {video.duration && (
                            <div className="absolute bottom-3 right-3 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold text-white/80">
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

                            <span className="text-[11px] text-white/30">
                              {hasPremium
                                ? "Premium access"
                                : "Premium content"}
                            </span>

                            <span className="text-[11px] font-bold text-white/50">
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

      {/* PREMIUM BANNER */}

      <section className="relative z-10 px-5 py-10">
        <div className="mx-auto max-w-7xl">

          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-8 sm:p-12">

            <div className="absolute right-[-100px] top-[-150px] h-[350px] w-[350px] rounded-full bg-purple-500/[0.08] blur-[100px]" />

            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">

              <div>

                <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                  HDLink Premium
                </div>

                <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                  {hasPremium
                    ? "Your Premium is ready."
                    : "Ready to unlock the library?"}
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
                  {hasPremium
                    ? "Your payment has been approved. Open Premium and start watching."
                    : "Choose your plan and submit your payment request for manual verification."}
                </p>

              </div>

              <button
                onClick={
                  hasPremium
                    ? () =>
                        router.push(
                          "/premium"
                        )
                    : openPlans
                }
                className="rounded-full bg-white px-7 py-4 text-sm font-black text-black transition hover:bg-white/90"
              >
                {hasPremium
                  ? "Open Premium →"
                  : "Choose Plan →"}
              </button>

            </div>

          </div>

        </div>
      </section>

      {/* FEATURES */}

      <section
        id="features"
        className="relative z-10 px-5 py-20 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">

          <div className="max-w-2xl">

            <div className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
              Why HDLink
            </div>

            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Built for premium access
            </h2>

          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {features.map(
              (
                feature,
                index
              ) => (
                <div
                  key={
                    feature.title
                  }
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:bg-white/[0.05]"
                >

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-black text-black">
                    {index + 1}
                  </div>

                  <h3 className="mt-5 text-sm font-bold text-white/90">
                    {feature.title}
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-white/35">
                    {feature.text}
                  </p>

                </div>
              )
            )}

          </div>

        </div>
      </section>

      {/* ======================================================
          PLANS MODAL
      ====================================================== */}

      {showPlans && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-xl">

          <div className="my-8 w-full max-w-5xl rounded-[30px] border border-white/10 bg-[#0b0b0b] p-6 shadow-2xl sm:p-8">

            <div className="flex items-start justify-between gap-5">

              <div>

                <div className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
                  HDLink Premium
                </div>

                <h2 className="mt-2 text-3xl font-black">
                  Choose your plan
                </h2>

                <p className="mt-2 text-sm text-white/40">
                  Select a plan to continue.
                </p>

              </div>

              <button
                onClick={closePlans}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-xl text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                ×
              </button>

            </div>

            <div className="mt-8">

              {loadingPlans ? (
                <div className="py-16 text-center text-sm text-white/40">
                  Loading plans...
                </div>
              ) : plans.length === 0 ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-sm text-red-300">
                  No HDLink plans are currently available.
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-3">

                  {plans.map(
                    (plan) => {

                      const popular =
                        plan.duration_days ===
                        15;

                      return (
                        <div
                          key={
                            plan.id
                          }
                          className={`relative rounded-3xl border p-6 ${
                            popular
                              ? "border-white/30 bg-white/[0.08]"
                              : "border-white/10 bg-white/[0.03]"
                          }`}
                        >

                          {popular && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-4 py-1 text-[10px] font-black text-black">
                              ⭐ MOST POPULAR
                            </div>
                          )}

                          <div className="text-xs font-bold uppercase tracking-wider text-white/35">
                            {plan.name}
                          </div>

                          <div className="mt-4 text-4xl font-black">
                            ₹{plan.price}
                          </div>

                          <div className="mt-1 text-xs text-white/35">
                            {plan.duration_days}{" "}
                            day
                            {plan.duration_days !==
                            1
                              ? "s"
                              : ""}{" "}
                            premium access
                          </div>

                          <p className="mt-5 min-h-[40px] text-xs leading-5 text-white/40">
                            {plan.description ||
                              "Premium HDLink access"}
                          </p>

                          <button
                            onClick={() =>
                              selectPlan(
                                plan
                              )
                            }
                            className="mt-6 w-full rounded-full bg-white px-5 py-3.5 text-xs font-black text-black transition hover:bg-white/90"
                          >
                            Buy This Plan →
                          </button>

                        </div>
                      );
                    }
                  )}

                </div>
              )}

            </div>

            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-center text-xs leading-5 text-white/30">
              Payment is manually verified.
              Premium access activates after admin approval.
            </div>

          </div>

        </div>
      )}

      {/* ======================================================
          PAYMENT MODAL
      ====================================================== */}

      {selectedPlan &&
        user &&
        !paymentSubmitted && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-xl">

            <div className="my-6 max-h-[95vh] w-full max-w-md overflow-y-auto rounded-[30px] border border-white/10 bg-[#0c0c0c] p-6 shadow-2xl sm:p-8">

              <div className="flex items-start justify-between">

                <div>

                  <div className="text-xs font-bold uppercase tracking-wider text-white/30">
                    Secure Payment
                  </div>

                  <h2 className="mt-2 text-2xl font-black">
                    {selectedPlan?.name}
                  </h2>

                  <p className="mt-1 text-sm text-white/40">
                    ₹{selectedPlan?.price} •{" "}
                    {selectedPlan?.duration_days} days
                  </p>

                </div>

                <button
                  onClick={
                    closePayment
                  }
                  disabled={
                    submitting
                  }
                  className="text-2xl text-white/30 hover:text-white disabled:opacity-50"
                >
                  ×
                </button>

              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">

                <div className="flex items-center justify-between">

                  <div>

                    <div className="text-xs text-white/30">
                      Selected plan
                    </div>

                    <div className="mt-1 text-sm font-bold">
                      {selectedPlan?.name}
                    </div>

                  </div>

                  <div className="text-2xl font-black">
                    ₹{selectedPlan?.price}
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
                Scan QR and pay exactly ₹
                {selectedPlan?.price}
              </div>

              <form
                onSubmit={
                  handlePaymentSubmit
                }
                className="mt-6"
              >

                <label
                  htmlFor="hdlink-utr"
                  className="mb-2 block text-sm font-semibold text-white/70"
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
                  placeholder="Enter your UTR / Transaction ID"
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
                    ? "Submitting Request..."
                    : "Submit Payment Request"}
                </button>

              </form>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-center text-xs leading-5 text-white/30">
                After submitting your UTR,
                please wait for manual admin approval.
              </div>

            </div>

          </div>
        )}

      {/* ======================================================
          PAYMENT WAITING
      ====================================================== */}

      {paymentSubmitted && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-5 backdrop-blur-2xl">

          <div className="w-full max-w-md">

            <div className="overflow-hidden rounded-[35px] border border-white/10 bg-[#0c0c0c] p-8 text-center shadow-2xl sm:p-10">

              <div className="relative mx-auto h-24 w-24">

                <div className="absolute inset-0 animate-ping rounded-full border border-white/10" />

                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/15 bg-white/[0.06]">

                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl text-black">
                    ✓
                  </div>

                </div>

              </div>

              <div className="mt-7">

                <div className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
                  Payment Request
                </div>

                <h2 className="mt-3 text-3xl font-black">
                  Request Submitted
                </h2>

                <p className="mt-4 text-sm leading-7 text-white/45">
                  Your payment request has been
                  successfully submitted.
                </p>

              </div>

              {selectedPlan && (
                <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.04] p-4">

                  <div className="flex items-center justify-between">

                    <div className="text-left">

                      <div className="text-[10px] uppercase tracking-wider text-white/30">
                        Selected Plan
                      </div>

                      <div className="mt-1 text-sm font-bold">
                        {selectedPlan?.name}
                      </div>

                    </div>

                    <div className="text-xl font-black">
                      ₹{selectedPlan?.price}
                    </div>

                  </div>

                </div>
              )}

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5">

                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10">

                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-white" />

                </div>

                <h3 className="mt-4 text-base font-bold">
                  Please wait for admin approval
                </h3>

                <p className="mt-2 text-xs leading-6 text-white/35">
                  Your payment is being manually
                  reviewed. Please keep this page open.
                </p>

              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/30">

                <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />

                {checkingApproval
                  ? "Waiting for approval..."
                  : "Checking payment status..."}

              </div>

              <div className="mt-7 border-t border-white/10 pt-6">

                <p className="text-xs leading-5 text-white/25">
                  Once your payment is approved,
                  your Premium access will activate
                  automatically and you will be
                  redirected to Premium.
                </p>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* FOOTER */}

      <footer className="relative z-10 border-t border-white/10 px-5 py-10">

        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 text-center sm:flex-row sm:text-left">

          <div>

            <div className="font-bold">
              HDLink
            </div>

            <div className="mt-1 text-xs text-white/25">
              Premium streaming access
            </div>

          </div>

          <div className="text-xs text-white/25">
            Secure payments • Manual verification
          </div>

        </div>

      </footer>

    </main>
  );
}