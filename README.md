# URL Rating Extension

A Chrome browser extension for rating URLs and viewing trust statistics.

## 📁 Project Structure

This project is organized into the following directories:

- **`extension/`** - Browser extension files (load this folder in Chrome)
- **`supabase/`** - Backend configuration and edge functions
- **`docs/`** - Documentation and project information
- **`scripts/`** - Utility scripts and development tools

## 🚀 Quick Start

1. Configure: Copy `extension/config.example.js` to `extension/config.js` and add your Supabase credentials
2. Load the extension: Go to `chrome://extensions/`, enable Developer mode, and load the `extension/` folder
3. For full documentation, see [`docs/README.md`](docs/README.md)

## 📖 Documentation

- [Full README](docs/README.md) - Complete project documentation
- [Trust Algorithm](docs/TRUST_ALGORITHM.md) - Detailed algorithm documentation
- [Cron Integration](docs/CRON_JOB_INTEGRATION.md) - Background processing details

## 🎯 Status: Production Ready

All core functionality is implemented and working. See the full documentation for details.