import Head from 'next/head';
import Link from 'next/link';

export default function Custom404() {
  return (
    <>
      <Head>
        <title>페이지를 찾을 수 없습니다 - HANRA STUDIO</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Malgun Gothic, sans-serif',
        background: '#f5f5f5',
        color: '#333',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>페이지를 찾을 수 없습니다</h1>
        <p style={{ color: '#666', marginBottom: 24 }}>요청하신 주소의 페이지가 없거나 이동했습니다.</p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: '#e91e63',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: 8,
            fontWeight: 600
          }}
        >
          홈으로 돌아가기
        </Link>
      </div>
    </>
  );
}
