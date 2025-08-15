# Project Structure

## Root Directory Organization

```
├── .kiro/                        # Kiro AI steering files
├── .vscode/                      # VS Code settings
├── supabase/                     # Backend configuration
├── icons/                        # Extension icons
├── manifest.json                 # Extension manifest (entry point)
├── popup.html                    # Main UI template
├── popup.css                     # Styling (glassmorphism theme)
├── popup.js                      # Main UI logic and event handling
├── auth.js                       # Authentication module
├── supabase.js                   # Supabase client library
├── confirm.html                  # Confirmation dialogs
└── .gitignore                    # Git ignore rules
```

## Extension Files (Root Level)

```
├── manifest.json                 # Extension manifest (entry point)
├── popup.html                    # Main UI template
├── popup.css                     # Styling (glassmorphism theme)
├── popup.js                      # Main UI logic and event handling
├── auth.js                       # Authentication module
├── supabase.js                   # Supabase client library
├── confirm.html                  # Confirmation dialogs
└── icons/                        # Extension icons (16, 48, 128px)
```

## Backend Structure (`supabase/`)

```
supabase/
├── functions/                    # Edge functions
│   ├── rating-api/              # Rating CRUD operations with domain analysis
│   ├── aggregate-ratings/       # Enhanced statistics aggregation
│   ├── domain-analyzer/         # External API integration for domain analysis
│   ├── batch-domain-analysis/   # Batch processing for scalability
│   ├── _shared/                 # Shared utilities (CORS, etc.)
│   ├── deno.json               # Deno configuration
│   └── import_map.json         # Import mappings
└── migrations/                  # Database schema changes
    ├── 20240101000000_create_rating_tables.sql
    ├── 20240129000000_trust_score_aggregation.sql
    ├── 20240129000001_trust_score_config.sql
    ├── 20250815000000_enhanced_trust_algorithm.sql
    └── 20250815000001_algorithm_config.sql
```

## File Naming Conventions

- **HTML files**: kebab-case (popup.html, confirm.html)
- **JavaScript modules**: camelCase for functions, kebab-case for files
- **CSS classes**: kebab-case with BEM-like patterns
- **Supabase functions**: kebab-case directory names

## Key Architecture Patterns

- **Separation of Concerns**: UI (popup.js), Auth (auth.js), Backend (supabase functions)
- **Module Imports**: ES6 import/export between JavaScript files
- **Configuration**: Centralized in manifest.json and deno.json
- **Assets**: Icons organized by size in dedicated directory

## Development Workflow

1. **Extension Development**: Work directly in root directory files
2. **Backend Changes**: Modify functions in `supabase/functions/`
3. **Database Schema**: Add migrations to `supabase/migrations/`
4. **Testing**: Load unpacked extension in Chrome for testing
5. **Git Workflow**: Use `workspace-clean-v2` branch for clean development

## Important Files

- `manifest.json`: Extension configuration and permissions
- `popup.js`: Main application logic and UI interactions
- `auth.js`: Supabase authentication handling
- `popup.css`: Complete styling with CSS custom properties
- `deno.json`: Backend runtime configuration
- `TRUST_ALGORITHM.md`: Comprehensive documentation of the enhanced trust scoring system
- `supabase/functions/domain-analyzer/`: External API integration for domain security analysis
- `supabase/migrations/20250815000000_enhanced_trust_algorithm.sql`: Core enhanced algorithm implementation