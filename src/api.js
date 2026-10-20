import axios from 'axios';

// Dynamically determine the API base URL for both online and local environments
const getBaseURL = () => {
  // 1. Environment variable override (highest priority)
  if (import.meta.env?.VITE_API_BASE_URL) {
    const url = import.meta.env.VITE_API_BASE_URL;
    return url.endsWith('/') ? url : `${url}/`;
  }

  // 2. Dynamic host detection for local development and LAN testing
  const hostname = window.location.hostname;
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.endsWith('.local');

  if (isLocal) {
    // Uses standard local Django port 8000
    return 'http://127.0.0.1:8000/api/';
  }

  // 3. Fallback to production domain
  return 'https://api.melvexbusinesssolutions.com/api/';
};

// Initialize Axios instance
const API = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Dynamically attach Base URL and Bearer Token
API.interceptors.request.use(
  (config) => {
    // Compute current base URL dynamically on each request
    const baseURL = getBaseURL();
    config.baseURL = baseURL;

    const token =
      localStorage.getItem('access_token') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle token refresh and auth exceptions
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Prevent redirect loops on login/authentication endpoints[cite: 7]
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
          const activeBaseURL = getBaseURL();
          // Points to Django auth/refresh/ endpoint[cite: 7]
          const res = await axios.post(`${activeBaseURL}auth/refresh/`, {
            refresh: refreshToken,
          });

          if (res.data && res.data.access) {
            const newAccessToken = res.data.access;
            localStorage.setItem('access_token', newAccessToken);
            localStorage.setItem('token', newAccessToken);

            // Retry original failed request with the new access token
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return API(originalRequest);
          }
        } catch (refreshErr) {
          console.error('Session expired. Redirecting to login portal...', refreshErr);
        }
      }

      // Clear expired credentials and prevent redundant redirects
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