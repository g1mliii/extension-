// Shared error logging utility for edge functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export interface ErrorLogEntry {
    functionName: string
    functionType: 'edge_function' | 'database_function' | 'cron_job'
    errorMessage: string
    errorDetails?: any
    requestId?: string
    userId?: string
    url?: string
    httpStatus?: number
    stackTrace?: string
    severity?: 'info' | 'warning' | 'error' | 'critical'
}

export async function logFunctionError(entry: ErrorLogEntry): Promise<number | null> {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        })

        const { data, error } = await supabase.rpc('log_function_error', {
            p_function_name: entry.functionName,
            p_function_type: entry.functionType,
            p_error_message: entry.errorMessage,
            p_error_details: entry.errorDetails ? JSON.stringify(entry.errorDetails) : null,
            p_request_id: entry.requestId || null,
            p_user_id: entry.userId || null,
            p_url: entry.url || null,
            p_http_status: entry.httpStatus || null,
            p_stack_trace: entry.stackTrace || null,
            p_severity: entry.severity || 'error'
        })

        if (error) {
            console.error('Failed to log error to database:', error)
            return null
        }

        return data as number
    } catch (err) {
        console.error('Error logging system failed:', err)
        return null
    }
}

// Wrapper function for easier usage
export async function logError(
    functionName: string,
    error: Error,
    context: {
        requestId?: string
        userId?: string
        url?: string
        httpStatus?: number
        severity?: 'info' | 'warning' | 'error' | 'critical'
        additionalDetails?: any
    } = {}
): Promise<void> {
    await logFunctionError({
        functionName,
        functionType: 'edge_function',
        errorMessage: error.message,
        errorDetails: {
            name: error.name,
            stack: error.stack,
            ...context.additionalDetails
        },
        requestId: context.requestId,
        userId: context.userId,
        url: context.url,
        httpStatus: context.httpStatus,
        stackTrace: error.stack,
        severity: context.severity || 'error'
    })
}

// Database function error logging (for use in SQL)
export async function logDatabaseError(
    functionName: string,
    errorMessage: string,
    details?: any
): Promise<void> {
    await logFunctionError({
        functionName,
        functionType: 'database_function',
        errorMessage,
        errorDetails: details,
        severity: 'error'
    })
}