import React from 'react';

export default function SongList({ songs, currentSongId, onSelectSong, onDeleteSong, onReorderSongs }) {
  const [draggedIndex, setDraggedIndex] = React.useState(null);
  const [dragOverIndex, setDragOverIndex] = React.useState(null);
  
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

  const moveSong = (index, direction) => {
    const newSongs = [...songs];
    const targetIndex = index + direction;
    
    // Check bounds
    if (targetIndex < 0 || targetIndex >= songs.length) return;
    
    // Swap songs
    const temp = newSongs[index];
    newSongs[index] = newSongs[targetIndex];
    newSongs[targetIndex] = temp;
    
    // Trigger reorder API via parent
    onReorderSongs(newSongs.map(song => song.id));
  };

  // Drag and Drop Event Handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault(); // Necessary to allow drop!
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    // Splice array to perform custom reordering
    const reorderedSongs = [...songs];
    const [removed] = reorderedSongs.splice(draggedIndex, 1);
    reorderedSongs.splice(index, 0, removed);
    
    onReorderSongs(reorderedSongs.map(s => s.id));
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="chrome-bezel songs-container" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="brass-rivet" style={{ top: '6px', left: '6px' }} />
      <div className="brass-rivet" style={{ top: '6px', right: '6px' }} />
      <div className="brass-rivet" style={{ bottom: '6px', left: '6px' }} />
      <div className="brass-rivet" style={{ bottom: '6px', right: '6px' }} />
      <div className="wood-grain-overlay" />
      
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
        <span style={{ fontSize: '9px', color: 'var(--color-amber)' }}>{songs.length} ТРЕКІВ</span>
      </div>

      <div className="song-list-scroll">
        {songs.length === 0 ? (
          <div 
            style={{ 
              padding: '40px 20px', 
              textAlign: 'center', 
              color: 'var(--text-muted)',
              fontSize: '11px',
              fontStyle: 'italic'
            }}
          >
            Черга порожня. Завантажте пісні з комп'ютера!
          </div>
        ) : (
          songs.map((song, index) => {
            const isActive = song.id === currentSongId;
            const isDragging = index === draggedIndex;
            const isOver = index === dragOverIndex;
            
            return (
              <div 
                key={song.id} 
                className={`song-item ${isActive ? 'active' : ''}`}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, index)}
                onClick={() => onSelectSong(song)}
                style={{
                  position: 'relative',
                  backgroundImage: song.artworkUrl 
                    ? `linear-gradient(90deg, rgba(16, 20, 24, 0.94) 0%, rgba(20, 25, 30, 0.78) 50%, rgba(24, 30, 36, 0.92) 100%), url(${song.artworkUrl})` 
                    : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: isOver 
                    ? '2px dashed var(--color-amber)' 
                    : (isActive ? '1px solid var(--color-amber)' : '1px solid #2d343c'),
                  boxShadow: isActive 
                    ? '0 0 12px rgba(255, 132, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08)' 
                    : 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
                  opacity: isDragging ? 0.35 : 1,
                  cursor: 'grab',
                  transition: 'all 0.15s ease',
                  overflow: 'hidden',
                  paddingLeft: '16px'
                }}
              >
                {/* Visual indicator bar on the left edge */}
                <div 
                  style={{
                    position: 'absolute',
                    left: 0,
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
                    disabled={index === songs.length - 1}
                    onClick={() => moveSong(index, 1)}
                    style={{ opacity: index === songs.length - 1 ? 0.3 : 1 }}
                    title="Вниз"
                  >
                    ▼
                  </button>
                  
                  {/* Delete Button */}
                  <button 
                    className="song-action-btn delete"
                    onClick={() => onDeleteSong(song.id)}
                    title="Видалити"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
