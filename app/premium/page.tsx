"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Video = {
  id: string;
  title: string;
  thumbnail_url: string;
  video_url: string;
  duration: number;
};

type Subscription = {
  id: number;
  plan_id: number;
  status: string;
  starts_at: string;
  expires_at: string;
};

export default function PremiumPage() {
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] =
    useState<Subscription | null>(null);

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedVideo, setSelectedVideo] =
    useState<Video | null>(null);

  useEffect(() => {
    loadPremium();
  }, []);

  async function loadPremium() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Login नहीं है
      if (!user) {
        window.location.href = "/auth/login";
        return;
      }

      setUser(user);

      // Current time
      const now = new Date().toISOString();

      // केवल ACTIVE + अभी expire नहीं हुआ subscription
      const {
        data: sub,
        error: subError,
      } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gt("expires_at", now)
        .order("expires_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (subError) {
        throw new Error(subError.message);
      }

      // Active subscription नहीं है
      if (!sub) {
        window.location.href = "/#plans";
        return;
      }

      setSubscription(sub);

      // Bunny से पूरी video library
      setVideoLoading(true);

      const response = await fetch(
        "/api/bunny-videos",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Videos load नहीं हुए"
        );
      }

      // कोई slice(0, 8) नहीं
      // API से आने वाली सारी videos
      setVideos(data.videos || []);
    } catch (err: any) {
      console.error(
        "Premium load error:",
        err
      );

      setError(
        err?.message ||
          "Premium page load नहीं हो पाया"
      );
    } finally {
      setVideoLoading(false);
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();

    // Session खत्म होने के बाद Home
    window.location.href = "/";
  }

  function openVideo(video: Video) {
    setSelectedVideo(video);
  }

  function closeVideo() {
    setSelectedVideo(null);
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  function formatDuration(seconds: number) {
    if (!seconds || seconds <= 0) {
      return "";
    }

    const totalSeconds = Math.floor(seconds);

    const hours = Math.floor(
      totalSeconds / 3600
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const remainingSeconds =
      totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(
        minutes
      ).padStart(2, "0")}:${String(
        remainingSeconds
      ).padStart(2, "0")}`;
    }

    return `${minutes}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  }

  // PAGE LOADING
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />

          <p className="mt-4 text-sm text-white/50">
            Loading Premium...
          </p>
        </div>
      </main>
    );
  }

  // ERROR
  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] px-5 text-white">
        <div className="w-full max-w-lg rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-2xl">
            !
          </div>

          <h2 className="mt-5 text-xl font-bold text-red-300">
            Premium page load नहीं हो पाया
          </h2>

          <p className="mt-3 text-sm leading-6 text-red-200/60">
            {error}
          </p>

          <button
            onClick={loadPremium}
            className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-white/85"
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">

      {/* ================= NAVBAR ================= */}

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#080808]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">

          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="text-left"
          >
            <div className="text-lg font-black tracking-tight">
              VideoStream
            </div>

            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/35">
              Premium
            </div>
          </button>

          <div className="flex items-center gap-3">

            <div className="hidden rounded-full border border-green-400/20 bg-green-400/10 px-4 py-2 text-xs font-semibold text-green-300 sm:block">
              ✓ Premium Active
            </div>

            <span className="hidden max-w-[240px] truncate text-sm text-white/40 md:block">
              {user?.email}
            </span>

            <button
              onClick={logout}
              className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold transition hover:bg-white/10"
            >
              Logout
            </button>

          </div>
        </div>
      </nav>

      {/* ================= HERO ================= */}

      <section className="relative overflow-hidden border-b border-white/10">

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.14),transparent_45%)]" />

        <div className="absolute -left-40 top-20 h-80 w-80 rounded-full bg-white/[0.03] blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">

          <div className="max-w-4xl">

            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-400/20 bg-green-400/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-green-300">

              <span className="h-2 w-2 rounded-full bg-green-400" />

              Premium Active

            </div>

            <h1 className="text-5xl font-black leading-[0.95] tracking-[-0.04em] sm:text-7xl lg:text-8xl">
              Welcome to
              <br />

              <span className="text-white/30">
                Premium.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
              Your premium membership is active.
              Enjoy the complete video library
              with a smooth streaming experience.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">

              <a
                href="#videos"
                className="rounded-full bg-white px-7 py-3.5 text-sm font-bold text-black transition hover:bg-white/85"
              >
                Watch Videos
              </a>

              <button
                onClick={logout}
                className="rounded-full border border-white/10 bg-white/[0.04] px-7 py-3.5 text-sm font-semibold transition hover:bg-white/10"
              >
                Logout
              </button>

            </div>

          </div>
        </div>
      </section>

      {/* ================= SUBSCRIPTION ================= */}

      {subscription && (
        <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">

          <div className="grid gap-4 md:grid-cols-3">

            {/* STATUS */}

            <div className="rounded-3xl border border-green-400/10 bg-green-400/[0.04] p-6">

              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Membership
              </p>

              <div className="mt-4 flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-400/10">
                  ✓
                </div>

                <div>
                  <p className="font-bold text-green-400">
                    Active
                  </p>

                  <p className="text-xs text-white/35">
                    Premium access enabled
                  </p>
                </div>

              </div>
            </div>

            {/* STARTED */}

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">

              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Started
              </p>

              <p className="mt-4 text-xl font-bold">
                {formatDate(
                  subscription.starts_at
                )}
              </p>

            </div>

            {/* EXPIRES */}

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">

              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Expires
              </p>

              <p className="mt-4 text-xl font-bold">
                {formatDate(
                  subscription.expires_at
                )}
              </p>

            </div>

          </div>
        </section>
      )}

      {/* ================= BENEFITS ================= */}

      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">

        <div className="mb-7">

          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/30">
            Membership
          </p>

          <h2 className="mt-2 text-3xl font-black tracking-tight">
            Your Premium Benefits
          </h2>

        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {[
            {
              icon: "▶",
              title: "Premium Videos",
              text: "Access your complete premium video library.",
            },
            {
              icon: "⚡",
              title: "Fast Streaming",
              text: "Enjoy a smooth and responsive streaming experience.",
            },
            {
              icon: "🔒",
              title: "Secure Access",
              text: "Your premium access is connected to your account.",
            },
            {
              icon: "✦",
              title: "Exclusive Content",
              text: "Premium members can watch exclusive content.",
            },
          ].map((item) => (

            <div
              key={item.title}
              className="group rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]"
            >

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg text-black">
                {item.icon}
              </div>

              <h3 className="mt-5 font-bold">
                {item.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/35">
                {item.text}
              </p>

            </div>

          ))}

        </div>
      </section>

      {/* ================= VIDEO LIBRARY ================= */}

      <section
        id="videos"
        className="mx-auto max-w-7xl px-5 py-16 lg:px-8"
      >

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

          <div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/30">
              Premium Library
            </p>

            <h2 className="mt-2 text-4xl font-black tracking-tight">
              All Premium Videos
            </h2>

            <p className="mt-3 text-sm text-white/35">
              {videos.length} videos available for you
            </p>

          </div>

          <button
            onClick={loadPremium}
            className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold transition hover:bg-white/10"
          >
            ↻ Refresh
          </button>

        </div>

        {/* VIDEO LOADING */}

        {videoLoading ? (

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

            {Array.from({
              length: 8,
            }).map((_, index) => (

              <div
                key={index}
                className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]"
              >

                <div className="aspect-video animate-pulse bg-white/[0.06]" />

                <div className="p-5">

                  <div className="h-4 w-3/4 animate-pulse rounded bg-white/[0.06]" />

                  <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-white/[0.04]" />

                  <div className="mt-5 h-10 w-full animate-pulse rounded-full bg-white/[0.05]" />

                </div>

              </div>

            ))}

          </div>

        ) : videos.length === 0 ? (

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-14 text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.05] text-2xl">
              🎬
            </div>

            <h3 className="mt-5 text-lg font-bold">
              No videos available
            </h3>

            <p className="mt-2 text-sm text-white/35">
              Premium videos are currently unavailable.
            </p>

          </div>

        ) : (

          /*
           * IMPORTANT:
           * यहाँ videos.map है।
           * कोई slice(0, 8) नहीं है।
           * इसलिए API से जितनी videos आएंगी,
           * सभी यहाँ दिखाई देंगी।
           */

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

            {videos.map((video) => (

              <article
                key={video.id}
                className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]"
              >

                {/* THUMBNAIL */}

                <button
                  onClick={() =>
                    openVideo(video)
                  }
                  className="relative block aspect-video w-full overflow-hidden bg-black text-left"
                >

                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display =
                        "none";
                    }}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />

                  <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] backdrop-blur-md">
                    Premium
                  </div>

                  {video.duration > 0 && (
                    <div className="absolute bottom-3 right-3 rounded-md bg-black/80 px-2 py-1 text-[10px] font-semibold">
                      {formatDuration(
                        video.duration
                      )}
                    </div>
                  )}

                  <div className="absolute inset-0 flex items-center justify-center">

                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-lg text-black shadow-2xl transition duration-300 group-hover:scale-110">
                      ▶
                    </div>

                  </div>

                </button>

                {/* DETAILS */}

                <div className="p-5">

                  <h3 className="line-clamp-2 min-h-[48px] font-bold leading-6">
                    {video.title}
                  </h3>

                  <p className="mt-2 text-xs text-white/30">
                    Premium content
                  </p>

                  <button
                    onClick={() =>
                      openVideo(video)
                    }
                    className="mt-5 w-full rounded-full bg-white py-3 text-sm font-bold text-black transition hover:bg-white/85 active:scale-[0.98]"
                  >
                    Watch Now
                  </button>

                </div>

              </article>

            ))}

          </div>

        )}

      </section>

      {/* ================= VIDEO PLAYER ================= */}

      {selectedVideo && (

        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm"
          onClick={closeVideo}
        >

          <div
            className="relative w-full max-w-6xl"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* CLOSE */}

            <button
              onClick={closeVideo}
              aria-label="Close video"
              className="absolute -right-1 -top-14 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg font-black text-black shadow-2xl transition hover:scale-105"
            >
              ✕
            </button>

            {/* PLAYER */}

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">

              <div className="aspect-video w-full">

                <iframe
                  src={`${selectedVideo.video_url}${
                    selectedVideo.video_url.includes(
                      "?"
                    )
                      ? "&"
                      : "?"
                  }autoplay=true&preload=true&responsive=true`}
                  className="h-full w-full"
                  loading="lazy"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  style={{
                    border: "none",
                  }}
                  title={
                    selectedVideo.title
                  }
                />

              </div>

            </div>

            {/* PLAYER INFO */}

            <div className="mt-5">

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
                    Now Playing
                  </p>

                  <h3 className="mt-1 text-xl font-bold">
                    {selectedVideo.title}
                  </h3>

                </div>

                <div className="rounded-full border border-green-400/20 bg-green-400/10 px-4 py-2 text-xs font-bold text-green-300">
                  ✓ Premium
                </div>

              </div>

            </div>

          </div>

        </div>

      )}

      {/* ================= FOOTER ================= */}

      <footer className="border-t border-white/10">

        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-white/30 sm:flex-row sm:items-center sm:justify-between lg:px-8">

          <div>
            © 2026 VideoStream
          </div>

          <div className="flex items-center gap-5">

            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="transition hover:text-white"
            >
              Home
            </button>

            <button
              onClick={logout}
              className="transition hover:text-white"
            >
              Logout
            </button>

          </div>

        </div>

      </footer>

    </main>
  );
}