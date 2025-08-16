# Design Document

## Overview

The API debugging effort focuses on resolving critical issues in the URL Rating Extension's backend API endpoints. Based on code analysis, the primary issues appear to be related to request routing, authentication handling, error responses, and caching strategies. The design addresses these issues while maintaining the existing architecture and improving scalability.

## Architecture

### Current Architecture Analysis
- **Frontend**: Browser extension (popup.js) making HTTP requests to Supabase Edge Functions
- **Backend**: Multiple Supabase Edge Functions with separated concerns:
  - **rating-api**: GET /url-stats endpoint for statistics retrieval
  - **Public ratings**: POST endpoint for unauthenticated ratings stored in public url_ratings table
  - **Authenticated ratings**: Separate API for authenticated user ratings
  - **Domain analysis**: Separate function for domain analysis processing
- **Database**: Supabase PostgreSQL with RLS policies currently disabled
- **Caching**: Local browser storage + database-level domain cache
- **Processing**: Background domain analysis triggered after rating submission

### Identified Issues
1. **Path Routing**: Inconsistent path handling in rating-api function
2. **Authentication**: Mixed authentication patterns causing token validation failures
3. **Error Handling**: Insufficient error logging and unclear error responses
4. **Caching**: Inefficient cache invalidation and redundant API calls
5. **Response Format**: Inconsistent response structures between endpoints

## Components and Interfaces

### 1. Domain Analysis Function
**Purpose**: Separate function to handle domain analysis after rating submission

**Current Issues**:
- Domain analysis was previously mixed with rating submission
- No dedicated function for domain processing
- Missing proper error handling for analysis failures

**Design Solution**:
```typescript
// Dedicated domain analysis function
async function handleDomainAnalysis(req: Request) {
  const { domain, urlHash } = await req.json()
  
  try {
    // Check if domain analysis is needed
    const cacheEntry = await getDomainCacheEntry(domain)
    
    if (!cacheEntry || isCacheExpired(cacheEntry, 7 * 24 * 60 * 60 * 1000)) {
      console.log('Starting domain analysis for:', domain)
      
      // Perform domain analysis
      const analysisResult = await performDomainAnalysis(domain)
      
      // Update domain cache
      await updateDomainCache(domain, analysisResult)
      
      // Update URL statistics with analysis results
      await updateUrlStatsWithAnalysis(urlHash, domain, analysisResult)
      
      console.log('Domain analysis completed for:', domain)
    } else {
      console.log('Using cached domain analysis for:', domain)
      
      // Still update URL stats with cached data
      await updateUrlStatsWithCachedAnalysis(urlHash, domain, cacheEntry)
    }
    
    return { success: true, domain, processed: true }
  } catch (error) {
    console.error('Domain analysis failed:', { domain, error })
    
    // Don't fail the entire process - log and continue
    return { success: false, domain, error: error.message }
  }
}

async function performDomainAnalysis(domain: string) {
  // Implement actual domain analysis logic
  // This would include SSL checks, domain age, threat database checks, etc.
  return {
    ssl_valid: true,
    domain_age_days: 365,
    threat_detected: false,
    analysis_timestamp: new Date().toISOString()
  }
}
```

### 2. API Request Router
**Purpose**: Properly route incoming requests to correct handlers

**Current Issues**:
- Path parsing removes both `/functions/v1/rating-api` and `/rating-api` which may cause routing conflicts
- No validation of request methods against paths

**Design Solution**:
```typescript
// Improved path routing logic
const url = new URL(req.url)
const pathSegments = url.pathname.split('/').filter(Boolean)
const functionIndex = pathSegments.findIndex(segment => segment === 'rating-api')
const path = '/' + pathSegments.slice(functionIndex + 1).join('/')

// Route validation
const routes = {
  'GET /url-stats': handleGetUrlStats,
  'POST /rating': handleSubmitRating,
  'OPTIONS *': handleCors
}
```

### 3. Authentication Handler
**Purpose**: Consistent authentication across all endpoints with simplified approach

