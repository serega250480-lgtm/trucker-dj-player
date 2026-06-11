const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');
const mm = require('music-metadata');
const { google } = require('googleapis');

const DEFAULT_ALBUMS = [
  { id: 'UKRAINIAN VIBE MUSIC, Vol. 1', name: 'VIBE Vol. 1' },
  { id: 'UKRAINIAN VIBE MUSIC, Vol. 2', name: 'VIBE Vol. 2' },
  { id: 'UKRAINIAN VIBE MUSIC, Vol. 3', name: 'VIBE Vol. 3' },
  { id: 'ROAD VOL.1', name: 'ROAD Vol. 1' }
];

const app = express();
const PORT = process.env.PORT || 3080;

// Middleware
app.use(cors());
app.use(express.json());

// Setup Uploads Directory (Google Drive integration with safe fallback)
const googleDriveBase = 'G:\\Мій диск';
const googleDrivePlaylist = path.join(googleDriveBase, 'road_dj_playlist');
let uploadsDir = path.join(__dirname, 'uploads');
let isLocalGDriveActive = false;

if (fs.existsSync(googleDriveBase)) {
  uploadsDir = googleDrivePlaylist;
  isLocalGDriveActive = true;
  console.log(`====================================================`);
  console.log(` ☁️  Google Drive local-sync ACTIVE!`);
  console.log(` Path: ${uploadsDir}`);
  console.log(`====================================================`);
} else {
  console.log(`====================================================`);
  console.log(` ⚠️  Local G: drive not found. Using local uploads directory.`);
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

const albumsPath = path.join(dbDir, 'albums.json');
if (!fs.existsSync(albumsPath)) {
  fs.writeFileSync(albumsPath, JSON.stringify(DEFAULT_ALBUMS, null, 2), 'utf8');
}

// Persistent system version configuration
const sysVerPath = path.join(dbDir, 'system_version.json');
let systemVersion = Date.now();
if (fs.existsSync(sysVerPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(sysVerPath, 'utf8'));
    if (data.systemVersion) systemVersion = data.systemVersion;
  } catch (e) {
    console.error('Error loading system version:', e);
  }
}

// Global middleware to set system version header
app.use((req, res, next) => {
  res.setHeader('X-System-Version', systemVersion.toString());
  res.setHeader('Access-Control-Expose-Headers', 'X-System-Version');
  next();
});

// Google Drive API State
let drive = null;
let driveFolderId = null;

