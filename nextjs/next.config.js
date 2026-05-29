/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow sql.js WASM to load
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    }
    // Handle WASM files
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
  // Prevent Next from bundling sql.js on client
  experimental: {
    serverComponentsExternalPackages: ['sql.js'],
  },
};

module.exports = nextConfig;
