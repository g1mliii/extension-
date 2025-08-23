// rating-extension/popup.js (REVISED)

import { supabase, initSupabase, signIn, signUp, signOut, getSession, getUser, resendConfirmation, resetPassword } from './auth.js';
import { CONFIG } from './config.js';

// --- DOM Elements ---
const authSection = document.getElementById('auth-section');
const authStatusDiv = document.getElementById('auth-status');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const forgotPasswordBtn = document.getElementById('forgot-password-btn');
const resendBtn = document.getElementById('resend-btn');
const refreshStatsBtn = document.getElementById('refresh-stats-btn');
const logoutBtn = document.getElementById('logout-btn');

const ratingSection = document.getElementById('rating-section');
const currentUrlSpan = document.getElementById('current-url');
const trustScoreSpan = document.getElementById('trust-score'); // Changed from avgRatingSpan
const totalRatingsSpan = document.getElementById('total-ratings');
const spamCountSpan = document.getElementById('spam-count'); // New
const misleadingCountSpan = document.getElementById('misleading-count'); // New
const scamCountSpan = document.getElementById('scam-count'); // New

const ratingScoreSelect = document.getElementById('rating-score');
const isSpamCheckbox = document.getElementById('is-spam'); // New
const isMisleadingCheckbox = document.getElementById('is-misleading'); // New
const isScamCheckbox = document.getElementById('is-scam'); // New
const submitRatingBtn = document.getElementById('submit-rating-btn');
// Message div removed

let currentUrl = ''; // To store the URL of the active tab

// --- Utility Function to Display Messages ---
function showMessage(text, type = 'info') {
    console.log(`${type.toUpperCase()}: ${text}`);

    const messageBar = document.getElementById('message-bar');
    const messageContent = document.getElementById('message-content');
    const messageClose = document.getElementById('message-close');

    if (!messageBar || !messageContent) {
        console.warn('Message bar elements not found');
        return;
    }

    // If same message is already showing, don't spam
    if (messageContent.textContent === text && messageBar.classList.contains('show')) {
        console.log('Same message already showing, skipping duplicate');
        return;
    }

    // Clear existing classes and hide
    messageBar.className = 'message-bar hidden';

    // Set content and type
    messageContent.textContent = text;

    // Add type class and show
    setTimeout(() => {
        messageBar.className = `message-bar ${type} show`;
    }, 10);

    // Auto-hide after delay (longer for errors, shorter for success)
    const hideDelay = type === 'error' ? 6000 : type === 'success' ? 4000 : 3000;

    // Clear any existing timeout
    if (window.messageTimeout) {
        clearTimeout(window.messageTimeout);
    }

    window.messageTimeout = setTimeout(() => {
        hideMessage();
    }, hideDelay);
}

function hideMessage() {
    const messageBar = document.getElementById('message-bar');
    if (messageBar) {
        messageBar.classList.remove('show');
        setTimeout(() => {
            messageBar.classList.add('hidden');
        }, 400); // Match CSS transition duration
    }

    if (window.messageTimeout) {
        clearTimeout(window.messageTimeout);
        window.messageTimeout = null;
    }
}

// --- Helper Functions for Stats Display ---
function updateStatsDisplay(data) {
    if (!data) {
        clearStatsDisplay();
        return;
    }

    // Use final_trust_score first, then trust_score, handle both number and null values
    let trustScore = data.final_trust_score !== null && data.final_trust_score !== undefined
        ? data.final_trust_score
        : data.trust_score;

    // If no score available, calculate domain baseline score
    if (trustScore === null || trustScore === undefined) {
        trustScore = calculateDomainBaseline(data.domain);
    }

    // Update the circular progress score
    trustScoreSpan.textContent = `${trustScore.toFixed(0)}%`;
    updateScoreBar(trustScore);

    totalRatingsSpan.textContent = data.rating_count || '0';
    spamCountSpan.textContent = data.spam_reports_count || '0';
    misleadingCountSpan.textContent = data.misleading_reports_count || '0';
    scamCountSpan.textContent = data.scam_reports_count || '0';

    // Add data source indicator (subtle)
    if (data.data_source) {
        const sourceIndicator = data.data_source === 'baseline' ? '(estimated)' :
            data.data_source === 'domain' ? '(domain)' : '';
        if (sourceIndicator) {
            trustScoreSpan.title = `Trust score ${sourceIndicator}`;
        }
    }
}

function updateScoreBar(score) {
    const progressRing = document.getElementById('progress-ring');

    if (progressRing) {
        // Convert score (0-100) to percentage
        const percentage = Math.max(0, Math.min(100, score));

        // Calculate the circumference of the circle (2 * π * radius)
        // Must match the SVG circle radius (r="45" in popup.html)
        const radius = 45;
        const circumference = 2 * Math.PI * radius;

        // Calculate the stroke-dashoffset based on percentage
        // For 0%, offset = circumference (no fill)
        // For 100%, offset = 0 (full fill)
        const offset = circumference - (percentage / 100) * circumference;

        // Determine color based on score
        let strokeColor;
        if (score >= 80) {
            strokeColor = '#34D399'; // Green for excellent
        } else if (score >= 60) {
            strokeColor = '#93C5FD'; // Blue for good
        } else if (score >= 40) {
            strokeColor = '#FBBF24'; // Yellow for fair
        } else if (score > 0) {
            strokeColor = '#F87171'; // Red for poor
        } else {
            strokeColor = 'rgba(255, 255, 255, 0.2)'; // Gray for unknown
        }

        // Update the progress ring
        progressRing.style.strokeDasharray = circumference;
        progressRing.style.strokeDashoffset = offset;
        progressRing.style.stroke = strokeColor;

        // Add a subtle glow effect based on score
        if (score > 0) {
            progressRing.style.filter = `drop-shadow(0 0 8px ${strokeColor}80)`;
        } else {
            progressRing.style.filter = 'none';
        }
    }
}

