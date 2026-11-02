import axios from 'axios';

const PRODUCTION_API_URL = 'https://api.melvexbusinesssolutions.com/api/';

// Helper to determine HTTP API base URL
const getBaseURL = () => {
  const hostname = window.location.hostname;
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.');

  if (isLocal) {
    return import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/';
  }

  return import.meta.env?.VITE_API_BASE_URL || PRODUCTION_API_URL;
};

// Export dynamic WebSocket Base URL helper for Channels
export const getWebSocketURL = (path = '') => {
  const httpUrl = getBaseURL();
  const protocol = httpUrl.startsWith('https') ? 'wss:' : 'ws:';
  
  // Extract base host domain (e.g., api.melvexbusinesssolutions.com or 127.0.0.1:8000)
  const host = httpUrl.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '').replace(/\/$/, '');
  
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  const tokenParam = token ? `?token=${token}` : '';

  return `${protocol}//${host}${cleanPath}${tokenParam}`;
};

const BASE_URL = getBaseURL().endsWith('/') ? getBaseURL() : `${getBaseURL()}/`;

const API = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

API.interceptors.request.use(
  (config) => {
    // 1. Remove forced JSON header if sending FormData (fixes file/image uploads)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    // 2. Standardize relative URLs with proper trailing slashes for Django
    if (config.url && typeof config.url === 'string' && !config.url.startsWith('http')) {
      if (config.url.startsWith('/')) {
        config.url = config.url.slice(1);
      }

      if (config.url.includes('?')) {
        const [path, query] = config.url.split('?');
        const formattedPath = path.endsWith('/') ? path : `${path}/`;
        config.url = `${formattedPath}?${query}`;
      } else if (!config.url.endsWith('/')) {
        config.url = `${config.url}/`;
      }
    }

    // 3. Attach JWT Bearer Token if available
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token keys specifically instead of entire localStorage to preserve app preferences
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
      
      const path = window.location.pathname;

      if (path.startsWith('/admin') && !path.includes('/admin/login')) {
        window.location.href = '/admin';
      } else if (path.startsWith('/management') && !path.includes('/management/login')) {
        window.location.href = '/management';
      } else if (!path.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default API;