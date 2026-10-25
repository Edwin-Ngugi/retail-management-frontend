import axios from 'axios';

const PRODUCTION_API_URL = 'https://api.melvexbusinesssolutions.com/apis/';

const getBaseURL = () => {
  const hostname = window.location.hostname;
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.');

  if (isLocal) {
    return import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000/apis/';
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
    // Force absolute baseURL on every request
    config.baseURL = BASE_URL;

    if (config.url && typeof config.url === 'string') {
      // If the URL starts with absolute domain, convert it to relative endpoint
      if (config.url.startsWith('http://') || config.url.startsWith('https://')) {
        const urlObj = new URL(config.url);
        config.url = urlObj.pathname + urlObj.search;
      }

      // Strip unwanted leading prefixes
      config.url = config.url.replace(/^\/(apis|api)\//, '');
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

    // Attach JWT Bearer Authorization header
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
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('token');
      localStorage.removeItem('user_data');
      localStorage.removeItem('user');
      localStorage.removeItem('username');
      localStorage.removeItem('role');

      const path = window.location.pathname;

      if (path.startsWith('/admin')) {
        if (!path.includes('/admin/login')) {
          window.location.href = '/admin';
        }
      } else if (path.startsWith('/management')) {
        if (!path.includes('/management/login')) {
          window.location.href = '/management';
        }
      } else {
        if (!path.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default API;