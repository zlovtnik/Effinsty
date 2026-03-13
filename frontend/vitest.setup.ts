import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './src/lib/api/__tests__/msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

if (typeof Element !== 'undefined' && !Element.prototype.animate) {
  Element.prototype.animate = function animate() {
    return {
      cancel() {},
      commitStyles() {},
      finish() {},
      pause() {},
      play() {},
      reverse() {},
      updatePlaybackRate() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
      currentTime: null,
      effect: null,
      finished: Promise.resolve(),
      id: '',
      oncancel: null,
      onfinish: null,
      onremove: null,
      pending: false,
      playState: 'finished',
      playbackRate: 1,
      ready: Promise.resolve(),
      replaceState: 'active',
      startTime: null,
      timeline: null,
      persist() {},
    } as unknown as Animation;
  };
}
