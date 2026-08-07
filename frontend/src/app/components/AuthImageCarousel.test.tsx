import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import AuthImageCarousel from './AuthImageCarousel';

function currentSlideSrc() {
  return screen.getByRole('img', { hidden: true }).getAttribute('src');
}

describe('AuthImageCarousel', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('starts on the RTLS slide', () => {
    render(<AuthImageCarousel />);

    expect(currentSlideSrc()).toBe('/images/features/rtls.webp');
  });

  it('auto-advances through RTLS → 블록체인 → 자동화 → 배경 and wraps around', () => {
    render(<AuthImageCarousel />);

    act(() => vi.advanceTimersByTime(5000));
    expect(currentSlideSrc()).toBe('/images/features/blockchain.webp');

    act(() => vi.advanceTimersByTime(5000));
    expect(currentSlideSrc()).toBe('/images/features/auto.webp');

    act(() => vi.advanceTimersByTime(5000));
    expect(currentSlideSrc()).toBe('/images/hero/monitor.jpg');

    act(() => vi.advanceTimersByTime(5000));
    expect(currentSlideSrc()).toBe('/images/features/rtls.webp');
  });

  it('moves to the next slide when the next control is clicked', () => {
    render(<AuthImageCarousel />);

    fireEvent.click(screen.getByRole('button', { name: '다음 이미지' }));

    expect(currentSlideSrc()).toBe('/images/features/blockchain.webp');
  });

  it('wraps to the last slide when the previous control is clicked on the first slide', () => {
    render(<AuthImageCarousel />);

    fireEvent.click(screen.getByRole('button', { name: '이전 이미지' }));

    expect(currentSlideSrc()).toBe('/images/hero/monitor.jpg');
  });

  it('jumps to the slide whose indicator is clicked', () => {
    render(<AuthImageCarousel />);

    fireEvent.click(screen.getByRole('button', { name: '3번째 이미지 보기' }));

    expect(currentSlideSrc()).toBe('/images/features/auto.webp');
  });

  it('restarts the auto-advance timer after a manual move', () => {
    render(<AuthImageCarousel />);

    act(() => vi.advanceTimersByTime(4000));
    fireEvent.click(screen.getByRole('button', { name: '다음 이미지' }));
    expect(currentSlideSrc()).toBe('/images/features/blockchain.webp');

    // 수동 이동으로 타이머가 리셋되므로, 남은 1초로는 다음 슬라이드로 넘어가지 않는다.
    act(() => vi.advanceTimersByTime(1500));
    expect(currentSlideSrc()).toBe('/images/features/blockchain.webp');

    act(() => vi.advanceTimersByTime(3500));
    expect(currentSlideSrc()).toBe('/images/features/auto.webp');
  });
});
