// Public Trust Score API
// Provides enhanced trust score data for URLs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const url = new URL(req.url)
    const path = url.pathname.replace('/functions/v1/trust-score-api', '').replace('/trust-score-api', '')

    // Route handling
    switch (true) {
      case req.method === 'GET' && (path === '/score' || path === ''):
        return await handleGetTrustScore(req, supabase)
      
      case req.method === 'POST' && path === '/batch-scores':
        return await handleBatchTrustScores(req, supabase)
      
      case req.method === 'GET' && path === '/domain-info':
        return await handleGetDomainInfo(req, supabase)
      
      case req.method === 'GET' && path === '/content-types':
        return await handleGetContentTypes(req, supabase)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Endpoint not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Trust score API error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

// Utility to extract domain from URL
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
    return urlObj.hostname.replace(/^www\./, '')
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0].split('?')[0]
  }
}

async function handleGetTrustScore(req: Request, supabase: any) {
  const url = new URL(req.url)
  const targetUrl = url.searchParams.get('url')

  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: 'URL parameter is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const urlHash = await generateUrlHash(targetUrl)
  const domain = extractDomain(targetUrl)

  // Get enhanced trust score data
  const { data, error } = await supabase
    .from('url_stats')
    .select(`
      trust_score,
      final_trust_score,
      domain_trust_score,
      community_trust_score,
      content_type,
      rating_count,
      average_rating,
      spam_reports_count,
      misleading_reports_count,
      scam_reports_count,
      domain,
      last_updated
    `)
    .eq('url_hash', urlHash)
    .single()

  if (error && error.code === 'PGRST116') {
    // No stats found - return default structure
    return new Response(
      JSON.stringify({
        url: targetUrl,
        url_hash: urlHash,
        domain: domain,
        trust_score: null,
        final_trust_score: null,
        domain_trust_score: null,
        community_trust_score: null,
        content_type: 'general',
        rating_count: 0,
        average_rating: null,
        spam_reports_count: 0,
        misleading_reports_count: 0,
        scam_reports_count: 0,
        last_updated: null,
        message: 'No trust score data available for this URL yet.'
      }),
      {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
        }
      }
    )
  }

  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  // Get domain cache info if available
  let domainInfo = null
  if (data.domain) {
    const { data: domainData, error: domainError } = await supabase
      .from('domain_cache')
      .select('domain_age_days, ssl_valid, google_safe_browsing_status, phishtank_status, last_checked')
      .eq('domain', data.domain)
      .single()
    
    if (!domainError) {
      domainInfo = domainData
    }
  }

  return new Response(
    JSON.stringify({
      url: targetUrl,
      url_hash: urlHash,
      domain: data.domain || domain,
      trust_score: data.trust_score, // Legacy compatibility
      final_trust_score: data.final_trust_score,
      domain_trust_score: data.domain_trust_score,
      community_trust_score: data.community_trust_score,
      content_type: data.content_type,
      rating_count: data.rating_count,
      average_rating: data.average_rating,
      spam_reports_count: data.spam_reports_count,
      misleading_reports_count: data.misleading_reports_count,
      scam_reports_count: data.scam_reports_count,
      last_updated: data.last_updated,
      domain_info: domainInfo
    }),
    {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'Vary': 'Accept-Encoding'
      }
    }
  )
}

