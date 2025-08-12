# Legal Documents Setup Guide

## Overview

The application supports optional Terms of Service and Privacy Policy documents that are displayed to users on first launch. These documents are gitignored and must be provided by each deployment.

## Setup Instructions

### 1. Create Legal Documents

Copy the example files and customize them with your actual legal content:

```bash
cp terms.md.example terms.md
cp privacy.md.example privacy.md
```

### 2. Edit the Content

Replace the placeholder content in both files with your actual:
- Terms of Service
- Privacy Policy

### 3. Build and Deploy

The build process will automatically copy these files to the public directory where they can be served to users.

## File Locations

- **Source files**: `app/terms.md` and `app/privacy.md` (gitignored)
- **Example files**: `app/terms.md.example` and `app/privacy.md.example` (checked in)
- **Served files**: `app/public/terms.md` and `app/public/privacy.md` (gitignored, created during build)

## Features

- ✅ Beautiful gradient modal headers (purple→blue→green)
- ✅ Scroll-to-read validation before accepting
- ✅ Acceptance tracked in local storage
- ✅ Reset option in Settings → Advanced Settings
- ✅ Full-screen welcome experience on first launch
- ✅ Progressive acceptance flow (Terms → Privacy)

## Testing

To reset and test the legal modals:

1. **Via Settings UI**: Settings → Advanced Settings → Reset Legal Agreements
2. **Via DevTools Console**: `localStorage.removeItem("legal-acceptance-storage"); location.reload();`
3. **Via Script**: Run `node scripts/reset-legal-acceptance.js`

## Configuration

The autonomous mode feature requires both:
1. Legal acceptance (Terms + Privacy)
2. Environment variable: `ENABLE_AUTONOMOUS_MODE=true`

## Customization

The modal appearance uses the app's theme colors:
- Primary gradient: `#a679f0` (purple) → `#5599fe` (blue) → `#48df7b` (green)
- No orange colors are used (theme consistency)
- Full-screen welcome design with clean UX