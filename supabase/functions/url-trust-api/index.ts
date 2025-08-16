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
    const apiKey = req.headers.get('apikey')

    // Check for API key first (for public access)
    if (apiKey === supabaseAnonKey) {
        return { user: null, supabase: createClient(supabaseUrl, supabaseServiceKey), authenticated: false }
    }

    if (!authHeader && !apiKey && required) {
        throw new AuthError('Authorization required. Please log in to submit ratings.')
    }

    if (authHeader) {
        // Validate header format
        if (!authHeader.startsWith('Bearer ')) {
            throw new AuthError('Invalid authorization header format. Expected: Bearer <token>')
        }

        const token = authHeader.replace('Bearer ', '')

        // Check if this is the anon key (not a user token)
        if (token === supabaseAnonKey) {
            // Anon key is valid for public access
            return { user: null, supabase: createClient(supabaseUrl, supabaseServiceKey), authenticated: false }
        }

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

            // For non-required auth, return service role client
            return { user: null, supabase: createClient(supabaseUrl, supabaseServiceKey), authenticated: false }
        }
    }

    // Return service role client for unauthenticated requests
    return { user: null, supabase: createClient(supabaseUrl, supabaseServiceKey), authenticated: false }
}

// URL Statistics Handler
async function handleGetUrlStats(req: Request, _route: RouteConfig, _requestId: string): Promise<Response> {
    validateRequestMethod(req.method, ['GET'])

    const targetUrl = getQueryParam(req, 'url', true)
    const validatedUrl = validateUrlParameter(targetUrl)

    const urlHash = await generateUrlHash(validatedUrl)
    const domain = extractDomain(validatedUrl)

    // Get service role client for database access
    const { supabase } = await validateAuthentication(req, false)

    try {
        // Try URL-specific stats first (with enhanced trust score calculation)
        let stats = await getUrlStats(supabase, urlHash, validatedUrl)

        // Only fallback to domain stats if we have no URL data at all
        if (!stats) {
            const domainStats = await getDomainStats(supabase, domain)
            stats = mergeDomainStats(stats, domainStats, domain)
        }

        // Apply baseline scoring only if no data available at all
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
async function handleSubmitRating(req: Request, _route: RouteConfig, requestId: string): Promise<Response> {
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

    try {
        // Check if user has already rated this URL within the last 24 hours
        let existingRating = null
        let fetchError = null

        try {
            const result = await supabase
                .from('ratings')
                .select('id, created_at, rating, comment, is_spam, is_misleading, is_scam')
                .eq('url_hash', urlHash)
                .eq('user_id_hash', user.id)
                .single()

            existingRating = result.data
            fetchError = result.error
        } catch (error) {
            // Continue without existing rating check if database query fails
            existingRating = null
            fetchError = null
        }

        if (fetchError && fetchError.code !== 'PGRST116') {
            // Continue without existing rating check rather than failing
            existingRating = null
        }

        const currentTime = new Date()
        let message = ''

        if (existingRating) {
            const createdAt = new Date(existingRating.created_at)
            const twentyFourHoursAgo = new Date(currentTime.getTime() - (24 * 60 * 60 * 1000))

            if (createdAt > twentyFourHoursAgo) {
                // Update existing rating if within 24 hours
                try {
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
                } catch (error) {
                    console.error('Error updating rating:', error.message)
                    throw new DatabaseError(`Failed to update rating: ${error.message}`)
                }
            } else {
                // Insert new rating if existing one is older than 24 hours
                try {
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
                } catch (error) {
                    console.error('Error inserting new rating:', error.message)
                    throw new DatabaseError(`Failed to submit new rating: ${error.message}`)
                }
            }
        } else {
            // No existing rating, insert new one
            try {
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
            } catch (error) {
                console.error('Error inserting rating:', error.message)
                throw new DatabaseError(`Failed to submit rating: ${error.message}`)
            }
        }

        // Update url_stats with domain information and ensure enhanced scores are calculated for new URLs
        try {
            // First check if URL stats already exist
            const { data: existingStats } = await supabase
                .from('url_stats')
                .select('url_hash, data_source')
                .eq('url_hash', urlHash)
                .single()

            if (!existingStats) {
                // This is a new URL, calculate enhanced scores and save
                try {
                    const { data: enhancedScores, error: enhancedError } = await supabase
                        .rpc('calculate_enhanced_trust_score', {
                            p_url_hash: urlHash,
                            p_url: validatedUrl
                        })
                        .single()

                    if (!enhancedError && enhancedScores) {
                        // Insert new URL stats with enhanced scores
                        const { error: insertError } = await supabase
                            .from('url_stats')
                            .insert({
                                url_hash: urlHash,
                                domain: domain,
                                domain_trust_score: enhancedScores.domain_score,
                                community_trust_score: enhancedScores.community_score,
                                final_trust_score: enhancedScores.final_score,
                                trust_score: enhancedScores.final_score,
                                content_type: enhancedScores.content_type,
                                rating_count: 0,
                                average_rating: null,
                                spam_reports_count: 0,
                                misleading_reports_count: 0,
                                scam_reports_count: 0,
                                last_updated: new Date().toISOString(),
                                last_accessed: new Date().toISOString(),
                                data_source: 'enhanced'
                            })

                        if (insertError) {
                            console.error('Failed to insert enhanced URL stats:', insertError.message)
                        } else {
                            console.log(`Enhanced trust scores calculated and saved for new URL ${urlHash}`)
                        }
                    }
                } catch (enhancedError) {
                    console.warn('Could not calculate enhanced trust scores for new URL:', enhancedError.message)
                    // Fallback to basic upsert
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
                        console.error('Database upsert error:', upsertError.message)
                    }
                }
            } else {
                // URL stats exist, just update access time
                const { error: updateError } = await supabase
                    .from('url_stats')
                    .update({
                        last_accessed: new Date().toISOString()
                    })
                    .eq('url_hash', urlHash)

                if (updateError) {
                    console.error('Failed to update last_accessed:', updateError.message)
                }
            }
        } catch (error) {
            console.error('Exception during url_stats handling:', error.message)
            // Don't fail the main operation for database errors
        }

        // Trigger domain analysis if needed (async, don't wait) - only for new domains
        triggerDomainAnalysisIfNeeded(domain).catch(error => {
            console.error('Domain analysis trigger failed:', error)
        })

        // Skip fetching current stats after rating submission to reduce redundant calls
        // The frontend can refetch if needed
        const currentStats = null

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
        return domain
    } catch (error) {
        // Fallback for malformed URLs
        const fallbackDomain = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0].split('?')[0]
        console.log(`Domain extraction fallback: ${url} -> ${fallbackDomain}`)
        return fallbackDomain
    }
}

