import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import AdminNav from './AdminNav';

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

describe('AdminNav', () => {
  it('marks only the active tab with app-nav-tab--active', () => {
    render(
      <MemoryRouter initialEntries={['/admin/devices']}>
        <AdminNav active="devices" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: '기기 상태' })).toHaveClass('app-nav-tab--active');
    expect(screen.getByRole('button', { name: 'NFC 매핑' })).toHaveClass('app-nav-tab');
    expect(screen.getByRole('button', { name: 'NFC 매핑' })).not.toHaveClass('app-nav-tab--active');
  });

  it('navigates to the matching route when an inactive tab is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/admin/devices']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <AdminNav active="devices" />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'NFC 매핑' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/nfc-mapping');
  });
});
