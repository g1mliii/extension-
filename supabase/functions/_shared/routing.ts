// Shared routing utilities for Supabase Edge Functions
// Provides standardized request routing, path parsing, and error handling

export interface RouteConfig {
    method: string
    path: string
    handler: string
    requiresAuth: boolean
    description: string
}

// Custom error classes for consistent error handling
export class ApiError extends Error {
    constructor(public message: string, public statusCode: number, public code: string) {
        super(message)
        this.name = 'ApiError'
    }
}

export class ValidationError extends ApiError {
    constructor(message: string) {
        super(message, 400, 'VALIDATION_ERROR')
    }
}

export class AuthError extends ApiError {
    constructor(message: string) {
        super(message, 401, 'AUTH_ERROR')
    }
}

export class NotFoundError extends ApiError {
    constructor(message: string) {
        super(message, 404, 'NOT_FOUND')
    }
}

export class RateLimitError extends ApiError {
    constructor(message: string) {
        super(message, 429, 'RATE_LIMIT_ERROR')
    }
}

export class DatabaseError extends ApiError {
    constructor(message: string) {
        super(message, 500, 'DATABASE_ERROR')
    }
}

export class ExternalApiError extends ApiError {
    constructor(message: string) {
        super(message, 502, 'EXTERNAL_API_ERROR')
    }
}

export class CorsError extends ApiError {
    constructor(message: string) {
        super(message, 400, 'CORS_ERROR')
    }
}

/**
 * Robust path parsing logic that correctly handles Supabase function routing
 * Supabase strips the /functions/v1/ prefix, so we need to handle the remaining path
 */
export function parseRequestPath(requestUrl: string, functionName: string): string {
    try {
        const url = new URL(requestUrl)
        const pathSegments = url.pathname.split('/').filter(Boolean)
        
        // Find the function name in the path
        const functionIndex = pathSegments.findIndex(segment => segment === functionName)
        
        if (functionIndex !== -1 && functionIndex < pathSegments.length - 1) {
            // Return path after function name
            return '/' + pathSegments.slice(functionIndex + 1).join('/')
        } else if (functionIndex !== -1) {
            // Function name found but no path after it
            return '/'
        }
        
        // Fallback - if no function name found, treat as root
        return '/'
    } catch (error) {
        throw new ValidationError(`Invalid URL format: ${error.message}`)
    }
}

/**
 * Route matching and validation with support for wildcard OPTIONS handling
 */
export function findRoute(method: string, path: string, routes: RouteConfig[]): RouteConfig | null {
    // Handle OPTIONS requests for any path (CORS preflight)
    if (method === 'OPTIONS') {
        return routes.find(route => route.method === 'OPTIONS') || null
    }
    
    // Handle root path requests - route based on method if no specific path routes exist
    if (path === '/' || path === '') {
        // First try to find exact root path match
        const rootRoute = routes.find(route => 
            route.method === method && (route.path === '/' || route.path === '')
        )
        if (rootRoute) return rootRoute
        
        // Fallback to method-based routing for common patterns
        if (method === 'GET') {
            const getRoute = routes.find(route => route.method === 'GET')
            if (getRoute) return getRoute
        }
        if (method === 'POST') {
            const postRoute = routes.find(route => route.method === 'POST')
            if (postRoute) return postRoute
        }
    }
    
    // Find exact match for method and path
    return routes.find(route => 
        route.method === method && route.path === path
    ) || null
}

/**
 * Generate unique request ID for error tracking and logging
 */
export function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Standardized error response handler with detailed logging
 */
export function handleError(error: any, requestId: string, corsHeaders: Record<string, string>): Response {
    console.error(`Request ${requestId} failed:`, {
        error: error.message,
        stack: error.stack,
        type: error.constructor.name,
        timestamp: new Date().toISOString()
    })
    
    let statusCode = 500
    let errorCode = 'INTERNAL_ERROR'
    let message = 'Internal server error'
    
    if (error instanceof ApiError) {
        statusCode = error.statusCode
        errorCode = error.code
        message = error.message
    }
    
    const errorResponse = {
        error: message,
        code: errorCode,
        timestamp: new Date().toISOString(),
        request_id: requestId
    }
    
    return new Response(JSON.stringify(errorResponse), {
        status: statusCode,
        headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json'
        }
    })
}

