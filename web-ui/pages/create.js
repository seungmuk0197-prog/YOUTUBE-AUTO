import { useEffect } from 'react';
import { useRouter } from 'next/router';
import StudioLayout from '../components/StudioLayout';

/**
 * 프로젝트 생성 페이지 (레거시 호환)
 * 주제추천 화면으로 리다이렉트
 */
export default function CreateProjectPage() {
  const router = useRouter();

  useEffect(() => {
    // 주제추천 화면으로 리다이렉트 (프로젝트는 주제추천 확정 시에만 생성)
    router.replace('/');
  }, [router]);

  return (
    <StudioLayout title="프로젝트 생성 - HANRA STUDIO" activeStep="topic">
      <div style={{ padding: '48px 24px', textAlign: 'center', maxWidth: '480px', margin: '0 auto' }}>
        <p style={{ fontSize: '18px', color: '#2d3748', marginBottom: '16px' }}>주제추천 화면으로 이동 중...</p>
      </div>
    </StudioLayout>
  );
}
