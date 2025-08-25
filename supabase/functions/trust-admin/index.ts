// Trust Algorithm Administration API
// Manages blacklists, configuration, and manual domain analysis

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const googleApiKey = Deno.env.get('GOOGLE_SAFE_BROWSING_API_KEY')
const hybridApiKey = Deno.env.get('HYBRID_ANALYSIS_API_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify API key (admin functions require service role key)
    const apiKey = req.headers.get('apikey') || req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!apiKey || apiKey !== supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const url = new URL(req.url)
    const path = url.pathname.replace('/functions/v1/trust-admin', '').replace('/trust-admin', '')

    // Route handling
    switch (true) {
      case req.method === 'GET' && path === '/blacklist':
        return await handleGetBlacklist(req, supabase)

      case req.method === 'POST' && path === '/blacklist':
        return await handleAddBlacklist(req, supabase)

      case req.method === 'DELETE' && path.startsWith('/blacklist/'):
        return await handleDeleteBlacklist(req, supabase, path)

      case req.method === 'GET' && path === '/config':
        return await handleGetConfig(req, supabase)

      case req.method === 'POST' && path === '/config':
        return await handleUpdateConfig(req, supabase)

      case req.method === 'POST' && path === '/recalculate':
        return await handleRecalculate(req, supabase)

      case req.method === 'GET' && path === '/analytics':
        return await handleGetAnalytics(req, supabase)

      case req.method === 'POST' && path === '/analyze-domain':
        return await handleAnalyzeDomain(req, supabase)

      default:
        return new Response(
          JSON.stringify({ error: 'Endpoint not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Trust admin error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleGetBlacklist(req: Request, supabase: any) {
  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = parseInt(url.searchParams.get('offset') || '0')
  const type = url.searchParams.get('type')

  let query = supabase
    .from('domain_blacklist')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (type) {
    query = query.eq('blacklist_type', type)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Error fetching blacklist: ${error.message}`)
  }

  return new Response(
    JSON.stringify({ data, count: data?.length || 0 }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleAddBlacklist(req: Request, supabase: any) {
  const { domain_pattern, blacklist_type, severity, description } = await req.json()

  if (!domain_pattern || !blacklist_type || !severity) {
    return new Response(
      JSON.stringify({ error: 'domain_pattern, blacklist_type, and severity are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (severity < 1 || severity > 10) {
    return new Response(
      JSON.stringify({ error: 'Severity must be between 1 and 10' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { data, error } = await supabase
    .from('domain_blacklist')
    .insert({
      domain_pattern,
      blacklist_type,
      severity,
      description,
      source: 'manual'
    })
    .select()

  if (error) {
    throw new Error(`Error adding blacklist entry: ${error.message}`)
  }

  return new Response(
    JSON.stringify({ message: 'Blacklist entry added successfully', data }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleDeleteBlacklist(req: Request, supabase: any, path: string) {
  const id = path.split('/').pop()

  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Blacklist ID required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { error } = await supabase
    .from('domain_blacklist')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    throw new Error(`Error deactivating blacklist entry: ${error.message}`)
  }

  return new Response(
    JSON.stringify({ message: 'Blacklist entry deactivated successfully' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleGetConfig(req: Request, supabase: any) {
  const { data, error } = await supabase
    .from('trust_algorithm_config')
    .select('*')
    .eq('is_active', true)
    .order('config_key')

  if (error) {
    throw new Error(`Error fetching configuration: ${error.message}`)
  }

  return new Response(
    JSON.stringify({ data }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleUpdateConfig(req: Request, supabase: any) {
  const { config_key, config_value, description } = await req.json()

  if (!config_key || !config_value) {
    return new Response(
      JSON.stringify({ error: 'config_key and config_value are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Use the database function to update configuration
  const { data, error } = await supabase.rpc('update_trust_config', {
    p_config_key: config_key,
    p_config_value: config_value,
    p_description: description
  })

  if (error) {
    throw new Error(`Error updating configuration: ${error.message}`)
  }

  return new Response(
    JSON.stringify({ message: 'Configuration updated successfully' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleRecalculate(req: Request, supabase: any) {
  // Trigger recalculation of all trust scores
  const { data, error } = await supabase.rpc('recalculate_with_new_config')

  if (error) {
    throw new Error(`Error recalculating trust scores: ${error.message}`)
  }

  return new Response(
    JSON.stringify({ message: 'Trust score recalculation initiated', result: data }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleGetAnalytics(req: Request, supabase: any) {
  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') || '7')

  // Get enhanced trust analytics
  const { data: analytics, error: analyticsError } = await supabase
    .from('enhanced_trust_analytics')
    .select('*')

  if (analyticsError) {
    throw new Error(`Error fetching analytics: ${analyticsError.message}`)
  }

  // Get algorithm performance
  const { data: performance, error: performanceError } = await supabase
    .from('trust_algorithm_performance')
    .select('*')
    .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

  if (performanceError) {
    throw new Error(`Error fetching performance data: ${performanceError.message}`)
  }

  // Get cache statistics
  const { data: cacheStats, error: cacheError } = await supabase
    .rpc('get_cache_statistics')

  return new Response(
    JSON.stringify({
      analytics,
      performance,
      cache_stats: cacheStats || null,
      cache_error: cacheError?.message || null
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleAnalyzeDomain(req: Request, supabase: any) {
  const { domain, force = false } = await req.json()

  if (!domain) {
    return new Response(
      JSON.stringify({ error: 'Domain parameter required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Check if domain already has recent cache (unless force is true)
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
            message: 'Domain already has recent analysis',
            data: cachedData,
            from_cache: true
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Perform domain analysis
    console.log('Starting admin domain analysis for:', domain)
    const analysis = await performDomainAnalysis(domain)

    // Store in cache
    const cacheData = {
      domain,
      domain_age_days: Math.floor(analysis.domainAge), // Ensure integer for int4 column
      whois_data: analysis.whoisData || null,
      http_status: analysis.httpStatus,
      ssl_valid: analysis.sslValid,
      google_safe_browsing_status: analysis.googleSafeBrowsingStatus,
      hybrid_analysis_status: analysis.hybridAnalysisStatus,
      threat_score: analysis.threatScore,
      last_checked: new Date().toISOString(),
      cache_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }

    const { error: cacheError } = await supabase
      .from('domain_cache')
      .upsert(cacheData)

    if (cacheError) {
      console.error('Error caching domain data:', cacheError)
      throw new Error(`Failed to cache domain analysis: ${cacheError.message}`)
    }

    return new Response(
      JSON.stringify({
        message: 'Domain analysis completed successfully',
        data: analysis,
        cached_data: cacheData,
        from_cache: false
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Domain analysis error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
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
    
    // 2.1. Create WHOIS data structure (heuristic-based for now)
    result.whoisData = JSON.stringify({
      domain: domain,
      method: 'heuristic',
      estimated_age_days: result.domainAge,
      analysis_date: new Date().toISOString(),
      note: 'Domain age calculated using heuristic method based on known domain patterns'
    })

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
            clientId: 'url-rating-extension-admin',
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
        'User-Agent': 'URL Rating Extension Admin'
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