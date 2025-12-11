# URL Rating Extension

A Chrome browser extension for rating URLs and viewing trust statistics.

## Project Structure

- **extension/** - Browser extension files (load this folder in Chrome)
- **supabase/** - Backend configuration and edge functions
- **docs/** - Documentation
- **scripts/** - Utility scripts

## Quick Start

1. Copy `extension/config.example.js` to `extension/config.js` and add your Supabase credentials
2. Go to `chrome://extensions/`, enable Developer mode, and load the `extension/` folder
3. See `docs/README.md` for full documentation

## Documentation

- [Full README](docs/README.md)
- [Trust Algorithm](docs/TRUST_ALGORITHM.md)
- [Production Setup](docs/PRODUCTION_SETUP.md)
