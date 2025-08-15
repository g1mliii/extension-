// Trust Algorithm Administration API
// Manages blacklists, configuration, and manual domain analysis

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

  // Call the domain analyzer function
  const response = await fetch(`${supabaseUrl}/functions/v1/domain-analyzer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`
    },
    body: JSON.stringify({ domain, force })
  })

  if (!response.ok) {
    throw new Error(`Domain analysis failed: ${response.statusText}`)
  }

  const result = await response.json()

  return new Response(
    JSON.stringify(result),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}