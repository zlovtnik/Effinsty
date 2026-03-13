// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/svelte';
import LoginPage from '../+page.svelte';

describe('login page a11y', () => {
  it('exposes no critical or serious violations', async () => {
    render(LoginPage);

    expect(await screen.findByRole('heading', { name: 'Sign in to your workspace' })).toBeInTheDocument();

    const result = await axe(document.body);
    const criticalViolations = result.violations.filter((violation) =>
      violation.impact === 'critical' || violation.impact === 'serious'
    );

    expect(criticalViolations).toHaveLength(0);
  });
});
