# foglite

A browser extension that helps users assess website trustworthiness through community ratings and automated security analysis.

## Features

- **Trust Scores**: Combines domain analysis (40%) and community ratings (60%)
- **Star Ratings**: Rate websites 1-5 stars
- **Content Flags**: Report spam, misleading content, or scams
- **Security Analysis**: Domain age, SSL certificates, threat database checks
- **Caching**: 7-day domain analysis cache for performance

## Installation

### Chrome Web Store
1. Visit the Chrome Web Store (link coming soon)
2. Click "Add to Chrome"
3. Confirm installation

### Manual Installation
1. Download or clone this repository
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder

## Usage

1. Click the extension icon on any website
2. View the trust score
3. Sign in to submit ratings
4. Rate websites or flag problematic content

<<<<<<< HEAD
### Rating Websites
1. Navigate to any website
2. Click the foglite extension icon
3. Select a star rating (1-5 stars)
4. Optionally flag content as spam, misleading, or scam
5. Click "Submit Rating" to contribute to the community database
=======
### Trust Score Levels
- 90-100: Excellent
- 70-89: Good
- 50-69: Fair
- 30-49: Poor
- 0-29: Very Poor
>>>>>>> 922775614117a546be6fbac4a0b004fcab993cea

## Privacy

- Only collects URLs you rate and your ratings
- No browsing history tracking
- Trust scores viewable without an account
- Data stored securely with Supabase

## Technical Details

- Manifest V3
- Vanilla JavaScript with ES6 modules
- Supabase backend (PostgreSQL + Edge Functions)

## License

MIT License
