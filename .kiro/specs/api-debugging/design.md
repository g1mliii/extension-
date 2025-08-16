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
**Purpose**: Separate function to handle domain analysis after rating submission with proper caching and error handling

**Requirements Addressed**: 2.2, 2.3, 6.4, 7.1, 7.7

**Design Rationale**: 
- Separates domain analysis from rating submission to improve performance and user experience
- Implements cache-first approach to minimize external API calls and costs
- Provides graceful error handling to prevent rating submission failures

**Design Solution**:
```typescript
// Dedicated domain analysis function with enhanced caching and error handling
async function handleDomainAnalysis(req: Request) {
  const { domain, urlHash } = await req.json()
  
  try {
    // Check cache first to avoid redundant API calls (Requirement 7.1, 7.7)
    const cacheEntry = await getDomainCacheEntry(domain)
    const cacheExpired = !cacheEntry || isCacheExpired(cacheEntry, 7 * 24 * 60 * 60 * 1000)
    
    if (cacheExpired) {
      console.log('Starting domain analysis for:', domain, { 
        reason: !cacheEntry ? 'no_cache' : 'cache_expired',
        requestId: generateRequestId()
      })
      
      // Perform domain analysis with rate limiting and backoff (Requirement 7.4)
      const analysisResult = await performDomainAnalysisWithRetry(domain)
      
      // Update domain cache with TTL (Requirement 7.5)
      await updateDomainCache(domain, analysisResult)
      
      // Update URL statistics with analysis results (Requirement 6.3)
      await updateUrlStatsWithAnalysis(urlHash, domain, analysisResult)
      
      console.log('Domain analysis completed for:', domain, { 
        analysisResult, 
        requestId: generateRequestId() 
      })
    } else {
      console.log('Using cached domain analysis for:', domain, { 
        cacheAge: Date.now() - new Date(cacheEntry.created_at).getTime(),
        requestId: generateRequestId()
      })
      
      // Still update URL stats with cached data (Requirement 7.2)
      await updateUrlStatsWithCachedAnalysis(urlHash, domain, cacheEntry)
    }
    
    return { success: true, domain, processed: true, cached: !cacheExpired }
  } catch (error) {
    // Enhanced error logging without failing the process (Requirement 3.1, 3.2)
    console.error('Domain analysis failed:', { 
      domain, 
      error: error.message, 
      stack: error.stack,
      requestId: generateRequestId(),
      timestamp: new Date().toISOString()
    })
    
    // Don't fail the entire process - log and continue (Requirement 6.6)
    return { success: false, domain, error: error.message, retryable: true }
  }
}

async function performDomainAnalysisWithRetry(domain: string, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Implement exponential backoff for rate limiting (Requirement 7.4)
      if (attempt > 1) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      return await performDomainAnalysis(domain);
    } catch (error) {
      lastError = error;
      console.warn(`Domain analysis attempt ${attempt} failed for ${domain}:`, error.message);
      
      // Don't retry on certain error types
      if (error.name === 'ValidationError' || error.status === 404) {
        throw error;
      }
    }
  }
  
  throw lastError;
}

async function performDomainAnalysis(domain: string) {
  // Implement actual domain analysis logic with external API integration
  // This includes SSL checks, domain age, threat database checks, etc.
  return {
    ssl_valid: true,
    domain_age_days: 365,
    threat_detected: false,
    analysis_timestamp: new Date().toISOString(),
    external_apis_used: ['ssl_check', 'whois', 'safe_browsing']
  }
}
```

### 2. API Request Router
**Purpose**: Properly route incoming requests to correct handlers with comprehensive validation and error handling

**Requirements Addressed**: 4.1, 4.2, 4.3, 4.4

**Design Rationale**: 
- Provides clear separation between different API endpoints
- Implements proper HTTP method validation to prevent routing conflicts
- Ensures consistent error responses for invalid requests