// Initialize Google Drive API Client
async function initGoogleDrive() {
  try {
    let auth = null;
    const credsPath = path.join(__dirname, 'google-credentials.json');

    if (fs.existsSync(credsPath)) {
      console.log('🗝️  Using local google-credentials.json for Google API authentication.');
      auth = new google.auth.GoogleAuth({
        keyFile: credsPath,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
    } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      console.log('🗝️  Using environment variables for Google API authentication.');
      let privateKey = process.env.GOOGLE_PRIVATE_KEY;
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');

      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: privateKey
        },
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
    }

    if (!auth) {
      console.log('⚠️  No Google Drive API credentials found. Google Drive API integration is INACTIVE.');
      return false;
    }

    drive = google.drive({ version: 'v3', auth });

    // Resolve or create the folder
    driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!driveFolderId) {
      console.log('🔍 GOOGLE_DRIVE_FOLDER_ID not set. Searching for folder "road_dj_playlist" on Google Drive...');
      const response = await drive.files.list({
        q: "mimeType = 'application/vnd.google-apps.folder' and name = 'road_dj_playlist' and trashed = false",
        fields: 'files(id, name)',
        spaces: 'drive'
      });
      const folders = response.data.files;
      if (folders && folders.length > 0) {
        driveFolderId = folders[0].id;
        console.log(`📁 Found existing Google Drive folder "road_dj_playlist" with ID: ${driveFolderId}`);
      } else {
        console.log('📁 Folder "road_dj_playlist" not found. Creating a new one...');
        const folderMetadata = {
          name: 'road_dj_playlist',
          mimeType: 'application/vnd.google-apps.folder'
        };
        const folder = await drive.files.create({
          resource: folderMetadata,
          fields: 'id'
        });
        driveFolderId = folder.data.id;
        console.log(`📁 Created new Google Drive folder "road_dj_playlist" with ID: ${driveFolderId}`);
      }
    } else {
      console.log(`📁 Using configured GOOGLE_DRIVE_FOLDER_ID: ${driveFolderId}`);
    }

    // Bidirectional sync: check if playlist.json exists on Drive
    if (!isLocalGDriveActive) {
      console.log('🔄 Checking for playlist.json on Google Drive...');
      const dbResponse = await drive.files.list({
        q: `name = 'playlist.json' and '${driveFolderId}' in parents and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });
      const dbFiles = dbResponse.data.files;

      if (dbFiles && dbFiles.length > 0) {
        const fileId = dbFiles[0].id;
        console.log(`📥 Downloading master playlist.json from Google Drive (ID: ${fileId})...`);
        const dest = fs.createWriteStream(dbPath);
        const resStream = await drive.files.get(
          { fileId: fileId, alt: 'media' },
          { responseType: 'stream' }
        );
        await new Promise((resolve, reject) => {
          resStream.data
            .on('end', () => {
              console.log('📥 Successfully synchronized database from Google Drive.');
              resolve();
            })
            .on('error', err => {
              console.error('❌ Error downloading database stream:', err);
              reject(err);
            })
            .pipe(dest);
        });
      } else {
        console.log('📤 playlist.json not found on Google Drive. Initializing by uploading local database...');
        await syncDatabaseToDrive();
      }
    } else {
      console.log('🔄 Local G: drive is active. Skipping Google Drive API database sync (local client handles it).');
    }

    return true;
  } catch (error) {
    console.error('❌ Error during Google Drive API initialization:', error);
    drive = null;
    return false;
  }
}

// Upload local file to Google Drive
async function uploadFileToDrive(filePath, filename, mimeType) {
  if (!drive || !driveFolderId) {
    throw new Error('Google Drive client is not initialized');
  }
  console.log(`📤 Uploading file to Google Drive: ${filename} (${mimeType})...`);
  const fileMetadata = {
    name: filename,
    parents: [driveFolderId]
  };
  const media = {
    mimeType: mimeType,
    body: fs.createReadStream(filePath)
  };
  const response = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id'
  });
  console.log(`📤 Uploaded ${filename} successfully. ID: ${response.data.id}`);
  return response.data.id;
}

// Delete file from Google Drive (by ID or filename)
async function deleteFileFromDrive(fileId, filename) {
  if (!drive || !driveFolderId) return;
  try {
    if (fileId) {
      console.log(`🗑️  Deleting file ID ${fileId} from Google Drive...`);
      await drive.files.delete({ fileId });
    } else if (filename) {
      console.log(`🔍 Searching for ${filename} to delete from Google Drive...`);
      const searchResponse = await drive.files.list({
        q: `name = '${filename}' and '${driveFolderId}' in parents and trashed = false`,
        fields: 'files(id)',
        spaces: 'drive'
      });
      const files = searchResponse.data.files;
      if (files && files.length > 0) {
        for (const f of files) {
          console.log(`🗑️  Deleting file ID ${f.id} (${filename}) from Google Drive...`);
          await drive.files.delete({ fileId: f.id });
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error deleting file ${filename} from Google Drive:`, error);
  }
}

// Sync local database playlist.json to Google Drive
async function syncDatabaseToDrive() {
  if (!drive || !driveFolderId) return;
  try {
    console.log('📤 Syncing playlist.json database to Google Drive...');
    const response = await drive.files.list({
      q: `name = 'playlist.json' and '${driveFolderId}' in parents and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    const files = response.data.files;
    const media = {
      mimeType: 'application/json',
      body: fs.createReadStream(dbPath)
    };

    if (files && files.length > 0) {
      const fileId = files[0].id;
      await drive.files.update({
        fileId: fileId,
        media: media
      });
      console.log('📤 Updated playlist.json on Google Drive.');
    } else {
      const fileMetadata = {
        name: 'playlist.json',
        parents: [driveFolderId]
      };
      await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
      });
      console.log('📤 Created playlist.json on Google Drive.');
    }
  } catch (error) {
    console.error('❌ Error syncing database to Google Drive:', error);
  }
}

// Sync local albums.json to Google Drive
async function syncAlbumsToDrive() {
  if (!drive || !driveFolderId) return;
  try {
    console.log('📤 Syncing albums.json database to Google Drive...');
    const response = await drive.files.list({
      q: `name = 'albums.json' and '${driveFolderId}' in parents and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    const files = response.data.files;
    const media = {
      mimeType: 'application/json',
      body: fs.createReadStream(albumsPath)
    };

    if (files && files.length > 0) {
      const fileId = files[0].id;
      await drive.files.update({
        fileId: fileId,
        media: media
      });
      console.log('📤 Updated albums.json on Google Drive.');
    } else {
      const fileMetadata = {
        name: 'albums.json',
        parents: [driveFolderId]
      };
      await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
      });
      console.log('📤 Created albums.json on Google Drive.');
    }
  } catch (error) {
    console.error('❌ Error syncing albums database to Google Drive:', error);
  }
}

async function checkAndPullAlbumsFromDrive() {
  if (!drive || !driveFolderId || isLocalGDriveActive) return;
  try {
    const response = await drive.files.list({
      q: `name = 'albums.json' and '${driveFolderId}' in parents and trashed = false`,
      fields: 'files(id, modifiedTime)',
      spaces: 'drive'
    });
    const files = response.data.files;
    if (files && files.length > 0) {
      const file = files[0];
      const driveModifiedTime = new Date(file.modifiedTime).getTime();

      let localModifiedTime = 0;
      if (fs.existsSync(albumsPath)) {
        const stats = fs.statSync(albumsPath);
        localModifiedTime = stats.mtime.getTime();
      }

      if (driveModifiedTime > localModifiedTime + 2000) {
        console.log('📥 Found newer albums database on Google Drive. Pulling updates dynamically...');
        const dest = fs.createWriteStream(albumsPath);
        const resStream = await drive.files.get(
          { fileId: file.id, alt: 'media' },
          { responseType: 'stream' }
        );
        
        await new Promise((resolve, reject) => {
          resStream.data
            .on('error', reject)
            .pipe(dest)
            .on('error', reject)
            .on('finish', resolve);
        });
        console.log('📥 Successfully pulled updated albums.json from Google Drive.');
      }
    }
  } catch (error) {
    console.error('❌ Error checking/pulling albums database from Google Drive:', error);
  }
}

let lastDriveCheckTime = 0;
const CHECK_INTERVAL_MS = 20000; // Check for updates at most once every 20 seconds to keep it very responsive yet light

async function checkAndPullDatabaseFromDrive() {
  if (!drive || !driveFolderId || isLocalGDriveActive) return;

  const now = Date.now();
  if (now - lastDriveCheckTime < CHECK_INTERVAL_MS) {
    return;
  }
  lastDriveCheckTime = now;

  try {
    const response = await drive.files.list({
      q: `name = 'playlist.json' and '${driveFolderId}' in parents and trashed = false`,
      fields: 'files(id, modifiedTime)',
      spaces: 'drive'
    });
    const files = response.data.files;
    if (files && files.length > 0) {
      const file = files[0];
      const driveModifiedTime = new Date(file.modifiedTime).getTime();

      let localModifiedTime = 0;
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        localModifiedTime = stats.mtime.getTime();
      }

      // If the file on Google Drive is newer, download it dynamically!
      if (driveModifiedTime > localModifiedTime + 2000) {
        console.log('📥 Found newer playlist database on Google Drive. Pulling updates dynamically...');
        const dest = fs.createWriteStream(dbPath);
        const resStream = await drive.files.get(
          { fileId: file.id, alt: 'media' },
          { responseType: 'stream' }
        );
        await new Promise((resolve, reject) => {
          resStream.data
            .on('end', resolve)
            .on('error', reject)
            .pipe(dest);
        });
        console.log('📥 Local database successfully synced with Google Drive.');
      }
    }
  } catch (error) {
    console.error('❌ Error checking database update on Drive:', error);
  }
}

