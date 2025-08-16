// Batch Domain Analysis Edge Function
// Analyzes multiple domains from url_stats that need cache refresh

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { 
    createRouter, 
    RouteConfig, 
    AuthError,
    validateRequestMethod,
    parseJsonBody,
    ValidationError
} from '../_shared/routing.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const googleApiKey = Deno.env.get('GOOGLE_SAFE_BROWSING_API_KEY')
const hybridApiKey = Deno.env.get('HYBRID_ANALYSIS_API_KEY')

// Route configuration
const ROUTES: RouteConfig[] = [
    {
        method: 'POST',
        path: '/',
        handler: 'handleBatchDomainAnalysis',
        requiresAuth: false,
        description: 'Batch analyze domains for security and trust metrics'
    },
    {
        method: 'OPTIONS',
        path: '*',
        handler: 'handleCors',
        requiresAuth: false,
        description: 'CORS preflight requests'
    }
]

// Validate API key for security
function validateApiKey(req: Request): void {
    const authHeader = req.headers.get('Authorization')
    const apiKey = req.headers.get('apikey')
    
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    // Check for API key first (for public access)
    if (apiKey === supabaseAnonKey || apiKey === supabaseServiceKey) {
        return
    }
    
    // Check Authorization header
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '')
        if (token === supabaseAnonKey || token === supabaseServiceKey) {
            return
        }
    }
    
    throw new AuthError('Invalid API key')
}