**Design Solution**:
```typescript
// Enhanced path routing with method validation and error handling
async function routeRequest(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(Boolean)
    const functionIndex = pathSegments.findIndex(segment => segment === 'url-trust-api')
    const path = '/' + pathSegments.slice(functionIndex + 1).join('/')
    const method = req.method
    const routeKey = `${method} ${path}`
    
    // Enhanced route validation with method checking (Requirement 4.1, 4.2)
    const routes = {
      'GET /url-stats': handleGetUrlStats,
      'POST /rating': handleSubmitRating,
      'OPTIONS /url-stats': handleCors,
      'OPTIONS /rating': handleCors,
      'OPTIONS *': handleCors
    }
    
    // Log all requests for debugging (Requirement 3.1)
    console.log('Routing request:', { 
      method, 
      path, 
      routeKey, 
      requestId: generateRequestId(),
      timestamp: new Date().toISOString()
    })
    
    const handler = routes[routeKey] || routes[`${method} *`] || routes['OPTIONS *']
    
    if (!handler) {
      // Return 404 for invalid paths (Requirement 4.3)
      const error = new NotFoundError(`Endpoint not found: ${method} ${path}`)
      console.error('Route not found:', { method, path, availableRoutes: Object.keys(routes) })
      return createErrorResponse(error, 404)
    }
    
    return await handler(req)
  } catch (error) {
    // Comprehensive error logging (Requirement 3.1, 3.2)
    console.error('Routing error:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      requestId: generateRequestId()
    })
    
    return createErrorResponse(error, 500)
  }
}

// Enhanced CORS handling (Requirement 4.4)
function handleCors(req: Request): Response {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400'
  }
  
  console.log('CORS request handled:', { 
    method: req.method, 
    origin: req.headers.get('origin'),
    requestId: generateRequestId()
  })
  
  return new Response(null, { status: 200, headers: corsHeaders })
}
```

### 3. Authentication Handler
**Purpose**: Consistent authentication across all endpoints with comprehensive error handling and logging

**Requirements Addressed**: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 2.6, 3.3

**Design Rationale**: 
- Uses service role approach for simplified database access while maintaining security through JWT validation
- Provides clear, actionable error messages for different authentication failure scenarios
- Supports both authenticated and unauthenticated access patterns based on endpoint requirements

**Design Solution**:
```typescript
// Enhanced authentication handler with comprehensive error handling
async function validateAuth(req: Request, required: boolean = false) {
  const authHeader = req.headers.get('Authorization')
  const requestId = generateRequestId()
  
  // Handle missing authentication for required endpoints (Requirement 5.6, 2.6)
  if (!authHeader && required) {
    const error = new AuthError('Authorization required. Please log in to submit ratings.', 401)
    console.warn('Authentication required but not provided:', { 
      endpoint: new URL(req.url).pathname,
      requestId 
    })
    throw error
  }
  
  if (authHeader) {
    // Validate header format (Requirement 5.4)
    if (!authHeader.startsWith('Bearer ')) {
      const error = new AuthError('Invalid authorization header format. Expected: Bearer <token>', 401)
      console.error('Malformed authorization header:', { 
        headerFormat: authHeader.substring(0, 20) + '...',
        requestId 
      })
      throw error
    }
    
    const token = authHeader.replace('Bearer ', '')
    
    try {
      // Use service role client for auth validation since RLS is disabled
      const supabase = createServiceRoleClient()
      
      // Validate token using Supabase auth (Requirement 5.1)
      const { data: { user }, error } = await supabase.auth.getUser(token)
      
      if (error) {
        // Provide specific error messages for different failure types (Requirement 5.2)
        let authError;
        if (error.message.includes('expired') || error.message.includes('JWT expired')) {
          authError = new AuthError('Token expired. Please refresh your session.', 401)
        } else if (error.message.includes('invalid') || error.message.includes('malformed')) {
          authError = new AuthError('Invalid token. Please log in again.', 401)
        } else {
          authError = new AuthError('Authentication failed. Please try logging in again.', 401)
        }
        
        // Log authentication failures without exposing sensitive data (Requirement 3.3)
        console.error('Authentication validation failed:', { 
          errorType: error.message.split(' ')[0],
          hasToken: !!token,
          tokenLength: token?.length,
          userId: user?.id || 'unknown',
          requestId
        })
        
        throw authError
      }
      
      // Log successful authentication
      console.log('Authentication successful:', { 
        userId: user.id,
        email: user.email,
        requestId
      })
      
      return { user, supabase, authenticated: true }
    } catch (error) {
      if (required) {
        throw error instanceof AuthError ? error : 
          new AuthError('Authentication failed. Please try logging in again.', 401)
      }
      
      // Log non-required auth failures for debugging
      console.warn('Optional authentication failed:', { 
        error: error.message,
        requestId
      })
    }
  }
  
  // Return service role client for unauthenticated requests (Requirement 5.3, 5.5)
  console.log('Proceeding with unauthenticated access:', { 
    endpoint: new URL(req.url).pathname,
    requestId
  })
  
  return { user: null, supabase: createServiceRoleClient(), authenticated: false }
}

// Enhanced error response creation
function createAuthErrorResponse(error: AuthError): Response {
  const errorResponse = {
    error: error.message,
    code: 'AUTH_ERROR',
    details: {
      requiresLogin: true,
      refreshRequired: error.message.includes('expired')
    },
    timestamp: new Date().toISOString(),
    request_id: generateRequestId()
  }
  
  return new Response(JSON.stringify(errorResponse), {
    status: error.status || 401,
    headers: { 
      ...corsHeaders, 
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer realm="API"'
    }
  })
}

// Note: Service role approach maintains security through JWT validation
// This design allows for future RLS re-enablement with minimal changes
```

