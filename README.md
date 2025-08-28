# Hashgraph Online Desktop App

A modern desktop application for the Hashgraph Online Conversational Agent, built with Electron, React, and TypeScript.

## 🚀 Quick Start

⚠️ **ALPHA SOFTWARE WARNING** ⚠️

This is an alpha version. By using this software, you acknowledge:

- AI models make mistakes and may suggest incorrect transactions
- Blockchain transactions are **irreversible** once executed
- You could lose funds if you approve incorrect transactions
- Use testnet for experimentation (mainnet at your own risk)

**USE AT YOUR OWN RISK**

### Prerequisites

- **Node.js** 18+ (20+ recommended)
- **pnpm** 8+ (auto-installed by setup script if missing)
- **Git**

### Installation & Development

#### Option 1: Quick Development Start (Recommended) 🎯

```bash
# Clone the repository
git clone https://github.com/hashgraph-online/desktop
cd desktop/app

# Quick setup and run development mode
./setup.sh --dev
```

This will:

1. Check requirements
2. Setup legal files
3. Install dependencies
4. Start the app in development mode with hot reload

#### Option 2: Manual Development Setup

```bash
# Clone repository
git clone https://github.com/hashgraph-online/desktop
cd desktop/app

# Setup legal files
cp terms.md.example terms.md
cp privacy.md.example privacy.md
mkdir -p public
cp terms.md.example public/terms.md
cp privacy.md.example public/privacy.md

# Install dependencies and start dev mode
pnpm install
pnpm dev  # or pnpm start
```

#### Option 3: Full Setup with Build (For Distribution)

```bash
# Run the interactive setup
./setup.sh

# Or run full setup + build
./setup.sh --full    # Complete setup + build for distribution
```

**Setup Script Options:**
| Command | Description |
|---------|-------------|
| `./setup.sh --dev` | Quick start: Setup + run development mode |
| `./setup.sh --install` | Install dependencies only |
| `./setup.sh --legal` | Setup legal files only |
| `./setup.sh --build` | Build for distribution (current platform) |
| `./setup.sh --full` | Complete setup + build for distribution |
| `./setup.sh` | Interactive menu with all options |

## 📝 Legal Files Configuration

The app requires terms of service and privacy policy files:

| Source File          | Target Locations                        |
| -------------------- | --------------------------------------- |
| `terms.md.example`   | → `terms.md`<br>→ `public/terms.md`     |
| `privacy.md.example` | → `privacy.md`<br>→ `public/privacy.md` |

**Important:** Customize these files for your organization before distribution!

## 💻 Development

### Start Development Server

```bash
pnpm dev         # Starts Electron app in dev mode (RECOMMENDED)
# or
pnpm start       # Same as above

pnpm dev:log     # Starts Electron app with comprehensive logging
```

**Development Mode Features:**

- ✅ Auto-opens Electron window
- ✅ Runs on http://localhost:5173 (Vite dev server)
- ✅ Hot module replacement enabled
- ✅ DevTools available for debugging
- ✅ Auto-restart on code changes
- ✅ All dependencies available (including local file dependencies)

**Logging Mode Features (`pnpm dev:log`):**

- ✅ All development mode features above
- ✅ Runs on http://localhost:5174 (different port to avoid conflicts)
- ✅ Comprehensive logging to `dev.log` file
- ✅ Can run alongside regular dev server
- ✅ Timestamps and formatted log output for debugging

### Other Development Commands

```bash
pnpm test          # Run tests
pnpm test:watch    # Run tests in watch mode
pnpm test:coverage # Run tests with coverage
pnpm typecheck     # Type checking
pnpm storybook     # View component stories
```

## 📦 Building for Production (Optional)

> **Note:** For development and testing, use `pnpm dev` instead. Building is only needed when creating distributable packages.

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

| Build Type       | Location                                                 | Usage              |
| ---------------- | -------------------------------------------------------- | ------------------ |
| **App Bundle**   | `out/Hashgraph Online-darwin-arm64/Hashgraph Online.app` | For testing only\* |
| **Distribution** | `out/make/zip/darwin/arm64/*.zip`                        | Share with users   |

**Installation:** Unzip and drag `.app` to Applications folder

> **Note**: The `.app` file in `out/` is for testing purposes. For production use, always distribute the `.zip` package from `out/make/`. For development and testing, use `pnpm dev` for the best experience with hot reload.

