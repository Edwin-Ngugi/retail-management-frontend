import axios from 'axios';

const API = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/',
  timeout: 100000, // Extended timeout to accommodate slower backend starts
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization Token to every request
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auto-handle 401 Unauthorized
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      
      // Prevent infinite loops if the request was already a login attempt
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default API;