import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, AuthProvider } from '../context/AuthContext';
import { useContext } from 'react';

/** Build a minimal JWT-shaped token (not cryptographically valid, just parseable). */
function makeToken(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ user: payload }));
  return `${header}.${body}.sig`;
}

function TestConsumer() {
  const { token, user, login, logout } = useContext(AuthContext);
  return (
    <div>
      <span data-testid="token">{token ?? 'null'}</span>
      <span data-testid="user-id">{user?.id ?? 'none'}</span>
      <span data-testid="user-role">{user?.role ?? 'none'}</span>
      <button onClick={() => login(makeToken({ id: 'u1', role: 'user' }))}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts with no token when localStorage is empty', () => {
    renderWithRouter();
    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(screen.getByTestId('user-id').textContent).toBe('none');
  });

  it('reads an existing token from localStorage on mount', () => {
    const tok = makeToken({ id: 'abc', role: 'admin' });
    localStorage.setItem('token', tok);
    renderWithRouter();
    expect(screen.getByTestId('token').textContent).toBe(tok);
    expect(screen.getByTestId('user-role').textContent).toBe('admin');
  });

  it('sets token and user after login()', async () => {
    renderWithRouter();
    await act(async () => {
      screen.getByText('login').click();
    });
    expect(screen.getByTestId('user-id').textContent).toBe('u1');
    expect(screen.getByTestId('user-role').textContent).toBe('user');
  });

  it('clears token and user after logout()', async () => {
    renderWithRouter();
    await act(async () => { screen.getByText('login').click(); });
    await act(async () => { screen.getByText('logout').click(); });
    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(screen.getByTestId('user-id').textContent).toBe('none');
  });
});
