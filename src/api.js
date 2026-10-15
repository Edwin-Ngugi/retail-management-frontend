// src/api.js
import axios from 'axios';

const isLocalhost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

// Base host domain
const rawBaseURL = import.meta.env.VITE_API_BASE_URL || (
  isLocalhost
    ? 'http://127.0.0.1:8000/api/'
    : 'https://api.melvexbusinesssolutions.com/api/'
);

// Guarantee trailing '/api/' prefix is always present
const normalizedBaseURL = rawBaseURL.endsWith('/api/')
  ? rawBaseURL
  : rawBaseURL.endsWith('/')
  ? `${rawBaseURL}api/`
  : `${rawBaseURL}/api/`;

const API = axios.create({
  baseURL: normalizedBaseURL,
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