import { api } from './api';

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
}

export const authApi = {
  register: (username: string, password: string) => api<{ user: AuthUser }>('POST', '/api/auth/register', { username, password }),
  login: (username: string, password: string) => api<{ user: AuthUser }>('POST', '/api/auth/login', { username, password }),
  setCredentials: (username: string, password: string) => api<{ user: AuthUser }>('POST', '/api/auth/set-credentials', { username, password }),
  requestOtp: (name: string, email: string) => api<{ ok: true }>('POST', '/api/auth/request-otp', { name, email }),
  verifyOtp: (email: string, code: string) => api<{ user: AuthUser }>('POST', '/api/auth/verify-otp', { email, code }),
  me: () => api<{ user: AuthUser }>('GET', '/api/auth/me'),
  logout: () => api<{ ok: true }>('POST', '/api/auth/logout', {}),
};

export async function signOut() {
  await authApi.logout().catch(() => undefined);
  window.location.assign('/'); // reload: the session is gone, so the sign-in screen appears
}
