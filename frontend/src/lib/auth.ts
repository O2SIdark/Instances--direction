const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface Utilisateur {
  id:        string;
  nom:       string;
  prenom:    string;
  email:     string;
  role:      'admin' | 'validateur' | 'agent';
  direction: string;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function getUtilisateur(): Utilisateur | null {
  if (typeof window === 'undefined') return null;
  const u = localStorage.getItem('user');
  try { return u ? JSON.parse(u) : null; } catch { return null; }
}

export function setSession(token: string, user: Utilisateur) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// Fetch authentifié
export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    },
  });

  if (res.status === 401) {
    clearSession();
    window.location.href = '/login';
    throw new Error('Session expirée');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur API');
  return data;
}
