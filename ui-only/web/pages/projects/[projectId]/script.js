import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ProjectLayout from '../../../components/ProjectLayout';
import { apiGet, apiPost } from '../../../lib/api';
import { unwrapProject } from '../../../lib/projectUtils';

export default function ScriptPage() {
  const router = useRouter();
  const { projectId } = router.query;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scriptText, setScriptText] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (projectId) loadProject();
  }, [projectId]);

  async function loadProject() {
    try {
      const data = await apiGet(`projects/${projectId}`);
      const p = unwrapProject(data);
      setProject(p);
      if (p?.scenes?.[0]) {
        setScriptText(p.scenes[0].narration_ko || p.scenes[0].text || '');
      }
    } catch (err) {
      setError('프로젝트를 불러올 수 없습니다: ' + err.message);
    }
  }

  async function handleSaveScript() {
    if (!scriptText.trim()) {
      setError('대본을 입력해주세요.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await apiPost(`projects/${projectId}/scenes`, { text: scriptText });
      setMessage('대본이 저장되었습니다.');
      await loadProject();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError('대본 저장 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const savedText = project?.scenes?.[0]?.narration_ko || project?.scenes?.[0]?.text || '';

  return (
    <ProjectLayout projectId={projectId || ''} project={project} activeStep="script" loading={loading}>
      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-success">{message}</div>}

      <div style={{ marginBottom: '20px' }}>
        <label className="form-label">영상 대본</label>
        <textarea
          className="form-textarea"
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
          placeholder="영상의 나레이션 대본을 입력하세요..."
        />
        <p style={{ color: '#999', fontSize: '12px', marginTop: '6px' }}>
          한국어 또는 영어로 입력하세요. TTS 음성으로 변환됩니다.
        </p>
      </div>

      <button className="btn-gradient" onClick={handleSaveScript} disabled={loading}>
        {loading ? '저장 중...' : '대본 저장'}
      </button>

      {savedText && (
        <div className="result-panel" style={{ marginTop: '24px' }}>
          <h3>저장된 대본</h3>
          <div style={{
            background: 'white', padding: '12px', borderRadius: '6px',
            fontSize: '13px', color: '#666', maxHeight: '200px', overflowY: 'auto',
            fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {savedText}
          </div>
        </div>
      )}
    </ProjectLayout>
  );
}
