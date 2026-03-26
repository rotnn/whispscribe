/**
 * Generates all required Tauri icon PNGs from icon.svg using sharp,
 * then rebuilds icon.icns via macOS iconutil.
 *
 * Usage: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import { execSync } from 'child_process';
import { mkdirSync, copyFileSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, '..');
const iconsDir  = resolve(root, 'src-tauri/icons');
const svgPath   = resolve(iconsDir, 'icon.svg');

// PNGs Tauri expects
const targets = [
  { file: '32x32.png',       size: 32  },
  { file: '128x128.png',     size: 128 },
  { file: '128x128@2x.png',  size: 256 },
  { file: 'icon.png',        size: 1024 },
];

console.log('Generating PNGs from icon.svg…');
for (const { file, size } of targets) {
  const out = resolve(iconsDir, file);
  await sharp(svgPath)
    .resize(size, size)
    .png()
    .toFile(out);
  console.log(`  ✓ ${file} (${size}×${size})`);
}

// Build icon.icns via iconutil (macOS only)
if (process.platform !== 'darwin') {
  console.log('Skipping icon.icns — not on macOS');
  process.exit(0);
}

console.log('Building icon.icns…');

const iconsetDir = resolve(iconsDir, 'AppIcon.iconset');
if (existsSync(iconsetDir)) rmSync(iconsetDir, { recursive: true });
mkdirSync(iconsetDir);

// iconutil expects these exact filenames
const iconsetSizes = [
  { name: 'icon_16x16.png',      size: 16  },
  { name: 'icon_16x16@2x.png',   size: 32  },
  { name: 'icon_32x32.png',      size: 32  },
  { name: 'icon_32x32@2x.png',   size: 64  },
  { name: 'icon_64x64.png',      size: 64  },
  { name: 'icon_64x64@2x.png',   size: 128 },
  { name: 'icon_128x128.png',    size: 128 },
  { name: 'icon_128x128@2x.png', size: 256 },
  { name: 'icon_256x256.png',    size: 256 },
  { name: 'icon_256x256@2x.png', size: 512 },
  { name: 'icon_512x512.png',    size: 512 },
  { name: 'icon_512x512@2x.png', size: 1024},
];

for (const { name, size } of iconsetSizes) {
  await sharp(svgPath)
    .resize(size, size)
    .png()
    .toFile(resolve(iconsetDir, name));
}

const icnsOut = resolve(iconsDir, 'icon.icns');
execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsOut}"`);
console.log('  ✓ icon.icns');

rmSync(iconsetDir, { recursive: true });
console.log('Done.');
