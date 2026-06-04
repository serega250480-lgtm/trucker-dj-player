import React, { useState, useEffect, useRef } from 'react';
import Dashboard from './components/Dashboard';
import SongList from './components/SongList';
import ShareModal from './components/ShareModal';
import Visualizer from './components/Visualizer';
import ExhaustSmoke from './components/ExhaustSmoke';
import StartScreen from './components/StartScreen';
import { triggerTactileFeedback } from './utils/tactile';
import logoImg from './assets/logo.png';

export default function App() {
  const [songs, setSongs] = useState([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(-1);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [crossfadeDuration, setCrossfadeDuration] = useState(5); // default 5 seconds
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [shareDetails, setShareDetails] = useState(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [analyser, setAnalyser] = useState(null);
  const [isNightDrive, setIsNightDrive] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isFlickerActive, setIsFlickerActive] = useState(true);
  const [playedSongIds, setPlayedSongIds] = useState([]);

  // Dual Audio Elements
  const audioARef = useRef(new Audio());
  const audioBRef = useRef(new Audio());
  
  // Web Audio Refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceARef = useRef(null);
  const sourceBRef = useRef(null);

  // Smooth Tape Wind-down / Spin-up playbackRate animation
  const rampAudioPlaybackRate = (audio, target, duration, onComplete) => {
    const start = audio.playbackRate || 1.0;
    const startTime = performance.now();
    
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Smooth cubic ease-in-out for realistic tape motor physics
      const easeProgress = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      audio.playbackRate = start + (target - start) * easeProgress;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        if (onComplete) onComplete();
      }
    };
    requestAnimationFrame(animate);
  };

  // Initialize Web Audio API on user gesture to get real frequency data
  const initAudioContext = () => {
    if (analyserRef.current) {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = ctx;

      const ana = ctx.createAnalyser();
      ana.fftSize = 256;
      analyserRef.current = ana;

      // Connect HTML5 audio elements to the graph
      sourceARef.current = ctx.createMediaElementSource(audioARef.current);
      sourceBRef.current = ctx.createMediaElementSource(audioBRef.current);

      sourceARef.current.connect(ana);
      sourceBRef.current.connect(ana);
      ana.connect(ctx.destination);

      setAnalyser(ana);
      console.log('Real Web Audio Analyser connected successfully!');
    } catch (e) {
      console.warn('Failed to initialize real AudioContext:', e);
    }
  };

  const handleStart = (ctx) => {
    setShowStartScreen(false);
    initAudioContext();
  };

  // Track which player is currently playing the primary song ('A' or 'B')
  const [activePlayer, setActivePlayer] = useState('A');
  const isTransitioningRef = useRef(false);
  const audioUnlockedRef = useRef(false);

  // Show a temporary toast notification
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };
 
  // Fetch playlist on load with smart change detection
  const fetchPlaylist = async () => {
    try {
      const response = await fetch('/api/playlist');
      if (response.ok) {
        const data = await response.json();
        setSongs(prevSongs => {
          // Avoid triggering unnecessary re-renders if list hasn't changed
          const prevIds = prevSongs.map(s => s.id).join(',');
          const newIds = data.map(s => s.id).join(',');
          if (prevIds === newIds) return prevSongs;
          return data;
        });
        
        // Handle selecting first song if none active and list is populated
        setCurrentSongIndex(prevIdx => {
          if (data.length > 0 && prevIdx === -1) {
            return 0;
          }
          return prevIdx;
        });
      }
    } catch (error) {
      console.error('Failed to fetch playlist:', error);
    }
  };

  // Fetch share details on load
  const fetchShareDetails = async () => {
    try {
      const response = await fetch('/api/network-ip');
      if (response.ok) {
        const data = await response.json();
        setShareDetails(data);
      }
    } catch (error) {
      console.error('Failed to fetch sharing details:', error);
    }
  };

  useEffect(() => {
    fetchPlaylist();
    fetchShareDetails();

    // Poll the server every 8 seconds for collaborative syncing & recovery
    const pollInterval = setInterval(fetchPlaylist, 8000);

    // Set initial volumes
    audioARef.current.volume = volume;
    audioBRef.current.volume = 0;

    return () => clearInterval(pollInterval);
  }, []);

  // Gyroscope Accelerometer (Mobile) & cursor tracking parallax mouse listener (Desktop fallback)
  useEffect(() => {
    let hasGyro = false;

    const handleOrientation = (e) => {
      if (e.beta === null || e.gamma === null) return;
      hasGyro = true;
      const beta = e.beta;
      const gamma = e.gamma;
      
      // Normalize tilt values between -1 and 1
      const x = Math.max(-1.0, Math.min(1.0, gamma / 30));
      const y = Math.max(-1.0, Math.min(1.0, (beta - 45) / 30)); // assumes common viewing angle
      
      document.documentElement.style.setProperty('--gyro-x', x.toFixed(3));
      document.documentElement.style.setProperty('--gyro-y', y.toFixed(3));
    };

    const handleMouseMove = (e) => {
      if (hasGyro) return; // avoid conflicts if gyro is actively supplying values
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      // Calculate cursor position from center of screen (-1.0 to 1.0)
      const x = (e.clientX / w) * 2 - 1;
      const y = (e.clientY / h) * 2 - 1;
      
      document.documentElement.style.setProperty('--gyro-x', x.toFixed(3));
      document.documentElement.style.setProperty('--gyro-y', y.toFixed(3));
    };

    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Sync playedSongIds when playlist changes to filter out deleted songs
  useEffect(() => {
    setPlayedSongIds(prev => prev.filter(id => songs.some(s => s.id === id)));
  }, [songs]);

  // Update hardware volume on active players
  useEffect(() => {
    if (!isTransitioningRef.current) {
      const activeAudio = activePlayer === 'A' ? audioARef.current : audioBRef.current;
      activeAudio.volume = volume;
    }
  }, [volume, activePlayer]);

  // Synchronize audio event listeners to primary player
  useEffect(() => {
    const audioA = audioARef.current;
    const audioB = audioBRef.current;

    const handleTimeUpdate = () => {
      const activeAudio = activePlayer === 'A' ? audioA : audioB;
      setCurrentTime(activeAudio.currentTime);
      
      if (activeAudio.duration) {
        setTotalDuration(activeAudio.duration);
        
        // Trigger Crossfade!
        // If remaining time is <= crossfadeDuration AND we aren't already transitioning, AND there is a next song
        const remaining = activeAudio.duration - activeAudio.currentTime;
        if (
          remaining <= crossfadeDuration && 
          crossfadeDuration > 0 &&
          !isTransitioningRef.current && 
          songs.length > 1
        ) {
          triggerDJCrossfade();
        }
      }
    };

    const handleEnded = () => {
      // If we didn't crossfade (e.g. crossfadeDuration = 0, or last song), move to next normally
      if (!isTransitioningRef.current) {
        playNextSong();
      }
    };

    // Attach listeners to active audio player
    if (activePlayer === 'A') {
      audioA.addEventListener('timeupdate', handleTimeUpdate);
      audioA.addEventListener('ended', handleEnded);
      
      // Remove from B
      audioB.removeEventListener('timeupdate', handleTimeUpdate);
      audioB.removeEventListener('ended', handleEnded);
    } else {
      audioB.addEventListener('timeupdate', handleTimeUpdate);
      audioB.addEventListener('ended', handleEnded);
      
      // Remove from A
      audioA.removeEventListener('timeupdate', handleTimeUpdate);
      audioA.removeEventListener('ended', handleEnded);
    }

    return () => {
      audioA.removeEventListener('timeupdate', handleTimeUpdate);
      audioA.removeEventListener('ended', handleEnded);
      audioB.removeEventListener('timeupdate', handleTimeUpdate);
      audioB.removeEventListener('ended', handleEnded);
    };
  }, [activePlayer, songs, crossfadeDuration, currentSongIndex]);

  // Unlock audio elements safely (using base64 silent WAV to prevent browser lockups)
  const unlockAudio = () => {
    if (audioUnlockedRef.current) return;
    
    const silentSrc = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    try {
      // Temporarily assign a safe source to play-pause and unlock media context
      if (!audioARef.current.src) audioARef.current.src = silentSrc;
      if (!audioBRef.current.src) audioBRef.current.src = silentSrc;
      
      const pA = audioARef.current.play();
      if (pA !== undefined) {
        pA.then(() => audioARef.current.pause()).catch(() => {});
      }
      const pB = audioBRef.current.play();
      if (pB !== undefined) {
        pB.then(() => audioBRef.current.pause()).catch(() => {});
      }
      
      audioUnlockedRef.current = true;
    } catch (e) {
      console.warn("Failed to safely unlock audio elements:", e);
    }
  };

  // Trigger playback on selection
  const handleSelectSong = (song) => {
    initAudioContext(); // Initialize real audio analyser context
    const index = songs.findIndex(s => s.id === song.id);
    if (index === -1) return;

    // Record selected song ID to played history
    setPlayedSongIds(prev => {
      if (!prev.includes(song.id)) {
        return [...prev, song.id];
      }
      return prev;
    });

    // Repeated click toggle: if clicked song is already active, play/pause it!
    if (index === currentSongIndex) {
      handlePlayPause();
      return;
    }

    // Play solid mechanical button press instead of radio static!
    triggerTactileFeedback('button_press');

    setCurrentSongIndex(index);
    isTransitioningRef.current = false;

    const activeAudio = activePlayer === 'A' ? audioARef.current : audioBRef.current;
    const inactiveAudio = activePlayer === 'A' ? audioBRef.current : audioARef.current;

    // 1. Force fully resetting and freeing the inactive audio element
    try {
      inactiveAudio.pause();
      inactiveAudio.currentTime = 0;
      inactiveAudio.removeAttribute('src'); // Completely unload source
      inactiveAudio.load(); 
    } catch (e) {
      console.warn('Error resetting inactive audio:', e);
    }

    // 2. Load and play active player from a clean, refreshed slate
    try {
      activeAudio.pause();
      activeAudio.src = `/uploads/${song.filename}`;
      activeAudio.volume = volume;
      activeAudio.load(); // Forces the browser to establish a brand-new TCP socket!
      
      activeAudio.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error('Play failed:', err);
          setIsPlaying(false);
        });
    } catch (e) {
      console.error('Active audio play configuration error:', e);
      setIsPlaying(false);
    }
  };

  // Play / Pause Toggle
  const handlePlayPause = () => {
    unlockAudio();
    initAudioContext(); // Initialize real audio analyser context
    if (songs.length === 0) return;

    const activeAudio = activePlayer === 'A' ? audioARef.current : audioBRef.current;

    // Play click sound on play/pause press!
    triggerTactileFeedback('button_press');

    if (isPlaying) {
      activeAudio.pause();
      setIsPlaying(false);
    } else {
      // If no valid src loaded, load current index
      const hasValidSrc = activeAudio.src && activeAudio.src.includes('/uploads/');
      if (!hasValidSrc && currentSongIndex !== -1 && songs[currentSongIndex]) {
        activeAudio.src = `/uploads/${songs[currentSongIndex].filename}`;
      } else if (!hasValidSrc && songs.length > 0) {
        setCurrentSongIndex(0);
        activeAudio.src = `/uploads/${songs[0].filename}`;
      }
      
      activeAudio.volume = activePlayer === 'A' ? volume : 0;
      activeAudio.playbackRate = 1.0; // Ensure normal playback speed
      
      if (isTransitioningRef.current) {
        // If we are crossfading, play both!
        audioARef.current.play().catch(() => {});
        audioBRef.current.play().catch(() => {});
      } else {
        activeAudio.play().catch(() => {});
      }
      setIsPlaying(true);
    }
  };

  // Get next random song index using a non-repeating shuffle pool
  const getNextShuffleIndex = (currentIndex) => {
    if (songs.length === 0) return -1;
    if (songs.length === 1) return 0;

    // Filter songs that haven't been played in this cycle yet
    // Exclude the current song to avoid playing it twice consecutively
    let unplayed = songs.filter(s => !playedSongIds.includes(s.id) && s.id !== (songs[currentIndex]?.id));

    // If all songs have been played, reset the pool!
    if (unplayed.length === 0) {
      // Reset pool, keeping only the currently playing song's ID to avoid repeating it immediately
      const currentId = songs[currentIndex]?.id;
      const newPlayed = currentId ? [currentId] : [];
      setPlayedSongIds(newPlayed);
      
      // The new unplayed pool will be all other songs
      unplayed = songs.filter(s => s.id !== currentId);
    }

    if (unplayed.length === 0) return 0;

    // Pick a random song from the unplayed pool
    const randomSong = unplayed[Math.floor(Math.random() * unplayed.length)];
    const nextIndex = songs.findIndex(s => s.id === randomSong.id);

    // Record this song as played
    setPlayedSongIds(prev => [...prev, randomSong.id]);

    return nextIndex !== -1 ? nextIndex : 0;
  };

  // Play Next Song (Simple skip)
  const playNextSong = () => {
    if (songs.length === 0) return;
    let nextIndex;
    if (isShuffle) {
      nextIndex = getNextShuffleIndex(currentSongIndex);
    } else {
      nextIndex = currentSongIndex + 1;
      if (nextIndex >= songs.length) {
        nextIndex = 0; // loop back to first
      }
    }
    handleSelectSong(songs[nextIndex]);
  };

  // Play Previous Song
  const playPrevSong = () => {
    if (songs.length === 0) return;
    let prevIndex;
    if (isShuffle) {
      prevIndex = getNextShuffleIndex(currentSongIndex);
    } else {
      prevIndex = currentSongIndex - 1;
      if (prevIndex < 0) {
        prevIndex = songs.length - 1; // loop to last
      }
    }
    handleSelectSong(songs[prevIndex]);
  };

  // DJ Transition Engine (Crossfading A & B players)
  const triggerDJCrossfade = () => {
    let nextSongIndex;
    if (isShuffle) {
      nextSongIndex = getNextShuffleIndex(currentSongIndex);
    } else {
      nextSongIndex = (currentSongIndex + 1) % songs.length;
    }
    const nextSong = songs[nextSongIndex];
    if (!nextSong) return;

    isTransitioningRef.current = true;
    showToast("DJ CROSSFADE: НАСТУПНИЙ ТРЕК...");

    const outgoingAudio = activePlayer === 'A' ? audioARef.current : audioBRef.current;
    const incomingAudio = activePlayer === 'A' ? audioBRef.current : audioARef.current;

    // Prepare incoming song
    incomingAudio.src = `/uploads/${nextSong.filename}`;
    incomingAudio.volume = 0;
    incomingAudio.currentTime = 0;

    incomingAudio.play()
      .then(() => {
        // Start crossfading interval
        const steps = 20; // 20 increments
        const stepTime = (crossfadeDuration * 1000) / steps;
        let currentStep = 0;

        const fadeInterval = setInterval(() => {
          if (!isPlaying) {
            clearInterval(fadeInterval);
            return;
          }
          currentStep++;
          const progress = currentStep / steps;

          // Outgoing volume fades out (volume -> 0)
          outgoingAudio.volume = Math.max(0, volume * (1 - progress));
          // Incoming volume fades in (0 -> volume)
          incomingAudio.volume = Math.min(volume, volume * progress);

          if (currentStep >= steps) {
            clearInterval(fadeInterval);
            
            // Finalize swap
            outgoingAudio.pause();
            outgoingAudio.currentTime = 0;
            incomingAudio.volume = volume;

            setCurrentSongIndex(nextSongIndex);
            setActivePlayer(activePlayer === 'A' ? 'B' : 'A');
            isTransitioningRef.current = false;
          }
        }, stepTime);
      })
      .catch(err => {
        console.error('Crossfade failed, skipped:', err);
        // Fallback to normal skip if player is blocked
        isTransitioningRef.current = false;
        playNextSong();
      });
  };

  // Song Upload Success handler
  const handleUploadSuccess = (newSongs) => {
    const songsArray = Array.isArray(newSongs) ? newSongs : [newSongs];
    if (songsArray.length === 0) return;

    setSongs(prev => {
      const updated = [...prev, ...songsArray].sort((a, b) => a.order - b.order);
      // If no song was active, select the first one
      if (currentSongIndex === -1) {
        setCurrentSongIndex(0);
      }
      return updated;
    });

    if (songsArray.length === 1) {
      showToast(`Завантажено: ${songsArray[0].title}`);
    } else {
      showToast(`Успішно завантажено ${songsArray.length} пісень!`);
    }
  };

  // Song Deletion
  const handleDeleteSong = async (id) => {
    try {
      const response = await fetch(`/api/playlist/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        showToast("Пісню видалено!");
        
        // If deleted song was active, reset active states
        const deletedIndex = songs.findIndex(s => s.id === id);
        if (songs[deletedIndex]?.id === songs[currentSongIndex]?.id) {
          audioARef.current.pause();
          audioBRef.current.pause();
          audioARef.current.src = "";
          audioBRef.current.src = "";
          setIsPlaying(false);
          setCurrentTime(0);
          setTotalDuration(0);
        }
 
        // Refetch updated list
        await fetchPlaylist();
      }
    } catch (error) {
      console.error('Failed to delete song:', error);
    }
  };

  // Song Reordering
  const handleReorderSongs = async (ids) => {
    try {
      const response = await fetch('/api/playlist/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (response.ok) {
        const data = await response.json();
        
        // Find if current active song index shifted in order
        const currentSong = songs[currentSongIndex];
        setSongs(data);

        if (currentSong) {
          const newIndex = data.findIndex(s => s.id === currentSong.id);
          if (newIndex !== -1) {
            setCurrentSongIndex(newIndex);
          }
        }
      }
    } catch (error) {
      console.error('Failed to reorder playlist:', error);
    }
  };

  // Audio Seeking (Timeline Scrubber)
  const handleSeek = (time) => {
    const activeAudio = activePlayer === 'A' ? audioARef.current : audioBRef.current;
    if (activeAudio) {
      activeAudio.currentTime = time;
      setCurrentTime(time);
    }
  };

  const currentSong = songs[currentSongIndex] || null;

  return (
    <div className={`app-container ${isNightDrive ? 'night-drive-active' : ''} ${isNightDrive && isFlickerActive ? 'neon-flicker-active' : ''}`}>
      {showStartScreen && (
        <StartScreen 
          onStart={handleStart} 
          audioContextRef={audioContextRef} 
        />
      )}
      
      <div className="main-dashboard-console">
        {/* Brass rivets in the four corners of the main wooden dashboard console */}
        <div className="brass-rivet" style={{ top: '8px', left: '8px' }} />
        <div className="brass-rivet" style={{ top: '8px', right: '8px' }} />
        <div className="brass-rivet" style={{ bottom: '8px', left: '8px' }} />
        <div className="brass-rivet" style={{ bottom: '8px', right: '8px' }} />
        <div className="wood-grain-overlay" />


        {/* Brass Dashboard Brand Inlay (Mounted directly on wood above the speedometer) */}
        <div className="dashboard-brand-inlay" style={{ zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 6px 4px', position: 'relative' }}>
          <ExhaustSmoke isPlaying={isPlaying} analyser={analyser} />
          
          <h1 className="hud-title" style={{ margin: 0, fontSize: '11px', fontWeight: '900', letterSpacing: '1.5px', color: '#ffd294', textShadow: '0 1.5px 2px rgba(0,0,0,0.95), 0 0.5px 0.5px rgba(0,0,0,0.6)', textTransform: 'uppercase', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 3 }}>
            <img src={logoImg} alt="ROAD DJ logo" style={{ width: '16px', height: '16px', objectFit: 'contain', filter: 'drop-shadow(0 0 2px rgba(255,210,148,0.3))' }} /> ROAD DJ STAGE-1
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', zIndex: 3 }}>
            <span className="cb-toggle-label" style={{ fontSize: '9px', color: '#ffd294', textShadow: '0 1px 2px rgba(0,0,0,0.95)', fontFamily: 'var(--font-serif)' }}>ONLINE</span>
            <span className="header-status" />
          </div>
        </div>

        {/* Retro Analog VU Needle Meter */}
        <Visualizer 
          isPlaying={isPlaying} 
          analyser={analyser} 
          onShareClick={() => setIsShareOpen(true)} 
          onUploadSuccess={handleUploadSuccess}
          showToast={showToast}
          songs={songs} 
        />

        {/* Main Dashboard Control Unit */}
        <Dashboard
          currentSong={currentSong}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onNext={playNextSong}
          onPrev={playPrevSong}
          volume={volume}
          onVolumeChange={setVolume}
          crossfadeDuration={crossfadeDuration}
          onCrossfadeChange={setCrossfadeDuration}
          onShareClick={() => setIsShareOpen(true)}
          currentTime={currentTime}
          totalDuration={totalDuration}
          onSeek={handleSeek}
          isNightDrive={isNightDrive}
          onNightDriveChange={setIsNightDrive}
          isShuffle={isShuffle}
          onShuffleChange={setIsShuffle}
          isFlickerActive={isFlickerActive}
          onFlickerChange={setIsFlickerActive}
        />

        {/* Sorted Song Queue */}
        <SongList
          songs={songs}
          currentSongId={currentSong ? currentSong.id : null}
          onSelectSong={handleSelectSong}
          onDeleteSong={handleDeleteSong}
          onReorderSongs={handleReorderSongs}
        />
      </div>

      {/* Sync Sharing modal popup */}
      {isShareOpen && (
        <ShareModal 
          shareDetails={shareDetails} 
          onClose={() => setIsShareOpen(false)} 
        />
      )}

      {/* Toast popup */}
      {toastMessage && (
        <div className="toast">{toastMessage}</div>
      )}

    </div>
  );
}