/**
 * Validate request method against allowed methods for a route
 */
export function validateRequestMethod(method: string, allowedMethods: string[]): void {
    if (!allowedMethods.includes(method) && method !== 'OPTIONS') {
        throw new ValidationError(
            `Method ${method} not allowed. Allowed methods: ${allowedMethods.join(', ')}, OPTIONS`
        )
    }
}

/**
 * Enhanced CORS handler with detailed error information
 */
export function handleCorsError(req: Request, corsHeaders: Record<string, string>): Response {
    const origin = req.headers.get('Origin')
    const method = req.headers.get('Access-Control-Request-Method')
    const headers = req.headers.get('Access-Control-Request-Headers')
    
    console.log('CORS preflight request:', {
        origin,
        method,
        headers,
        url: req.url
    })
    
    // Return proper CORS response
    return new Response('ok', { 
        headers: {
            ...corsHeaders,
            'Access-Control-Max-Age': '86400' // Cache preflight for 24 hours
        }
    })
}

/**
 * Create a standardized router function
 */
export function createRouter(
    routes: RouteConfig[], 
    functionName: string,
    corsHeaders: Record<string, string>,
    handlers: Record<string, Function>
) {
    return async (req: Request): Promise<Response> => {
        const requestId = generateRequestId()
        
        try {
            const method = req.method
            const path = parseRequestPath(req.url, functionName)
            
            // Find matching route
            const route = findRoute(method, path, routes)
            
            if (!route) {
                const allowedRoutes = routes
                    .filter(r => r.method !== 'OPTIONS')
                    .map(r => `${r.method} ${r.path}`)
                    .join(', ')
                
                throw new NotFoundError(
                    `Route not found: ${method} ${path}. Available routes: ${allowedRoutes}`
                )
            }
            
            // Handle CORS preflight
            if (method === 'OPTIONS') {
                return handleCorsError(req, corsHeaders)
            }
            
            // Get handler function
            const handler = handlers[route.handler]
            if (!handler) {
                throw new NotFoundError(`Handler not implemented: ${route.handler}`)
            }
            
            // Call handler with route context
            return await handler(req, route, requestId)
            
        } catch (error: any) {
            return handleError(error, requestId, corsHeaders)
        }
    }
}

/**
 * Utility to extract query parameters safely
 */
export function getQueryParam(req: Request, paramName: string, required: boolean = false): string | null {
    const url = new URL(req.url)
    const value = url.searchParams.get(paramName)
    
    if (required && !value) {
        throw new ValidationError(`Query parameter '${paramName}' is required`)
    }
    
    return value
}

/**
 * Utility to parse and validate JSON body
 */
export async function parseJsonBody(req: Request, required: boolean = true): Promise<any> {
    try {
        const body = await req.json()
        return body
    } catch (error) {
        if (required) {
            throw new ValidationError('Invalid JSON body')
        }
        return null
    }
}

/**
 * Validate common request parameters
 */
export function validateUrlParameter(url: string | null): string {
    if (!url) {
        throw new ValidationError('URL parameter is required')
    }
    
    if (typeof url !== 'string' || url.trim().length === 0) {
        throw new ValidationError('URL parameter must be a non-empty string')
    }
    
    // Basic URL validation
    try {
        new URL(url.startsWith('http') ? url : `https://${url}`)
    } catch (error) {
        throw new ValidationError('URL parameter must be a valid URL')
    }
    
    return url.trim()
}

/**
 * Validate rating score parameter
 */
export function validateRatingScore(score: any): number {
    if (typeof score !== 'number' || score < 1 || score > 5 || !Number.isInteger(score)) {
        throw new ValidationError('Rating score must be an integer between 1 and 5')
    }
    
    return score
}