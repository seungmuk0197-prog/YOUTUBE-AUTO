import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import ProjectLayout from '../../../components/ProjectLayout';
import { apiGet, apiPatch, apiPostFormData, previewUrl, downloadUrl } from '../../../lib/api';
import { unwrapProject } from '../../../lib/projectUtils';

export default function BGMPage() {
  const router = useRouter();
  const { projectId } = router.query;
  const fileInputRef = useRef(null);

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [volume, setVolume] = useState(0.15);
  const [bgmEnabled, setBgmEnabled] = useState(false);
  const [bgmPath, setBgmPath] = useState('');

  useEffect(() => {
    if (projectId) loadProject();
  }, [projectId]);

  async function loadProject() {
    try {
      const data = await apiGet(`projects/${projectId}`);
      const p = unwrapProject(data);
      setProject(p);
      if (p?.settings?.bgm) {
        setVolume(p.settings.bgm.volume ?? 0.15);
        setBgmEnabled(p.settings.bgm.enabled ?? false);
        setBgmPath(p.settings.bgm.path || '');
      }
    } catch (err) {
      setError('프로젝트를 불러올 수 없습니다: ' + err.message);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiPostFormData(`projects/${projectId}/upload/bgm`, formData);
      setBgmPath(result.bgmPath || 'assets/bgm/bgm.mp3');
      setMessage('BGM 파일이 업로드되었습니다.');
      await loadProject();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError('BGM 업로드 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings() {
    try {
      setLoading(true);
      setError(null);
      await apiPatch(`projects/${projectId}/settings/bgm`, {
        enabled: bgmEnabled,
        volume,
      });
      setMessage('BGM 설정이 저장되었습니다.');
      await loadProject();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError('BGM 설정 저장 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const audioSrc = bgmPath ? previewUrl(projectId, bgmPath) : '';
  const dlUrl = bgmPath ? downloadUrl(projectId, bgmPath) : '';

  return (
    <ProjectLayout projectId={projectId || ''} project={project} activeStep="bgm" loading={loading}>
      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-success">{message}</div>}

      {/* File Upload */}
      <div style={{ marginBottom: '20px' }}>
        <label className="form-label">BGM 파일 업로드</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,.aac,.ogg,.flac"
          onChange={handleUpload}
          style={{
            width: '100%', padding: '10px', border: '1px solid #ddd',
            borderRadius: '8px', fontSize: '14px',
          }}
        />
        <p style={{ color: '#999', fontSize: '12px', marginTop: '6px' }}>
          지원 형식: MP3, WAV, AAC, OGG, FLAC
        </p>
      </div>

      {/* Volume Slider */}
      <div style={{ marginBottom: '20px' }}>
        <label className="form-label">볼륨: {Math.round(volume * 100)}%</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999' }}>
          <span>0% (음소거)</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Enable Toggle */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
          <input
            type="checkbox"
            checked={bgmEnabled}
            onChange={(e) => setBgmEnabled(e.target.checked)}
            style={{ width: '16px', height: '16px' }}
          />
          BGM 활성화 (최종 렌더링에 포함)
        </label>
      </div>

      {/* Save Button */}
      <button className="btn-gradient" onClick={handleSaveSettings} disabled={loading}>
        설정 저장
      </button>

      {/* Preview */}
      {audioSrc && (
        <div className="result-panel" style={{ marginTop: '24px' }}>
          <h3>BGM 미리듣기</h3>
          <audio controls src={audioSrc} style={{ width: '100%', marginBottom: '12px' }} />
          <div className="download-row">
            <a href={dlUrl} className="btn-download" download>
              다운로드
            </a>
          </div>
        </div>
      )}
    </ProjectLayout>
  );
}
