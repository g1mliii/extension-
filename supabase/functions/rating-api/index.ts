import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Route configuration with proper method validation
interface RouteConfig {
    method: string
    path: string
    handler: string
    requiresAuth: boolean
    description: string
}

const ROUTES: RouteConfig[] = [
    {
        method: 'GET',
        path: '/url-stats',
        handler: 'handleGetUrlStats',
        requiresAuth: false,
        description: 'Fetch URL statistics and trust scores'
    },
    {
        method: 'POST', 
        path: '/rating',
        handler: 'handleSubmitRating',
        requiresAuth: true,
        description: 'Submit rating and reports for a URL'
    },
    {
        method: 'OPTIONS',
        path: '*',
        handler: 'handleCors',
        requiresAuth: false,
        description: 'CORS preflight requests'
    }
]

// Custom error classes
class ApiError extends Error {
    constructor(public message: string, public statusCode: number, public code: string) {
        super(message)
        this.name = 'ApiError'
    }
}

class ValidationError extends ApiError {
    constructor(message: string) {
        super(message, 400, 'VALIDATION_ERROR')
    }
}

class AuthError extends ApiError {
    constructor(message: string) {
        super(message, 401, 'AUTH_ERROR')
    }
}

class NotFoundError extends ApiError {
    constructor(message: string) {
        super(message, 404, 'NOT_FOUND')
    }
}

// Robust path parsing logic that correctly handles Supabase function routing
function parseRequestPath(requestUrl: string): string {
    try {
        const url = new URL(requestUrl)
        const pathSegments = url.pathname.split('/').filter(Boolean)
        
        // Supabase strips /functions/v1/ prefix, so first segment is function name
        // Everything after the function name is the route path
        if (pathSegments.length > 1 && pathSegments[0] === 'rating-api') {
            return '/' + pathSegments.slice(1).join('/')
        } else if (pathSegments.length === 1 && pathSegments[0] === 'rating-api') {
            return '/'
        }
        
        // Fallback - treat entire path as route
        return '/' + pathSegments.join('/')
    } catch (error) {
        throw new ValidationError(`Invalid URL format: ${error.message}`)
    }
}

// Route matching and validation
function findRoute(method: string, path: string): RouteConfig | null {
    // Handle OPTIONS requests for any path (CORS preflight)
    if (method === 'OPTIONS') {
        return ROUTES.find(route => route.method === 'OPTIONS') || null
    }
    
    // Handle root path requests - route to url-stats for GET, rating for POST
    if (path === '/' || path === '') {
        if (method === 'GET') {
            return ROUTES.find(route => route.method === 'GET' && route.path === '/url-stats') || null
        }
        if (method === 'POST') {
            return ROUTES.find(route => route.method === 'POST' && route.path === '/rating') || null
        }
    }
    
    // Find exact match for method and path
    return ROUTES.find(route => 
        route.method === method && route.path === path
    ) || null
}

// Generate unique request ID for error tracking
function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// Standardized error response handler
function handleError(error: any, requestId: string): Response {
    console.error(`Request ${requestId} failed:`, {
        error: error.message,
        stack: error.stack,
        type: error.constructor.name
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

// Authentication validation
async function validateAuthentication(req: Request) {
    const authHeader = req.headers.get('Authorization')
    
    if (!authHeader) {
        throw new AuthError('Authorization header required')
    }
    
    if (!authHeader.startsWith('Bearer ')) {
        throw new AuthError('Authorization header must use Bearer token format')
    }
    
    const token = authHeader.replace('Bearer ', '')
    
    if (!token.trim()) {
        throw new AuthError('Authorization token cannot be empty')
    }
    
    // Create authenticated supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        },
        global: {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
        throw new AuthError(`Token validation failed: ${authError.message}`)
    }
    
    if (!user) {
        throw new AuthError('Invalid or expired token')
    }
    
    return { user, supabase }
}

// URL Stats handler
async function handleGetUrlStats(req: Request): Promise<Response> {
    try {
        const url = new URL(req.url)
        const targetUrl = url.searchParams.get('url')

        if (!targetUrl) {
            throw new ValidationError('URL parameter is required')
        }

        // For now, return a simple response to test routing
        return new Response(JSON.stringify({
            success: true,
            message: 'GET /url-stats endpoint working!',
            url: targetUrl,
            timestamp: new Date().toISOString()
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    } catch (error) {
        console.error('Error in handleGetUrlStats:', error)
        throw error
    }
}

// Rating submission handler
async function handleSubmitRating(req: Request, supabase: any, userId: string): Promise<Response> {
    try {
        const body = await req.json()
        
        // For now, return a simple response to test routing
        return new Response(JSON.stringify({
            success: true,
            message: 'POST /rating endpoint working!',
            userId: userId,
            body: body,
            timestamp: new Date().toISOString()
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    } catch (error) {
        console.error('Error in handleSubmitRating:', error)
        throw error
    }
}

// Centralized request router
async function routeRequest(req: Request): Promise<Response> {
    const method = req.method
    const path = parseRequestPath(req.url)
    
    // Find matching route
    const route = findRoute(method, path)
    
    if (!route) {
        const allowedRoutes = ROUTES
            .filter(r => r.method !== 'OPTIONS')
            .map(r => `${r.method} ${r.path}`)
            .join(', ')
        
        throw new NotFoundError(
            `Route not found: ${method} ${path}. Available routes: ${allowedRoutes}`
        )
    }
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }
    
    // Validate authentication if required
    let authContext = null
    if (route.requiresAuth) {
        authContext = await validateAuthentication(req)
    }
    
    // Route to appropriate handler
    switch (route.handler) {
        case 'handleGetUrlStats':
            return await handleGetUrlStats(req)
        case 'handleSubmitRating':
            if (!authContext) {
                throw new AuthError('Authentication required but not provided')
            }
            return await handleSubmitRating(req, authContext.supabase, authContext.user.id)
        default:
            throw new NotFoundError(`Handler not implemented: ${route.handler}`)
    }
}

serve(async (req) => {
    const requestId = generateRequestId()
    
    try {
        return await routeRequest(req)
    } catch (error: any) {
        return handleError(error, requestId)
    }
})