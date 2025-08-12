#!/bin/bash

# Hashgraph Online Desktop - Setup Script
# This script sets up the development environment for the Hashgraph Online Desktop application

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
        print_error "Node.js is not installed. Please install Node.js 18+ first."
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
}

# Setup legal files (terms and privacy)
setup_legal_files() {
    print_header "Setting Up Legal Files"
    
    # Check if example files exist
    if [ ! -f "terms.md.example" ]; then
        print_error "terms.md.example not found!"
        exit 1
    fi
    
    if [ ! -f "privacy.md.example" ]; then
        print_error "privacy.md.example not found!"
        exit 1
    fi
    
    # Create public directory if it doesn't exist
    if [ ! -d "public" ]; then
        mkdir -p public
        print_info "Created public directory"
    fi
    
    # Copy terms.md
    if [ ! -f "terms.md" ]; then
        cp terms.md.example terms.md
        print_success "Created terms.md from example"
    else
        print_info "terms.md already exists"
    fi
    
    if [ ! -f "public/terms.md" ]; then
        cp terms.md.example public/terms.md
        print_success "Created public/terms.md from example"
    else
        print_info "public/terms.md already exists"
    fi
    
    # Copy privacy.md
    if [ ! -f "privacy.md" ]; then
        cp privacy.md.example privacy.md
        print_success "Created privacy.md from example"
    else
        print_info "privacy.md already exists"
    fi
    
    if [ ! -f "public/privacy.md" ]; then
        cp privacy.md.example public/privacy.md
        print_success "Created public/privacy.md from example"
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

# Build the application
build_app() {
    print_header "Building Application"
    
    print_info "Running TypeScript build and packaging..."
    pnpm build
    print_success "Application built successfully"
}

# Platform-specific build
platform_build() {
    print_header "Platform-Specific Build"
    
    # Detect platform
    OS="$(uname -s)"
    case "${OS}" in
        Darwin*)
            print_info "Detected macOS - Building for Mac..."
            pnpm dist:mac
            print_success "Mac build complete! Check out/make directory for the distributable."
            ;;
        Linux*)
            print_info "Detected Linux - Building for Linux..."
            if [ -f "package.json" ] && grep -q "dist:linux" package.json; then
                pnpm dist:linux
                print_success "Linux build complete! Check out/make directory for the distributable."
            else
                print_warning "No Linux build script found in package.json"
            fi
            ;;
        MINGW*|CYGWIN*|MSYS*)
            print_info "Detected Windows - Building for Windows..."
            if [ -f "package.json" ] && grep -q "dist:win" package.json; then
                pnpm dist:win
                print_success "Windows build complete! Check out/make directory for the distributable."
            else
                print_warning "No Windows build script found in package.json"
            fi
            ;;
        *)
            print_warning "Unknown operating system: ${OS}"
            ;;
    esac
}

# Optional: Start development server
start_dev() {
    print_header "Starting Development Server"
    
    print_info "Starting the application in development mode..."
    print_info "Press Ctrl+C to stop the server"
    pnpm start
}

# Main menu
show_menu() {
    echo -e "\n${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Hashgraph Online Desktop Setup${NC}"
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
            build_app
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
            build_app
            platform_build
            ;;
        --dev|-d)
            check_requirements
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
            echo "  --dev, -d      Start development server"
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