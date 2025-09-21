import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { config } from 'dotenv';
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

config();

function identityAvailable(id) {
  if (!id) return false;
  try {
    const out = execSync('security find-identity -v -p codesigning', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return out.includes(id);
  } catch {
    return false;
  }
}

const envIdentity = process.env.APPLE_SIGNING_IDENTITY || process.env.CSC_NAME;
const hasSigningIdentity = identityAvailable(envIdentity);

const forgeConfig = {
  packagerConfig: {
    packageManager: 'pnpm',
    prune: true,
    name: 'HOL Desktop',
    icon: './assets/hol-dock',
    appBundleId: 'com.hashgraphonline.desktop',
    appCategoryType: 'public.app-category.productivity',
    extendInfo: {
      CFBundleName: 'HOL Desktop',
      CFBundleDisplayName: 'HOL Desktop',
      CFBundleShortVersionString: '1.0.0',
    },
    osxSign:
      process.platform === 'darwin' && hasSigningIdentity
        ? {
            identity:
              process.env.APPLE_SIGNING_IDENTITY || process.env.CSC_NAME,
            hardenedRuntime: true,
            gatekeeperAssess: false,
            entitlements: './assets/entitlements.mac.plist',
            'entitlements-inherit': './assets/entitlements.mac.plist',
          }
        : false,
    osxNotarize:
      process.platform === 'darwin' && process.env.SKIP_NOTARIZE !== '1' && hasSigningIdentity
        ? (
            process.env.NOTARY_KEYCHAIN_PROFILE || process.env.KEYCHAIN_PROFILE
              ? {
                  tool: 'notarytool',
                  keychainProfile:
                    process.env.NOTARY_KEYCHAIN_PROFILE || process.env.KEYCHAIN_PROFILE,
                }
              : process.env.APPLE_API_KEY &&
                process.env.APPLE_API_ISSUER &&
                process.env.APPLE_API_KEY_ID
                ? {
                    tool: 'notarytool',
                    appleApiKey: process.env.APPLE_API_KEY,
                    appleApiKeyId: process.env.APPLE_API_KEY_ID,
                    appleApiIssuer: process.env.APPLE_API_ISSUER,
                  }
                : process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD
                ? {
                    tool: 'notarytool',
                    appleId: process.env.APPLE_ID,
                    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
                    teamId: process.env.APPLE_TEAM_ID,
                  }
                : undefined
          )
        : undefined,
    asar: {
      unpack: '**/*.node',
    },
    extraResource: [
      './src/main/db/migrations'
    ],
  },
  rebuildConfig: {},
  hooks: {
    async packageAfterPrune(config, buildPath, electronVersion) {
      try {
        const srcRoot = resolve(process.cwd(), 'node_modules');
        const destRoot = join(buildPath, 'node_modules');
        const deps = ['better-sqlite3', 'bindings', 'file-uri-to-path'];
        if (!existsSync(destRoot)) mkdirSync(destRoot, { recursive: true });
        for (const dep of deps) {
          const src = join(srcRoot, dep);
          const dst = join(destRoot, dep);
          if (existsSync(src)) {
            console.log(`[forge.hook] Copying ${dep} -> staging`);
            cpSync(src, dst, { recursive: true, dereference: true });
          } else {
            console.warn(`[forge.hook] Missing ${dep} in project node_modules`);
          }
        }

        const cmd = `npx electron-rebuild -m "${buildPath}" -v ${electronVersion} -f -w better-sqlite3`;
        console.log(`[forge.hook] Rebuilding native modules in staging: ${cmd}`);
        const env = { ...process.env, HOME: buildPath };
        execSync(cmd, { stdio: 'inherit', env });
      } catch (err) {
        console.warn('[forge.hook] electron-rebuild in staging failed:', err?.message || err);
      }
    },
  },
  makers: [
    new MakerSquirrel(
      {
        name: 'HashgraphOnline',
        setupIcon: './assets/hol-app-icon-bubble.ico',
        authors: 'Hashgraph Online',
        description: 'Desktop application for HashgraphOnline',
        noMsi: true,
      },
      ['win32']
    ),
    new MakerZIP({}, ['darwin', 'win32', 'linux']),
    new MakerDMG(
      {
        format: 'ULFO',
        icon: './assets/hol-dock.icns',
      },
      ['darwin']
    ),
    new MakerRpm(
      {
        options: {
          categories: ['Utility'],
          description: 'Desktop application for HashgraphOnline',
          icon: './assets/HOL-Icon.png',
        },
      },
      ['linux']
    ),
    new MakerDeb(
      {
        options: {
          categories: ['Utility'],
          description: 'Desktop application for HashgraphOnline',
          icon: './assets/HOL-Icon.png',
        },
      },
      ['linux', 'arm64']
    ),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.mjs',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.mjs',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mjs',
        },
      ],
    }),
  ],
};

export default forgeConfig;
