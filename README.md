# Hashgraph Online Desktop App

A modern desktop application for the Hashgraph Online Conversational Agent, built with Electron, React, and TypeScript.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (20+ recommended)
- **pnpm** 8+ (auto-installed by setup script if missing)
- **Git**

### Installation

#### Option 1: Automated Setup (Recommended) 🎯

```bash
# Clone the repository
git clone https://github.com/hashgraph-online/desktop
cd desktop/app

# Run the interactive setup
./setup.sh

# Or run with specific commands:
./setup.sh --full    # Complete setup + build
./setup.sh --dev     # Setup + start dev server
./setup.sh --help    # See all options
```

**Setup Script Options:**
| Command | Description |
|---------|-------------|
| `./setup.sh` | Interactive menu with all options |
| `./setup.sh --full` | Complete setup (legal files + install + build) |
| `./setup.sh --install` | Install dependencies only |
| `./setup.sh --legal` | Setup legal files only |
| `./setup.sh --build` | Build for current platform |
| `./setup.sh --dev` | Start development server |

#### Option 2: Using Node.js Scripts

```bash
# Clone and navigate to app
git clone https://github.com/hashgraph-online/desktop
cd desktop/app

# Setup legal files using Node.js script
node scripts/setup-legal.js

# Install and build
pnpm install
pnpm build
```

#### Option 3: Manual Setup

```bash
# Clone repository
git clone https://github.com/hashgraph-online/desktop
cd desktop/app

# Setup legal files manually
cp terms.md.example terms.md
cp privacy.md.example privacy.md
mkdir -p public
cp terms.md.example public/terms.md
cp privacy.md.example public/privacy.md

# Install and build
pnpm install
pnpm build
```

## 📝 Legal Files Configuration

The app requires terms of service and privacy policy files:

| Source File | Target Locations |
|-------------|------------------|
| `terms.md.example` | → `terms.md`<br>→ `public/terms.md` |
| `privacy.md.example` | → `privacy.md`<br>→ `public/privacy.md` |

**Important:** Customize these files for your organization before distribution!

## 💻 Development

### Start Development Server

```bash
pnpm start   # Starts Electron app in dev mode (RECOMMENDED)
# or
pnpm dev     # Same as above
```

**Development Mode Features:**
- ✅ Auto-opens Electron window
- ✅ Runs on http://localhost:5173 (Vite dev server)
- ✅ Hot module replacement enabled
- ✅ DevTools available for debugging
- ✅ Auto-restart on code changes
- ✅ All dependencies available (including local file dependencies)

### Other Development Commands

```bash
pnpm test          # Run tests
pnpm test:watch    # Run tests in watch mode
pnpm test:coverage # Run tests with coverage
pnpm typecheck     # Type checking
pnpm storybook     # View component stories
```

## 📦 Building for Production

### Build Commands

```bash
# Step 1: Build the application
pnpm build

# Step 2: Create distribution package for your platform
pnpm dist:mac     # macOS distribution
pnpm dist:win     # Windows distribution  
pnpm dist:linux   # Linux distribution

# Or use setup script (auto-detects platform)
./setup.sh --build
```

### Build Output Structure

```
out/
├── Hashgraph Online-{platform}-{arch}/
│   ├── Hashgraph Online.app     # macOS executable
│   ├── Hashgraph Online.exe     # Windows executable
│   └── hashgraph-online         # Linux executable
│
└── make/                         # Distribution packages
    ├── zip/                      # macOS
    │   └── darwin/
    │       └── {arch}/
    │           └── *.zip         # Distributable ZIP
    │
    ├── squirrel.windows/         # Windows
    │   └── {arch}/
    │       └── *.exe             # Setup installer
    │
    └── deb/                      # Linux
        └── {arch}/
            └── *.deb             # Debian package
```

### Platform-Specific Output Locations

#### 🍎 macOS

| Build Type | Location | Usage |
|------------|----------|-------|
| **App Bundle** | `out/Hashgraph Online-darwin-arm64/Hashgraph Online.app` | For testing only* |
| **Distribution** | `out/make/zip/darwin/arm64/*.zip` | Share with users |

**Installation:** Unzip and drag `.app` to Applications folder

> **Note**: The `.app` file in `out/` is for testing purposes. For production use, always distribute the `.zip` package from `out/make/`. If you need to test the app locally, use `pnpm start` for the best experience.