function calculateDomainBaseline(domain) {
    // Domain-specific baseline scores based on reputation
    const domainBaselines = {
        // High trust domains (70-85)
        'google.com': 85, 'youtube.com': 75, 'wikipedia.org': 85,
        'github.com': 80, 'stackoverflow.com': 82, 'microsoft.com': 78,
        'apple.com': 80, 'amazon.com': 72, 'netflix.com': 75,

        // Educational domains (75-85)
        'mit.edu': 85, 'stanford.edu': 85, 'harvard.edu': 85,
        'coursera.org': 78, 'khanacademy.org': 80,

        // News domains (65-80)
        'cnn.com': 70, 'bbc.com': 78, 'reuters.com': 80,
        'nytimes.com': 75, 'npr.org': 78,

        // Social media (55-65)
        'facebook.com': 60, 'twitter.com': 58, 'x.com': 58,
        'instagram.com': 62, 'linkedin.com': 68, 'reddit.com': 65,
        'tiktok.com': 55,

        // E-commerce (60-70)
        'ebay.com': 65, 'etsy.com': 68, 'paypal.com': 75
    };

    if (domain && domainBaselines[domain]) {
        return domainBaselines[domain];
    }

    // Default baseline based on TLD
    if (domain) {
        if (domain.endsWith('.edu') || domain.endsWith('.gov')) return 75;
        if (domain.endsWith('.org')) return 65;
        if (domain.endsWith('.com') || domain.endsWith('.net')) return 60;
    }

    return 50; // Ultimate fallback
}

function clearStatsDisplay() {
    const domain = extractDomainFromCurrentUrl();
    const baselineScore = calculateDomainBaseline(domain);

    trustScoreSpan.textContent = `${baselineScore}%`;
    totalRatingsSpan.textContent = '0';
    spamCountSpan.textContent = '0';
    misleadingCountSpan.textContent = '0';
    scamCountSpan.textContent = '0';
    updateScoreBar(baselineScore);
}

function extractDomainFromCurrentUrl() {
    if (currentUrl) {
        try {
            const url = new URL(currentUrl);
            return url.hostname.replace(/^www\./, '');
        } catch (e) {
            return null;
        }
    }
    return null;
}

// Batch processing for multiple URL requests
async function fetchUrlStatsBatched(url) {
    return new Promise((resolve, reject) => {
        batchQueue.add({ url, resolve, reject });

        // Clear existing timeout and set new one
        if (batchTimeout) {
            clearTimeout(batchTimeout);
        }

        batchTimeout = setTimeout(async () => {
            const requests = Array.from(batchQueue);
            batchQueue.clear();

            if (requests.length === 1) {
                // Single request - use normal endpoint
                const { url, resolve, reject } = requests[0];
                try {
                    await fetchUrlStatsSingle(url);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            } else {
                // Multiple requests - use batch endpoint (future feature)
                // For now, process individually but with slight delay
                for (const { url, resolve, reject } of requests) {
                    try {
                        await fetchUrlStatsSingle(url);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                    // Small delay to avoid overwhelming the API
                    await new Promise(r => setTimeout(r, 50));
                }
            }
        }, BATCH_DELAY_MS);
    });
}

// Single URL fetch (extracted from main function)
async function fetchUrlStatsSingle(url) {
    showMessage('Loading trust score...', 'info');

    let session = null;
    try {
        const result = await getSession();
        session = result.session;
    } catch (error) {
        console.log('Session check completed (proceeding as anonymous)');
        session = null;
    }
    const anonKey = CONFIG.SUPABASE_ANON_KEY;

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'apikey': anonKey
    };

    // Only add Authorization header if user is logged in
    if (session && session.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    } else {
        // For unauthenticated requests, use anon key in Authorization header
        headers['Authorization'] = `Bearer ${anonKey}`;
    }

    const requestId = generateRequestId();

    console.log('Batch fetch request:', {
        requestId,
        url: `${API_BASE_URL}/url-stats?url=${encodeURIComponent(url)}`,
        authenticated: !!session
    });

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
        const response = await fetch(`${API_BASE_URL}/url-stats?url=${encodeURIComponent(url)}`, {
            headers: {
                ...headers,
                'X-Request-ID': requestId
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                error: 'Network error',
                code: 'NetworkError',
                timestamp: new Date().toISOString()
            }));

            // Handle standardized error responses from unified API
            const errorMsg = errorData.error || `HTTP ${response.status}`;
            const errorCode = errorData.code || 'UnknownError';

            console.error('API Error (Batch):', {
                status: response.status,
                error: errorMsg,
                code: errorCode,
                timestamp: errorData.timestamp,
                url: url,
                requestId
            });

            // Handle 406 errors specifically - don't fail the request
            if (response.status === 406) {
                console.warn('406 Not Acceptable in batch request - using fallback');
                clearStatsDisplay();
                showMessage('Loading trust score...', 'info');
                return; // Don't throw error for 406
            }

            // Provide user-friendly error messages based on error codes
            let userMessage = `Failed to fetch trust score: ${errorMsg}`;
            if (errorCode === 'ValidationError') {
                userMessage = 'Invalid URL format. Please try a different URL.';
            } else if (errorCode === 'AuthError') {
                userMessage = 'Authentication issue. Please try refreshing the page.';
            } else if (errorCode === 'RateLimitError') {
                userMessage = 'Too many requests. Please wait a moment and try again.';
            } else if (errorCode === 'DatabaseError') {
                userMessage = 'Database temporarily unavailable. Please try again later.';
            }

            showMessage(userMessage, 'error');
            clearStatsDisplay();
            throw new Error(errorMsg);
        }

        const data = await response.json();

        console.log('Batch request successful:', {
            requestId,
            status: response.status,
            dataSource: data.data_source,
            cacheStatus: data.cache_status,
            trustScore: data.final_trust_score || data.trust_score,
            ratingCount: data.rating_count
        });

        // Cache the response
        const cacheData = {
            data: data,
            timestamp: Date.now()
        };
        statsCache.set(url, cacheData);
        saveCacheToStorage(url, cacheData);

        updateStatsDisplay(data);
        showMessage('Trust score loaded successfully.', 'success');
    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            showMessage('Request timed out. Please try again.', 'error');
            clearStatsDisplay();
            throw new Error('Request timeout');
        }
        throw error;
    }
}

