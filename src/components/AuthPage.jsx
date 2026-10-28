// src/components/AuthPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

export default function AuthPage({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
        setBranches(Array.isArray(data) ? data : []);
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

    setIsSubmitting(true);

    const endpoint = isLogin ? '/auth/login/' : '/auth/register/';
    
    // For login, preserve exact trimmed username
    const loginUsername = formData.username.trim();
    // For registration, generate cleaned fallback username
    const regUsername = formData.username.trim().replace(/\s+/g, '_').toLowerCase();
    
    // Split input into first_name and last_name for registration
    const nameParts = formData.username.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Format payload for both Login and Registration
    const payload = isLogin
      ? { 
          username: loginUsername, 
          password: formData.password 
        }
      : {
          username: regUsername,
          first_name: firstName,
          last_name: lastName,
          email: formData.email.trim(),
          password: formData.password,
          confirm_password: formData.confirmPassword,
          confirmPassword: formData.confirmPassword,
          branch: formData.branch === 'all' ? null : parseInt(formData.branch, 10),
          branch_id: formData.branch === 'all' ? null : parseInt(formData.branch, 10),
          assigned_all_branches: formData.branch === 'all',
        };

    try {
      const response = await API.post(endpoint, payload);
      const data = response.data;

      if (isLogin) {
        const activeToken = data.access || data.token;
        if (activeToken) {
          localStorage.setItem('access_token', activeToken);
          localStorage.setItem('token', activeToken);
        }

        if (data.refresh) {
          localStorage.setItem('refresh_token', data.refresh);
        }

        const userObj = data.user || {
          username: data.username || loginUsername,
          role: 'NORMAL_USER',
          permissions: {},
          is_staff: false,
          is_superuser: false,
        };

        // Save module permissions to local storage
        if (userObj.permissions) {
          localStorage.setItem('user_permissions', JSON.stringify(userObj.permissions));
        }

        const isSuperadmin = userObj.is_superuser || userObj.role === 'SUPERADMIN';
        const isManagement = userObj.is_staff || ['ADMIN', 'MANAGER', 'MANAGEMENT'].includes(userObj.role);

        const portalType = data.portal_type || (isSuperadmin ? 'admin' : (isManagement ? 'management' : 'user'));

        localStorage.setItem('username', userObj.username);
        localStorage.setItem('user', JSON.stringify(userObj));
        localStorage.setItem('user_data', JSON.stringify(userObj));
        localStorage.setItem('portal_type', portalType);

        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess(userObj);
        }

        // Dynamic redirect based on privileges & portal type
        if (isSuperadmin || portalType === 'admin') {
          navigate('/admin');
        } else if (isManagement || portalType === 'management') {
          navigate('/management');
        } else {
          navigate('/');
        }
      } else {
        // Automatically pre-fill username and switch view to Sign In
        setFormData({
          username: regUsername,
          email: '',
          password: '',
          confirmPassword: '',
          branch: 'all',
        });
        setError('');
        setIsLogin(true);
      }
    } catch (err) {
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === 'string') {
          // Prevent raw HTML pages from rendering inside the alert box
          if (data.includes('<!doctype html>') || data.includes('<html')) {
            setError('Server Error (500). Please verify Django terminal logs.');
          } else {
            setError(data);
          }
        } else if (data.detail) {
          setError(data.detail);
        } else if (data.error) {
          setError(data.error);
        } else if (typeof data === 'object') {
          const firstKey = Object.keys(data)[0];
          const firstVal = data[firstKey];
          const msg = Array.isArray(firstVal) ? firstVal[0] : firstVal;
          setError(`${firstKey !== 'non_field_errors' ? `${firstKey}: ` : ''}${msg}`);
        } else {
          setError('Authentication failed. Please check your credentials.');
        }
      } else {
        setError(err.message || 'Unable to connect to authentication service.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-200/80 text-slate-900 flex flex-col justify-center items-center px-4 font-sans">
      <div className="w-full max-w-md bg-white border border-slate-300 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-300 flex items-center justify-center mx-auto text-lg mb-2 text-indigo-700">
            🔒
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {isLogin ? 'Sign In' : 'Create an Account'}
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            {isLogin ? 'Enter your credentials to access your portal' : 'Fill in the details below to get started'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 tracking-wider uppercase">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@company.com"
                required={!isLogin}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 tracking-wider uppercase">
              {isLogin ? 'USERNAME' : 'FULL NAME / USERNAME'}
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder={isLogin ? "e.g. johndoe" : "e.g. John Doe"}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 tracking-wider uppercase">
                ASSIGNED BRANCH
              </label>
              <select
                name="branch"
                value={formData.branch}
                onChange={handleChange}
                disabled={loadingBranches}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition cursor-pointer"
              >
                <option value="all" className="bg-white text-indigo-700 font-semibold">
                   All Branches (Full Access)
                </option>
                {loadingBranches ? (
                  <option value="" className="bg-white text-slate-500">
                    Loading branches...
                  </option>
                ) : (
                  branches.map((b) => (
                    <option
                      key={b.id}
                      value={b.id}
                      className="bg-white text-slate-900 py-2 px-3 hover:bg-slate-100 cursor-pointer"
                    >
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 tracking-wider uppercase">
              PASSWORD
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 tracking-wider uppercase">
                CONFIRM PASSWORD
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required={!isLogin}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-semibold rounded-lg shadow-sm transition duration-150 ease-in-out mt-2 cursor-pointer"
          >
            {isSubmitting ? 'Authenticating...' : (isLogin ? 'Sign In' : 'Register Account')}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-600">
          {isLogin ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setIsLogin(false);
                }}
                className="text-indigo-600 hover:text-indigo-800 hover:underline font-semibold cursor-pointer"
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
                className="text-indigo-600 hover:text-indigo-800 hover:underline font-semibold cursor-pointer"
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