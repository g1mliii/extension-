# Technology Stack

## Frontend
- **Browser Extension**: Chrome Extension Manifest V3
- **Languages**: HTML5, CSS3, JavaScript (ES6+ modules)
- **Styling**: Custom CSS with CSS variables, glassmorphism design patterns
- **Architecture**: Modular JavaScript with separate auth and UI modules

## Backend
- **Database & Auth**: Supabase (PostgreSQL + Auth)
- **Edge Functions**: Deno runtime with TypeScript
- **API**: RESTful endpoints via Supabase functions

## Key Libraries & Dependencies
- **Supabase Client**: Authentication and database operations
- **Browser APIs**: Chrome Extension APIs (activeTab, storage, scripting)

## Development Patterns
- **Module System**: ES6 imports/exports
- **Authentication Flow**: PKCE flow for secure auth
- **State Management**: Browser extension storage API
- **Error Handling**: Custom error classes with proper error propagation

## Common Commands

### Supabase Development
```bash
# Start local Supabase
supabase start

# Deploy functions
supabase functions deploy

# Generate types
supabase gen types typescript --local > types/supabase.ts

# Run migrations
supabase db push
```

### Extension Development
```bash
# Load extension in Chrome
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked" and select extension-/rating-extension/

# No build process required - direct file loading
```

## Architecture Notes
- Uses Manifest V3 service workers (not background scripts)
- Implements proper CSP (Content Security Policy) compliance
- Modular CSS with CSS custom properties for theming
- Glassmorphism UI design with backdrop filters