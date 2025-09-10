#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appDir = path.join(__dirname, '..');
const icons = [
  {
    input: path.join(appDir, 'hol-app-icon.png'),
    output: path.join(appDir, 'assets', 'hol-app-icon.icns'),
    name: 'hol-app-icon'
  },
  {
    input: path.join(appDir, 'hol-app-icon-bubble.png'),
    output: path.join(appDir, 'assets', 'hol-app-icon-bubble.icns'),
    name: 'hol-app-icon-bubble'
  }
];

console.log('🔧 Generating .icns files for HOL app icons...');

icons.forEach(({ input, output, name }) => {
  if (!fs.existsSync(input)) {
    console.error(`❌ ${name}.png not found at ${input}`);
    return;
  }

  const iconsetDir = path.join(appDir, 'build', `${name}.iconset`);
  if (fs.existsSync(iconsetDir)) {
    fs.rmSync(iconsetDir, { recursive: true });
  }
  fs.mkdirSync(iconsetDir, { recursive: true });

  console.log(`📝 Creating icon sizes for ${name}...`);

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
    { size: 512, scale: 2, name: 'icon_512x512@2x.png' }
  ];

  try {
    for (const iconSize of iconSizes) {
      const actualSize = iconSize.size * iconSize.scale;
      const outputPath = path.join(iconsetDir, iconSize.name);
      
      console.log(`   Creating ${iconSize.name} (${actualSize}x${actualSize})`);
      
      try {
        execSync(`sips -z ${actualSize} ${actualSize} "${input}" --out "${outputPath}"`, { 
          stdio: 'pipe' 
        });
      } catch (error) {
        console.warn(`⚠️  Warning: Could not create ${iconSize.name} - ${error.message}`);
      }
    }

    console.log(`🔄 Converting ${name} to .icns format...`);
    try {
      execSync(`iconutil -c icns "${iconsetDir}" -o "${output}"`, { stdio: 'pipe' });
      console.log(`✅ Successfully created ${name}.icns`);
    } catch (error) {
      console.error(`❌ Failed to create ${name}.icns - ${error.message}`);
    }

    fs.rmSync(iconsetDir, { recursive: true });
    
  } catch (error) {
    console.error(`❌ Error processing ${name}:`, error.message);
    
    if (fs.existsSync(iconsetDir)) {
      fs.rmSync(iconsetDir, { recursive: true });
    }
  }
});

console.log('🎉 Icon generation complete!');