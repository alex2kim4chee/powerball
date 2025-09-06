/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [
      // noop for now; speeds up dev when used
    ],
  },
};

export default nextConfig;

