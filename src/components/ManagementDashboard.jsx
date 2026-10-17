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
  Legend,
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

  // Consolidated Dashboard Data States
  const [dashboardCardsData, setDashboardCardsData] = useState(null);
  const [pnlData, setPnlData] = useState(null);
  const [salesPerfData, setSalesPerfData] = useState(null);
  const [paymentMethodsData, setPaymentMethodsData] = useState(null);

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

      const [
        cardsRes,
        pnlRes,
        salesPerfRes,
        paymentsRes,
      ] = await Promise.all([
        API.get(`management-analytics/dashboard-cards/?${queryParams}`),
        API.get(`management-analytics/profit-loss/?${queryParams}`),
        API.get(`management-analytics/sales-performance/?${queryParams}`),
        API.get(`management-analytics/payment-methods/?${queryParams}`),
      ]);

      setDashboardCardsData(cardsRes.data);
      setPnlData(pnlRes.data);
      setSalesPerfData(salesPerfRes.data);
      setPaymentMethodsData(paymentsRes.data);
    } catch (err) {
      console.error('Failed to fetch management analytics:', err);
      setDashboardError('Failed to load live dashboard metrics. Check server connection.');
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
      <div className="min-h-screen relative w-full flex items-center justify-center p-4 font-sans text-slate-800 bg-slate-50">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <img src="/logo.svg" alt="Melvex Business Solutions" className="h-20 w-auto object-contain" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-wide">Management Portal</h1>
            <p className="text-xs text-slate-500">Sign in to access review portal and analytics.</p>
          </div>

          {loginError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
              <span>{loginError}</span>
              <button onClick={() => setLoginError('')} className="text-rose-500 font-bold ml-2">✕</button>
            </div>
          )}

          <form onSubmit={handleManagementLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase">Username</label>
              <input
                type="text"
                required
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase">Password</label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer"
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
    <div className="flex min-h-screen w-full bg-white text-slate-900 font-sans">

      {/* LEFT SIDEBAR MENU */}
      <aside className="w-60 bg-teal-950 text-teal-100 flex flex-col justify-between p-4 shrink-0 border-r border-teal-900 min-h-screen">
        <div>
          <div className="mb-6 px-2">
            <span className="text-[11px] font-bold text-teal-400 uppercase tracking-widest">
              MAIN MENU
            </span>
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-teal-900 text-white border-l-4 border-teal-400 font-bold'
                      : 'text-teal-200 hover:bg-teal-900/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge > 0 && (
                    <span className="bg-teal-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-teal-900">
          <div className="px-2">
            <label className="text-[10px] font-bold text-teal-400 uppercase block mb-1">
              Branch
            </label>
            <select
              value={branchKey}
              onChange={(e) => setSelectedBranch?.(e.target.value)}
              className="w-full bg-teal-900 border border-teal-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold outline-none cursor-pointer"
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
            className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
          >
            <span>⚙️</span> Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-6 space-y-6 overflow-y-auto">

        {/* TOP DASHBOARD HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Business performance overview
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={dateFilter.filterMode}
              onChange={(e) =>
                setDateFilter((prev) => ({ ...prev, filterMode: e.target.value }))
              }
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none cursor-pointer focus:ring-2 focus:ring-teal-500"
            >
              <option value="MONTHLY">This month</option>
              <option value="DAILY">Today</option>
              <option value="THIS_WEEK">This week</option>
              <option value="THIS_YEAR">This year</option>
            </select>
          </div>
        </div>

        {dashboardError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex justify-between items-center">
            <span>{dashboardError}</span>
            <button onClick={() => setDashboardError('')} className="font-bold">✕</button>
          </div>
        )}

        {/* OVERVIEW TAB CONTENT (LIVE BACKEND DATA) */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">

            {/* SECTION 1: FINANCIAL HIGHLIGHTS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase block">Total Sales</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.profitability?.total_sales_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">This period</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase block">Gross Profit</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.profitability?.gross_profit_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">
                  {dashboardCardsData?.profitability?.gross_margin_percentage || 0}% gross margin
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase block">Operating Expenses</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-800 tracking-tight">
                  {dashboardCardsData?.profitability?.operating_expenses_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">This period</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase block">Net Profit</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.profitability?.net_profit_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">Before tax, illustrative</span>
              </div>
            </div>

            {/* SECTION 2: INVENTORY HIGHLIGHTS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase block">Total Stock Value</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.inventory?.total_stock_value_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">At cost price</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase block">Product Items (SKUs)</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
                  {formatNumber(dashboardCardsData?.inventory?.product_skus || 0)}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">Active products</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase block">Low-Stock Items</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-amber-600 tracking-tight">
                  {dashboardCardsData?.inventory?.low_stock_items ?? 0}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">At or below reorder level</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase block">Out of Stock</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-rose-600 tracking-tight">
                  {dashboardCardsData?.inventory?.out_of_stock_items ?? 0}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">Products with zero stock</span>
              </div>
            </div>

            {/* SECTION 3: STOCK ACTIVITY SUB-ROW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Stock Received Today</span>
                <span className="text-lg font-bold font-mono text-teal-700">
                  {dashboardCardsData?.inventory?.stock_received_today_formatted || 'KSh 0'}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Stock Issued Today</span>
                <span className="text-lg font-bold font-mono text-slate-800">
                  {dashboardCardsData?.inventory?.stock_issued_today_formatted || 'KSh 0'}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Pending Transfers</span>
                <span className="text-lg font-bold font-mono text-slate-800">
                  {dashboardCardsData?.inventory?.pending_transfers || 0}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Stock Variances</span>
                <span className="text-lg font-bold font-mono text-slate-800">
                  {dashboardCardsData?.inventory?.stock_variances || 0} items
                </span>
              </div>
            </div>

            {/* SECTION 4: CASH & FUNDS OVERVIEW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase block">Total Available Funds</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.cash_flow?.total_available_funds_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">Cash + bank + M-Pesa</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase block">Today's Receipts</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.cash_flow?.todays_receipts_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">All channels</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase block">Today's Payments</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-800 tracking-tight">
                  {dashboardCardsData?.cash_flow?.todays_payments_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">All channels</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase block">Net Cash Movement</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.cash_flow?.net_cash_movement_formatted || '+KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">Receipts less payments</span>
              </div>
            </div>

            {/* SECTION 5: BALANCES BY ACCOUNT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Balances by account
              </h2>

              <div className="divide-y divide-slate-100">
                <div className="py-3.5 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Cash at hand</h3>
                    <p className="text-xs text-slate-500">Main cash till</p>
                  </div>
                  <span className="font-mono text-base font-bold text-teal-600">
                    {dashboardCardsData?.account_balances?.cash_at_hand_formatted || 'KSh 0'}
                  </span>
                </div>

                <div className="py-3.5 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Bank accounts</h3>
                    <p className="text-xs text-slate-500">All business accounts</p>
                  </div>
                  <span className="font-mono text-base font-bold text-teal-600">
                    {dashboardCardsData?.account_balances?.bank_accounts_formatted || 'KSh 0'}
                  </span>
                </div>

                <div className="py-3.5 flex items-center justify-between">
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
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Sales performance
              </h2>

              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-teal-500 rounded-full" />
                <div>
                  <span className="text-xs text-slate-500 block">Total Sales (Period)</span>
                  <span className="text-lg font-extrabold font-mono text-slate-900">
                    {dashboardCardsData?.profitability?.total_sales_formatted || 'KSh 0.00'}
                  </span>
                </div>
              </div>

              <div className="h-64 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={salesPerfData?.daily || []}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                    <Tooltip formatter={(v) => [formatCurrency(v), 'Sales']} />
                    <Bar dataKey="gross_sales" fill="#0D9488" radius={[4, 4, 0, 0]} barSize={28} />
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
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
              {[
                { id: 'PROFIT_LOSS', label: '📊 Profit & Loss Statement' },
                { id: 'SALES_ANALYSIS', label: '📈 Sales Performance Analysis' },
                { id: 'SUMMARIZED_REPORT', label: '📄 Comprehensive Executive Report' },
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setReportSubTab(sub.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    reportSubTab === sub.id
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {reportSubTab === 'PROFIT_LOSS' && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider">
                  Profit & Loss Statement (P&L)
                </h2>
                <div className="h-64 w-full">
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
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">Account Details</h2>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Username</p>
                  <p className="mt-2 text-base font-semibold text-teal-700">{currentUser?.username || 'N/A'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Role</p>
                  <p className="mt-2 text-base font-semibold text-teal-700">{currentUser?.role || 'Manager'}</p>
                </div>
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}