async function getUrlStats(supabase: any, urlHash: string, url?: string) {
    try {
        const { data, error } = await supabase
            .from('url_stats')
            .select('*')
            .eq('url_hash', urlHash)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found - this is expected for new URLs
                return null
            } else {
                console.error('Error fetching URL stats:', error.message)
                return null
            }
        }

        // If we have existing data, just return it (enhanced scores should already be saved)
        if (data) {
            return data
        }

        // Only calculate enhanced scores for completely new URLs (no existing data)
        if (url && !data) {
            try {
                const { data: enhancedScores, error: enhancedError } = await supabase
                    .rpc('calculate_enhanced_trust_score', {
                        p_url_hash: urlHash,
                        p_url: url
                    })
                    .single()

                if (!enhancedError && enhancedScores) {
                    // Create new data object with enhanced scores and save to database
                    const newUrlStats = {
                        url_hash: urlHash,
                        domain_trust_score: enhancedScores.domain_score,
                        community_trust_score: enhancedScores.community_score,
                        final_trust_score: enhancedScores.final_score,
                        trust_score: enhancedScores.final_score,
                        content_type: enhancedScores.content_type,
                        rating_count: 0,
                        average_rating: null,
                        spam_reports_count: 0,
                        misleading_reports_count: 0,
                        scam_reports_count: 0,
                        last_updated: new Date().toISOString(),
                        data_source: 'enhanced'
                    }

                    // Save enhanced scores to database for future use
                    try {
                        const { error: insertError } = await supabase
                            .from('url_stats')
                            .insert(newUrlStats)

                        if (insertError) {
                            console.warn(`Failed to save enhanced scores for ${urlHash}:`, insertError.message)
                        } else {
                            console.log(`Enhanced trust scores calculated and saved for new URL ${urlHash}`)
                        }
                    } catch (saveError) {
                        console.warn(`Exception saving enhanced scores for ${urlHash}:`, saveError.message)
                    }

                    return newUrlStats
                }
            } catch (enhancedError) {
                console.warn('Could not calculate enhanced trust scores:', enhancedError.message)
                // Continue with basic stats if enhanced calculation fails
            }
        }

        return data
    } catch (error) {
        console.error('Exception fetching URL stats:', error.message)
        return null
    }
}

async function getDomainStats(supabase: any, domain: string) {
    try {
        const { data, error } = await supabase
            .from('url_stats')
            .select('*')
            .eq('domain', domain)
            .order('rating_count', { ascending: false })
            .limit(1)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found - this is expected for new domains
                return null
            } else {
                console.error('Error fetching domain stats:', error.message)
                return null
            }
        }

        return data
    } catch (error) {
        console.error('Exception fetching domain stats:', error.message)
        return null
    }
}

