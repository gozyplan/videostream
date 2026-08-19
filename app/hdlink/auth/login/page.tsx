"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HDLinkLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        setError(loginError.message);
        return;
      }

      const params = new URLSearchParams(
        window.location.search
      );

      const plan = params.get("plan");

      if (plan) {
        window.location.href =
          `/hdlink?plan=${encodeURIComponent(plan)}`;
      } else {
        router.replace("/hdlink");
      }
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-5 text-white">
      <div className="w-full max-w-md">

        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-black">
            H
          </div>

          <h1 className="mt-5 text-3xl font-black">
            Welcome to HDLink
          </h1>

          <p className="mt-2 text-sm text-white/40">
            Login to continue to HDLink Premium
          </p>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 shadow-2xl sm:p-8">

          <form onSubmit={handleLogin}>

            <label className="mb-2 block text-sm font-semibold text-white/70">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30"
            />

            <label className="mb-2 mt-5 block text-sm font-semibold text-white/70">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/30"
            />

            {error && (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-full bg-white px-5 py-4 text-sm font-black text-black transition hover:bg-white/90 disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Login →"}
            </button>

          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-white/25">
              OR
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            onClick={() => {
              const plan =
                new URLSearchParams(
                  window.location.search
                ).get("plan");

              if (plan) {
                window.location.href =
                  `/hdlink/auth/register?plan=${encodeURIComponent(
                    plan
                  )}`;
              } else {
                router.push(
                  "/hdlink/auth/register"
                );
              }
            }}
            className="w-full rounded-full border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          >
            Create New Account
          </button>

          <button
            onClick={() => router.push("/hdlink")}
            className="mt-4 w-full text-center text-xs text-white/30 transition hover:text-white"
          >
            ← Back to HDLink
          </button>

        </div>
      </div>
    </main>
  );
}