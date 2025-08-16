// rating-extension/auth.js

// Import configuration
import { CONFIG } from './config.js';

// Supabase configuration
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;

// Global variable to hold supabase client
let supabase = null;

// Initialize Supabase client
async function initSupabase() {
    if (supabase) return supabase;

    // Load Supabase library if not already loaded
    if (!window.supabase) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = './supabase.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
}

// Export the initialized client
export { supabase, initSupabase };

/**
 * Signs up a new user with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: object|null, session: object|null, error: Error|null}>}
 */
export async function signUp(email, password) {
    const client = await initSupabase();
    const { data, error } = await client.auth.signUp({
        email: email,
        password: password,
        options: {
            emailRedirectTo: `https://g1mliii.github.io/url-rater-confir/confirm.html`
        }
    });
    return { user: data.user, session: data.session, error };
}

/**
 * Logs in an existing user with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: object|null, session: object|null, error: Error|null}>}
 */
export async function signIn(email, password) {
    const client = await initSupabase();
    const { data, error } = await client.auth.signInWithPassword({
        email: email,
        password: password,
    });
    return { user: data.user, session: data.session, error };
}

/**
 * Logs out the current user.
 * @returns {Promise<{error: Error|null}>}
 */
export async function signOut() {
    const client = await initSupabase();
    const { error } = await client.auth.signOut();
    return { error };
}

/**
 * Gets the current user session.
 * @returns {Promise<{session: object|null, error: Error|null}>}
 */
export async function getSession() {
    try {
        const client = await initSupabase();
        const { data: { session }, error } = await client.auth.getSession();
        return { session, error };
    } catch (error) {
        console.warn('Error getting session:', error);
        return { session: null, error };
    }
}

/**
 * Gets the current authenticated user object.
 * @returns {Promise<{user: object|null, error: Error|null}>}
 */
export async function getUser() {
    const client = await initSupabase();
    const { data: { user }, error } = await client.auth.getUser();
    return { user, error };
}

/**
 * Resends confirmation email
 * @param {string} email
 * @returns {Promise<{error: Error|null}>}
 */
export async function resendConfirmation(email) {
    const client = await initSupabase();
    const { error } = await client.auth.resend({
        type: 'signup',
        email: email,
        options: {
            emailRedirectTo: `https://g1mliii.github.io/url-rater-confir/confirm.html`
        }
    });
    return { error };
}

/**
 * Sends password reset email
 * @param {string} email
 * @returns {Promise<{error: Error|null}>}
 */
export async function resetPassword(email) {
    const client = await initSupabase();
    const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `https://g1mliii.github.io/url-rater-confir/confirm.html`
    });
    return { error };
}


