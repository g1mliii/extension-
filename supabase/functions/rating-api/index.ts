// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Get auth header if present
        const authHeader = req.headers.get('Authorization')
        
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            },
            global: authHeader ? {
                headers: {
                    Authorization: authHeader
                }
            } : undefined
        })

        const url = new URL(req.url)
        // Remove both the functions prefix and the function name
        const path = url.pathname.replace('/functions/v1/rating-api', '').replace('/rating-api', '')



        // Route handling
        if (req.method === 'GET' && path === '/url-stats') {
            // URL stats can be viewed without authentication
            return await handleGetUrlStats(req, supabase)
        } else if (req.method === 'POST' && path === '/rating') {
            // Rating submission requires authentication
            const authHeader = req.headers.get('Authorization')
            if (!authHeader) {
                return new Response(
                    JSON.stringify({ error: 'Authorization header required for rating submission' }),
                    {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    }
                )
            }

            // Verify the JWT token and create authenticated client
            const token = authHeader.replace('Bearer ', '')
            
            // Create authenticated supabase client
            const authenticatedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
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

            const { data: { user }, error: authError } = await authenticatedSupabase.auth.getUser()

            if (authError || !user) {
                return new Response(
                    JSON.stringify({ error: 'Invalid token' }),
                    {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    }
                )
            }

            return await handleSubmitRating(req, authenticatedSupabase, user.id)
        } else {
            return new Response(
                JSON.stringify({ error: 'Not found' }),
                {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})

// Utility to generate URL hash
async function generateUrlHash(url: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(url)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function handleGetUrlStats(req: Request, supabase: any) {
    const url = new URL(req.url)
    const targetUrl = url.searchParams.get('url')

    if (!targetUrl) {
        return new Response(
            JSON.stringify({ error: 'URL parameter is required' }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }

    const urlHash = await generateUrlHash(targetUrl)

    const { data, error } = await supabase
        .from('url_stats')
        .select('trust_score, rating_count, spam_reports_count, misleading_reports_count, scam_reports_count')
        .eq('url_hash', urlHash)
        .single()

    if (error && error.code === 'PGRST116') {
        // No stats found
        return new Response(
            JSON.stringify({
                url: targetUrl,
                url_hash: urlHash,
                trust_score: null,
                rating_count: 0,
                spam_reports_count: 0,
                misleading_reports_count: 0,
                scam_reports_count: 0,
                message: 'No stats found for this URL yet.'
            }),
            {
                status: 200,
                headers: { 
                    ...corsHeaders, 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
                    'CDN-Cache-Control': 'public, max-age=60'
                }
            }
        )
    }

    if (error) {
        throw new Error(`Database error: ${error.message}`)
    }

    return new Response(
        JSON.stringify({
            url: targetUrl,
            url_hash: urlHash,
            trust_score: data.trust_score,
            rating_count: data.rating_count,
            spam_reports_count: data.spam_reports_count,
            misleading_reports_count: data.misleading_reports_count,
            scam_reports_count: data.scam_reports_count
        }),
        {
            status: 200,
            headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
                'CDN-Cache-Control': 'public, max-age=300',
                'Vary': 'Accept-Encoding'
            }
        }
    )
}

async function handleSubmitRating(req: Request, supabase: any, userId: string) {
    const body = await req.json()
    const { url: targetUrl, score, comment, isSpam, isMisleading, isScam } = body

    if (!targetUrl || typeof score !== 'number' || score < 1 || score > 5) {
        return new Response(
            JSON.stringify({ error: 'URL and a score between 1-5 are required' }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }

    const urlHash = await generateUrlHash(targetUrl)

    // Check if user has already rated this URL within the last 24 hours
    const { data: existingRating, error: fetchError } = await supabase
        .from('ratings')
        .select('id, created_at, rating, comment, is_spam, is_misleading, is_scam')
        .eq('url_hash', urlHash)
        .eq('user_id_hash', userId)
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
                    rating: score,
                    comment: comment || null,
                    is_spam: isSpam || false,
                    is_misleading: isMisleading || false,
                    is_scam: isScam || false,
                    processed: false
                })
                .eq('id', existingRating.id)
                .eq('user_id_hash', userId)

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
                    user_id_hash: userId,
                    rating: score,
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
                user_id_hash: userId,
                rating: score,
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

    // Fetch current URL stats after submission
    const { data: currentUrlStats } = await supabase
        .from('url_stats')
        .select('trust_score, rating_count, spam_reports_count, misleading_reports_count, scam_reports_count')
        .eq('url_hash', urlHash)
        .single()

    return new Response(
        JSON.stringify({
            message,
            urlStats: currentUrlStats || {
                trust_score: null,
                rating_count: 0,
                spam_reports_count: 0,
                misleading_reports_count: 0,
                scam_reports_count: 0
            }
        }),
        {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
    )
}