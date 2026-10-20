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

  // Password Reset Modal State (No Old Password required)
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState({ type: '', text: '' });

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
      const response = await API.post('auth/management-login/', {
        username: username.trim(),
        password: password,
        branch: selectedBranch,
      });

      const { token, access, user } = response.data || {};
      const activeToken = token || access;

      if (activeToken) {
        localStorage.setItem('access_token', activeToken);
        localStorage.setItem('token', activeToken);
      }

      const userData = user || {
        name: username,
        role: 'Admin',
        email: `${username}@admin.com`,
        branch: selectedBranch,
      };

      localStorage.setItem('user', JSON.stringify(userData));

      if (onLoginSuccess) {
        onLoginSuccess(userData);
      } else {
        window.location.reload();
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

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetMsg({ type: '', text: '' });

    if (!resetUsername.trim() || !resetNewPassword) {
      setResetMsg({ type: 'error', text: 'Please fill in both username and new password.' });
      return;
    }

    setResetLoading(true);

    try {
      const res = await API.post('auth/reset-forgot-password/', {
        username: resetUsername.trim(),
        new_password: resetNewPassword,
      });

      setResetMsg({
        type: 'success',
        text: res.data?.detail || 'Password reset successfully! You can now log in.',
      });

      setTimeout(() => {
        setShowResetModal(false);
        setResetMsg({ type: '', text: '' });
        setResetUsername('');
        setResetNewPassword('');
      }, 2000);
    } catch (err) {
      setResetMsg({
        type: 'error',
        text:
          err.response?.data?.error ||
          err.response?.data?.detail ||
          'Failed to reset password. Please check the username.',
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-100 relative">
      <div className="absolute w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -top-20 -left-20"></div>
      <div className="absolute w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20"></div>

      <div className="w-full max-w-md bg-[#0e1626] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        
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

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start justify-between gap-2 animate-shake">
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-base">⚠️</span>
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage('')} className="font-bold hover:text-white">✕</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="absolute right-3.5 top-3 pointer-events-none text-slate-400 text-xs">▼</div>
            </div>
          </div>

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

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Password / Passcode
              </label>
              <button
                type="button"
                onClick={() => {
                  setResetUsername(username);
                  setShowResetModal(true);
                }}
                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
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

        <div className="pt-2 border-t border-slate-800 text-center">
          <p className="text-[10px] text-slate-500">
            Authorized Personnel Only • Encrypted Executive Access Session
          </p>
        </div>

      </div>

      {/* FORGOT PASSWORD MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1626] border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-4 relative z-20">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                🔑 Reset Forgotten Password
              </h3>
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetMsg({ type: '', text: '' });
                }}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            {resetMsg.text && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  resetMsg.type === 'success'
                    ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                }`}
              >
                {resetMsg.text}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Admin Username
                </label>
                <input
                  type="text"
                  required
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full bg-[#070a12] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#070a12] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetMsg({ type: '', text: '' });
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {resetLoading ? 'Resetting...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}