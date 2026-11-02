/**
 * API location. VITE_EVENTGATE_API_URL wins when set; otherwise development
 * builds talk to the local FastAPI server and production builds (Amplify) to
 * the deployed API Gateway endpoint.
 */

export const LOCAL_API_URL = 'http://127.0.0.1:8000'
export const DEPLOYED_API_URL = 'https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com'

function resolveBaseUrl(): string {
  const configured = import.meta.env.VITE_EVENTGATE_API_URL as string | undefined
  const url = configured || (import.meta.env.DEV ? LOCAL_API_URL : DEPLOYED_API_URL)
  return url.replace(/\/+$/, '')
}

export const API_CONFIG = {
  baseUrl: resolveBaseUrl(),
}
