interface EventGateLogoProps {
  className?: string
  size?: number
}

/**
 * Custom geometric EventGate brand mark.
 * Visually communicates: gate portals, ingress event stream, core verification nexus, and controlled egress vector.
 * Renders crisp SVG vector at 16px, 20px, 24px, and 32px on dark enterprise surfaces.
 */
export function EventGateLogo({ className = 'h-4 w-4', size }: EventGateLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Outer gate portals */}
      <path d="M4 4.5v15M20 4.5v15" />
      {/* Ingress flow into verification boundary */}
      <path d="M4 12h4.5" />
      {/* Central gate verification core */}
      <rect x="8.5" y="8.5" width="7" height="7" rx="1.5" fill="currentColor" fillOpacity="0.2" />
      {/* Controlled release flow */}
      <path d="M15.5 12H20" />
      <path d="M17.5 9.5L20 12l-2.5 2.5" />
    </svg>
  )
}
