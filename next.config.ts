import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.cwd()
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['http://localhost:3000']
    }
  }
};

export default nextConfig;