### 4. URL Statistics Handler
**Purpose**: Fetch and return URL statistics with comprehensive fallback logic and error handling

**Requirements Addressed**: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 7.2

**Design Rationale**: 
- Implements multi-level fallback strategy (URL → domain → baseline) to ensure users always receive meaningful data
- Provides clear indication of data source and freshness for transparency
- Uses cached data when available to improve performance and reduce costs

**Design Solution**:
```typescript
async function handleGetUrlStats(req: Request) {
  const requestId = generateRequestId()
  
  try {
    const targetUrl = getUrlParam(req)
    const urlHash = await generateUrlHash(targetUrl)
    const domain = extractDomain(targetUrl)
    
    console.log('Fetching URL stats:', { 
      url: targetUrl, 
      domain, 
      urlHash: urlHash.substring(0, 8) + '...',
      requestId 
    })
    
    let stats = null
    let dataSource = 'baseline'
    let cacheStatus = 'none'
    
    // Try URL-specific stats first (Requirement 1.4)
    try {
      stats = await getUrlStats(urlHash)
      if (stats && stats.rating_count > 0) {
        dataSource = 'url'
        cacheStatus = determineCacheStatus(stats.last_updated)
        console.log('Found URL-specific stats:', { urlHash: urlHash.substring(0, 8) + '...', ratingCount: stats.rating_count, requestId })
      }
    } catch (error) {
      console.warn('Failed to fetch URL stats:', { error: error.message, requestId })
    }
    
    // Fallback to domain stats if no URL-specific data (Requirement 1.3)
    if (!stats || stats.rating_count === 0) {
      try {
        const domainStats = await getDomainStats(domain)
        if (domainStats && domainStats.rating_count > 0) {
          stats = mergeDomainStats(stats, domainStats, domain)
          dataSource = 'domain'
          cacheStatus = determineCacheStatus(domainStats.last_updated)
          console.log('Using domain fallback stats:', { domain, ratingCount: domainStats.rating_count, requestId })
        }
      } catch (error) {
        console.warn('Failed to fetch domain stats:', { domain, error: error.message, requestId })
      }
    }
    
    // Apply baseline scoring if no data available (Requirement 1.6)
    if (!stats || stats.rating_count === 0) {
      stats = createBaselineStats(targetUrl, domain)
      dataSource = 'baseline'
      cacheStatus = 'none'
      console.log('Using baseline stats:', { domain, requestId })
    }
    
    // Format response with data source indicators (Requirement 1.2)
    const response = formatStatsResponse(stats, targetUrl, dataSource, cacheStatus)
    
    // Add appropriate cache headers (Requirement 7.2)
    const cacheHeaders = getCacheHeaders(dataSource, cacheStatus)
    
    console.log('URL stats response prepared:', { 
      dataSource, 
      cacheStatus, 
      trustScore: response.final_trust_score,
      requestId 
    })
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        ...cacheHeaders
      }
    })
    
  } catch (error) {
    // Comprehensive error handling (Requirement 1.5)
    console.error('URL stats handler error:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      requestId
    })
    
    const errorResponse = {
      error: 'Failed to fetch URL statistics. Please try again.',
      code: 'STATS_FETCH_ERROR',
      details: { retryable: true },
      timestamp: new Date().toISOString(),
      request_id: requestId
    }
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

function determineCacheStatus(lastUpdated: string | null): 'fresh' | 'stale' | 'none' {
  if (!lastUpdated) return 'none'
  
  const age = Date.now() - new Date(lastUpdated).getTime()
  const fiveMinutes = 5 * 60 * 1000
  
  return age < fiveMinutes ? 'fresh' : 'stale'
}

function getCacheHeaders(dataSource: string, cacheStatus: string) {
  // Set appropriate cache headers based on data freshness
  if (dataSource === 'baseline') {
    return { 'Cache-Control': 'public, max-age=3600' } // 1 hour for baseline
  } else if (cacheStatus === 'fresh') {
    return { 'Cache-Control': 'public, max-age=300' } // 5 minutes for fresh data
  } else {
    return { 'Cache-Control': 'public, max-age=60' } // 1 minute for stale data
  }
}

async function createBaselineStats(url: string, domain: string) {
  // Create baseline statistics for unknown URLs (Requirement 1.6)
  return {
    url,
    url_hash: await generateUrlHash(url),
    domain,
    trust_score: null,
    final_trust_score: 50, // Neutral baseline
    domain_trust_score: null,
    community_trust_score: null,
    content_type: 'unknown',
    rating_count: 0,
    average_rating: null,
    spam_reports_count: 0,
    misleading_reports_count: 0,
    scam_reports_count: 0,
    last_updated: null
  }
}
```

