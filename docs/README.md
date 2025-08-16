# URL Rating Extension

A Chrome browser extension that allows users to rate URLs and view aggregated trust statistics with enhanced domain analysis and multi-level processing status tracking.

## 🎯 Current Status: Production Ready

The API debugging effort has been successfully completed with all core functionality working:

✅ **Backend API Functions**: All Supabase edge functions implemented and working  
✅ **Error Handling**: Comprehensive error logging and standardized responses  
✅ **Domain Analysis**: Automated background processing with external API integration  
✅ **Frontend Integration**: Smart caching and error handling implemented  
✅ **Database Functions**: All functions verified and optimized  
✅ **Authentication**: Service role approach implemented and working correctly  
✅ **Background Processing**: Cron job verified and working with new implementation  
✅ **Workspace Organization**: Clean project structure with proper separation of concerns  

## Features

- **Enhanced Trust Score System**: Multi-factor algorithm combining domain analysis (40%) and community ratings (60%)
- **Domain Security Analysis**: Automated checking of SSL certificates, domain age, HTTP status, and external threat databases
- **Content-Specific Scoring**: Different trust modifiers for articles, videos, social media, code repositories, etc.
- **Unified API Architecture**: Single `url-trust-api` endpoint handles all operations with comprehensive error handling
- **Smart Caching**: 5-minute localStorage caching with batch request queuing for optimal performance
- **Real-time Statistics**: Live aggregation of ratings and reports with automated cron processing
- **User Authentication**: Secure JWT authentication via Supabase with service role security
- **Blacklist Management**: Comprehensive domain blacklist with severity levels

## Project Structure

```
├── extension/          # Browser extension files
│   ├── manifest.json   # Extension manifest
│   ├── popup.js        # Main UI logic
│   ├── popup.css       # Glassmorphism styling
│   ├── auth.js         # Authentication module
│   └── icons/          # Extension icons
├── supabase/           # Backend configuration
│   ├── functions/      # Edge functions (production only)
│   └── migrations/     # Database schema
├── docs/               # Documentation
│   ├── README.md       # This file
│   ├── TRUST_ALGORITHM.md  # Algorithm documentation
│   └── LICENSE         # License file
├── scripts/            # Utility scripts and tools
└── .kiro/              # Kiro AI configuration
```

## Installation

1. Clone this repository
2. Configure the extension:
   - Copy `extension/config.example.js` to `extension/config.js`
   - Update the Supabase URL and anon key in `config.js`
3. Load the extension in Chrome:
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
supabase functions deploy rating-submission

# Run migrations
supabase db push

# Test unified API
curl -X GET "http://localhost:54321/functions/v1/url-trust-api/url-stats?url=https://example.com"
```

### Extension Development
No build process required - direct file loading with ES6 modules from the `extension/` folder.

## Architecture

- **Frontend**: Chrome Extension Manifest V3 with glassmorphism UI
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Processing**: Automated cron jobs for rating aggregation and cleanup
- **Security**: Service role authentication with JWT validation
- **API**: Unified `url-trust-api` function serves as main entry point

## API Endpoints

### Main Unified API (`url-trust-api`)
- `GET /url-stats?url=<url>` - Get URL statistics with fallback logic
- `POST /rating` - Submit authenticated ratings and reports

### Specialized Functions
- `batch-domain-analysis` - Background domain analysis processing
- `aggregate-ratings` - Rating aggregation (cron job)
- `rating-submission` - Direct rating submission
- `trust-admin` - Admin functions for blacklist management
- `trust-score-api` - Public API for trust score queries

## Configuration

Create `extension/config.js` from the template:

```javascript
export const CONFIG = {
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key-here'
};
```

**Security Note**: The `config.js` file is gitignored to prevent accidental commit of credentials.

### Chrome Web Store Deployment

For Chrome Web Store deployment:
1. Run the build script: `node scripts/build-for-store.js`
2. Zip the `extension/` folder and upload to Chrome Web Store
3. Set backend environment variables in Supabase dashboard (see [Production Setup](PRODUCTION_SETUP.md))

**Security**: Only safe keys are included in the extension. Backend keys are stored separately in Supabase.

## License

MIT License - see LICENSE file for details.