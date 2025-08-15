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
const PHISHTANK_API_KEY = Deno.env.get('PHISHTANK_API_KEY')

interface DomainAnalysisResult {
  domain: string
  domainAge?: number
  whoisData?: any
  httpStatus?: number
  sslValid?: boolean
  googleSafeBrowsingStatus?: string
  phishtankStatus?: string
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
      phishtank_status: analysis.phishtankStatus,
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

    // 3. Google Safe Browsing
    if (GOOGLE_SAFE_BROWSING_API_KEY) {
      await checkGoogleSafeBrowsing(domain, result)
    }

    // 4. PhishTank
    if (PHISHTANK_API_KEY) {
      await checkPhishTank(domain, result)
    }

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

async function checkPhishTank(domain: string, result: DomainAnalysisResult) {
  if (!PHISHTANK_API_KEY) return

  try {
    // PhishTank API check
    const response = await fetch('https://checkurl.phishtank.com/checkurl/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'URL Rating Extension 1.0'
      },
      body: new URLSearchParams({
        url: `https://${domain}`,
        format: 'json',
        app_key: PHISHTANK_API_KEY
      })
    })

    const data = await response.json()
    
    if (data.results && data.results.in_database) {
      result.phishtankStatus = data.results.valid ? 'phishing' : 'suspicious'
    } else {
      result.phishtankStatus = 'clean'
    }

  } catch (error) {
    console.error('PhishTank check failed:', error)
    result.phishtankStatus = 'unknown'
  }
}