import type { NextConfig } from "next";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, "") || "http://localhost:8000";

const nextConfig: NextConfig = {
  /** Hide the bottom-left Next.js dev tools indicator (route / bundler bubble) in development */
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "tunzone.com",
      },
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/storage/:path*",
        destination: `${API_ORIGIN}/storage/:path*`,
      },
      {
        source: "/files/:path*",
        destination: `${API_ORIGIN}/files/:path*`,
      },
    ];
  },
};

export default nextConfig;