**Current Issues**:
- Duplicate Supabase client creation with different auth configurations
- Inconsistent token validation between GET and POST endpoints
- Missing proper error responses for auth failures
- RLS policies currently disabled requiring service role approach

**Design Solution**:
```typescript
// Simplified auth handler using service role client
async function validateAuth(req: Request, required: boolean = false) {
  const authHeader = req.headers.get('Authorization')
  
  if (!authHeader && required) {
    throw new AuthError('Authorization required. Please log in to submit ratings.', 401)
  }
  
  if (authHeader) {
    // Validate header format
    if (!authHeader.startsWith('Bearer ')) {
      throw new AuthError('Invalid authorization header format. Expected: Bearer <token>', 401)
    }
    
    const token = authHeader.replace('Bearer ', '')
    
    try {
      // Use service role client for auth validation since RLS is disabled
      const supabase = createServiceRoleClient()
      
      // Validate token using Supabase auth
      const { data: { user }, error } = await supabase.auth.getUser(token)
      
      if (error) {
        if (error.message.includes('expired')) {
          throw new AuthError('Token expired. Please refresh your session.', 401)
        }
        throw new AuthError('Invalid token. Please log in again.', 401)
      }
      
      return { user, supabase, authenticated: true }
    } catch (error) {
      console.error('Authentication validation failed:', { 
        error: error.message,
        hasToken: !!token,
        tokenLength: token?.length 
      })
      
      if (required) {
        throw error instanceof AuthError ? error : 
          new AuthError('Authentication failed. Please try logging in again.', 401)
      }
    }
  }
  
  // Return service role client for unauthenticated requests
  return { user: null, supabase: createServiceRoleClient(), authenticated: false }
}

// Note: RLS policies are currently disabled
// When re-enabled, this will need to be updated to use user-specific clients
```

### 4. URL Statistics Handler
**Purpose**: Fetch and return URL statistics with proper fallback logic

**Current Issues**:
- No fallback to domain-level statistics
- Inconsistent response format
- Missing proper caching headers

**Design Solution**:
```typescript
async function handleGetUrlStats(req: Request) {
  const targetUrl = getUrlParam(req)
  const urlHash = await generateUrlHash(targetUrl)
  const domain = extractDomain(targetUrl)
  
  // Try URL-specific stats first
  let stats = await getUrlStats(urlHash)
  
  // Fallback to domain stats if no URL-specific data
  if (!stats || stats.rating_count === 0) {
    const domainStats = await getDomainStats(domain)
    stats = mergeDomainStats(stats, domainStats, domain)
  }
  
  // Apply baseline scoring if no data available
  if (!stats) {
    stats = createBaselineStats(targetUrl, domain)
  }
  
  return formatStatsResponse(stats, targetUrl)
}
```

### 5. Rating Submission System
**Purpose**: Handle both public and authenticated rating submissions with separate processing paths

**Current Architecture**:
- **Public Ratings**: Stored in public url_ratings table for unauthenticated submissions
- **Authenticated Ratings**: Handled through separate API for logged-in users
- **Domain Analysis**: Triggered separately after rating submission via dedicated function

**Design Solution**:

#### Public Rating Handler
```typescript
async function handlePublicRating(req: Request) {
  // Validate request payload
  const payload = await validateRatingPayload(req)
  const { url, score, isSpam, isMisleading, isScam } = payload
  
  const urlHash = await generateUrlHash(url)
  const domain = extractDomain(url)
  
  // Save to public url_ratings table
  const rating = await savePublicRating({
    url_hash: urlHash,
    url: url,
    domain: domain,
    rating: score,
    is_spam: isSpam,
    is_misleading: isMisleading,
    is_scam: isScam,
    created_at: new Date().toISOString()
  })
  
  // Trigger domain analysis function (async)
  await triggerDomainAnalysisFunction(domain, urlHash)
  
  // Return immediate feedback
  const currentStats = await getCurrentStats(urlHash, domain)
  
  return {
    message: 'Rating submitted successfully',
    rating: rating,
    urlStats: currentStats,
    processing: true // Domain analysis will update stats
  }
}
```

