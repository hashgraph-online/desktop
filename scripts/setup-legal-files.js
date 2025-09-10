#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, '..');

const files = [
  { 
    source: 'terms.md.example', 
    targets: ['terms.md', 'public/terms.md']
  },
  { 
    source: 'privacy.md.example', 
    targets: ['privacy.md', 'public/privacy.md']
  }
];

console.log('Setting up legal files...\n');

files.forEach(({ source, targets }) => {
  const sourcePath = path.join(rootDir, source);
  
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Source file ${source} not found`);
    process.exit(1);
  }
  
  targets.forEach(target => {
    const targetPath = path.join(rootDir, target);
    const targetDir = path.dirname(targetPath);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`✅ Created ${target} from ${source}`);
    } else {
      console.log(`✓ ${target} already exists`);
    }
  });
});

console.log('\n✨ Legal files setup complete!');