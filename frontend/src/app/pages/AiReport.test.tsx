import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import AiReport from './AiReport';
import { LOGIN_PATH } from '../lib/auth';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe('AiReport auth guard', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('redirects to LOGIN_PATH when there is no session', () => {
    render(
      <MemoryRouter initialEntries={['/admin/ai-report']}>
        <Routes>
          <Route path="/admin/ai-report" element={<AiReport />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location')).toHaveTextContent(LOGIN_PATH);
  });
});
