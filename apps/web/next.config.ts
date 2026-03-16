import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Server-side only (not exposed to browser)
    API_URL: process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:8000",
    PRIMARY_DOMAIN: process.env.PRIMARY_DOMAIN || "dolarafuera.co",
  },
};

export default nextConfig;
