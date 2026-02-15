/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  //swcMinify: true, //

  // LAN/IP 접속 시 Cross origin 경고 제거 (dev 전용)
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.200.198:3000',
  ],
  
  // 이미지 최적화 (remotePatterns 권장)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'hanra-studio.s3.amazonaws.com', pathname: '/**' },
      { protocol: 'https', hostname: 'd1234567890.cloudfront.net', pathname: '/**' },
      { protocol: 'https', hostname: 'api.hanra-studio.com', pathname: '/**' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // 환경 변수 노출 (클라이언트에서 사용 가능)
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000',
  },

  // API 프록시: /api/* → http://localhost:5000/api/*
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: 'http://localhost:5000/api/:path*',
        },
      ],
    };
  },

  // 헤더 보안 설정
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ],
      },
    ];
  },

  // 리다이렉트 설정 (/, /index, /index.html 리다이렉트 제거 — 인덱스는 프로젝트 선택 화면)
  async redirects() {
    return [
      // 5. TTS 생성 → step-5 없음, step-6이 TTS 페이지
      { source: '/step-5', destination: '/step-6', permanent: false },
      { source: '/step-5.html', destination: '/step-6', permanent: false },
      // .html 접미사 제거 후 해당 경로로
      { source: '/step-3.html', destination: '/step-3', permanent: false },
      { source: '/step-5-2.html', destination: '/step-5-2', permanent: false },
      { source: '/step-2.html', destination: '/step-2', permanent: false },
      { source: '/step-4-1.html', destination: '/step-4-1', permanent: false },
      { source: '/step-4-2.html', destination: '/step-4-2', permanent: false },
      { source: '/step-6.html', destination: '/step-6', permanent: false },
      { source: '/step-7.html', destination: '/step-7', permanent: false },
      { source: '/step-8.html', destination: '/step-8', permanent: false },
      { source: '/step-9.html', destination: '/step-9', permanent: false },
      { source: '/step-10.html', destination: '/step-10', permanent: false },
      { source: '/step-11.html', destination: '/step-11', permanent: false },
      { source: '/step-12.html', destination: '/step-12', permanent: false },
      { source: '/step-13.html', destination: '/step-13', permanent: false },
    ];
  },

  // 웹팩 설정
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  // Turbopack 설정 (웹팩 커스텀과 함께 사용 시 필수)
  turbopack: {},
};

module.exports = nextConfig;
