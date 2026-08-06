import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import StaffNav from './StaffNav';

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
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
});
