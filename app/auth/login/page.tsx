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

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const hdlink = searchParams.get("hdlink");
  const planFromUrl = searchParams.get("plan");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [savedPlan, setSavedPlan] = useState<string | null>(
    planFromUrl
  );

  // ------------------------------------------------------------
  // SAVE / RESTORE HDLINK PLAN
  // ------------------------------------------------------------

  useEffect(() => {
    if (planFromUrl) {
      localStorage.setItem(
        "hdlink_pending_plan_id",
        planFromUrl
      );

      setSavedPlan(planFromUrl);
      return;
    }

    const localPlan = localStorage.getItem(
      "hdlink_pending_plan_id"
    );

    if (localPlan) {
      setSavedPlan(localPlan);
    }
  }, [planFromUrl]);

  // ------------------------------------------------------------
  // LOGIN
  // ------------------------------------------------------------

  async function handleLogin(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError("");
    setMessage("");
    setLoading(true);

    try {
      const cleanEmail = email.trim();

      if (!cleanEmail) {
        setError("Please enter your email.");
        return;
      }

      if (!password) {
        setError("Please enter your password.");
        return;
      }

      const {
        data,
        error: loginError,
      } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (loginError) {
        console.error("Login error:", loginError);

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
      // HDLINK FLOW
      // --------------------------------------------------------

      if (hdlink === "1") {
        let planId =
          planFromUrl ||
          localStorage.getItem(
            "hdlink_pending_plan_id"
          );

        if (planId) {
          localStorage.setItem(
            "hdlink_pending_plan_id",
            planId
          );

          // Force full navigation so Supabase session
          // is completely available on HDLink page.
          window.location.href =
            `/hdlink?plan=${encodeURIComponent(
              planId
            )}`;

          return;
        }

        window.location.href = "/hdlink";
        return;
      }

      // Normal login
      window.location.href = "/";
    } catch (err) {
      console.error("Unexpected login error:", err);

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------------------
  // CREATE ACCOUNT
  // ------------------------------------------------------------

  function handleCreateAccount() {
    let planId =
      planFromUrl ||
      localStorage.getItem(
        "hdlink_pending_plan_id"
      );

    if (planId) {
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

    if (hdlink === "1") {
      window.location.href =
        "/auth/register?hdlink=1";

      return;
    }

    window.location.href =
      "/auth/register";
  }

  // ------------------------------------------------------------
  // FORGOT PASSWORD
  // ------------------------------------------------------------

  async function handleForgotPassword() {
    setError("");
    setMessage("");

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError(
        "Enter your email first."
      );
      return;
    }

    setLoading(true);

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo:
              `${window.location.origin}/auth/reset-password`,
          }
        );

      if (error) {
        setError(error.message);
        return;
      }

      setMessage(
        "Password reset email sent. Check your inbox."
      );
    } catch (err) {
      console.error(err);

      setError(
        "Could not send password reset email."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-250px] h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-purple-500/[0.08] blur-[150px]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">

          {/* LOGO */}

          <div className="mb-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-black">
              H
            </div>

            <h1 className="mt-5 text-3xl font-black">
              Welcome back
            </h1>

            <p className="mt-2 text-sm text-white/40">
              Login to continue with your selected
              HDLink plan.
            </p>
          </div>

          {/* PLAN INFO */}

          {hdlink === "1" && savedPlan && (
            <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black">
                  ✓
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-white/30">
                    HDLink plan saved
                  </div>

                  <div className="mt-1 text-sm font-semibold text-white/80">
                    Plan #{savedPlan}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CARD */}

          <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 shadow-2xl sm:p-8">

            <form
              onSubmit={handleLogin}
              className="space-y-5"
            >

              {/* EMAIL */}

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-white/70"
                >
                  Email / Gmail
                </label>

                <input
                  id="email"
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
              </div>

              {/* PASSWORD */}

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-white/70"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="Enter your password"
                  disabled={loading}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30 disabled:opacity-50"
                />
              </div>

              {/* ERROR */}

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-6 text-red-300">
                  {error}
                </div>
              )}

              {/* MESSAGE */}

              {message && (
                <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm leading-6 text-green-300">
                  {message}
                </div>
              )}

              {/* LOGIN */}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-white px-5 py-4 text-sm font-black text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Logging in..."
                  : "Login"}
              </button>

            </form>

            {/* FORGOT */}

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              className="mt-5 w-full text-center text-xs font-semibold text-white/40 transition hover:text-white disabled:opacity-50"
            >
              Forgot password?
            </button>

            {/* CREATE ACCOUNT */}

            <div className="my-7 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-white/25">
                OR
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={handleCreateAccount}
              disabled={loading}
              className="w-full rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-bold text-white transition hover:bg-white/[0.08] disabled:opacity-50"
            >
              Don't have an account?
              <span className="ml-1 text-white">
                Create your account →
              </span>
            </button>

          </div>

          {/* BACK */}

          <button
            type="button"
            onClick={() => {
              if (hdlink === "1") {
                window.location.href =
                  "/hdlink";
              } else {
                window.location.href =
                  "/";
              }
            }}
            className="mt-6 w-full text-center text-xs text-white/30 transition hover:text-white"
          >
            ← Back
          </button>

        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white" />
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}