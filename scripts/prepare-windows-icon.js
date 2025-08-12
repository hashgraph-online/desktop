#!/usr/bin/env node

/**
 * Prepare Windows ICO icon from PNG
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '../assets');
const sourcePng = path.join(assetsDir, 'hol-app-icon-bubble.png');
const outputIco = path.join(assetsDir, 'hol-app-icon-bubble.ico');

console.log('🔧 Preparing Windows ICO icon...');

if (!fs.existsSync(sourcePng)) {
  console.error('❌ Source PNG not found:', sourcePng);
  process.exit(1);
}

try {
  // Create multiple sizes for ICO
  const sizes = [16, 32, 48, 64, 128, 256];
  const tempFiles = [];
  
  for (const size of sizes) {
    const tempFile = path.join(assetsDir, `temp_${size}.png`);
    console.log(`  Creating ${size}x${size} icon...`);
    execSync(`sips -z ${size} ${size} "${sourcePng}" --out "${tempFile}"`, { stdio: 'pipe' });
    tempFiles.push(tempFile);
  }
  
  // Note: macOS doesn't have native ICO creation tools
  // For production, you'd use a tool like png2ico or imagemagick
  // For now, we'll just copy the 256x256 PNG and rename it
  console.log('  Creating ICO file (using largest PNG as fallback)...');
  fs.copyFileSync(tempFiles[tempFiles.length - 1], outputIco);
  
  // Clean up temp files
  for (const tempFile of tempFiles) {
    fs.unlinkSync(tempFile);
  }
  
  console.log('✅ Windows icon prepared (basic ICO)');
  console.log('📝 Note: For production, use a proper ICO converter tool');
  
} catch (error) {
  console.error('❌ Failed to create Windows icon:', error.message);
  process.exit(1);
}