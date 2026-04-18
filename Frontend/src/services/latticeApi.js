import { API_BASE_URL } from '../utils/api';

const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

const getAuthToken = () => {
  try {
    return window.localStorage.getItem('token') || window.localStorage.getItem('latticeToken') || '';
  } catch (error) {
    return '';
  }
};

const clearStoredAuth = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem('token');
  window.localStorage.removeItem('latticeToken');
};

const redirectToLogin = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const onAuthPage = window.location.pathname === '/login' || window.location.pathname === '/signup';
  if (!onAuthPage) {
    window.location.assign('/login');
  }
};

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredAuth();
      redirectToLogin();
    }

    const message = payload?.message || payload?.error || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (payload?.success === false) {
    throw new Error(payload?.message || payload?.error || 'Request failed.');
  }

  return payload || {};
};

export const getLatticeGraph = (latticeId) => {
  return requestJson(`/lattice/${latticeId}/graph`, { method: 'GET' });
};

export const getRelatedNodes = (nodeId) => {
  return requestJson(`/node/${nodeId}/related`, { method: 'GET' });
};

export const queryLattice = (latticeId, question) => {
  return requestJson(`/lattice/${latticeId}/query`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
};

export const getLattices = () => {
  return requestJson('/lattices', { method: 'GET' });
};

export const searchSpotlight = ({ query = '', latticeId = '', limit = 8 } = {}) => {
  const params = new URLSearchParams();

  if (query) {
    params.set('q', query);
  }

  if (latticeId) {
    params.set('latticeId', latticeId);
  }

  if (limit) {
    params.set('limit', String(limit));
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return requestJson(`/search/spotlight${suffix}`, { method: 'GET' });
};

export const getBackendBaseUrl = () => BACKEND_BASE_URL;
export const getBackendOrigin = () => BACKEND_BASE_URL;
