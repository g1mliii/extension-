// Domain Analyzer Edge Function
// Collects external data for domain trust scoring
// Call this function periodically to update domain cache

// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// External API configurations (set these in your Supabase environment)
const GOOGLE_SAFE_BROWSING_API_KEY = Deno.env.get('GOOGLE_SAFE_BROWSING_API_KEY')
const HYBRID_ANALYSIS_API_KEY = Deno.env.get('HYBRID_ANALYSIS_API_KEY')

interface DomainAnalysisResult {
  domain: string
  domainAge?: number
  whoisData?: any
  httpStatus?: number
  sslValid?: boolean
  googleSafeBrowsingStatus?: string
  hybridAnalysisStatus?: string
  threatScore?: number // Combined threat score from both sources
  error?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify API key
    const apiKey = req.headers.get('apikey') || req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!apiKey || (apiKey !== Deno.env.get('SUPABASE_ANON_KEY') && apiKey !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { domain, force = false } = await req.json()

    if (!domain) {
      return new Response(
        JSON.stringify({ error: 'Domain parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if we have recent cached data (unless force refresh)
    if (!force) {
      const { data: cachedData } = await supabase
        .from('domain_cache')
        .select('*')
        .eq('domain', domain)
        .gt('cache_expires_at', new Date().toISOString())
        .single()

      if (cachedData) {
        return new Response(
          JSON.stringify({ 
            message: 'Using cached data', 
            data: cachedData,
            cached: true 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Analyze domain
    const analysis = await analyzeDomain(domain)

    // Store in cache
    const cacheData = {
      domain,
      domain_age_days: analysis.domainAge,
      whois_data: analysis.whoisData,
      http_status: analysis.httpStatus,
      ssl_valid: analysis.sslValid,
      google_safe_browsing_status: analysis.googleSafeBrowsingStatus,
      hybrid_analysis_status: analysis.hybridAnalysisStatus,
      threat_score: analysis.threatScore,
      last_checked: new Date().toISOString(),
      cache_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    }

    const { error: upsertError } = await supabase
      .from('domain_cache')
      .upsert(cacheData)

    if (upsertError) {
      console.error('Error caching domain data:', upsertError)
    }

    return new Response(
      JSON.stringify({ 
        message: 'Domain analysis completed', 
        data: cacheData,
        cached: false 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Domain analyzer error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function analyzeDomain(domain: string): Promise<DomainAnalysisResult> {
  const result: DomainAnalysisResult = { domain }

  try {
    // 1. HTTP Status and SSL Check
    await checkHttpAndSsl(domain, result)

    // 2. Domain Age (simplified - in production use proper WHOIS API)
    await checkDomainAge(domain, result)

    // 3. Google Safe Browsing (Primary)
    if (GOOGLE_SAFE_BROWSING_API_KEY) {
      await checkGoogleSafeBrowsing(domain, result)
    }

    // 4. Hybrid Analysis (Secondary)
    if (HYBRID_ANALYSIS_API_KEY) {
      await checkHybridAnalysis(domain, result)
    }

    // 5. Calculate combined threat score
    calculateThreatScore(result)

  } catch (error) {
    result.error = error.message
  }

  return result
}

async function checkHttpAndSsl(domain: string, result: DomainAnalysisResult) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(`https://${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow'
    })

    clearTimeout(timeoutId)
    
    result.httpStatus = response.status
    result.sslValid = response.url.startsWith('https://')

  } catch (_error) {
    // Try HTTP if HTTPS fails
    try {
      const response = await fetch(`http://${domain}`, {
        method: 'HEAD',
        redirect: 'follow'
      })
      result.httpStatus = response.status
      result.sslValid = false
    } catch (_httpError) {
      result.httpStatus = 0 // Unreachable
      result.sslValid = false
    }
  }
}

async function checkDomainAge(domain: string, result: DomainAnalysisResult) {
  // Simplified domain age check
  // In production, use a proper WHOIS API service like WhoisXML API
  
  // For now, we'll use a heuristic based on common patterns
  const commonDomains = [
    'google.com', 'youtube.com', 'facebook.com', 'twitter.com', 'x.com',
    'instagram.com', 'linkedin.com', 'github.com', 'stackoverflow.com',
    'wikipedia.org', 'reddit.com', 'medium.com', 'amazon.com', 'apple.com',
    'microsoft.com', 'netflix.com', 'spotify.com'
  ]

  if (commonDomains.includes(domain)) {
    result.domainAge = 365 * 10 // Assume 10+ years for major platforms
  } else {
    // For unknown domains, we'd need to call a WHOIS API
    // This is a placeholder - implement with actual WHOIS service
    result.domainAge = null
  }
}

async function checkGoogleSafeBrowsing(domain: string, result: DomainAnalysisResult) {
  if (!GOOGLE_SAFE_BROWSING_API_KEY) return

  try {
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_SAFE_BROWSING_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: {
            clientId: 'url-rating-extension',
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
        case 'MALWARE':
          result.googleSafeBrowsingStatus = 'malware'
          break
        case 'SOCIAL_ENGINEERING':
          result.googleSafeBrowsingStatus = 'phishing'
          break
        case 'UNWANTED_SOFTWARE':
          result.googleSafeBrowsingStatus = 'unwanted'
          break
        default:
          result.googleSafeBrowsingStatus = 'suspicious'
      }
    } else {
      result.googleSafeBrowsingStatus = 'safe'
    }

  } catch (error) {
    console.error('Google Safe Browsing check failed:', error)
    result.googleSafeBrowsingStatus = 'unknown'
  }
}

async function checkHybridAnalysis(domain: string, result: DomainAnalysisResult) {
  if (!HYBRID_ANALYSIS_API_KEY) return

  try {
    // Hybrid Analysis API - Search for domain reports
    const response = await fetch(`https://www.hybrid-analysis.com/api/v2/search/terms`, {
      method: 'POST',
      headers: {
        'api-key': HYBRID_ANALYSIS_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'URL Rating Extension 1.0'
      },
      body: new URLSearchParams({
        'domain': domain,
        'country': 'all',
        'verdict': 'all'
      })
    })

    const data = await response.json()
    
    if (data.result && data.result.length > 0) {
      // Check verdicts from recent analyses
      const maliciousReports = data.result.filter((report: any) => 
        report.verdict === 'malicious' || 
        report.threat_score >= 70 ||
        report.av_detect >= 5
      )
      
      const suspiciousReports = data.result.filter((report: any) => 
        report.verdict === 'suspicious' || 
        (report.threat_score >= 30 && report.threat_score < 70)
      )
      
      if (maliciousReports.length > 0) {
        result.hybridAnalysisStatus = 'malicious'
      } else if (suspiciousReports.length > 0) {
        result.hybridAnalysisStatus = 'suspicious'
      } else {
        result.hybridAnalysisStatus = 'clean'
      }
    } else {
      result.hybridAnalysisStatus = 'unknown'
    }

  } catch (error) {
    console.error('Hybrid Analysis check failed:', error)
    result.hybridAnalysisStatus = 'unknown'
  }
}

function calculateThreatScore(result: DomainAnalysisResult) {
  let threatScore = 0
  let totalChecks = 0

  // Google Safe Browsing (Primary - weight: 60)
  if (result.googleSafeBrowsingStatus) {
    totalChecks++
    switch (result.googleSafeBrowsingStatus) {
      case 'malware': threatScore += 60; break
      case 'phishing': threatScore += 55; break
      case 'unwanted': threatScore += 40; break
      case 'safe': threatScore += 0; break
    }
  }

  // Hybrid Analysis (Secondary - weight: 40)
  if (result.hybridAnalysisStatus) {
    totalChecks++
    switch (result.hybridAnalysisStatus) {
      case 'malicious': threatScore += 40; break
      case 'suspicious': threatScore += 25; break
      case 'clean': threatScore += 0; break
    }
  }

  // Calculate weighted threat score (0-100)
  result.threatScore = totalChecks > 0 ? Math.round(threatScore / totalChecks) : 0
}