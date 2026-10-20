import React, { useState, useEffect, useMemo, useCallback } from 'react';
import API from '../api';
import { useBranch } from './BranchContext';
import SalesView from './SalesView';
import PurchaseView from './PurchaseView';
import InventoryView from './InventoryView';
import CashView from './CashView';
import ReportsView from './ReportsView';
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

  useEffect(() => {
    localStorage.setItem('mgmt_active_tab', activeTab);
  }, [activeTab]);

  /* =========================================================
     DATE FILTER STATE
  ========================================================= */
  const [dateFilter, setDateFilter] = useState({
    filterMode: 'MONTHLY', 
    selectedDay: formatDateString(new Date()),
    selectedMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    selectedYear: `${new Date().getFullYear()}`,
    startDate: formatDateString(new Date()),
    endDate: formatDateString(new Date()),
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

  const effectiveQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (branchKey) {
      params.set('branch_id', branchKey);
    }

    const { filterMode, selectedDay, selectedMonth, selectedYear, startDate, endDate } = dateFilter;

    if (filterMode === 'CUSTOM') {
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
    } else if (filterMode === 'DAILY' && selectedDay) {
      params.set('start_date', selectedDay);
      params.set('end_date', selectedDay);
    } else if (filterMode === 'THIS_WEEK') {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      params.set('start_date', formatDateString(monday));
      params.set('end_date', formatDateString(sunday));
    } else if (filterMode === 'MONTHLY' && selectedMonth) {
      const parts = selectedMonth.split('-');
      if (parts.length === 2) {
        params.set('year', parts[0]);
        params.set('month', parts[1]);
      }
    } else if (filterMode === 'THIS_YEAR' && selectedYear) {
      params.set('year', selectedYear);
    }

    return params.toString();
  }, [branchKey, dateFilter]);

  const fetchManagementAnalytics = useCallback(async () => {
    if (!authToken) return;

    setLoadingFinancials(true);
    setDashboardError('');

    try {
      const queryStr = effectiveQueryParams;

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
  }, [authToken, effectiveQueryParams, handleLogout]);

  useEffect(() => {
    if (!authToken) return;
    fetchManagementAnalytics();
  }, [authToken, fetchManagementAnalytics]);

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
              {loginLoading ? 'Authenticating...' : 'Sign In to Management Portal'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: 'OVERVIEW', label: 'Dashboard' },
    { id: 'OPERATIONS', label: 'Sales' },
    { id: 'PURCHASES', label: 'Purchases' },
    { id: 'INVENTORY', label: 'Inventory' },
    { id: 'CASH', label: 'Cash' },
    { id: 'ACCOUNTS', label: 'Accounts' },
    { id: 'REPORTS', label: 'Reports' },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100/70 text-slate-900 font-sans">

      {/* SIDEBAR NAVIGATION */}
      <aside className="w-56 bg-teal-950 text-teal-100 flex flex-col justify-between p-4 shrink-0 border-r border-teal-900 h-full shadow-lg z-50">
        <div>
          <div className="px-2 py-3 mb-4 border-b border-teal-900/80">
            <span className="text-[11px] font-extrabold text-teal-300 uppercase tracking-widest">
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
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
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

        <div className="pt-4 border-t border-teal-900">
          <button
            onClick={handleLogout}
            className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 h-full min-w-0 overflow-y-auto flex flex-col">

        {/* RESTYLIZED TOP HEADER BAR (DARK SLATE WITH ENLARGED LOGO) */}
        <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white px-6 py-3 flex items-center justify-between shadow-md gap-4">
          
          {/* LEFT: BRANCH SELECTION */}
          <div className="flex items-center gap-2 min-w-[200px]">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">BRANCH:</span>
            <select
              value={branchKey}
              onChange={(e) => setSelectedBranch?.(e.target.value)}
              className="bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer hover:border-teal-500 transition"
            >
              {branches.map((b) => (
                <option key={b.id || b.code} value={b.id || b.code}>
                  {b.name || b.branch_name}
                </option>
              ))}
            </select>
          </div>

          {/* CENTER: ENLARGED BRAND LOGO */}
          <div className="flex items-center gap-3 justify-center">
            <img 
              src="/logo.svg" 
              alt="Melvex Logo" 
              className="h-11 w-auto object-contain bg-white/10 p-1 rounded-xl border border-slate-700/60 shadow-xs" 
            />
            <div className="text-center hidden md:block">
              <h1 className="text-base font-black tracking-widest uppercase leading-none text-white">MELVEX</h1>
              <span className="text-[10px] font-extrabold text-teal-400 uppercase tracking-widest">Management Portal</span>
            </div>
          </div>

          {/* RIGHT: DATE FILTERS */}
          <div className="flex items-center gap-2 justify-end">
            <select
              value={dateFilter.filterMode}
              onChange={(e) =>
                setDateFilter((prev) => ({ ...prev, filterMode: e.target.value }))
              }
              className="bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer"
            >
              <option value="DAILY">Daily (Specific Date)</option>
              <option value="THIS_WEEK">Weekly (This Week)</option>
              <option value="MONTHLY">Monthly</option>
              <option value="THIS_YEAR">Yearly</option>
              <option value="CUSTOM">Custom Range</option>
            </select>

            {dateFilter.filterMode === 'DAILY' && (
              <input
                type="date"
                value={dateFilter.selectedDay}
                onChange={(e) => setDateFilter((prev) => ({ ...prev, selectedDay: e.target.value }))}
                className="bg-slate-800 text-white border border-slate-700 rounded-xl px-2.5 py-1 text-xs font-semibold outline-none"
              />
            )}

            {dateFilter.filterMode === 'MONTHLY' && (
              <input
                type="month"
                value={dateFilter.selectedMonth}
                onChange={(e) => setDateFilter((prev) => ({ ...prev, selectedMonth: e.target.value }))}
                className="bg-slate-800 text-white border border-slate-700 rounded-xl px-2.5 py-1 text-xs font-semibold outline-none"
              />
            )}

            {dateFilter.filterMode === 'THIS_YEAR' && (
              <input
                type="number"
                min="2020"
                max="2035"
                value={dateFilter.selectedYear}
                onChange={(e) => setDateFilter((prev) => ({ ...prev, selectedYear: e.target.value }))}
                className="w-20 bg-slate-800 text-white border border-slate-700 rounded-xl px-2.5 py-1 text-xs font-semibold outline-none"
              />
            )}

            {dateFilter.filterMode === 'CUSTOM' && (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="bg-slate-800 text-white border border-slate-700 rounded-xl px-2 py-1 text-xs font-semibold outline-none"
                />
                <span className="text-xs font-bold text-slate-400">to</span>
                <input
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="bg-slate-800 text-white border border-slate-700 rounded-xl px-2 py-1 text-xs font-semibold outline-none"
                />
              </div>
            )}
          </div>
        </header>

        {/* FLUID INNER PAGE CONTENT */}
        <div className="p-6 space-y-6 flex-1 w-full">

          {dashboardError && (
            <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-xl flex justify-between items-center shadow-xs">
              <span>{dashboardError}</span>
              <button onClick={() => setDashboardError('')} className="font-bold ml-2">✕</button>
            </div>
          )}

          {/* OVERVIEW DASHBOARD SUMMARY */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6 max-w-7xl mx-auto">

              {/* 4 CONSOLIDATED EXECUTIVE SUMMARY BLOCKS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                
                {/* 1. FINANCIAL PERFORMANCE */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Financial Performance</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">Total Sales</span>
                    <div className="text-2xl font-black text-slate-900 tracking-tight">
                      {dashboardCardsData?.profitability?.total_sales_formatted || 'KSh 0.00'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Gross Profit</span>
                      <span className="font-bold text-emerald-700">
                        {dashboardCardsData?.profitability?.gross_profit_formatted || 'KSh 0.00'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Net Profit</span>
                      <span className="font-bold text-teal-800">
                        {dashboardCardsData?.profitability?.net_profit_formatted || 'KSh 0.00'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. INVENTORY & SKUs */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Inventory & SKUs</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">Stock Value (At Cost)</span>
                    <div className="text-2xl font-black text-slate-900 tracking-tight">
                      {dashboardCardsData?.inventory?.total_stock_value_formatted || 'KSh 0.00'}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 text-center">
                    <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                      <span className="text-[9px] text-slate-400 block uppercase font-bold">Active</span>
                      <span className="font-extrabold text-slate-800 text-xs">
                        {formatNumber(dashboardCardsData?.inventory?.product_skus || 0)}
                      </span>
                    </div>
                    <div className="bg-amber-50/80 p-1.5 rounded-lg border border-amber-100">
                      <span className="text-[9px] text-amber-700 block uppercase font-bold">Low</span>
                      <span className="font-extrabold text-amber-800 text-xs">
                        {dashboardCardsData?.inventory?.low_stock_items ?? 0}
                      </span>
                    </div>
                    <div className="bg-rose-50/80 p-1.5 rounded-lg border border-rose-100">
                      <span className="text-[9px] text-rose-700 block uppercase font-bold">Out</span>
                      <span className="font-extrabold text-rose-800 text-xs">
                        {dashboardCardsData?.inventory?.out_of_stock_items ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. DAILY MOVEMENT */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Daily Movement</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">Today's Receipts</span>
                    <div className="text-2xl font-black text-slate-900 tracking-tight">
                      {dashboardCardsData?.cash_flow?.todays_receipts_formatted || 'KSh 0.00'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Today's Payments</span>
                      <span className="font-bold text-slate-800">
                        {dashboardCardsData?.cash_flow?.todays_payments_formatted || 'KSh 0.00'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Net Cash Flow</span>
                      <span className="font-bold text-emerald-600">
                        {dashboardCardsData?.cash_flow?.net_cash_movement_formatted || '+KSh 0.00'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. CASH POSITION */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Cash Position</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">Available Funds</span>
                    <div className="text-2xl font-black text-teal-800 tracking-tight">
                      {dashboardCardsData?.cash_flow?.total_available_funds_formatted || 'KSh 0.00'}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 leading-snug">
                    Combined cash, bank accounts & mobile till balances
                  </p>
                </div>

              </div>

              {/* ACCOUNT BALANCES LEDGER */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <h2 className="text-sm font-black text-slate-900 tracking-tight uppercase border-b border-slate-100 pb-2">
                  Balances by Account
                </h2>

                <div className="divide-y divide-slate-100">
                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">Cash at hand</h3>
                      <p className="text-[11px] text-slate-400">Main cash till</p>
                    </div>
                    <span className="font-mono text-sm font-bold text-teal-700">
                      {dashboardCardsData?.account_balances?.cash_at_hand_formatted || 'KSh 0.00'}
                    </span>
                  </div>

                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">Paybill / Till</h3>
                      <p className="text-[11px] text-slate-400">Business buy goods & paybills</p>
                    </div>
                    <span className="font-mono text-sm font-bold text-teal-700">
                      {dashboardCardsData?.account_balances?.paybill_formatted || 'KSh 0.00'}
                    </span>
                  </div>

                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">Send Money</h3>
                      <p className="text-[11px] text-slate-400">Direct phone transfers</p>
                    </div>
                    <span className="font-mono text-sm font-bold text-teal-700">
                      {dashboardCardsData?.account_balances?.send_money_formatted || 'KSh 0.00'}
                    </span>
                  </div>
                </div>
              </div>

              {/* SALES PERFORMANCE GRAPH */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <h2 className="text-sm font-black text-slate-900 tracking-tight uppercase border-b border-slate-100 pb-2">
                  Sales Performance Trajectory
                </h2>

                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-teal-600 rounded-full" />
                  <div>
                    <span className="text-[11px] text-slate-400 block font-bold uppercase">Total Sales (Period)</span>
                    <span className="text-lg font-black font-mono text-slate-900">
                      {dashboardCardsData?.profitability?.total_sales_formatted || 'KSh 0.00'}
                    </span>
                  </div>
                </div>

                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={salesPerfData?.daily || []}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                      <Tooltip formatter={(v) => [formatCurrency(v), 'Sales']} />
                      <Bar dataKey="gross_sales" fill="#0D9488" radius={[6, 6, 0, 0]} barSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}

          {/* SALES TAB */}
          {activeTab === 'OPERATIONS' && (
            <SalesView branchId={branchKey} />
          )}

          {/* INVENTORY TAB */}
          {activeTab === 'INVENTORY' && (
            <InventoryView branchId={branchKey} />
          )}

          {/* PURCHASES TAB */}
          {activeTab === 'PURCHASES' && (
            <PurchaseView branchId={branchKey} />
          )}

          {/* CASH TAB */}
          {activeTab === 'CASH' && (
            <CashView branchId={branchKey} />
          )}

          {/* REPORTS TAB */}
          {activeTab === 'REPORTS' && (
            <ReportsView branchId={branchKey} />
          )}

          {/* ACCOUNTS TAB */}
          {activeTab === 'ACCOUNTS' && (
            <section className="w-full max-w-5xl space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <h2 className="text-2xl font-black text-slate-900">Account Details</h2>
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

        </div>

      </main>
    </div>
  );
}