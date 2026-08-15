"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setMessage("");

    // ================================
    // VALIDATION
    // ================================

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      // ================================
      // SAVE SELECTED PLAN
      // ================================

      const selectedPlanId =
        planId || localStorage.getItem("pending_plan_id");

      if (selectedPlanId) {
        localStorage.setItem(
          "pending_plan_id",
          selectedPlanId
        );
      }

      // ================================
      // CREATE SUPABASE ACCOUNT
      // ================================

      const { data, error: signUpError } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

      // ================================
      // SIGNUP ERROR
      // ================================

      if (signUpError) {
        console.error("Signup error:", signUpError);

        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // ================================
      // USER CHECK
      // ================================

      if (!data.user) {
        setError(
          "Account create nahi ho paya. Please try again."
        );

        setLoading(false);
        return;
      }

      // ================================
      // EMAIL VERIFICATION
      // ================================

      if (!data.session) {
        setMessage(
          "Account create ho gaya. Please apni email verify karein."
        );

        setLoading(false);
        return;
      }

      // ================================
      // SUCCESS
      // ================================

      setMessage("Account successfully create ho gaya.");

      // ================================
      // REDIRECT
      // ================================

      setTimeout(() => {
        if (selectedPlanId) {
          window.location.href = `/?plan=${selectedPlanId}`;
        } else {
          window.location.href = "/";
        }
      }, 500);
    } catch (err: any) {
      console.error("Register error:", err);

      setError(
        err?.message ||
          "Account create nahi ho paya. Please try again."
      );

      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      {/* ================================
          BACKGROUND
      ================================= */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-white/[0.05] blur-[120px]" />

        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-blue-500/[0.03] blur-[120px]" />
      </div>

      {/* ================================
          NAVBAR
      ================================= */}

      <nav className="relative z-10 border-b border-white/10 bg-[#070707]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <a
            href="/"
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-black text-black">
              V
            </div>

            <div>
              <div className="text-lg font-bold">
                VideoStream
              </div>

              <div className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Premium
              </div>
            </div>
          </a>

          <a
            href={
              planId
                ? `/auth/login?plan=${planId}`
                : "/auth/login"
            }
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/[0.05]"
          >
            Login
          </a>
        </div>
      </nav>

      {/* ================================
          REGISTER SECTION
      ================================= */}

      <section className="relative z-10 flex min-h-[calc(100vh-80px)] items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">

          {/* ================================
              HEADER
          ================================= */}

          <div className="mb-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-black text-black shadow-2xl">
              V
            </div>

            <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">
              Create your account
            </h1>

            <p className="mt-3 text-sm leading-6 text-white/45">
              Create an account to access premium videos.
            </p>
          </div>

          {/* ================================
              FORM CARD
          ================================= */}

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl backdrop-blur-xl sm:p-8">

            <form
              onSubmit={handleRegister}
              className="space-y-5"
            >

              {/* EMAIL */}

              <div>
                <label
                  htmlFor="email"
                  className="text-sm font-semibold text-white/80"
                >
                  Email / Gmail
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="you@gmail.com"
                  autoComplete="email"
                  disabled={loading}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* PASSWORD */}

              <div>
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-white/80"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                  disabled={loading}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
                />

                <p className="mt-2 text-xs text-white/30">
                  Password kam se kam 6 characters ka hona chahiye.
                </p>
              </div>

              {/* CONFIRM PASSWORD */}

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-semibold text-white/80"
                >
                  Confirm Password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  placeholder="Enter password again"
                  autoComplete="new-password"
                  disabled={loading}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* ERROR */}

              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                  <p className="text-sm leading-6 text-red-300">
                    {error}
                  </p>
                </div>
              )}

              {/* SUCCESS */}

              {message && (
                <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
                  <p className="text-sm leading-6 text-green-300">
                    {message}
                  </p>
                </div>
              )}

              {/* CREATE ACCOUNT */}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-white py-4 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Creating Account..."
                  : "Create Account"}
              </button>
            </form>

            {/* LOGIN */}

            <div className="mt-7 border-t border-white/10 pt-6 text-center">
              <p className="text-sm text-white/40">
                Already have an account?
              </p>

              <a
                href={
                  planId
                    ? `/auth/login?plan=${planId}`
                    : "/auth/login"
                }
                className="mt-2 inline-block text-sm font-semibold text-white hover:underline"
              >
                Login to your account →
              </a>
            </div>
          </div>

          {/* FOOTER */}

          <div className="mt-7 text-center">
            <p className="text-xs leading-5 text-white/25">
              By creating an account, you agree to our
              Terms of Service and Privacy Policy.
            </p>

            <a
              href="/"
              className="mt-4 inline-block text-xs text-white/35 hover:text-white"
            >
              ← Back to VideoStream
            </a>
          </div>

        </div>
      </section>
    </main>
  );
}