// --- UI State Management ---
function updateUI(session) {
    const header = document.getElementById('main-header');
    const authSection = document.getElementById('auth-section');
    const headerLogin = document.getElementById('header-login');

    if (session) {
        // User is logged in - Hide login form, show rating section
        if (header) header.className = 'header logged-in';
        if (authSection) authSection.className = 'hidden';
        if (headerLogin) headerLogin.style.display = 'none';
        if (ratingSection) ratingSection.style.display = 'block';

        // Show user info in rating section
        if (authStatusDiv) {
            authStatusDiv.textContent = `✓ Logged in as: ${session.user.email}`;
            authStatusDiv.style.display = 'block';
            authStatusDiv.style.color = 'rgba(255, 255, 255, 0.8)';
            authStatusDiv.style.fontSize = '0.9em';
            authStatusDiv.style.marginBottom = '10px';
        }
        if (logoutBtn) logoutBtn.style.display = 'inline-block';

        // Enable rating form
        if (ratingScoreSelect) ratingScoreSelect.disabled = false;
        if (isSpamCheckbox) isSpamCheckbox.disabled = false;
        if (isMisleadingCheckbox) isMisleadingCheckbox.disabled = false;
        if (isScamCheckbox) isScamCheckbox.disabled = false;
        if (submitRatingBtn) {
            submitRatingBtn.disabled = false;
            submitRatingBtn.textContent = 'Submit Rating';
        }

        // Message clearing removed
    } else {
        // User is not logged in - show login form, hide rating section
        if (header) header.className = 'header logged-out';
        if (headerLogin) headerLogin.style.display = 'flex';
        if (authSection) authSection.style.display = 'block';
        if (ratingSection) ratingSection.style.display = 'none';

        if (authStatusDiv) {
            authStatusDiv.textContent = 'Login or sign up to submit ratings';
            authStatusDiv.style.color = 'rgba(255, 255, 255, 0.6)';
            authStatusDiv.style.fontSize = '1em';
        }
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

// --- Authentication Handlers ---
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) {
        showMessage('Email and password are required.', 'error');
        return;
    }

    // Disable buttons and show loading
    loginBtn.disabled = true;
    signupBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    showMessage('Logging in...', 'info');

    try {
        const { user, session, error } = await signIn(email, password);
        if (error) {
            if (error.message.includes('Email not confirmed')) {
                showMessage('Please check your email and click the confirmation link before logging in.', 'error');
                resendBtn.style.display = 'inline-block';
            } else {
                showMessage(`Login failed: ${error.message}`, 'error');
            }
            console.error('Login error:', error);
        } else {
            showMessage('Login successful!', 'success');
            resendBtn.style.display = 'none'; // Hide resend button on successful login
            updateUI(session);
            // Don't call fetchCurrentUrlAndStats here - auth state change will handle it
        }
    } finally {
        // Re-enable buttons
        loginBtn.disabled = false;
        signupBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
});

signupBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) {
        showMessage('Email and password are required.', 'error');
        return;
    }

    // Disable buttons and show loading
    loginBtn.disabled = true;
    signupBtn.disabled = true;
    signupBtn.textContent = 'Creating account...';
    showMessage('Creating your account...', 'info');

    try {
        const { user, session, error } = await signUp(email, password);
        if (error) {
            showMessage(`Sign up failed: ${error.message}`, 'error');
            console.error('Sign up error:', error);
        } else {
            if (session) {
                // User is immediately logged in (email already confirmed)
                showMessage('Account created and logged in successfully!', 'success');
                updateUI(session);
                // Don't call fetchCurrentUrlAndStats here - auth state change will handle it
            } else {
                // Email confirmation required
                showMessage('Account created! Check your email for a confirmation link. After clicking it, return here to log in.', 'success');
                // Show resend button
                resendBtn.style.display = 'inline-block';
                // Clear the password field for security
                passwordInput.value = '';
            }
        }
    } finally {
        // Re-enable buttons
        loginBtn.disabled = false;
        signupBtn.disabled = false;
        signupBtn.textContent = 'Sign Up';
    }
});

resendBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    if (!email) {
        showMessage('Please enter your email address.', 'error');
        return;
    }

    resendBtn.disabled = true;
    resendBtn.textContent = 'Sending...';

    try {
        const { error } = await resendConfirmation(email);
        if (error) {
            showMessage(`Failed to resend: ${error.message}`, 'error');
        } else {
            showMessage('Confirmation email sent! Please check your inbox.', 'success');
        }
    } finally {
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend Confirmation Email';
    }
});

forgotPasswordBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    if (!email) {
        showMessage('Please enter your email address first.', 'error');
        return;
    }

    forgotPasswordBtn.disabled = true;
    forgotPasswordBtn.textContent = 'Sending...';

    try {
        const { error } = await resetPassword(email);
        if (error) {
            showMessage(`Failed to send reset email: ${error.message}`, 'error');
        } else {
            showMessage('Password reset email sent! Check your inbox.', 'success');
        }
    } finally {
        forgotPasswordBtn.disabled = false;
        forgotPasswordBtn.textContent = 'Forgot Password?';
    }
});

// Cooldown tracking for refresh button
let lastRefreshTime = 0;
let cooldownTimer = null;
const REFRESH_COOLDOWN_MS = 10000; // 10 seconds cooldown

// Smart caching to reduce API calls
let statsCache = new Map(); // url -> {data, timestamp}
const STATS_CACHE_DURATION_MS = 300000; // 5 minutes cache (matches aggregation frequency)
const LOCALSTORAGE_PREFIX = 'urlrater_stats_';

// Load cache from localStorage on startup
function loadCacheFromStorage() {
    try {
        const keys = Object.keys(localStorage).filter(key => key.startsWith(LOCALSTORAGE_PREFIX));
        keys.forEach(key => {
            const data = JSON.parse(localStorage.getItem(key));
            const url = key.replace(LOCALSTORAGE_PREFIX, '');

            // Only load if not expired
            if (data && (Date.now() - data.timestamp) < STATS_CACHE_DURATION_MS) {
                statsCache.set(url, data);
            } else {
                // Clean up expired entries
                localStorage.removeItem(key);
            }
        });
        console.log(`Loaded ${statsCache.size} cached stats from localStorage`);
    } catch (error) {
        console.error('Error loading cache from localStorage:', error);
    }
}

// Save cache entry to localStorage
function saveCacheToStorage(url, cacheData) {
    try {
        localStorage.setItem(LOCALSTORAGE_PREFIX + url, JSON.stringify(cacheData));
    } catch (error) {
        console.error('Error saving cache to localStorage:', error);
        // If storage is full, clean up old entries
        cleanupOldCacheEntries();
    }
}

// Clean up old cache entries from localStorage
function cleanupOldCacheEntries() {
    try {
        const keys = Object.keys(localStorage).filter(key => key.startsWith(LOCALSTORAGE_PREFIX));
        const now = Date.now();

        keys.forEach(key => {
            const data = JSON.parse(localStorage.getItem(key));
            if (!data || (now - data.timestamp) > STATS_CACHE_DURATION_MS) {
                localStorage.removeItem(key);
            }
        });
    } catch (error) {
        console.error('Error cleaning up cache:', error);
    }
}

function startRefreshCooldown() {
    const startTime = Date.now();

    const updateCooldown = () => {
        const elapsed = Date.now() - startTime;
        const remaining = REFRESH_COOLDOWN_MS - elapsed;

        if (remaining <= 0) {
            refreshStatsBtn.disabled = false;
            refreshStatsBtn.textContent = '🔄 Refresh Stats';
            if (cooldownTimer) {
                clearInterval(cooldownTimer);
                cooldownTimer = null;
            }
            return;
        }

        const remainingSeconds = Math.ceil(remaining / 1000);
        refreshStatsBtn.textContent = `⏱️ Wait ${remainingSeconds}s`;
        refreshStatsBtn.disabled = true;
    };

    updateCooldown();
    cooldownTimer = setInterval(updateCooldown, 1000);
}

refreshStatsBtn.addEventListener('click', async () => {
    if (!currentUrl) {
        showMessage('No URL to refresh stats for.', 'error');
        return;
    }

    // Check if already in cooldown
    if (refreshStatsBtn.disabled && refreshStatsBtn.textContent.includes('Wait')) {
        showMessage('Refresh is on cooldown to prevent spam.', 'error');
        return;
    }

    // Check cooldown
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime;

    if (timeSinceLastRefresh < REFRESH_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((REFRESH_COOLDOWN_MS - timeSinceLastRefresh) / 1000);
        showMessage(`Please wait ${remainingSeconds} seconds before refreshing again.`, 'error');
        startRefreshCooldown();
        return;
    }

    refreshStatsBtn.disabled = true;
    refreshStatsBtn.textContent = '🔄 Refreshing...';
    lastRefreshTime = now;

    try {
        await fetchUrlStats(currentUrl, true); // Force refresh bypasses cache

        // Start cooldown after successful refresh
        startRefreshCooldown();
    } catch (error) {
        showMessage('Failed to refresh stats.', 'error');
        console.error('Refresh error:', error);

        // Still start cooldown even on error to prevent spam
        startRefreshCooldown();
    }
});

