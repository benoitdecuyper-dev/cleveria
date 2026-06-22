/** @type {import('next').NextConfig} */
const nextConfig = {
  // Le lecteur d'agents (@cleveria/factory) est en TS brut → transpilé par Next.
  transpilePackages: ["@cleveria/factory"],
};

export default nextConfig;
