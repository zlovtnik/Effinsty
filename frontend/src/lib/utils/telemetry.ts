export function track(event: string, payload: Record<string, unknown> = {}) {
  // TODO: wire to selected analytics provider.
  console.info('[telemetry]', event, payload);
}