// Logout button event listeners removed

// --- API Interaction ---
const API_BASE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/url-trust-api`; // Unified API endpoint

// Batch request queue for efficiency
let batchQueue = new Set();
let batchTimeout = null;
const BATCH_DELAY_MS = 100; // Wait 100ms to collect multiple requests

// Request ID generation for debugging
function generateRequestId() {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function fetchUrlStats(url, forceRefresh = false) {
    // Prevent multiple simultaneous requests for the same URL
    if (isLoadingStats && !forceRefresh) {
        console.log('Already loading stats, skipping duplicate request');
        return;
    }

    isLoadingStats = true;

    try {
        // Check cache first (unless force refresh)
        if (!forceRefresh) {
            const cached = statsCache.get(url);
            if (cached && (Date.now() - cached.timestamp) < STATS_CACHE_DURATION_MS) {
                console.log('Using cached stats for', url);
                updateStatsDisplay(cached.data);
                showMessage('Trust score loaded successfully.', 'success');
                isLoadingStats = false;
                return;
            } else if (cached) {
                // Cache exists but is stale - remove it
                statsCache.delete(url);
                localStorage.removeItem(LOCALSTORAGE_PREFIX + url);
            }
        }

        // For single requests, use batch system for efficiency
        if (!forceRefresh) {
            const result = await fetchUrlStatsBatched(url);
            isLoadingStats = false;
            return result;
        }

        showMessage('Loading trust score...', 'info');

        // Get session with improved error handling
        let session = null;
        try {
            const result = await getSession();
            session = result.session;
        } catch (error) {
            console.log('Session check completed (proceeding as anonymous)');
            session = null;
        }

        const anonKey = CONFIG.SUPABASE_ANON_KEY;

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'apikey': anonKey
        };

        // Only add Authorization header if user is logged in
        if (session && session.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
        } else {
            // For unauthenticated requests, use anon key in Authorization header
            headers['Authorization'] = `Bearer ${anonKey}`;
        }

        const requestId = generateRequestId();

        console.log('Making fetch request:', {
            requestId,
            url: `${API_BASE_URL}/url-stats?url=${encodeURIComponent(url)}`,
            authenticated: !!session,
            headers: { ...headers, Authorization: '[REDACTED]' }
        });

        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await fetch(`${API_BASE_URL}/url-stats?url=${encodeURIComponent(url)}`, {
            headers: {
                ...headers,
                'X-Request-ID': requestId
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log('Response received:', {
            status: response.status,
            ok: response.ok,
            requestId
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                error: 'Network error',
                code: 'NetworkError',
                timestamp: new Date().toISOString()
            }));

            // Handle standardized error responses from unified API
            const errorMsg = errorData.error || `HTTP ${response.status}`;
            const errorCode = errorData.code || 'UnknownError';

            console.error('API Error:', {
                status: response.status,
                error: errorMsg,
                code: errorCode,
                timestamp: errorData.timestamp,
                url: url,
                requestId
            });

            // Handle 406 errors specifically
            if (response.status === 406) {
                console.warn('406 Not Acceptable - API may be processing request, retrying...');
                // Don't show error to user for 406, just log it and use fallback
                clearStatsDisplay();
                showMessage('Loading trust score...', 'info');
                return;
            }

            // Provide user-friendly error messages based on error codes
            let userMessage = `Failed to fetch trust score: ${errorMsg}`;
            if (errorCode === 'ValidationError') {
                userMessage = 'Invalid URL format. Please try a different URL.';
            } else if (errorCode === 'AuthError') {
                userMessage = 'Authentication issue. Please try refreshing the page.';
            } else if (errorCode === 'RateLimitError') {
                userMessage = 'Too many requests. Please wait a moment and try again.';
            } else if (errorCode === 'DatabaseError') {
                userMessage = 'Database temporarily unavailable. Please try again later.';
            }

            showMessage(userMessage, 'error');
            clearStatsDisplay();
            return;
        }

        const data = await response.json();
        console.log('Successful response:', {
            requestId,
            status: response.status,
            dataSource: data.data_source,
            cacheStatus: data.cache_status,
            trustScore: data.final_trust_score || data.trust_score,
            ratingCount: data.rating_count
        });

        // Cache the response
        const cacheData = {
            data: data,
            timestamp: Date.now()
        };
        statsCache.set(url, cacheData);
        saveCacheToStorage(url, cacheData);

        updateStatsDisplay(data);
        showMessage(forceRefresh ? 'Trust score refreshed!' : 'Trust score loaded successfully.', 'success');

        isLoadingStats = false;
    } catch (error) {
        console.error('Error fetching URL stats:', {
            error: error.message,
            stack: error.stack,
            url: url,
            timestamp: new Date().toISOString()
        });

        // Handle different types of network and runtime errors
        let userMessage = 'Failed to fetch trust score';

        if (error.name === 'AbortError') {
            userMessage = 'Request timed out. Please try again.';
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            userMessage = 'Network connection error. Please check your internet connection.';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            userMessage = 'Authentication error. Please try logging in again.';
        } else if (error.message.includes('429') || error.message.includes('rate limit')) {
            userMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
            userMessage = 'Server error. Please try again later.';
        } else if (error.message.includes('timeout')) {
            userMessage = 'Request timed out. Please try again.';
        } else {
            userMessage = `Network error: ${error.message}`;
        }

        showMessage(userMessage, 'error');
        clearStatsDisplay();
    } finally {
        isLoadingStats = false;
    }
}

submitRatingBtn.addEventListener('click', async () => {
    const score = parseInt(ratingScoreSelect.value);
    const isSpam = isSpamCheckbox.checked; // Get checkbox values
    const isMisleading = isMisleadingCheckbox.checked;
    const isScam = isScamCheckbox.checked;

    if (!currentUrl) {
        showMessage('Could not determine current URL. Please try again.', 'error');
        return;
    }
    if (isNaN(score) || score < 1 || score > 5) {
        showMessage('Please select a valid rating score (1-5).', 'error');
        return;
    }

    // Disable submit button and show loading state
    submitRatingBtn.disabled = true;
    submitRatingBtn.textContent = '⏳ Submitting...';

    showMessage('Submitting rating...', 'info');

    try {
        let session = null;
        try {
            const result = await getSession();
            session = result.session;
        } catch (error) {
            console.log('Session check completed for rating submission');
            session = null;
        }

        if (!session || !session.access_token) {
            showMessage('You must be logged in to submit a rating.', 'error');
            return;
        }

        const requestId = generateRequestId();

        console.log('Submitting rating:', {
            requestId,
            url: currentUrl,
            score: score,
            reports: { isSpam, isMisleading, isScam }
        });

        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        const response = await fetch(`${API_BASE_URL}/rating`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'apikey': CONFIG.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${session.access_token}`,
                'X-Request-ID': requestId
            },
            body: JSON.stringify({
                url: currentUrl,
                score: score,
                comment: null,
                isSpam: isSpam,
                isMisleading: isMisleading,
                isScam: isScam
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                error: 'Network error',
                code: 'NetworkError',
                timestamp: new Date().toISOString()
            }));

            // Handle standardized error responses from unified API
            const errorMsg = errorData.error || `HTTP ${response.status}`;
            const errorCode = errorData.code || 'UnknownError';

            console.error('Rating Submission Error:', {
                status: response.status,
                error: errorMsg,
                code: errorCode,
                timestamp: errorData.timestamp,
                url: currentUrl,
                requestId
            });

            // Handle 406 errors specifically for rating submission
            if (response.status === 406) {
                console.warn('406 Not Acceptable during rating submission - may still succeed');
                showMessage('Rating is being processed...', 'info');
                // Don't return error, let it continue to try to get response
                // The rating might still have been processed successfully
            } else {
                // Provide user-friendly error messages based on error codes
                let userMessage = `❌ Rating failed: ${errorMsg}`;
                if (errorCode === 'ValidationError') {
                    userMessage = '⚠️ Invalid rating data. Please check your inputs and try again.';
                } else if (errorCode === 'AuthError') {
                    userMessage = '🔐 Authentication expired. Please log in again to submit ratings.';
                } else if (errorCode === 'RateLimitError') {
                    userMessage = '⏱️ Too many rating submissions. Please wait before submitting another.';
                } else if (errorCode === 'DatabaseError') {
                    userMessage = '🔧 Database temporarily unavailable. Please try submitting again.';
                } else if (response.status === 409) {
                    userMessage = '⏰ You have already rated this URL recently. Please wait 24 hours before rating again.';
                }

                showMessage(userMessage, 'error');
                return;
            }
        }

        const data = await response.json();

        console.log('Rating submission successful:', {
            requestId,
            status: response.status,
            message: data.message,
            processing: data.processing
        });

        // Add success animation to the rating form
        const ratingForm = document.querySelector('.rating-form');
        if (ratingForm) {
            ratingForm.classList.add('success-animation');
            setTimeout(() => {
                ratingForm.classList.remove('success-animation');
            }, 600);
        }

        // Show prominent success message
        const successMessage = data.message || 'Rating submitted successfully!';
        showMessage(`✅ ${successMessage}`, 'success');

        // Update displayed stats with the latest from API response
        if (data.urlStats) {
            updateStatsDisplay(data.urlStats);

            // Domain analysis happens in background - no need to notify user

            // Invalidate cache since we have new data
            statsCache.delete(currentUrl);
            const cacheData = {
                data: data.urlStats,
                timestamp: Date.now()
            };
            statsCache.set(currentUrl, cacheData);
            saveCacheToStorage(currentUrl, cacheData);
        }

        // Temporarily disable submit button to prevent double submission
        submitRatingBtn.disabled = true;
        submitRatingBtn.textContent = '✅ Submitted!';

        // Reset form fields after successful submission
        setTimeout(() => {
            ratingScoreSelect.value = '1';
            isSpamCheckbox.checked = false;
            isMisleadingCheckbox.checked = false;
            isScamCheckbox.checked = false;

            // Re-enable submit button
            submitRatingBtn.disabled = false;
            submitRatingBtn.textContent = 'Submit Rating';
        }, 2000);
    } catch (error) {
        console.error('Error submitting rating:', {
            error: error.message,
            stack: error.stack,
            url: currentUrl,
            timestamp: new Date().toISOString()
        });

        // Handle different types of network and runtime errors
        let userMessage = '❌ Failed to submit rating';

        if (error.name === 'AbortError') {
            userMessage = '⏱️ Request timed out. Please try submitting again.';
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            userMessage = '🌐 Network connection error. Please check your internet connection and try again.';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            userMessage = '🔐 Authentication expired. Please log in again to submit ratings.';
        } else if (error.message.includes('429') || error.message.includes('rate limit')) {
            userMessage = '⏱️ Rate limit exceeded. Please wait before submitting another rating.';
        } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
            userMessage = '🔧 Server error. Please try submitting your rating again.';
        } else if (error.message.includes('timeout')) {
            userMessage = '⏱️ Request timed out. Please try submitting again.';
        } else {
            userMessage = `🌐 Network error: ${error.message}`;
        }

        showMessage(userMessage, 'error');

        // Re-enable submit button on error
        submitRatingBtn.disabled = false;
        submitRatingBtn.textContent = 'Submit Rating';
    }
});

