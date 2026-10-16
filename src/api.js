// src/api.js
import axios from 'axios';

const API = axios.create({
  baseURL: 'https://api.melvexbusinesssolutions.com/api/',
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
          // Attempt silent token refresh
          const res = await axios.post(
            'https://api.melvexbusinesssolutions.com/api/token/refresh/',
            { refresh: refreshToken }
          );

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