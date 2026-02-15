/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || '/api',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000',
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:5000/api/:path*',
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
        ],
      },
    ];
  },

  redirects: async () => [],
};

module.exports = nextConfig;
