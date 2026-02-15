import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ProjectLayout from '../../../components/ProjectLayout';
import { apiGet, apiPost, previewUrl, downloadUrl } from '../../../lib/api';
import { unwrapProject } from '../../../lib/projectUtils';

export default function ThumbnailPage() {
  const router = useRouter();
  const { projectId } = router.query;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [thumbnailPath, setThumbnailPath] = useState('');

  useEffect(() => {
    if (projectId) loadProject();
  }, [projectId]);

  async function loadProject() {
    try {
      const data = await apiGet(`projects/${projectId}`);
      const p = unwrapProject(data);
      setProject(p);
      if (p?.thumbnail?.path) {
        setThumbnailPath(p.thumbnail.path);
      }
    } catch (err) {
      setError('프로젝트를 불러올 수 없습니다: ' + err.message);
    }
  }

  async function handleGenerate() {
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const result = await apiPost(`projects/${projectId}/generate/thumbnail`, {
        mode: 'with_text',
      });
      setThumbnailPath(result.thumbnailPath || 'assets/thumbnails/thumbnail.png');
      setMessage('썸네일이 생성되었습니다.');
      await loadProject();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError('썸네일 생성 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const imgSrc = thumbnailPath ? previewUrl(projectId, thumbnailPath) : '';
  const dlUrl = thumbnailPath ? downloadUrl(projectId, thumbnailPath) : '';

  return (
    <ProjectLayout projectId={projectId || ''} project={project} activeStep="thumbnail" loading={loading}>
      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-success">{message}</div>}

      <button className="btn-gradient" onClick={handleGenerate} disabled={loading}>
        {thumbnailPath ? '썸네일 재생성' : '썸네일 생성'}
      </button>

      {imgSrc && (
        <div className="result-panel" style={{ marginTop: '24px' }}>
          <h3>생성된 썸네일</h3>
          <div style={{ marginBottom: '12px', textAlign: 'center' }}>
            <img
              src={imgSrc}
              alt="Thumbnail"
              style={{
                maxWidth: '100%', borderRadius: '8px',
                border: '1px solid #e0e0e0',
              }}
            />
          </div>
          <div className="download-row">
            <a href={dlUrl} className="btn-download" download>
              다운로드 (.png)
            </a>
          </div>
        </div>
      )}
    </ProjectLayout>
  );
}
