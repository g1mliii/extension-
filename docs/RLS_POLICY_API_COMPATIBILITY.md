# RLS Policy API Compatibility Documentation

## Overview

This document outlines the RLS (Row Level Security) policy requirements for the unified API architecture and provides guidance on any adjustments needed for proper API authentication flow.

## Current RLS Policy Status

The URL Rating Extension currently uses a **service role approach** with RLS policies that have been designed to work with the unified API structure. This approach was chosen to resolve conflicts between RLS policies and the complex API operations required.

## Service Role Authentication Approach

### Why Service Role?
- **Complex Operations**: The unified API performs complex operations that span multiple tables
- **Performance**: Service role eliminates RLS overhead for internal operations
- **Security**: JWT token validation ensures user authentication is still enforced
- **Flexibility**: Allows for future RLS re-enablement with minimal changes

### Security Model
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Unified API    │    │   Database      │
│   (Extension)   │───▶│  (Edge Function) │───▶│  (Service Role) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                        │                        │
        │                        │                        │
    JWT Token              JWT Validation           Full Access
   (User Auth)            (Security Layer)        (Controlled)
```

## Required RLS Policies for API Compatibility

### 1. Public Read Access (anon role)

**Tables requiring public read access:**
- `url_stats` - For GET /url-stats endpoint
- `content_type_rules` (active only) - For content type determination
- `trust_algorithm_config` (active only) - For trust score calculation

```sql
-- URL Stats public read policy
CREATE POLICY "Public read access for url_stats" ON url_stats
    FOR SELECT TO anon, authenticated
    USING (true);

-- Content type rules public read policy  
CREATE POLICY "Public read content_type_rules" ON content_type_rules
    FOR SELECT TO anon, authenticated
    USING (is_active = true);

-- Trust config public read policy
CREATE POLICY "Public read trust_algorithm_config" ON trust_algorithm_config
    FOR SELECT TO anon, authenticated
    USING (is_active = true);
```

### 2. Authenticated User Access

**Tables requiring authenticated access:**
- `ratings` - For POST /rating endpoint (insert/update own ratings)
- `url_stats` - For reading personal rating history

```sql
-- Ratings authenticated access policy
CREATE POLICY "Authenticated users can manage own ratings" ON ratings
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- URL stats authenticated read policy (already covered by public policy)
```

### 3. Service Role Access

**Full access for service role:**
- All tables for internal API operations
- Background processing and cron jobs
- Domain analysis and cache management

```sql
-- Service role full access (already configured)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
```

## Domain Cache Access (406 Error Prevention)

The domain cache was causing 406 errors due to RLS policy restrictions. The current configuration ensures:

### Policy Requirements
```sql
-- Domain cache service role access
CREATE POLICY "Service role full access to domain_cache" ON domain_cache
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Domain cache public read access (for cache checking)
CREATE POLICY "Public read access for domain_cache" ON domain_cache
    FOR SELECT TO anon, authenticated
    USING (cache_expires_at > NOW());
```

### API Integration
- **GET /url-stats**: Can check domain cache for fallback data
- **POST /rating**: Can trigger domain analysis and cache updates
- **Background processing**: Can manage cache expiration and updates

## API Endpoint RLS Requirements

### GET /url-stats Endpoint
**Required Access:**
- `url_stats` table: SELECT (public)
- `domain_cache` table: SELECT (public, non-expired only)
- `content_type_rules` table: SELECT (active only)

**RLS Policy Impact:**
- Must allow anonymous access for public URL statistics
- Should respect cache expiration for domain data
- No user-specific filtering required

### POST /rating Endpoint
**Required Access:**
- `ratings` table: INSERT/UPDATE (authenticated users only)
- `url_stats` table: SELECT/UPDATE (service role for aggregation)
- `domain_cache` table: SELECT/INSERT (service role for analysis)

**RLS Policy Impact:**
- Must enforce user authentication for rating submission
- Should allow users to update their own ratings within 24-hour window
- Service role needs full access for background processing

## Validation and Testing

### RLS Policy Validation Function
The migration includes a comprehensive validation function:

```sql
SELECT * FROM validate_rls_policies_for_api();
```

**Tests performed:**
1. Service role access to all required tables
2. Public role read access to public data
3. Domain cache access (406 error prevention)
4. Rating submission permissions
5. URL stats read permissions

### API Endpoint Testing Function
```sql
SELECT * FROM test_api_endpoint_compatibility();
```

**Tests performed:**
1. GET /url-stats database query structure
2. POST /rating database schema compatibility
3. Domain analysis cache structure
4. Enhanced trust score calculation

## Troubleshooting Common Issues

### 406 Not Acceptable Errors
**Cause**: RLS policies blocking domain cache access
**Solution**: Ensure domain_cache has proper public read policy for non-expired entries

### 403 Forbidden Errors
**Cause**: Missing authentication or insufficient permissions
**Solution**: Verify JWT token validation and user-specific policies

### Rating Submission Failures
**Cause**: RLS policies blocking authenticated user access to ratings table
**Solution**: Ensure authenticated users can insert/update their own ratings

## Migration Path for RLS Re-enablement

If you need to re-enable strict RLS policies in the future:

1. **Update API functions** to use authenticated Supabase client instead of service role
2. **Implement user context passing** through JWT token validation
3. **Test each endpoint** with the new RLS policies
4. **Update error handling** for RLS-specific errors
5. **Performance testing** to ensure acceptable response times

## Security Considerations

### Current Security Model
- **JWT Token Validation**: All authenticated requests validate user tokens
- **Service Role Isolation**: Service role operations are isolated to API functions
- **Input Validation**: All user inputs are validated before database operations
- **Rate Limiting**: External API calls are rate-limited and cached

### Security Benefits
- **Simplified Debugging**: Easier to trace issues without RLS complexity
- **Performance**: No RLS overhead for complex operations
- **Flexibility**: Can implement custom authorization logic in API layer
- **Auditability**: All operations go through controlled API endpoints

### Security Trade-offs
- **Database Level Security**: Less granular database-level access control
- **Trust in API Layer**: Relies on API functions for proper authorization
- **Service Role Power**: Service role has broad database access

## Conclusion

The current RLS policy configuration is designed to support the unified API architecture while maintaining security through JWT token validation and controlled service role access. The policies have been validated for compatibility with all API endpoints and should prevent the 406 errors that were occurring with domain cache access.

All security warnings related to RLS policies should be resolved with the implemented configuration, and the API should function correctly with both authenticated and unauthenticated requests.