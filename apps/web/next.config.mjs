/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@type-arena/shared"],
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