### 5. Rating Submission System
**Purpose**: Handle authenticated rating submissions with comprehensive validation, immediate feedback, and background processing

**Requirements Addressed**: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 6.1, 6.5, 7.6

**Design Rationale**: 
- Focuses on authenticated ratings only to ensure data quality and prevent spam
- Provides immediate user feedback while triggering background processing for domain analysis
- Implements comprehensive validation with specific error messages for better user experience
- Uses batch operations to minimize database calls and improve performance

**Design Solution**:

#### Unified Rating Handler
```typescript
async function handleRatingSubmission(req: Request) {
  const requestId = generateRequestId()
  
  try {
    // Validate authentication (Requirement 2.6)
    const { user, supabase, authenticated } = await validateAuth(req, true)
    
    if (!authenticated) {
      throw new AuthError('Authentication required to submit ratings', 401)
    }
    
    // Validate request payload with detailed error messages (Requirement 2.7)
    const payload = await validateRatingPayload(req)
    const { url, score, isSpam, isMisleading, isScam } = payload
    
    const urlHash = await generateUrlHash(url)
    const domain = extractDomain(url)
    
    console.log('Processing rating submission:', { 
      userId: user.id, 
      domain, 
      score, 
      flags: { isSpam, isMisleading, isScam },
      requestId 
    })
    
    // Save rating to database (Requirement 2.1)
    const rating = await saveAuthenticatedRating(supabase, {
      url_hash: urlHash,
      user_id: user.id,
      url: url,
      domain: domain,
      rating: score,
      is_spam: isSpam || false,
      is_misleading: isMisleading || false,
      is_scam: isScam || false,
      created_at: new Date().toISOString()
    })
    
    // Save domain information for analysis (Requirement 2.2)
    await saveDomainForAnalysis(supabase, domain, urlHash)
    
    // Trigger domain analysis if needed (Requirement 2.3, 6.4)
    const analysisTriggered = await triggerDomainAnalysisIfNeeded(domain, urlHash)
    
    // Get current statistics for immediate feedback (Requirement 2.5)
    const currentStats = await getCurrentStats(supabase, urlHash, domain)
    
    // Mark for background processing (Requirement 6.1)
    await markForBackgroundProcessing(supabase, rating.id, 'rating_submitted')
    
    console.log('Rating submission completed:', { 
      ratingId: rating.id, 
      analysisTriggered,
      currentTrustScore: currentStats.final_trust_score,
      requestId 
    })
    
    // Return immediate feedback (Requirement 2.4)
    const response = {
      message: 'Rating submitted successfully',
      rating: {
        id: rating.id,
        user_id: user.id,
        rating: score,
        is_spam: isSpam || false,
        is_misleading: isMisleading || false,
        is_scam: isScam || false,
        created_at: rating.created_at
      },
      urlStats: currentStats,
      processing: {
        domainAnalysis: analysisTriggered,
        backgroundAggregation: true
      },
      request_id: requestId
    }
    
    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    // Enhanced error handling with specific error types (Requirement 2.6, 2.7)
    console.error('Rating submission error:', {
      error: error.message,
      stack: error.stack,
      userId: req.headers.get('Authorization') ? 'authenticated' : 'anonymous',
      requestId
    })
    
    if (error instanceof AuthError) {
      return createAuthErrorResponse(error)
    } else if (error instanceof ValidationError) {
      return createValidationErrorResponse(error)
    } else {
      return createGenericErrorResponse(error, requestId)
    }
  }
}

async function validateRatingPayload(req: Request) {
  const payload = await req.json()
  
  // Comprehensive validation with specific error messages (Requirement 2.7)
  if (!payload.url || typeof payload.url !== 'string') {
    throw new ValidationError('URL is required and must be a valid string')
  }
  
  if (!payload.score || typeof payload.score !== 'number' || payload.score < 1 || payload.score > 5) {
    throw new ValidationError('Rating score must be a number between 1 and 5')
  }
  
  // Validate URL format
  try {
    new URL(payload.url)
  } catch {
    throw new ValidationError('URL must be a valid URL format')
  }
  
  // Validate boolean flags
  if (payload.isSpam !== undefined && typeof payload.isSpam !== 'boolean') {
    throw new ValidationError('isSpam must be a boolean value')
  }
  
  if (payload.isMisleading !== undefined && typeof payload.isMisleading !== 'boolean') {
    throw new ValidationError('isMisleading must be a boolean value')
  }
  
  if (payload.isScam !== undefined && typeof payload.isScam !== 'boolean') {
    throw new ValidationError('isScam must be a boolean value')
  }
  
  return payload
}

async function saveAuthenticatedRating(supabase, ratingData) {
  // Use batch operations to minimize database calls (Requirement 7.6)
  const { data, error } = await supabase
    .from('url_ratings')
    .upsert(ratingData, { 
      onConflict: 'user_id,url_hash',
      ignoreDuplicates: false 
    })
    .select()
    .single()
  
  if (error) {
    console.error('Failed to save rating:', error)
    throw new DatabaseError('Failed to save rating to database')
  }
  
  return data
}

async function triggerDomainAnalysisIfNeeded(domain: string, urlHash: string): Promise<boolean> {
  try {
    // Check if domain analysis is needed before triggering (Requirement 6.4, 7.7)
    const needsAnalysis = await checkIfDomainAnalysisNeeded(domain)
    
    if (!needsAnalysis) {
      console.log('Domain analysis not needed (cached):', { domain })
      return false
    }
    
    // Call domain analysis function asynchronously
    const response = await fetch(`${SUPABASE_URL}/functions/v1/batch-domain-analysis`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ domains: [domain], urlHash })
    })
    
    if (!response.ok) {
      console.error('Domain analysis trigger failed:', await response.text())
      return false
    }
    
    console.log('Domain analysis triggered successfully:', { domain })
    return true
  } catch (error) {
    console.error('Failed to trigger domain analysis:', error)
    // Don't fail the rating submission for background processing errors
    return false
  }
}

async function markForBackgroundProcessing(supabase, ratingId: string, eventType: string) {
  // Mark rating for processing by cron job (Requirement 6.1)
  const { error } = await supabase
    .from('processing_queue')
    .insert({
      rating_id: ratingId,
      event_type: eventType,
      status: 'pending',
      created_at: new Date().toISOString()
    })
  
  if (error) {
    console.warn('Failed to mark for background processing:', error)
    // Don't fail the main operation
  }
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

**Requirements Addressed**: 3.1, 3.2, 3.3, 3.4, 1.5, 2.6, 2.7

**Design Rationale**: 
- Provides comprehensive error logging with request context for debugging
- Implements standardized error response format for consistent frontend handling
- Includes specific error types with actionable messages for users
- Ensures sensitive data is not exposed in error responses

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
    const requestId = generateRequestId()
    const errorResponse: ApiError = {
      error: error.message,
      code: error.constructor.name,
      timestamp: new Date().toISOString(),
      request_id: requestId
    }
    
    // Enhanced error logging with request context (Requirement 3.1, 3.2)
    console.error('API Error:', {
      ...errorResponse,
      url: req.url,
      method: req.method,
      userAgent: req.headers.get('user-agent'),
      origin: req.headers.get('origin'),
      hasAuth: !!req.headers.get('authorization'),
      stack: error.stack,
      // Don't log sensitive headers
      headers: {
        'content-type': req.headers.get('content-type'),
        'accept': req.headers.get('accept')
      }
    })
    
    // Add specific error details based on error type
    if (error instanceof ValidationError) {
      errorResponse.details = { 
        field: error.field,
        validationRule: error.rule,
        retryable: false
      }
    } else if (error instanceof AuthError) {
      errorResponse.details = { 
        requiresLogin: true,
        refreshRequired: error.message.includes('expired'),
        retryable: true
      }
    } else if (error instanceof DatabaseError) {
      errorResponse.details = { 
        retryable: true,
        category: 'database'
      }
    }
    
    return new Response(JSON.stringify(errorResponse), {
      status: getStatusCode(error),
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

// Enhanced error logging for CORS issues (Requirement 3.4)
function logCorsError(req: Request, error: string) {
  console.error('CORS Error:', {
    error,
    origin: req.headers.get('origin'),
    method: req.method,
    url: req.url,
    referer: req.headers.get('referer'),
    userAgent: req.headers.get('user-agent'),
    timestamp: new Date().toISOString(),
    request_id: generateRequestId()
  })
}

// Database error logging with context (Requirement 3.2)
function logDatabaseError(operation: string, error: any, context: any = {}) {
  console.error('Database Error:', {
    operation,
    error: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    context,
    timestamp: new Date().toISOString(),
    request_id: generateRequestId()
  })
}

// Authentication error logging without sensitive data (Requirement 3.3)
function logAuthError(error: any, context: any = {}) {
  console.error('Authentication Error:', {
    errorType: error.message?.split(' ')[0] || 'unknown',
    hasToken: !!context.token,
    tokenLength: context.token?.length,
    userId: context.userId || 'unknown',
    endpoint: context.endpoint,
    timestamp: new Date().toISOString(),
    request_id: generateRequestId()
  })
}
```