#### Authenticated Rating Handler
```typescript
async function handleAuthenticatedRating(req: Request, user: User) {
  // Validate request payload
  const payload = await validateRatingPayload(req)
  const { url, score, isSpam, isMisleading, isScam } = payload
  
  const urlHash = await generateUrlHash(url)
  const domain = extractDomain(url)
  
  // Save to authenticated ratings table
  const rating = await saveAuthenticatedRating({
    url_hash: urlHash,
    user_id: user.id,
    rating: score,
    is_spam: isSpam,
    is_misleading: isMisleading,
    is_scam: isScam
  })
  
  // Trigger domain analysis function (async)
  await triggerDomainAnalysisFunction(domain, urlHash)
  
  // Return immediate feedback with current stats
  const currentStats = await getCurrentStats(urlHash, domain)
  
  return {
    message: 'Rating submitted successfully',
    rating: rating,
    urlStats: currentStats,
    processing: true // Domain analysis will update stats
  }
}
```

#### Domain Analysis Trigger
```typescript
async function triggerDomainAnalysisFunction(domain: string, urlHash: string) {
  try {
    // Call separate domain analysis function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/domain-analysis`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ domain, urlHash })
    })
    
    if (!response.ok) {
      console.error('Domain analysis trigger failed:', await response.text())
    }
  } catch (error) {
    console.error('Failed to trigger domain analysis:', error)
    // Don't throw - this is background processing
  }
}

async function validateRatingPayload(req: Request) {
  const payload = await req.json()
  
  if (!payload.url || typeof payload.url !== 'string') {
    throw new ValidationError('URL is required and must be a string')
  }
  
  if (!payload.score || payload.score < 1 || payload.score > 5) {
    throw new ValidationError('Rating score must be between 1 and 5')
  }
  
  return payload
}
```

## Data Models

### Enhanced Response Models

**URL Stats Response**:
```typescript
interface UrlStatsResponse {
  url: string
  url_hash: string
  domain: string
  trust_score: number | null // Legacy compatibility
  final_trust_score: number | null
  domain_trust_score: number | null
  community_trust_score: number | null
  content_type: string
  rating_count: number
  average_rating: number | null
  spam_reports_count: number
  misleading_reports_count: number
  scam_reports_count: number
  last_updated: string | null
  data_source: 'url' | 'domain' | 'baseline' // Indicates data source
  cache_status: 'fresh' | 'stale' | 'none'
}
```

**Public Rating Response**:
```typescript
interface PublicRatingResponse {
  message: string
  rating: {
    id: string
    url: string
    domain: string
    rating: number
    is_spam: boolean
    is_misleading: boolean
    is_scam: boolean
    created_at: string
  }
  urlStats: UrlStatsResponse
  processing: boolean // Indicates domain analysis is running
}
```

**Authenticated Rating Response**:
```typescript
interface AuthenticatedRatingResponse {
  message: string
  rating: {
    id: string
    user_id: string
    rating: number
    is_spam: boolean
    is_misleading: boolean
    is_scam: boolean
    created_at: string
  }
  urlStats: UrlStatsResponse
  processing: boolean // Indicates domain analysis is running
}
```

**Domain Analysis Response**:
```typescript
interface DomainAnalysisResponse {
  success: boolean
  domain: string
  processed: boolean
  error?: string
  analysis?: {
    ssl_valid: boolean
    domain_age_days: number
    threat_detected: boolean
    analysis_timestamp: string
  }
}
```

## Error Handling

### Standardized Error Response Format
```typescript
interface ApiError {
  error: string
  code: string
  details?: any
  timestamp: string
  request_id: string
}

class ApiErrorHandler {
  static handle(error: Error, req: Request): Response {
    const errorResponse: ApiError = {
      error: error.message,
      code: error.constructor.name,
      timestamp: new Date().toISOString(),
      request_id: generateRequestId()
    }
    
    // Log error with context
    console.error('API Error:', {
      ...errorResponse,
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries())
    })
    
