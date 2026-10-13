// src/components/AdminLogin.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

export default function AdminLogin({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Direct call to dedicated Admin Login endpoint
      const response = await API.post(
        'auth/admin-login/',
        {
          username: formData.username.trim(),
          password: formData.password,
        },
        { timeout: 15000 }
      );

      const token = response.data?.access;

      if (!token) {
        throw new Error('No access token received from server.');
      }

      // Store tokens and session timer
      localStorage.setItem('access_token', token);
      localStorage.setItem('token', token);

      if (response.data?.refresh) {
        localStorage.setItem('refresh_token', response.data.refresh);
      }

      if (response.data?.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('user_data', JSON.stringify(response.data.user));
      }

      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(response.data);
      } else {
        navigate('/admin');
      }
    } catch (err) {
      console.error('Login Error caught:', err);

      let detail = 'Invalid admin credentials.';

      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        detail = 'Cannot connect to backend server. Verify Django server is running.';
      } else if (err.code === 'ECONNABORTED') {
        detail = 'Request timed out. Please check your network connection.';
      } else if (err.response?.status === 403) {
        detail = err.response?.data?.error || 'Access denied. Administrative privileges required.';
      } else if (err.response?.data) {
        detail =
          err.response.data.detail ||
          err.response.data.error ||
          JSON.stringify(err.response.data);
      }

      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-200/80 text-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white border border-slate-300 rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 border border-indigo-300 text-indigo-700 mb-2">
            🛡️
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Admin Portal Login</h1>
          <p className="text-xs text-slate-600">Sign in to access admin system controls</p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-slate-400 hover:text-slate-600 font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Admin Username
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter admin username"
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none transition"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs shadow-sm transition disabled:opacity-50 mt-2 cursor-pointer"
          >
            {loading ? 'Authenticating Admin...' : 'Sign In to Admin Portal'}
          </button>
        </form>
      </div>
    </div>
  );
}