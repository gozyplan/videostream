"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Video = {
  id: string | number;
  title: string;
  thumbnail_url: string;
  video_url?: string;
  duration?: string | number;
};

type Subscription = {
  id: number;
  plan_id: number;
  status: string;
  expires_at: string;
};

export default function HDLinkPremiumPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);

  const [subscription, setSubscription] =
    useState<Subscription | null>(null);

  const [videos, setVideos] = useState<Video[]>([]);

  const [loading, setLoading] = useState(true);

  const [loadingVideos, setLoadingVideos] =
    useState(true);

  const [error, setError] = useState("");

  const [selectedVideo, setSelectedVideo] =
    useState<Video | null>(null);

  useEffect(() => {
    initialize();
  }, []);

  async function initialize() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        window.location.href =
          "/hdlink/auth/login";
        return;
      }

      setUser(currentUser);

      const activeSubscription =
        await loadSubscription(
          currentUser.id
        );

      if (!activeSubscription) {
        router.replace("/hdlink");
        return;
      }

      await loadVideos();
    } catch (err) {
      console.error(
        "HDLink initialize error:",
        err
      );

      setError(
        "Premium page could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSubscription(
    userId: string
  ) {
    const now =
      new Date().toISOString();

    const {
      data,
      error: subscriptionError,
    } = await supabase
      .from("subscriptions")
      .select(
        "id,plan_id,status,expires_at"
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", now)
      .order("expires_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      console.error(
        "HDLink subscription error:",
        subscriptionError
      );

      setSubscription(null);

      return null;
    }

    setSubscription(data);

    return data;
  }

  async function loadVideos() {
    setLoadingVideos(true);
    setError("");

    try {
      const response = await fetch(
        "/api/bunny-videos",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Videos could not be loaded."
        );
      }

      let loadedVideos: Video[] = [];

      if (Array.isArray(data)) {
        loadedVideos = data;
      } else if (
        Array.isArray(data?.videos)
      ) {
        loadedVideos = data.videos;
      } else if (
        Array.isArray(data?.items)
      ) {
        loadedVideos = data.items;
      }

      /*
       * IMPORTANT
       *
       * पहले यहाँ:
       *
       * loadedVideos.slice(0, 8)
       *
       * था।
       *
       * इसलिए केवल 8 videos दिखाई दे रही थीं।
       *
       * अब पूरी API library दिखाई जाएगी।
       */

      setVideos(loadedVideos);
    } catch (err) {
      console.error(
        "HDLink premium video error:",
        err
      );

      setVideos([]);

      setError(
        "Premium videos could not be loaded."
      );
    } finally {
      setLoadingVideos(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();

    localStorage.removeItem(
      "hdlink_pending_plan_id"
    );

    localStorage.removeItem(
      "hdlink_pending_payment_id"
    );

    window.location.href =
      "/hdlink";
  }

  function openVideo(video: Video) {
    if (!video.video_url) {
      setError(
        "This video is currently unavailable."
      );

      return;
    }

    setError("");

    setSelectedVideo(video);

    document.body.style.overflow =
      "hidden";
  }

  function closeVideo() {
    setSelectedVideo(null);

    document.body.style.overflow =
      "";
  }

  function formatDuration(
    duration?: string | number
  ) {
    if (
      duration === undefined ||
      duration === null ||
      duration === ""
    ) {
      return "";
    }

    const seconds =
      Number(duration);

    if (
      Number.isNaN(seconds) ||
      seconds <= 0
    ) {
      return String(duration);
    }

    const hours =
      Math.floor(seconds / 3600);

    const minutes =
      Math.floor(
        (seconds % 3600) / 60
      );

    const remainingSeconds =
      Math.floor(seconds % 60);

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

  const isPremium =
    !!subscription &&
    subscription.status ===
      "active" &&
    new Date(
      subscription.expires_at
    ).getTime() > Date.now();

  /*
   * PAGE LOADING
   */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">

        <div className="text-center">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-black">
            H
          </div>

          <div className="mx-auto mt-5 h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-white" />

          <p className="mt-4 text-sm text-white/40">
            Loading HDLink Premium...
          </p>

        </div>

      </main>
    );
  }

  /*
   * PREMIUM ACCESS REQUIRED
   */

  if (!isPremium) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-5 text-white">

        <div className="w-full max-w-md rounded-[30px] border border-white/10 bg-white/[0.04] p-8 text-center">

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-black text-black">
            H
          </div>

          <h1 className="mt-6 text-2xl font-black">
            Premium Access Required
          </h1>

          <p className="mt-3 text-sm leading-6 text-white/40">
            Your HDLink Premium access is not active.
          </p>

          <button
            onClick={() =>
              router.push("/hdlink")
            }
            className="mt-7 w-full rounded-full bg-white px-6 py-4 text-sm font-black text-black transition hover:bg-white/85"
          >
            Get Premium →
          </button>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050505] text-white">

      {/* ====================================================== */}
      {/* BACKGROUND */}
      {/* ====================================================== */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">

        <div className="absolute left-1/2 top-[-300px] h-[700px] w-[900px] -translate-x-1/2 rounded-full bg-purple-500/[0.08] blur-[160px]" />

        <div className="absolute right-[-200px] top-[500px] h-[500px] w-[500px] rounded-full bg-blue-500/[0.05] blur-[140px]" />

        <div className="absolute bottom-[-250px] left-[-200px] h-[500px] w-[500px] rounded-full bg-pink-500/[0.04] blur-[140px]" />

      </div>

      {/* ====================================================== */}
      {/* NAVBAR */}
      {/* ====================================================== */}

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050505]/75 backdrop-blur-2xl">

        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">

          <button
            onClick={() =>
              router.push("/hdlink")
            }
            className="flex items-center gap-3"
          >

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg font-black text-black">
              H
            </div>

            <div className="text-left">

              <div className="text-lg font-black">
                HDLink
              </div>

              <div className="text-[9px] font-semibold uppercase tracking-[0.3em] text-white/30">
                Premium
              </div>

            </div>

          </button>

          <div className="flex items-center gap-3">

            <div className="hidden rounded-full border border-green-400/20 bg-green-400/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-green-300 sm:block">
              ✓ Premium Active
            </div>

            <button
              onClick={handleLogout}
              className="rounded-full border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              Logout
            </button>

          </div>

        </div>

      </header>

      {/* ====================================================== */}
      {/* HERO */}
      {/* ====================================================== */}

      <section className="relative z-10 px-5 pb-16 pt-16 sm:pb-20 sm:pt-24">

        <div className="mx-auto max-w-7xl">

          <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">

            <div>

              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-green-400/20 bg-green-400/[0.06] px-4 py-2 text-xs font-semibold text-green-300">

                <span className="h-2 w-2 rounded-full bg-green-400" />

                Premium Access Active

              </div>

              <h1 className="max-w-4xl text-5xl font-black tracking-[-0.04em] sm:text-6xl lg:text-7xl">

                Welcome to

                <br />

                <span className="text-white/40">
                  HDLink Premium.
                </span>

              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">
                Your premium access is active.
                Explore the protected HDLink video
                library and start watching.
              </p>

              {subscription && (
                <div className="mt-8 flex flex-wrap gap-3">

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">

                    <div className="text-[10px] uppercase tracking-wider text-white/30">
                      Access Status
                    </div>

                    <div className="mt-1 text-sm font-bold text-green-300">
                      Active
                    </div>

                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">

                    <div className="text-[10px] uppercase tracking-wider text-white/30">
                      Expires
                    </div>

                    <div className="mt-1 text-sm font-bold">
                      {new Date(
                        subscription.expires_at
                      ).toLocaleDateString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </div>

                  </div>

                </div>
              )}

            </div>

            <div className="hidden lg:block">

              <div className="relative">

                <div className="absolute -inset-5 rounded-full bg-purple-500/[0.08] blur-3xl" />

                <div className="relative flex h-52 w-52 items-center justify-center rounded-[45px] border border-white/10 bg-white/[0.04] shadow-2xl">

                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white text-4xl font-black text-black">
                    H
                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* ====================================================== */}
      {/* VIDEO LIBRARY */}
      {/* ====================================================== */}

      <section className="relative z-10 border-t border-white/10 px-5 py-20 sm:py-24">

        <div className="mx-auto max-w-7xl">

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

            <div>

              <div className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
                HDLink Premium Library
              </div>

              <h2 className="mt-3 text-3xl font-black sm:text-4xl">
                Start watching
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-white/40">
                Your premium access is active.
                Select any available video to watch.
              </p>

              <div className="mt-4 text-sm font-semibold text-white/50">
                {videos.length} videos available
              </div>

            </div>

            <button
              onClick={loadVideos}
              disabled={loadingVideos}
              className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingVideos
                ? "Loading..."
                : "↻ Refresh Videos"}
            </button>

          </div>

          <div className="mt-6 inline-flex rounded-full border border-green-400/20 bg-green-400/[0.06] px-5 py-3 text-xs font-bold text-green-300">
            🔓 Premium Unlocked
          </div>

          {error && (
            <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="mt-10">

            {/* ================================================= */}
            {/* VIDEO LOADING */}
            {/* ================================================= */}

            {loadingVideos ? (

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                {Array.from({
                  length: 8,
                }).map((_, index) => (

                  <div
                    key={index}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                  >

                    <div className="aspect-video animate-pulse bg-white/10" />

                    <div className="space-y-3 p-4">

                      <div className="h-4 animate-pulse rounded bg-white/10" />

                      <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />

                      <div className="h-9 animate-pulse rounded-full bg-white/5" />

                    </div>

                  </div>

                ))}

              </div>

            ) : videos.length === 0 ? (

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">

                <div className="text-4xl">
                  🎬
                </div>

                <h3 className="mt-4 text-xl font-bold">
                  No videos available
                </h3>

                <p className="mt-2 text-sm text-white/40">
                  Premium videos are currently unavailable.
                </p>

                <button
                  onClick={loadVideos}
                  className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-bold text-black"
                >
                  Try Again
                </button>

              </div>

            ) : (

              /*
               * IMPORTANT:
               *
               * यहाँ videos.map() है।
               * कोई slice(0, 8) नहीं है।
               *
               * API जितनी videos भेजेगी,
               * उतनी सभी दिखाई देंगी।
               */

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                {videos.map(
                  (video, index) => (

                    <article
                      key={String(video.id)}
                      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.05]"
                    >

                      {/* THUMBNAIL */}

                      <button
                        onClick={() =>
                          openVideo(video)
                        }
                        className="block w-full text-left"
                      >

                        <div className="relative aspect-video overflow-hidden bg-[#111]">

                          {video.thumbnail_url ? (

                            <img
                              src={
                                video.thumbnail_url
                              }
                              alt={
                                video.title ||
                                `Premium video ${index + 1}`
                              }
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                              loading="lazy"
                            />

                          ) : (

                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/10 to-black">

                              <span className="text-3xl">
                                ▶
                              </span>

                            </div>

                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />

                          <div className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-black">
                            Premium
                          </div>

                          {video.duration !==
                            undefined &&
                            video.duration !==
                              null &&
                            video.duration !==
                              "" && (

                              <div className="absolute bottom-3 right-3 rounded-md bg-black/80 px-2 py-1 text-[10px] font-semibold text-white">
                                {formatDuration(
                                  video.duration
                                )}
                              </div>

                            )}

                          <div className="absolute inset-0 flex items-center justify-center">

                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl text-black shadow-2xl transition duration-300 group-hover:scale-110">
                              ▶
                            </div>

                          </div>

                        </div>

                      </button>

                      {/* DETAILS */}

                      <div className="p-4">

                        <h3 className="line-clamp-2 min-h-[40px] text-sm font-bold leading-5 text-white/90">
                          {video.title ||
                            `Premium Video ${index + 1}`}
                        </h3>

                        <div className="mt-3 flex items-center justify-between">

                          <span className="text-[11px] text-green-300/60">
                            Premium
                          </span>

                          <span className="text-[11px] font-bold text-white/50">
                            {formatDuration(
                              video.duration
                            ) || "Watch"}
                          </span>

                        </div>

                        <button
                          onClick={() =>
                            openVideo(video)
                          }
                          className="mt-4 w-full rounded-full bg-white py-3 text-xs font-black text-black transition hover:bg-white/85 active:scale-[0.98]"
                        >
                          Watch Now →
                        </button>

                      </div>

                    </article>

                  )
                )}

              </div>

            )}

          </div>

        </div>

      </section>

      {/* ====================================================== */}
      {/* ACCOUNT */}
      {/* ====================================================== */}

      <section className="relative z-10 px-5 py-10">

        <div className="mx-auto max-w-7xl">

          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-8 sm:p-10">

            <div className="relative flex flex-col justify-between gap-7 sm:flex-row sm:items-center">

              <div>

                <div className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
                  Account
                </div>

                <h2 className="mt-2 text-2xl font-black">
                  Your HDLink Premium
                </h2>

                {user?.email && (
                  <p className="mt-2 text-sm text-white/35">
                    {user.email}
                  </p>
                )}

              </div>

              <button
                onClick={handleLogout}
                className="rounded-full border border-white/10 bg-white/[0.04] px-6 py-3.5 text-sm font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              >
                Logout
              </button>

            </div>

          </div>

        </div>

      </section>

      {/* ====================================================== */}
      {/* FOOTER */}
      {/* ====================================================== */}

      <footer className="relative z-10 border-t border-white/10 px-5 py-10">

        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-center sm:flex-row sm:text-left">

          <div>

            <div className="font-bold">
              HDLink
            </div>

            <div className="mt-1 text-xs text-white/25">
              Premium streaming access
            </div>

          </div>

          <div className="text-xs text-white/25">
            Premium access • Secure account
          </div>

        </div>

      </footer>

      {/* ====================================================== */}
      {/* VIDEO PLAYER MODAL */}
      {/* ====================================================== */}

      {selectedVideo && (

        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md"
          onClick={closeVideo}
        >

          <div
            className="relative w-full max-w-6xl"
            onClick={(event) =>
              event.stopPropagation()
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
                    selectedVideo.video_url?.includes(
                      "?"
                    )
                      ? "&"
                      : "?"
                  }autoplay=true&responsive=true`}
                  className="h-full w-full"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  title={
                    selectedVideo.title
                  }
                  style={{
                    border: "none",
                  }}
                />

              </div>

            </div>

            {/* PLAYER INFO */}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">
                  Now Playing
                </div>

                <h3 className="mt-1 text-lg font-bold text-white">
                  {selectedVideo.title}
                </h3>

              </div>

              <div className="w-fit rounded-full border border-green-400/20 bg-green-400/10 px-4 py-2 text-xs font-bold text-green-300">
                ✓ Premium
              </div>

            </div>

          </div>

        </div>

      )}

    </main>
  );
}