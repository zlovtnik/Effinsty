// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import LoginHero from '../LoginHero.svelte';

describe('LoginHero', () => {
  it('renders public copy, motion principles, and animation library links', () => {
    render(LoginHero, {
      props: {
        principles: [
          '120-180ms transitions for premium responsiveness',
          'Reduced-motion support as a baseline',
        ],
        animationLibraries: [
          {
            name: 'Motion.dev',
            href: 'https://motion.dev/',
            summary: 'Framework-agnostic motion engine.',
          },
          {
            name: 'Svelte Magic UI',
            href: 'https://www.sveltemagicui.com/',
            summary: 'Animated Svelte components.',
          },
        ],
      },
    });

    expect(screen.getByRole('heading', { name: 'Animated Svelte login tuned for 2026 standards.' })).toBeInTheDocument();
    expect(screen.getByText('120-180ms transitions for premium responsiveness')).toBeInTheDocument();
    expect(screen.getByText('Reduced-motion support as a baseline')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Motion.dev' })).toHaveAttribute('href', 'https://motion.dev/');
    expect(screen.getByRole('link', { name: 'Svelte Magic UI' })).toHaveAttribute('href', 'https://www.sveltemagicui.com/');
  });
});
