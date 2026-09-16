import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["vis-timeline", "vis-data", "uuid", "vis-util"],
};

export default nextConfig;
