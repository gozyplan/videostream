"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type PaymentRequest = {
  id: number;
  user_id: string;
  plan_id: number;
  utr: string;
  screenshot_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  approved_at: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

type Plan = {
  id: number;
  name: string;
  price: number;
  duration_days: number;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please login first.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.is_admin) {
        setError("You are not authorized to access this page.");
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      const { data: plansData, error: plansError } = await supabase
        .from("plans")
        .select("id, name, price, duration_days")
        .order("duration_days", { ascending: true });

      if (plansError) {
        setError(plansError.message);
        setLoading(false);
        return;
      }

      const { data: requestData, error: requestError } = await supabase
        .from("payment_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (requestError) {
        setError(requestError.message);
        setLoading(false);
        return;
      }

      setPlans(plansData || []);
      setRequests(requestData || []);
    } catch (err: unknown) {
      console.error("Admin load error:", err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not load admin panel.");
      }
    } finally {
      setLoading(false);
    }
  }

  function getPlan(planId: number) {
    return plans.find((plan) => plan.id === planId);
  }

  async function approvePayment(id: number) {
    const confirmed = window.confirm(
      "Are you sure you want to approve this payment?"
    );

    if (!confirmed) {
      return;
    }

    setProcessingId(id);
    setError("");

    try {
      const { error: rpcError } = await supabase.rpc(
        "approve_payment_request",
        {
          request_id: id,
        }
      );

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      await loadAdminData();
    } catch (err: unknown) {
      console.error("Approve payment error:", err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not approve payment.");
      }
    } finally {
      setProcessingId(null);
    }
  }

  async function rejectPayment(id: number) {
    const note = window.prompt(
      "Enter rejection reason (optional):"
    );

    if (note === null) {
      return;
    }

    setProcessingId(id);
    setError("");

    try {
      const { error: rpcError } = await supabase.rpc(
        "reject_payment_request",
        {
          request_id: id,
          note: note || null,
        }
      );

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      await loadAdminData();
    } catch (err: unknown) {
      console.error("Reject payment error:", err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not reject payment.");
      }
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-black">
            H
          </div>

          <p className="mt-5 text-sm text-white/50">
            Loading admin panel...
          </p>
        </div>
      </main>
    );
  }

  if (error && !isAdmin) {
    return (
      <main className="min-h-screen bg-[#080808] px-5 py-20 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center">
          <h1 className="text-2xl font-bold text-red-300">
            Admin Access Error
          </h1>

          <p className="mt-3 text-sm text-red-200/70">
            {error}
          </p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        {/* HEADER */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-white/40">
              Administration
            </p>

            <h1 className="mt-2 text-4xl font-black">
              Payment Requests
            </h1>

            <p className="mt-3 text-white/50">
              Review manual payment submissions.
            </p>
          </div>

          <button
            onClick={loadAdminData}
            disabled={loading}
            className="rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* REQUESTS */}
        {requests.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <p className="text-white/50">
              No payment requests found.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {requests.map((request) => {
              const plan = getPlan(request.plan_id);
              const processing = processingId === request.id;

              return (
                <div
                  key={request.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <div className="grid gap-6 md:grid-cols-4">
                    {/* USER */}
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/30">
                        User ID
                      </p>

                      <p className="mt-2 break-all text-sm text-white/70">
                        {request.user_id}
                      </p>
                    </div>

                    {/* PLAN */}
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/30">
                        Plan
                      </p>

                      <p className="mt-2 font-semibold">
                        {plan?.name || "Unknown Plan"}
                      </p>

                      <p className="text-sm text-white/50">
                        ₹{plan?.price ?? "-"} •{" "}
                        {plan?.duration_days ?? "-"} days
                      </p>
                    </div>

                    {/* UTR */}
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/30">
                        UTR
                      </p>

                      <p className="mt-2 break-all font-mono text-sm">
                        {request.utr}
                      </p>
                    </div>

                    {/* STATUS */}
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/30">
                        Status
                      </p>

                      <span
                        className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${
                          request.status === "pending"
                            ? "bg-yellow-400/10 text-yellow-300"
                            : request.status === "approved"
                              ? "bg-green-400/10 text-green-300"
                              : "bg-red-400/10 text-red-300"
                        }`}
                      >
                        {request.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* SCREENSHOT */}
                  {request.screenshot_url && (
                    <div className="mt-6 border-t border-white/10 pt-5">
                      <p className="text-xs uppercase tracking-wider text-white/30">
                        Payment Screenshot
                      </p>

                      <a
                        href={request.screenshot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
                      >
                        View Screenshot →
                      </a>
                    </div>
                  )}

                  {/* DATE */}
                  <div className="mt-6 border-t border-white/10 pt-5">
                    <p className="text-xs text-white/30">
                      Submitted:{" "}
                      {new Date(
                        request.created_at
                      ).toLocaleString("en-IN")}
                    </p>

                    {request.reviewed_at && (
                      <p className="mt-1 text-xs text-white/25">
                        Reviewed:{" "}
                        {new Date(
                          request.reviewed_at
                        ).toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>

                  {/* BUTTONS */}
                  {request.status === "pending" && (
                    <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row">
                      <button
                        onClick={() =>
                          approvePayment(request.id)
                        }
                        disabled={processing}
                        className="rounded-full bg-green-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {processing
                          ? "Processing..."
                          : "✓ Approve Payment"}
                      </button>

                      <button
                        onClick={() =>
                          rejectPayment(request.id)
                        }
                        disabled={processing}
                        className="rounded-full border border-red-500/30 bg-red-500/10 px-6 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {processing
                          ? "Processing..."
                          : "✕ Reject Payment"}
                      </button>
                    </div>
                  )}

                  {/* APPROVED INFO */}
                  {request.status === "approved" && (
                    <div className="mt-5 rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">
                      <div>
                        ✓ Payment approved and subscription created.
                      </div>

                      {request.approved_at && (
                        <div className="mt-1 text-xs text-green-300/60">
                          Approved:{" "}
                          {new Date(
                            request.approved_at
                          ).toLocaleString("en-IN")}
                        </div>
                      )}
                    </div>
                  )}

                  {/* REJECTED INFO */}
                  {request.status === "rejected" && (
                    <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                      <div>
                        ✕ Payment rejected.
                      </div>

                      {request.admin_note && (
                        <div className="mt-1 text-red-300/70">
                          Reason: {request.admin_note}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}