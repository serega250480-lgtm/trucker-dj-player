import React, { useEffect, useState } from 'react';

export default function Dashboard({ 
  currentSong, 
  isPlaying, 
  onPlayPause, 
  onNext, 
  onPrev,
  volume,
  onVolumeChange,
  crossfadeDuration,
  onCrossfadeChange,
  onShareClick,
  currentTime,
  totalDuration,
  onSeek,
  isNightDrive = false,
  onNightDriveChange = () => {},
  isShuffle = false,
  onShuffleChange = () => {}
}) {
  const [rotation, setRotation] = useState(0);

  // Animate volume knob rotation based on level
  // Volume range 0 to 1. Rotate from -135deg to +135deg (270 degrees total)
  const volumeAngle = -135 + volume * 270;

  const formatTime = (time) => {
    if (isNaN(time)) return '00:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Drag-to-roll horizontal metal thumbwheel volume control
  const handleWheelMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startVol = volume;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const volumeDelta = deltaX / 180; // Smooth sensitivity
      const newVol = Math.max(0, Math.min(1, startVol + volumeDelta));
      onVolumeChange(newVol);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Mobile touch swipe horizontal thumbwheel volume control
  const handleWheelTouchStart = (e) => {
    const startX = e.touches[0].clientX;
    const startVol = volume;

    const handleTouchMove = (moveEvent) => {
      const deltaX = moveEvent.touches[0].clientX - startX;
      const volumeDelta = deltaX / 140; // Highly responsive on phone
      const newVol = Math.max(0, Math.min(1, startVol + volumeDelta));
      onVolumeChange(newVol);
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  return (
    <div className="chrome-bezel" style={{ padding: '18px 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="brass-rivet" style={{ top: '6px', left: '6px' }} />
      <div className="brass-rivet" style={{ top: '6px', right: '6px' }} />
      <div className="brass-rivet" style={{ bottom: '6px', left: '6px' }} />
      <div className="brass-rivet" style={{ bottom: '6px', right: '6px' }} />
      <div className="wood-grain-overlay" />
      
      {/* LCD Track Screen with dynamic album artwork background fill */}
      <div 
        className="digital-display" 
        style={{ 
          backgroundImage: currentSong && currentSong.artworkUrl 
            ? `linear-gradient(rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.85) 100%), url(${currentSong.artworkUrl})` 
            : 'none',
          backgroundColor: '#0e1114',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transition: 'all 0.4s ease-in-out',
          border: currentSong && currentSong.artworkUrl ? '4px solid var(--color-amber)' : '4px solid #1a1613'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', zIndex: 2, position: 'relative' }}>
          <span className="display-green" style={{ fontSize: '10px', letterSpacing: '1px' }}>FM RADIO STAGE</span>
          <span className="display-amber" style={{ fontSize: '10px' }}>
            CROSSFADE: {crossfadeDuration}s
          </span>
        </div>
        
        {/* Track Title Scrolling Container */}
        <div style={{ height: '24px', overflow: 'hidden', position: 'relative', marginBottom: '10px', zIndex: 2 }}>
          <div 
            className="display-amber" 
            style={{ 
              fontSize: '16px', 
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-digital)'
            }}
          >
            {currentSong ? currentSong.title : 'NO TRACK LOADED - WAITING...'}
          </div>
        </div>

        {/* Dynamic Timing LCD */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2, position: 'relative' }}>
          <div className="display-green" style={{ fontSize: '18px', letterSpacing: '2px' }}>
            {formatTime(currentTime)}
          </div>
          <div className="display-green" style={{ fontSize: '18px', letterSpacing: '2px' }}>
            {formatTime(totalDuration)}
          </div>
        </div>
      </div>

      {/* Middle Section: Progress, Volume, and Auto DJ Toggle */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', zIndex: 2, position: 'relative' }}>
        
        {/* Left Column: Progress and Volume */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '14px' }}>
          
          {/* Song Progress Timeline Scroller */}
          <div 
            className="dashboard-bezel" 
            style={{ 
              background: 'rgba(0,0,0,0.4)', 
              border: '1.5px solid #2d343c', 
              padding: '10px 14px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '6px' 
            }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type="range"
                min="0"
                max={totalDuration || 0}
                value={currentTime || 0}
                onChange={(e) => onSeek(Number(e.target.value))}
                className="dashboard-slider"
                style={{ width: '100%', cursor: 'pointer', position: 'relative', zIndex: '2' }}
                title="Прокрутка пісні"
              />
            </div>
            <div 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '9px', 
                fontFamily: 'var(--font-digital)', 
                color: 'var(--text-muted)' 
              }}
            >
              <span>ПРОГРЕС ВІДТВОРЕННЯ</span>
              <span style={{ color: 'var(--color-amber)', fontWeight: 'bold' }}>
                {totalDuration > 0 ? `${Math.round((currentTime / totalDuration) * 100)}%` : '0%'}
              </span>
            </div>
          </div>

          {/* 3D Knurled Stainless Steel Horizontal Volume Roller Cylinder */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span className="cb-toggle-label" style={{ fontSize: '8px', color: '#ffd294' }}>
              VOLUME CONTROL: {Math.round(volume * 100)}%
            </span>
            <div className="horizontal-thumbwheel-slot">
              <div 
                className="horizontal-thumbwheel"
                onMouseDown={handleWheelMouseDown}
                onTouchStart={handleWheelTouchStart}
                style={{ backgroundPositionX: `${volume * 240}px` }}
                title="Прокрутка гучності (вліво-вправо)"
              />
            </div>
          </div>

        </div>

        {/* Right Column: Three Realistic Vintage 3D Toggle Switches directly on leather */}
        <div className="vintage-toggle-panel" style={{ flexShrink: 0 }}>
          {/* 1. AUTO DJ Switch */}
          <div className="vintage-toggle-wood">
            <div className="vintage-toggle-title">AUTO<br/>DJ</div>
            <div className={`vintage-toggle-light ${crossfadeDuration > 0 ? 'active' : ''}`} />
            <div className="vintage-toggle-label" style={{ marginTop: '2px' }}>ON</div>
            
            <div className="vintage-toggle-base" onClick={() => onCrossfadeChange(crossfadeDuration > 0 ? 0 : 5)}>
              <div className="vintage-toggle-hex">
                <div className="vintage-toggle-ring-1">
                  <div className="vintage-toggle-ring-2">
                    <div className={`vintage-toggle-stalk ${crossfadeDuration > 0 ? 'on' : 'off'}`} />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="vintage-toggle-label" style={{ marginTop: '0px' }}>OFF</div>
          </div>

          {/* 2. NIGHT DRIVE Switch */}
          <div className="vintage-toggle-wood">
            <div className="vintage-toggle-title">NIGHT<br/>DRIVE</div>
            <div className={`vintage-toggle-light ${isNightDrive ? 'active' : ''}`} />
            <div className="vintage-toggle-label" style={{ marginTop: '2px' }}>ON</div>
            
            <div className="vintage-toggle-base" onClick={() => onNightDriveChange(!isNightDrive)}>
              <div className="vintage-toggle-hex">
                <div className="vintage-toggle-ring-1">
                  <div className="vintage-toggle-ring-2">
                    <div className={`vintage-toggle-stalk ${isNightDrive ? 'on' : 'off'}`} />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="vintage-toggle-label" style={{ marginTop: '0px' }}>OFF</div>
          </div>

          {/* 3. MIX PLAYLIST Switch */}
          <div className="vintage-toggle-wood">
            <div className="vintage-toggle-title">MIX<br/>PLAYLIST</div>
            <div className={`vintage-toggle-light ${isShuffle ? 'active' : ''}`} />
            <div className="vintage-toggle-label" style={{ marginTop: '2px' }}>ON</div>
            
            <div className="vintage-toggle-base" onClick={() => onShuffleChange(!isShuffle)}>
              <div className="vintage-toggle-hex">
                <div className="vintage-toggle-ring-1">
                  <div className="vintage-toggle-ring-2">
                    <div className={`vintage-toggle-stalk ${isShuffle ? 'on' : 'off'}`} />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="vintage-toggle-label" style={{ marginTop: '0px' }}>OFF</div>
          </div>
        </div>

      </div>

      {/* Centered Playback Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '32px', margin: '8px 0', zIndex: 2 }}>
        {/* Mechanical Prev Button */}
        <button 
          className="industrial-btn-square" 
          onClick={onPrev}
          title="Попередня пісня"
        >
          ⏮
        </button>

        {/* Heavy Play/Pause Center Trigger */}
        <button 
          className={`play-btn-square ${isPlaying ? 'active' : ''}`}
          onClick={onPlayPause}
          title={isPlaying ? 'Пауза' : 'Грати'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* Mechanical Next Button */}
        <button 
          className="industrial-btn-square" 
          onClick={onNext}
          title="Наступна пісня"
        >
          ⏭
        </button>
      </div>

    </div>
  );
}
