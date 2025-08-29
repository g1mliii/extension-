# URL Trust Rater

A community-driven browser extension that helps users make informed decisions about website trustworthiness through collaborative rating and automated security analysis.

## Features

### 🛡️ Trust Score System
- **Multi-layered scoring**: Combines domain analysis (40%) and community ratings (60%)
- **Real-time updates**: Instant trust score display for any website
- **Smart baselines**: Pre-configured trust levels for popular domains
- **Color-coded indicators**: Visual trust levels from excellent (green) to poor (red)

### 👥 Community Ratings
- **Star ratings**: Rate websites from 1-5 stars
- **Content flags**: Report spam, misleading content, or scams
- **Aggregated statistics**: View community consensus on website quality
- **User authentication**: Secure login system for rating submission

### 🔍 Security Analysis
- **Domain reputation**: Automated analysis of domain age, SSL certificates, and security status
- **External threat data**: Integration with security databases for malware detection
- **Smart warnings**: Contextual alerts for suspicious or dangerous websites
- **Caching system**: Efficient performance with 7-day domain analysis cache

### 🎨 Modern Interface
- **iOS 26 Liquid Glass Design**: Beautiful glassmorphism UI with backdrop filters
- **Responsive layout**: Clean, intuitive interface that works across all screen sizes
- **Real-time feedback**: Instant visual confirmation for all user actions
- **Accessibility**: Full keyboard navigation and screen reader support

## Installation

### From Chrome Web Store (Recommended)
1. Visit the [Chrome Web Store page](https://chrome.google.com/webstore) (coming soon)
2. Click "Add to Chrome"
3. Confirm installation in the popup dialog

### Manual Installation (Development)
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension folder
5. The extension icon will appear in your browser toolbar

## Usage

### Getting Started
1. **Click the extension icon** in your browser toolbar to open the popup
2. **Create an account** or **sign in** to submit ratings (viewing is available without login)
3. **View trust scores** for any website you visit
4. **Submit ratings** to help the community assess website trustworthiness

### Rating Websites
1. Navigate to any website
2. Click the URL Trust Rater extension icon
3. Select a star rating (1-5 stars)
4. Optionally flag content as spam, misleading, or scam
5. Click "Submit Rating" to contribute to the community database

### Understanding Trust Scores
- **90-100**: Excellent - Highly trusted, secure websites
- **70-89**: Good - Well-established sites with good reputation
- **50-69**: Fair - Average sites with mixed signals
- **30-49**: Poor - Sites with negative indicators or security concerns
- **0-29**: Very Poor - Known malicious or highly suspicious sites

## Privacy & Security

### Data Collection
- **Minimal data**: Only collects URLs you rate and your ratings
- **No browsing history**: Does not track or store your browsing activity
- **Secure authentication**: Uses industry-standard encryption for user accounts
- **Anonymous viewing**: Trust scores can be viewed without creating an account

### Data Storage
- **Encrypted database**: All data stored securely with Supabase
- **No personal information**: Only email addresses for account management
- **Community focus**: Ratings are aggregated and anonymized

### Permissions Explained
- **activeTab**: Required to get the current website URL for rating
- **storage**: Used to cache trust scores and store user preferences locally
- **host_permissions**: Connects to our secure Supabase backend for data

## Technical Details

### Architecture
- **Frontend**: Vanilla JavaScript with ES6 modules
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Authentication**: Supabase Auth with PKCE flow
- **API**: RESTful endpoints with comprehensive error handling
- **Caching**: Smart caching system for optimal performance

### Browser Compatibility
- **Chrome**: Full support (Manifest V3)
- **Edge**: Full support (Chromium-based)
- **Firefox**: Coming soon
- **Safari**: Planned for future release

### Performance
- **Lightweight**: Minimal impact on browser performance
- **Fast loading**: Optimized for quick trust score display
- **Efficient caching**: Reduces API calls and improves response times
- **Background processing**: Non-blocking domain analysis

## Contributing

We welcome contributions from the community! Here's how you can help:

### Reporting Issues
1. Check existing issues on GitHub
2. Create a detailed bug report with steps to reproduce
3. Include browser version and extension version

### Feature Requests
1. Search existing feature requests
2. Create a new issue with detailed description
3. Explain the use case and expected behavior

### Development
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request with detailed description

## Support

### Getting Help
- **GitHub Issues**: Report bugs and request features
- **Documentation**: Check this README and inline code comments
- **Community**: Join discussions in GitHub Discussions

### Troubleshooting

**Extension not loading?**
- Ensure you're using a supported browser (Chrome/Edge)
- Check that Developer mode is enabled for manual installation
- Try refreshing the extension or restarting your browser

**Can't submit ratings?**
- Verify you're logged in to your account
- Check your internet connection
- Ensure the website URL is valid

**Trust scores not displaying?**
- Check if the website is accessible
- Try refreshing the page
- Clear extension storage in Chrome settings if needed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Supabase**: Backend infrastructure and authentication
- **Community**: All users who contribute ratings and feedback
- **Security APIs**: Google Safe Browsing and other threat intelligence sources

## Changelog

### Version 1.0.0
- Initial public release
- Community rating system
- Multi-layered trust scoring
- iOS 26 Liquid Glass UI design
- Automated security analysis
- Chrome Web Store submission

---

**Made with ❤️ for a safer internet**

Help us build a more trustworthy web by rating websites and sharing your experience with the community.