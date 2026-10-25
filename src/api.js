import axios from 'axios';

const getBaseURL = () => {
  let url = import.meta.env?.VITE_API_BASE_URL || 'https://api.melvexbusinesssolutions.com/apis/';
  
  if (url.includes('api.melvexbusinesssolutions.com')) {
    url = 'https://api.melvexbusinesssolutions.com/apis/';
  }

  const hostname = window.location.hostname;
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.');

  if (isLocal && !import.meta.env?.VITE_API_BASE_URL) {
    return 'http://127.0.0.1:8000/apis/';
  }

  return url.endsWith('/') ? url : `${url}/`;
};

const BASE_URL = getBaseURL();

const API = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Bearer token & sanitize URLs
API.interceptors.request.use(
  (config) => {
    config.baseURL = BASE_URL;

    if (config.url) {
      if (config.url.startsWith('http://') || config.url.startsWith('https://')) {
        const urlObj = new URL(config.url);
        config.url = urlObj.pathname + urlObj.search;
      }
      
      config.url = config.url.replace(/^\/(apis|api)\//, '');
      if (config.url.startsWith('/')) {
        config.url = config.url.slice(1);
      }
    }

    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Route 401s dynamically by portal
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear session storage
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('token');
      localStorage.removeItem('user_data');
      localStorage.removeItem('user');
      localStorage.removeItem('username');
      localStorage.removeItem('role');

      const path = window.location.pathname;

      // Smart Redirect based on current active portal
      if (path.startsWith('/admin')) {
        if (!path.includes('/admin/login')) {
          window.location.href = '/admin'; // Triggers AdminLogin via App.jsx AdminRoute
        }
      } else if (path.startsWith('/management')) {
        if (!path.includes('/management/login')) {
          window.location.href = '/management'; // Triggers ManagementLogin via ManagementRoute
        }
      } else {
        if (!path.includes('/login')) {
          window.location.href = '/login'; // Triggers AuthPage via ProtectedRoute
        }
      }
    }
    return Promise.reject(error);
  }
);

export default API;