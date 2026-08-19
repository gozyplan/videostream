"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlPlanId = searchParams.get("plan");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checkingUser, setCheckingUser] = useState(true);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ============================================================
  // CHECK EXISTING SESSION
  // ============================================================

  useEffect(() => {
    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          if (urlPlanId) {
            localStorage.setItem(
              "pending_plan_id",
              urlPlanId
            );

            router.replace(
              `/premium?plan=${encodeURIComponent(
                urlPlanId
              )}`
            );
          } else {
            router.replace("/premium");
          }

          return;
        }
      } catch (err) {
        console.error(
          "Session check error:",
          err
        );
      } finally {
        setCheckingUser(false);
      }
    }

    checkSession();
  }, [router, urlPlanId]);

  // ============================================================
  // LOGIN
  // ============================================================

  async function handleLogin(
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
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      // --------------------------------------------------------
      // SAVE SELECTED PLAN
      // --------------------------------------------------------

      if (urlPlanId) {
        localStorage.setItem(
          "pending_plan_id",
          urlPlanId
        );
      }

      // --------------------------------------------------------
      // SUPABASE LOGIN
      // --------------------------------------------------------

      const {
        data,
        error: loginError,
      } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (loginError) {
        console.error(
          "Gozy login error:",
          loginError
        );

        setError(
          loginError.message ||
            "Invalid email or password."
        );

        return;
      }

      if (!data.user) {
        setError(
          "Login failed. Please try again."
        );

        return;
      }

      // --------------------------------------------------------
      // LOGIN SUCCESS
      // --------------------------------------------------------

      setMessage("Login successful. Redirecting...");

      if (urlPlanId) {
        router.replace(
          `/premium?plan=${encodeURIComponent(
            urlPlanId
          )}`
        );
      } else {
        router.replace("/premium");
      }
    } catch (err) {
      console.error(
        "Login unexpected error:",
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
  // CREATE ACCOUNT
  // ============================================================

  function goToRegister() {
    setError("");

    if (urlPlanId) {
      localStorage.setItem(
        "pending_plan_id",
        urlPlanId
      );

      window.location.href =
        `/auth/register?plan=${encodeURIComponent(
          urlPlanId
        )}`;

      return;
    }

    window.location.href =
      "/auth/register";
  }

  // ============================================================
  // BACK TO HOME
  // ============================================================

  function goBack() {
    if (urlPlanId) {
      window.location.href =
        `/?plan=${encodeURIComponent(
          urlPlanId
        )}`;

      return;
    }

    window.location.href = "/";
  }

  // ============================================================
  // FORGOT PASSWORD
  // ============================================================

  async function handleForgotPassword() {
    setError("");
    setMessage("");

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError(
        "Please enter your email first."
      );
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo:
              `${window.location.origin}/auth/reset-password`,
          }
        );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setMessage(
        "Password reset link has been sent to your email."
      );
    } catch (err) {
      console.error(
        "Password reset error:",
        err
      );

      setError(
        "Unable to send password reset email."
      );
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (checkingUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-black">
            G
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
    <main className="min-h-screen overflow-hidden bg-[#080808] px-5 py-10 text-white">

      {/* BACKGROUND */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">

        <div className="absolute left-1/2 top-[-300px] h-[700px] w-[900px] -translate-x-1/2 rounded-full bg-white/[0.06] blur-[160px]" />

        <div className="absolute right-[-250px] top-[300px] h-[500px] w-[500px] rounded-full bg-white/[0.025] blur-[140px]" />

        <div className="absolute bottom-[-250px] left-[-200px] h-[500px] w-[500px] rounded-full bg-white/[0.02] blur-[140px]" />

      </div>

      <div className="relative mx-auto flex min-h-[90vh] max-w-md items-center justify-center">

        <div className="w-full">

          {/* ================================================== */}
          {/* LOGO */}
          {/* ================================================== */}

          <div className="mb-8 text-center">

            <button
              type="button"
              onClick={goBack}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-2xl font-black text-black shadow-2xl transition hover:scale-105"
            >
              G
            </button>

            <div className="mt-5 text-2xl font-black tracking-tight">
              Gozy
            </div>

            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/30">
              Premium Streaming
            </div>

          </div>

          {/* ================================================== */}
          {/* LOGIN CARD */}
          {/* ================================================== */}

          <div className="rounded-[32px] border border-white/10 bg-white/[0.035] p-6 shadow-2xl sm:p-8">

            {/* TITLE */}

            <div>
              <h1 className="text-3xl font-black tracking-tight">
                Welcome back
              </h1>

              <p className="mt-2 text-sm leading-6 text-white/40">
                Login to continue watching
                premium videos on Gozy.
              </p>
            </div>

            {/* PLAN MESSAGE */}

            {urlPlanId && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-black">
                  ✓
                </div>

                <div>
                  <div className="text-sm font-bold text-white/90">
                    Plan selected
                  </div>

                  <div className="mt-0.5 text-xs text-white/35">
                    Your selected plan will
                    continue after login.
                  </div>
                </div>

              </div>
            )}

            {/* ================================================= */}
            {/* FORM */}
            {/* ================================================= */}

            <form
              onSubmit={handleLogin}
              className="mt-7"
            >

              {/* EMAIL */}

              <label
                htmlFor="login-email"
                className="mb-2 block text-sm font-semibold text-white/70"
              >
                Email
              </label>

              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="you@gmail.com"
                disabled={loading}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-4 text-sm text-white outline-none placeholder:text-white/20 transition focus:border-white/30 focus:bg-white/[0.02] disabled:opacity-50"
              />

              {/* PASSWORD */}

              <label
                htmlFor="login-password"
                className="mb-2 mt-5 block text-sm font-semibold text-white/70"
              >
                Password
              </label>

              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Enter your password"
                disabled={loading}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-4 text-sm text-white outline-none placeholder:text-white/20 transition focus:border-white/30 focus:bg-white/[0.02] disabled:opacity-50"
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

              {/* LOGIN BUTTON */}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full rounded-full bg-white px-5 py-4 text-sm font-black text-black shadow-xl transition hover:bg-white/90 hover:shadow-2xl active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Logging in..."
                  : "Login →"}
              </button>

            </form>

            {/* FORGOT PASSWORD */}

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              className="mt-5 w-full text-center text-xs font-semibold text-white/35 transition hover:text-white/70 disabled:opacity-50"
            >
              Forgot password?
            </button>

            {/* DIVIDER */}

            <div className="my-7 flex items-center gap-4">

              <div className="h-px flex-1 bg-white/10" />

              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
                OR
              </span>

              <div className="h-px flex-1 bg-white/10" />

            </div>

            {/* REGISTER */}

            <div className="text-center">

              <span className="text-sm text-white/35">
                Don&apos;t have an account?
              </span>

              <button
                type="button"
                onClick={goToRegister}
                className="ml-2 text-sm font-black text-white transition hover:text-white/60"
              >
                Create account →
              </button>

            </div>

          </div>

          {/* ================================================== */}
          {/* BACK */}
          {/* ================================================== */}

          <button
            type="button"
            onClick={goBack}
            className="mx-auto mt-7 block text-xs font-semibold text-white/30 transition hover:text-white/70"
          >
            ← Back to Gozy
          </button>

          {/* ================================================== */}
          {/* FOOTER */}
          {/* ================================================== */}

          <div className="mt-8 text-center text-[10px] uppercase tracking-[0.2em] text-white/15">
            Gozy • Premium Streaming
          </div>

        </div>

      </div>

    </main>
  );
}

// ============================================================
// SUSPENSE
// ============================================================

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
          <div className="text-center">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-black">
              G
            </div>

            <div className="mx-auto mt-5 h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-white" />

            <p className="mt-4 text-sm text-white/40">
              Loading...
            </p>

          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}