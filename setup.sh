#!/bin/bash

# Hashgraph Online Desktop (Tauri) - Setup Script
# This script sets up the development environment for the Hashgraph Online Desktop Tauri application

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}\n"
}

# Check for required tools
check_requirements() {
    print_header "Checking Requirements"

    # Check for Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 20+ first."
        exit 1
    else
        NODE_VERSION=$(node -v)
        print_success "Node.js installed: $NODE_VERSION"
    fi

    # Check for pnpm
    if ! command -v pnpm &> /dev/null; then
        print_warning "pnpm is not installed. Installing pnpm..."
        npm install -g pnpm
        print_success "pnpm installed successfully"
    else
        PNPM_VERSION=$(pnpm -v)
        print_success "pnpm installed: v$PNPM_VERSION"
    fi

    # Check for Git
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed. Please install Git first."
        exit 1
    else
        print_success "Git is installed"
    fi

    # Check for Rust
    if ! command -v rustc &> /dev/null; then
        print_warning "Rust is not installed. Installing Rust..."
        print_info "Running rustup installer..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
        print_success "Rust installed successfully"
    else
        RUST_VERSION=$(rustc --version)
        print_success "Rust installed: $RUST_VERSION"
    fi

    # Check for Cargo
    if ! command -v cargo &> /dev/null; then
        print_error "Cargo is not installed. Please install Rust/Cargo first."
        exit 1
    else
        CARGO_VERSION=$(cargo --version)
        print_success "Cargo installed: $CARGO_VERSION"
    fi
}

# Setup legal files (terms and privacy)
setup_legal_files() {
    print_header "Setting Up Legal Files"

    # Create public directory if it doesn't exist
    if [ ! -d "public" ]; then
        mkdir -p public
        print_info "Created public directory"
    fi

    # Check if legal files exist, create placeholders if needed
    if [ ! -f "public/terms.md" ]; then
        cat > public/terms.md << 'EOF'
# Terms of Service

**IMPORTANT:** This is a placeholder file. You must customize this with your own terms of service before distributing this application.

## Acceptance of Terms

By using this software, you agree to these terms.

## Alpha Software Warning

This is alpha software. Use at your own risk.

## Disclaimer

- AI models can make mistakes
- Blockchain transactions are irreversible
- You are responsible for all transactions you approve
- Test on testnet before using mainnet

## Liability

The developers are not liable for any losses incurred through use of this software.

---

**Replace this file with your organization's actual Terms of Service**
EOF
        print_success "Created public/terms.md placeholder"
        print_warning "IMPORTANT: Customize public/terms.md before distribution!"
    else
        print_info "public/terms.md already exists"
    fi

    if [ ! -f "public/privacy.md" ]; then
        cat > public/privacy.md << 'EOF'
# Privacy Policy

**IMPORTANT:** This is a placeholder file. You must customize this with your own privacy policy before distributing this application.

## Data Collection

This application may collect:

- Account credentials (stored locally)
- API keys (stored locally)
- Transaction data
- Application usage data

## Data Storage

All sensitive data is stored locally on your device.

## Third-Party Services

This application interacts with:

- Hedera Network
- OpenAI API
- Anthropic API (optional)
- Swarm Network (optional)

## Your Rights

You have the right to:

- Delete your data
- Export your data
- Control what data is collected

---

**Replace this file with your organization's actual Privacy Policy**
EOF
        print_success "Created public/privacy.md placeholder"
        print_warning "IMPORTANT: Customize public/privacy.md before distribution!"
    else
        print_info "public/privacy.md already exists"
    fi
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"

    print_info "Installing project dependencies with pnpm..."
    pnpm install
    print_success "Dependencies installed successfully"
}

# Build TypeScript bridge
build_bridge() {
    print_header "Building TypeScript Bridge"

    print_info "Compiling TypeScript bridge files..."
    pnpm run build:bridge
    print_success "TypeScript bridge built successfully"
}

# Build the application
build_app() {
    print_header "Building Application"

    print_info "Building Vite frontend..."
    pnpm run build
    print_success "Application built successfully"
}

