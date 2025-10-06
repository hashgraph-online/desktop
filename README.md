# Hashgraph Online Desktop App

A modern desktop application for the Hashgraph Online Conversational Agent, built with Tauri, React, and TypeScript.

## 🚀 Quick Start

⚠️ **ALPHA SOFTWARE WARNING** ⚠️

This is an alpha version. By using this software, you acknowledge:

- AI models make mistakes and may suggest incorrect transactions
- Blockchain transactions are **irreversible** once executed
- You could lose funds if you approve incorrect transactions
- Use testnet for experimentation (mainnet at your own risk)

**USE AT YOUR OWN RISK**

### Prerequisites

- **Node.js** 23.x (v23 required)
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
pnpm dev         # Starts Tauri app in dev mode (RECOMMENDED)
# or
pnpm start       # Same as above
```

**Development Mode Features:**

- ✅ Auto-opens Tauri window
- ✅ Runs on http://localhost:5173 (Vite dev server)
- ✅ Hot module replacement enabled
- ✅ DevTools available for debugging
- ✅ Auto-restart on code changes
- ✅ TypeScript bridge auto-compiles on changes
- ✅ All dependencies available (including local file dependencies)

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
| **Tauri fails to start**                                                      | Clear and reinstall: `rm -rf node_modules && pnpm install`                                                                                                                                                                                                                                                                                                             |
| **Port 5173 in use**                                                          | Kill process: `lsof -ti:5173 \| xargs kill`                                                                                                                                                                                                                                                                                                                            |
| **Packaged app error: `Cannot find module '@hashgraphonline/standards-sdk'`** | Ensure all `@hashgraphonline/*` packages are in `dependencies` (not `devDependencies`). Rebuild with `pnpm run tauri:build`. |

### Notes on native modules (e.g., better-sqlite3)

- Native modules are automatically handled by Tauri
- No special configuration needed for `.node` files

## 📁 Project Structure

```
desktop-tauri/
├── src/
│   ├── components/        # React components
│   ├── pages/             # Application pages
│   ├── store/             # State management
│   └── lib/               # Utilities
│
├── src-tauri/
│   ├── bridge/            # TypeScript bridge code
│   ├── resources/         # Compiled bridge output
│   ├── src/               # Rust backend code
│   └── tauri.conf.json    # Tauri configuration
│
├── public/                # Static assets
│   ├── terms.md           # Terms of service
│   └── privacy.md         # Privacy policy
│
├── setup.sh               # Automated setup script
└── package.json           # Project configuration
```

## 🔧 Available Scripts

| Script              | Description                              |
| ------------------- | ---------------------------------------- |
| `pnpm dev`          | Start Tauri development server           |
| `pnpm start`        | Alias for dev                            |
| `pnpm test`         | Run tests                                |
| `pnpm typecheck`    | Check TypeScript types                   |
| `pnpm build`        | Build Vite frontend                      |
| `pnpm build:bridge` | Build TypeScript bridge                  |
| `pnpm tauri:build`  | Build Tauri app for current platform     |

## 🏗️ Built With

- [Tauri](https://tauri.app) - Cross-platform desktop framework
- [Rust](https://www.rust-lang.org) - Backend runtime
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