// --- Initial Setup and Current URL Logic ---
async function fetchCurrentUrlAndStats() {
    console.log('fetchCurrentUrlAndStats called');

    try {
        // Ensure Chrome extension APIs are available
        if (!chrome || !chrome.tabs) {
            throw new Error('Chrome extension APIs not available');
        }

        // Use promise-based approach for better error handling
        const tabs = await new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(tabs);
                }
            });
        });

        if (tabs && tabs[0] && tabs[0].url) {
            currentUrl = tabs[0].url;
            console.log('Current URL retrieved:', currentUrl);

            if (currentUrlSpan) {
                currentUrlSpan.textContent = currentUrl;
            }

            // Only fetch stats if we're not already loading and the URL is valid
            if (!isLoadingStats && currentUrl.startsWith('http')) {
                console.log('Scheduling stats fetch for:', currentUrl);
                // Add small delay to ensure UI and API are ready
                setTimeout(() => {
                    if (!isLoadingStats) { // Double-check before making the call
                        fetchUrlStats(currentUrl);
                    }
                }, 200);
            } else {
                console.log('Skipping stats fetch:', { isLoadingStats, validUrl: currentUrl.startsWith('http') });
            }
        } else {
            console.warn('No valid tab URL found:', tabs);
            if (currentUrlSpan) {
                currentUrlSpan.textContent = 'Could not get URL.';
            }
            showMessage('Could not retrieve current tab URL.', 'error');
        }
    } catch (error) {
        console.error('Error getting current tab:', error);
        if (currentUrlSpan) {
            currentUrlSpan.textContent = 'Error getting URL.';
        }
        showMessage('Error retrieving current tab URL.', 'error');
    }
}

