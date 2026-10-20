import axios from 'axios';

// Detect and normalize base URL
const getBaseURL = () => {
  let url = import.meta.env?.VITE_API_BASE_URL || 'https://api.melvexbusinesssolutions.com/api/';
  
  // Ensure trailing slash
  if (!url.endsWith('/')) {
    url += '/';
  }

  // Guarantee /api/ path is present in production domain
  if (url.includes('api.melvexbusinesssolutions.com') && !url.includes('/api/')) {
    url = 'https://api.melvexbusinesssolutions.com/api/';
  }

  const hostname = window.location.hostname;
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.');

  if (isLocal && !import.meta.env?.VITE_API_BASE_URL) {
    return 'http://127.0.0.1:8000/api/';
  }

  return url;
};

const BASE_URL = getBaseURL();

const API = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

API.interceptors.request.use(
  (config) => {
    config.baseURL = BASE_URL;

    // Prevent leading slashes from stripping /api/ prefix
    if (config.url && config.url.startsWith('/')) {
      config.url = config.url.substring(1);
    }

    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default API;