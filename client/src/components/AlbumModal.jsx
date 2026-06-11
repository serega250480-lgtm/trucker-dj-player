import React, { useState, useEffect } from 'react';
import { triggerTactileFeedback } from '../utils/tactile';

export default function AlbumModal({ isOpen, onClose, albums, songs, onSaveAlbums }) {
  const [localAlbums, setLocalAlbums] = useState([]);
  const [newAlbumName, setNewAlbumName] = useState('');

  // Sync local state when modal opens or albums prop changes
  useEffect(() => {
    if (isOpen) {
      setLocalAlbums(albums.map(album => ({ ...album })));
      setNewAlbumName('');
    }
  }, [isOpen, albums]);

  if (!isOpen) return null;

  const moveAlbum = (index, direction) => {
    triggerTactileFeedback('button_press');
    if (index + direction < 0 || index + direction >= localAlbums.length) return;
    const updated = [...localAlbums];
    const temp = updated[index];
    updated[index] = updated[index + direction];
    updated[index + direction] = temp;
    setLocalAlbums(updated);
  };

  const deleteAlbum = (index) => {
    triggerTactileFeedback('button_press');
    const albumToDelete = localAlbums[index];
    
    // Count songs currently in this album
    const songsInAlbum = songs.filter(s => s.album === albumToDelete.id).length;
    if (songsInAlbum > 0) {
      if (!window.confirm(`Цей альбом містить ${songsInAlbum} треків. Якщо ви видалите його, ці треки будуть переміщені до розділу "Усі треки". Продовжити?`)) {
        return;
      }
    }
    
    const updated = localAlbums.filter((_, idx) => idx !== index);
    setLocalAlbums(updated);
  };

  const handleAddAlbum = () => {
    triggerTactileFeedback('button_press');
    const trimmed = newAlbumName.trim();
    if (!trimmed) return;
    
    if (localAlbums.some(a => a.name.toLowerCase() === trimmed.toLowerCase())) {
      alert("Альбом з такою назвою вже існує!");
      return;
    }
    
    const newAlbum = {
      id: 'album_' + Date.now() + '_' + Math.round(Math.random() * 1000),
      name: trimmed
    };
    
    setLocalAlbums([...localAlbums, newAlbum]);
    setNewAlbumName('');
  };

  const handleRenameAlbum = (index, newName) => {
    const updated = [...localAlbums];
    updated[index].name = newName;
    setLocalAlbums(updated);
  };

  const handleSave = () => {
    triggerTactileFeedback('button_press');
    // Ensure all album names are trimmed and not empty
    const cleaned = localAlbums
      .map(a => ({ ...a, name: a.name.trim() }))
      .filter(a => a.name.length > 0);
      
    onSaveAlbums(cleaned);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="dashboard-bezel modal-content carbon-panel" 
        onClick={(e) => e.stopPropagation()}
        style={{ padding: '20px', maxWidth: '420px', width: '90%' }}
      >
        <div className="modal-header">
          <div className="modal-title">КЕРУВАННЯ АЛЬБОМАМИ</div>
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
        
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4', margin: '0 0 4px 0' }}>
            Тут ви можете створювати нові альбоми, перейменовувати існуючі, змінювати їхній порядок на вкладках або видаляти.
          </p>

          {/* List of Albums */}
          <div 
            style={{ 
              maxHeight: '220px', 
              overflowY: 'auto', 
              background: '#070605', 
              border: '1.5px solid #3d342c', 
              borderRadius: '6px',
              padding: '6px',
              boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.95)'
            }}
          >
            {localAlbums.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Немає активних альбомів
              </div>
            ) : (
              localAlbums.map((album, index) => {
                const songsCount = songs.filter(s => s.album === album.id).length;
                return (
                  <div 
                    key={album.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      padding: '4px',
                      borderBottom: index < localAlbums.length - 1 ? '1px solid #1f1b17' : 'none'
                    }}
                  >
                    {/* Reorder controls */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button 
                        className="song-action-btn"
                        disabled={index === 0}
                        onClick={() => moveAlbum(index, -1)}
                        style={{ padding: '0px 3px', height: '14px', fontSize: '8px', opacity: index === 0 ? 0.3 : 1 }}
                      >
                        ▲
                      </button>
                      <button 
                        className="song-action-btn"
                        disabled={index === localAlbums.length - 1}
                        onClick={() => moveAlbum(index, 1)}
                        style={{ padding: '0px 3px', height: '14px', fontSize: '8px', opacity: index === localAlbums.length - 1 ? 0.3 : 1 }}
                      >
                        ▼
                      </button>
                    </div>

                    {/* Album Name Input */}
                    <input 
                      type="text" 
                      value={album.name} 
                      onChange={(e) => handleRenameAlbum(index, e.target.value)}
                      className="share-url-input"
                      style={{ 
                        padding: '6px 8px', 
                        fontSize: '11px', 
                        fontFamily: 'var(--font-sans)', 
                        height: '28px',
                        textShadow: 'none'
                      }}
                      placeholder="Назва альбому..."
                    />

                    {/* Song Count Badge */}
                    <span 
                      style={{ 
                        fontSize: '9px', 
                        color: 'var(--color-amber)', 
                        background: 'rgba(0,0,0,0.6)', 
                        padding: '4px 6px', 
                        borderRadius: '3px',
                        border: '1px solid #2d2620',
                        minWidth: '24px',
                        textAlign: 'center'
                      }}
                      title="Кількість треків в альбомі"
                    >
                      {songsCount}
                    </span>

                    {/* Delete button */}
                    <button 
                      className="song-action-btn delete"
                      onClick={() => deleteAlbum(index)}
                      style={{ height: '28px', width: '28px', padding: 0 }}
                      title="Видалити альбом"
                    >
                      🗑️
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Add New Album Form */}
          <div 
            style={{ 
              marginTop: '4px',
              padding: '10px', 
              border: '1.5px dashed #4a3e35', 
              borderRadius: '6px',
              background: 'rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <label className="cb-toggle-label" style={{ fontSize: '9px', textAlign: 'left' }}>
              ➕ СТВОРИТИ НОВИЙ АЛЬБОМ:
            </label>
            <div className="share-url-container">
              <input 
                type="text" 
                value={newAlbumName} 
                onChange={(e) => setNewAlbumName(e.target.value)}
                className="share-url-input"
                style={{ 
                  height: '32px', 
                  fontSize: '11px', 
                  fontFamily: 'var(--font-sans)',
                  textShadow: 'none'
                }}
                placeholder="Введіть назву..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddAlbum();
                }}
              />
              <button 
                className="industrial-btn" 
                onClick={handleAddAlbum}
                style={{ padding: '0 12px', fontSize: '11px', height: '32px' }}
              >
                ДОДАТИ
              </button>
            </div>
          </div>

          {/* Save/Cancel Actions */}
          <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '8px' }}>
            <button 
              className="industrial-btn" 
              onClick={handleSave}
              style={{ 
                flex: 1,
                background: 'linear-gradient(to bottom, #ffd294, #e5b376)', 
                color: '#161008', 
                fontWeight: 'bold',
                boxShadow: '0 3px 6px rgba(0,0,0,0.4)',
                border: '1.5px solid #b78a50'
              }}
            >
              💾 ЗБЕРЕГТИ ЗМІНИ
            </button>
            <button 
              className="industrial-btn" 
              onClick={() => {
                triggerTactileFeedback('button_press');
                onClose();
              }}
              style={{ flex: 1 }}
            >
              ❌ СКАСУВАТИ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