// Handler for batch domain analysis
async function handleBatchDomainAnalysis(req: Request, route: RouteConfig, requestId: string): Promise<Response> {
    // Validate request method
    validateRequestMethod(req.method, ['POST'])
    
    // For now, allow all requests to proceed - this function is called internally
    // TODO: Implement proper service-to-service authentication if needed
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })

    const body = await parseJsonBody(req, false) || {}
    const { limit = 10, domains = null, priority = 'normal' } = body

    let domainsToAnalyze: any[] = []

    if (domains && Array.isArray(domains)) {
        // Specific domains provided
        domainsToAnalyze = domains.map(domain => ({ domain }))
    } else {
        // Get domains that need analysis (no cache or expired cache)
        const { data: fetchedDomains, error: domainsError } = await supabase
            .from('url_stats')
            .select('domain')
            .not('domain', 'is', null)
            .not('domain', 'eq', 'unknown')
            .limit(limit)

        if (domainsError) {
            throw new Error(`Error fetching domains: ${domainsError.message}`)
        }

        domainsToAnalyze = fetchedDomains || []
    }

    if (domainsToAnalyze.length === 0) {
        return new Response(
            JSON.stringify({ 
                message: 'No domains need analysis',
                request_id: requestId
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Filter out domains that already have recent cache (unless high priority)
    const uniqueDomains = [...new Set(domainsToAnalyze.map(d => d.domain))]
    const domainsNeedingAnalysis: string[] = []

    for (const domain of uniqueDomains) {
        if (priority === 'high') {
            // High priority - analyze regardless of cache
            domainsNeedingAnalysis.push(domain)
        } else {
            // Normal priority - check cache first using safe function
            try {
                const { data: cacheCheck, error: cacheError } = await supabase
                    .rpc('check_domain_cache_exists', { p_domain: domain })
                    .single()

                if (cacheError || !cacheCheck || !cacheCheck.cache_valid) {
                    domainsNeedingAnalysis.push(domain)
                }
            } catch (error) {
                console.warn(`Error checking cache for ${domain}, including in analysis:`, error.message)
                domainsNeedingAnalysis.push(domain)
            }
        }
    }

    if (domainsNeedingAnalysis.length === 0) {
        return new Response(
            JSON.stringify({ 
                message: 'All domains have recent cache',
                request_id: requestId
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Analyze domains in parallel (with concurrency limit)
    const results = []
    const concurrencyLimit = priority === 'high' ? 5 : 3 // Higher concurrency for high priority

    for (let i = 0; i < domainsNeedingAnalysis.length; i += concurrencyLimit) {
        const batch = domainsNeedingAnalysis.slice(i, i + concurrencyLimit)
        const batchPromises = batch.map(domain => analyzeSingleDomain(domain, supabase))
        const batchResults = await Promise.allSettled(batchPromises)
        
        results.push(...batchResults.map((result, index) => ({
            domain: batch[index],
            success: result.status === 'fulfilled',
            data: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? (result.reason as Error)?.message || 'Unknown error' : null
        })))

        // Small delay between batches to be respectful to external APIs
        if (i + concurrencyLimit < domainsNeedingAnalysis.length) {
            await new Promise(resolve => setTimeout(resolve, priority === 'high' ? 500 : 1000))
        }
    }

    // Update url_stats with domain information where missing
    for (const result of results) {
        if (result.success && result.data) {
            await supabase
                .from('url_stats')
                .update({ domain: result.domain })
                .eq('domain', result.domain)
        }
    }

    const successCount = results.filter(r => r.success).length
    const errorCount = results.filter(r => !r.success).length

    return new Response(
        JSON.stringify({
            message: `Batch analysis completed`,
            analyzed: successCount,
            errors: errorCount,
            results: results,
            request_id: requestId
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}

async function analyzeSingleDomain(domain: string, supabase: any) {
  try {
    console.log('Starting domain analysis for:', domain)
    
    // Perform domain analysis directly (copied from rating-api)
    const analysis = await performDomainAnalysis(domain)

    // Store in cache using safe upsert function
    const { data: upsertResult, error: upsertError } = await supabase
      .rpc('upsert_domain_cache_safe', {
        p_domain: domain,
        p_domain_age_days: analysis.domainAge,
        p_whois_data: analysis.whoisData || null,
        p_http_status: analysis.httpStatus,
        p_ssl_valid: analysis.sslValid,
        p_google_safe_browsing_status: analysis.googleSafeBrowsingStatus,
        p_hybrid_analysis_status: analysis.hybridAnalysisStatus,
        p_threat_score: analysis.threatScore
      })

    if (upsertError) {
      console.error('Error caching domain data using safe upsert:', upsertError)
      throw new Error(`Failed to cache domain analysis: ${upsertError.message}`)
    }
    
    if (!upsertResult) {
      console.warn(`Domain cache upsert returned false for ${domain}`)
    }

    console.log(`Successfully analyzed and cached domain: ${domain}`)
    return analysis

  } catch (error) {
    console.error(`Error analyzing domain ${domain}:`, error)
    throw error
  }
}

// Domain analysis functions (copied from rating-api)
async function performDomainAnalysis(domain: string) {
  console.log('Starting domain analysis for:', domain)

  const result: any = { domain }

  try {
    // 1. HTTP Status and SSL Check
    await checkHttpAndSsl(domain, result)

    // 2. Domain Age (heuristic)
    result.domainAge = getDomainAge(domain)

    // 3. Google Safe Browsing
    if (googleApiKey) {
      await checkGoogleSafeBrowsing(domain, result)
    } else {
      result.googleSafeBrowsingStatus = getHeuristicSafeBrowsing(domain)
    }

    // 4. Hybrid Analysis
    if (hybridApiKey) {
      await checkHybridAnalysis(domain, result)
    } else {
      result.hybridAnalysisStatus = 'clean'
    }

    // 5. Calculate threat score
    result.threatScore = calculateThreatScore(result)

    console.log('Domain analysis complete for:', domain)

  } catch (error) {
    console.error('Domain analysis error for', domain, ':', error)
    result.error = error.message
  }

  return result
}

async function checkHttpAndSsl(domain: string, result: any) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`https://${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow'
    })

    clearTimeout(timeoutId)

    result.httpStatus = response.status
    result.sslValid = response.url.startsWith('https://')

  } catch (error) {
    try {
      const response = await fetch(`http://${domain}`, {
        method: 'HEAD',
        redirect: 'follow'
      })
      result.httpStatus = response.status
      result.sslValid = false
    } catch (httpError) {
      result.httpStatus = 0
      result.sslValid = false
    }
  }
}

function getDomainAge(domain: string): number {
  const wellKnownDomains: { [key: string]: number } = {
    'google.com': 365 * 25, 'youtube.com': 365 * 18, 'facebook.com': 365 * 20,
    'amazon.com': 365 * 28, 'apple.com': 365 * 30, 'microsoft.com': 365 * 35,
    'twitter.com': 365 * 17, 'x.com': 365 * 17, 'instagram.com': 365 * 13,
    'linkedin.com': 365 * 20, 'reddit.com': 365 * 18, 'github.com': 365 * 15,
    'stackoverflow.com': 365 * 15, 'wikipedia.org': 365 * 22
  }

  if (wellKnownDomains[domain]) {
    return wellKnownDomains[domain]
  }

  if (domain.endsWith('.edu') || domain.endsWith('.gov')) return 365 * 15
  if (domain.endsWith('.org')) return 365 * 10
  if (domain.match(/\.(tk|ml|ga|cf)$/)) return 365 * 1

  return 365 * 3
}

async function checkGoogleSafeBrowsing(domain: string, result: any) {
  try {
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: {
            clientId: 'url-rating-extension-batch',
            clientVersion: '1.0.0'
          },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [
              { url: `http://${domain}/` },
              { url: `https://${domain}/` }
            ]
          }
        })
      }
    )

    const data = await response.json()

    if (data.matches && data.matches.length > 0) {
      const threatType = data.matches[0].threatType
      switch (threatType) {
        case 'MALWARE': result.googleSafeBrowsingStatus = 'malware'; break
        case 'SOCIAL_ENGINEERING': result.googleSafeBrowsingStatus = 'phishing'; break
        case 'UNWANTED_SOFTWARE': result.googleSafeBrowsingStatus = 'unwanted'; break
        default: result.googleSafeBrowsingStatus = 'suspicious'
      }
    } else {
      result.googleSafeBrowsingStatus = 'safe'
    }

  } catch (error) {
    console.error('Google Safe Browsing check failed:', error)
    result.googleSafeBrowsingStatus = 'unknown'
  }
}

