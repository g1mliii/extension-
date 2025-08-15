// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify API key for security (prevent unauthorized aggregation calls)
    const apiKey = req.headers.get('apikey') || req.headers.get('Authorization')?.replace('Bearer ', '')
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify it's a valid Supabase key (anon or service role)
    if (apiKey !== Deno.env.get('SUPABASE_ANON_KEY') && apiKey !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    // Use service role key for full database access
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get all unprocessed ratings
    const { data: unprocessedRatings, error: ratingsError } = await supabase
      .from('ratings')
      .select('url_hash, rating, is_spam, is_misleading, is_scam')
      .eq('processed', false)

    if (ratingsError) {
      throw new Error(`Error fetching unprocessed ratings: ${ratingsError.message}`)
    }

    if (!unprocessedRatings || unprocessedRatings.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No unprocessed ratings found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group ratings by URL hash
    const urlGroups = unprocessedRatings.reduce((acc, rating) => {
      if (!acc[rating.url_hash]) {
        acc[rating.url_hash] = []
      }
      acc[rating.url_hash].push(rating)
      return acc
    }, {} as Record<string, any[]>)

    let processedCount = 0

    // Process each URL group
    for (const [urlHash, ratings] of Object.entries(urlGroups)) {
      // Get existing stats or create new ones
      const { data: existingStats } = await supabase
        .from('url_stats')
        .select('*')
        .eq('url_hash', urlHash)
        .single()

      // Get all ratings for this URL (including already processed ones)
      const { data: allRatings, error: allRatingsError } = await supabase
        .from('ratings')
        .select('rating, is_spam, is_misleading, is_scam')
        .eq('url_hash', urlHash)

      if (allRatingsError) {
        console.error(`Error fetching all ratings for ${urlHash}:`, allRatingsError)
        continue
      }

      // Calculate aggregated stats
      const totalRatings = allRatings.length
      const averageRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / totalRatings
      const spamCount = allRatings.filter(r => r.is_spam).length
      const misleadingCount = allRatings.filter(r => r.is_misleading).length
      const scamCount = allRatings.filter(r => r.is_scam).length

      // Calculate trust score (0-100)
      // Base score from average rating (1-5 scale converted to 0-100)
      let trustScore = ((averageRating - 1) / 4) * 100

      // Apply penalties for flags
      const spamPenalty = (spamCount / totalRatings) * 30
      const misleadingPenalty = (misleadingCount / totalRatings) * 25
      const scamPenalty = (scamCount / totalRatings) * 40

      trustScore = Math.max(0, trustScore - spamPenalty - misleadingPenalty - scamPenalty)

      // Upsert url_stats
      const { error: upsertError } = await supabase
        .from('url_stats')
        .upsert({
          url_hash: urlHash,
          trust_score: Math.round(trustScore * 100) / 100, // Round to 2 decimal places
          rating_count: totalRatings,
          spam_reports_count: spamCount,
          misleading_reports_count: misleadingCount,
          scam_reports_count: scamCount,
          last_updated: new Date().toISOString()
        })

      if (upsertError) {
        console.error(`Error upserting stats for ${urlHash}:`, upsertError)
        continue
      }

      processedCount++
    }

    // Mark all processed ratings as processed
    const { error: updateError } = await supabase
      .from('ratings')
      .update({ processed: true })
      .eq('processed', false)

    if (updateError) {
      console.error('Error marking ratings as processed:', updateError)
    }

    return new Response(
      JSON.stringify({
        message: `Successfully processed ${processedCount} URL groups`,
        processedRatings: unprocessedRatings.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Aggregation error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})