import { logger } from './logger';
import { API_CONFIG } from './constants';

export interface ApiCallOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Import defaults from constants instead

export async function makeApiCall<T = any>(
  url: string,
  options: ApiCallOptions = {}
): Promise<ApiResponse<T>> {
  const {
    timeout = API_CONFIG.DEFAULT_TIMEOUT,
    retries = API_CONFIG.DEFAULT_RETRIES,
    retryDelay = API_CONFIG.DEFAULT_RETRY_DELAY,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      logger.debug(`Making API call to ${url}`, { 
        attempt: attempt + 1, 
        maxRetries: retries + 1,
        options: fetchOptions 
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        const error = new ApiError(
          `API Error: ${response.status} ${response.statusText} - ${errorText}`,
          response.status,
          response.statusText,
          errorText
        );
        
        logger.error(`API call failed for ${url}`, error);
        throw error;
      }

      const data = await response.json().catch(() => {
        logger.warn(`Failed to parse JSON response from ${url}`);
        return null;
      });

      logger.debug(`API call successful for ${url}`, { data });

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      logger.warn(`API call attempt ${attempt + 1} failed for ${url}`, lastError);

      // Don't retry on abort or 4xx errors
      if (lastError.name === 'AbortError' || 
          (lastError instanceof ApiError && lastError.status && lastError.status >= 400 && lastError.status < 500)) {
        break;
      }

      // Wait before retry (except on last attempt)
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }
  }

  logger.error(`All API call attempts failed for ${url}`, lastError);
  throw lastError || new Error('Unknown API error');
}

export function createApiEndpoint(baseUrl: string) {
  return {
    get: <T = any>(endpoint: string, options?: ApiCallOptions) => 
      makeApiCall<T>(`${baseUrl}${endpoint}`, { method: 'GET', ...options }),
    
    post: <T = any>(endpoint: string, data?: any, options?: ApiCallOptions) => 
      makeApiCall<T>(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        body: data ? JSON.stringify(data) : undefined,
        ...options,
      }),
    
    put: <T = any>(endpoint: string, data?: any, options?: ApiCallOptions) => 
      makeApiCall<T>(`${baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        body: data ? JSON.stringify(data) : undefined,
        ...options,
      }),
    
    patch: <T = any>(endpoint: string, data?: any, options?: ApiCallOptions) => 
      makeApiCall<T>(`${baseUrl}${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        body: data ? JSON.stringify(data) : undefined,
        ...options,
      }),
    
    delete: <T = any>(endpoint: string, options?: ApiCallOptions) => 
      makeApiCall<T>(`${baseUrl}${endpoint}`, { method: 'DELETE', ...options }),
  };
}

export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export function isNetworkError(error: Error): boolean {
  return (
    error.name === 'AbortError' ||
    error.message.includes('fetch') ||
    error.message.includes('network') ||
    error.message.includes('Failed to fetch')
  );
}

export function isRetryableError(error: Error): boolean {
  if (error instanceof ApiError) {
    // Retry on 5xx errors and some specific 4xx errors
    return !error.status || 
           error.status >= 500 || 
           error.status === 408 || // Request Timeout
           error.status === 429;   // Too Many Requests
  }
  
  return isNetworkError(error);
}