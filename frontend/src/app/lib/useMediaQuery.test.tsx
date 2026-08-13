import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery';

function Probe({ query }: { query: string }) {
  const matches = useMediaQuery(query);
  return <div data-testid="matches">{String(matches)}</div>;
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('useMediaQuery', () => {
  afterEach(() => setViewportWidth(1440));

  it('reports true when the viewport already satisfies the query on mount', () => {
    setViewportWidth(1440);
    render(<Probe query="(min-width: 1280px)" />);

    expect(screen.getByTestId('matches')).toHaveTextContent('true');
  });

  it('reports false when the viewport does not satisfy the query on mount', () => {
    setViewportWidth(375);
    render(<Probe query="(min-width: 1280px)" />);

    expect(screen.getByTestId('matches')).toHaveTextContent('false');
  });

  it('updates when the viewport crosses the breakpoint after mount', () => {
    setViewportWidth(1440);
    render(<Probe query="(min-width: 1280px)" />);
    expect(screen.getByTestId('matches')).toHaveTextContent('true');

    act(() => setViewportWidth(375));
    expect(screen.getByTestId('matches')).toHaveTextContent('false');

    act(() => setViewportWidth(1440));
    expect(screen.getByTestId('matches')).toHaveTextContent('true');
  });
});
