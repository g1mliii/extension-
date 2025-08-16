import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { 
    createRouter, 
    RouteConfig, 
    AuthError,
    ValidationError,
    validateRequestMethod,
    parseJsonBody,
    validateUrlParameter,
    validateRatingScore
} from '../_shared/routing.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Route configuration
const ROUTES: RouteConfig[] = [
    {
        method: 'POST',
        path: '/',
        handler: 'handleRatingSubmission',
        requiresAuth: true,
        description: 'Submit authenticated rating for a URL'
    },
    {
        method: 'OPTIONS',
        path: '*',
        handler: 'handleCors',
        requiresAuth: false,
        description: 'CORS preflight requests'
    }
]

// Authentication validation
async function validateAuthentication(req: Request) {
    const authHeader = req.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthError('Authorization header with Bearer token required')
    }

    const token = authHeader.replace('Bearer ', '')

    // Use service role client for authentication since RLS is disabled
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError) {
        if (authError.message.includes('expired')) {
            throw new AuthError('Token expired. Please refresh your session.')
        }
        throw new AuthError(`Token validation failed: ${authError.message}`)
    }

    if (!user) {
        throw new AuthError('Invalid or expired token')
    }

    return { user, supabase }
}

// Handler for rating submission
async function handleRatingSubmission(req: Request, route: RouteConfig, requestId: string): Promise<Response> {
    // Validate request method
    validateRequestMethod(req.method, ['POST'])
    
    // Validate authentication
    const { user, supabase } = await validateAuthentication(req)

    // Parse and validate request body
    const body = await parseJsonBody(req)
    const { url: targetUrl, score, comment, isSpam, isMisleading, isScam } = body

    // Validate required fields
    const validatedUrl = validateUrlParameter(targetUrl)
    const validatedScore = validateRatingScore(score)

    // Generate URL hash
    const urlHash = await generateUrlHash(validatedUrl)
    const domain = extractDomain(validatedUrl)

    console.log(`Processing rating submission: ${validatedUrl} -> ${urlHash}`)

    // Check if user has already rated this URL within the last 24 hours
    const { data: existingRating, error: fetchError } = await supabase
        .from('ratings')
        .select('id, created_at, rating, comment, is_spam, is_misleading, is_scam')
        .eq('url_hash', urlHash)
        .eq('user_id_hash', user.id)
        .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Database error checking existing rating: ${fetchError.message}`)
    }

    const currentTime = new Date()
    let message = ''

    if (existingRating) {
        const createdAt = new Date(existingRating.created_at)
        const twentyFourHoursAgo = new Date(currentTime.getTime() - (24 * 60 * 60 * 1000))

        if (createdAt > twentyFourHoursAgo) {
            // Update existing rating if within 24 hours
            const { error: updateError } = await supabase
                .from('ratings')
                .update({
                    rating: validatedScore,
                    comment: comment || null,
                    is_spam: isSpam || false,
                    is_misleading: isMisleading || false,
                    is_scam: isScam || false,
                    processed: false
                })
                .eq('id', existingRating.id)
                .eq('user_id_hash', user.id)

            if (updateError) {
                throw new Error(`Failed to update rating: ${updateError.message}`)
            }
            message = 'Rating updated successfully!'
        } else {
            // Insert new rating if existing one is older than 24 hours
            const { error: insertError } = await supabase
                .from('ratings')
                .insert({
                    url_hash: urlHash,
                    user_id_hash: user.id,
                    rating: validatedScore,
                    comment: comment || null,
                    is_spam: isSpam || false,
                    is_misleading: isMisleading || false,
                    is_scam: isScam || false
                })

            if (insertError) {
                throw new Error(`Failed to submit new rating: ${insertError.message}`)
            }
            message = 'New rating submitted successfully (previous rating was too old to update)!'
        }
    } else {
        // No existing rating, insert new one
        const { error: insertError } = await supabase
            .from('ratings')
            .insert({
                url_hash: urlHash,
                user_id_hash: user.id,
                rating: validatedScore,
                comment: comment || null,
                is_spam: isSpam || false,
                is_misleading: isMisleading || false,
                is_scam: isScam || false
            })

        if (insertError) {
            throw new Error(`Failed to submit rating: ${insertError.message}`)
        }
        message = 'Rating submitted successfully!'
    }

    // Update url_stats with domain information (use service role)
    console.log(`Updating url_stats: url_hash=${urlHash}, domain=${domain}`)
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey)
    const { error: upsertError } = await serviceSupabase
        .from('url_stats')
        .upsert({
            url_hash: urlHash,
            domain: domain,
            last_updated: new Date().toISOString(),
            last_accessed: new Date().toISOString()
        }, {
            onConflict: 'url_hash'
        })

    if (upsertError) {
        console.error('Database upsert error:', upsertError)
    }

    // Trigger domain analysis if needed (async, don't wait)
    triggerDomainAnalysisIfNeeded(domain).catch(error => {
        console.error('Domain analysis trigger failed:', error)
    })

    return new Response(
        JSON.stringify({
            message,
            url_hash: urlHash,
            domain: domain,
            timestamp: new Date().toISOString(),
            request_id: requestId
        }),
        {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
    )
}

// Utility functions
async function generateUrlHash(url: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(url)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
        const domain = urlObj.hostname.replace(/^www\./, '')
        console.log(`Domain extracted: ${url} -> ${domain}`)
        return domain
    } catch (error) {
        // Fallback for malformed URLs
        const fallbackDomain = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0].split('?')[0]
        console.log(`Domain extraction fallback: ${url} -> ${fallbackDomain}`)
        return fallbackDomain
    }
}

async function triggerDomainAnalysisIfNeeded(domain: string) {
    try {
        const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey)
        
        // Check if domain is already in cache
        const { data: existingCache } = await serviceSupabase
            .from('domain_cache')
            .select('domain')
            .eq('domain', domain)
            .single()

        if (!existingCache) {
            console.log(`Triggering domain analysis for: ${domain}`)
            
            // Call batch-domain-analysis function
            const response = await fetch(`${supabaseUrl}/functions/v1/batch-domain-analysis`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    domains: [domain],
                    priority: 'high'
                })
            })

            if (!response.ok) {
                console.error(`Domain analysis request failed: ${response.status}`)
            } else {
                console.log(`Domain analysis triggered successfully for: ${domain}`)
            }
        } else {
            console.log(`Domain ${domain} already in cache, skipping analysis`)
        }
    } catch (error) {
        console.error(`Failed to trigger domain analysis for ${domain}:`, error)
    }
}

// Route handlers
const handlers = {
    handleRatingSubmission,
    handleCors: (req: Request) => new Response('ok', { headers: corsHeaders })
}

// Create and export the router
const router = createRouter(ROUTES, 'rating-submission', corsHeaders, handlers)

serve(router)