#### 🪟 Windows

| Build Type | Location | Usage |
|------------|----------|-------|
| **Executable** | `out/Hashgraph Online-win32-x64/Hashgraph Online.exe` | Direct execution |
| **Installer** | `out/make/squirrel.windows/x64/*.exe` | Distribute to users |

**Installation:** Run the installer `.exe`

#### 🐧 Linux

| Build Type | Location | Usage |
|------------|----------|-------|
| **AppImage** | `out/make/*.AppImage` | Portable, no install needed |
| **Deb Package** | `out/make/deb/x64/*.deb` | For Debian/Ubuntu |

**Installation:** 
- AppImage: Make executable and run
- Deb: `sudo dpkg -i package.deb`

## ⚙️ Configuration

The app requires configuration of:

### 1. Hedera Network Credentials
- Account ID (format: `0.0.xxxxx`)
- Private Key (ED25519 or ECDSA)
- Network selection (Testnet/Mainnet)

### 2. OpenAI API
- API Key (starts with `sk-`)
- Model selection (`gpt-4o`, `gpt-4`, `gpt-3.5-turbo`)

### 3. MCP Servers (Optional)
- Filesystem access
- GitHub integration
- Database connections
- Custom servers

## 🛠️ Troubleshooting

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| **Missing legal files error** | Run `./setup.sh --legal` or `node scripts/setup-legal.js` |
| **Build fails on macOS** | Install Xcode tools: `xcode-select --install`<br>Clear cache: `rm -rf out/ .vite/` |
| **pnpm not found** | Run `npm install -g pnpm` or use setup script |
| **Electron fails to start** | Clear and reinstall: `rm -rf node_modules && pnpm install` |
| **Port 5173 in use** | Kill process: `lsof -ti:5173 \| xargs kill` |
| **Packaged app error: `Cannot find module '@hashgraphonline/standards-sdk'`** | This happens if the SDK was externalized from the main bundle. Fix: in `vite.main.config.ts`, do not list `@hashgraphonline/*` under `rollupOptions.external` so Vite bundles the module. Ensure it’s in `dependencies` (not `devDependencies`). Rebuild with `pnpm make`. See electron-vite docs: [Troubleshooting](https://electron-vite.org/guide/troubleshooting). |

### Notes on native modules (e.g., better-sqlite3)

- Native addons must be unpacked from ASAR. We configure:
  - `forge.config.ts` → `packagerConfig.asar = { unpack: '**/*.node' }`
- Reference: [Electron: Using native Node modules](https://www.electronjs.org/de/docs/latest/tutorial/using-native-node-modules)

## 📁 Project Structure

```
app/
├── src/
│   ├── main/              # Electron main process
│   ├── preload/           # Preload scripts
│   └── renderer/          # React application
│       ├── components/    # UI components
│       ├── pages/         # App pages
│       └── store/         # State management
│
├── scripts/
│   ├── setup-legal.js     # Legal files setup (Node.js)
│   └── prepare-icons.js   # Icon generation script
│
├── setup.sh               # Automated setup script (Bash)
├── terms.md.example       # Terms template
├── privacy.md.example     # Privacy template
├── package.json           # Project configuration
└── forge.config.ts        # Electron Forge config
```

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm start` | Start development server |
| `pnpm dev` | Alias for start |
| `pnpm build` | Build application |
| `pnpm dist:mac` | Build macOS distribution |
| `pnpm dist:win` | Build Windows distribution |
| `pnpm dist:linux` | Build Linux distribution |
| `pnpm test` | Run tests |
| `pnpm typecheck` | Check TypeScript types |
| `pnpm storybook` | Launch Storybook |

## 🏗️ Built With

- [Electron](https://electronjs.org) - Cross-platform desktop framework
- [React](https://reactjs.org) - UI library
- [Vite](https://vitejs.dev) - Build tool & dev server
- [TypeScript](https://www.typescriptlang.org) - Type safety
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [@hashgraphonline/conversational-agent](https://www.npmjs.com/package/@hashgraphonline/conversational-agent) - AI agent library

## 📋 System Requirements

### macOS
- macOS 10.15+ (Catalina or later)
- Apple Silicon (M1/M2/M3) or Intel processor

### Windows
- Windows 10 or later
- 64-bit processor

### Linux
- Ubuntu 18.04+, Fedora 32+, Debian 10+
- 64-bit processor