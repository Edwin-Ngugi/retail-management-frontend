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

export default function ManagementDashboard({ onLogout, currentUser: initialUser }) {
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
      } catch (e) {}
    }
    return null;
  });

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('mgmt_active_tab') || 'OVERVIEW';
  });

  const [reportSubTab, setReportSubTab] = useState('PROFIT_LOSS');

  useEffect(() => {
    localStorage.setItem('mgmt_active_tab', activeTab);
  }, [activeTab]);

  const [dateFilter, setDateFilter] = useState({
    filterMode: 'MONTHLY',
    selectedDay: formatDateString(new Date()),
    selectedMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    startDate: '',
    endDate: '',
  });

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
    setAuthToken(null);
    setCurrentUser(null);
    if (typeof onLogout === 'function') onLogout();
  }, [onLogout]);

  const handleManagementLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const res = await API.post('auth/management-login/', {
        username: loginForm.username.trim(),
        password: loginForm.password,
      });

      const token = res.data?.access || res.data?.token;
      if (!token) throw new Error('No access token returned.');

      localStorage.setItem('access_token', token);
      localStorage.setItem('token', token);
      const userObj = res.data?.user || { username: loginForm.username.trim() };
      localStorage.setItem('user', JSON.stringify(userObj));

      setCurrentUser(userObj);
      setAuthToken(token);
    } catch (err) {
      setLoginError(err.response?.data?.error || err.response?.data?.detail || 'Authentication failed.');
    } finally {
      setLoginLoading(false);
    }
  };

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
        start = formatDateString(new Date(y, m - 1, 1));
        end = formatDateString(new Date(y, m, 0));
      }
    } else if (filterMode === 'THIS_WEEK') {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      start = formatDateString(monday);
      end = formatDateString(sunday);
    } else if (filterMode === 'THIS_YEAR') {
      const year = new Date().getFullYear();
      start = `${year}-01-01`;
      end = `${year}-12-31`;
    } else if (filterMode === 'CUSTOM') {
      start = startDate;
      end = endDate;
    }

    return { effectiveStartDate: start, effectiveEndDate: end };
  }, [dateFilter]);

  const fetchManagementAnalytics = useCallback(async () => {
    if (!authToken) return;

    setLoadingFinancials(true);
    setDashboardError('');

    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (branchKey) {
        urlParams.set('branch_id', branchKey);
        urlParams.set('branch', branchKey);
      }
      if (effectiveRange.effectiveStartDate) urlParams.set('start_date', effectiveRange.effectiveStartDate);
      if (effectiveRange.effectiveEndDate) urlParams.set('end_date', effectiveRange.effectiveEndDate);

      const queryStr = urlParams.toString();

      const [cardsRes, pnlRes, salesPerfRes] = await Promise.all([
        API.get(`management-analytics/dashboard-cards/?${queryStr}`),
        API.get(`management-analytics/profit-loss/?${queryStr}`),
        API.get(`management-analytics/sales-performance/?${queryStr}`),
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
    fetchManagementAnalytics();
  }, [authToken, branchKey, fetchManagementAnalytics, dateFilter.filterMode, dateFilter.selectedDay, dateFilter.selectedMonth, dateFilter.startDate, dateFilter.endDate]);

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

  if (!authToken) {
    return (
      <div className="min-h-screen relative w-full flex items-center justify-center p-4 font-sans text-slate-800 bg-slate-50">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <img src="/logo.svg" alt="Melvex Business Solutions" className="h-14 w-auto object-contain" />
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
    { id: 'OVERVIEW', label: 'Dashboard' },
    { id: 'OPERATIONS', label: 'Sales' },
    { id: 'CASHBOOK', label: 'Purchases' },
    { id: 'REVIEWS', label: 'Inventory' },
    { id: 'BALANCE_SHEET', label: 'Cash & Bank' },
    { id: 'ACCOUNTS', label: 'Accounts' },
    { id: 'REPORTS', label: 'Reports' },
  ];

  return (
    <div className="flex min-h-screen w-full bg-slate-100/70 text-slate-900 font-sans">

      {/* ELEGANT TEAL SIDEBAR WITH PROPER LOGO BRANDING */}
      <aside className="w-60 bg-teal-950 text-teal-100 flex flex-col justify-between p-4 shrink-0 border-r border-teal-900 min-h-screen shadow-lg">
        <div>
          {/* SIDEBAR LOGO & BRAND */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6 border-b border-teal-900/80">
            <img src="/logo.svg" alt="Company Logo" className="h-10 w-auto object-contain brightness-110" />
            <div>
              <h2 className="text-xs font-black text-white tracking-widest uppercase">MELVEX</h2>
              <span className="text-[10px] text-teal-400 font-bold tracking-wider uppercase">Management</span>
            </div>
          </div>

          <div className="mb-3 px-2">
            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">
              MAIN NAVIGATION
            </span>
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-teal-900 text-white border-l-4 border-teal-400 shadow-sm'
                      : 'text-teal-200/80 hover:bg-teal-900/50 hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
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
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="min-w-0 flex-1 p-6 space-y-6 overflow-y-auto">

        {/* CONTENT HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Business performance overview
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={dateFilter.filterMode}
              onChange={(e) =>
                setDateFilter((prev) => ({ ...prev, filterMode: e.target.value }))
              }
              className="bg-white border border-slate-300 rounded-xl px-3.5 py-1.5 text-xs font-bold text-slate-800 outline-none shadow-sm cursor-pointer"
            >
              <option value="MONTHLY">This month</option>
              <option value="DAILY">Today</option>
              <option value="THIS_WEEK">This week</option>
              <option value="THIS_YEAR">This year</option>
            </select>
          </div>
        </div>

        {dashboardError && (
          <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-xl flex justify-between items-center shadow-sm">
            <span>{dashboardError}</span>
            <button onClick={() => setDashboardError('')} className="font-bold ml-2">✕</button>
          </div>
        )}

        {/* OVERVIEW DASHBOARD METRICS */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">

            {/* ROW 1: PROFITABILITY HIGHLIGHTS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">TOTAL SALES</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.profitability?.total_sales_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">This period</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">GROSS PROFIT</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.profitability?.gross_profit_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">
                  {dashboardCardsData?.profitability?.gross_margin_percentage || 0}% gross margin
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">OPERATING EXPENSES</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
                  {dashboardCardsData?.profitability?.operating_expenses_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">This period</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">NET PROFIT</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.profitability?.net_profit_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">Before tax, illustrative</span>
              </div>
            </div>

            {/* ROW 2: INVENTORY POSITION */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">TOTAL STOCK VALUE</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.inventory?.total_stock_value_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">At cost price</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">PRODUCT ITEMS (SKUS)</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
                  {formatNumber(dashboardCardsData?.inventory?.product_skus || 0)}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">Active products</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">LOW-STOCK ITEMS</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-amber-600 tracking-tight">
                  {dashboardCardsData?.inventory?.low_stock_items ?? 0}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">At or below reorder level</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">OUT OF STOCK</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-rose-600 tracking-tight">
                  {dashboardCardsData?.inventory?.out_of_stock_items ?? 0}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">Products with zero stock</span>
              </div>
            </div>

            {/* ROW 3: DAILY STOCK MOVEMENTS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-200/60 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">STOCK RECEIVED TODAY</span>
                <div className="text-lg font-bold font-mono text-slate-900">
                  {dashboardCardsData?.inventory?.stock_received_today_formatted || 'KSh 0'}
                </div>
              </div>

              <div className="bg-slate-200/60 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">STOCK ISSUED TODAY</span>
                <div className="text-lg font-bold font-mono text-slate-900">
                  {dashboardCardsData?.inventory?.stock_issued_today_formatted || 'KSh 0'}
                </div>
              </div>

              <div className="bg-slate-200/60 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">PENDING TRANSFERS</span>
                <div className="text-lg font-bold font-mono text-slate-900">
                  {dashboardCardsData?.inventory?.pending_transfers || 0}
                </div>
              </div>

              <div className="bg-slate-200/60 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">STOCK VARIANCES</span>
                <div className="text-lg font-bold font-mono text-slate-900">
                  {dashboardCardsData?.inventory?.stock_variances || 0} items
                </div>
              </div>
            </div>

            {/* ROW 4: CASH FLOW & LIQUIDITY */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">TOTAL AVAILABLE FUNDS</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.cash_flow?.total_available_funds_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">Cash + bank + M-Pesa</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">TODAY'S RECEIPTS</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.cash_flow?.todays_receipts_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">All channels</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">TODAY'S PAYMENTS</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
                  {dashboardCardsData?.cash_flow?.todays_payments_formatted || 'KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">All channels</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">NET CASH MOVEMENT</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 tracking-tight">
                  {dashboardCardsData?.cash_flow?.net_cash_movement_formatted || '+KSh 0.00'}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 block">Receipts less payments</span>
              </div>
            </div>

            {/* SECTION 5: BALANCES BY ACCOUNT */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
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
                    <h3 className="text-sm font-bold text-slate-900">Paybill / Till</h3>
                    <p className="text-xs text-slate-500">Business buy goods & paybills</p>
                  </div>
                  <span className="font-mono text-base font-bold text-teal-600">
                    {dashboardCardsData?.account_balances?.paybill_formatted || 'KSh 0'}
                  </span>
                </div>

                <div className="py-3.5 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Send Money</h3>
                    <p className="text-xs text-slate-500">Direct phone transfers</p>
                  </div>
                  <span className="font-mono text-base font-bold text-teal-600">
                    {dashboardCardsData?.account_balances?.send_money_formatted || 'KSh 0'}
                  </span>
                </div>
              </div>
            </div>

            {/* ROW 6: SALES PERFORMANCE GRAPH */}
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