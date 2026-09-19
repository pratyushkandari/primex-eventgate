/**
 * TanStack Query hooks for EventGate server state.
 */

import { useQuery } from '@tanstack/react-query'
import { eventGateApi } from './api'
import type {
  ConsumerDetail,
  ConsumerSummary,
  EventCatalogSummary,
  EventDetail,
  ReleaseRecord,
  PolicyInspectionResponse,
  RuntimeConfigResponse,
} from '@/types/api'

export const queryKeys = {
  health: ['health'] as const,
  eventCatalog: ['contracts', 'events'] as const,
  eventDetail: (eventType: string) => ['contracts', 'events', eventType] as const,
  consumers: ['contracts', 'consumers'] as const,
  consumerDetail: (consumerId: string) => ['contracts', 'consumers', consumerId] as const,
  history: (eventType?: string) => ['history', eventType || 'all'] as const,
  reviewDetail: (recordId: string) => ['history', 'record', recordId] as const,
  policies: ['policies'] as const,
  runtimeConfig: ['config', 'runtime'] as const,
}

export function useEventCatalog() {
  return useQuery<EventCatalogSummary[], Error>({
    queryKey: queryKeys.eventCatalog,
    queryFn: () => eventGateApi.listEventCatalog(),
    staleTime: 30_000,
  })
}

export function useEventDetail(eventType: string | null) {
  return useQuery<EventDetail, Error>({
    queryKey: queryKeys.eventDetail(eventType || ''),
    queryFn: () => {
      if (!eventType) throw new Error('No eventType provided')
      return eventGateApi.getEventDetail(eventType)
    },
    enabled: Boolean(eventType),
    staleTime: 60_000,
  })
}

export function useConsumers() {
  return useQuery<ConsumerSummary[], Error>({
    queryKey: queryKeys.consumers,
    queryFn: () => eventGateApi.listConsumers(),
    staleTime: 30_000,
  })
}

export function useConsumerDetail(consumerId: string | null) {
  return useQuery<ConsumerDetail, Error>({
    queryKey: queryKeys.consumerDetail(consumerId || ''),
    queryFn: () => {
      if (!consumerId) throw new Error('No consumerId provided')
      return eventGateApi.getConsumerDetail(consumerId)
    },
    enabled: Boolean(consumerId),
    staleTime: 60_000,
  })
}

export function useHistory(eventType?: string) {
  return useQuery<ReleaseRecord[], Error>({
    queryKey: queryKeys.history(eventType),
    queryFn: () => eventGateApi.listHistory(eventType),
    staleTime: 10_000,
  })
}

export function useReviewDetail(recordId: string | null) {
  return useQuery<ReleaseRecord, Error>({
    queryKey: queryKeys.reviewDetail(recordId || ''),
    queryFn: () => {
      if (!recordId) throw new Error('No recordId provided')
      return eventGateApi.getReview(recordId)
    },
    enabled: Boolean(recordId),
    staleTime: 30_000,
  })
}

export function usePolicies() {
  return useQuery<PolicyInspectionResponse, Error>({
    queryKey: queryKeys.policies,
    queryFn: () => eventGateApi.getPolicies(),
    staleTime: 60_000,
  })
}

export function useRuntimeConfig() {
  return useQuery<RuntimeConfigResponse, Error>({
    queryKey: queryKeys.runtimeConfig,
    queryFn: () => eventGateApi.getRuntimeConfig(),
    staleTime: 60_000,
  })
}
