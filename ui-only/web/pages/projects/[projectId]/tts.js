import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import ProjectLayout from '../../../components/ProjectLayout';
import { apiGet, apiPost, previewUrl, downloadUrl } from '../../../lib/api';
import { unwrapProject, formatDuration } from '../../../lib/projectUtils';

const VOICES = [
  { value: 'ko-KR-SunHiNeural', label: 'SunHi (여성)' },
  { value: 'ko-KR-InJoonNeural', label: 'InJoon (남성)' },
  { value: 'ko-KR-HyunsuNeural', label: 'Hyunsu (남성)' },
  { value: 'ko-KR-BongJinNeural', label: 'BongJin (남성)' },
  { value: 'ko-KR-GookMinNeural', label: 'GookMin (남성)' },
  { value: 'ko-KR-JiMinNeural', label: 'JiMin (여성)' },
  { value: 'ko-KR-SeoHyeonNeural', label: 'SeoHyeon (여성)' },
  { value: 'ko-KR-SoonBokNeural', label: 'SoonBok (여성)' },
  { value: 'ko-KR-YuJinNeural', label: 'YuJin (여성)' },
];

export default function TTSPage() {
  const router = useRouter();
  const { projectId } = router.query;
  const audioRef = useRef(null);

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [voice, setVoice] = useState('ko-KR-SunHiNeural');
  const [speed, setSpeed] = useState(1.0);
  const [audioPath, setAudioPath] = useState('');
  const [duration, setDuration] = useState(null);

  useEffect(() => {
    if (projectId) loadProject();
  }, [projectId]);

  async function loadProject() {
    try {
      const data = await apiGet(`projects/${projectId}`);
      const p = unwrapProject(data);
      setProject(p);
      if (p?.settings?.tts?.voice) setVoice(p.settings.tts.voice);
      if (p?.scenes?.[0]?.audio_path) {
        setAudioPath(p.scenes[0].audio_path);
        setDuration(p.scenes[0].durationSec || null);
      }
    } catch (err) {
      setError('프로젝트를 불러올 수 없습니다: ' + err.message);
    }
  }

  const hasScript = project?.scenes?.[0]?.narration_ko || project?.scenes?.[0]?.text;

  async function handleGenerate() {
    if (!hasScript) {
      setError('먼저 대본을 작성해주세요.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const sceneId = project.scenes[0].id;
      const result = await apiPost(`projects/${projectId}/generate/tts`, {
        sceneId,
        speed,
      });
      setAudioPath(result.audioPath);
      setDuration(result.durationSec || null);
      setMessage('TTS 음성이 생성되었습니다.');
      await loadProject();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError('TTS 생성 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handlePlaybackRate(rate) {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }

  const audioSrc = audioPath ? previewUrl(projectId, audioPath) : '';
  const dlUrl = audioPath ? downloadUrl(projectId, audioPath) : '';

  return (
    <ProjectLayout projectId={projectId || ''} project={project} activeStep="tts" loading={loading}>
      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-success">{message}</div>}

      {!hasScript ? (
        <div className="alert-warning">
          <p style={{ marginBottom: '12px' }}>대본이 필요합니다. 먼저 대본을 작성해주세요.</p>
          <button className="btn-outline" onClick={() => router.push(`/projects/${projectId}/script`)}>
            대본 작성으로 이동
          </button>
        </div>
      ) : (
        <>
          {/* Voice Selector */}
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label">음성 선택</label>
            <select className="form-select" value={voice} onChange={(e) => setVoice(e.target.value)}>
              {VOICES.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Speed Control (generation speed — backend clamps 0.7~1.3) */}
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label">생성 속도: {speed.toFixed(1)}x</label>
            <input
              type="range"
              min="0.7"
              max="1.3"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999' }}>
              <span>0.7x (느림)</span>
              <span>1.0x (기본)</span>
              <span>1.3x (빠름)</span>
            </div>
          </div>

          {/* Generate Button */}
          <button className="btn-gradient" onClick={handleGenerate} disabled={loading}>
            {audioPath ? 'TTS 재생성' : 'TTS 생성'}
          </button>

          {/* Audio Result */}
          {audioSrc && (
            <div className="result-panel" style={{ marginTop: '24px' }}>
              <h3>생성된 음성</h3>

              {duration != null && (
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                  재생 시간: {formatDuration(duration)}
                </p>
              )}

              <audio
                ref={audioRef}
                controls
                src={audioSrc}
                style={{ width: '100%', marginBottom: '12px' }}
                onLoadedMetadata={(e) => {
                  if (!duration && e.target.duration && isFinite(e.target.duration)) {
                    setDuration(e.target.duration);
                  }
                }}
              />

              {/* Playback Speed */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                  재생 속도 조절
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handlePlaybackRate(rate)}
                      style={{
                        padding: '4px 10px', fontSize: '12px', border: '1px solid #ddd',
                        borderRadius: '4px', background: '#fff', cursor: 'pointer',
                      }}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="download-row">
                <a href={dlUrl} className="btn-download" download>
                  다운로드 (.mp3)
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </ProjectLayout>
  );
}
