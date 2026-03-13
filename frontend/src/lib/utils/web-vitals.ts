export interface WebVitalMetric {
  name: string;
  value: number;
  delta: number;
  rating: string;
  id: string;
}

export async function registerWebVitals(
  onMetric: (metric: WebVitalMetric) => void
): Promise<void> {
  const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import('web-vitals');

  onCLS(onMetric);
  onFCP(onMetric);
  onINP(onMetric);
  onLCP(onMetric);
  onTTFB(onMetric);
}
