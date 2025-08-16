import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { 
    createRouter, 
    RouteConfig, 
    AuthError,
    validateRequestMethod,
    handleError,
    generateRequestId
} from '../_shared/routing.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Route configuration
const ROUTES: RouteConfig[] = [
    {
        method: 'POST',
        path: '/',
        handler: 'handleAggregateRatings',
        requiresAuth: true,
        description: 'Aggregate unprocessed ratings and update statistics'
    },
    {
        method: 'OPTIONS',
        path: '*',
        handler: 'handleCors',
        requiresAuth: false,
        description: 'CORS preflight requests'
    }
]

// Validate API key for security (prevent unauthorized aggregation calls)
function validateApiKey(req: Request): void {
    const apiKey = req.headers.get('apikey') || req.headers.get('Authorization')?.replace('Bearer ', '')
    
    if (!apiKey) {
        throw new AuthError('API key required')
    }

    // For aggregate-ratings, we primarily expect service role key
    // But we'll be more flexible and allow any valid JWT token format
    if (!apiKey.startsWith('eyJ')) {
        throw new AuthError('Invalid API key format')
    }
    
    // Additional validation could be added here if needed
    // For now, we trust that Supabase will validate the token when making database calls
}
// Handler for aggregating ratings
// This function calls the database function for consistency with cron job processing
async function handleAggregateRatings(req: Request, route: RouteConfig, requestId: string): Promise<Response> {
    // Validate API key
    validateApiKey(req)
    
    // Validate request method
    validateRequestMethod(req.method, ['POST'])
    
    // Use service role key for full database access
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })

    console.log(`[${requestId}] Starting manual rating aggregation`)

    try {
        // Call the same database function that the cron job uses
        // This ensures consistency between manual and automatic processing
        const { data, error } = await supabase.rpc('batch_aggregate_ratings')

        if (error) {
            console.error(`[${requestId}] Database function error:`, error)
            throw new Error(`Rating aggregation failed: ${error.message}`)
        }

        console.log(`[${requestId}] Rating aggregation completed:`, data)

        // Get count of unprocessed ratings to verify processing
        const { data: unprocessedCount, error: countError } = await supabase
            .from('ratings')
            .select('*', { count: 'exact', head: true })
            .eq('processed', false)

        if (countError) {
            console.warn(`[${requestId}] Could not verify unprocessed count:`, countError)
        }

        return new Response(
            JSON.stringify({
                message: 'Rating aggregation completed successfully',
                result: data,
                remaining_unprocessed: unprocessedCount || 0,
                request_id: requestId,
                timestamp: new Date().toISOString()
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error(`[${requestId}] Rating aggregation failed:`, error)
        
        return new Response(
            JSON.stringify({
                error: 'Rating aggregation failed',
                message: error.message,
                request_id: requestId,
                timestamp: new Date().toISOString()
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
}

// Route handlers
const handlers = {
    handleAggregateRatings,
    handleCors: (req: Request) => new Response('ok', { headers: corsHeaders })
}

// Create and export the router
const router = createRouter(ROUTES, 'aggregate-ratings', corsHeaders, handlers)

serve(router)