### Error Types with Enhanced Handling
- `ValidationError` (400): Invalid request parameters with specific field validation messages and retry guidance
- `AuthError` (401): Authentication failures with refresh instructions and clear next steps
- `NotFoundError` (404): Resource not found with suggestions for valid endpoints
- `RateLimitError` (429): API rate limit exceeded with retry-after headers
- `DatabaseError` (500): Database operation failures with context and retry indicators
- `ExternalApiError` (502): External API failures with fallback information
- `CorsError` (400): CORS-related issues with detailed configuration information

### Error Response Examples
```typescript
// Validation Error Response
{
  "error": "Rating score must be a number between 1 and 5",
  "code": "ValidationError",
  "details": {
    "field": "score",
    "validationRule": "range_1_to_5",
    "retryable": false
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_abc123"
}

// Authentication Error Response
{
  "error": "Token expired. Please refresh your session.",
  "code": "AuthError",
  "details": {
    "requiresLogin": true,
    "refreshRequired": true,
    "retryable": true
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_def456"
}

// Network Error Response (Requirement 1.5)
{
  "error": "Failed to fetch URL statistics. Please try again.",
  "code": "NetworkError",
  "details": {
    "retryable": true,
    "category": "network"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_ghi789"
}
```

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

**Requirements Addressed**: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 6.1, 6.5

