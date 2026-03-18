import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: "/Users/lucaskay/Desktop/cerebro",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