function mergeDomainStats(urlStats: any, domainStats: any, _domain: string) {
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

        // Check if domain is already in cache using safe function
        let needsAnalysis = true

        try {
            const { data: cacheCheck, error: cacheError } = await serviceSupabase
                .rpc('check_domain_cache_exists', { p_domain: domain })
                .single()

            if (cacheError) {
                console.warn(`Cache check failed for ${domain}:`, cacheError.message)
                needsAnalysis = true
            } else if (cacheCheck) {
                if (cacheCheck.cache_valid) {
                    console.log(`Domain ${domain} has valid cache, skipping analysis`)
                    needsAnalysis = false
                } else if (cacheCheck.domain_exists) {
                    console.log(`Domain ${domain} cache expired, triggering analysis`)
                    needsAnalysis = true
                } else {
                    console.log(`Domain ${domain} not in cache, triggering analysis`)
                    needsAnalysis = true
                }
            } else {
                console.log(`Domain ${domain} not in cache, triggering analysis`)
                needsAnalysis = true
            }
        } catch (error) {
            console.warn(`Error checking domain cache for ${domain}:`, error.message)
            needsAnalysis = true
        }

        if (!needsAnalysis) {
            return
        }

        // Perform domain analysis and cache results
        console.log(`Triggering domain analysis for: ${domain}`)

        try {
            const domainAnalysis = await performBasicDomainAnalysis(domain)

            const { error: upsertError } = await serviceSupabase
                .rpc('upsert_domain_cache_safe', {
                    p_domain: domain,
                    p_domain_age_days: domainAnalysis.domainAge,
                    p_whois_data: null,
                    p_http_status: domainAnalysis.httpStatus,
                    p_ssl_valid: domainAnalysis.sslValid,
                    p_google_safe_browsing_status: domainAnalysis.safeBrowsingStatus,
                    p_hybrid_analysis_status: 'clean',
                    p_threat_score: domainAnalysis.threatScore
                })

            if (upsertError) {
                console.error(`Domain cache upsert failed: ${upsertError.message}`)
            } else {
                console.log(`Domain analysis completed and cached for: ${domain}`)
            }

        } catch (error) {
            console.error(`Domain analysis failed for ${domain}:`, error.message)
        }
    } catch (error) {
        console.error(`Failed to trigger domain analysis for ${domain}:`, error.message)
    }
}

// Basic domain analysis function (simplified version)
async function performBasicDomainAnalysis(domain: string) {
    const result = {
        domain: domain,
        domainAge: 365 * 3, // Default 3 years
        httpStatus: 200,
        sslValid: true,
        safeBrowsingStatus: 'safe',
        threatScore: 0
    }

    try {
        // Try to check HTTP status and SSL
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

        try {
            const response = await fetch(`https://${domain}`, {
                method: 'HEAD',
                signal: controller.signal,
                redirect: 'follow'
            })

            clearTimeout(timeoutId)
            result.httpStatus = response.status
            result.sslValid = response.url.startsWith('https://')

        } catch (fetchError) {
            clearTimeout(timeoutId)
            // Keep defaults on error
        }

        // Set domain age based on known domains
        const wellKnownDomains: Record<string, number> = {
            'google.com': 365 * 25, 'youtube.com': 365 * 18, 'facebook.com': 365 * 20,
            'amazon.com': 365 * 28, 'apple.com': 365 * 30, 'microsoft.com': 365 * 35,
            'twitter.com': 365 * 17, 'x.com': 365 * 17, 'instagram.com': 365 * 13,
            'linkedin.com': 365 * 20, 'reddit.com': 365 * 18, 'github.com': 365 * 15,
            'stackoverflow.com': 365 * 15, 'wikipedia.org': 365 * 22
        }

        if (wellKnownDomains[domain]) {
            result.domainAge = wellKnownDomains[domain]
        } else if (domain.endsWith('.edu') || domain.endsWith('.gov')) {
            result.domainAge = 365 * 15
        } else if (domain.endsWith('.org')) {
            result.domainAge = 365 * 10
        }

    } catch (error) {
        console.error(`Domain analysis error for ${domain}:`, error.message)
    }

    return result
}

// Route handlers
const handlers = {
    handleGetUrlStats,
    handleSubmitRating,
    handleCors: (_req: Request) => new Response('ok', { headers: corsHeaders })
}

// Create and export the router
const router = createRouter(ROUTES, 'url-trust-api', corsHeaders, handlers)

serve(router)