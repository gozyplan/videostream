"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type PaymentRequest = {
  id: number;
  user_id: string;
  plan_id: number;
  utr: string;
  screenshot_url: string | null;
  status: string;
  created_at: string;
  plans?: {
    name: string;
    price: number;
    duration_days: number;
  } | {
    name: string;
    price: number;
    duration_days: number;
  }[] | null;
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPayments();
  }, []);

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

    const { data, error: paymentError } = await supabase
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
      .order("created_at", { ascending: false });

    if (paymentError) {
      console.error(paymentError);
      setError(paymentError.message);
      setLoading(false);
      return;
    }

    setPayments((data || []) as unknown as PaymentRequest[]);
    setLoading(false);
  }

  function getPlan(payment: PaymentRequest) {
    if (!payment.plans) return null;

    if (Array.isArray(payment.plans)) {
      return payment.plans[0] || null;
    }

    return payment.plans;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
        Loading payments...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080808] px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-4xl font-black">
          Admin Payments
        </h1>

        <p className="mt-2 text-white/40">
          Manage customer payment requests.
        </p>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-300">
            {error}
          </div>
        )}

        <div className="mt-10 space-y-4">
          {payments.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-white/40">
              No payment requests found.
            </div>
          ) : (
            payments.map((payment) => {
              const plan = getPlan(payment);

              return (
                <div
                  key={payment.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                >
                  <div className="grid gap-5 md:grid-cols-5">
                    <div>
                      <p className="text-xs text-white/30">
                        User ID
                      </p>

                      <p className="mt-2 break-all text-sm">
                        {payment.user_id}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-white/30">
                        Plan
                      </p>

                      <p className="mt-2 font-semibold">
                        {plan?.name ||
                          `Plan #${payment.plan_id}`}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-white/30">
                        Amount
                      </p>

                      <p className="mt-2 font-bold">
                        ₹{plan?.price ?? "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-white/30">
                        UTR
                      </p>

                      <p className="mt-2 break-all text-sm">
                        {payment.utr}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-white/30">
                        Status
                      </p>

                      <p className="mt-2 font-semibold uppercase">
                        {payment.status}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-white/10 pt-5">
                    <p className="text-xs text-white/30">
                      Submitted:{" "}
                      {new Date(
                        payment.created_at
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}