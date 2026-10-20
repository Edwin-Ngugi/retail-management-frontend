import axios from 'axios';

// Detect environment dynamically or fall back to production/localhost
const getBaseURL = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    let url = import.meta.env.VITE_API_BASE_URL;
    return url.endsWith('/') ? url : `${url}/`;
  }
  const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  return isLocal
    ? 'http://127.0.0.1:8000/api/'
    : 'https://api.melvexbusinesssolutions.com/api/';
};

const BASE_URL = getBaseURL();

const API = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach bearer token dynamically
API.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('access_token') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle token expiration & automatic refresh
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Do NOT trigger refresh/redirect loops if the 401 occurred on a login or auth route
    const isAuthRoute =
      originalRequest.url.includes('auth/management-login') ||
      originalRequest.url.includes('auth/login') ||
      originalRequest.url.includes('auth/user-login') ||
      originalRequest.url.includes('auth/admin-login') ||
      originalRequest.url.includes('management/login');

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
          // Points to the correct Django auth/refresh/ endpoint
          const res = await axios.post(`${BASE_URL}auth/refresh/`, {
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
          console.error('Session expired. Redirecting to login...', refreshErr);
        }
      }

      // Clear local storage and redirect to portal root if refresh fails
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