function getHeuristicSafeBrowsing(domain: string): string {
  const trustedDomains = [
    'google.com', 'youtube.com', 'facebook.com', 'twitter.com', 'x.com',
    'instagram.com', 'linkedin.com', 'github.com', 'stackoverflow.com',
    'wikipedia.org', 'reddit.com', 'amazon.com', 'apple.com', 'microsoft.com'
  ]

  if (trustedDomains.includes(domain)) return 'safe'
  if (domain.match(/\.(tk|ml|ga|cf)$/)) return 'suspicious'

  return 'safe'
}

async function checkHybridAnalysis(domain: string, result: any) {
  try {
    const response = await fetch(`https://www.hybrid-analysis.com/api/v2/search/terms`, {
      method: 'POST',
      headers: {
        'api-key': hybridApiKey!,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'URL Rating Extension Batch'
      },
      body: new URLSearchParams({
        'domain': domain,
        'country': 'all',
        'verdict': 'all'
      })
    })

    const data = await response.json()

    if (data.result && data.result.length > 0) {
      const maliciousReports = data.result.filter((report: any) =>
        report.verdict === 'malicious' || report.threat_score >= 70
      )

      if (maliciousReports.length > 0) {
        result.hybridAnalysisStatus = 'malicious'
      } else {
        result.hybridAnalysisStatus = 'clean'
      }
    } else {
      result.hybridAnalysisStatus = 'clean'
    }

  } catch (error) {
    console.error('Hybrid Analysis check failed:', error)
    result.hybridAnalysisStatus = 'unknown'
  }
}

function calculateThreatScore(result: any): number {
    let threatScore = 0
    let totalChecks = 0

    if (result.googleSafeBrowsingStatus) {
        totalChecks++
        switch (result.googleSafeBrowsingStatus) {
            case 'malware': threatScore += 60; break
            case 'phishing': threatScore += 55; break
            case 'unwanted': threatScore += 40; break
            case 'safe': threatScore += 0; break
        }
    }

    if (result.hybridAnalysisStatus) {
        totalChecks++
        switch (result.hybridAnalysisStatus) {
            case 'malicious': threatScore += 40; break
            case 'suspicious': threatScore += 25; break
            case 'clean': threatScore += 0; break
        }
    }

    return totalChecks > 0 ? Math.round(threatScore / totalChecks) : 0
}

// Route handlers
const handlers = {
    handleBatchDomainAnalysis,
    handleCors: (req: Request) => new Response('ok', { headers: corsHeaders })
}

// Create and export the router
const router = createRouter(ROUTES, 'batch-domain-analysis', corsHeaders, handlers)

serve(router)