// src/components/ManagementDashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import API from '../api';
import { useBranch } from './BranchContext';
import ManagementOperations from './ManagementOperations';
import Reports from './Reports';
import Cashbook from './Cashbook';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/* =========================================================
   HELPERS & FORMATTERS
========================================================= */

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const formatNumber = (value, minimumFractionDigits = 0, maximumFractionDigits = 2) => {
  return toNumber(value).toLocaleString(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
  });
};

const formatCurrency = (value) => {
  return `KSh ${formatNumber(value, 2, 2)}`;
};

const formatDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/* =========================================================
   MANAGEMENT DASHBOARD COMPONENT
========================================================= */

export default function ManagementDashboard({ onLogout, currentUser: initialUser, items: initialItems = [] }) {
  const { selectedBranch, setSelectedBranch, branches = [] } = useBranch();

  const branchKey = useMemo(() => {
    if (!selectedBranch) return '';
    if (typeof selectedBranch === 'string') return selectedBranch;
    return selectedBranch?.id || selectedBranch?.code || '';
  }, [selectedBranch]);

  const [authToken, setAuthToken] = useState(
    () => localStorage.getItem('access_token') || localStorage.getItem('token') || null
  );

  const [currentUser, setCurrentUser] = useState(() => {
    if (initialUser) return initialUser;
    const storedUser = localStorage.getItem('user') || localStorage.getItem('user_data');
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch (e) {
        console.error('Failed to parse stored user data:', e);
      }
    }
    return null;
  });

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('mgmt_active_tab');
    return saved === 'INVENTORY' ? 'OPERATIONS' : saved || 'OVERVIEW';
  });

  const [reportSubTab, setReportSubTab] = useState('PROFIT_LOSS');

  const [operationsSection, setOperationsSection] = useState(() => {
    return localStorage.getItem('mgmt_operations_section') || 'inventory';
  });

  useEffect(() => {
    localStorage.setItem('mgmt_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('mgmt_operations_section', operationsSection);
  }, [operationsSection]);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const [dateFilter, setDateFilter] = useState(() => {
    const saved = localStorage.getItem('mgmt_date_filter');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.filterMode === 'ALL') parsed.filterMode = 'DAILY';
        return parsed;
      } catch (e) {}
    }
    return {
      filterMode: 'MONTHLY',
      selectedDay: formatDateString(new Date()),
      selectedMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      startDate: '',
      endDate: '',
    };
  });

  useEffect(() => {
    localStorage.setItem('mgmt_date_filter', JSON.stringify(dateFilter));
  }, [dateFilter]);

  // Dynamic Dashboard Data States
  const [dashboardCardsData, setDashboardCardsData] = useState(null);
  const [pnlData, setPnlData] = useState(null);
  const [salesPerfData, setSalesPerfData] = useState(null);

  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [dashboardError, setDashboardError] = useState('');

  const handleLogout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_data');
    localStorage.removeItem('mgmt_active_tab');
    localStorage.removeItem('mgmt_operations_section');
    localStorage.removeItem('mgmt_date_filter');
    setAuthToken(null);
    setCurrentUser(null);
    if (typeof onLogout === 'function') onLogout();
  }, [onLogout]);

  const handleManagementLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!loginForm.username.trim() || !loginForm.password) {
      setLoginError('Please enter both your username and password.');
      return;
    }

    setLoginLoading(true);

    try {
      const res = await API.post('auth/management-login/', {
        username: loginForm.username.trim(),
        password: loginForm.password,
      });

      const token = res.data?.access || res.data?.token;
      if (!token) throw new Error('No access token returned from backend.');

      localStorage.setItem('access_token', token);
      localStorage.setItem('token', token);

      if (res.data?.refresh) {
        localStorage.setItem('refresh_token', res.data.refresh);
      }

      const userObj = res.data?.user || { username: loginForm.username.trim() };

      localStorage.setItem('user', JSON.stringify(userObj));
      localStorage.setItem('user_data', JSON.stringify(userObj));

      setCurrentUser(userObj);
      setAuthToken(token);
      setLoginForm({ username: '', password: '' });
    } catch (err) {
      console.error('Management login error:', err);
      setLoginError(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          'Authentication failed.'
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const fetchRequests = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await API.get('pending-approvals/');
      const fetchedRequests = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setRequests(fetchedRequests);
    } catch (err) {
      console.error('Failed to load review requests:', err);
      if (err.response?.status === 401) handleLogout();
    } finally {
      setLoading(false);
    }
  }, [authToken, handleLogout]);

  const effectiveRange = useMemo(() => {
    const { filterMode, selectedDay, selectedMonth, startDate, endDate } = dateFilter;
    let start = '';
    let end = '';

    if (filterMode === 'DAILY' && selectedDay) {
      start = selectedDay;
      end = selectedDay;
    } else if (filterMode === 'MONTHLY' && selectedMonth) {
      const [y, m] = selectedMonth.split('-').map(Number);
      if (y && m) {
        const firstDay = new Date(y, m - 1, 1);
        const lastDay = new Date(y, m, 0);
        start = formatDateString(firstDay);
        end = formatDateString(lastDay);
      }
    } else if (filterMode === 'CUSTOM') {
      start = startDate;
      end = endDate;
    } else if (filterMode === 'THIS_WEEK') {
      const now = new Date();
      const dayOfWeek = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - dayOfWeek + 1);
      start = formatDateString(monday);
      end = formatDateString(now);
    } else if (filterMode === 'THIS_YEAR') {
      const now = new Date();
      start = `${now.getFullYear()}-01-01`;
      end = formatDateString(now);
    }

    return { effectiveStartDate: start, effectiveEndDate: end };
  }, [dateFilter]);

  const fetchManagementAnalytics = useCallback(async () => {
    if (!authToken || !branchKey) return;

    const { effectiveStartDate, effectiveEndDate } = effectiveRange;
    if (effectiveStartDate && effectiveEndDate && effectiveStartDate > effectiveEndDate) {
      setDashboardError('Invalid reporting period: start date must be on or before end date.');
      return;
    }

    setLoadingFinancials(true);
    setDashboardError('');

    try {
      const queryParams = new URLSearchParams({
        branch_id: branchKey,
        ...(effectiveStartDate && { start_date: effectiveStartDate }),
        ...(effectiveEndDate && { end_date: effectiveEndDate }),
      }).toString();

      const [cardsRes, pnlRes, salesPerfRes] = await Promise.all([
        API.get(`management-analytics/dashboard-cards/?${queryParams}`),
        API.get(`management-analytics/profit-loss/?${queryParams}`),
        API.get(`management-analytics/sales-performance/?${queryParams}`),
      ]);

      setDashboardCardsData(cardsRes.data);
      setPnlData(pnlRes.data);
      setSalesPerfData(salesPerfRes.data);
    } catch (err) {
      console.error('Failed to fetch management analytics:', err);
      setDashboardError('Failed to load dashboard metrics. Check server connection.');
      if (err.response?.status === 401) handleLogout();
    } finally {
      setLoadingFinancials(false);
    }
  }, [authToken, branchKey, effectiveRange, handleLogout]);

  useEffect(() => {
    if (!authToken) return;
    fetchRequests();
    fetchManagementAnalytics();
  }, [authToken, branchKey, fetchRequests, fetchManagementAnalytics]);

  const profitLossChartData = useMemo(() => {
    if (!pnlData) return [];
    return [
      { name: 'Revenue', amount: toNumber(pnlData.revenue), fill: '#0D9488' },
      { name: 'COGS', amount: toNumber(pnlData.cost_of_goods_sold), fill: '#0F766E' },
      { name: 'Gross Profit', amount: toNumber(pnlData.gross_profit), fill: '#14B8A6' },
      { name: 'Expenses', amount: toNumber(pnlData.expenses), fill: '#2DD4BF' },
      { name: 'Net Profit', amount: toNumber(pnlData.net_profit), fill: '#0D9488' },
    ];
  }, [pnlData]);

  const summaryMetrics = useMemo(() => {
    const pending = requests.filter((r) => r.status?.toUpperCase().includes('PENDING')).length;
    return { pending, total: requests.length };
  }, [requests]);

  if (!authToken) {
    return (
      <div className="min-h-screen relative w-full flex items-center justify-center p-4 font-sans text-slate-800 bg-gradient-to-br from-teal-900 via-teal-950 to-slate-900">
        <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-8 shadow-2xl space-y-6 backdrop-blur-md">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <img src="/logo.svg" alt="Melvex Business Solutions" className="h-16 w-auto object-contain drop-shadow-md" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-wide">Management Portal</h1>
            <p className="text-xs text-slate-500">Sign in to securely access executive analytics and review hub.</p>
          </div>

          {loginError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between shadow-sm">
              <span>{loginError}</span>
              <button onClick={() => setLoginError('')} className="text-rose-500 font-bold ml-2">✕</button>
            </div>
          )}

          <form onSubmit={handleManagementLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Username</label>
              <input
                type="text"
                required
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Password</label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-teal-600/20 cursor-pointer"
            >
              {loginLoading ? 'Authenticating...' : '🔐 Sign In to Management Portal'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: 'OVERVIEW', label: 'Dashboard', icon: '' },
    { id: 'OPERATIONS', label: 'Sales', icon: '' },
    { id: 'CASHBOOK', label: 'Purchases', icon: '' },
    { id: 'REVIEWS', label: 'Inventory', icon: '', badge: summaryMetrics.pending },
    { id: 'BALANCE_SHEET', label: 'Cash & Bank', icon: '' },
    { id: 'ACCOUNTS', label: 'Accounts', icon: '' },
    { id: 'REPORTS', label: 'Reports', icon: '' },
  ];

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-900 font-sans">

      {/* LEFT SIDEBAR MENU */}
      <aside className="w-64 bg-gradient-to-b from-teal-950 via-teal-900 to-slate-950 text-teal-100 flex flex-col justify-between p-5 shrink-0 border-r border-teal-900/50 shadow-xl min-h-screen">
        <div className="space-y-6">
          {/* LOGO & BRANDING */}
          <div className="flex items-center gap-3 px-2 py-1">
            <img src="/logo.svg" alt="Melvex Logo" className="h-9 w-auto object-contain filter drop-shadow" />
            <div>
              <h2 className="text-xs font-extrabold text-white tracking-wider uppercase">Melvex</h2>
              <span className="text-[10px] text-teal-400 font-semibold tracking-widest uppercase">Management</span>
            </div>
          </div>

          <div className="pt-2 px-2">
            <span className="text-[10px] font-extrabold text-teal-400/80 uppercase tracking-widest">
              MAIN NAVIGATION
            </span>
          </div>

          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-teal-800/90 text-white shadow-lg shadow-teal-950/50 border-l-4 border-teal-400'
                      : 'text-teal-200/80 hover:bg-teal-900/40 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge > 0 && (
                    <span className="bg-teal-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-4 pt-6 border-t border-teal-900/60">
          <div className="px-2">
            <label className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block mb-1.5">
              Active Branch
            </label>
            <select
              value={branchKey}
              onChange={(e) => setSelectedBranch?.(e.target.value)}
              className="w-full bg-teal-900/80 border border-teal-700/60 rounded-xl px-3 py-2 text-xs text-white font-semibold outline-none cursor-pointer shadow-inner focus:ring-2 focus:ring-teal-400"
            >
              {branches.map((b) => (
                <option key={b.id || b.code} value={b.id || b.code} className="bg-teal-950 text-white">
                  {b.name || b.branch_name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleLogout}
            className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
          >
            <span>⚙️</span> Logout Portal
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-8 space-y-6 overflow-y-auto">

        {/* TOP DASHBOARD HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Dashboard Overview
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time executive performance and financial analytics
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Time Period</span>
              <span className="text-xs font-bold text-slate-700 capitalize">
                {dateFilter.filterMode.toLowerCase().replace('_', ' ')}
              </span>
            </div>
            <select
              value={dateFilter.filterMode}
              onChange={(e) =>
                setDateFilter((prev) => ({ ...prev, filterMode: e.target.value }))
              }
              className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs font-bold text-slate-800 outline-none shadow-sm cursor-pointer focus:ring-2 focus:ring-teal-500 transition"
            >
              <option value="MONTHLY">This month</option>
              <option value="DAILY">Today</option>
              <option value="THIS_WEEK">This week</option>
              <option value="THIS_YEAR">This year</option>
            </select>
          </div>
        </div>

        {dashboardError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-4 rounded-2xl flex justify-between items-center shadow-sm">
            <span>{dashboardError}</span>
            <button onClick={() => setDashboardError('')} className="font-bold ml-2">✕</button>
          </div>
        )}

        {/* OVERVIEW TAB CONTENT - 4x4 CARD LAYOUT */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">

            {/* ROW 1: PROFITABILITY HIGHLIGHTS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">TOTAL SALES</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.profitability?.total_sales_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">This period</span>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">GROSS PROFIT</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.profitability?.gross_profit_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">
                  {dashboardCardsData?.profitability?.gross_margin_percentage || 0}% gross margin
                </span>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">OPERATING EXPENSES</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
                  {dashboardCardsData?.profitability?.operating_expenses_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">This period</span>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">NET PROFIT</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.profitability?.net_profit_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">Before tax, illustrative</span>
              </div>
            </div>

            {/* ROW 2: INVENTORY HIGHLIGHTS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">TOTAL STOCK VALUE</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.inventory?.total_stock_value_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">At cost price</span>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">PRODUCT ITEMS (SKUS)</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
                  {formatNumber(dashboardCardsData?.inventory?.product_skus || 0)}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">Active products</span>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">LOW-STOCK ITEMS</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-amber-600 tracking-tight">
                  {dashboardCardsData?.inventory?.low_stock_items ?? 0}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">At or below reorder level</span>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">OUT OF STOCK</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-rose-600 tracking-tight">
                  {dashboardCardsData?.inventory?.out_of_stock_items ?? 0}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">Products with zero stock</span>
              </div>
            </div>

            {/* ROW 3: DAILY STOCK ACTIVITY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white/80 border border-slate-200/90 rounded-3xl p-5 shadow-sm space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">STOCK RECEIVED TODAY</span>
                <div className="text-xl font-bold font-mono text-slate-900 tracking-tight">
                  {dashboardCardsData?.inventory?.stock_received_today_formatted || 'KSh 0'}
                </div>
              </div>

              <div className="bg-white/80 border border-slate-200/90 rounded-3xl p-5 shadow-sm space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">STOCK ISSUED TODAY</span>
                <div className="text-xl font-bold font-mono text-slate-900 tracking-tight">
                  {dashboardCardsData?.inventory?.stock_issued_today_formatted || 'KSh 0'}
                </div>
              </div>

              <div className="bg-white/80 border border-slate-200/90 rounded-3xl p-5 shadow-sm space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">PENDING TRANSFERS</span>
                <div className="text-xl font-bold font-mono text-slate-900 tracking-tight">
                  {dashboardCardsData?.inventory?.pending_transfers || 0}
                </div>
              </div>

              <div className="bg-white/80 border border-slate-200/90 rounded-3xl p-5 shadow-sm space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">STOCK VARIANCES</span>
                <div className="text-xl font-bold font-mono text-slate-900 tracking-tight">
                  {dashboardCardsData?.inventory?.stock_variances || 0} items
                </div>
              </div>
            </div>

            {/* ROW 4: CASH FLOW CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">TOTAL AVAILABLE FUNDS</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.cash_flow?.total_available_funds_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">Cash + bank + M-Pesa</span>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">TODAY'S RECEIPTS</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.cash_flow?.todays_receipts_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">All channels</span>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">TODAY'S PAYMENTS</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
                  {dashboardCardsData?.cash_flow?.todays_payments_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">All channels</span>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">NET CASH MOVEMENT</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.cash_flow?.net_cash_movement_formatted || '+KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">Receipts less payments</span>
              </div>
            </div>

            {/* SECTION 5: BALANCES BY ACCOUNT */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-7 shadow-sm space-y-5">
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Balances by account
              </h2>

              <div className="divide-y divide-slate-100">
                <div className="py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Cash at hand</h3>
                    <p className="text-xs text-slate-500">Main cash till</p>
                  </div>
                  <span className="font-mono text-base font-bold text-teal-600">
                    {dashboardCardsData?.account_balances?.cash_at_hand_formatted || 'KSh 0'}
                  </span>
                </div>

                <div className="py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Bank accounts</h3>
                    <p className="text-xs text-slate-500">All business accounts</p>
                  </div>
                  <span className="font-mono text-base font-bold text-teal-600">
                    {dashboardCardsData?.account_balances?.bank_accounts_formatted || 'KSh 0'}
                  </span>
                </div>

                <div className="py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">M-Pesa</h3>
                    <p className="text-xs text-slate-500">Business tills and paybills</p>
                  </div>
                  <span className="font-mono text-base font-bold text-teal-600">
                    {dashboardCardsData?.account_balances?.mpesa_formatted || 'KSh 0'}
                  </span>
                </div>
              </div>
            </div>

            {/* SALES PERFORMANCE GRAPH SECTION */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-7 shadow-sm space-y-5">
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Sales performance
              </h2>

              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-teal-500 rounded-full" />
                <div>
                  <span className="text-xs text-slate-400 uppercase font-bold block">Total Sales (Period)</span>
                  <span className="text-lg font-black font-mono text-slate-900">
                    {dashboardCardsData?.profitability?.total_sales_formatted || 'KSh 0.00'}
                  </span>
                </div>
              </div>

              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={salesPerfData?.daily || []}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                    <Tooltip formatter={(v) => [formatCurrency(v), 'Sales']} />
                    <Bar dataKey="gross_sales" fill="#0D9488" radius={[6, 6, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

        {/* OPERATIONS TAB */}
        {activeTab === 'OPERATIONS' && (
          <ManagementOperations
            selectedBranch={branchKey}
            initialSection={operationsSection}
            effectiveRange={effectiveRange}
            onBack={() => setActiveTab('OVERVIEW')}
          />
        )}

        {/* CASHBOOK / PURCHASES TAB */}
        {(activeTab === 'CASHBOOK' || activeTab === 'BALANCE_SHEET') && (
          <Cashbook selectedBranch={branchKey} />
        )}

        {/* REPORTS TAB */}
        {activeTab === 'REPORTS' && (
          <div className="space-y-6">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-2">
              {[
                { id: 'PROFIT_LOSS', label: ' Profit & Loss Statement' },
                { id: 'SALES_ANALYSIS', label: ' Sales Performance Analysis' },
                { id: 'SUMMARIZED_REPORT', label: ' Comprehensive Executive Report' },
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setReportSubTab(sub.id)}
                  className={`px-4.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    reportSubTab === sub.id
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {reportSubTab === 'PROFIT_LOSS' && (
              <div className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-sm space-y-6">
                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider">
                  Profit & Loss Statement (P&L)
                </h2>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={profitLossChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => [formatCurrency(v), 'Amount']} />
                      <Bar dataKey="amount" fill="#0D9488" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {reportSubTab === 'SUMMARIZED_REPORT' && <Reports items={[]} />}
          </div>
        )}

        {/* ACCOUNTS TAB */}
        {activeTab === 'ACCOUNTS' && (
          <section className="mx-auto max-w-5xl space-y-5">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm">
              <h2 className="text-2xl font-black text-slate-900">Account Details</h2>
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Username</p>
                  <p className="mt-2 text-base font-extrabold text-teal-700">{currentUser?.username || 'N/A'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Role</p>
                  <p className="mt-2 text-base font-extrabold text-teal-700">{currentUser?.role || 'Manager'}</p>
                </div>
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}