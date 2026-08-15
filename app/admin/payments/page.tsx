"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Plan = {
  name: string;
  price: number;
  duration_days: number;
};

type PaymentRequest = {
  id: number;
  user_id: string;
  plan_id: number;
  utr: string;
  screenshot_url: string | null;
  status: string;
  created_at: string;
  plans?: Plan | Plan[] | null;
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [processingId, setProcessingId] =
    useState<number | null>(null);

  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    loadPayments();
  }, []);

  // ============================================================
  // LOAD PAYMENTS
  // ============================================================

  async function loadPayments() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/auth/login";
      return;
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      setError(
        "You are not authorized to access this page."
      );
      setLoading(false);
      return;
    }

    const {
      data,
      error: paymentError,
    } = await supabase
      .from("payment_requests")
      .select(`
        id,
        user_id,
        plan_id,
        utr,
        screenshot_url,
        status,
        created_at,
        plans (
          name,
          price,
          duration_days
        )
      `)
      .order("created_at", {
        ascending: false,
      });

    if (paymentError) {
      console.error(paymentError);
      setError(paymentError.message);
      setLoading(false);
      return;
    }

    setPayments(
      (data || []) as unknown as PaymentRequest[]
    );

    setLoading(false);
  }

  // ============================================================
  // GET PLAN
  // ============================================================

  function getPlan(payment: PaymentRequest) {
    if (!payment.plans) {
      return null;
    }

    if (Array.isArray(payment.plans)) {
      return payment.plans[0] || null;
    }

    return payment.plans;
  }

  // ============================================================
  // SEND NOTIFICATION
  // ============================================================

  async function sendPaymentNotification(
    userId: string,
    type: "approved" | "rejected",
    planName: string
  ) {
    try {
      const response = await fetch(
        "/api/send-payment-notification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            type,
            planName,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Notification error:",
          data
        );
      }

      return data;
    } catch (error) {
      console.error(
        "Notification request failed:",
        error
      );

      return null;
    }
  }

  // ============================================================
  // APPROVE PAYMENT
  // ============================================================

  async function approvePayment(
    payment: PaymentRequest
  ) {
    const plan = getPlan(payment);

    if (!plan) {
      setError(
        "Plan information not found."
      );
      return;
    }

    const confirmed = window.confirm(
      `Approve this payment?\n\nPlan: ${plan.name}\nAmount: ₹${plan.price}\nUTR: ${payment.utr}`
    );

    if (!confirmed) {
      return;
    }

    setProcessingId(payment.id);
    setError("");
    setSuccessMessage("");

    try {
      // --------------------------------------------------------
      // 1. UPDATE PAYMENT STATUS
      // --------------------------------------------------------

      const {
        error: paymentUpdateError,
      } = await supabase
        .from("payment_requests")
        .update({
          status: "approved",
        })
        .eq("id", payment.id);

      if (paymentUpdateError) {
        throw paymentUpdateError;
      }

      // --------------------------------------------------------
      // 2. SUBSCRIPTION DATES
      // --------------------------------------------------------

      const startsAt = new Date();

      const expiresAt = new Date();

      expiresAt.setDate(
        expiresAt.getDate() +
          Number(plan.duration_days)
      );

      // --------------------------------------------------------
      // 3. CHECK EXISTING ACTIVE SUBSCRIPTION
      // --------------------------------------------------------

      const now =
        new Date().toISOString();

      const {
        data: existingSubscription,
        error:
          subscriptionCheckError,
      } = await supabase
        .from("subscriptions")
        .select(
          "id, status, expires_at"
        )
        .eq(
          "user_id",
          payment.user_id
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
        )
        .limit(1)
        .maybeSingle();

      if (subscriptionCheckError) {
        throw subscriptionCheckError;
      }

      // --------------------------------------------------------
      // 4. CREATE / EXTEND SUBSCRIPTION
      // --------------------------------------------------------

      if (existingSubscription) {
        const currentExpiry =
          new Date(
            existingSubscription.expires_at
          );

        const newExpiry =
          new Date(
            currentExpiry
          );

        newExpiry.setDate(
          newExpiry.getDate() +
            Number(
              plan.duration_days
            )
        );

        const {
          error: extendError,
        } = await supabase
          .from("subscriptions")
          .update({
            expires_at:
              newExpiry.toISOString(),
            plan_id:
              payment.plan_id,
            status: "active",
          })
          .eq(
            "id",
            existingSubscription.id
          );

        if (extendError) {
          throw extendError;
        }
      } else {
        const {
          error:
            subscriptionInsertError,
        } = await supabase
          .from("subscriptions")
          .insert({
            user_id:
              payment.user_id,
            plan_id:
              payment.plan_id,
            status: "active",
            starts_at:
              startsAt.toISOString(),
            expires_at:
              expiresAt.toISOString(),
          });

        if (subscriptionInsertError) {
          throw subscriptionInsertError;
        }
      }

      // --------------------------------------------------------
      // 5. SEND APPROVAL NOTIFICATION
      // --------------------------------------------------------

      await sendPaymentNotification(
        payment.user_id,
        "approved",
        plan.name
      );

      // --------------------------------------------------------
      // 6. UPDATE UI
      // --------------------------------------------------------

      setPayments(
        (currentPayments) =>
          currentPayments.map(
            (item) =>
              item.id === payment.id
                ? {
                    ...item,
                    status:
                      "approved",
                  }
                : item
          )
      );

      setSuccessMessage(
        `Payment approved successfully. ${plan.name} has been activated and the user has been notified.`
      );
    } catch (error: any) {
      console.error(
        "Approve payment error:",
        error
      );

      setError(
        error?.message ||
          "Payment approval failed."
      );

      await loadPayments();
    } finally {
      setProcessingId(null);
    }
  }

  // ============================================================
  // REJECT PAYMENT
  // ============================================================

  async function rejectPayment(
    payment: PaymentRequest
  ) {
    const confirmed = window.confirm(
      `Reject this payment?\n\nUTR: ${payment.utr}`
    );

    if (!confirmed) {
      return;
    }

    setProcessingId(payment.id);
    setError("");
    setSuccessMessage("");

    try {
      const {
        error: rejectError,
      } = await supabase
        .from("payment_requests")
        .update({
          status: "rejected",
        })
        .eq(
          "id",
          payment.id
        );

      if (rejectError) {
        throw rejectError;
      }

      const plan =
        getPlan(payment);

      // --------------------------------------------------------
      // SEND REJECTION NOTIFICATION
      // --------------------------------------------------------

      await sendPaymentNotification(
        payment.user_id,
        "rejected",
        plan?.name ||
          "Selected Plan"
      );

      // --------------------------------------------------------
      // UPDATE UI
      // --------------------------------------------------------

      setPayments(
        (currentPayments) =>
          currentPayments.map(
            (item) =>
              item.id === payment.id
                ? {
                    ...item,
                    status:
                      "rejected",
                  }
                : item
          )
      );

      setSuccessMessage(
        "Payment request rejected and the user has been notified."
      );
    } catch (error: any) {
      console.error(
        "Reject payment error:",
        error
      );

      setError(
        error?.message ||
          "Payment rejection failed."
      );

      await loadPayments();
    } finally {
      setProcessingId(null);
    }
  }

  // ============================================================
  // STATUS STYLE
  // ============================================================

  function getStatusClass(
    status: string
  ) {
    switch (
      status.toLowerCase()
    ) {
      case "approved":
        return "border-green-500/20 bg-green-500/10 text-green-300";

      case "rejected":
        return "border-red-500/20 bg-red-500/10 text-red-300";

      case "pending":
      default:
        return "border-yellow-500/20 bg-yellow-500/10 text-yellow-300";
    }
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />

          <p className="mt-4 text-sm text-white/50">
            Loading payments...
          </p>
        </div>
      </main>
    );
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <main className="min-h-screen bg-[#080808] px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">

          <div>
            <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/50">
              Admin Panel
            </div>

            <h1 className="text-4xl font-black tracking-tight">
              Payment Requests
            </h1>

            <p className="mt-2 text-white/40">
              Review and manage customer payments.
            </p>
          </div>

          <button
            onClick={loadPayments}
            className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold transition hover:bg-white/10"
          >
            ↻ Refresh
          </button>

        </div>

        {/* SUCCESS */}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/10 p-5 text-sm text-green-300">
            ✓ {successMessage}
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* PAYMENTS */}

        <div className="mt-10 space-y-5">

          {payments.length === 0 ? (

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">

              <div className="text-4xl">
                💳
              </div>

              <h2 className="mt-4 text-xl font-bold">
                No payment requests
              </h2>

              <p className="mt-2 text-sm text-white/40">
                Customer payment requests will appear here.
              </p>

            </div>

          ) : (

            payments.map(
              (payment) => {

                const plan =
                  getPlan(payment);

                const isProcessing =
                  processingId ===
                  payment.id;

                return (
                  <div
                    key={
                      payment.id
                    }
                    className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]"
                  >

                    {/* TOP */}

                    <div className="border-b border-white/10 px-6 py-5">

                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">

                        <div>

                          <div className="flex flex-wrap items-center gap-3">

                            <span
                              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusClass(
                                payment.status
                              )}`}
                            >
                              {payment.status}
                            </span>

                            <span className="text-xs text-white/30">
                              Request #
                              {
                                payment.id
                              }
                            </span>

                          </div>

                          <h2 className="mt-3 text-xl font-bold">
                            {plan?.name ||
                              `Plan #${payment.plan_id}`}
                          </h2>

                        </div>

                        <div className="text-left md:text-right">

                          <p className="text-xs text-white/30">
                            Amount
                          </p>

                          <p className="mt-1 text-3xl font-black">
                            ₹
                            {plan?.price ??
                              "-"}
                          </p>

                        </div>

                      </div>

                    </div>

                    {/* DETAILS */}

                    <div className="grid gap-5 px-6 py-6 md:grid-cols-4">

                      <div>
                        <p className="text-xs text-white/30">
                          User ID
                        </p>

                        <p className="mt-2 break-all text-sm text-white/80">
                          {
                            payment.user_id
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-white/30">
                          UTR / Transaction ID
                        </p>

                        <p className="mt-2 break-all rounded-lg bg-black/30 px-3 py-2 font-mono text-sm text-white">
                          {
                            payment.utr
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-white/30">
                          Duration
                        </p>

                        <p className="mt-2 text-sm font-semibold">
                          {plan
                            ? `${plan.duration_days} Days`
                            : "-"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-white/30">
                          Submitted
                        </p>

                        <p className="mt-2 text-sm text-white/70">
                          {new Date(
                            payment.created_at
                          ).toLocaleString()}
                        </p>
                      </div>

                    </div>

                    {/* SCREENSHOT */}

                    {payment.screenshot_url && (
                      <div className="border-t border-white/10 px-6 py-5">

                        <p className="mb-3 text-xs text-white/30">
                          Payment Screenshot
                        </p>

                        <a
                          href={
                            payment.screenshot_url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block overflow-hidden rounded-2xl border border-white/10"
                        >
                          <img
                            src={
                              payment.screenshot_url
                            }
                            alt="Payment screenshot"
                            className="max-h-72 max-w-full object-contain transition hover:scale-[1.02]"
                          />
                        </a>

                      </div>
                    )}

                    {/* ACTIONS */}

                    <div className="border-t border-white/10 bg-black/20 px-6 py-5">

                      {payment.status ===
                      "pending" ? (

                        <div className="flex flex-col gap-3 sm:flex-row">

                          <button
                            onClick={() =>
                              approvePayment(
                                payment
                              )
                            }
                            disabled={
                              isProcessing
                            }
                            className="flex-1 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isProcessing
                              ? "Processing..."
                              : "✓ Approve Payment"}
                          </button>

                          <button
                            onClick={() =>
                              rejectPayment(
                                payment
                              )
                            }
                            disabled={
                              isProcessing
                            }
                            className="flex-1 rounded-full border border-red-500/20 bg-red-500/10 px-6 py-3.5 text-sm font-bold text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isProcessing
                              ? "Processing..."
                              : "✕ Reject Payment"}
                          </button>

                        </div>

                      ) : (

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                          <p className="text-sm text-white/40">
                            This payment request has already been{" "}
                            <span className="font-semibold text-white/70">
                              {payment.status}
                            </span>
                            .
                          </p>

                          {payment.status ===
                            "approved" && (
                            <span className="rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2 text-xs font-semibold text-green-300">
                              ✓ Premium Activated
                            </span>
                          )}

                          {payment.status ===
                            "rejected" && (
                            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-300">
                              Payment Rejected
                            </span>
                          )}

                        </div>

                      )}

                    </div>

                  </div>
                );
              }
            )

          )}

        </div>

      </div>
    </main>
  );
}