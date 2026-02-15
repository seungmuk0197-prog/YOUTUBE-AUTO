/**
 * HANRA STUDIO - Sentry 클라이언트 설정 (Next.js)
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: 0.1,
  
  // 에러 필터링
  beforeSend(event, hint) {
    // 클라이언트 측 에러만 필터링
    if (event.exception) {
      const error = hint.originalException;
      if (error && error.message && error.message.includes('ResizeObserver')) {
        return null; // ResizeObserver 에러는 무시
      }
    }
    return event;
  },
});
