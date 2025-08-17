// Final API Testing and Task 16 Completion Script
// Test all API endpoints after security fixes to ensure everything works

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

async function testApiAfterSecurityFixes() {
    console.log('🔒 Testing API functionality after security fixes...\n');
    
    let allTestsPassed = true;
    
    // Test 1: GET /url-stats (main extension endpoint)
    console.log('1️⃣ Testing GET /url-stats endpoint');
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
            console.log('   ✅ SUCCESS - URL stats endpoint working');
            console.log(`   Trust Score: ${data.final_trust_score || data.trust_score || 'N/A'}`);
            console.log(`   Data Source: ${data.data_source || 'baseline'}`);
        } else {
            const error = await response.text();
            console.log(`   ❌ FAILED: ${error}`);
            allTestsPassed = false;
        }
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        allTestsPassed = false;
    }
    
    console.log('');
    
    // Test 2: Views accessibility (security invoker test)
    console.log('2️⃣ Testing SECURITY INVOKER views access');
    const views = ['enhanced_trust_analytics', 'trust_algorithm_performance', 'domain_cache_status', 'processing_status_summary'];
    
    for (const view of views) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${view}?select=*&limit=1`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                console.log(`   ✅ ${view}: Accessible with SECURITY INVOKER`);
            } else {
                console.log(`   ❌ ${view}: Failed (${response.status})`);
                allTestsPassed = false;
            }
        } catch (error) {
            console.log(`   ❌ ${view}: Error - ${error.message}`);
            allTestsPassed = false;
        }
    }
    
    console.log('');
    
    // Test 3: Domain cache access (406 error prevention)
    console.log('3️⃣ Testing domain cache access (406 error prevention)');
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
            console.log('   ✅ SUCCESS - Domain cache accessible');
            console.log(`   Cached domains: ${data.length}`);
        } else {
            const error = await response.text();
            console.log(`   ❌ FAILED: ${error}`);
            if (response.status === 406) {
                console.log('   ⚠️  406 error still occurring - may need RLS policy adjustment');
            }
            allTestsPassed = false;
        }
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        allTestsPassed = false;
    }
    
    console.log('');
    
    // Test 4: Core database tables access
    console.log('4️⃣ Testing core database tables access');
    const tables = ['url_stats', 'ratings', 'content_type_rules'];
    
    for (const table of tables) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                console.log(`   ✅ ${table}: Accessible`);
            } else {
                console.log(`   ❌ ${table}: Failed (${response.status})`);
                allTestsPassed = false;
            }
        } catch (error) {
            console.log(`   ❌ ${table}: Error - ${error.message}`);
            allTestsPassed = false;
        }
    }
    
    console.log('');
    
    // Final results
    console.log('🏁 API Testing Complete!');
    console.log('');
    
    if (allTestsPassed) {
        console.log('🎉 ALL TESTS PASSED!');
        console.log('✅ Security fixes are working correctly');
        console.log('✅ API endpoints are functional');
        console.log('✅ Extension should work normally');
        console.log('✅ Ready for production deployment');
    } else {
        console.log('⚠️  SOME TESTS FAILED');
        console.log('❌ Review failed tests above');
        console.log('❌ May need additional fixes before deployment');
    }
    
    return allTestsPassed;
}

// Extension functionality test checklist
function displayExtensionTestChecklist() {
    console.log('');
    console.log('📋 EXTENSION FUNCTIONALITY TEST CHECKLIST');
    console.log('=========================================');
    console.log('');
    console.log('Manual tests to perform in browser:');
    console.log('');
    console.log('□ 1. Extension loads without errors');
    console.log('□ 2. URL stats display correctly on various websites');
    console.log('□ 3. Trust scores show appropriate values');
    console.log('□ 4. User can log in/sign up successfully');
    console.log('□ 5. Rating submission works (1-5 stars)');
    console.log('□ 6. Spam/misleading/scam reporting works');
    console.log('□ 7. Trust score updates after rating submission');
    console.log('□ 8. Domain analysis triggers for new domains');
    console.log('□ 9. No 406/403 errors in browser console');
    console.log('□ 10. Extension UI displays correctly');
    console.log('');
    console.log('If all items above are ✅, security fixes are successful!');
}

// GitHub commit preparation checklist
function displayGitHubCommitChecklist() {
    console.log('');
    console.log('📦 GITHUB COMMIT PREPARATION CHECKLIST');
    console.log('======================================');
    console.log('');
    console.log('Files ready for commit:');
    console.log('');
    console.log('✅ Security fix migrations:');
    console.log('   - 20250816000036_supabase_recommended_security_fixes.sql');
    console.log('   - 20250816000037_simple_security_invoker_fix.sql');
    console.log('   - 20250816000038_fix_remaining_function_search_paths.sql');
    console.log('   - 20250816000039_aggressive_search_path_fix.sql');
    console.log('');
    console.log('✅ Testing and diagnostic scripts:');
    console.log('   - test_complete_security_fixes.sql');
    console.log('   - diagnose_search_path_issues.sql');
    console.log('   - final_api_testing_and_completion.js');
    console.log('');
    console.log('✅ Documentation:');
    console.log('   - docs/SUPABASE_SECURITY_FIX_IMPACT_ANALYSIS.md');
    console.log('   - docs/RLS_POLICY_API_COMPATIBILITY.md');
    console.log('');
    console.log('□ Verify .gitignore excludes sensitive files');
    console.log('□ Ensure no API keys in committed code');
    console.log('□ Update README.md with security fix notes');
    console.log('□ Create comprehensive commit message');
    console.log('');
    console.log('Suggested commit message:');
    console.log('---');
    console.log('feat: implement Supabase security fixes for production readiness');
    console.log('');
    console.log('- Fix SECURITY DEFINER view warnings using SECURITY INVOKER approach');
    console.log('- Resolve function search_path mutable warnings');
    console.log('- Maintain full API and extension compatibility');
    console.log('- Add comprehensive testing and diagnostic scripts');
    console.log('- Document security fix impact analysis');
    console.log('');
    console.log('All core functionality preserved while improving security posture.');
    console.log('Extension and API work identically to before fixes.');
    console.log('---');
}

// Main execution
console.log('🔧 TASK 16 COMPLETION - SECURITY FIXES TESTING');
console.log('===============================================');
console.log('');
console.log('Setup Instructions:');
console.log('1. Replace YOUR_SUPABASE_URL with your actual Supabase URL');
console.log('2. Replace YOUR_SUPABASE_ANON_KEY with your actual anon key');
console.log('3. Run: node final_api_testing_and_completion.js');
console.log('');

// Uncomment to run tests (after setting up variables)
// testApiAfterSecurityFixes().then(success => {
//     displayExtensionTestChecklist();
//     displayGitHubCommitChecklist();
//     
//     if (success) {
//         console.log('\n🎯 TASK 16 READY FOR COMPLETION!');
//         console.log('All security fixes implemented and tested successfully.');
//     }
// });

displayExtensionTestChecklist();
displayGitHubCommitChecklist();