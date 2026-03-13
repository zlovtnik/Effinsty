<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { onMount } from 'svelte';
  import '../app.css';
  import { trackError, trackPage, trackWebVital } from '$lib/utils/telemetry';
  import { registerWebVitals } from '$lib/utils/web-vitals';

  afterNavigate((navigation) => {
    if (!navigation.from) {
      return;
    }

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

    void registerWebVitals((metric) => {
      trackWebVital(metric.name, {
        value: metric.value,
        delta: metric.delta,
        rating: metric.rating,
        metricId: metric.id,
      });
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown web-vitals import failure.';
      trackError('web_vitals_import_failure', {
        message: 'web-vitals import failed',
        details: [message],
      });
      console.error('[telemetry]', 'web-vitals import failed', error);
    });
  });
</script>

<svelte:head>
  <title>Effinsty</title>
</svelte:head>

<slot />
