"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import { supabase } from "@/lib/supabase";

type Plan = {
  id: number;
  name: string;
  price: number;
  duration_days: number;
  is_active: boolean;
  source?: string | null;
};

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlPlanId = searchParams.get("plan");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [plan, setPlan] = useState<Plan | null>(null);

  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] =
    useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    initialize();
  }, [urlPlanId]);

  async function initialize() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const savedPlanId =
        urlPlanId ||
        localStorage.getItem(
          "hdlink_pending_plan_id"
        );

      /*
       * Already logged in
       */
      if (session?.user) {
        if (savedPlanId) {
          router.replace(
            `/hdlink?plan=${encodeURIComponent(
              savedPlanId
            )}`
          );
        } else {
          router.replace("/hdlink");
        }

        return;
      }

      /*
       * No plan selected
       */
      if (!savedPlanId) {
        setPlan(null);
        return;
      }

      const numericId = Number(savedPlanId);

      if (!Number.isFinite(numericId)) {
        localStorage.removeItem(
          "hdlink_pending_plan_id"
        );

        setError("Invalid plan selection.");
        return;
      }

      /*
       * Load HDLink plan
       */
      const {
        data,
        error: planError,
      } = await supabase
        .from("plans")
        .select(
          "id,name,price,duration_days,is_active,source"
        )
        .eq("id", numericId)
        .eq("is_active", true)
        .eq("source", "hdlink")
        .maybeSingle();

      if (planError) {
        throw planError;
      }

      if (!data) {
        localStorage.removeItem(
          "hdlink_pending_plan_id"
        );

        setError(
          "Selected HDLink plan is not available."
        );

        return;
      }

      setPlan(data as Plan);

      localStorage.setItem(
        "hdlink_pending_plan_id",
        String(data.id)
      );
    } catch (err: any) {
      console.error(
        "Register initialize error:",
        err
      );

      setError(
        err?.message ||
          "Could not load registration page."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError("Please enter your email.");
      return;
    }

    if (!password) {
      setError("Please enter a password.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const storedPlanId =
      localStorage.getItem(
        "hdlink_pending_plan_id"
      );

    const selectedPlanId =
      plan?.id ||
      (storedPlanId
        ? Number(storedPlanId)
        : NaN);

    if (
      !selectedPlanId ||
      !Number.isFinite(selectedPlanId)
    ) {
      setError(
        "Please select an HDLink plan first."
      );
      return;
    }

    localStorage.setItem(
      "hdlink_pending_plan_id",
      String(selectedPlanId)
    );

    setRegistering(true);

    try {
      const {
        data,
        error: signupError,
      } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (signupError) {
        console.error(
          "Registration error:",
          signupError
        );

        setError(
          signupError.message ||
            "Registration failed."
        );

        return;
      }

      if (!data.user) {
        setError(
          "Account could not be created. Please try again."
        );

        return;
      }

      /*
       * Email confirmation is enabled
       */
      if (!data.session) {
        setMessage(
          "Account created successfully. Please confirm your email, then login to continue."
        );

        return;
      }

      /*
       * Account created and logged in
       */
      router.replace(
        `/hdlink?plan=${encodeURIComponent(
          String(selectedPlanId)
        )}`
      );
    } catch (err: any) {
      console.error(
        "Registration error:",
        err
      );

      setError(
        err?.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setRegistering(false);
    }
  }

  function goBack() {
    const selectedPlanId =
      plan?.id ||
      localStorage.getItem(
        "hdlink_pending_plan_id"
      );

    if (selectedPlanId) {
      router.push(
        `/hdlink?plan=${encodeURIComponent(
          String(selectedPlanId)
        )}`
      );
    } else {
      router.push("/hdlink");
    }
  }

  function goToLogin() {
    const selectedPlanId =
      plan?.id ||
      localStorage.getItem(
        "hdlink_pending_plan_id"
      );

    if (selectedPlanId) {
      router.push(
        `/auth/login?plan=${encodeURIComponent(
          String(selectedPlanId)
        )}`
      );
    } else {
      router.push("/auth/login");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#030303] text-white">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-black">
            H
          </div>

          <div className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white" />

          <p className="mt-4 text-sm text-white/40">
            Loading...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030303] px-5 py-12 text-white">
      {/* Background */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-250px] h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[150px]" />

        <div className="absolute bottom-[-250px] right-[-200px] h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[150px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}

        <button
          type="button"
          onClick={goBack}
          disabled={registering}
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-black shadow-2xl transition hover:scale-105 disabled:cursor-not-allowed"
        >
          H
        </button>

        {/* Brand */}

        <div className="mt-5 text-center">
          <div className="text-2xl font-black">
            HDLink
          </div>

          <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.3em] text-white/30">
            VIP Premium
          </div>
        </div>

        {/* Card */}

        <div className="mt-8 rounded-[35px] border border-white/10 bg-white/[0.035] p-7 shadow-2xl sm:p-9">
          {/* Heading */}

          <div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300/60">
              Create Account
            </div>

            <h1 className="mt-3 text-3xl font-black">
              Join HDLink Premium
            </h1>

            <p className="mt-3 text-sm leading-6 text-white/40">
              Create your secure account to
              continue with your selected
              HDLink premium plan.
            </p>
          </div>

          {/* Selected Plan */}

          {plan && (
            <div className="mt-7 rounded-3xl border border-violet-400/20 bg-violet-400/10 p-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-violet-200/60">
                Selected Plan
              </div>

              <div className="mt-2 flex items-center justify-between gap-4">
                <div>
                  <div className="font-black">
                    {plan.name}
                  </div>

                  <div className="mt-1 text-xs text-white/35">
                    {plan.duration_days} day
                    {plan.duration_days !== 1
                      ? "s"
                      : ""}{" "}
                    HDLink Premium
                  </div>
                </div>

                <div className="text-2xl font-black">
                  ₹{plan.price}
                </div>
              </div>
            </div>
          )}

          {/* No Plan */}

          {!plan && !error && (
            <div className="mt-7 rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-5 text-sm leading-6 text-yellow-200">
              Select an HDLink plan first to
              continue.
            </div>
          )}

          {/* Error */}

          {error && (
            <div className="mt-7 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-6 text-red-300">
              {error}
            </div>
          )}

          {/* Success */}

          {message && (
            <div className="mt-7 rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm leading-6 text-green-300">
              {message}
            </div>
          )}

          {/* Form */}

          <form
            onSubmit={handleRegister}
            className="mt-7 space-y-5"
          >
            {/* Email */}

            <div>
              <label className="text-xs font-bold text-white/50">
                Email Address
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
                autoComplete="email"
                disabled={registering}
                required
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white outline-none placeholder:text-white/20 transition focus:border-white/30 disabled:opacity-50"
              />
            </div>

            {/* Password */}

            <div>
              <label className="text-xs font-bold text-white/50">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
                disabled={registering}
                required
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white outline-none placeholder:text-white/20 transition focus:border-white/30 disabled:opacity-50"
              />
            </div>

            {/* Confirm Password */}

            <div>
              <label className="text-xs font-bold text-white/50">
                Confirm Password
              </label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                placeholder="Enter password again"
                autoComplete="new-password"
                disabled={registering}
                required
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white outline-none placeholder:text-white/20 transition focus:border-white/30 disabled:opacity-50"
              />
            </div>

            {/* Submit */}

            <button
              type="submit"
              disabled={
                registering || !plan
              }
              className="w-full rounded-full bg-white py-4 text-sm font-black text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {registering
                ? "Creating Account..."
                : "Create Account & Continue →"}
            </button>
          </form>

          {/* Security */}

          <div className="mt-6 text-center text-xs text-white/25">
            Secure account-based access •
            Manual payment verification
          </div>
        </div>

        {/* Login */}

        <button
          type="button"
          onClick={goToLogin}
          disabled={registering}
          className="mt-6 w-full text-center text-sm text-white/40 transition hover:text-white disabled:cursor-not-allowed"
        >
          Already have an account?
          <span className="ml-1 font-bold text-white/70">
            Login
          </span>
        </button>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#030303] text-white">
          <div className="text-sm text-white/40">
            Loading...
          </div>
        </main>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
