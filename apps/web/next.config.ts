import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The shared package ships as raw TypeScript; let Next transpile it.
  transpilePackages: ['@frontier0/shared'],
};

export default nextConfig;