**Design Rationale**: 
- Implements multi-level caching strategy to minimize external API calls and database queries
- Uses background processing to provide immediate user feedback while handling expensive operations asynchronously
- Implements rate limiting and backoff strategies to stay within API limits and manage costs

### Caching Strategy
1. **Browser-level**: 5-minute cache for URL stats with localStorage persistence (Requirement 7.2)
2. **Database-level**: 7-day cache for domain analysis with proper TTL validation (Requirement 7.1, 7.5)
3. **Response-level**: HTTP cache headers for static responses based on data freshness
4. **Request batching**: Combine multiple URL requests when possible (Requirement 7.3)
5. **Cache status indicators**: Include cache freshness information in responses for transparency
6. **Cache-first approach**: Always check cache expiration before making external API calls (Requirement 7.7)

```typescript
// Enhanced caching implementation
class CacheManager {
  static async getCachedData(key: string, ttl: number): Promise<any> {
    const cached = await this.getFromCache(key)
    
    if (cached && !this.isExpired(cached, ttl)) {
      console.log('Cache hit:', { key, age: Date.now() - cached.timestamp })
      return cached.data
    }
    
    console.log('Cache miss:', { key, expired: !!cached })
    return null
  }
  
  static async setCachedData(key: string, data: any, metadata: any = {}) {
    await this.setInCache(key, {
      data,
      timestamp: Date.now(),
      metadata
    })
  }
  
  static isExpired(cached: any, ttl: number): boolean {
    return (Date.now() - cached.timestamp) > ttl
  }
}
```

