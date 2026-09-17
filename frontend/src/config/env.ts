/**
 * EventGate environment and API configuration.
 */

export const DEFAULT_API_URL = 'https://ux8bwi3i8l.execute-api.ap-south-1.amazonaws.com'

export const API_CONFIG = {
  baseUrl: (import.meta.env.VITE_EVENTGATE_API_URL || DEFAULT_API_URL).replace(/\/+$/, ''),
  region: 'ap-south-1',
  stackName: 'primex-eventgate-dev',
  isLiveAws: (import.meta.env.VITE_EVENTGATE_API_URL || DEFAULT_API_URL).includes('amazonaws.com'),
}
