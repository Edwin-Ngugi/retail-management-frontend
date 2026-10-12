// src/components/ManagementLogin.jsx
import React, { useState } from 'react';
import API from '../api';

export default function ManagementLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('Sukawa');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const branches = [
    { id: 'Sukawa', name: 'Sukawa Branch' },
    { id: 'Nairobi', name: 'Nairobi Main Branch' },
    { id: 'Meru', name: 'Meru Branch' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim() || !password) {
      setErrorMessage('Please enter both your admin username and password.');
      return;
    }

    setLoading(true);

    try {
      // Send management authentication request to backend
      const response = await API.post('management/login/', {
        username: username.trim(),
        password: password,
        branch: selectedBranch,
      });

      const { token, user } = response.data || {};

      if (token) {
        localStorage.setItem('authToken', token);
      }

      const userData = user || {
        name: username,
        role: 'Admin',
        email: `${username}@admin.com`,
        branch: selectedBranch,
      };

      if (onLoginSuccess) {
        onLoginSuccess(userData);
      } else {
        alert('Login successful! Redirecting to Management Portal...');
        window.location.href = '/management';
      }
    } catch (err) {
      console.error('Management login error:', err);
      setErrorMessage(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          'Invalid credentials or insufficient admin privileges.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-100">
      {/* Background Subtle Gradient Glow */}
      <div className="absolute w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -top-20 -left-20"></div>
      <div className="absolute w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20"></div>

      <div className="w-full max-w-md bg-[#0e1626] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        
        {/* Header Section */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-xl">
            🛡️
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Management Portal
          </h1>
          <p className="text-xs text-slate-400">
            Sign in with executive administrative credentials to access reviews & financial statements.
          </p>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2 animate-shake">
            <span className="shrink-0 text-base">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Branch Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Assigned Branch
            </label>
            <div className="relative">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full bg-[#070a12] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none focus:border-indigo-500 transition appearance-none cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                    {b.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-3 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* Admin Username */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Admin Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. edwin_admin"
              className="w-full bg-[#070a12] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Admin Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Password / Passcode
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#070a12] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs transition"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Authenticating Admin...</span>
              </>
            ) : (
              <>
                <span>🔐</span>
                <span>Enter Management Review Center</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Security Note */}
        <div className="pt-2 border-t border-slate-800 text-center">
          <p className="text-[10px] text-slate-500">
            Authorized Personnel Only • Encrypted Executive Access Session
          </p>
        </div>

      </div>
    </div>
  );
}