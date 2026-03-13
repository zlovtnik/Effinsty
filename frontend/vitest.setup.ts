import '@testing-library/jest-dom/vitest';

if (!Element.prototype.animate) {
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
