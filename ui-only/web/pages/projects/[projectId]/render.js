import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ProjectLayout from '../../../components/ProjectLayout';
import { apiGet, apiPost, previewUrl, downloadUrl } from '../../../lib/api';
import { unwrapProject } from '../../../lib/projectUtils';

export default function RenderPage() {
  const router = useRouter();
  const { projectId } = router.query;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [videoPath, setVideoPath] = useState('');

  useEffect(() => {
    if (projectId) loadProject();
  }, [projectId]);

  async function loadProject() {
    try {
      const data = await apiGet(`projects/${projectId}`);
      const p = unwrapProject(data);
      setProject(p);
      // Check for existing renders
      try {
        const artifacts = await apiGet(`projects/${projectId}/artifacts`);
        const renders = artifacts?.artifacts?.renders || [];
        const finalRender = renders.find((r) => r.relativePath?.includes('final'));
        if (finalRender) {
          setVideoPath(finalRender.relativePath);
        }
      } catch {
        // artifacts endpoint may not exist
      }
    } catch (err) {
      setError('프로젝트를 불러올 수 없습니다: ' + err.message);
    }
  }

  const hasScenes = project?.scenes?.length > 0;
  const hasTTS = hasScenes && project.scenes[0].audio_path;

  async function handleRenderFinal() {
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const result = await apiPost(`projects/${projectId}/render/final`, {});
      setVideoPath(result.videoPath || 'renders/final.mp4');
      setMessage('최종 영상이 생성되었습니다.');
      await loadProject();
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setError('렌더링 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const videoSrc = videoPath ? previewUrl(projectId, videoPath) : '';
  const dlUrl = videoPath ? downloadUrl(projectId, videoPath) : '';

  return (
    <ProjectLayout projectId={projectId || ''} project={project} activeStep="render" loading={loading}>
      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-success">{message}</div>}

      {!hasTTS ? (
        <div className="alert-warning">
          <p style={{ marginBottom: '12px' }}>
            최종 렌더링에는 최소한 대본과 TTS 음성이 필요합니다.
          </p>
          <button className="btn-outline" onClick={() => router.push(`/projects/${projectId}/tts`)}>
            TTS 페이지로 이동
          </button>
        </div>
      ) : (
        <>
          {/* Render Info */}
          <div className="alert-info" style={{ marginBottom: '20px' }}>
            <p>최종 렌더링은 이미지, TTS 오디오, 자막, BGM을 합성하여 완성된 영상을 생성합니다.</p>
          </div>

          <button className="btn-gradient" onClick={handleRenderFinal} disabled={loading}>
            {videoPath ? '영상 재렌더링' : '최종 영상 생성'}
          </button>

          {loading && (
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <div className="spinner" />
              <p style={{ fontSize: '13px', color: '#999' }}>렌더링 중... 시간이 걸릴 수 있습니다.</p>
            </div>
          )}

          {videoSrc && !loading && (
            <div className="result-panel" style={{ marginTop: '24px' }}>
              <h3>최종 영상</h3>
              <video
                controls
                src={videoSrc}
                style={{
                  width: '100%', borderRadius: '8px',
                  border: '1px solid #e0e0e0', marginBottom: '12px',
                }}
              />
              <div className="download-row">
                <a href={dlUrl} className="btn-download" download>
                  다운로드 (final.mp4)
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </ProjectLayout>
  );
}
