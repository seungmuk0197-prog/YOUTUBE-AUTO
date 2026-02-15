import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function LoginPage() {
    const router = useRouter();
    const [id, setId] = useState('');
    const [pw, setPw] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        // 간단한 하드코딩 인증
        if ((id === 'admin' || id.length > 0) && pw === '1234') {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userId', id);
            // 메인 페이지로 이동 (Next.js 라우터 사용)
            router.push('/');
        } else {
            alert('ID 또는 비밀번호가 일치하지 않습니다');
        }
    };

    return (
        <>
            <Head>
                <title>로그인 - HANRA STUDIO</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
                <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#2d3748', marginBottom: '24px', textAlign: 'center' }}>HANRA STUDIO</h1>
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label htmlFor="userId" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#4a5568', marginBottom: '8px' }}>ID</label>
                            <input
                                id="userId"
                                type="text"
                                value={id}
                                onChange={(e) => setId(e.target.value)}
                                placeholder="ID를 입력하세요 (예: admin)"
                                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label htmlFor="userPw" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#4a5568', marginBottom: '8px' }}>Password</label>
                            <input
                                id="userPw"
                                type="password"
                                value={pw}
                                onChange={(e) => setPw(e.target.value)}
                                placeholder="비밀번호를 입력하세요 (1234)"
                                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                            />
                        </div>
                        <button
                            type="submit"
                            style={{ padding: '12px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', marginTop: '8px' }}
                        >
                            로그인
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
