import React, { useEffect, useRef, useState } from 'react';

export default function Visualizer({ 
  isPlaying, 
  analyser, 
  onShareClick, 
  onUploadSuccess,
  showToast,
  songs = [] 
}) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const needleValueRef = useRef(0);
  const totalPlaytimeRef = useRef(0); // Total listening playtime in seconds
  const lastFrameTimeRef = useRef(Date.now());
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    let height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.resetTransform();
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    window.addEventListener('resize', handleResize);

    // Audio Analysis buffer
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      
      // Calculate delta time for precise playtime tracking
      const now = Date.now();
      const delta = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      // Clear canvas
      ctx.fillStyle = '#0f1114';
      ctx.fillRect(0, 0, w, h);

      // 1. Get real volume level from Web Audio analyser
      let targetLevel = 0;
      if (isPlaying) {
        if (analyser && dataArray) {
          analyser.getByteFrequencyData(dataArray);
          
          // Calculate average of low-to-mid range frequencies (bass and beats drive the speedometer!)
          let sum = 0;
          const range = Math.min(dataArray.length, 64); // focus on lower 64 bins (bass/vocals)
          for (let i = 0; i < range; i++) {
            sum += dataArray[i];
          }
          targetLevel = sum / range / 160; // Normalize
        } else {
          // Fallback simulation (smooth bouncy behavior)
          targetLevel = 0.25 + Math.sin(Date.now() * 0.007) * 0.15 + Math.random() * 0.1;
          if (Math.random() > 0.94) targetLevel = Math.min(1.0, targetLevel + 0.3); // simulated beat spike
        }

        // Increment total playtime in seconds when playing
        totalPlaytimeRef.current += delta;
      } else {
        // Paused level decay
        targetLevel = 0.0;
      }

      // Smooth needle lag (physics-based speedometer dampening)
      needleValueRef.current += (targetLevel - needleValueRef.current) * 0.18;
      const finalLevel = Math.max(0, Math.min(1.1, needleValueRef.current));

      // 2. Draw Speedometer
      drawSpeedometer(ctx, w, h, finalLevel);

      animationRef.current = requestAnimationFrame(draw);
    };

    const drawSpeedometer = (c, w, h, level) => {
      const cx = w / 2;
      const cy = h * 0.85;
      const r = Math.min(w * 0.44, h * 0.72);

      c.save();

      // Gauge face gradient
      c.beginPath();
      c.arc(cx, cy, r, Math.PI * 0.9, Math.PI * 2.1);
      c.lineTo(cx, cy);
      c.closePath();
      
      const faceGrad = c.createRadialGradient(cx, cy - r * 0.3, r * 0.2, cx, cy - r * 0.3, r);
      faceGrad.addColorStop(0, '#1a1f26');
      faceGrad.addColorStop(0.8, '#12151a');
      faceGrad.addColorStop(1, '#0b0c0e');
      c.fillStyle = faceGrad;
      c.fill();

      // Outer Chrome Ring
      c.beginPath();
      c.arc(cx, cy, r, Math.PI * 0.9, Math.PI * 2.1);
      c.strokeStyle = '#2b313a';
      c.lineWidth = 4;
      c.stroke();

      c.beginPath();
      c.arc(cx, cy, r + 2, Math.PI * 0.9, Math.PI * 2.1);
      c.strokeStyle = '#4a5361';
      c.lineWidth = 1;
      c.stroke();

      // Scale markings (0 to 160 km/h)
      const startAngle = Math.PI * 1.05;
      const endAngle = Math.PI * 1.95;
      const angleRange = endAngle - startAngle;

      c.textAlign = 'center';
      c.textBaseline = 'middle';

      for (let i = 0; i <= 80; i++) {
        const angle = startAngle + (i / 80) * angleRange;
        const isMajor = i % 10 === 0;
        const isMedium = i % 5 === 0 && !isMajor;
        
        const tickStart = isMajor ? r - 16 : (isMedium ? r - 10 : r - 6);
        const tickColor = i >= 65 ? '#ff3333' : '#a0aec0'; // Redline at 130 km/h

        c.beginPath();
        c.moveTo(cx + Math.cos(angle) * tickStart, cy + Math.sin(angle) * tickStart);
        c.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
        c.strokeStyle = tickColor;
        c.lineWidth = isMajor ? 2.5 : 1;
        c.stroke();

        // Major numbers
        if (isMajor) {
          const speedVal = i * 2; // scale maps 0 to 160
          const numX = cx + Math.cos(angle) * (r - 28);
          const numY = cy + Math.sin(angle) * (r - 28);

          c.font = '900 11px "Orbitron"';
          c.fillStyle = i >= 65 ? '#ff4d4d' : '#e2e8f0';
          c.fillText(speedVal.toString(), numX, numY);
        }
      }

      // Redline warning arc
      c.beginPath();
      c.arc(cx, cy, r - 3, startAngle + (65 / 80) * angleRange, endAngle, false);
      c.strokeStyle = 'rgba(255, 51, 51, 0.6)';
      c.lineWidth = 3;
      c.stroke();

      // Brand logo
      c.font = 'bold 8px "Orbitron"';
      c.fillStyle = '#4a5568';
      c.fillText('ROAD BEAST', cx, cy - r * 0.72);

      c.font = 'bold 9px "Share Tech Mono"';
      c.fillStyle = 'var(--color-amber)';
      c.shadowColor = 'rgba(255, 132, 0, 0.4)';
      c.shadowBlur = 4;
      c.fillText('km/h (dB)', cx, cy - r * 0.5);
      c.shadowBlur = 0; // reset

      // 3. Draw Odometer box (Mileage counter)
      const odoW = 75;
      const odoH = 16;
      const odoX = cx - odoW / 2;
      const odoY = cy - r * 0.28;

      // Odo background
      c.fillStyle = '#080a0d';
      c.fillRect(odoX, odoY, odoW, odoH);
      c.strokeStyle = '#3e4652';
      c.lineWidth = 1.5;
      c.strokeRect(odoX, odoY, odoW, odoH);

      // Format total playlist duration in minutes and seconds (e.g., "01530.0" representing 15 minutes, 30 seconds, 0 tenths)
      const totalPlaylistDuration = songs && songs.length > 0
        ? songs.reduce((sum, s) => sum + (s.duration || 0), 0)
        : 0;
      
      const mins = Math.floor(totalPlaylistDuration / 60);
      const secs = Math.floor(totalPlaylistDuration % 60);
      const tenths = 0;
      
      const minsStr = String(mins).padStart(4, '0');
      const secsStr = String(secs).padStart(2, '0');
      const mileageStr = `${minsStr}.${secsStr}`; // e.g. "0015.30"
      c.font = 'bold 11px "Share Tech Mono"';
      c.textAlign = 'left';
      c.textBaseline = 'top';
      
      const digitW = odoW / 7;
      for (let d = 0; d < 7; d++) {
        const char = mileageStr[d];
        const isDecimal = d === 4;
        const charX = odoX + d * digitW + 2;

        // Grid lines for numbers
        if (d > 0) {
          c.beginPath();
          c.moveTo(odoX + d * digitW, odoY);
          c.lineTo(odoX + d * digitW, odoY + odoH);
          c.strokeStyle = '#222';
          c.lineWidth = 0.5;
          c.stroke();
        }

        // Draw digit
        c.fillStyle = d >= 5 ? '#ff3333' : '#00ff66'; // seconds (indices 5,6) are red, others green
        c.fillText(char, charX, odoY + 2);
      }

      // 4. Draw Warning Dashboard Lights
      drawIndicatorLights(c, cx, cy, r, level);

      // 5. Draw speedometer center hub
      c.beginPath();
      c.arc(cx, cy, r * 0.16, 0, Math.PI * 2);
      c.fillStyle = '#16191f';
      c.fill();
      c.strokeStyle = '#2d333f';
      c.lineWidth = 2;
      c.stroke();

      // 6. Draw Swinging Needle
      // Level maps from 0.0 to 1.0 (speed 0 to 160)
      const needleAngle = startAngle + level * angleRange;
      const needleLen = r - 12;

      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(needleAngle) * needleLen, cy + Math.sin(needleAngle) * needleLen);
      c.strokeStyle = '#ff2b2b';
      c.lineWidth = 2.5;
      c.lineCap = 'round';
      
      // Needle shadow
      c.shadowColor = 'rgba(0,0,0,0.6)';
      c.shadowBlur = 6;
      c.shadowOffsetX = 2;
      c.shadowOffsetY = 3;
      c.stroke();
      c.shadowColor = 'transparent'; // reset
      c.shadowBlur = 0;
      c.shadowOffsetX = 0;
      c.shadowOffsetY = 0;

      // Small hub cap
      c.beginPath();
      c.arc(cx, cy, 10, 0, Math.PI * 2);
      c.fillStyle = '#090a0c';
      c.fill();
      c.strokeStyle = '#ff2b2b';
      c.lineWidth = 1;
      c.stroke();

      c.restore();
    };

    const drawIndicatorLights = (c, cx, cy, r, level) => {
      c.save();
      c.textAlign = 'center';
      
      // Indicators Y position
      const indY = cy - r * 0.12;

      // 1. Left Turn Arrow (flashes on deep beats, positioned under the 0 mark, shifted 20px lower and 20px left)
      const leftArrowActive = isPlaying && Math.sin(Date.now() * 0.015) > 0.4 && level > 0.4;
      const arrowLX = cx + Math.cos(Math.PI * 1.07) * (r - 46) - 20;
      const arrowLY = cy + Math.sin(Math.PI * 1.07) * (r - 46) + 20;
      
      c.beginPath();
      c.moveTo(arrowLX - 6, arrowLY);
      c.lineTo(arrowLX, arrowLY - 4);
      c.lineTo(arrowLX, arrowLY - 1.5);
      c.lineTo(arrowLX + 6, arrowLY - 1.5);
      c.lineTo(arrowLX + 6, arrowLY + 1.5);
      c.lineTo(arrowLX, arrowLY + 1.5);
      c.lineTo(arrowLX, arrowLY + 4);
      c.closePath();
      c.fillStyle = leftArrowActive ? '#00ff66' : '#222e26';
      if (leftArrowActive) {
        c.shadowColor = '#00ff66';
        c.shadowBlur = 5;
      }
      c.fill();
      c.shadowBlur = 0;

      // 2. Right Turn Arrow (flashes on deep beats, positioned under the 160 mark, shifted 20px lower and 20px right)
      const rightArrowActive = isPlaying && Math.cos(Date.now() * 0.015) > 0.4 && level > 0.4;
      const arrowRX = cx + Math.cos(Math.PI * 1.93) * (r - 46) + 20;
      const arrowRY = cy + Math.sin(Math.PI * 1.93) * (r - 46) + 20;
      
      c.beginPath();
      c.moveTo(arrowRX + 6, arrowRY);
      c.lineTo(arrowRX, arrowRY - 4);
      c.lineTo(arrowRX, arrowRY - 1.5);
      c.lineTo(arrowRX - 6, arrowRY - 1.5);
      c.lineTo(arrowRX - 6, arrowRY + 1.5);
      c.lineTo(arrowRX, arrowRY + 1.5);
      c.lineTo(arrowRX, arrowRY + 4);
      c.closePath();
      c.fillStyle = rightArrowActive ? '#00ff66' : '#222e26';
      if (rightArrowActive) {
        c.shadowColor = '#00ff66';
        c.shadowBlur = 5;
      }
      c.fill();
      c.shadowBlur = 0;

      // 3. High Beam Light (Blue - active when volume/bass is high)
      const highBeamActive = isPlaying && level > 0.82;
      c.beginPath();
      c.arc(cx, indY, 4, 0, Math.PI * 2);
      c.fillStyle = highBeamActive ? '#0077ff' : '#0e1724';
      if (highBeamActive) {
        c.shadowColor = '#0077ff';
        c.shadowBlur = 6;
      }
      c.fill();
      c.shadowBlur = 0;

      c.font = '900 6px "Inter"';
      c.fillStyle = highBeamActive ? '#94c5ff' : '#333';
      c.fillText('BEAM', cx, indY + 8);

      // 4. Oil Warning Light (Red - active when paused/no song)
      const oilActive = !isPlaying;
      c.beginPath();
      c.arc(cx - 52, indY, 3, 0, Math.PI * 2);
      c.fillStyle = oilActive ? '#ff3333' : '#2d1414';
      if (oilActive) {
        c.shadowColor = '#ff3333';
        c.shadowBlur = 5;
      }
      c.fill();
      c.shadowBlur = 0;

      c.fillStyle = oilActive ? '#ff9999' : '#333';
      c.fillText('PAUSED', cx - 52, indY + 7);

      // 5. Check Engine Light (Amber - active when volume is completely muted)
      const checkEngineActive = isPlaying && level < 0.05;
      c.beginPath();
      c.arc(cx + 52, indY, 3, 0, Math.PI * 2);
      c.fillStyle = checkEngineActive ? '#ff8400' : '#2d2014';
      if (checkEngineActive) {
        c.shadowColor = '#ff8400';
        c.shadowBlur = 5;
      }
      c.fill();
      c.shadowBlur = 0;

      c.fillStyle = checkEngineActive ? '#ffb366' : '#333';
      c.fillText('IDLE', cx + 52, indY + 7);

      c.restore();
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [isPlaying, analyser]);

  const onUploadButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(Array.from(e.target.files));
    }
  };

  const uploadFiles = async (files) => {
    const audioFiles = files.filter(file => 
      file.type.startsWith('audio/') || 
      file.name.endsWith('.mp3') || 
      file.name.endsWith('.wav')
    );
    
    if (audioFiles.length === 0) {
      if (showToast) showToast('МОЖНА ЗАВАНТАЖУВАТИ ТІЛЬКИ АУДІОФАЙЛИ!');
      return;
    }

    setUploading(true);
    setUploadProgress('0%');

    const formData = new FormData();
    audioFiles.forEach(file => {
      formData.append('audio', file);
    });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/playlist/upload');

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
          if (showToast) showToast(`УСПІШНО ЗАВАНТАЖЕНО ${addedSongs.length} ПІСЕНЬ!`);
        } catch (e) {
          console.error('Error parsing upload response:', e);
          if (showToast) showToast('ПОМИЛКА ОБРОБКИ ФАЙЛІВ');
        }
      } else {
        if (showToast) showToast('ПОМИЛКА ЗАВАНТАЖЕННЯ');
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setUploadProgress('');
      if (showToast) showToast('ПОМИЛКА МЕРЕЖІ');
    };

    xhr.send(formData);
  };

  return (
    <div className="digital-display carbon-panel" style={{ height: '150px', padding: '4px', borderRadius: '10px', position: 'relative' }}>
      
      {/* Hidden file input for file selection */}
      <input 
        ref={fileInputRef}
        type="file" 
        multiple
        accept="audio/*" 
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Add Songs button in top-left corner */}
      <button 
        className="share-vu-btn"
        onClick={onUploadButtonClick}
        disabled={uploading}
        title="Додати аудіофайли з комп'ютера"
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
        }}
      >
        <span>{uploading ? '⌛' : '📻'}</span> {uploading ? `ЗАВАНТАЖЕННЯ (${uploadProgress})` : 'ДОДАТИ ПІСНЮ'}
      </button>

      {/* Share button in top-right corner */}
      <button 
        className="share-vu-btn"
        onClick={onShareClick}
        title="Поділитися плеером"
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
        }}
      >
        <span>🔗</span> ПОДІЛИТИСЬ
      </button>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', borderRadius: '4px' }} />
    </div>
  );
}
