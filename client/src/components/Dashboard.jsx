import React, { useEffect, useState, useRef } from 'react';
import { triggerTactileFeedback } from '../utils/tactile';

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
  onShuffleChange = () => {},
  isFlickerActive = true,
  onFlickerChange = () => {},
  isAdmin = false,
  isForceUpdating = false,
  onForceUpdate = () => {}
}) {
  const [rotation, setRotation] = useState(0);
  const lastVolTickRef = useRef(volume);

  useEffect(() => {
    const diff = Math.abs(volume - lastVolTickRef.current);
    if (diff >= 0.04) {
      triggerTactileFeedback('dial_tick');
      lastVolTickRef.current = volume;
    }
  }, [volume]);

  // Animate volume knob rotation based on level
  // Volume range 0 to 1. Rotate from -135deg to +135deg (270 degrees total)
  const volumeAngle = -135 + volume * 270;

  const formatTime = (time) => {
    if (isNaN(time)) return '00:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Swipe to next song states and event handlers
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const bannerRef = useRef(null);

  const handleTouchStart = (e) => {
    if (e.target.closest('button')) return;
    startXRef.current = e.touches[0].clientX;
    setIsSwiping(true);
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current) return;
    const clientX = e.touches[0].clientX;
    const deltaX = clientX - startXRef.current;
    
    // Allow both left and right swiping!
    if (e.cancelable) e.preventDefault();
    setOffsetX(deltaX);
    const width = bannerRef.current ? bannerRef.current.offsetWidth : 300;
    setOpacity(Math.max(0.1, 1 - (Math.abs(deltaX) / width)));
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    
    const threshold = 80; // trigger skip threshold
    const width = bannerRef.current ? bannerRef.current.offsetWidth : 300;
    
    // Check if it is a simple tap (very small movement)
    if (Math.abs(offsetX) < 8) {
      triggerTactileFeedback('button_press');
      onPlayPause();
      setIsSwiping(false);
      setOffsetX(0);
      setOpacity(1);
      return;
    }
    
    if (offsetX > threshold) {
      // Swipe Right -> Next Song
      triggerTactileFeedback('button_press');
      setIsSwiping(false);
      setOffsetX(width);
      setOpacity(0);
      
      // Complete slide-out right transition
      setTimeout(() => {
        onNext();
        // Immediately snap to left off-screen for the new track
        setOffsetX(-width);
        setOpacity(0);
        
        // Slide in from left
        setTimeout(() => {
          setOffsetX(0);
          setOpacity(1);
        }, 50);
      }, 350);
    } else if (offsetX < -threshold) {
      // Swipe Left -> Prev Song
      triggerTactileFeedback('button_press');
      setIsSwiping(false);
      setOffsetX(-width);
      setOpacity(0);
      
      // Complete slide-out left transition
      setTimeout(() => {
        onPrev();
        // Immediately snap to right off-screen for the new track
        setOffsetX(width);
        setOpacity(0);
        
        // Slide in from right
        setTimeout(() => {
          setOffsetX(0);
          setOpacity(1);
        }, 50);
      }, 350);
    } else {
      // Spring back to original center
      setIsSwiping(false);
      setOffsetX(0);
      setOpacity(1);
    }
  };

  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return;
    startXRef.current = e.clientX;
    setIsSwiping(true);
    isDraggingRef.current = true;
    
    const handleMouseMove = (event) => {
      if (!isDraggingRef.current) return;
      const deltaX = event.clientX - startXRef.current;
      setOffsetX(deltaX);
      const w = bannerRef.current ? bannerRef.current.offsetWidth : 300;
      setOpacity(Math.max(0.1, 1 - (Math.abs(deltaX) / w)));
    };
    
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      
      const threshold = 80;
      const w = bannerRef.current ? bannerRef.current.offsetWidth : 300;
      
      if (Math.abs(offsetX) < 8) {
        triggerTactileFeedback('button_press');
        onPlayPause();
        setIsSwiping(false);
        setOffsetX(0);
        setOpacity(1);
        return;
      }
      
      if (offsetX > threshold) {
        // Swipe Right -> Next Song
        triggerTactileFeedback('button_press');
        setIsSwiping(false);
        setOffsetX(w);
        setOpacity(0);
        
        setTimeout(() => {
          onNext();
          setOffsetX(-w);
          setOpacity(0);
          
          setTimeout(() => {
            setOffsetX(0);
            setOpacity(1);
          }, 50);
        }, 350);
      } else if (offsetX < -threshold) {
        // Swipe Left -> Prev Song
        triggerTactileFeedback('button_press');
        setIsSwiping(false);
        setOffsetX(-w);
        setOpacity(0);
        
        setTimeout(() => {
          onPrev();
          setOffsetX(w);
          setOpacity(0);
          
          setTimeout(() => {
            setOffsetX(0);
            setOpacity(1);
          }, 50);
        }, 350);
      } else {
        setIsSwiping(false);
        setOffsetX(0);
        setOpacity(1);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
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
    <div className="dashboard-integrated" style={{ display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 2, position: 'relative' }}>
      
      {/* LCD Track Screen with dynamic album artwork background fill */}
      <div 
        ref={bannerRef}
        className="digital-display" 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        style={{ 
          backgroundColor: '#0e1114',
          border: '4px solid #1a1613',
          padding: '0',
          overflow: 'hidden',
          position: 'relative',
          cursor: isSwiping ? 'grabbing' : 'grab',
          userSelect: 'none',
          height: '115px'
        }}
      >
        {/* Layer 1: Sliding Dynamic Album Artwork Background */}
        <div 
          className="digital-display-artwork-bg"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage: currentSong && currentSong.artworkUrl 
              ? `linear-gradient(rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.85) 100%), url(${currentSong.artworkUrl})` 
              : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: `translateX(${offsetX}px)`,
            opacity: opacity,
            transition: isSwiping ? 'none' : 'transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.35s ease-out',
            zIndex: 1
          }}
        />

        {/* Layer 2: Stationary Large Play/Pause Centered Indicator */}
        <div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: isPlaying ? '30px' : '36px',
            color: '#14ff73',
            opacity: 0.08,
            pointerEvents: 'none',
            zIndex: 2,
            fontFamily: 'monospace',
            transition: 'all 0.3s ease-in-out',
            textShadow: '0 0 10px rgba(20, 255, 115, 0.8)'
          }}
        >
          {isPlaying ? '▮▮' : '▶'}
        </div>

        {/* Layer 3: Sliding Track Title in the Center */}
        <div 
          style={{ 
            position: 'absolute', 
            top: '46px', 
            left: '14px', 
            right: '14px', 
            height: '24px', 
            overflow: 'hidden', 
            zIndex: 3,
            transform: `translateX(${offsetX}px)`,
            opacity: opacity,
            transition: isSwiping ? 'none' : 'transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.35s ease-out',
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}
        >
          <div 
            className="display-amber" 
            style={{ 
              fontSize: '16px', 
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-digital)',
              textAlign: 'center'
            }}
          >
            {currentSong ? currentSong.title : 'NO TRACK LOADED - WAITING...'}
          </div>
        </div>

        {/* Layer 4: Stationary Top Header Row & Bottom Durations */}
        {/* Top Header Row */}
        <div 
          style={{ 
            position: 'absolute', 
            top: '14px', 
            left: '14px', 
            right: '14px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            zIndex: 4,
            pointerEvents: 'none'
          }}
        >
          <span className="display-green" style={{ fontSize: '10px', letterSpacing: '1px' }}>FM RADIO STAGE</span>
          <span className="display-amber" style={{ fontSize: '10px' }}>
            CROSSFADE: {crossfadeDuration}s
          </span>
        </div>
        
        {/* Bottom Clocks Row */}
        <div 
          style={{ 
            position: 'absolute', 
            bottom: '14px', 
            left: '14px', 
            right: '14px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            zIndex: 4,
            pointerEvents: 'none'
          }}
        >
          <div className="display-green" style={{ fontSize: '18px', letterSpacing: '2px' }}>
            {formatTime(currentTime)}
          </div>
          <div className="display-green" style={{ fontSize: '18px', letterSpacing: '2px' }}>
            {formatTime(totalDuration)}
          </div>
        </div>
      </div>

      {/* Middle Section: Progress, Volume, and Auto DJ Toggle */}
      <div className="dashboard-middle-section" style={{ display: 'flex', gap: '16px', alignItems: 'center', zIndex: 2, position: 'relative' }}>
        
        {/* Left Column: Progress and Volume */}
        <div className="dashboard-sliders-col" style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '14px' }}>
          
          {/* Song Progress Timeline Scroller */}
          <div 
            className="dashboard-bezel" 
            style={{ 
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
                onChange={(e) => {
                  onSeek(Number(e.target.value));
                  triggerTactileFeedback('dial_tick');
                }}
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
            
            <div className="vintage-toggle-base" onClick={() => {
              triggerTactileFeedback(crossfadeDuration > 0 ? 'switch_off' : 'switch_on');
              onCrossfadeChange(crossfadeDuration > 0 ? 0 : 5);
            }}>
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
            
            <div className="vintage-toggle-base" onClick={() => {
              triggerTactileFeedback(isNightDrive ? 'switch_off' : 'switch_on');
              onNightDriveChange(!isNightDrive);
            }}>
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
            
            <div className="vintage-toggle-base" onClick={() => {
              triggerTactileFeedback(isShuffle ? 'switch_off' : 'switch_on');
              onShuffleChange(!isShuffle);
            }}>
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

          {/* 4. NEON FLICKER Switch */}
          <div className="vintage-toggle-wood">
            <div className="vintage-toggle-title">NEON<br/>FLICKER</div>
            <div className={`vintage-toggle-light ${isFlickerActive ? 'active' : ''}`} />
            <div className="vintage-toggle-label" style={{ marginTop: '2px' }}>ON</div>
            
            <div className="vintage-toggle-base" onClick={() => {
              triggerTactileFeedback(isFlickerActive ? 'switch_off' : 'switch_on');
              onFlickerChange(!isFlickerActive);
            }}>
              <div className="vintage-toggle-hex">
                <div className="vintage-toggle-ring-1">
                  <div className="vintage-toggle-ring-2">
                    <div className={`vintage-toggle-stalk ${isFlickerActive ? 'on' : 'off'}`} />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="vintage-toggle-label" style={{ marginTop: '0px' }}>OFF</div>
          </div>

          {/* 5. FORCE UPDATE Switch (Admin Only) */}
          {isAdmin && (
            <div className="vintage-toggle-wood">
              <div className="vintage-toggle-title">FORCE<br/>UPDATE</div>
              <div className={`vintage-toggle-light ${isForceUpdating ? 'active' : ''}`} />
              <div className="vintage-toggle-label" style={{ marginTop: '2px' }}>ON</div>
              
              <div className="vintage-toggle-base" onClick={() => {
                if (!isForceUpdating) {
                  triggerTactileFeedback('switch_on');
                  onForceUpdate();
                }
              }}>
                <div className="vintage-toggle-hex">
                  <div className="vintage-toggle-ring-1">
                    <div className="vintage-toggle-ring-2">
                      <div className={`vintage-toggle-stalk ${isForceUpdating ? 'on' : 'off'}`} />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="vintage-toggle-label" style={{ marginTop: '0px' }}>OFF</div>
            </div>
          )}
        </div>

      </div>

      {/* Centered Playback Controls */}
      <div className="dashboard-playback-strip" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '32px', margin: '8px 0', zIndex: 2 }}>
        {/* Mechanical Prev Button */}
        <button 
          className="industrial-btn-square" 
          onClick={() => {
            triggerTactileFeedback('button_press');
            onPrev();
          }}
          title="Попередня пісня"
        >
          ⏮
        </button>

        {/* Heavy Play/Pause Center Trigger */}
        <button 
          className={`play-btn-square ${isPlaying ? 'active' : ''}`}
          onClick={() => {
            triggerTactileFeedback('button_press');
            onPlayPause();
          }}
          title={isPlaying ? 'Пауза' : 'Грати'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* Mechanical Next Button */}
        <button 
          className="industrial-btn-square" 
          onClick={() => {
            triggerTactileFeedback('button_press');
            onNext();
          }}
          title="Наступна пісня"
        >
          ⏭
        </button>
      </div>

    </div>
  );
}
