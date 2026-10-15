// src/api.js
import axios from 'axios';

// Detect whether running on local dev machine or production build
const isLocalhost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

// Always use local Django backend when developing locally
const defaultBaseURL = isLocalhost
  ? 'http://127.0.0.1:8000/api/'
  : 'https://api.melvexbusinesssolutions.com/api/';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || defaultBaseURL,
});

API.interceptors.request.use((config) => {
  const token =
    localStorage.getItem('access_token') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;