async function handleBatchTrustScores(req: Request, supabase: any) {
  const { urls } = await req.json()

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return new Response(
      JSON.stringify({ error: 'URLs array is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (urls.length > 50) {
    return new Response(
      JSON.stringify({ error: 'Maximum 50 URLs per batch request' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Generate hashes for all URLs
  const urlData = await Promise.all(
    urls.map(async (url) => ({
      url,
      hash: await generateUrlHash(url),
      domain: extractDomain(url)
    }))
  )

  const hashes = urlData.map(item => item.hash)

  // Get trust scores for all URLs
  const { data, error } = await supabase
    .from('url_stats')
    .select(`
      url_hash,
      trust_score,
      final_trust_score,
      domain_trust_score,
      community_trust_score,
      content_type,
      rating_count,
      average_rating,
      spam_reports_count,
      misleading_reports_count,
      scam_reports_count,
      domain,
      last_updated
    `)
    .in('url_hash', hashes)

  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  // Create a map of hash to data
  const dataMap = new Map<string, any>()
  data?.forEach((item: any) => dataMap.set(item.url_hash, item))

  // Build response with all URLs
  const results = urlData.map(item => {
    const stats = dataMap.get(item.hash)
    
    if (stats) {
      return {
        url: item.url,
        url_hash: item.hash,
        domain: stats.domain || item.domain,
        trust_score: stats.trust_score,
        final_trust_score: stats.final_trust_score,
        domain_trust_score: stats.domain_trust_score,
        community_trust_score: stats.community_trust_score,
        content_type: stats.content_type,
        rating_count: stats.rating_count,
        average_rating: stats.average_rating,
        spam_reports_count: stats.spam_reports_count,
        misleading_reports_count: stats.misleading_reports_count,
        scam_reports_count: stats.scam_reports_count,
        last_updated: stats.last_updated
      }
    } else {
      return {
        url: item.url,
        url_hash: item.hash,
        domain: item.domain,
        trust_score: null,
        final_trust_score: null,
        domain_trust_score: null,
        community_trust_score: null,
        content_type: 'general',
        rating_count: 0,
        average_rating: null,
        spam_reports_count: 0,
        misleading_reports_count: 0,
        scam_reports_count: 0,
        last_updated: null
      }
    }
  })

  return new Response(
    JSON.stringify({ results, count: results.length }),
    {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
      }
    }
  )
}

async function handleGetDomainInfo(req: Request, supabase: any) {
  const url = new URL(req.url)
  const domain = url.searchParams.get('domain')

  if (!domain) {
    return new Response(
      JSON.stringify({ error: 'Domain parameter is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get domain cache info
  const { data: domainData, error: domainError } = await supabase
    .from('domain_cache')
    .select('*')
    .eq('domain', domain)
    .single()

  // Get content type rules for this domain
  const { data: contentRules, error: rulesError } = await supabase
    .from('content_type_rules')
    .select('*')
    .eq('domain', domain)
    .eq('is_active', true)

  // Get blacklist status
  const { data: blacklistData, error: blacklistError } = await supabase
    .from('domain_blacklist')
    .select('*')
    .or(`domain_pattern.eq.${domain},domain_pattern.like.*.${domain}`)
    .eq('is_active', true)

  return new Response(
    JSON.stringify({
      domain,
      domain_cache: domainData || null,
      content_rules: contentRules || [],
      blacklist_entries: blacklistData || [],
      errors: {
        domain_error: domainError?.message || null,
        rules_error: rulesError?.message || null,
        blacklist_error: blacklistError?.message || null
      }
    }),
    {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600, stale-while-revalidate=1200'
      }
    }
  )
}

async function handleGetContentTypes(req: Request, supabase: any) {
  const { data, error } = await supabase
    .from('content_type_rules')
    .select('domain, content_type, trust_score_modifier, description')
    .eq('is_active', true)
    .order('domain')

  if (error) {
    throw new Error(`Error fetching content types: ${error.message}`)
  }

  // Group by domain
  const grouped = data?.reduce((acc: Record<string, any[]>, rule: any) => {
    if (!acc[rule.domain]) {
      acc[rule.domain] = []
    }
    acc[rule.domain].push({
      content_type: rule.content_type,
      trust_score_modifier: rule.trust_score_modifier,
      description: rule.description
    })
    return acc
  }, {})

  return new Response(
    JSON.stringify({ content_type_rules: grouped || {} }),
    {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200'
      }
    }
  )
}