# Platform-specific Tauri build
platform_build() {
    print_header "Platform-Specific Tauri Build"

    # Detect platform
    OS="$(uname -s)"
    case "${OS}" in
        Darwin*)
            print_info "Detected macOS - Building Tauri app for Mac..."
            pnpm run tauri:build
            print_success "Mac build complete! Check src-tauri/target/release/bundle/ for distributables."
            print_info "Distributable: src-tauri/target/release/bundle/dmg/"
            ;;
        Linux*)
            print_info "Detected Linux - Building Tauri app for Linux..."
            pnpm run tauri:build
            print_success "Linux build complete! Check src-tauri/target/release/bundle/ for distributables."
            print_info "Distributables: src-tauri/target/release/bundle/deb/ and appimage/"
            ;;
        MINGW*|CYGWIN*|MSYS*)
            print_info "Detected Windows - Building Tauri app for Windows..."
            pnpm run tauri:build
            print_success "Windows build complete! Check src-tauri/target/release/bundle/ for distributables."
            print_info "Distributable: src-tauri/target/release/bundle/msi/"
            ;;
        *)
            print_warning "Unknown operating system: ${OS}"
            print_info "Attempting generic Tauri build..."
            pnpm run tauri:build
            ;;
    esac
}

# Optional: Start development server
start_dev() {
    print_header "Starting Development Server"

    print_info "Starting Tauri app in development mode..."
    print_info "This will compile the TypeScript bridge and launch the app"
    print_info "Press Ctrl+C to stop the development server"
    pnpm run tauri:dev
}

# Main menu
show_menu() {
    echo -e "\n${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Hashgraph Online Desktop (Tauri) Setup${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo ""
    echo "Select an option:"
    echo "1) Full setup (install + build)"
    echo "2) Install dependencies only"
    echo "3) Setup legal files only"
    echo "4) Build for current platform"
    echo "5) Start development server"
    echo "6) Complete setup + start dev"
    echo "0) Exit"
    echo ""
    read -p "Enter your choice [0-6]: " choice
}

# Process menu choice
process_choice() {
    case $choice in
        1)
            check_requirements
            setup_legal_files
            install_dependencies
            build_bridge
            build_app
            platform_build
            print_success "Full setup complete!"
            ;;
        2)
            check_requirements
            install_dependencies
            ;;
        3)
            setup_legal_files
            ;;
        4)
            check_requirements
            build_bridge
            build_app
            platform_build
            ;;
        5)
            check_requirements
            start_dev
            ;;
        6)
            check_requirements
            setup_legal_files
            install_dependencies
            build_bridge
            start_dev
            ;;
        0)
            print_info "Exiting..."
            exit 0
            ;;
        *)
            print_error "Invalid option. Please try again."
            ;;
    esac
}

# Parse command line arguments
if [ $# -eq 0 ]; then
    # Interactive mode
    show_menu
    process_choice
else
    # Command line mode
    case "$1" in
        --full|-f)
            check_requirements
            setup_legal_files
            install_dependencies
            build_bridge
            build_app
            platform_build
            print_success "Full setup complete!"
            ;;
        --install|-i)
            check_requirements
            install_dependencies
            ;;
        --legal|-l)
            setup_legal_files
            ;;
        --build|-b)
            check_requirements
            build_bridge
            build_app
            platform_build
            ;;
        --dev|-d)
            check_requirements
            setup_legal_files
            install_dependencies
            build_bridge
            start_dev
            ;;
        --help|-h)
            echo "Usage: ./setup.sh [option]"
            echo ""
            echo "Options:"
            echo "  --full, -f     Full setup (install + build)"
            echo "  --install, -i  Install dependencies only"
            echo "  --legal, -l    Setup legal files only"
            echo "  --build, -b    Build for current platform"
            echo "  --dev, -d      Setup and start development server"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Interactive mode: Run without arguments"
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Run './setup.sh --help' for usage information"
            exit 1
            ;;
    esac
fi
