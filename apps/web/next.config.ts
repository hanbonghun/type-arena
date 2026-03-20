import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@type-arena/shared"],
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
