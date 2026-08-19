"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HDLinkRegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [planId, setPlanId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan");

    setPlanId(plan);

    if (plan) {
      localStorage.setItem(
        "hdlink_pending_plan_id",
        plan
      );
    }
  }, []);

  async function handleRegister(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError("");
    setSuccess("");

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
      const { data, error: signUpError } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (!data.user) {
        setError(
          "Account could not be created. Please try again."
        );
        return;
      }

      /*
       * If Supabase email confirmation is enabled,
       * session can be null after registration.
       */

      if (!data.session) {
        setSuccess(
          "Account created successfully. Please check your email and verify your account."
        );

        return;
      }

      if (planId) {
        localStorage.setItem(
          "hdlink_pending_plan_id",
          planId
        );

        window.location.href =
          `/hdlink?plan=${encodeURIComponent(planId)}`;
      } else {
        router.replace("/hdlink");
      }
    } catch (err) {
      console.error(
        "HDLink registration error:",
        err
      );

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function goToLogin() {
    if (planId) {
      window.location.href =
        `/hdlink/auth/login?plan=${encodeURIComponent(
          planId
        )}`;
    } else {
      router.push("/hdlink/auth/login");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-5 py-10 text-white">

      <div className="w-full max-w-md">

        {/* LOGO */}

        <div className="mb-8 text-center">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-black shadow-xl">
            H
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-tight">
            Create your HDLink account
          </h1>

          <p className="mt-2 text-sm text-white/40">
            Create an account to continue to Premium
          </p>

        </div>

        {/* CARD */}

        <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 shadow-2xl sm:p-8">

          {planId && (
            <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">

              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                Selected Plan
              </div>

              <div className="mt-2 text-sm font-bold text-white/80">
                HDLink Premium Plan
              </div>

              <div className="mt-1 text-xs text-white/35">
                Your selected plan will be restored after registration.
              </div>

            </div>
          )}

          <form onSubmit={handleRegister}>

            {/* EMAIL */}

            <label
              htmlFor="hdlink-email"
              className="mb-2 block text-sm font-semibold text-white/70"
            >
              Email
            </label>

            <input
              id="hdlink-email"
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="Enter your email"
              required
              disabled={loading}
              autoComplete="email"
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/20 transition focus:border-white/30 disabled:opacity-50"
            />

            {/* PASSWORD */}

            <label
              htmlFor="hdlink-password"
              className="mb-2 mt-5 block text-sm font-semibold text-white/70"
            >
              Password
            </label>

            <input
              id="hdlink-password"
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Create a password"
              required
              disabled={loading}
              autoComplete="new-password"
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/20 transition focus:border-white/30 disabled:opacity-50"
            />

            <p className="mt-2 text-[11px] text-white/25">
              Password must contain at least 6 characters.
            </p>

            {/* CONFIRM PASSWORD */}

            <label
              htmlFor="hdlink-confirm-password"
              className="mb-2 mt-5 block text-sm font-semibold text-white/70"
            >
              Confirm Password
            </label>

            <input
              id="hdlink-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(
                  e.target.value
                )
              }
              placeholder="Confirm your password"
              required
              disabled={loading}
              autoComplete="new-password"
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/20 transition focus:border-white/30 disabled:opacity-50"
            />

            {/* ERROR */}

            {error && (
              <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-6 text-red-300">
                {error}
              </div>
            )}

            {/* SUCCESS */}

            {success && (
              <div className="mt-5 rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm leading-6 text-green-300">
                {success}

                <button
                  type="button"
                  onClick={goToLogin}
                  className="mt-4 block w-full rounded-full bg-white px-4 py-3 text-xs font-black text-black"
                >
                  Go to Login
                </button>
              </div>
            )}

            {/* SUBMIT */}

            {!success && (
              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full rounded-full bg-white px-5 py-4 text-sm font-black text-black shadow-xl transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Creating Account..."
                  : "Create Account →"}
              </button>
            )}

          </form>

          {/* LOGIN */}

          <div className="my-6 flex items-center gap-3">

            <div className="h-px flex-1 bg-white/10" />

            <span className="text-xs text-white/25">
              ALREADY HAVE AN ACCOUNT?
            </span>

            <div className="h-px flex-1 bg-white/10" />

          </div>

          <button
            type="button"
            onClick={goToLogin}
            className="w-full rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          >
            Login to HDLink
          </button>

          {/* BACK */}

          <button
            type="button"
            onClick={() =>
              router.push("/hdlink")
            }
            className="mt-5 w-full text-center text-xs text-white/30 transition hover:text-white"
          >
            ← Back to HDLink
          </button>

        </div>

        {/* FOOTER */}

        <div className="mt-6 text-center text-[11px] text-white/20">
          HDLink Premium • Secure account access
        </div>

      </div>

    </main>
  );
}