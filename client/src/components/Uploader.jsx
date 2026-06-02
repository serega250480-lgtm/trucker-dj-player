import React, { useRef, useState } from 'react';

export default function Uploader({ onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = async (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(Array.from(e.target.files));
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const uploadFiles = async (files) => {
    const audioFiles = files.filter(file => file.type.startsWith('audio/') || file.name.endsWith('.mp3') || file.name.endsWith('.wav'));
    
    if (audioFiles.length === 0) {
      setError('Можна завантажувати тільки аудіофайли!');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress('0%');

    const formData = new FormData();
    audioFiles.forEach(file => {
      formData.append('audio', file);
    });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/playlist/upload');

    // Track upload progress in real-time
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(`${percentComplete}%`);
      }
    };

    xhr.onload = () => {
      setUploading(false);
      setUploadProgress('');
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const addedSongs = JSON.parse(xhr.responseText);
          onUploadSuccess(addedSongs);
        } catch (e) {
          console.error('Error parsing upload response:', e);
          setError('Помилка обробки файлів сервером');
          setTimeout(() => setError(null), 4000);
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          setError(errData.error || 'Помилка завантаження');
        } catch (e) {
          setError('Помилка завантаження');
        }
        setTimeout(() => setError(null), 4000);
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setUploadProgress('');
      setError('Помилка мережі при завантаженні');
      setTimeout(() => setError(null), 4000);
    };

    xhr.send(formData);
  };

  return (
    <div className="chrome-bezel" style={{ padding: '4px', position: 'relative', overflow: 'hidden' }}>
      <div className="brass-rivet" style={{ top: '6px', left: '6px' }} />
      <div className="brass-rivet" style={{ top: '6px', right: '6px' }} />
      <div className="brass-rivet" style={{ bottom: '6px', left: '6px' }} />
      <div className="brass-rivet" style={{ bottom: '6px', right: '6px' }} />
      <div className="wood-grain-overlay" />
      
      <div 
        className={`upload-bezel ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          multiple
          accept="audio/*" 
          style={{ display: 'none' }}
          onChange={handleChange}
        />
        
        <div className="upload-icon">
          {uploading ? '⌛' : '📻'}
        </div>
        
        <div className="upload-text">
          {uploading ? (
            <span style={{ color: 'var(--color-amber)' }}>ЗАВАНТАЖЕННЯ... ({uploadProgress})</span>
          ) : (
            'ДОДАТИ ПІСНЮ З ПК'
          )}
        </div>
        
        <div className="upload-subtext">
          {error ? (
            <span style={{ color: 'var(--color-red)' }}>{error}</span>
          ) : (
            'Перетягніть аудіо або натисніть сюди'
          )}
        </div>
      </div>
    </div>
  );
}
