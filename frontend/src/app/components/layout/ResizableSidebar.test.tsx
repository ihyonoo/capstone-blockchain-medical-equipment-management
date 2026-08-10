import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ResizableSidebar from './ResizableSidebar';
import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from '../../lib/sidebarResize';

function renderSidebar() {
  render(
    <ResizableSidebar testId="test-sidebar">
      <div>검색 패널 내용</div>
    </ResizableSidebar>,
  );
  return {
    sidebar: screen.getByTestId('test-sidebar'),
    handle: screen.getByTestId('sidebar-resize-handle'),
  };
}

describe('ResizableSidebar', () => {
  it('renders its children inside a muted panel', () => {
    const { sidebar } = renderSidebar();

    expect(screen.getByText('검색 패널 내용')).toBeInTheDocument();
    expect(sidebar.querySelector('.surface-panel')).toHaveClass('surface-panel--muted');
  });

  it('drops its top border so it does not double up with the top bar border', () => {
    const { sidebar } = renderSidebar();

    expect(sidebar.querySelector('.surface-panel')).toHaveClass('border-t-0');
  });

  it('pins itself to the viewport on wide screens so page scroll never cuts its bottom off', () => {
    const { sidebar } = renderSidebar();

    expect(sidebar).toHaveClass('xl:sticky');
    expect(sidebar.className).toContain('xl:h-[calc(100vh-4.8rem-1px)]');
  });

  it('hides the panel on double click and shows it again on the next double click', () => {
    const { handle } = renderSidebar();

    fireEvent.doubleClick(handle);
    expect(screen.queryByText('검색 패널 내용')).not.toBeInTheDocument();

    fireEvent.doubleClick(handle);
    expect(screen.getByText('검색 패널 내용')).toBeInTheDocument();
  });

  it('expands again on a single click while collapsed', () => {
    const { handle } = renderSidebar();

    fireEvent.doubleClick(handle);
    expect(screen.queryByText('검색 패널 내용')).not.toBeInTheDocument();

    fireEvent.click(handle);
    expect(screen.getByText('검색 패널 내용')).toBeInTheDocument();
  });

  it('opens at the default width', () => {
    const { sidebar } = renderSidebar();

    expect(sidebar.style.width).toBe('480px');
  });

  it('collapses and expands from the toggle button on the panel edge', () => {
    const { sidebar } = renderSidebar();

    const toggle = screen.getByTestId('sidebar-collapse-toggle');
    expect(toggle).toHaveAttribute('aria-label', '검색 패널 접기');

    fireEvent.click(toggle);
    expect(screen.queryByText('검색 패널 내용')).not.toBeInTheDocument();
    expect(sidebar.style.width).toBe('32px');
    expect(screen.getByTestId('sidebar-collapse-toggle')).toHaveAttribute('aria-label', '검색 패널 열기');

    fireEvent.click(screen.getByTestId('sidebar-collapse-toggle'));
    expect(screen.getByText('검색 패널 내용')).toBeInTheDocument();
    expect(sidebar.style.width).toBe('480px');
  });

  it('widens by the horizontal drag distance', () => {
    const { sidebar, handle } = renderSidebar();

    fireEvent.mouseDown(handle, { clientX: 500 });
    fireEvent.mouseMove(window, { clientX: 560 });
    fireEvent.mouseUp(window);

    expect(sidebar.style.width).toBe('540px');
  });

  it('clamps the dragged width to the allowed range', () => {
    const { sidebar, handle } = renderSidebar();

    fireEvent.mouseDown(handle, { clientX: 500 });
    fireEvent.mouseMove(window, { clientX: 2000 });
    expect(sidebar.style.width).toBe(`${SIDEBAR_MAX_WIDTH}px`);

    fireEvent.mouseMove(window, { clientX: 0 });
    expect(sidebar.style.width).toBe(`${SIDEBAR_MIN_WIDTH}px`);
  });

  it('stops following the cursor once the drag ends', () => {
    const { sidebar, handle } = renderSidebar();

    fireEvent.mouseDown(handle, { clientX: 500 });
    fireEvent.mouseMove(window, { clientX: 560 });
    fireEvent.mouseUp(window);
    fireEvent.mouseMove(window, { clientX: 600 });

    expect(sidebar.style.width).toBe('540px');
  });
});
