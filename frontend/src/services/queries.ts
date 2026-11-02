/**
 * TanStack Query hooks for read-only server state. Mutations (analyze, publish)
 * are plain async calls in the workspace because their results are local UI state.
 */

import { useQuery } from '@tanstack/react-query'
import { eventGateApi } from './api'

export const queryKeys = {
  health: ['health'] as const,
  eventCatalog: ['contracts', 'events'] as const,
  eventDetail: (eventType: string) => ['contracts', 'events', eventType] as const,
  consumers: ['contracts', 'consumers'] as const,
  consumerDetail: (consumerId: string) => ['contracts', 'consumers', consumerId] as const,
  history: ['history'] as const,
  policies: ['policies'] as const,
  runtimeConfig: ['config', 'runtime'] as const,
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => eventGateApi.checkHealth(),
    retry: false,
    // One health check a minute per open console (docs/decisions.md, section 10).
    refetchInterval: 60_000,
  })
}

export function useEventCatalog() {
  return useQuery({
    queryKey: queryKeys.eventCatalog,
    queryFn: () => eventGateApi.listEventCatalog(),
    staleTime: 60_000,
  })
}

export function useEventDetail(eventType: string | null) {
  return useQuery({
    queryKey: queryKeys.eventDetail(eventType ?? ''),
    queryFn: () => eventGateApi.getEventDetail(eventType as string),
    enabled: Boolean(eventType),
    staleTime: 60_000,
  })
}

export function useConsumers() {
  return useQuery({
    queryKey: queryKeys.consumers,
    queryFn: () => eventGateApi.listConsumers(),
    staleTime: 60_000,
  })
}

export function useConsumerDetail(consumerId: string | null) {
  return useQuery({
    queryKey: queryKeys.consumerDetail(consumerId ?? ''),
    queryFn: () => eventGateApi.getConsumerDetail(consumerId as string),
    enabled: Boolean(consumerId),
    staleTime: 60_000,
  })
}

/** All history records; the History page filters them client-side. */
export function useHistory() {
  return useQuery({
    queryKey: queryKeys.history,
    queryFn: () => eventGateApi.listHistory(),
    staleTime: 5_000,
  })
}

export function usePolicies() {
  return useQuery({
    queryKey: queryKeys.policies,
    queryFn: () => eventGateApi.getPolicies(),
    staleTime: 5 * 60_000,
  })
}

export function useRuntimeConfig() {
  return useQuery({
    queryKey: queryKeys.runtimeConfig,
    queryFn: () => eventGateApi.getRuntimeConfig(),
    staleTime: 5 * 60_000,
  })
}
