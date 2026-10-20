import axios from 'axios';

const getBaseURL = () => {
  // Priority 1: Vite Environment Variable
  if (import.meta.env?.VITE_API_BASE_URL) {
    const url = import.meta.env.VITE_API_BASE_URL;
    return url.endsWith('/') ? url : `${url}/`;
  }

  // Priority 2: Localhost & LAN IP Detection
  const hostname = window.location.hostname;
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.endsWith('.local');

  if (isLocal) {
    return 'http://127.0.0.1:8000/api/';
  }

  // Priority 3: Fallback Production API Domain
  return 'https://api.melvexbusinesssolutions.com/api/';
};

const BASE_URL = getBaseURL();

const API = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Ensures bearer tokens and baseURL are always attached
API.interceptors.request.use(
  (config) => {
    // Force baseURL to avoid falling back to window.location.origin
    config.baseURL = BASE_URL;

    // Prevent leading slashes in request URLs from stripping the /api/ prefix
    if (config.url && config.url.startsWith('/')) {
      config.url = config.url.substring(1);
    }

    const token =
      localStorage.getItem('access_token') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Token Refresh & 401 Expirations
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || '';

    const isAuthRoute =
      requestUrl.includes('auth/management-login') ||
      requestUrl.includes('auth/login') ||
      requestUrl.includes('auth/user-login') ||
      requestUrl.includes('auth/admin-login') ||
      requestUrl.includes('management/login');

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !isAuthRoute
    ) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const res = await axios.post(`${BASE_URL}auth/refresh/`, {
            refresh: refreshToken,
          });

          if (res.data && res.data.access) {
            const newAccessToken = res.data.access;
            localStorage.setItem('access_token', newAccessToken);
            localStorage.setItem('token', newAccessToken);

            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return API(originalRequest);
          }
        } catch (refreshErr) {
          console.error('Session expired. Redirecting to login...', refreshErr);
        }
      }

      localStorage.clear();
      if (
        window.location.pathname !== '/login' &&
        window.location.pathname !== '/management'
      ) {
        window.location.href = '/management';
      }
    }

    return Promise.reject(error);
  }
);

export default API;