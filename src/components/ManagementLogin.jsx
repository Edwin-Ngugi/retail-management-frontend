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

  // Password Reset Modal State (2-Step OTP Reset)
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetUsername, setResetUsername] = useState('');
  const [otpCode, setOtpCode] = useState('');
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

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setResetMsg({ type: '', text: '' });

    if (!resetUsername.trim()) {
      setResetMsg({ type: 'error', text: 'Please enter your username.' });
      return;
    }

    setResetLoading(true);

    try {
      const res = await API.post('auth/request-otp/', {
        username: resetUsername.trim(),
      });

      setResetMsg({
        type: 'success',
        text: res.data?.detail || 'An OTP code has been sent to your registered contacts.',
      });

      setResetStep(2);
    } catch (err) {
      setResetMsg({
        type: 'error',
        text:
          err.response?.data?.error ||
          err.response?.data?.detail ||
          'Failed to send OTP code. Please check username.',
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyAndResetPassword = async (e) => {
    e.preventDefault();
    setResetMsg({ type: '', text: '' });

    if (!otpCode.trim() || !resetNewPassword) {
      setResetMsg({ type: 'error', text: 'Please enter both the OTP code and new password.' });
      return;
    }

    setResetLoading(true);

    try {
      const res = await API.post('auth/verify-otp-reset/', {
        username: resetUsername.trim(),
        otp_code: otpCode.trim(),
        new_password: resetNewPassword,
      });

      setResetMsg({
        type: 'success',
        text: res.data?.detail || 'Password reset successfully! You can now log in.',
      });

      setTimeout(() => {
        closeResetModal();
      }, 2000);
    } catch (err) {
      setResetMsg({
        type: 'error',
        text:
          err.response?.data?.error ||
          err.response?.data?.detail ||
          'Invalid or expired OTP code. Please try again.',
      });
    } finally {
      setResetLoading(false);
    }
  };

  const closeResetModal = () => {
    setShowResetModal(false);
    setResetStep(1);
    setResetMsg({ type: '', text: '' });
    setResetUsername('');
    setOtpCode('');
    setResetNewPassword('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-100 relative">
      {/* Background Glow */}
      <div className="absolute w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none -top-20 -left-20"></div>
      <div className="absolute w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20"></div>

      <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
        
        {/* BRAND LOGO & HEADER */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <img 
              src="/logo.svg" 
              alt="Melvex Business Solutions Logo" 
              className="h-14 w-auto object-contain bg-white/10 p-2 rounded-2xl border border-slate-700/80 shadow-md"
            />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-widest uppercase">
              MELVEX
            </h1>
            <p className="text-xs font-bold text-teal-400 uppercase tracking-wider mt-0.5">
              Management Portal
            </p>
          </div>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            Sign in with administrative credentials to access financial reports and analytics.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-start justify-between gap-2 shadow-sm">
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-base">⚠️</span>
              <span className="font-semibold">{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage('')} className="font-black hover:text-white">✕</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* BRANCH SELECT */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5 uppercase tracking-wider">
              Assigned Branch
            </label>
            <div className="relative">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-teal-500 transition appearance-none cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                    {b.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-3 pointer-events-none text-teal-400 text-xs">▼</div>
            </div>
          </div>

          {/* ADMIN USERNAME */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5 uppercase tracking-wider">
              Admin Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. edwin_admin"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white placeholder-slate-500 outline-none focus:border-teal-500 transition"
            />
          </div>

          {/* ADMIN PASSWORD */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                Password
              </label>
              
              {/* CLEAR & PROMINENT FORGOT PASSWORD BUTTON */}
              <button
                type="button"
                onClick={() => {
                  setResetUsername(username);
                  setShowResetModal(true);
                }}
                className="px-2.5 py-0.5 rounded-lg bg-teal-950 border border-teal-700 text-teal-300 text-[11px] font-extrabold hover:bg-teal-900 hover:text-white transition cursor-pointer"
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
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white placeholder-slate-500 outline-none focus:border-teal-500 transition pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-teal-300 text-xs transition"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-teal-950 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer uppercase tracking-wider"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Authenticating Admin...</span>
              </>
            ) : (
              <span>Sign In to Management Portal</span>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-800 text-center">
          <p className="text-[10px] text-slate-400 font-semibold">
            Authorized Personnel Only • Encrypted Executive Access Session
          </p>
        </div>

      </div>

      {/* 2-STEP OTP RESET MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-4 relative z-20">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                🔑 Password Reset via OTP
              </h3>
              <button onClick={closeResetModal} className="text-slate-400 hover:text-white font-bold">✕</button>
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

            {resetStep === 1 && (
              <form onSubmit={handleRequestOTP} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Admin Username
                  </label>
                  <input
                    type="text"
                    required
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    placeholder="Enter admin username"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-white outline-none focus:border-teal-500 transition"
                  />
                  <p className="text-[10px] text-slate-400 font-medium mt-1">
                    A 6-digit OTP code will be dispatched to your registered contacts.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={closeResetModal}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {resetLoading ? 'Sending OTP...' : 'Send Reset OTP'}
                  </button>
                </div>
              </form>
            )}

            {resetStep === 2 && (
              <form onSubmit={handleVerifyAndResetPassword} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength="6"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono tracking-widest text-center outline-none focus:border-teal-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-white outline-none focus:border-teal-500 transition"
                  />
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setResetStep(1)}
                    className="text-[11px] text-teal-400 hover:text-teal-300 font-bold"
                  >
                    ← Back
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeResetModal}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {resetLoading ? 'Verifying...' : 'Verify OTP & Reset'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}