#### 🪟 Windows

| Build Type     | Location                                              | Usage               |
| -------------- | ----------------------------------------------------- | ------------------- |
| **Executable** | `out/Hashgraph Online-win32-x64/Hashgraph Online.exe` | Direct execution    |
| **Installer**  | `out/make/squirrel.windows/x64/*.exe`                 | Distribute to users |

**Installation:** Run the installer `.exe`

#### 🐧 Linux

| Build Type      | Location                 | Usage                       |
| --------------- | ------------------------ | --------------------------- |
| **AppImage**    | `out/make/*.AppImage`    | Portable, no install needed |
| **Deb Package** | `out/make/deb/x64/*.deb` | For Debian/Ubuntu           |

**Installation:**

- AppImage: Make executable and run
- Deb: `sudo dpkg -i package.deb`

## ⚙️ Configuration

The app requires configuration of:

### 1. Hedera Network Credentials

- Account ID (format: `0.0.xxxxx`)
- Private Key (ED25519 or ECDSA)
- OpenAI API Key (starts with `sk-`)
- Network selection (Testnet only by default)
  - **Note**: Mainnet can be enabled by setting `ENABLE_MAINNET=true` environment variable. During the alpha phase, it is heavily recommended to use testnet ONLY. Enabling mainnet can be done at your own risk. Please be advised that AI models do make mistakes and blockchain transactions are irreversible.

### 2. OpenAI API

- API Key (starts with `sk-`)
- Model selection (`gpt-4o`, `gpt-4`, `gpt-3.5-turbo`)

### 3. MCP Servers (Optional)

- Filesystem access
- GitHub integration
- Database connections
- Custom servers

## 🔐 Environment Variables

| Variable         | Default | Description                                       |
| ---------------- | ------- | ------------------------------------------------- |
| `ENABLE_MAINNET` | `false` | Enable Hedera mainnet option in network selection |

### Setting Environment Variables

#### Development Mode

```bash
# macOS/Linux
ENABLE_MAINNET=true pnpm dev

# Windows
set ENABLE_MAINNET=true && pnpm dev
```

#### Production Build

```bash
# macOS/Linux
ENABLE_MAINNET=true pnpm build

# Windows
set ENABLE_MAINNET=true && pnpm build
```

## 🛠️ Troubleshooting

### Common Issues & Solutions

| Issue                                                                         | Solution                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Missing legal files error**                                                 | Run `./setup.sh --legal` or `node scripts/setup-legal.js`                                                                                                                                                                                                                                                                                                              |
| **Build fails on macOS**                                                      | Install Xcode tools: `xcode-select --install`<br>Clear cache: `rm -rf out/ .vite/`                                                                                                                                                                                                                                                                                     |
| **pnpm not found**                                                            | Run `npm install -g pnpm` or use setup script                                                                                                                                                                                                                                                                                                                          |
| **Electron fails to start**                                                   | Clear and reinstall: `rm -rf node_modules && pnpm install`                                                                                                                                                                                                                                                                                                             |
| **Port 5173 in use**                                                          | Kill process: `lsof -ti:5173 \| xargs kill`                                                                                                                                                                                                                                                                                                                            |
| **Port 5174 in use (dev:log)**                                                | Kill process: `lsof -ti:5174 \| xargs kill`                                                                                                                                                                                                                                                                                                                            |
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

| Script            | Description                            |
| ----------------- | -------------------------------------- |
| `pnpm dev`        | Start development server (recommended) |
| `pnpm dev:log`    | Start development server with logging (port 5174) |
| `pnpm start`      | Alias for dev                          |
| `pnpm test`       | Run tests                              |
| `pnpm typecheck`  | Check TypeScript types                 |
| `pnpm storybook`  | Launch Storybook                       |
| `pnpm build`      | Build application (for distribution)   |
| `pnpm dist:mac`   | Build macOS distribution               |
| `pnpm dist:win`   | Build Windows distribution             |
| `pnpm dist:linux` | Build Linux distribution               |

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

## 🤝 Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run tests (`pnpm test`)
5. Commit with DCO sign-off (`git commit -s`)
6. Submit a pull request

### Code Standards

- TypeScript for type safety
- React hooks for state management
- Tailwind for styling
- JSDoc for function documentation
- No console.log statements
- Test your changes on testnet first
