import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/hdlink",
        destination: "/",
      },
      {
        source: "/hdlink/auth/login",
        destination: "/auth/login",
      },
      {
        source: "/hdlink/auth/register",
        destination: "/auth/register",
      },
      {
        source: "/hdlink/premium",
        destination: "/premium",
      },
    ];
  },
};

export default nextConfig;