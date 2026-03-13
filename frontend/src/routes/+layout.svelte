<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { onMount } from 'svelte';
  import '../app.css';
  import { trackPage, trackWebVital } from '$lib/utils/telemetry';

  afterNavigate((navigation) => {
    trackPage('page_view', {
      navigation: 'navigate',
      title: typeof document === 'undefined' ? undefined : document.title,
      from: navigation.from ? `${navigation.from.url.pathname}${navigation.from.url.search}` : undefined,
      to: navigation.to ? `${navigation.to.url.pathname}${navigation.to.url.search}` : undefined,
    });
  });

  onMount(() => {
    trackPage('page_view', {
      navigation: 'load',
      title: document.title,
      to: `${window.location.pathname}${window.location.search}`,
    });

    if (import.meta.env.PUBLIC_ENABLE_WEB_VITALS !== 'true') {
      return;
    }

    void import('web-vitals').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      const reportMetric = (metric: {
        name: string;
        value: number;
        delta: number;
        rating: string;
        id: string;
      }) => {
        trackWebVital(metric.name, {
          value: metric.value,
          delta: metric.delta,
          rating: metric.rating,
          metricId: metric.id,
        });
      };

      onCLS(reportMetric);
      onFCP(reportMetric);
      onINP(reportMetric);
      onLCP(reportMetric);
      onTTFB(reportMetric);
    });
  });
</script>

<svelte:head>
  <title>Effinsty</title>
</svelte:head>

<slot />
