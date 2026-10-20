import axios from 'axios';

// Detect environment dynamically or fall back to localhost during local development
const getBaseURL = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
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

    // Handle 401 Unauthorized errors caused by expired access tokens
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          // Dynamic endpoint refresh based on active BASE_URL
          const res = await axios.post(`${BASE_URL}token/refresh/`, {
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

      // If refresh fails or no refresh token exists, clear storage and redirect
      localStorage.clear();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default API;