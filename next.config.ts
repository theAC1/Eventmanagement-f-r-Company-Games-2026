import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    BUILD_DATE: new Date().toISOString(),
    BUILD_VERSION: process.env.npm_package_version || "0.1.0-alpha",
  },
};

export default nextConfig;
