// rating-extension/popup.js (REVISED)

import { supabase, initSupabase, signIn, signUp, signOut, getSession, getUser, resendConfirmation, resetPassword } from './auth.js';

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
    // Message display removed - using console instead
    console.log(`${type.toUpperCase()}: ${text}`);
}

// --- Helper Functions for Stats Display ---
function updateStatsDisplay(data) {
    if (!data) {
        clearStatsDisplay();
        return;
    }

    const trustScore = (data.trust_score !== null && data.trust_score !== undefined)
        ? data.trust_score : null;

    // Update the circular progress score
    if (trustScore !== null) {
        trustScoreSpan.textContent = `${trustScore.toFixed(0)}%`;
        updateScoreBar(trustScore);
    } else {
        trustScoreSpan.textContent = 'N/A';
        updateScoreBar(0);
    }

    totalRatingsSpan.textContent = data.rating_count || '0';
    spamCountSpan.textContent = data.spam_reports_count || '0';
    misleadingCountSpan.textContent = data.misleading_reports_count || '0';
    scamCountSpan.textContent = data.scam_reports_count || '0';
}

function updateScoreBar(score) {
    const progressRing = document.getElementById('progress-ring');
    
    if (progressRing) {
        // Convert score (0-100) to percentage
        const percentage = Math.max(0, Math.min(100, score));
        
        // Calculate the circumference of the circle (2 * π * radius)
        const radius = 55;
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

function clearStatsDisplay() {
    trustScoreSpan.textContent = 'N/A';
    totalRatingsSpan.textContent = 'N/A';
    spamCountSpan.textContent = '0';
    misleadingCountSpan.textContent = '0';
    scamCountSpan.textContent = '0';
    updateScoreBar(0);
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
    showMessage('Fetching URL trust score...', 'info');

    const { session } = await getSession();
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZGRhYWNlbWZ4c2htbnpoeWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTQ1MDUsImV4cCI6MjA2ODY3MDUwNX0.rSNs9jRLfOuPVYSeHswobvaGidPQfi78RUtD4p9unIY';

    const headers = {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        // Always include Authorization header - use user token if logged in, otherwise anon key
        'Authorization': `Bearer ${(session && session.access_token) ? session.access_token : anonKey}`
    };

    const response = await fetch(`${API_BASE_URL}/url-stats?url=${encodeURIComponent(url)}`, {
        headers: headers
    });
    const data = await response.json();

    if (response.ok) {
        const cacheData = {
            data: data,
            timestamp: Date.now()
        };
        statsCache.set(url, cacheData);
        saveCacheToStorage(url, cacheData);

        updateStatsDisplay(data);
        showMessage(`Trust score loaded for ${url}.`, 'success');
    } else {
        showMessage(`Failed to fetch trust score: ${data.error || 'Unknown error'}`, 'error');
        clearStatsDisplay();
        throw new Error(data.error || 'Failed to fetch stats');
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
const API_BASE_URL = 'https://giddaacemfxshmnzhydb.supabase.co/functions/v1/rating-api'; // Your Supabase Edge Function URL

// Batch request queue for efficiency
let batchQueue = new Set();
let batchTimeout = null;
const BATCH_DELAY_MS = 100; // Wait 100ms to collect multiple requests

async function fetchUrlStats(url, forceRefresh = false) {
    try {
        // Check cache first (unless force refresh)
        if (!forceRefresh) {
            const cached = statsCache.get(url);
            if (cached && (Date.now() - cached.timestamp) < STATS_CACHE_DURATION_MS) {
                console.log('Using cached stats for', url);
                updateStatsDisplay(cached.data);
                showMessage('Stats loaded from cache.', 'success');
                return;
            }
        }

        // For single requests, use batch system for efficiency
        if (!forceRefresh) {
            return await fetchUrlStatsBatched(url);
        }

        showMessage('Fetching URL trust score...', 'info');

        // Always send anon key for API access, plus user token if logged in
        const { session } = await getSession();
        const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZGRhYWNlbWZ4c2htbnpoeWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTQ1MDUsImV4cCI6MjA2ODY3MDUwNX0.rSNs9jRLfOuPVYSeHswobvaGidPQfi78RUtD4p9unIY';

        const headers = {
            'Content-Type': 'application/json',
            'apikey': anonKey,
            // Always include Authorization header - use user token if logged in, otherwise anon key
            'Authorization': `Bearer ${(session && session.access_token) ? session.access_token : anonKey}`
        };

        const response = await fetch(`${API_BASE_URL}/url-stats?url=${encodeURIComponent(url)}`, {
            headers: headers
        });
        const data = await response.json();

        if (response.ok && data) {
            // Cache the response
            const cacheData = {
                data: data,
                timestamp: Date.now()
            };
            statsCache.set(url, cacheData);
            saveCacheToStorage(url, cacheData);

            updateStatsDisplay(data);
            showMessage(forceRefresh ? 'Stats refreshed!' : `Trust score loaded for ${url}.`, 'success');
        } else {
            const errorMsg = data?.error || 'Unknown error';
            showMessage(`Failed to fetch trust score: ${errorMsg}`, 'error');
            clearStatsDisplay();
        }
    } catch (error) {
        showMessage(`Network error fetching trust score: ${error.message}`, 'error');
        console.error('Error fetching URL stats:', error);
        trustScoreSpan.textContent = 'N/A';
        totalRatingsSpan.textContent = 'N/A';
        spamCountSpan.textContent = '0';
        misleadingCountSpan.textContent = '0';
        scamCountSpan.textContent = '0';
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

    showMessage('Submitting rating...', 'info');

    try {
        const { session } = await getSession();
        if (!session || !session.access_token) {
            showMessage('You must be logged in to submit a rating.', 'error');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/rating`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}` // Send JWT token
            },
            body: JSON.stringify({
                url: currentUrl,
                score: score,
                comment: null, // No comments
                isSpam: isSpam,
                isMisleading: isMisleading,
                isScam: isScam
            })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(data.message, 'success');
            // Update displayed stats with the latest from API response (if available)
            if (data.urlStats) {
                trustScoreSpan.textContent = data.urlStats.trust_score !== null ? `${data.urlStats.trust_score.toFixed(2)}%` : 'N/A';
                totalRatingsSpan.textContent = data.urlStats.rating_count;
                spamCountSpan.textContent = data.urlStats.spam_reports_count;
                misleadingCountSpan.textContent = data.urlStats.misleading_reports_count;
                scamCountSpan.textContent = data.urlStats.scam_reports_count;
            }
            // Reset form fields after successful submission
            ratingScoreSelect.value = '1';
            isSpamCheckbox.checked = false;
            isMisleadingCheckbox.checked = false;
            isScamCheckbox.checked = false;
        } else {
            showMessage(`Rating failed: ${data.error || 'Unknown error'}`, 'error');
            console.error('Rating submission error:', data);
        }
    } catch (error) {
        showMessage(`Network error submitting rating: ${error.message}`, 'error');
        console.error('Error submitting rating:', error);
    }
});

// --- Initial Setup and Current URL Logic ---
async function fetchCurrentUrlAndStats() {
    try {
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
            currentUrlSpan.textContent = currentUrl;

            // Add small delay to ensure UI is ready
            setTimeout(() => {
                fetchUrlStats(currentUrl);
            }, 100);
        } else {
            currentUrlSpan.textContent = 'Could not get URL.';
            showMessage('Could not retrieve current tab URL.', 'error');
        }
    } catch (error) {
        console.error('Error getting current tab:', error);
        currentUrlSpan.textContent = 'Error getting URL.';
        showMessage('Error retrieving current tab URL.', 'error');
    }
}

// Theme management removed - single dark mode only

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

// --- Initialize when popup opens ---
document.addEventListener('DOMContentLoaded', async () => {
    if (isInitialized) return;
    isInitialized = true;

    // Theme system removed - single dark mode only

    // Initialize close button
    initCloseButton();

    // Initialize header auth (login/signup/forgot password)
    initHeaderAuth();

    // Initialize affiliate links
    initAffiliateLinks();

    // Load cache from localStorage first
    loadCacheFromStorage();

    const { session } = await getSession();
    updateUI(session); // Set UI based on current auth state

    // Always fetch URL and stats, regardless of login status
    fetchCurrentUrlAndStats();

    // Clean up old cache entries periodically
    cleanupOldCacheEntries();
});

// Listen for auth state changes (e.g., from other tabs or if session expires)
initSupabase().then(client => {
    client.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, session);
        updateUI(session);
        // Only re-fetch if this is a login event and we have a current URL
        if (event === 'SIGNED_IN' && currentUrl) {
            fetchUrlStats(currentUrl, true); // Force refresh on login
        }
    });
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