### Database Optimizations
1. **Connection pooling**: Reuse database connections across requests (Requirement 7.6)
2. **Query optimization**: Use indexes and efficient queries with proper WHERE clauses
3. **Batch operations**: Group multiple database operations to minimize API calls (Requirement 7.6)
4. **Service role approach**: Use service role client for simplified access patterns
5. **Prepared statements**: Use parameterized queries for better performance and security

```typescript
// Batch database operations example
async function batchUpdateRatings(ratings: Rating[]): Promise<void> {
  const batchSize = 100
  
  for (let i = 0; i < ratings.length; i += batchSize) {
    const batch = ratings.slice(i, i + batchSize)
    
    await supabase
      .from('url_ratings')
      .upsert(batch, { onConflict: 'user_id,url_hash' })
    
    // Small delay between batches to avoid overwhelming the database
    if (i + batchSize < ratings.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
}
```

### API Rate Limiting and Scalability
1. **Request queuing**: Queue requests during high load with priority handling (Requirement 7.4)
2. **Exponential backoff**: Implement backoff strategies for external APIs (Requirement 7.4)
3. **Circuit breaker**: Fail fast when external services are down
4. **Request deduplication**: Avoid duplicate requests for same data (Requirement 7.3)
5. **Background processing**: Use 5-minute cron job for rating aggregation to provide immediate user feedback (Requirement 6.1, 6.5)
6. **Concurrency limits**: Limit concurrent external API calls to respect rate limits

```typescript
// Rate limiting and backoff implementation
class RateLimiter {
  private static queues = new Map<string, Promise<any>[]>()
  private static lastCall = new Map<string, number>()
  
  static async throttle(key: string, fn: () => Promise<any>, minInterval: number = 1000): Promise<any> {
    const now = Date.now()
    const lastCallTime = this.lastCall.get(key) || 0
    const timeSinceLastCall = now - lastCallTime
    
    if (timeSinceLastCall < minInterval) {
      const delay = minInterval - timeSinceLastCall
      console.log('Rate limiting:', { key, delay })
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    this.lastCall.set(key, Date.now())
    return await fn()
  }
  
  static async withExponentialBackoff<T>(
    fn: () => Promise<T>, 
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        
        if (attempt === maxRetries) break
        
        const delay = baseDelay * Math.pow(2, attempt - 1)
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError
  }
}

// Request deduplication
class RequestDeduplicator {
  private static pending = new Map<string, Promise<any>>()
  
  static async deduplicate<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.pending.has(key)) {
      console.log('Deduplicating request:', key)
      return await this.pending.get(key)
    }
    
    const promise = fn().finally(() => {
      this.pending.delete(key)
    })
    
    this.pending.set(key, promise)
    return await promise
  }
}
```

### Background Processing Strategy
1. **Immediate feedback**: Return current statistics immediately after rating submission (Requirement 6.5)
2. **Async domain analysis**: Trigger domain analysis in background without blocking user response
3. **Cron job aggregation**: Process ratings every 5 minutes to update statistics (Requirement 6.1)
4. **Error recovery**: Retry failed background operations on next cron cycle (Requirement 6.6)
5. **Processing queue**: Track background operations with status monitoring

```typescript
// Background processing queue
interface ProcessingJob {
  id: string
  type: 'domain_analysis' | 'rating_aggregation'
  payload: any
  status: 'pending' | 'processing' | 'completed' | 'failed'
  retryCount: number
  createdAt: Date
  processedAt?: Date
}

class BackgroundProcessor {
  static async queueJob(type: string, payload: any): Promise<string> {
    const job: ProcessingJob = {
      id: generateId(),
      type,
      payload,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date()
    }
    
    await this.saveJob(job)
    console.log('Background job queued:', { id: job.id, type })
    
    return job.id
  }
  
  static async processJobs(): Promise<void> {
    const pendingJobs = await this.getPendingJobs()
    
    for (const job of pendingJobs) {
      try {
        await this.processJob(job)
      } catch (error) {
        console.error('Background job failed:', { jobId: job.id, error: error.message })
        await this.handleJobFailure(job, error)
      }
    }
  }
}
```

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