// Unified proxy streaming route for local files & Google Drive API
app.get('/uploads/:filename', async (req, res) => {
  const { filename } = req.params;

  // 1. If physical local file exists (or G: drive mount is active), serve it directly
  const localPath = path.join(uploadsDir, filename);
  if (fs.existsSync(localPath)) {
    return res.sendFile(localPath);
  }

  // 2. Otherwise, if Google Drive API is active, stream it from Google Drive
  if (drive && driveFolderId && !isLocalGDriveActive) {
    try {
      let fileId = null;

      // Look up in database to see if we already have the Google Drive file ID cached
      const playlist = readDatabase();
      
      if (filename.startsWith('song-')) {
        const song = playlist.find(s => s.filename === filename);
        if (song && song.gdriveFileId) {
          fileId = song.gdriveFileId;
        }
      } else if (filename.startsWith('art-')) {
        const song = playlist.find(s => s.artworkUrl === `/uploads/${filename}`);
        if (song && song.gdriveArtworkFileId) {
          fileId = song.gdriveArtworkFileId;
        }
      }

      // If not cached in the database, search for it on Google Drive by name
      if (!fileId) {
        console.log(`🔍 File ID not cached for ${filename}. Searching Google Drive...`);
        const searchResponse = await drive.files.list({
          q: `name = '${filename}' and '${driveFolderId}' in parents and trashed = false`,
          fields: 'files(id, name, size, mimeType)',
          spaces: 'drive'
        });
        const files = searchResponse.data.files;
        if (files && files.length > 0) {
          fileId = files[0].id;
        }
      }

      if (fileId) {
        console.log(`🔀 Streaming ${filename} from Google Drive (File ID: ${fileId})...`);

        // Fetch file metadata to get content-length and content-type
        const meta = await drive.files.get({
          fileId: fileId,
          fields: 'size, mimeType'
        });

        const totalSize = parseInt(meta.data.size, 10);
        const mimeType = meta.data.mimeType || 'application/octet-stream';

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Accept-Ranges', 'bytes');

        const range = req.headers.range;
        if (range) {
          // Parse Range header e.g. "bytes=1000-2000"
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
          const chunkSize = (end - start) + 1;

          console.log(`🔄 Range request: bytes ${start}-${end}/${totalSize} for ${filename}`);

          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
          res.setHeader('Content-Length', chunkSize);

          const driveResponse = await drive.files.get(
            { fileId: fileId, alt: 'media' },
            { 
              responseType: 'stream',
              headers: { Range: `bytes=${start}-${end}` }
            }
          );

          driveResponse.data
            .on('error', err => {
              console.error(`Error during Google Drive streaming of ${filename}:`, err);
              if (!res.headersSent) {
                res.status(500).send('Streaming error');
              }
            })
            .pipe(res);
        } else {
          // Full file request
          res.setHeader('Content-Length', totalSize);
          const driveResponse = await drive.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'stream' }
          );

          driveResponse.data
            .on('error', err => {
              console.error(`Error during Google Drive streaming of ${filename}:`, err);
              if (!res.headersSent) {
                res.status(500).send('Streaming error');
              }
            })
            .pipe(res);
        }
        return;
      } else {
        console.warn(`⚠️ File ${filename} not found on Google Drive.`);
      }
    } catch (err) {
      console.error(`❌ Error proxying ${filename} from Google Drive:`, err);
    }
  }

  // 3. Fallback: file not found
  res.status(404).send('File not found');
});

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
    if (isLocalGDriveActive) {
      const gDriveDbPath = path.join(uploadsDir, 'playlist.json');
      fs.writeFileSync(gDriveDbPath, JSON.stringify(data, null, 2), 'utf8');
      console.log('💾 Successfully saved database to local G: drive sync directory.');
    }
    if (drive && !isLocalGDriveActive) {
      syncDatabaseToDrive().catch(err => console.error('Error syncing DB in writeDatabase:', err));
    }
  } catch (error) {
    console.error('Error writing database:', error);
  }
}

