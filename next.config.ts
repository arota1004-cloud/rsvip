import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ['@fortune-sheet/react', '@fortune-sheet/core'],
};

export default nextConfig;
