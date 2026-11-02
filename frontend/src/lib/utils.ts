import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

/** Map a decision, compatibility status or severity to its status color. */
export function toneFor(value: string | null | undefined): Tone {
  switch (value) {
    case 'ALLOW':
    case 'SAFE':
    case 'LOW':
      return 'success'
    case 'REVIEW':
    case 'RISK':
    case 'MEDIUM':
      return 'warning'
    case 'BLOCK':
    case 'BREAK':
    case 'HIGH':
      return 'danger'
    default:
      return 'neutral'
  }
}

/** Short, locale-aware timestamp, e.g. "2 Nov, 14:05:09". */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Trigger a browser download of text content. */
export function downloadText(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
