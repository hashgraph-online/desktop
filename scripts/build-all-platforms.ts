/**
 * Build distributables for all platforms
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface BuildResult {
  platform: string;
  arch: string;
  success: boolean;
  artifact?: string;
  error?: string;
}

const platforms = [
  { platform: 'darwin', arch: 'arm64' },
  { platform: 'darwin', arch: 'x64' },
  { platform: 'win32', arch: 'x64' },
  { platform: 'linux', arch: 'x64' },
];

async function buildPlatform(
  platform: string,
  arch: string
): Promise<BuildResult> {
  console.log(`\n📦 Building for ${platform}/${arch}...`);

  try {
    execSync(
      `pnpm exec electron-forge make --platform=${platform} --arch=${arch}`,
      { stdio: 'inherit' }
    );

    // Check for output artifacts
    const zipPath = path.join(
      __dirname,
      '..',
      'out',
      'make',
      'zip',
      platform,
      arch
    );

    let artifact: string | undefined;
    if (fs.existsSync(zipPath)) {
      const files = fs.readdirSync(zipPath);
      const zipFile = files.find(
        (f) => f.endsWith('.zip') && f.startsWith('app-')
      );
      if (zipFile) {
        artifact = path.join(zipPath, zipFile);
      }
    }

    console.log(`✅ Successfully built ${platform}/${arch}`);
    if (artifact) {
      console.log(`   📍 Artifact: ${artifact}`);
    }

    return {
      platform,
      arch,
      success: true,
      artifact,
    };
  } catch (error) {
    console.error(`❌ Failed to build ${platform}/${arch}`);
    console.error(
      `   Error: ${error instanceof Error ? error.message : error}`
    );

    return {
      platform,
      arch,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log('🔨 Building Electron app for all platforms...\n');
  console.log('📝 Preparing icons...');

  try {
    execSync('npm run prepare-icons', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Failed to prepare icons:', error);
    process.exit(1);
  }

  const results: BuildResult[] = [];

  for (const { platform, arch } of platforms) {
    const result = await buildPlatform(platform, arch);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Build Summary:\n');

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  if (successful.length > 0) {
    console.log('✅ Successful builds:');
    for (const result of successful) {
      console.log(`   • ${result.platform}/${result.arch}`);
      if (result.artifact) {
        console.log(`     ${result.artifact}`);
      }
    }
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed builds:');
    for (const result of failed) {
      console.log(`   • ${result.platform}/${result.arch}: ${result.error}`);
    }
  }

  console.log('\n' + '='.repeat(60));

  if (failed.length > 0) {
    console.log("\n⚠️  Some builds failed. This is normal if you're on macOS:");
    console.log('   - Linux builds require Linux or Docker');
    console.log('   - Windows .exe installer requires Wine (ZIP works)');
    console.log('   - Use CI/CD for cross-platform signed builds');
  }

  process.exit(failed.length === platforms.length ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
