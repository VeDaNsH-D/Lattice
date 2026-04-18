const BACKEND_BASE_URL = (import.meta.env.VITE_LATTICE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const API_BASE_URL = BACKEND_BASE_URL.endsWith('/api') ? BACKEND_BASE_URL : `${BACKEND_BASE_URL}/api`;

const getAuthToken = () => {
  try {
    return window.localStorage.getItem('latticeToken') || '';
  } catch (error) {
    return '';
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
    const message = payload?.message || payload?.error || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
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

export const getBackendBaseUrl = () => BACKEND_BASE_URL;
export const getBackendOrigin = () => BACKEND_BASE_URL;
