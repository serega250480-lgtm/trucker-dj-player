const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');
const mm = require('music-metadata');

const app = express();
const PORT = process.env.PORT || 3080;

// Middleware
app.use(cors());
app.use(express.json());

// Setup Uploads Directory (Google Drive integration with safe fallback)
const googleDriveBase = 'G:\\Мій диск';
const googleDrivePlaylist = path.join(googleDriveBase, 'road_dj_playlist');
let uploadsDir;

if (fs.existsSync(googleDriveBase)) {
  uploadsDir = googleDrivePlaylist;
  console.log(`====================================================`);
  console.log(` ☁️  Google Drive cloud-sync ACTIVE!`);
  console.log(` Path: ${uploadsDir}`);
  console.log(`====================================================`);
} else {
  uploadsDir = path.join(__dirname, 'uploads');
  console.log(`====================================================`);
  console.log(` ⚠️  Google Drive not found. Using local directory.`);
  console.log(` Path: ${uploadsDir}`);
  console.log(`====================================================`);
}

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'playlist.json');
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([]));
}

// Serve uploaded audio files
app.use('/uploads', express.static(uploadsDir));

// Serve client build in production
app.use(express.static(path.join(__dirname, 'client/dist')));

// Helper: Get local network IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Helper: Read database
function readDatabase() {
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return [];
  }
}

// Helper: Write database
function writeDatabase(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing database:', error);
  }
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique safe name with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'song-' + uniqueSuffix + ext);
  }
});

// Filter for audio files only
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed!'), false);
  }
};

const upload = multer({ storage, fileFilter });

// API Endpoints

// 1. Get playlist
app.get('/api/playlist', (req, res) => {
  const playlist = readDatabase();
  // Sort by 'order' property ascending
  playlist.sort((a, b) => a.order - b.order);
  res.json(playlist);
});

// 2. Upload songs (multiple supported)
app.post('/api/playlist/upload', upload.array('audio', 50), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      if (req.file) {
        req.files = [req.file];
      } else {
        return res.status(400).json({ error: 'No audio files uploaded' });
      }
    }

    const playlist = readDatabase();
    const addedSongs = [];
    let currentMaxOrder = playlist.length > 0 ? Math.max(...playlist.map(s => s.order)) : 0;

    for (const file of req.files) {
      // Robust Cyrillic decoding helper for Multer filenames
      let originalName = file.originalname;
      try {
        const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
        if (/[\u0400-\u04FF]/.test(decoded)) {
          originalName = decoded;
        }
      } catch (e) {
        console.error('Error decoding filename:', e);
      }

      // Clean original name for title
      const title = path.basename(originalName, path.extname(originalName))
        .replace(/[_-]/g, ' ')
        .trim();

      // Extract embedded album artwork if available
      let artworkUrl = null;
      let duration = 0;
      try {
        const metadata = await mm.parseFile(file.path);
        
        // Extract duration in seconds
        if (metadata.format && metadata.format.duration) {
          duration = Math.round(metadata.format.duration);
        }

        const pictures = metadata.common.picture;
        if (pictures && pictures.length > 0) {
          const pic = pictures[0];
          const artSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          let artExt = 'jpg';
          if (pic.format) {
            const parts = pic.format.split('/');
            if (parts.length > 1) artExt = parts[1];
          }
          const artFilename = 'art-' + artSuffix + '.' + artExt;
          const artPath = path.join(uploadsDir, artFilename);
          
          fs.writeFileSync(artPath, pic.data);
          artworkUrl = `/uploads/${artFilename}`;
        }
      } catch (err) {
        console.error('Failed to parse metadata / cover art:', err);
      }

      currentMaxOrder++;
      const newSong = {
        id: 'song_' + Date.now() + '_' + Math.round(Math.random() * 1000000),
        title: title,
        filename: file.filename,
        originalName: originalName,
        size: file.size,
        artworkUrl: artworkUrl,
        duration: duration,
        order: currentMaxOrder,
        createdAt: new Date().toISOString()
      };

      playlist.push(newSong);
      addedSongs.push(newSong);
    }

    writeDatabase(playlist);

    res.status(201).json(addedSongs);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 3. Reorder playlist
app.post('/api/playlist/reorder', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'Invalid body, expected array of ids' });
  }

  const playlist = readDatabase();
  
  // Update order based on the position in the ids array
  const updatedPlaylist = playlist.map(song => {
    const index = ids.indexOf(song.id);
    if (index !== -1) {
      song.order = index + 1;
    }
    return song;
  });

  // Sort and write
  updatedPlaylist.sort((a, b) => a.order - b.order);
  writeDatabase(updatedPlaylist);

  res.json(updatedPlaylist);
});

// 4. Delete song
app.delete('/api/playlist/:id', (req, res) => {
  const { id } = req.params;
  let playlist = readDatabase();
  
  const songIndex = playlist.findIndex(s => s.id === id);
  if (songIndex === -1) {
    return res.status(404).json({ error: 'Song not found' });
  }

  const song = playlist[songIndex];
  const filePath = path.join(uploadsDir, song.filename);

  // Remove from database
  playlist.splice(songIndex, 1);

  // Recalculate orders to keep them continuous
  playlist = playlist.map((s, idx) => {
    s.order = idx + 1;
    return s;
  });

  writeDatabase(playlist);

  // Remove physical song file asynchronously
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(`Error deleting file ${filePath}:`, err);
    }
  });

  // Remove artwork file if it exists
  if (song.artworkUrl) {
    const artworkFilename = path.basename(song.artworkUrl);
    const artworkPath = path.join(uploadsDir, artworkFilename);
    fs.unlink(artworkPath, (err) => {
      if (err) {
        console.error(`Error deleting artwork file ${artworkPath}:`, err);
      }
    });
  }

  res.json({ success: true, message: 'Song deleted successfully' });
});

// 5. Get sharing details (Local network IP & QR Code)
app.get('/api/network-ip', async (req, res) => {
  const ip = getLocalIP();
  const url = `http://${ip}:${PORT}`;
  try {
    const qrCodeDataURL = await QRCode.toDataURL(url);
    res.json({ ip, port: PORT, url, qrCode: qrCodeDataURL });
  } catch (err) {
    console.error('QR code generation error:', err);
    res.status(500).json({ error: 'Failed to generate QR Code' });
  }
});

// Catch-all route to serve the SPA frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Trucker DJ Player Server is running!`);
  console.log(` PC Local: http://localhost:${PORT}`);
  console.log(` Mobile Local Network: http://${getLocalIP()}:${PORT}`);
  console.log(`====================================================`);
});
