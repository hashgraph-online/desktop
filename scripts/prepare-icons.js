#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const assetsDir = path.join(__dirname, '..', 'assets');
const buildDir = path.join(__dirname, '..', 'build');
// Use hol-dock.png as the canonical app icon source
const iconPng = path.join(assetsDir, 'hol-dock.png');
const iconIcns = path.join(assetsDir, 'hol-dock.icns');

console.log('🔧 Preparing application icons (hol-dock)...');

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Check if hol-dock.png exists
if (!fs.existsSync(iconPng)) {
  console.error('❌ hol-dock.png not found in assets directory');
  process.exit(1);
}

// Create iconset directory for macOS
const iconsetDir = path.join(buildDir, 'icon.iconset');
if (fs.existsSync(iconsetDir)) {
  fs.rmSync(iconsetDir, { recursive: true });
}
fs.mkdirSync(iconsetDir);

console.log('📝 Creating icon sizes for macOS...');

// Icon sizes needed for macOS icns file
const iconSizes = [
  { size: 16, scale: 1, name: 'icon_16x16.png' },
  { size: 16, scale: 2, name: 'icon_16x16@2x.png' },
  { size: 32, scale: 1, name: 'icon_32x32.png' },
  { size: 32, scale: 2, name: 'icon_32x32@2x.png' },
  { size: 128, scale: 1, name: 'icon_128x128.png' },
  { size: 128, scale: 2, name: 'icon_128x128@2x.png' },
  { size: 256, scale: 1, name: 'icon_256x256.png' },
  { size: 256, scale: 2, name: 'icon_256x256@2x.png' },
  { size: 512, scale: 1, name: 'icon_512x512.png' },
  { size: 512, scale: 2, name: 'icon_512x512@2x.png' },
];

try {
  // Generate all required icon sizes using sips (macOS built-in tool)
  for (const iconSize of iconSizes) {
    const actualSize = iconSize.size * iconSize.scale;
    const outputPath = path.join(iconsetDir, iconSize.name);

    console.log(`   Creating ${iconSize.name} (${actualSize}x${actualSize})`);

    try {
      execSync(
        `sips -z ${actualSize} ${actualSize} "${iconPng}" --out "${outputPath}"`,
        {
          stdio: 'pipe',
        }
      );
    } catch (error) {
      console.warn(
        `⚠️  Warning: Could not create ${iconSize.name} - ${error.message}`
      );
    }
  }

  // Convert iconset to icns using iconutil (macOS built-in tool)
  console.log('🔄 Converting to .icns format...');
  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${iconIcns}"`, {
      stdio: 'pipe',
    });
    console.log('✅ Successfully created icon.icns');
  } catch (error) {
    console.warn('⚠️  Warning: Could not create .icns file - iconutil failed');
    console.warn('   This is normal on non-macOS systems');
  }

  // Clean up iconset directory
  fs.rmSync(iconsetDir, { recursive: true });

  console.log('🎉 Icon preparation complete!');
} catch (error) {
  console.error('❌ Error preparing icons:', error.message);

  // Clean up on error
  if (fs.existsSync(iconsetDir)) {
    fs.rmSync(iconsetDir, { recursive: true });
  }

  process.exit(1);
}
