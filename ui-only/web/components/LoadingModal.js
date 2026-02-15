/**
 * Global loading modal — shown during any API generation action
 */
export default function LoadingModal({ visible, text }) {
  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: 'white', borderRadius: '14px', padding: '40px 50px',
        textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
        minWidth: '260px',
      }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>
          {text || '생성 중입니다...'}
        </p>
        <p style={{ fontSize: '13px', color: '#999', marginTop: '8px' }}>
          잠시만 기다려주세요.
        </p>
      </div>
    </div>
  );
}