// --- Affiliate Links ---
function initAffiliateLinks() {
    const onePasswordLink = document.getElementById('affiliate-1password');
    const nordVpnLink = document.getElementById('affiliate-nordvpn');

    // Add click handlers for affiliate links
    onePasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({
            url: 'https://1password.com/?utm_source=url-rater&utm_medium=extension'
        });
    });

    nordVpnLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({
            url: 'https://nordvpn.com/?utm_source=url-rater&utm_medium=extension'
        });
    });
}



let isInitialized = false;
let isLoadingStats = false;

// --- Initialize when popup opens ---
document.addEventListener('DOMContentLoaded', async () => {
    if (isInitialized) return;
    isInitialized = true;

    console.log('Extension popup initializing...');

    try {
        // Ensure DOM elements are available
        if (!currentUrlSpan || !trustScoreSpan) {
            console.error('Required DOM elements not found');
            return;
        }

        // Initialize UI components first (no async operations)
        initCloseButton();
        initMessageBar();
        initHeaderAuth();
        initAffiliateLinks();
        loadCacheFromStorage();

        console.log('UI components initialized');

        // Initialize Supabase client (this might take time)
        await initSupabase();
        console.log('Supabase client initialized');

        // Add delay before auth operations to prevent timing issues
        await new Promise(resolve => setTimeout(resolve, 150));

        // Get session with improved error handling
        let session = null;
        try {
            const result = await getSession();
            session = result.session;
            console.log('Session retrieved:', session ? 'authenticated' : 'anonymous');
        } catch (error) {
            console.log('Session check completed (no active session)');
            session = null;
        }

        // Update UI based on auth state
        updateUI(session);

        // Add longer delay to ensure auth state is settled before fetching data
        setTimeout(() => {
            console.log('Fetching current URL and stats...');
            fetchCurrentUrlAndStats();
        }, 300);

        // Clean up old cache entries periodically
        cleanupOldCacheEntries();

        console.log('Extension initialization complete');
    } catch (error) {
        console.error('Extension initialization failed:', error);
        // Still try to fetch URL stats even if initialization partially failed
        setTimeout(() => {
            fetchCurrentUrlAndStats();
        }, 800);
    }
});

