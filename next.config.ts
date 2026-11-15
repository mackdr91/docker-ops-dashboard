/**
 * Author: Domonick Mack
 * Date: 2026-11-15
 * Description: Next.js application configuration with standalone output and server external packages for Dockerode.
 */

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['dockerode', 'ssh2', 'docker-modem'],
  reactStrictMode: true,
};

export default nextConfig;
