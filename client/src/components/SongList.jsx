import React from 'react';
import { triggerTactileFeedback } from '../utils/tactile';

const ALLOWED_ALBUMS = [
  'UKRAINIAN VIBE MUSIC, Vol. 1',
  'UKRAINIAN VIBE MUSIC, Vol. 2',
  'UKRAINIAN VIBE MUSIC, Vol. 3',
  'ROAD VOL.1'
];

const ALBUM_TABS = [
  { id: 'ALL', label: 'Усі треки' },
  { id: 'UKRAINIAN VIBE MUSIC, Vol. 1', label: 'VIBE Vol. 1' },
  { id: 'UKRAINIAN VIBE MUSIC, Vol. 2', label: 'VIBE Vol. 2' },
  { id: 'UKRAINIAN VIBE MUSIC, Vol. 3', label: 'VIBE Vol. 3' },
  { id: 'ROAD VOL.1', label: 'ROAD Vol. 1' }
];

export default function SongList({ 
  songs, 
  currentSongId, 
  onSelectSong, 
  onDeleteSong, 
  onReorderSongs,
  activeAlbum,
  setActiveAlbum,
  onUpdateSongAlbum
}) {
  const [draggedIndex, setDraggedIndex] = React.useState(null);
  const [dragOverIndex, setDragOverIndex] = React.useState(null);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [activeDropdownSongId, setActiveDropdownSongId] = React.useState(null);
  
  const dragStartY = React.useRef(0);
  const dragStartIndex = React.useRef(null);
  const isPointerDown = React.useRef(false);
  const isDragActive = React.useRef(false);
  const hasMovedThreshold = React.useRef(false);
  const longPressTimer = React.useRef(null);
  const isTouchInput = React.useRef(false);
  const blockNextClick = React.useRef(false);
  const scrollContainerRef = React.useRef(null);
  
  // Custom auto-scrolling physics refs
  const startScrollTop = React.useRef(0);
  const lastClientY = React.useRef(0);
  const scrollLoopId = React.useRef(null);

  const filteredSongs = activeAlbum === 'ALL' 
    ? songs 
    : songs.filter(s => s.album === activeAlbum);

  const songsRef = React.useRef(songs);
  songsRef.current = songs;

  const filteredSongsRef = React.useRef(filteredSongs);
  filteredSongsRef.current = filteredSongs;
  
  const dragOverIndexRef = React.useRef(dragOverIndex);
  dragOverIndexRef.current = dragOverIndex;

  // Horizontal Album Tabs scrolling refs & state
  const tabsContainerRef = React.useRef(null);
  const dragStartLeft = React.useRef(0);
  const dragStartX = React.useRef(0);
  const isDraggingTabs = React.useRef(false);
  const hasDraggedTabs = React.useRef(false);

  React.useEffect(() => {
    const handleDocumentClick = (e) => {
      if (!e.target.closest('.album-dropdown') && !e.target.closest('.tag-btn')) {
        setActiveDropdownSongId(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  // Tabs drag-to-scroll & wheel-to-scroll listeners
  React.useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    // Wheel listener (passive: false to block vertical page scroll)
    const onWheel = (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    const handleDocumentMouseMove = (e) => {
      if (!isDraggingTabs.current) return;
      const dx = e.clientX - dragStartX.current;
      if (Math.abs(dx) > 3) {
        hasDraggedTabs.current = true;
      }
      container.scrollLeft = dragStartLeft.current - dx;
    };

    const handleDocumentMouseUp = () => {
      if (!isDraggingTabs.current) return;
      isDraggingTabs.current = false;
      container.style.cursor = 'grab';
      container.style.userSelect = 'auto';
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);

    return () => {
      container.removeEventListener('wheel', onWheel);
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, []);

  const handleTabsMouseDown = (e) => {
    if (e.button !== 0) return; // Only left click
    const container = tabsContainerRef.current;
    if (!container) return;
    isDraggingTabs.current = true;
    hasDraggedTabs.current = false;
    dragStartX.current = e.clientX;
    dragStartLeft.current = container.scrollLeft;
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
  };

  const handleTabClick = (tabId) => {
    if (hasDraggedTabs.current) {
      hasDraggedTabs.current = false; // reset
      return;
    }
    triggerTactileFeedback('button_press');
    setActiveAlbum(tabId);
  };

  const getReorderedGlobalIds = (allSongs, fileSongs, fromIdx, toIdx) => {
    if (activeAlbum === 'ALL') {
      const reordered = [...allSongs];
      const [removed] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, removed);
      return reordered.map(s => s.id);
    }

    const targetAlbumIndices = [];
    allSongs.forEach((song, idx) => {
      if (song.album === activeAlbum) {
        targetAlbumIndices.push(idx);
      }
    });

    const newFiltered = [...fileSongs];
    const [removed] = newFiltered.splice(fromIdx, 1);
    newFiltered.splice(toIdx, 0, removed);

    const newGlobal = [...allSongs];
    targetAlbumIndices.forEach((globalIdx, filteredIdx) => {
      newGlobal[globalIdx] = newFiltered[filteredIdx];
    });

    return newGlobal.map(s => s.id);
  };

  const startScrollLoop = React.useCallback(() => {
    if (scrollLoopId.current) return;
    
    const loop = () => {
      const containerEl = scrollContainerRef.current;
      if (!containerEl || !isDragActive.current) {
        scrollLoopId.current = null;
        return;
      }
      
      const rect = containerEl.getBoundingClientRect();
      const clientY = lastClientY.current;
      const distTop = clientY - rect.top;
      const distBottom = rect.bottom - clientY;
      
      let scrollAmount = 0;
      const scrollThreshold = 45; // Auto-scroll triggering boundary (pixels from edge)
      
      if (distTop < scrollThreshold && containerEl.scrollTop > 0) {
        // Proportional scrolling speed based on boundary proximity
        scrollAmount = -Math.ceil((scrollThreshold - distTop) * 0.22);
      } else if (distBottom < scrollThreshold && containerEl.scrollTop < containerEl.scrollHeight - containerEl.clientHeight) {
        scrollAmount = Math.ceil((scrollThreshold - distBottom) * 0.22);
      }
      
      if (scrollAmount !== 0) {
        containerEl.scrollTop += scrollAmount;
        
        // Re-calculate drag offset and active index incorporating new scroll distance!
        const diffY = clientY - dragStartY.current;
        const scrollDiff = containerEl.scrollTop - startScrollTop.current;
        const totalOffset = diffY + scrollDiff;
        
        setDragOffset(totalOffset);
        
        const targetIndex = Math.max(0, Math.min(filteredSongsRef.current.length - 1, dragStartIndex.current + Math.round(totalOffset / 68)));
        if (dragOverIndexRef.current !== targetIndex) {
          triggerTactileFeedback('dial_tick');
          setDragOverIndex(targetIndex);
          dragOverIndexRef.current = targetIndex; // Update ref immediately
        }
      }
      
      scrollLoopId.current = requestAnimationFrame(loop);
    };
    
    scrollLoopId.current = requestAnimationFrame(loop);
  }, []);

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onPointerMove = (e) => {
      const isTouch = e.type === 'touchmove';
      if (!isPointerDown.current) return;
      
      const clientY = isTouch ? e.touches[0].clientY : e.clientY;
      const clientX = isTouch ? e.touches[0].clientX : e.clientX;
      const diffY = clientY - dragStartY.current;
      
      lastClientY.current = clientY; // Record Y position for the active scroll loop
      
      // If drag is not active yet, cancel long press if they moved finger/cursor past 6px (scrolling list)
      if (!isDragActive.current) {
        if (Math.abs(diffY) > 6) {
          hasMovedThreshold.current = true;
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }
        return;
      }
      
      // If reordering drag is active, lock list scroll and track coordinates
      if (e.cancelable) {
        e.preventDefault();
      }
      
      const scrollDiff = container.scrollTop - startScrollTop.current;
      const totalOffset = diffY + scrollDiff;
      
      setDragOffset(totalOffset);

      // Symmetrical mathematical slot calculation (card height 58px + gap 10px = 68px)
      const targetIndex = Math.max(0, Math.min(filteredSongsRef.current.length - 1, dragStartIndex.current + Math.round(totalOffset / 68)));
      if (dragOverIndexRef.current !== targetIndex) {
        triggerTactileFeedback('dial_tick');
        setDragOverIndex(targetIndex);
        dragOverIndexRef.current = targetIndex; // Update ref immediately
      }
    };

    const onPointerEnd = (e) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      if (scrollLoopId.current) {
        cancelAnimationFrame(scrollLoopId.current);
        scrollLoopId.current = null;
      }
      
      const wasDragging = isDragActive.current;
      const startIdx = dragStartIndex.current;
      const overIdx = dragOverIndexRef.current;
      
      if (wasDragging && startIdx !== null && overIdx !== null && startIdx !== overIdx) {
        triggerTactileFeedback('button_press');
        const ids = getReorderedGlobalIds(songsRef.current, filteredSongsRef.current, startIdx, overIdx);
        onReorderSongs(ids);
      }
      
      if (wasDragging) {
        blockNextClick.current = true;
        setTimeout(() => {
          blockNextClick.current = false;
        }, 300);
      }
      
      setDraggedIndex(null);
      setDragOverIndex(null);
      setDragOffset(0);
      isPointerDown.current = false;
      isDragActive.current = false;
      dragStartIndex.current = null;
      hasMovedThreshold.current = false;
    };

    container.addEventListener('touchmove', onPointerMove, { passive: false });
    container.addEventListener('touchend', onPointerEnd);
    container.addEventListener('touchcancel', onPointerEnd);
    container.addEventListener('mousemove', onPointerMove);
    container.addEventListener('mouseup', onPointerEnd);
    container.addEventListener('mouseleave', onPointerEnd);

    // Keep scroll loop accessible via active drag states
    if (isDragActive.current) {
      startScrollLoop();
    }

    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
      if (scrollLoopId.current) {
        cancelAnimationFrame(scrollLoopId.current);
      }
      container.removeEventListener('touchmove', onPointerMove);
      container.removeEventListener('touchend', onPointerEnd);
      container.removeEventListener('touchcancel', onPointerEnd);
      container.removeEventListener('mousemove', onPointerMove);
      container.removeEventListener('mouseup', onPointerEnd);
      container.removeEventListener('mouseleave', onPointerEnd);
    };
  }, [onReorderSongs, startScrollLoop]);

  const handlePressStart = (e, index, isTouch) => {
    if (e.target.closest('.song-controls') || e.target.closest('button')) {
      return;
    }
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    isTouchInput.current = isTouch;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    
    dragStartY.current = clientY;
    lastClientY.current = clientY; // Initialize last pointer Y position
    dragStartIndex.current = index;
    isPointerDown.current = true;
    isDragActive.current = false;
    hasMovedThreshold.current = false;
    
    longPressTimer.current = setTimeout(() => {
      if (isPointerDown.current && !hasMovedThreshold.current) {
        isDragActive.current = true;
        setDraggedIndex(index);
        
        // Record container scroll boundary baseline
        const container = scrollContainerRef.current;
        if (container) {
          startScrollTop.current = container.scrollTop;
        }
        
        triggerTactileFeedback('switch_on'); // Pops open with a satisfying double-click!
        
        if (navigator.vibrate) {
          navigator.vibrate([15, 10, 15]);
        }
        
        // Directly start the auto-scroll loop!
        startScrollLoop();
      }
    }, 1000); // 1 second hold threshold
  };
  
  const formatSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const moveSong = (filteredIndex, direction) => {
    triggerTactileFeedback('dial_tick');
    const targetFilteredIndex = filteredIndex + direction;
    
    if (targetFilteredIndex < 0 || targetFilteredIndex >= filteredSongs.length) return;
    
    const ids = getReorderedGlobalIds(songs, filteredSongs, filteredIndex, targetFilteredIndex);
    onReorderSongs(ids);
  };

  return (
    <div className="recessed-cutout songs-container" style={{ position: 'relative', overflow: 'hidden', zIndex: 2 }}>
      
      <div 
        className="cb-toggle-label" 
        style={{ 
          padding: '12px 14px', 
          borderBottom: '1.5px solid #4a3e35', 
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 2
        }}
      >
        <span>ЧЕРГА ВІДТВОРЕННЯ</span>
        <span style={{ fontSize: '9px', color: 'var(--color-amber)' }}>{filteredSongs.length} ТРЕКІВ</span>
      </div>

      <div 
        className="album-tabs-container"
        ref={tabsContainerRef}
        onMouseDown={handleTabsMouseDown}
        style={{ cursor: 'grab' }}
      >
        {ALBUM_TABS.map((tab) => {
          const isActive = tab.id === activeAlbum;
          const songCount = tab.id === 'ALL' 
            ? songs.length 
            : songs.filter(s => s.album === tab.id).length;

          return (
            <button
              key={tab.id}
              className={`album-tab ${isActive ? 'active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
            >
              <span className="tab-label">{tab.label}</span>
              <span className="tab-count">({songCount})</span>
            </button>
          );
        })}
      </div>

      <div className="song-list-scroll" ref={scrollContainerRef}>
        {filteredSongs.length === 0 ? (
          <div 
            style={{ 
              padding: '40px 20px', 
              textAlign: 'center', 
              color: 'var(--text-muted)',
              fontSize: '11px',
              fontStyle: 'italic'
            }}
          >
            {activeAlbum === 'ALL' 
              ? "Черга порожня. Завантажте пісні з комп'ютера!"
              : "В цьому альбомі немає пісень. Додайте їх за допомогою 🏷️!"}
          </div>
        ) : (
          filteredSongs.map((song, index) => {
            const isActive = song.id === currentSongId;
            const isDragging = index === draggedIndex;
            const isOver = index === dragOverIndex;
            
            // Calculate dynamic translateY shifts for other cards to slide out of the way!
            let translateY = 0;
            if (draggedIndex !== null && dragOverIndex !== null && !isDragging) {
              if (draggedIndex < dragOverIndex && index > draggedIndex && index <= dragOverIndex) {
                translateY = -68; // Card height (58px) + scroll gap (10px) = 68px shift
              } else if (draggedIndex > dragOverIndex && index >= dragOverIndex && index < draggedIndex) {
                translateY = 68; // Shift down to make space
              }
            }

            // If pointer dragged, translate by the actual drag offset, else use dynamic slide translate
            const isCurrentlyDragged = isDragging && dragOffset !== 0;
            const currentTranslateY = isCurrentlyDragged ? dragOffset : translateY;

            // Option 1: Industrial Hydraulic Lift & Metal Grooves Styling
            const isPlaceholderCavity = isDragging && !isCurrentlyDragged; // PC/mobile placeholder cavity
            const isTargetCavity = false; // Destination slot is a clean visual gap in the list revealing container rails background
            const isLiftedPlate = isDragging && isCurrentlyDragged; // Active touch/mouse-dragged lifted plate
            const isCavity = isPlaceholderCavity || isTargetCavity;

            return (
              <div 
                key={song.id} 
                className={`song-item ${isActive ? 'active' : ''}`}
                data-index={index}
                draggable="false"
                onTouchStart={(e) => handlePressStart(e, index, true)}
                onMouseDown={(e) => { if (e.button === 0) handlePressStart(e, index, false); }}
                onClick={() => {
                  if (blockNextClick.current) {
                    blockNextClick.current = false;
                    return;
                  }
                  triggerTactileFeedback('button_press');
                  onSelectSong(song);
                }}
                style={{
                  position: 'relative',
                  backgroundImage: isCavity 
                    ? 'linear-gradient(180deg, #07080a 0%, #101317 100%)'
                    : (song.artworkUrl 
                      ? `linear-gradient(90deg, rgba(16, 20, 24, 0.94) 0%, rgba(20, 25, 30, 0.78) 50%, rgba(24, 30, 36, 0.92) 100%), url(${song.artworkUrl})` 
                      : 'none'),
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  
                  // Copper rails and glowing details
                  borderLeft: isTargetCavity 
                    ? '3px solid #ff9d00' 
                    : (isPlaceholderCavity ? '3px solid #a0782d' : 'none'),
                  borderRight: isTargetCavity 
                    ? '3px solid #ff9d00' 
                    : (isPlaceholderCavity ? '3px solid #a0782d' : 'none'),
                  borderTop: isCavity ? '1px solid #07080a' : 'none',
                  borderBottom: isCavity ? '1px solid #0f1216' : 'none',
                  
                  // Fallback border when not a cavity
                  border: !isCavity 
                    ? (isLiftedPlate 
                      ? '1.5px solid var(--color-amber)' 
                      : (isActive ? '1px solid var(--color-amber)' : '1px solid #2d343c'))
                    : 'none',
                    
                  // Box shadow representing depth vs 3D lift
                  boxShadow: isCavity
                    ? 'inset 0 6px 12px rgba(0, 0, 0, 0.95), inset 3px 0 5px rgba(0,0,0,0.8), inset -3px 0 5px rgba(0,0,0,0.8)'
                    : (isLiftedPlate
                      ? '0 20px 40px rgba(0, 0, 0, 0.95), 0 0 25px rgba(255, 132, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                      : (isActive 
                        ? '0 0 12px rgba(255, 132, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08)' 
                        : 'inset 0 1px 0 rgba(255, 255, 255, 0.02)')),
                        
                  opacity: isPlaceholderCavity 
                    ? 0.38 
                    : (isTargetCavity 
                      ? 0.72 
                      : (isLiftedPlate ? 0.98 : 1)),
                      
                  zIndex: isLiftedPlate ? 50 : (activeDropdownSongId === song.id ? 10 : 2),
                  
                  // 3D perspective tilts for mechanical hydraulic lift
                  transform: isLiftedPlate
                    ? `translateY(${currentTranslateY}px) scale(1.05) perspective(400px) rotateX(-6deg) rotateY(1.5deg)`
                    : `translateY(${currentTranslateY}px) scale(1.0)`,
                    
                  cursor: isLiftedPlate ? 'grabbing' : 'grab',
                  
                  // Transition: springy overshoot cubic-bezier for neighboring cards sliding
                  transition: isLiftedPlate
                    ? 'box-shadow 0.15s, border-color 0.15s, opacity 0.15s'
                    : 'transform 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.22s, border-color 0.22s, box-shadow 0.22s, opacity 0.22s',
                    
                  overflow: activeDropdownSongId === song.id ? 'visible' : 'hidden',
                  paddingLeft: '16px'
                }}
              >
                {/* Opacity and pointer events wrapper for cavity slots */}
                <div
                  style={{
                    display: 'flex',
                    width: '100%',
                    height: '100%',
                    alignItems: 'center',
                    opacity: isCavity ? 0.18 : 1,
                    transition: 'opacity 0.22s ease',
                    pointerEvents: isCavity ? 'none' : 'auto',
                    position: 'relative',
                    zIndex: 2
                  }}
                >
                  {/* Visual indicator bar on the left edge */}
                  <div 
                    style={{
                      position: 'absolute',
                      left: -16, // offset parent paddingLeft
                      top: 0,
                      bottom: 0,
                      width: '4px',
                      backgroundColor: isActive ? 'var(--color-amber)' : 'transparent',
                      boxShadow: isActive ? 'var(--color-amber-glow)' : 'none',
                      zIndex: '3'
                    }}
                  />

                  <div className="song-number" style={{ zIndex: 2 }}>
                    {isActive ? '▶' : String(index + 1).padStart(2, '0')}
                  </div>
                  
                  <div className="song-info" style={{ zIndex: 2 }}>
                    <div 
                      className="song-title" 
                      title={song.title} 
                      style={{ 
                        textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 1px rgba(0,0,0,0.9)', 
                        fontWeight: '700',
                        color: isActive ? 'var(--color-amber)' : 'var(--text-main)'
                      }}
                    >
                      {song.title}
                    </div>
                    <div 
                      className="song-size" 
                      style={{ 
                        textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                        color: isActive ? 'rgba(255, 255, 255, 0.7)' : 'var(--text-muted)'
                      }}
                    >
                      {song.duration ? `${formatDuration(song.duration)} | ` : ''}{formatSize(song.size)}
                    </div>
                  </div>

                  <div className="song-controls" onClick={(e) => e.stopPropagation()} style={{ zIndex: 2 }}>
                    {/* Reordering Buttons */}
                    <button 
                      className="song-action-btn"
                      disabled={index === 0}
                      onClick={() => moveSong(index, -1)}
                      style={{ opacity: index === 0 ? 0.3 : 1 }}
                      title="Вгору"
                    >
                      ▲
                    </button>
                    <button 
                      className="song-action-btn"
                      disabled={index === filteredSongs.length - 1}
                      onClick={() => moveSong(index, 1)}
                      style={{ opacity: index === filteredSongs.length - 1 ? 0.3 : 1 }}
                      title="Вниз"
                    >
                      ▼
                    </button>

                    {/* Tag / Album Button */}
                    <button
                      className={`song-action-btn tag-btn ${song.album ? 'has-album' : ''}`}
                      onClick={(e) => {
                        triggerTactileFeedback('button_press');
                        setActiveDropdownSongId(activeDropdownSongId === song.id ? null : song.id);
                      }}
                      title="Призначити альбом"
                    >
                      🏷️
                    </button>

                    {activeDropdownSongId === song.id && (
                      <div className={`album-dropdown ${index >= filteredSongs.length - 2 && filteredSongs.length > 2 ? 'dropdown-up' : ''}`}>
                        <div className="album-dropdown-header">Оберіть альбом</div>
                        {ALLOWED_ALBUMS.map((albumName) => (
                          <div 
                            key={albumName} 
                            className={`album-dropdown-item ${song.album === albumName ? 'selected' : ''}`}
                            onClick={() => {
                              triggerTactileFeedback('button_press');
                              onUpdateSongAlbum(song.id, albumName);
                              setActiveDropdownSongId(null);
                            }}
                          >
                            {albumName}
                          </div>
                        ))}
                        <div 
                          className="album-dropdown-item clear-item"
                          onClick={() => {
                            triggerTactileFeedback('button_press');
                            onUpdateSongAlbum(song.id, null);
                            setActiveDropdownSongId(null);
                          }}
                        >
                          ❌ Видалити з альбому
                        </div>
                      </div>
                    )}
                    
                    {/* Delete Button */}
                    <button 
                      className="song-action-btn delete"
                      onClick={(e) => {
                        triggerTactileFeedback('button_press');
                        onDeleteSong(song.id);
                      }}
                      title="Видалити"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
