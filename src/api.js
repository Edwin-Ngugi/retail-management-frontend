import axios from 'axios';

const PRODUCTION_API_URL = 'https://api.melvexbusinesssolutions.com/api/';

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

const BASE_URL = getBaseURL().endsWith('/') ? getBaseURL() : `${getBaseURL()}/`;

const API = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

API.interceptors.request.use(
  (config) => {
    // Standardize relative URLs with proper trailing slashes
    if (config.url && typeof config.url === 'string' && !config.url.startsWith('http')) {
      // Clean leading slash so standard baseURL concatenation works properly
      if (config.url.startsWith('/')) {
        config.url = config.url.slice(1);
      }

      // Ensure trailing slash before query parameters
      if (config.url.includes('?')) {
        const [path, query] = config.url.split('?');
        const formattedPath = path.endsWith('/') ? path : `${path}/`;
        config.url = `${formattedPath}?${query}`;
      } else if (!config.url.endsWith('/')) {
        config.url = `${config.url}/`;
      }
    }

    // Attach JWT Bearer Token if logged in
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
      localStorage.clear();
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