import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist');
const swSourcePath = path.join(__dirname, 'public', 'sw.js');
const swDestPath = path.join(distDir, 'sw.js');

// Function to recursively get files
function getFiles(dir, baseDir = '') {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    const relativePath = path.join(baseDir, file).replace(/\\/g, '/');
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath, relativePath));
    } else {
      // Skip sw.js, manifest.json, index.html (already at root '/'), and maps
      if (file !== 'sw.js' && file !== 'manifest.json' && file !== 'index.html' && !file.endsWith('.map')) {
        results.push('/' + relativePath);
      }
    }
  });
  return results;
}

try {
  const assetsList = [
    '/',
    '/manifest.json',
    '/black_leather_seamless.png',
    '/mahogany_wood_texture.png',
    '/logo.png',
    ...getFiles(distDir)
  ];
  
  // Remove duplicate entries if any
  const uniqueAssets = Array.from(new Set(assetsList));
  
  console.log('Detected PWA build assets for caching:', uniqueAssets);
  
  let swContent = fs.readFileSync(swSourcePath, 'utf8');
  
  // Replace the placeholder const ASSETS = [...];
  swContent = swContent.replace(
    /const ASSETS = \[[^]*?\];/,
    `const ASSETS = ${JSON.stringify(uniqueAssets, null, 2)};`
  );
  
  fs.writeFileSync(swDestPath, swContent, 'utf8');
  console.log('Successfully generated service worker with production assets in client/dist/sw.js');
} catch (error) {
  console.error('Failed to generate service worker:', error);
  process.exit(1);
}
