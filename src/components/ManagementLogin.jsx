// src/components/ManagementLogin.jsx
import React, { useState } from 'react';
import API from '../api';

export default function ManagementLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Password Reset Modal State (2-Step OTP Reset)
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetUsername, setResetUsername] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState({ type: '', text: '' });

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

    if (!resetUsername.trim() || !resetEmail.trim()) {
      setResetMsg({ type: 'error', text: 'Please enter both your username and email address.' });
      return;
    }

    setResetLoading(true);

    try {
      const res = await API.post('auth/request-otp/', {
        username: resetUsername.trim(),
        email: resetEmail.trim(),
      });

      setResetMsg({
        type: 'success',
        text: res.data?.detail || `An OTP code has been sent to ${resetEmail.trim()}.`,
      });

      setResetStep(2);
    } catch (err) {
      setResetMsg({
        type: 'error',
        text:
          err.response?.data?.error ||
          err.response?.data?.detail ||
          'Failed to send OTP code. Please verify your username and email.',
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
    setResetEmail('');
    setOtpCode('');
    setResetNewPassword('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800 relative">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl relative z-10 space-y-6">
        
        {/* BRAND LOGO & HEADER */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <img 
              src="/logo.svg" 
              alt="Melvex Business Solutions" 
              className="h-14 w-auto object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-wide uppercase">
              MELVEX
            </h1>
            <p className="text-xs font-bold text-teal-600 uppercase tracking-wider mt-0.5">
              Management Portal
            </p>
          </div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Sign in to access review portal and analytics.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start justify-between gap-2 shadow-xs">
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-base">⚠️</span>
              <span className="font-semibold">{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage('')} className="font-bold text-rose-500 hover:text-rose-700">✕</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* ADMIN USERNAME */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-teal-600 transition"
            />
          </div>

          {/* ADMIN PASSWORD */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Password
            </label>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-teal-600 transition pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs transition"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {/* FORGOT PASSWORD LINK BELOW FIELD */}
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                onClick={() => {
                  setResetUsername(username);
                  setShowResetModal(true);
                }}
                className="text-[11px] font-bold text-teal-700 hover:text-teal-900 hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Sign In to Management Portal</span>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-medium">
            Authorized Personnel Only • Encrypted Executive Access Session
          </p>
        </div>

      </div>

      {/* 2-STEP OTP RESET MODAL WITH EMAIL FIELD */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-4 relative z-20">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                🔑 Password Reset via OTP
              </h3>
              <button onClick={closeResetModal} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            {resetMsg.text && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  resetMsg.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                {resetMsg.text}
              </div>
            )}

            {resetStep === 1 && (
              <form onSubmit={handleRequestOTP} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    placeholder="Enter admin username"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-teal-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-teal-600 transition"
                  />
                  <p className="text-[10px] text-slate-500 font-medium mt-1">
                    A 6-digit OTP code will be sent to this email address.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeResetModal}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {resetLoading ? 'Sending OTP...' : 'Send Reset OTP'}
                  </button>
                </div>
              </form>
            )}

            {resetStep === 2 && (
              <form onSubmit={handleVerifyAndResetPassword} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength="6"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono tracking-widest text-center outline-none focus:border-teal-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-teal-600 transition"
                  />
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setResetStep(1)}
                    className="text-[11px] text-teal-700 hover:underline font-bold"
                  >
                    ← Back
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeResetModal}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer disabled:opacity-50"
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