export interface HeroEnhancementOptions {
  enabled?: boolean;
}

/**
 * Placeholder action for future Motion.dev integration.
 * Keeps the login hero enhancement seam compile-safe without adding a dependency.
 */
export function attachHeroEnhancement(
  _node: HTMLElement,
  options: HeroEnhancementOptions = {}
) {
  let current = options;

  return {
    update(next: HeroEnhancementOptions) {
      current = next;
      if (!current.enabled) {
        return;
      }

      // Intentionally no-op until Motion.dev is introduced.
    },
    destroy() {
      current = {};
    },
  };
}
