import axios from 'axios';

// Detect and normalize base URL to /apis/
const getBaseURL = () => {
  let url = import.meta.env?.VITE_API_BASE_URL || 'https://api.melvexbusinesssolutions.com/apis/';
  
  // Guarantee /apis/ path is present in production domain
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

API.interceptors.request.use(
  (config) => {
    config.baseURL = BASE_URL;

    // Remove leading slashes/prefixes from request URLs to prevent double slashes or route duplication
    if (config.url) {
      if (config.url.startsWith('http://') || config.url.startsWith('https://')) {
        const urlObj = new URL(config.url);
        config.url = urlObj.pathname + urlObj.search;
      }
      
      // Clean leading slashes and duplicate api/apis prefixes
      config.url = config.url.replace(/^\/(apis|api)\//, '');
      if (config.url.startsWith('/')) {
        config.url = config.url.slice(1);
      }
    }

    // Attach JWT Authorization Header dynamically
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default API;