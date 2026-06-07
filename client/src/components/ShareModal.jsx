import React, { useState } from 'react';
import { triggerTactileFeedback } from '../utils/tactile';

export default function ShareModal({ onClose, shareDetails }) {
  const [copied, setCopied] = useState(false);

  if (!shareDetails) return null;

  // 1. Resolve the URL dynamically based on location
  const isCloud = window.location.hostname !== 'localhost' && 
                  !window.location.hostname.startsWith('192.168.') && 
                  !window.location.hostname.startsWith('127.0.0.');
                  
  const shareUrl = isCloud ? window.location.origin : (shareDetails.url || window.location.origin);
  
  // 2. Generate custom-colored amber/dark-brown QR code for cloud, fallback to server base64 QR for local sync
  const qrCodeSrc = isCloud 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=255-210-148&bgcolor=15-10-5&data=${encodeURIComponent(shareUrl)}`
    : (shareDetails.qrCode || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=255-210-148&bgcolor=15-10-5&data=${encodeURIComponent(shareUrl)}`);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 3. Web Share API support detection
  const canShare = !!navigator.share;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ROAD DJ',
          text: 'Приєднуйся до моєї кабіни ROAD DJ! 🚚🎶 Слухаємо музику разом:',
          url: shareUrl,
        });
      } catch (err) {
        // Suppress abort errors from user cancelling the share sheet
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="dashboard-bezel modal-content carbon-panel" 
        onClick={(e) => e.stopPropagation()}
        style={{ padding: '20px' }}
      >
        <div className="modal-header">
          <div className="modal-title">
            {isCloud ? 'ХМАРНЕ ПОДІЛИТИСЬ' : 'СИНХРОНІЗАЦІЯ З ТЕЛЕФОНОМ'}
          </div>
          <button 
            className="song-action-btn delete" 
            onClick={() => {
              triggerTactileFeedback('button_press');
              onClose();
            }} 
            style={{ fontSize: '18px' }}
          >
            ✕
          </button>
        </div>
        
        <div className="modal-body">
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', margin: '0 0 12px 0' }}>
            {isCloud 
              ? 'Відскануйте QR-код, щоб відкрити цей плейлист на будь-якому пристрої через мобільний інтернет:'
              : 'Підключіть телефон до того ж самого Wi-Fi, що й комп\'ютер, та відскануйте QR-код нижче:'
            }
          </p>

          <div className={`qr-code-bezel ${isCloud ? 'cloud-qr' : ''}`}>
            <img 
              src={qrCodeSrc} 
              alt="QR Code to Sync" 
              className="qr-code-img"
            />
          </div>

          <div style={{ width: '100%', marginTop: '14px' }}>
            <label className="cb-toggle-label" style={{ display: 'block', marginBottom: '6px', fontSize: '9px', textAlign: 'left' }}>
              {isCloud ? 'Посилання на хмарний плеєр:' : 'Пряме посилання:'}
            </label>
            <div className="share-url-container">
              <input 
                type="text" 
                readOnly 
                value={shareUrl} 
                className="share-url-input"
              />
              <button 
                className="industrial-btn" 
                onClick={() => {
                  triggerTactileFeedback('button_press');
                  handleCopy();
                }} 
                style={{ padding: '10px 14px', fontSize: '11px', whiteSpace: 'nowrap' }}
              >
                {copied ? 'КОПІЯ' : 'КОПІЮВАТИ'}
              </button>
            </div>
          </div>
          
          {canShare && (
            <button 
              className="industrial-btn" 
              onClick={() => {
                triggerTactileFeedback('button_press');
                handleShare();
              }}
              style={{ 
                width: '100%', 
                marginTop: '12px', 
                background: 'linear-gradient(to bottom, #ffd294, #e5b376)', 
                color: '#161008', 
                fontWeight: 'bold',
                boxShadow: '0 3px 6px rgba(0,0,0,0.4)',
                border: '1.5px solid #b78a50'
              }}
            >
              🚀 НАДІСЛАТИ ДРУЗЯМ
            </button>
          )}

          {/* Add to Home Screen Instructions */}
          <div className="a2hs-bezel" style={{ width: '100%', marginTop: '16px', padding: '12px', border: '1.5px solid #4a3e35', borderRadius: '6px', background: 'rgba(0,0,0,0.4)', textAlign: 'left', boxSizing: 'border-box' }}>
            <div className="cb-toggle-label" style={{ fontSize: '9px', marginBottom: '8px', color: '#ffd294', letterSpacing: '0.5px' }}>
              📲 ЯК ДОДАТИ НА ГОЛОВНИЙ ЕКРАН:
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '10px', color: '#8c9ba5', lineHeight: '1.4' }}>
              <div style={{ borderBottom: '1px solid rgba(255,210,148,0.08)', paddingBottom: '6px' }}>
                <strong style={{ color: '#ffffff', display: 'block', marginBottom: '2px' }}>Apple iOS (Safari):</strong>
                Натисніть кнопку <strong>«Поділитися»</strong> (іконка <span style={{ fontSize: '12px' }}>📤</span> внизу екрана) ➔ виберіть <strong>«Додати на початковий екран»</strong> (<span style={{ fontSize: '11px' }}>➕</span>).
              </div>

              <div>
                <strong style={{ color: '#ffffff', display: 'block', marginBottom: '2px' }}>Android (Chrome/Opera):</strong>
                Натисніть <strong>«Три крапки»</strong> (<span style={{ fontSize: '12px' }}>⋮</span>) вгорі праворуч ➔ виберіть <strong>«Додати на головний екран»</strong> або <strong>«Встановити»</strong>.
              </div>
            </div>
          </div>

          <button 
            className="industrial-btn" 
            onClick={() => {
              triggerTactileFeedback('button_press');
              onClose();
            }}
            style={{ width: '100%', marginTop: '14px' }}
          >
            ГОТОВО
          </button>
        </div>
      </div>
      {copied && <div className="toast">Посилання скопійовано!</div>}
    </div>
  );
}
