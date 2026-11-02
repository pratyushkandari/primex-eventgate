import * as React from 'react'

export const ROUTES = ['review', 'contracts', 'history', 'devtools', 'policies', 'settings'] as const
export type Route = (typeof ROUTES)[number]

export const ROUTE_LABELS: Record<Route, string> = {
  review: 'Review',
  contracts: 'Contracts',
  history: 'History',
  devtools: 'Developer tools',
  policies: 'Policies',
  settings: 'Settings',
}

function parseHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split(/[/?]/)[0]
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'review'
}

/**
 * Current top-level page, stored in the URL hash (#/history) so reload, back and
 * forward work and pages can be linked. A hash keeps static hosting simple:
 * Amplify needs no rewrite rules.
 */
export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = React.useState<Route>(() => parseHash(window.location.hash))

  React.useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = React.useCallback((next: Route) => {
    if (parseHash(window.location.hash) !== next) window.location.hash = `/${next}`
    setRoute(next)
  }, [])

  return [route, navigate]
}

/** True while the media query matches; re-renders when it changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (notify: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', notify)
      return () => mql.removeEventListener('change', notify)
    },
    [query]
  )
  return React.useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}
