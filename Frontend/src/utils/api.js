export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);

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

function resolveApiRequestArgs(arg1, arg2, arg3) {
    if (typeof arg1 === 'string' && HTTP_METHODS.has(arg1.toUpperCase()) && typeof arg2 === 'string') {
        const method = arg1.toUpperCase();
        const endpoint = arg2;

        if (arg3 && typeof arg3 === 'object') {
            if (
                Object.prototype.hasOwnProperty.call(arg3, 'method')
                || Object.prototype.hasOwnProperty.call(arg3, 'headers')
                || Object.prototype.hasOwnProperty.call(arg3, 'body')
            ) {
                return {
                    endpoint,
                    options: {
                        ...arg3,
                        method,
                    },
                };
            }

            return {
                endpoint,
                options: {
                    method,
                    body: JSON.stringify(arg3),
                },
            };
        }

        return {
            endpoint,
            options: { method },
        };
    }

    return {
        endpoint: arg1,
        options: arg2 || {},
    };
}

export async function apiRequest(arg1, arg2 = {}, arg3) {
    const { endpoint, options } = resolveApiRequestArgs(arg1, arg2, arg3);
    const token = localStorage.getItem('token');
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    const headers = new Headers(options.headers || {});

    const shouldSkipJsonHeader = typeof FormData !== 'undefined' && options.body instanceof FormData;

    if (!headers.has('Content-Type') && !shouldSkipJsonHeader) {
        headers.set('Content-Type', 'application/json');
    }

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}${normalizedEndpoint}`, {
        ...options,
        headers,
    });

    const contentType = response.headers.get('content-type') || '';
    let data = null;

    if (contentType.includes('application/json')) {
        data = await response.json();
    } else {
        const text = await response.text();
        data = text ? { message: text } : null;
    }

    if (!response.ok) {
        if (response.status === 401) {
            clearStoredAuth();
            redirectToLogin();
        }

        const error = new Error(data?.message || `Request failed with status ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
}
