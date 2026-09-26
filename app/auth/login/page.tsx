"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function HDLinkLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const cleanEmail = email.trim();

      if (!cleanEmail) {
        setError("Please enter your email.");
        setLoading(false);
        return;
      }

      if (!password) {
        setError("Please enter your password.");
        setLoading(false);
        return;
      }

      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError) {
        console.error(
          "HDLink login error:",
          loginError
        );

        setError(
          loginError.message ||
            "Invalid email or password."
        );

        setLoading(false);
        return;
      }

      /*
       * Keep the selected plan after login.
       * Example:
       * /auth/login?plan=2
       * becomes:
       * /?plan=2
       */
      const params = new URLSearchParams(
        window.location.search
      );

      const plan = params.get("plan");

      if (plan) {
        window.location.replace(
          `/?plan=${encodeURIComponent(plan)}`
        );
      } else {
        window.location.replace("/");
      }
    } catch (error) {
      console.error(
        "HDLink login error:",
        error
      );

      setError(
        "Login failed. Please try again."
      );

      setLoading(false);
    }
  }

  function handleRegister() {
    if (loading) return;

    const params = new URLSearchParams(
      window.location.search
    );

    const plan = params.get("plan");

    if (plan) {
      window.location.href =
        `/auth/register?plan=${encodeURIComponent(
          plan
        )}`;
    } else {
      window.location.href =
        "/auth/register";
    }
  }

  function handleBack() {
    if (loading) return;

    window.location.href = "/";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-5 py-10 text-white">

      <div className="w-full max-w-md">

        {/* LOGO / HEADER */}
        <div className="mb-8 text-center">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-black shadow-xl">
            H
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-tight">
            Welcome to HDLink
          </h1>

          <p className="mt-2 text-sm text-white/40">
            Login to continue to HDLink Premium
          </p>

        </div>

        {/* LOGIN CARD */}
        <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 shadow-2xl sm:p-8">

          <form onSubmit={handleLogin}>

            {/* EMAIL */}
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold text-white/70"
            >
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="Enter your email"
              autoComplete="email"
              required
              disabled={loading}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/20 transition focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
            />

            {/* PASSWORD */}
            <label
              htmlFor="password"
              className="mb-2 mt-5 block text-sm font-semibold text-white/70"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              disabled={loading}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/20 transition focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
            />

            {/* ERROR */}
            {error && (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-6 text-red-300">
                {error}
              </div>
            )}

            {/* LOGIN BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-full bg-white px-5 py-4 text-sm font-black text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Logging in..."
                : "Login →"}
            </button>

          </form>

          {/* OR */}
          <div className="my-6 flex items-center gap-3">

            <div className="h-px flex-1 bg-white/10" />

            <span className="text-xs text-white/25">
              OR
            </span>

            <div className="h-px flex-1 bg-white/10" />

          </div>

          {/* CREATE ACCOUNT */}
          <button
            type="button"
            onClick={handleRegister}
            disabled={loading}
            className="w-full rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create New Account
          </button>

          {/* BACK TO HOME */}
          <button
            type="button"
            onClick={handleBack}
            disabled={loading}
            className="mt-4 w-full text-center text-xs text-white/30 transition hover:text-white disabled:opacity-50"
          >
            ← Back to HDLink
          </button>

        </div>

        {/* FOOTER */}
        <div className="mt-6 text-center text-[10px] text-white/20">
          HDLink VIP Premium • Secure Account Access
        </div>

      </div>

    </main>
  );
}