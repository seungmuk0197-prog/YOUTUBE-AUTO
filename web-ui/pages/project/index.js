import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import StudioLayout from '../../components/StudioLayout';
import { fetchProject } from '../../lib/api';

export default function ProjectDashboard() {
    const router = useRouter();
    const { id } = router.query;
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!id) return;
        loadProject();
    }, [id]);

    async function loadProject() {
        try {
            setLoading(true);
            const data = await fetchProject(id);
            setProject(data);
        } catch (err) {
            console.error(err);
            setError('프로젝트를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    }

    const steps = [
        { id: 'planning', label: '1. 기획 및 설정', path: '/script-planning', icon: '📝' },
        { id: 'script', label: '2. 대본 생성', path: '/script-generation', icon: '✍️' },
        { id: 'json', label: '3. 장면 구성 (JSON)', path: '/json-generation', icon: '🎬' },
        { id: 'image', label: '4. 이미지 생성', path: '/image-generation', icon: '🎨' },
        { id: 'tts', label: '5. 더빙 (TTS)', path: '/tts-generation', icon: '🗣️' },
        { id: 'video', label: '6. 영상 렌더링', path: '/video-rendering', icon: '🎥' },
    ];

    const assets = [
        { key: 'hasScript', label: '대본', file: 'script.txt' },
        { key: 'hasScenes', label: '장면 데이터', file: 'scenes.json' },
        { key: 'hasCharacters', label: '캐릭터 설정', file: 'characters.json' },
        { key: 'hasNarration', label: '내레이션', file: 'narration.mp3' },
        { key: 'hasVideo', label: '최종 영상', file: 'final.mp4' },
    ];

    if (loading) return (
        <StudioLayout>
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
        </StudioLayout>
    );

    if (error) return (
        <StudioLayout>
            <div className="p-8 text-center text-red-500">
                <h2 className="text-2xl font-bold mb-4">Error</h2>
                <p>{error}</p>
                <button onClick={() => router.push('/projects')} className="mt-4 text-indigo-500 hover:underline">
                    프로젝트 목록으로 돌아가기
                </button>
            </div>
        </StudioLayout>
    );

    if (!project) return null;

    // Metadata is at the root level of the project object called from fetchProject (which calls backend get_project -> to_dict)
    const stats = project;

    return (
        <StudioLayout>
            <Head>
                <title>{project.title} - Project Dashboard</title>
            </Head>

            <div className="max-w-6xl mx-auto p-6 space-y-8">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.title}</h1>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-medium">
                                {project.status || 'Active'}
                            </span>
                            <span>Created: {new Date(project.created_at).toLocaleDateString()}</span>
                            <span>ID: {project.id}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push('/')}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        나가기
                    </button>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Asset Status */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                                📦 자산 현황
                            </h2>
                            <div className="space-y-3">
                                {assets.map(asset => (
                                    <div key={asset.key} className="flex justify-between items-center p-2 rounded bg-gray-50">
                                        <span className="text-gray-600 font-medium">{asset.label}</span>
                                        {stats[asset.key] ? (
                                            <span className="text-green-600 text-sm font-bold flex items-center">
                                                ✅ 완료
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 text-sm">미생성</span>
                                        )}
                                    </div>
                                ))}
                                <div className="flex justify-between items-center p-2 rounded bg-gray-50">
                                    <span className="text-gray-600 font-medium">이미지</span>
                                    <span className="text-indigo-600 font-bold">{stats.imagesCount || 0}장</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">
                                ℹ️ 프로젝트 정보
                            </h2>
                            <ul className="space-y-2 text-sm text-gray-600">
                                <li>• 총 장면: {stats.scenesCount || 0} Scenes</li>
                                <li>• 예상 시간: {Math.round((stats.duration || 0) / 60)}분 {(stats.duration || 0) % 60}초</li>
                            </ul>
                        </div>
                    </div>

                    {/* Workflow Steps */}
                    <div className="md:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 h-full">
                            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                                🚀 작업 단계
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {steps.map((step) => (
                                    <button
                                        key={step.id}
                                        onClick={() => router.push(`${step.path}?projectId=${id}`)}
                                        className="flex items-center p-4 border border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group"
                                    >
                                        <span className="text-3xl mr-4 group-hover:scale-110 transition-transform">{step.icon}</span>
                                        <div>
                                            <h3 className="font-bold text-gray-800 group-hover:text-indigo-700">{step.label}</h3>
                                            <p className="text-xs text-gray-500 mt-1">이동하기 &rarr;</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </StudioLayout>
    );
}
