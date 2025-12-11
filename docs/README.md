# URL Rating Extension

A Chrome browser extension that allows users to rate URLs and view aggregated trust statistics with domain analysis.

## Features

- **Trust Score System**: Combines domain analysis (40%) and community ratings (60%)
- **Domain Security Analysis**: Checks SSL certificates, domain age, HTTP status, and threat databases
- **Content-Specific Scoring**: Different trust modifiers for articles, videos, social media, etc.
- **Smart Caching**: 5-minute localStorage caching with batch request queuing
- **Real-time Statistics**: Live aggregation of ratings with automated cron processing
- **User Authentication**: JWT authentication via Supabase

## Project Structure

```
├── extension/          # Browser extension files
│   ├── manifest.json   # Extension manifest
│   ├── popup.js        # Main UI logic
│   ├── popup.css       # Styling
│   ├── auth.js         # Authentication module
│   └── icons/          # Extension icons
├── supabase/           # Backend configuration
│   ├── functions/      # Edge functions
│   └── migrations/     # Database schema
├── docs/               # Documentation
└── scripts/            # Utility scripts
```

## Installation

1. Clone this repository
2. Copy `extension/config.example.js` to `extension/config.js`
3. Update the Supabase URL and anon key in `config.js`
4. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked" and select the `extension/` folder

## Development

### Backend (Supabase)

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific functions
supabase functions deploy url-trust-api
supabase functions deploy batch-domain-analysis
supabase functions deploy aggregate-ratings

# Run migrations
supabase db push
```

### Extension

No build process required - direct file loading with ES6 modules from the `extension/` folder.

## Architecture

- **Frontend**: Chrome Extension Manifest V3
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Processing**: Automated cron jobs for rating aggregation
- **API**: Unified `url-trust-api` function as main entry point

## API Endpoints

### Main API (url-trust-api)
- `GET /url-stats?url=<url>` - Get URL statistics
- `POST /rating` - Submit ratings (authenticated)

### Other Functions
- `batch-domain-analysis` - Background domain analysis
- `aggregate-ratings` - Rating aggregation (cron)
- `trust-admin` - Admin functions

## Configuration

Create `extension/config.js`:

```javascript
export const CONFIG = {
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key-here'
};
```

The `config.js` file is gitignored to prevent accidental commit of credentials.

## Chrome Web Store Deployment

1. Run the build script: `node scripts/build-for-store.js`
2. Zip the `extension/` folder and upload to Chrome Web Store
3. Set backend environment variables in Supabase dashboard

## License

MIT License
