import React, { useState } from 'react';

export default function ShareModal({ onClose, shareDetails }) {
  const [copied, setCopied] = useState(false);

  if (!shareDetails) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareDetails.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="dashboard-bezel modal-content carbon-panel" 
        onClick={(e) => e.stopPropagation()}
        style={{ padding: '20px' }}
      >
        <div className="modal-header">
          <div className="modal-title">СИНХРОНІЗАЦІЯ З ТЕЛЕФОНОМ</div>
          <button className="song-action-btn delete" onClick={onClose} style={{ fontSize: '18px' }}>
            ✕
          </button>
        </div>
        
        <div className="modal-body">
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Підключіть телефон до того ж самого **Wi-Fi**, що й комп'ютер, та відскануйте QR-код нижче:
          </p>

          {shareDetails.qrCode && (
            <div className="qr-code-bezel">
              <img 
                src={shareDetails.qrCode} 
                alt="QR Code to Sync" 
                className="qr-code-img"
              />
            </div>
          )}

          <div style={{ width: '100%' }}>
            <label className="cb-toggle-label" style={{ display: 'block', marginBottom: '6px', fontSize: '9px', textAlign: 'left' }}>
              Пряме посилання:
            </label>
            <div className="share-url-container">
              <input 
                type="text" 
                readOnly 
                value={shareDetails.url} 
                className="share-url-input"
              />
              <button className="industrial-btn" onClick={handleCopy} style={{ padding: '10px 14px', fontSize: '11px' }}>
                {copied ? 'КОПІЯ' : 'КЛІК'}
              </button>
            </div>
          </div>
          
          <button 
            className="industrial-btn" 
            onClick={onClose}
            style={{ width: '100%', marginTop: '8px' }}
          >
            ГОТОВО
          </button>
        </div>
      </div>
      {copied && <div className="toast">Посилання скопійовано!</div>}
    </div>
  );
}
