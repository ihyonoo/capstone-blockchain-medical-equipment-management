import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import StaffNav from './StaffNav';

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('StaffNav', () => {
  it('marks only the active tab with app-nav-tab--active', () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <StaffNav active="equipment" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: '장비 검색' })).toHaveClass('app-nav-tab--active');
    expect(screen.getByRole('button', { name: '마이페이지' })).not.toHaveClass('app-nav-tab--active');
  });

  it('navigates to the matching route when an inactive tab is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/equipment']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <StaffNav active="equipment" />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '마이페이지' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/me');
  });

  describe('on a narrow (mobile) viewport', () => {
    beforeEach(() => setViewportWidth(375));
    afterEach(() => setViewportWidth(1440));

    it('hides the tab buttons behind a menu toggle', () => {
      render(
        <MemoryRouter initialEntries={['/equipment']}>
          <StaffNav active="equipment" />
        </MemoryRouter>,
      );

      expect(screen.queryByRole('button', { name: '마이페이지' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '메뉴 열기' })).toBeInTheDocument();
    });

    it('reveals the tabs when the toggle is opened, and navigates + closes on tab click', () => {
      render(
        <MemoryRouter initialEntries={['/equipment']}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  <StaffNav active="equipment" />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
      expect(screen.getByRole('button', { name: '마이페이지' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '마이페이지' }));
      expect(screen.getByTestId('location')).toHaveTextContent('/me');
      expect(screen.queryByRole('button', { name: '마이페이지' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '메뉴 열기' })).toBeInTheDocument();
    });
  });
});
