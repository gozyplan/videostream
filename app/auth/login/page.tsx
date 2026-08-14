"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function checkSubscriptionAndRedirect(userId: string) {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, status, starts_at, expires_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", now)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Subscription check error:", error);
      setMessage("Subscription check नहीं हो पाया। Please try again.");
      setLoading(false);
      return;
    }

    if (data) {
      // Active subscription → full premium library
      window.location.href = "/premium";
    } else {
      // No active subscription → plans
      window.location.href = "/#plans";
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      /*
       * =========================
       * SIGNUP
       * =========================
       */
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          setMessage(error.message);
          setLoading(false);
          return;
        }

        /*
         * Agar email confirmation OFF hai,
         * Supabase session turant dega.
         */
        if (data.session && data.user) {
          await checkSubscriptionAndRedirect(data.user.id);
          return;
        }

        /*
         * Agar email confirmation ON hai,
         * session nahi milega.
         */
        setMessage(
          "Account create हो गया। Email verification complete करके login करें।"
        );

        setLoading(false);
        return;
      }

      /*
       * =========================
       * LOGIN
       * =========================
       */
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        setMessage("Login failed. Please try again.");
        setLoading(false);
        return;
      }

      /*
       * Login successful.
       * अब subscription check होगा.
       */
      await checkSubscriptionAndRedirect(data.user.id);
    } catch (error: any) {
      console.error(error);

      setMessage(
        error?.message || "Something went wrong."
      );

      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080808] px-5 text-white">
      <div className="w-full max-w-md">

        {/* LOGO */}
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-black">
            V
          </div>

          <h1 className="mt-5 text-3xl font-bold">
            {isSignup
              ? "Create your account"
              : "Welcome back"}
          </h1>

          <p className="mt-2 text-sm text-white/40">
            {isSignup
              ? "Create an account to access premium videos."
              : "Login to continue watching premium videos."}
          </p>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/10 bg-white/[0.04] p-7"
        >

          {/* EMAIL */}
          <label className="text-sm text-white/60">
            Email
          </label>

          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm outline-none placeholder:text-white/25 focus:border-white/30"
          />

          {/* PASSWORD */}
          <label className="mt-5 block text-sm text-white/60">
            Password
          </label>

          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={
              isSignup
                ? "new-password"
                : "current-password"
            }
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm outline-none placeholder:text-white/25 focus:border-white/30"
          />

          {/* BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-white py-3.5 text-sm font-bold text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : isSignup
                ? "Create Account"
                : "Login"}
          </button>

          {/* MESSAGE */}
          {message && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center text-sm text-white/70">
              {message}
            </div>
          )}

          {/* SWITCH LOGIN / SIGNUP */}
          <div className="mt-6 text-center text-sm text-white/40">
            {isSignup
              ? "Already have an account?"
              : "Don't have an account?"}

            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setMessage("");
              }}
              className="ml-2 font-semibold text-white hover:underline"
            >
              {isSignup
                ? "Login"
                : "Create account"}
            </button>
          </div>
        </form>

        {/* BACK */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm text-white/40 hover:text-white"
          >
            ← Back to home
          </a>
        </div>

      </div>
    </main>
  );
}