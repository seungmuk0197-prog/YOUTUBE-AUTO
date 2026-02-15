import Head from 'next/head';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Component {...pageProps} />
      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
          background: #f5f5f5;
          color: #333;
          min-height: 100vh;
        }
        a { text-decoration: none; color: inherit; }

        /* ========== BUTTONS ========== */
        .btn-primary {
          display: inline-block;
          padding: 12px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          text-align: center;
        }
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102,126,234,0.35);
        }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .btn-secondary {
          padding: 10px 20px;
          border: 1px solid #e2e8f0;
          background: #fff;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #4a5568;
          transition: all 0.15s;
        }
        .btn-secondary:hover { background: #f7fafc; border-color: #b794f4; color: #553c9a; }
        .btn-download {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          color: #4a5568;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.15s;
        }
        .btn-download:hover { background: #edf2f7; border-color: #b794f4; }

        /* ========== FORMS ========== */
        .form-label {
          display: block;
          margin-bottom: 8px;
          color: #2d3748;
          font-weight: 600;
          font-size: 14px;
        }
        .form-input, .form-select, .form-textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          background: #fff;
          color: #2d3748;
        }
        .form-input:focus, .form-select:focus, .form-textarea:focus {
          outline: none;
          border-color: #b794f4;
          box-shadow: 0 0 0 3px rgba(183,148,244,0.15);
        }
        .form-textarea {
          min-height: 200px;
          resize: vertical;
        }

        /* ========== ALERTS ========== */
        .alert-error {
          background: #fff5f5;
          border: 1px solid #fc8181;
          color: #c53030;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 13px;
        }
        .alert-success {
          background: #f0fff4;
          border: 1px solid #68d391;
          color: #276749;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 13px;
        }
        .alert-info {
          background: #ebf8ff;
          border: 1px solid #63b3ed;
          color: #2b6cb0;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 13px;
        }
        .alert-warning {
          background: #fffaf0;
          border: 1px solid #f6ad55;
          color: #c05621;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 13px;
        }

        /* ========== RESULT PANEL ========== */
        .result-panel {
          margin-top: 20px;
          padding: 20px;
          background: #f7fafc;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
        }
        .result-panel h3 {
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 12px;
          color: #2d3748;
        }
        .download-row {
          display: flex;
          gap: 10px;
          margin-top: 12px;
          flex-wrap: wrap;
        }

        /* ========== SPINNER ========== */
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e2e8f0;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        /* ========== AI 자동화 프로젝트 UI ========== */
        .ai-section { margin-bottom: 24px; }
        .section-title {
          font-size: 18px;
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 8px;
        }
        .section-desc {
          font-size: 14px;
          color: #718096;
          margin-bottom: 16px;
          line-height: 1.5;
        }
        .btn-outline-dark {
          padding: 10px 18px;
          border: 1px solid #4a5568;
          background: #fff;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #2d3748;
          cursor: pointer;
        }
        .btn-outline-dark:hover { background: #f7fafc; border-color: #2d3748; }
        .topic-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .topic-tab {
          padding: 10px 18px;
          border: 1px solid #e2e8f0;
          background: #fff;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #4a5568;
          cursor: pointer;
          transition: all 0.2s;
        }
        .topic-tab:hover { border-color: #cbd5e0; background: #f7fafc; }
        .topic-tab.active {
          background: #fed7d7;
          border-color: #feb2b2;
          color: #c53030;
        }
        .topic-grid-wrap {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          gap: 12px;
        }
        .topic-category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 10px;
          flex: 1;
          min-width: 0;
        }
        .topic-category-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 14px 10px;
          border: 1px solid #e2e8f0;
          background: #fff;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          color: #2d3748;
          cursor: pointer;
          transition: all 0.2s;
        }
        .topic-category-btn:hover { border-color: #b794f4; background: #faf5ff; }
        .topic-cat-icon { font-size: 22px; }
        .topic-cat-label { text-align: center; line-height: 1.3; }
        .btn-deselect {
          padding: 8px 14px;
          border: 1px solid #e2e8f0;
          background: #f7fafc;
          border-radius: 6px;
          font-size: 13px;
          color: #718096;
          cursor: pointer;
          align-self: flex-start;
        }
        .btn-deselect:hover { background: #edf2f7; }
        .trend-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 12px;
        }
        .trend-date { font-size: 13px; color: #718096; }
        .trend-tabs { display: flex; gap: 8px; }
        .trend-tab {
          padding: 8px 16px;
          border: 1px solid #e2e8f0;
          background: #fff;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          color: #4a5568;
          cursor: pointer;
          transition: all 0.2s;
        }
        .trend-tab:hover { border-color: #cbd5e0; background: #f7fafc; }
        .trend-tab.active {
          background: #bee3f8;
          border-color: #90cdf4;
          color: #2b6cb0;
        }
        .flame { margin-left: 4px; }
        .trending-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }
        .trending-card {
          display: flex;
          gap: 14px;
          padding: 16px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          transition: all 0.2s;
        }
        .trending-card:hover { border-color: #cbd5e0; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .trending-rank {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #edf2f7;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #4a5568;
        }
        .trending-body { flex: 1; min-width: 0; }
        .trending-title {
          font-size: 15px;
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 8px;
          line-height: 1.3;
        }
        .trending-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .trending-category {
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #fff;
        }
        .trending-views { font-size: 12px; color: #718096; }
        .trending-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .trending-tag {
          padding: 2px 8px;
          background: #edf2f7;
          border-radius: 4px;
          font-size: 11px;
          color: #4a5568;
        }
      `}</style>
    </>
  );
}
