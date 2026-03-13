import { writable } from 'svelte/store';
import { checkHealth, type HealthStatus } from '$lib/api/health';
import { trackHealth } from '$lib/utils/telemetry';

const INITIAL_STATE: HealthStatus = {
  state: 'unknown',
  checkedAt: null,
  message: '',
  correlationId: '',
};

function createHealthStore() {
  const { subscribe, set } = writable<HealthStatus>(INITIAL_STATE);

  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight: Promise<HealthStatus> | null = null;

  const poll = async (): Promise<HealthStatus> => {
    if (!inFlight) {
      inFlight = checkHealth()
        .then((next) => {
          set(next);
          trackHealth('health_poll', {
            state: next.state,
            checkedAt: next.checkedAt ?? Date.now(),
            message: next.message,
            correlationId: next.correlationId,
          });
          return next;
        })
        .finally(() => {
          inFlight = null;
        });
    }

    return inFlight;
  };

  return {
    subscribe,
    startPolling: (intervalMs = 30_000) => {
      if (typeof window === 'undefined' || timer) {
        return;
      }

      void poll();
      timer = setInterval(() => {
        void poll();
      }, intervalMs);
    },
    stopPolling: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    checkNow: () => poll(),
    reset: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }

      set(INITIAL_STATE);
    },
  };
}

export const healthStore = createHealthStore();