// Listen for auth state changes (e.g., from other tabs or if session expires)
initSupabase().then(client => {
    client.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, session ? 'authenticated' : 'anonymous');
        updateUI(session);
        // Only re-fetch if this is a login event and we have a current URL and we're fully initialized
        // Add delay to prevent race conditions with initialization
        if (event === 'SIGNED_IN' && currentUrl && isInitialized && !isLoadingStats) {
            console.log('Refreshing stats after login');
            setTimeout(() => {
                if (!isLoadingStats) { // Double-check to prevent duplicate requests
                    fetchUrlStats(currentUrl, true); // Force refresh on login
                }
            }, 200);
        }
    });
}).catch(error => {
    console.error('Failed to initialize auth state listener:', error);
});
// --- Close Button Handler ---
function initCloseButton() {
    const closeBtn = document.getElementById('close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            window.close();
        });
    }
}

// --- Message Bar Handler ---
function initMessageBar() {
    const messageClose = document.getElementById('message-close');
    if (messageClose) {
        messageClose.addEventListener('click', () => {
            hideMessage();
        });
    }

    // Add keyboard support for closing messages (Escape key)
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            const messageBar = document.getElementById('message-bar');
            if (messageBar && messageBar.classList.contains('show')) {
                hideMessage();
            }
        }
    });
}

// --- Header Login/Signup Handlers ---
function initHeaderAuth() {
    const headerLoginBtn = document.getElementById('header-login-btn');
    const headerSignupBtn = document.getElementById('header-signup-btn');
    const headerForgotBtn = document.getElementById('header-forgot-password-btn');
    const headerEmail = document.getElementById('header-email');
    const headerPassword = document.getElementById('header-password');

    // Header Login
    if (headerLoginBtn && headerEmail && headerPassword) {
        headerLoginBtn.addEventListener('click', async () => {
            const email = headerEmail.value.trim();
            const password = headerPassword.value.trim();

            if (!email || !password) {
                showMessage('Email and password are required.', 'error');
                return;
            }

            headerLoginBtn.disabled = true;
            headerLoginBtn.textContent = 'Logging in...';

            try {
                const { user, session, error } = await signIn(email, password);
                if (error) {
                    if (error.message.includes('Email not confirmed')) {
                        showMessage('Please check your email and click the confirmation link before logging in.', 'error');
                    } else {
                        showMessage(`Login failed: ${error.message}`, 'error');
                    }
                } else {
                    showMessage('Login successful!', 'success');
                    updateUI(session);
                    // Clear form
                    headerEmail.value = '';
                    headerPassword.value = '';
                }
            } catch (error) {
                showMessage(`Login error: ${error.message}`, 'error');
            } finally {
                headerLoginBtn.disabled = false;
                headerLoginBtn.textContent = 'Login';
            }
        });
    }

    // Header Signup
    if (headerSignupBtn && headerEmail && headerPassword) {
        headerSignupBtn.addEventListener('click', async () => {
            const email = headerEmail.value.trim();
            const password = headerPassword.value.trim();

            if (!email || !password) {
                showMessage('Email and password are required.', 'error');
                return;
            }

            headerSignupBtn.disabled = true;
            headerSignupBtn.textContent = 'Signing up...';

            try {
                const { user, session, error } = await signUp(email, password);
                if (error) {
                    showMessage(`Sign up failed: ${error.message}`, 'error');
                } else {
                    if (session) {
                        showMessage('Account created and logged in successfully!', 'success');
                        updateUI(session);
                    } else {
                        showMessage('Account created! Please check your email for confirmation.', 'success');
                    }
                    // Clear form
                    headerEmail.value = '';
                    headerPassword.value = '';
                }
            } catch (error) {
                showMessage(`Sign up error: ${error.message}`, 'error');
            } finally {
                headerSignupBtn.disabled = false;
                headerSignupBtn.textContent = 'Sign Up';
            }
        });
    }

    // Header Forgot Password
    if (headerForgotBtn && headerEmail) {
        headerForgotBtn.addEventListener('click', async () => {
            const email = headerEmail.value.trim();
            if (!email) {
                showMessage('Please enter your email address first.', 'error');
                return;
            }

            headerForgotBtn.disabled = true;
            headerForgotBtn.textContent = 'Sending...';

            try {
                const { error } = await resetPassword(email);
                if (error) {
                    showMessage(`Failed to send reset email: ${error.message}`, 'error');
                } else {
                    showMessage('Password reset email sent! Check your inbox.', 'success');
                }
            } catch (error) {
                showMessage(`Error: ${error.message}`, 'error');
            } finally {
                headerForgotBtn.disabled = false;
                headerForgotBtn.textContent = 'Forgot Password?';
            }
        });
    }

    // Add Enter key support for header login
    if (headerEmail && headerPassword && headerLoginBtn) {
        const handleEnterKey = (event) => {
            if (event.key === 'Enter') {
                headerLoginBtn.click();
            }
        };

        headerEmail.addEventListener('keypress', handleEnterKey);
        headerPassword.addEventListener('keypress', handleEnterKey);
    }
}

// Clean Logout Button
logoutBtn.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    showMessage('Logging out...', 'info');

    try {
        const { error } = await signOut();
        if (error) {
            showMessage(`Logout failed: ${error.message}`, 'error');
            console.error('Logout error:', error);
        } else {
            updateUI(null);
            // Clear rating form
            ratingScoreSelect.value = '1';
            isSpamCheckbox.checked = false;
            isMisleadingCheckbox.checked = false;
            isScamCheckbox.checked = false;
            // Clear email/password fields
            emailInput.value = '';
            passwordInput.value = '';
            showMessage('Logged out successfully.', 'success');
        }
    } finally {
        logoutBtn.disabled = false;
    }
});