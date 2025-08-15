// Batch Domain Analysis Edge Function
// Analyzes multiple domains from url_stats that need cache refresh

// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    const body = await req.json().catch(() => ({}))
    const { limit = 10 } = body

    // Get domains that need analysis (no cache or expired cache)
    const { data: domainsToAnalyze, error: domainsError } = await supabase
      .from('url_stats')
      .select('domain')
      .not('domain', 'is', null)
      .not('domain', 'eq', 'unknown')
      .limit(limit)

    if (domainsError) {
      throw new Error(`Error fetching domains: ${domainsError.message}`)
    }

    if (!domainsToAnalyze || domainsToAnalyze.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No domains need analysis' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Filter out domains that already have recent cache
    const uniqueDomains = [...new Set(domainsToAnalyze.map(d => d.domain))]
    const domainsNeedingAnalysis: string[] = []

    for (const domain of uniqueDomains) {
      const { data: cachedData } = await supabase
        .from('domain_cache')
        .select('cache_expires_at')
        .eq('domain', domain)
        .gt('cache_expires_at', new Date().toISOString())
        .single()

      if (!cachedData) {
        domainsNeedingAnalysis.push(domain)
      }
    }

    if (domainsNeedingAnalysis.length === 0) {
      return new Response(
        JSON.stringify({ message: 'All domains have recent cache' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Analyze domains in parallel (with concurrency limit)
    const results = []
    const concurrencyLimit = 3 // Analyze 3 domains at once to avoid rate limits

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
        await new Promise(resolve => setTimeout(resolve, 1000))
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
        results: results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Batch domain analysis error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function analyzeSingleDomain(domain: string, supabase: any) {
  try {
    // Call the domain-analyzer function
    const response = await fetch(`${supabaseUrl}/functions/v1/domain-analyzer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ domain })
    })

    if (!response.ok) {
      throw new Error(`Domain analysis failed for ${domain}: ${response.statusText}`)
    }

    const result = await response.json()
    return result.data

  } catch (error) {
    console.error(`Error analyzing domain ${domain}:`, error)
    throw error
  }
}