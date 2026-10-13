// src/components/AuthPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

export default function AuthPage({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    branch: 'all', // Default to "All Branches"
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBranches = async () => {
      setLoadingBranches(true);
      try {
        const response = await API.get('branches/');
        const data = response.data;
        setBranches(data);
      } catch (err) {
        console.error('Failed to load branches:', err);
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchBranches();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const endpoint = isLogin ? 'auth/user-login/' : 'auth/register/';

    // Convert multi-word username (e.g. "Lilian Jackson") to valid Django username ("lilian_jackson")
    const cleanUsername = formData.username.trim().replace(/\s+/g, '_').toLowerCase();
    
    // Split input into first_name and last_name if multiple names are entered
    const nameParts = formData.username.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Format registration payload
    const payload = isLogin
      ? { 
          username: formData.username.trim(), 
          password: formData.password 
        }
      : {
          username: cleanUsername,
          first_name: firstName,
          last_name: lastName,
          email: formData.email.trim(),
          password: formData.password,
          branch: formData.branch === 'all' ? null : parseInt(formData.branch, 10),
          branch_id: formData.branch === 'all' ? null : parseInt(formData.branch, 10),
          assigned_all_branches: formData.branch === 'all',
        };

    try {
      const response = await API.post(endpoint, payload);
      const data = response.data;

      if (isLogin) {
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        localStorage.setItem('token', data.access);

        const userObj = data.user || {
          username: data.username || formData.username,
          role: 'User',
          is_staff: false,
          is_superuser: false,
        };

        localStorage.setItem('username', userObj.username);
        localStorage.setItem('user_data', JSON.stringify(userObj));

        if (onLoginSuccess) {
          onLoginSuccess(userObj);
        }

        navigate('/');
      } else {
        setIsLogin(true);
        alert('Registration successful! Please log in with your credentials.');
      }
    } catch (err) {
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === 'object') {
          const firstKey = Object.keys(data)[0];
          const firstErr = Array.isArray(data[firstKey]) ? data[firstKey][0] : data[firstKey];
          setError(`${firstKey.toUpperCase()}: ${firstErr}`);
        } else {
          setError(data.error || data.detail || 'Registration failed');
        }
      } else {
        setError(err.message || 'Authentication failed');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-200 flex flex-col justify-center items-center px-4 font-sans">
      <div className="w-full max-w-md bg-[#111827] border border-gray-800 rounded-xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-lg mb-2">
            🔒
          </div>
          <h2 className="text-2xl font-semibold text-white">
            {isLogin ? 'User Portal Sign In' : 'Create an account'}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            {isLogin ? 'Enter your credentials to access POS' : 'Fill in the details below to get started'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-xs text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1 tracking-wider uppercase">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@company.com"
                required={!isLogin}
                className="w-full px-3.5 py-2.5 bg-[#1F2937] border border-gray-700 rounded-lg text-white text-xs outline-none focus:border-indigo-500 transition"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1 tracking-wider uppercase">
              {isLogin ? 'USERNAME' : 'FULL NAME / USERNAME'}
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder={isLogin ? "e.g. johndoe" : "e.g. Lilian Jackson"}
              required
              className="w-full px-3.5 py-2.5 bg-[#1F2937] border border-gray-700 rounded-lg text-white text-xs outline-none focus:border-indigo-500 transition"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1 tracking-wider uppercase">
                ASSIGNED BRANCH
              </label>
              <select
                name="branch"
                value={formData.branch}
                onChange={handleChange}
                disabled={loadingBranches}
                className="w-full px-3.5 py-2.5 bg-[#1F2937] border border-gray-700 rounded-lg text-white text-xs outline-none focus:border-indigo-500 transition cursor-pointer appearance-none"
              >
                <option value="all" className="bg-[#111827] text-indigo-400 font-semibold">
                  🌐 All Branches (Full Access)
                </option>
                {loadingBranches ? (
                  <option value="" className="bg-[#1F2937] text-gray-300">
                    Loading branches...
                  </option>
                ) : (
                  branches.map((b) => (
                    <option
                      key={b.id}
                      value={b.id}
                      className="bg-[#111827] text-white py-2 px-3 selection:bg-indigo-600 hover:bg-indigo-600 cursor-pointer"
                    >
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1 tracking-wider uppercase">
              PASSWORD
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className="w-full px-3.5 py-2.5 bg-[#1F2937] border border-gray-700 rounded-lg text-white text-xs outline-none focus:border-indigo-500 transition"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1 tracking-wider uppercase">
                CONFIRM PASSWORD
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required={!isLogin}
                className="w-full px-3.5 py-2.5 bg-[#1F2937] border border-gray-700 rounded-lg text-white text-xs outline-none focus:border-indigo-500 transition"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-medium rounded-lg shadow-md transition duration-150 ease-in-out mt-2 cursor-pointer"
          >
            {isLogin ? 'Sign In' : 'Register Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-400">
          {isLogin ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setIsLogin(false);
                }}
                className="text-indigo-400 hover:underline font-semibold cursor-pointer"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setIsLogin(true);
                }}
                className="text-indigo-400 hover:underline font-semibold cursor-pointer"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}