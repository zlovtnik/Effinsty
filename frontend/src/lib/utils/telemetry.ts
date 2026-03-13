import { get } from 'svelte/store';
import { tenantStore } from '$lib/stores/tenant.store';

export type HealthState = 'unknown' | 'healthy' | 'degraded';
export type ActionStatus = 'start' | 'success' | 'failure';

interface TelemetryContext {
  route?: string;
  tenantId?: string;
  correlationId?: string;
}

interface TelemetryBaseEvent extends TelemetryContext {
  kind: 'page' | 'action' | 'error' | 'health' | 'web-vital';
  name: string;
  timestamp: string;
}

export interface PageTelemetryEvent extends TelemetryBaseEvent {
  kind: 'page';
  navigation: 'load' | 'navigate';
  title?: string;
  from?: string;
  to?: string;
}

export interface ActionTelemetryEvent extends TelemetryBaseEvent {
  kind: 'action';
  status: ActionStatus;
  message?: string;
  details?: Record<string, unknown>;
}

export interface ErrorTelemetryEvent extends TelemetryBaseEvent {
  kind: 'error';
  message: string;
  statusCode?: number;
  details?: string[];
}

export interface HealthTelemetryEvent extends TelemetryBaseEvent {
  kind: 'health';
  state: HealthState;
  checkedAt: number;
  message?: string;
}

export interface WebVitalTelemetryEvent extends TelemetryBaseEvent {
  kind: 'web-vital';
  metric: string;
  value: number;
  delta: number;
  rating: string;
  metricId: string;
}

export type TelemetryEvent =
  | PageTelemetryEvent
  | ActionTelemetryEvent
  | ErrorTelemetryEvent
  | HealthTelemetryEvent
  | WebVitalTelemetryEvent;

type TelemetryEventInput =
  | Omit<PageTelemetryEvent, 'timestamp'>
  | Omit<ActionTelemetryEvent, 'timestamp'>
  | Omit<ErrorTelemetryEvent, 'timestamp'>
  | Omit<HealthTelemetryEvent, 'timestamp'>
  | Omit<WebVitalTelemetryEvent, 'timestamp'>;

export type TelemetrySink = (event: TelemetryEvent) => void | Promise<void>;

function defaultRoute(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return `${window.location.pathname}${window.location.search}`;
}

function defaultTenantId(): string | undefined {
  return get(tenantStore).tenantId ?? undefined;
}

function withBaseContext(event: TelemetryEventInput): TelemetryEvent {
  return {
    ...event,
    timestamp: new Date().toISOString(),
    route: event.route ?? defaultRoute(),
    tenantId: event.tenantId ?? defaultTenantId(),
  } as TelemetryEvent;
}

const consoleTelemetrySink: TelemetrySink = (event) => {
  console.info('[telemetry]', event);
};

let activeSink: TelemetrySink = consoleTelemetrySink;

export function setTelemetrySink(sink: TelemetrySink): void {
  activeSink = sink;
}

export function resetTelemetrySink(): void {
  activeSink = consoleTelemetrySink;
}

export function emitTelemetry(event: TelemetryEventInput): void {
  try {
    void activeSink(withBaseContext(event));
  } catch (error) {
    console.error('[telemetry]', 'sink failure', error);
  }
}

export function trackPage(
  name: string,
  payload: Omit<PageTelemetryEvent, 'kind' | 'name' | 'timestamp'> & Partial<TelemetryContext>
): void {
  emitTelemetry({
    kind: 'page',
    name,
    ...payload,
  });
}

export function trackAction(
  name: string,
  payload: Omit<ActionTelemetryEvent, 'kind' | 'name' | 'timestamp'> & Partial<TelemetryContext>
): void {
  emitTelemetry({
    kind: 'action',
    name,
    ...payload,
  });
}

export function trackError(
  name: string,
  payload: Omit<ErrorTelemetryEvent, 'kind' | 'name' | 'timestamp'> & Partial<TelemetryContext>
): void {
  emitTelemetry({
    kind: 'error',
    name,
    ...payload,
  });
}

export function trackHealth(
  name: string,
  payload: Omit<HealthTelemetryEvent, 'kind' | 'name' | 'timestamp'> & Partial<TelemetryContext>
): void {
  emitTelemetry({
    kind: 'health',
    name,
    ...payload,
  });
}

export function trackWebVital(
  metric: string,
  payload: Omit<WebVitalTelemetryEvent, 'kind' | 'name' | 'timestamp' | 'metric'> &
    Partial<TelemetryContext>
): void {
  emitTelemetry({
    kind: 'web-vital',
    name: metric,
    metric,
    ...payload,
  });
}
