// Test Script for API Functionality After Security Fixes
// Run this after applying the security fix migrations

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

async function testApiEndpoints() {
    console.log('🧪 Testing API endpoints after security fixes...\n');
    
    // Test 1: GET /url-stats (unauthenticated)
    console.log('1️⃣ Testing GET /url-stats (unauthenticated)');
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/url-trust-api/url-stats?url=https://example.com`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`   Status: ${response.status}`);
        if (response.ok) {
            const data = await response.json();
            console.log('   ✅ Success - URL stats retrieved');
            console.log(`   Trust Score: ${data.final_trust_score || data.trust_score}`);
            console.log(`   Data Source: ${data.data_source || 'unknown'}`);
        } else {
            const error = await response.text();
            console.log(`   ❌ Failed: ${error}`);
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
    
    // Test 2: Domain cache access (this was causing 406 errors)
    console.log('2️⃣ Testing domain cache access');
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/domain_cache?select=domain,cache_expires_at&limit=1`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`   Status: ${response.status}`);
        if (response.ok) {
            const data = await response.json();
            console.log('   ✅ Success - Domain cache accessible');
            console.log(`   Domains in cache: ${data.length}`);
        } else {
            const error = await response.text();
            console.log(`   ❌ Failed: ${error}`);
            if (response.status === 406) {
                console.log('   ⚠️  406 error still occurring - RLS policy issue');
            }
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
    
    // Test 3: URL stats table access
    console.log('3️⃣ Testing URL stats table access');
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/url_stats?select=domain,trust_score,rating_count&limit=1`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`   Status: ${response.status}`);
        if (response.ok) {
            const data = await response.json();
            console.log('   ✅ Success - URL stats table accessible');
            console.log(`   URLs in database: ${data.length}`);
        } else {
            const error = await response.text();
            console.log(`   ❌ Failed: ${error}`);
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
    
    // Test 4: Views access (security definer issue)
    console.log('4️⃣ Testing views access (security definer fix)');
    const views = ['processing_status_summary', 'domain_cache_status', 'enhanced_trust_analytics', 'trust_algorithm_performance'];
    
    for (const view of views) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${view}?limit=1`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                console.log(`   ✅ ${view}: Accessible`);
            } else {
                console.log(`   ❌ ${view}: Failed (${response.status})`);
            }
        } catch (error) {
            console.log(`   ❌ ${view}: Error - ${error.message}`);
        }
    }
    
    console.log('');
    console.log('🏁 API testing complete!');
    console.log('');
    console.log('📋 Summary:');
    console.log('- If all tests show ✅, security fixes are working correctly');
    console.log('- If you see 406 errors, RLS policies may need further adjustment');
    console.log('- If views are inaccessible, security definer issues may persist');
    console.log('');
    console.log('Next steps:');
    console.log('1. Check Supabase security linter for remaining warnings');
    console.log('2. Test the browser extension functionality');
    console.log('3. Monitor for any 406/403 errors in production');
}

// Instructions for running this test
console.log('🔧 API Test Setup Instructions:');
console.log('1. Replace YOUR_SUPABASE_URL with your actual Supabase URL');
console.log('2. Replace YOUR_SUPABASE_ANON_KEY with your actual anon key');
console.log('3. Run: node test_api_after_security_fixes.js');
console.log('');

// Uncomment the line below to run the test (after setting up the variables)
// testApiEndpoints();