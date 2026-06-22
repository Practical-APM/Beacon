import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackBanner } from './feedback-banner';

describe('FeedbackBanner', () => {
  it('renders error variant with message', () => {
    render(<FeedbackBanner variant="error" message="Setup failed" />);
    expect(screen.getByRole('status')).toHaveTextContent('Setup failed');
  });

  it('calls onDismiss when dismiss clicked', async () => {
    const onDismiss = vi.fn();
    render(<FeedbackBanner variant="warning" message="Partial data" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
