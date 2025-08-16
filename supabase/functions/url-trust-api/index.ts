import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { 
    createRouter, 
    RouteConfig, 
    AuthError,
    ValidationError,
    NotFoundError,
    DatabaseError,
    validateRequestMethod,
    parseJsonBody,
    validateUrlParameter,
    validateRatingScore,
    getQueryParam
} from '../_shared/routing.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Route configuration
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

// Authentication validation using service role approach
async function validateAuthentication(req: Request, required: boolean = false) {
    const authHeader = req.headers.get('Authorization')
    
    if (!authHeader && required) {
        throw new AuthError('Authorization required. Please log in to submit ratings.')
    }
    
    if (authHeader) {
        // Validate header format
        if (!authHeader.startsWith('Bearer ')) {
            throw new AuthError('Invalid authorization header format. Expected: Bearer <token>')
        }
        
        const token = authHeader.replace('Bearer ', '')
        
        try {
            // Use service role client for auth validation since RLS is disabled
            const supabase = createClient(supabaseUrl, supabaseServiceKey, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            })
            
            // Validate token using Supabase auth
            const { data: { user }, error } = await supabase.auth.getUser(token)
            
            if (error) {
                if (error.message.includes('expired')) {
                    throw new AuthError('Token expired. Please refresh your session.')
                }
                throw new AuthError('Invalid token. Please log in again.')
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
                    new AuthError('Authentication failed. Please try logging in again.')
            }
        }
    }
    
    // Return service role client for unauthenticated requests
    return { user: null, supabase: createClient(supabaseUrl, supabaseServiceKey), authenticated: false }
}

