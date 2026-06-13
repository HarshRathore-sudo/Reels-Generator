import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { toast } from '../store/toastStore'

// Extended config with retry tracking
interface RetryConfig extends InternalAxiosRequestConfig {
  _retryCount?: number
  _skipToast?: boolean
}

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Max retry attempts for idempotent requests
const MAX_RETRIES = 2
const RETRY_DELAY = 1000

// Helper: check if request is safe to retry (GET only)
function isRetryable(config: RetryConfig): boolean {
  return config.method === 'get'
}

// Helper: check if error is a network/timeout error worth retrying
function isTransientError(error: AxiosError): boolean {
  if (!error.response) return true // Network error
  const status = error.response.status
  return status === 502 || status === 503 || status === 504 || status === 408
}

// Helper: extract a human-readable error message
function extractErrorMessage(error: AxiosError): string {
  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return 'Request timed out. Please try again.'
    }
    return 'Network error. Please check your connection.'
  }

  const data = error.response.data as { detail?: string | { msg: string }[] } | undefined
  if (data?.detail) {
    if (typeof data.detail === 'string') return data.detail
    // FastAPI validation error format
    if (Array.isArray(data.detail)) {
      return data.detail.map((e) => e.msg).join('; ')
    }
  }

  const status = error.response.status
  switch (status) {
    case 400: return 'Invalid request. Please check your input.'
    case 404: return 'The requested resource was not found.'
    case 409: return 'Conflict. This action has already been completed.'
    case 413: return 'File too large. Please reduce the file size.'
    case 422: return 'Validation error. Please check your input.'
    case 429: return 'Too many requests. Please wait a moment.'
    case 500: return 'Server error. Please try again later.'
    default: return `Request failed (${status}). Please try again.`
  }
}

// Response interceptor: handle errors, retry, and toast
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined
    if (!config) return Promise.reject(error)

    const retryCount = config._retryCount || 0

    // Retry logic for transient errors on safe requests
    if (isRetryable(config) && isTransientError(error) && retryCount < MAX_RETRIES) {
      config._retryCount = retryCount + 1
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * config._retryCount!))
      return apiClient(config)
    }

    // Extract and log the error message
    const message = extractErrorMessage(error)
    console.error('API Error:', message)

    // Show toast for server/network errors (not for expected 4xx in controlled flows)
    if (!config._skipToast) {
      const status = error.response?.status
      if (!status || status >= 500 || status === 408) {
        toast.error(message)
      }
    }

    return Promise.reject(error)
  },
)
