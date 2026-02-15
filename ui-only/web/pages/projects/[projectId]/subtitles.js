import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ProjectLayout from '../../../components/ProjectLayout';
import { apiGet, apiPost, downloadUrl } from '../../../lib/api';
import { unwrapProject } from '../../../lib/projectUtils';

export default function SubtitlesPage() {
  const router = useRouter();
  const { projectId } = router.query;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [srtContent, setSrtContent] = useState('');
  const [srtPath, setSrtPath] = useState('');

  useEffect(() => {
    if (projectId) loadProject();
  }, [projectId]);

  async function loadProject() {
    try {
      const data = await apiGet(`projects/${projectId}`);
      const p = unwrapProject(data);
      setProject(p);
      // Try to load existing SRT content
      await loadSrtContent(p);
    } catch (err) {
      setError('프로젝트를 불러올 수 없습니다: ' + err.message);
    }
  }

  async function loadSrtContent(p) {
    try {
      const path = 'assets/subtitles/subtitles.srt';
      const textData = await apiGet(`projects/${p.id}/text?path=${encodeURIComponent(path)}`);
      if (textData.ok && textData.content) {
        setSrtContent(textData.content);
        setSrtPath(path);
      }
    } catch {
      // No subtitles yet
    }
  }

  const hasTTS = project?.scenes?.[0]?.audio_path;

  async function handleGenerate() {
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const result = await apiPost(`projects/${projectId}/generate/srt`, {});
      setSrtPath(result.srtPath || 'assets/subtitles/subtitles.srt');
      setMessage('자막이 생성되었습니다.');
      await loadProject();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError('자막 생성 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const dlUrl = srtPath ? downloadUrl(projectId, srtPath) : '';

  return (
    <ProjectLayout projectId={projectId || ''} project={project} activeStep="subtitles" loading={loading}>
      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-success">{message}</div>}

      {!hasTTS ? (
        <div className="alert-warning">
          <p style={{ marginBottom: '12px' }}>TTS 오디오가 필요합니다. 먼저 TTS를 생성해주세요.</p>
          <button className="btn-outline" onClick={() => router.push(`/projects/${projectId}/tts`)}>
            TTS로 이동
          </button>
        </div>
      ) : (
        <>
          <button className="btn-gradient" onClick={handleGenerate} disabled={loading}>
            {srtContent ? '자막 재생성' : '자막 생성'}
          </button>

          {srtContent && (
            <div className="result-panel" style={{ marginTop: '24px' }}>
              <h3>자막 미리보기 (.srt)</h3>
              <textarea
                readOnly
                value={srtContent}
                style={{
                  width: '100%', minHeight: '250px', padding: '12px',
                  border: '1px solid #ddd', borderRadius: '6px',
                  fontSize: '13px', fontFamily: 'monospace', resize: 'vertical',
                  background: 'white', color: '#333',
                }}
              />
              <div className="download-row">
                <a href={dlUrl} className="btn-download" download>
                  다운로드 (.srt)
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </ProjectLayout>
  );
}