// URL Statistics Handler
async function handleGetUrlStats(req: Request, route: RouteConfig, requestId: string): Promise<Response> {
    validateRequestMethod(req.method, ['GET'])
    
    const targetUrl = getQueryParam(req, 'url', true)
    const validatedUrl = validateUrlParameter(targetUrl)
    
    const urlHash = await generateUrlHash(validatedUrl)
    const domain = extractDomain(validatedUrl)
    
    console.log(`Fetching stats for: ${validatedUrl} -> ${urlHash}`)
    
    // Get service role client for database access
    const { supabase } = await validateAuthentication(req, false)
    
    try {
        // Try URL-specific stats first
        let stats = await getUrlStats(supabase, urlHash)
        
        // Fallback to domain stats if no URL-specific data
        if (!stats || stats.rating_count === 0) {
            const domainStats = await getDomainStats(supabase, domain)
            stats = mergeDomainStats(stats, domainStats, domain)
        }
        
        // Apply baseline scoring if no data available
        if (!stats) {
            stats = createBaselineStats(validatedUrl, domain)
        }
        
        return new Response(
            JSON.stringify(formatStatsResponse(stats, validatedUrl)),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    } catch (error) {
        console.error('Error fetching URL stats:', error)
        throw new DatabaseError(`Failed to fetch URL statistics: ${error.message}`)
    }
}

// Rating Submission Handler
async function handleSubmitRating(req: Request, route: RouteConfig, requestId: string): Promise<Response> {
    validateRequestMethod(req.method, ['POST'])
    
    // Validate authentication (required for rating submission)
    const { user, supabase } = await validateAuthentication(req, true)
    
    // Parse and validate request body
    const body = await parseJsonBody(req)
    const { url: targetUrl, score, comment, isSpam, isMisleading, isScam } = body
    
    // Validate required fields
    const validatedUrl = validateUrlParameter(targetUrl)
    const validatedScore = validateRatingScore(score)
    
    // Generate URL hash and extract domain
    const urlHash = await generateUrlHash(validatedUrl)
    const domain = extractDomain(validatedUrl)
    
    console.log(`Processing rating submission: ${validatedUrl} -> ${urlHash}`)
    
    try {
        // Check if user has already rated this URL within the last 24 hours
        const { data: existingRating, error: fetchError } = await supabase
            .from('ratings')
            .select('id, created_at, rating, comment, is_spam, is_misleading, is_scam')
            .eq('url_hash', urlHash)
            .eq('user_id_hash', user.id)
            .single()
        
        if (fetchError && fetchError.code !== 'PGRST116') {
            throw new DatabaseError(`Database error checking existing rating: ${fetchError.message}`)
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
                    throw new DatabaseError(`Failed to update rating: ${updateError.message}`)
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
                    throw new DatabaseError(`Failed to submit new rating: ${insertError.message}`)
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
                throw new DatabaseError(`Failed to submit rating: ${insertError.message}`)
            }
            message = 'Rating submitted successfully!'
        }
        
        // Update url_stats with domain information
        console.log(`Updating url_stats: url_hash=${urlHash}, domain=${domain}`)
        const { error: upsertError } = await supabase
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
        
        // Get current stats to return with response
        const currentStats = await getUrlStats(supabase, urlHash)
        
        return new Response(
            JSON.stringify({
                message,
                rating: {
                    url_hash: urlHash,
                    user_id: user.id,
                    rating: validatedScore,
                    is_spam: isSpam || false,
                    is_misleading: isMisleading || false,
                    is_scam: isScam || false,
                    created_at: currentTime.toISOString()
                },
                urlStats: currentStats ? formatStatsResponse(currentStats, validatedUrl) : null,
                processing: true, // Domain analysis will update stats
                timestamp: currentTime.toISOString(),
                request_id: requestId
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    } catch (error) {
        console.error('Error submitting rating:', error)
        if (error instanceof AuthError || error instanceof ValidationError || error instanceof DatabaseError) {
            throw error
        }
        throw new DatabaseError(`Failed to submit rating: ${error.message}`)
    }
}

// Utility Functions
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

async function getUrlStats(supabase: any, urlHash: string) {
    const { data, error } = await supabase
        .from('url_stats')
        .select('*')
        .eq('url_hash', urlHash)
        .single()
    
    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching URL stats:', error)
        return null
    }
    
    return data
}

async function getDomainStats(supabase: any, domain: string) {
    const { data, error } = await supabase
        .from('url_stats')
        .select('*')
        .eq('domain', domain)
        .order('rating_count', { ascending: false })
        .limit(1)
        .single()
    
    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching domain stats:', error)
        return null
    }
    
    return data
}

function mergeDomainStats(urlStats: any, domainStats: any, domain: string) {
    if (!domainStats) return urlStats
    
    return {
        ...domainStats,
        data_source: 'domain',
        cache_status: 'fresh'
    }
}

function createBaselineStats(url: string, domain: string) {
    const baselineScore = calculateDomainBaseline(domain)
    
    return {
        url: url,
        url_hash: '',
        domain: domain,
        trust_score: baselineScore,
        final_trust_score: baselineScore,
        domain_trust_score: baselineScore,
        community_trust_score: null,
        content_type: 'unknown',
        rating_count: 0,
        average_rating: null,
        spam_reports_count: 0,
        misleading_reports_count: 0,
        scam_reports_count: 0,
        last_updated: null,
        data_source: 'baseline',
        cache_status: 'none'
    }
}

function calculateDomainBaseline(domain: string): number {
    // Domain-specific baseline scores based on reputation
    const domainBaselines: Record<string, number> = {
        // High trust domains (70-85)
        'google.com': 85, 'youtube.com': 75, 'wikipedia.org': 85,
        'github.com': 80, 'stackoverflow.com': 82, 'microsoft.com': 78,
        'apple.com': 80, 'amazon.com': 72, 'netflix.com': 75,
        
        // Educational domains (75-85)
        'mit.edu': 85, 'stanford.edu': 85, 'harvard.edu': 85,
        'coursera.org': 78, 'khanacademy.org': 80,
        
        // News domains (65-80)
        'cnn.com': 70, 'bbc.com': 78, 'reuters.com': 80,
        'nytimes.com': 75, 'npr.org': 78,
        
        // Social media (55-65)
        'facebook.com': 60, 'twitter.com': 58, 'x.com': 58,
        'instagram.com': 62, 'linkedin.com': 68, 'reddit.com': 65,
        'tiktok.com': 55,
        
        // E-commerce (60-70)
        'ebay.com': 65, 'etsy.com': 68, 'paypal.com': 75
    }
    
    if (domain && domainBaselines[domain]) {
        return domainBaselines[domain]
    }
    
    // Default baseline based on TLD
    if (domain) {
        if (domain.endsWith('.edu') || domain.endsWith('.gov')) return 75
        if (domain.endsWith('.org')) return 65
        if (domain.endsWith('.com') || domain.endsWith('.net')) return 60
    }
    
    return 50 // Ultimate fallback
}

function formatStatsResponse(stats: any, url: string) {
    return {
        url: url,
        url_hash: stats.url_hash || '',
        domain: stats.domain,
        trust_score: stats.trust_score,
        final_trust_score: stats.final_trust_score,
        domain_trust_score: stats.domain_trust_score,
        community_trust_score: stats.community_trust_score,
        content_type: stats.content_type || 'unknown',
        rating_count: stats.rating_count || 0,
        average_rating: stats.average_rating,
        spam_reports_count: stats.spam_reports_count || 0,
        misleading_reports_count: stats.misleading_reports_count || 0,
        scam_reports_count: stats.scam_reports_count || 0,
        last_updated: stats.last_updated,
        data_source: stats.data_source || 'url',
        cache_status: stats.cache_status || 'fresh'
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
    handleGetUrlStats,
    handleSubmitRating,
    handleCors: (req: Request) => new Response('ok', { headers: corsHeaders })
}

// Create and export the router
const router = createRouter(ROUTES, 'url-trust-api', corsHeaders, handlers)

serve(router)