    return new Response(JSON.stringify(errorResponse), {
      status: getStatusCode(error),
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
```

### Error Types
- `ValidationError` (400): Invalid request parameters with specific field validation messages
- `AuthError` (401): Authentication failures with refresh instructions
- `NotFoundError` (404): Resource not found
- `RateLimitError` (429): API rate limit exceeded
- `DatabaseError` (500): Database operation failures with context
- `ExternalApiError` (502): External API failures
- `CorsError` (400): CORS-related issues with detailed information

## Testing Strategy

### Unit Tests
- Path routing logic validation
- Authentication token validation
- URL hash generation consistency
- Domain extraction accuracy
- Error response formatting

### Integration Tests
- End-to-end API request/response cycles
- Database operations with RLS policies
- External API integration (with mocking)
- Caching behavior validation

### Load Testing
- Concurrent request handling
- Rate limiting effectiveness
- Cache performance under load
- Database connection pooling

### Error Scenario Testing
- Invalid authentication tokens
- Malformed request payloads
- Database connection failures
- External API timeouts
- CORS preflight handling

## Performance Optimizations

### Caching Strategy
1. **Browser-level**: 5-minute cache for URL stats
2. **Database-level**: 7-day cache for domain analysis with proper TTL validation
3. **Response-level**: HTTP cache headers for static responses
4. **Request batching**: Combine multiple URL requests when possible
5. **Cache status indicators**: Include cache freshness information in responses

### Database Optimizations
1. **Connection pooling**: Reuse database connections
2. **Query optimization**: Use indexes and efficient queries
3. **Batch operations**: Group multiple database operations to minimize API calls
4. **Service role approach**: Use service role client since RLS policies are currently disabled (will need adjustment when RLS is re-enabled)

### API Rate Limiting and Scalability
1. **Request queuing**: Queue requests during high load
2. **Exponential backoff**: Implement backoff strategies for external APIs
3. **Circuit breaker**: Fail fast when external services are down
4. **Request deduplication**: Avoid duplicate requests for same data
5. **Background processing**: Use 5-minute cron job for rating aggregation to provide immediate user feedback
6. **Cache-first approach**: Check cache expiration before making external API calls

## Frontend Compatibility

### Authentication Flow Changes
**Purpose**: Ensure frontend continues to work with new backend authentication approach

**Key Considerations**:
- Frontend auth.js module must continue to work with service role backend approach
- Token validation responses should maintain same format for UI compatibility
- Error messages should be consistent with existing frontend error handling
- Authentication state management in popup.js should remain unchanged

**Compatibility Requirements**:
```typescript
// Frontend expects these response formats to remain consistent
interface AuthResponse {
  user: User | null
  authenticated: boolean
  error?: string
}

// Error responses should maintain format expected by popup.js
interface ErrorResponse {
  error: string
  code: string
  // Additional fields can be added but core structure must remain
}
```

**Migration Strategy**:
1. Backend changes use service role client but maintain same API contracts
2. Frontend authentication flow remains unchanged from user perspective
3. Error handling in popup.js should work with enhanced error messages
4. Token refresh logic in auth.js should continue to function normally

## Security Considerations

### Authentication Security
- JWT token validation with proper expiration checking
- Secure token storage in browser extension
- Rate limiting on authentication endpoints
- Proper error messages that don't leak sensitive information
- Service role security with proper access validation

### Data Protection
- Hash user IDs in database to protect privacy
- Sanitize URL inputs to prevent injection attacks
- Validate all request parameters
- Use HTTPS for all external API calls
- Service role security: Ensure proper access controls even with RLS disabled
- Plan for RLS re-enablement: Design with future RLS policy restoration in mind

### CORS Configuration
- Restrict origins to extension context
- Limit allowed headers and methods
- Proper preflight request handling
- Security headers in all responses