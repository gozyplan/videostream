"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isHDLink = searchParams.get("hdlink") === "1";
  const urlPlanId = searchParams.get("plan");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [planId, setPlanId] = useState<string | null>(
    null
  );

  const [loading, setLoading] = useState(false);
  const [checkingUser, setCheckingUser] = useState(true);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ============================================================
  // RESTORE HDLINK PLAN
  // ============================================================

  useEffect(() => {
    if (!isHDLink) {
      setCheckingUser(false);
      return;
    }

    const savedPlan =
      urlPlanId ||
      localStorage.getItem(
        "hdlink_pending_plan_id"
      );

    if (savedPlan) {
      setPlanId(savedPlan);

      localStorage.setItem(
        "hdlink_pending_plan_id",
        savedPlan
      );
    }

    setCheckingUser(false);
  }, [isHDLink, urlPlanId]);

  // ============================================================
  // CHECK EXISTING SESSION
  // ============================================================

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const savedPlan =
          urlPlanId ||
          localStorage.getItem(
            "hdlink_pending_plan_id"
          );

        if (isHDLink && savedPlan) {
          router.replace(
            `/hdlink?plan=${encodeURIComponent(
              savedPlan
            )}`
          );
        } else {
          router.replace("/premium");
        }

        return;
      }

      setCheckingUser(false);
    }

    checkSession();
  }, [router, isHDLink, urlPlanId]);

  // ============================================================
  // CREATE ACCOUNT
  // ============================================================

  async function handleRegister(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

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

    setLoading(true);

    try {
      // --------------------------------------------------------
      // SAVE PLAN
      // --------------------------------------------------------

      let selectedPlanId =
        urlPlanId ||
        planId ||
        localStorage.getItem(
          "hdlink_pending_plan_id"
        );

      if (isHDLink && selectedPlanId) {
        localStorage.setItem(
          "hdlink_pending_plan_id",
          selectedPlanId
        );
      }

      // --------------------------------------------------------
      // CREATE USER
      // --------------------------------------------------------

      const {
        data,
        error: registerError,
      } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (registerError) {
        console.error(
          "HDLink register error:",
          registerError
        );

        setError(
          registerError.message ||
            "Account could not be created."
        );

        return;
      }

      // --------------------------------------------------------
      // IMPORTANT:
      // If Supabase immediately returns a session,
      // user can continue directly.
      // --------------------------------------------------------

      if (data.session?.user) {
        if (isHDLink && selectedPlanId) {
          router.replace(
            `/hdlink?plan=${encodeURIComponent(
              selectedPlanId
            )}`
          );

          return;
        }

        router.replace("/premium");
        return;
      }

      // --------------------------------------------------------
      // EMAIL CONFIRMATION REQUIRED
      // --------------------------------------------------------

      setMessage(
        "Account created successfully. Please check your email and confirm your account before logging in."
      );
    } catch (err) {
      console.error(
        "Register unexpected error:",
        err
      );

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // LOGIN
  // ============================================================

  function goToLogin() {
    setError("");

    const selectedPlanId =
      urlPlanId ||
      planId ||
      localStorage.getItem(
        "hdlink_pending_plan_id"
      );

    if (isHDLink && selectedPlanId) {
      localStorage.setItem(
        "hdlink_pending_plan_id",
        selectedPlanId
      );

      window.location.href =
        `/auth/login?hdlink=1&plan=${encodeURIComponent(
          selectedPlanId
        )}`;

      return;
    }

    window.location.href =
      "/auth/login";
  }

  // ============================================================
  // BACK
  // ============================================================

  function goBack() {
    const selectedPlanId =
      urlPlanId ||
      planId ||
      localStorage.getItem(
        "hdlink_pending_plan_id"
      );

    if (isHDLink && selectedPlanId) {
      window.location.href =
        `/hdlink?plan=${encodeURIComponent(
          selectedPlanId
        )}`;

      return;
    }

    window.location.href = "/hdlink";
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (checkingUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-black">
            H
          </div>

          <div className="mx-auto mt-5 h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-white" />

          <p className="mt-4 text-sm text-white/40">
            Loading...
          </p>
        </div>
      </main>
    );
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <main className="min-h-screen bg-[#050505] px-5 py-10 text-white">
      <div className="mx-auto flex min-h-[90vh] max-w-md items-center justify-center">
        <div className="w-full">

          {/* LOGO */}

          <div className="mb-8 text-center">
            <button
              type="button"
              onClick={goBack}
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-black shadow-2xl"
            >
              H
            </button>

            <div className="mt-4 text-xl font-black">
              HDLink
            </div>

            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/30">
              Premium Streaming
            </div>
          </div>

          {/* CARD */}

          <div className="rounded-[30px] border border-white/10 bg-white/[0.035] p-6 shadow-2xl sm:p-8">

            <div>
              <h1 className="text-3xl font-black tracking-tight">
                Create your account
              </h1>

              <p className="mt-2 text-sm leading-6 text-white/40">
                {isHDLink
                  ? "Create an account to continue with your HDLink plan."
                  : "Create your account to continue."}
              </p>
            </div>

            {/* HDLINK SAVED MESSAGE */}

            {isHDLink && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-black">
                  ✓
                </div>

                <div>
                  <div className="text-sm font-bold text-white/90">
                    HDLink plan saved
                  </div>

                  <div className="mt-0.5 text-xs text-white/35">
                    Your selected plan will continue after account creation.
                  </div>
                </div>
              </div>
            )}

            {/* FORM */}

            <form
              onSubmit={handleRegister}
              className="mt-7"
            >
              {/* EMAIL */}

              <label
                htmlFor="register-email"
                className="mb-2 block text-sm font-semibold text-white/70"
              >
                Email / Gmail
              </label>

              <input
                id="register-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="you@gmail.com"
                disabled={loading}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30 disabled:opacity-50"
              />

              {/* PASSWORD */}

              <label
                htmlFor="register-password"
                className="mb-2 mt-5 block text-sm font-semibold text-white/70"
              >
                Password
              </label>

              <input
                id="register-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Create a password"
                disabled={loading}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30 disabled:opacity-50"
              />

              {/* CONFIRM PASSWORD */}

              <label
                htmlFor="register-confirm-password"
                className="mb-2 mt-5 block text-sm font-semibold text-white/70"
              >
                Confirm Password
              </label>

              <input
                id="register-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(
                    e.target.value
                  )
                }
                placeholder="Repeat your password"
                disabled={loading}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30 disabled:opacity-50"
              />

              {/* ERROR */}

              {error && (
                <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-6 text-red-300">
                  {error}
                </div>
              )}

              {/* SUCCESS */}

              {message && (
                <div className="mt-5 rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm leading-6 text-green-300">
                  {message}
                </div>
              )}

              {/* CREATE ACCOUNT */}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full rounded-full bg-white px-5 py-4 text-sm font-black text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Creating Account..."
                  : "Create Account"}
              </button>
            </form>

            {/* LOGIN */}

            <div className="mt-7 border-t border-white/10 pt-6 text-center">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
                Already have an account?
              </div>

              <button
                type="button"
                onClick={goToLogin}
                className="mt-3 text-sm font-black text-white transition hover:text-white/70"
              >
                Login →
              </button>
            </div>

          </div>

          {/* BACK */}

          <button
            type="button"
            onClick={goBack}
            className="mx-auto mt-7 block text-xs font-semibold text-white/30 transition hover:text-white/70"
          >
            ← Back to HDLink
          </button>

        </div>
      </div>
    </main>
  );
}

// ============================================================
// SUSPENSE
// ============================================================

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-black">
              H
            </div>

            <div className="mx-auto mt-5 h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-white" />

            <p className="mt-4 text-sm text-white/40">
              Loading...
            </p>
          </div>
        </main>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}