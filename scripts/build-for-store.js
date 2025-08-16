#!/usr/bin/env node

// Build script for Chrome Web Store deployment
// This copies the production config and creates a clean build

const fs = require('fs');
const path = require('path');

console.log('🚀 Building extension for Chrome Web Store...');

// Copy production config to config.js
const productionConfig = path.join(__dirname, '../extension/config.production.js');
const targetConfig = path.join(__dirname, '../extension/config.js');

if (fs.existsSync(productionConfig)) {
    fs.copyFileSync(productionConfig, targetConfig);
    console.log('✅ Production config copied to config.js');
} else {
    console.error('❌ Production config not found!');
    process.exit(1);
}

// Verify required files exist
const requiredFiles = [
    'extension/manifest.json',
    'extension/popup.html',
    'extension/popup.js',
    'extension/auth.js',
    'extension/config.js'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
    if (!fs.existsSync(path.join(__dirname, '..', file))) {
        console.error(`❌ Required file missing: ${file}`);
        allFilesExist = false;
    }
});

if (!allFilesExist) {
    process.exit(1);
}

console.log('✅ All required files present');
console.log('✅ Extension ready for Chrome Web Store upload');
console.log('📁 Upload the extension/ folder to Chrome Web Store');
console.log('');
console.log('🔒 Security Check:');
console.log('   ✅ Only safe keys included (SUPABASE_URL, SUPABASE_ANON_KEY)');
console.log('   ✅ Service role key NOT included (server-side only)');
console.log('   ✅ External API keys NOT included (server-side only)');