// Helper: Read albums database
function readAlbumsDatabase() {
  try {
    if (!fs.existsSync(albumsPath)) {
      fs.writeFileSync(albumsPath, JSON.stringify(DEFAULT_ALBUMS, null, 2), 'utf8');
      return DEFAULT_ALBUMS;
    }
    const data = fs.readFileSync(albumsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading albums database:', error);
    return DEFAULT_ALBUMS;
  }
}

// Helper: Write albums database
function writeAlbumsDatabase(data) {
  try {
    fs.writeFileSync(albumsPath, JSON.stringify(data, null, 2), 'utf8');
    if (isLocalGDriveActive) {
      const gDriveAlbumsPath = path.join(uploadsDir, 'albums.json');
      fs.writeFileSync(gDriveAlbumsPath, JSON.stringify(data, null, 2), 'utf8');
      console.log('💾 Successfully saved albums to local G: drive sync directory.');
    }
    if (drive && !isLocalGDriveActive) {
      syncAlbumsToDrive().catch(err => console.error('Error syncing albums DB to Drive:', err));
    }
  } catch (error) {
    console.error('Error writing albums database:', error);
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

// Middleware to authorize admin only
const adminOnly = (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || '';
  const isAdminIp = 
    ip.endsWith('127.0.0.1') || 
    ip === '::1' || 
    ip === 'localhost';
  
  const isAdminHeader = req.headers['x-admin'] === 'true';

  if (isAdminIp || isAdminHeader) {
    next();
  } else {
    res.status(403).json({ error: 'Доступ заборонено: Тільки адміністратор має право редагувати треки' });
  }
};

// API Endpoints

// 1. Get playlist
app.get('/api/playlist', async (req, res) => {
  if (drive && !isLocalGDriveActive) {
    await checkAndPullDatabaseFromDrive();
  }
  const playlist = readDatabase();
  // Sort by 'order' property ascending
  playlist.sort((a, b) => a.order - b.order);
  res.json(playlist);
});

// 2. Upload songs (multiple supported)
app.post('/api/playlist/upload', adminOnly, upload.array('audio', 50), async (req, res) => {
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

      let album = req.body.album || null;
      if (album) {
        const albumsList = readAlbumsDatabase();
        const validAlbumIds = albumsList.map(a => a.id);
        if (!validAlbumIds.includes(album)) {
          album = null;
        }
      }

      // Check for duplicate in database
      const existingSong = playlist.find(s => 
        s.title.toLowerCase() === title.toLowerCase() || 
        s.originalName.toLowerCase() === originalName.toLowerCase()
      );

      let targetSong = null;

      if (existingSong) {
        // Automatically update album assignment if it differs
        let albumChanged = false;
        if (existingSong.album !== album) {
          existingSong.album = album;
          albumChanged = true;
          console.log(`🏷️ Album for existing track "${title}" automatically updated to: ${album}`);
        }

        // Check if the physical file actually exists
        const localPath = path.join(uploadsDir, existingSong.filename);
        let physicalFileExists = fs.existsSync(localPath);
        
        // Also check if we are in cloud mode and have gdrive ID
        if (!physicalFileExists && drive && !isLocalGDriveActive && existingSong.gdriveFileId) {
          physicalFileExists = true;
        }

        if (physicalFileExists) {
          // File is present, we only updated the album (if changed)
          if (albumChanged) {
            addedSongs.push(existingSong); // Include in response to notify client of change
          }
          console.log(`⚠️ Skipping duplicate audio file upload for: "${title}" (already exists)`);
          fs.unlink(file.path, (err) => {
            if (err && err.code !== 'ENOENT') {
              console.error(`Error unlinking temp duplicate file ${file.path}:`, err);
            }
          });
          continue;
        } else {
          // Physical file is missing, we will restore it!
          console.log(`🔄 Restoring missing physical file for existing track: "${title}" (${originalName})`);
          targetSong = existingSong;
        }
      }

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

      // Google Drive API upload if active and not G: drive local sync
      let gdriveFileId = null;
      let gdriveArtworkFileId = null;

      if (drive && !isLocalGDriveActive) {
        try {
          // Upload audio file
          gdriveFileId = await uploadFileToDrive(file.path, file.filename, file.mimetype);
          
          // Delete temporary local audio file
          fs.unlink(file.path, (err) => {
            if (err && err.code !== 'ENOENT') console.error(`Error unlinking temp audio ${file.path}:`, err);
          });

          // Upload artwork file if present
          if (artworkUrl) {
            const artFilename = path.basename(artworkUrl);
            const artPath = path.join(uploadsDir, artFilename);
            gdriveArtworkFileId = await uploadFileToDrive(artPath, artFilename, 'image/jpeg');
            
            // Delete temporary local artwork file
            fs.unlink(artPath, (err) => {
              if (err && err.code !== 'ENOENT') console.error(`Error unlinking temp artwork ${artPath}:`, err);
            });
          }
        } catch (uploadErr) {
          console.error(`❌ Google Drive API upload failed for ${file.originalname}:`, uploadErr);
        }
      }

      if (targetSong) {
        // Update existing song
        targetSong.filename = file.filename;
        targetSong.size = file.size;
        if (artworkUrl) targetSong.artworkUrl = artworkUrl;
        if (duration) targetSong.duration = duration;
        targetSong.createdAt = new Date().toISOString();
        if (album) targetSong.album = album;
        if (gdriveFileId) targetSong.gdriveFileId = gdriveFileId;
        if (gdriveArtworkFileId) targetSong.gdriveArtworkFileId = gdriveArtworkFileId;
        
        addedSongs.push(targetSong);
        console.log(`✅ Restored "${title}" in database.`);
      } else {
        // Create new song
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
          createdAt: new Date().toISOString(),
          album: album,
          ...(gdriveFileId && { gdriveFileId }),
          ...(gdriveArtworkFileId && { gdriveArtworkFileId })
        };
        playlist.push(newSong);
        addedSongs.push(newSong);
      }
    }

    if (addedSongs.length === 0 && req.files && req.files.length > 0) {
      return res.status(400).json({ error: 'Усі обрані треки вже є у плейлисті!' });
    }

    writeDatabase(playlist);

    res.status(201).json(addedSongs);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 3. Reorder playlist
app.post('/api/playlist/reorder', adminOnly, (req, res) => {
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
app.delete('/api/playlist/:id', adminOnly, (req, res) => {
  const { id } = req.params;
  let playlist = readDatabase();
  
  const songIndex = playlist.findIndex(s => s.id === id);
  if (songIndex === -1) {
    return res.status(404).json({ error: 'Song not found' });
  }

  const song = playlist[songIndex];

  // Remove from database
  playlist.splice(songIndex, 1);

  // Recalculate orders to keep them continuous
  playlist = playlist.map((s, idx) => {
    s.order = idx + 1;
    return s;
  });

  writeDatabase(playlist);

  // Delete from Google Drive if API is active
  if (drive && !isLocalGDriveActive) {
    deleteFileFromDrive(song.gdriveFileId, song.filename).catch(err => 
      console.error(`Error deleting song file from Drive:`, err)
    );
    
    if (song.artworkUrl) {
      const artworkFilename = path.basename(song.artworkUrl);
      deleteFileFromDrive(song.gdriveArtworkFileId, artworkFilename).catch(err =>
        console.error(`Error deleting artwork file from Drive:`, err)
      );
    }
  } else {
    // Local filesystem delete
    const filePath = path.join(uploadsDir, song.filename);
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        console.error(`Error deleting file ${filePath}:`, err);
      }
    });

    if (song.artworkUrl) {
      const artworkFilename = path.basename(song.artworkUrl);
      const artworkPath = path.join(uploadsDir, artworkFilename);
      fs.unlink(artworkPath, (err) => {
        if (err && err.code !== 'ENOENT') {
          console.error(`Error deleting artwork file ${artworkPath}:`, err);
        }
      });
    }
  }

  res.json({ success: true, message: 'Song deleted successfully' });
});

// 4.5. Update song album
app.put('/api/playlist/:id/album', adminOnly, (req, res) => {
  const { id } = req.params;
  let { album } = req.body;

  const playlist = readDatabase();
  const songIndex = playlist.findIndex(s => s.id === id);
  if (songIndex === -1) {
    return res.status(404).json({ error: 'Song not found' });
  }

  if (album) {
    const albumsList = readAlbumsDatabase();
    const validAlbumIds = albumsList.map(a => a.id);
    if (!validAlbumIds.includes(album)) {
      album = null;
    }
  }

  playlist[songIndex].album = album || null;
  writeDatabase(playlist);

  res.json({ success: true, song: playlist[songIndex] });
});

// 4.6. Get all albums
app.get('/api/albums', async (req, res) => {
  if (drive && !isLocalGDriveActive) {
    await checkAndPullAlbumsFromDrive();
  }
  const albums = readAlbumsDatabase();
  res.json(albums);
});

// 4.7. Save all albums
app.post('/api/albums', adminOnly, (req, res) => {
  const albums = req.body;
  if (!Array.isArray(albums)) {
    return res.status(400).json({ error: 'Expected an array of albums' });
  }

  // Validate album objects
  for (const album of albums) {
    if (!album.id || !album.name) {
      return res.status(400).json({ error: 'Each album must have an id and a name' });
    }
  }

  writeAlbumsDatabase(albums);

  // Clean up songs: if a song's album ID is no longer in the list of valid album IDs, set it to null!
  const validAlbumIds = albums.map(a => a.id);
  const playlist = readDatabase();
  let playlistChanged = false;
  playlist.forEach(song => {
    if (song.album && !validAlbumIds.includes(song.album)) {
      song.album = null;
      playlistChanged = true;
    }
  });

  if (playlistChanged) {
    writeDatabase(playlist);
  }

  res.json({ success: true, albums });
});

// 4.8. Force system update check & reload trigger
app.post('/api/system/update', adminOnly, async (req, res) => {
  try {
    console.log('🔄 Admin triggered system-wide update & sync check...');
    
    // 1. Force sync from Google Drive
    if (drive && !isLocalGDriveActive) {
      console.log('🔄 Checking Google Drive for playlist/albums updates...');
      await checkAndPullAlbumsFromDrive();
      const oldCheckTime = lastDriveCheckTime;
      lastDriveCheckTime = 0;
      await checkAndPullDatabaseFromDrive();
      if (lastDriveCheckTime === 0) {
        lastDriveCheckTime = oldCheckTime;
      }
    } else if (isLocalGDriveActive) {
      console.log('🔄 Local G: drive mode: reloading database and albums files from disk...');
      const gDriveDbPath = path.join(uploadsDir, 'playlist.json');
      if (fs.existsSync(gDriveDbPath)) {
        fs.copyFileSync(gDriveDbPath, dbPath);
        console.log('📥 Successfully re-synchronized playlist.json from local G: drive.');
      }
      const gDriveAlbumsPath = path.join(uploadsDir, 'albums.json');
      if (fs.existsSync(gDriveAlbumsPath)) {
        fs.copyFileSync(gDriveAlbumsPath, albumsPath);
        console.log('📥 Successfully re-synchronized albums.json from local G: drive.');
      }
    }

    // 2. Increment system version to trigger client-side update reload
    systemVersion = Date.now();
    
    fs.writeFileSync(
      path.join(dbDir, 'system_version.json'),
      JSON.stringify({ systemVersion }),
      'utf8'
    );
    
    console.log(`📡 Broadcasted new System Version: ${systemVersion} to all players.`);
    res.json({ success: true, systemVersion });
  } catch (err) {
    console.error('Failed to run manual update check:', err);
    res.status(500).json({ error: err.message || 'Failed to trigger update check' });
  }
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

// Start Server after initializing Google Drive
(async () => {
  console.log('🔄 Initializing system...');

  // Local G: drive startup synchronization
  if (isLocalGDriveActive) {
    const gDriveDbPath = path.join(uploadsDir, 'playlist.json');
    if (fs.existsSync(gDriveDbPath)) {
      try {
        fs.copyFileSync(gDriveDbPath, dbPath);
        console.log('📥 Successfully synchronized database from local G: drive on startup.');
      } catch (err) {
        console.error('Error loading database from local G: drive:', err);
      }
    }
    const gDriveAlbumsPath = path.join(uploadsDir, 'albums.json');
    if (fs.existsSync(gDriveAlbumsPath)) {
      try {
        fs.copyFileSync(gDriveAlbumsPath, albumsPath);
        console.log('📥 Successfully synchronized albums database from local G: drive on startup.');
      } catch (err) {
        console.error('Error loading albums from local G: drive:', err);
      }
    }
  }

  const driveInitialized = await initGoogleDrive();
  if (driveInitialized) {
    console.log('💚 Google Drive API integration initialized successfully.');
  } else {
    console.log('💛 Running server in standard local filesystem mode.');
  }

  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` Trucker DJ Player Server is running!`);
    console.log(` PC Local: http://localhost:${PORT}`);
    console.log(` Mobile Local Network: http://${getLocalIP()}:${PORT}`);
    console.log(`====================================================`);
  });
})();

