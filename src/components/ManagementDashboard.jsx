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
  PieChart,
  Pie,
  Cell,
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
   GLOBAL MANAGEMENT DATE FILTER BAR
========================================================= */

function ManagementDateFilterBar({ dateFilter, setDateFilter }) {
  const { filterMode, selectedDay, selectedMonth, startDate, endDate } = dateFilter;

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Reporting Period Horizon
          </h2>
          <p className="text-[11px] text-slate-500">
            Selected dates filter analytics across Dashboard, Operations, and Reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setDateFilter({
                filterMode: 'DAILY',
                selectedDay: formatDateString(new Date()),
                selectedMonth: `${new Date().getFullYear()}-${String(
                  new Date().getMonth() + 1
                ).padStart(2, '0')}`,
                startDate: '',
                endDate: '',
              })
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Today
          </button>
          <label className="text-xs font-bold text-slate-700">Period:</label>
          <select
            value={filterMode}
            onChange={(e) =>
              setDateFilter((prev) => ({ ...prev, filterMode: e.target.value }))
            }
            className="bg-slate-100 border border-slate-300 font-bold text-xs text-slate-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="DAILY">Today / Specific Day</option>
            <option value="THIS_WEEK">This Week</option>
            <option value="MONTHLY">This Month / Specific Month</option>
            <option value="THIS_YEAR">This Year</option>
            <option value="CUSTOM">Custom Range</option>
          </select>
        </div>
      </div>

      {filterMode === 'DAILY' && (
        <div className="flex items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <label className="font-bold text-slate-700">Date:</label>
          <input
            type="date"
            value={selectedDay}
            onChange={(e) =>
              setDateFilter((prev) => ({ ...prev, selectedDay: e.target.value }))
            }
            className="border border-slate-300 bg-slate-50 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 font-bold cursor-pointer"
          />
        </div>
      )}

      {filterMode === 'MONTHLY' && (
        <div className="flex items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <label className="font-bold text-slate-700">Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) =>
              setDateFilter((prev) => ({ ...prev, selectedMonth: e.target.value }))
            }
            className="border border-slate-300 bg-slate-50 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 font-bold cursor-pointer"
          />
        </div>
      )}

      {filterMode === 'CUSTOM' && startDate && endDate && startDate > endDate && (
        <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          The start date must be on or before the end date.
        </p>
      )}

      {filterMode === 'CUSTOM' && (
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <label className="font-bold text-slate-600">Start Date:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) =>
                setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))
              }
              className="border border-slate-300 bg-slate-50 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="font-bold text-slate-600">End Date:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) =>
                setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))
              }
              className="border border-slate-300 bg-slate-50 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>
        </div>
      )}
    </div>
  );
}

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

  // Global Management Date Filter Horizon
  const [dateFilter, setDateFilter] = useState(() => {
    const saved = localStorage.getItem('mgmt_date_filter');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.filterMode === 'ALL') parsed.filterMode = 'DAILY';
        return parsed;
      } catch (e) {
        /* fallback */
      }
    }
    return {
      filterMode: 'DAILY',
      selectedDay: formatDateString(new Date()),
      selectedMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      startDate: '',
      endDate: '',
    };
  });

  useEffect(() => {
    localStorage.setItem('mgmt_date_filter', JSON.stringify(dateFilter));
  }, [dateFilter]);

  // Analytics & Summary State variables loaded directly from optimized ViewSet
  const [summaryData, setSummaryData] = useState(null);
  const [pnlData, setPnlData] = useState(null);
  const [salesPerfData, setSalesPerfData] = useState(null);
  const [paymentMethodsData, setPaymentMethodsData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
  const [creditData, setCreditData] = useState(null);
  const [purchasesData, setPurchasesData] = useState(null);

  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

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

  // OPTIMIZED ANALYTICS FETCHING FROM MANAGEMENT-ANALYTICS VIEWSET
  const fetchManagementAnalytics = useCallback(async () => {
    if (!authToken || !branchKey) return;

    const { effectiveStartDate, effectiveEndDate } = effectiveRange;
    if (effectiveStartDate && effectiveEndDate && effectiveStartDate > effectiveEndDate) {
      setDashboardError('Invalid reporting period: the start date must be on or before the end date.');
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
        summaryRes,
        pnlRes,
        salesPerfRes,
        paymentsRes,
        inventoryRes,
        creditRes,
        purchasesRes,
      ] = await Promise.all([
        API.get(`management-analytics/summary/?${queryParams}`),
        API.get(`management-analytics/profit-loss/?${queryParams}`),
        API.get(`management-analytics/sales-performance/?${queryParams}`),
        API.get(`management-analytics/payment-methods/?${queryParams}`),
        API.get(`management-analytics/inventory/?${queryParams}`),
        API.get(`management-analytics/credit/?${queryParams}`),
        API.get(`management-analytics/purchases/?${queryParams}`),
      ]);

      setSummaryData(summaryRes.data);
      setPnlData(pnlRes.data);
      setSalesPerfData(salesPerfRes.data);
      setPaymentMethodsData(paymentsRes.data);
      setInventoryData(inventoryRes.data);
      setCreditData(creditRes.data);
      setPurchasesData(purchasesRes.data);

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch optimized management analytics:', err);
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

  // Filter out "SPLIT" payments to render actual channels (Cash, Paybill, Send Money, Credit, Bank)
  const paymentBreakdownData = useMemo(() => {
    if (!paymentMethodsData?.sale_payments) return [];

    const map = {
      CASH: { name: 'Cash', fill: '#6366F1' },
      MPESA: { name: 'M-Pesa / Mobile', fill: '#10B981' },
      PAYBILL: { name: 'Paybill / Till', fill: '#F59E0B' },
      SEND_MONEY: { name: 'Send Money', fill: '#3B82F6' },
      CREDIT: { name: 'Credit Owed', fill: '#8B5CF6' },
      BANK_TRANSFER: { name: 'Bank Transfer', fill: '#EC4899' },
    };

    return paymentMethodsData.sale_payments
      .filter((sp) => sp.method !== 'SPLIT') // Exclude generic "SPLIT" label
      .map((sp) => ({
        name: map[sp.method]?.name || sp.method,
        value: toNumber(sp.amount),
        fill: map[sp.method]?.fill || '#64748B',
      }))
      .filter((item) => item.value > 0);
  }, [paymentMethodsData]);

  const profitLossChartData = useMemo(() => {
    if (!pnlData) return [];
    return [
      { name: 'Revenue', amount: toNumber(pnlData.revenue), fill: '#4F46E5' },
      { name: 'COGS', amount: toNumber(pnlData.cost_of_goods_sold), fill: '#E11D48' },
      { name: 'Gross Profit', amount: toNumber(pnlData.gross_profit), fill: '#10B981' },
      { name: 'Expenses', amount: toNumber(pnlData.expenses), fill: '#F59E0B' },
      { name: 'Net Profit', amount: toNumber(pnlData.net_profit), fill: '#0EA5E9' },
    ];
  }, [pnlData]);

  const summaryMetrics = useMemo(() => {
    const pending = requests.filter((r) => r.status?.toUpperCase().includes('PENDING')).length;
    const approved = requests.filter((r) => r.status?.toUpperCase().includes('APPROVED')).length;
    const rejected = requests.filter((r) => r.status?.toUpperCase().includes('REJECTED')).length;
    return { pending, approved, rejected, total: requests.length };
  }, [requests]);

  if (!authToken) {
    return (
      <div className="min-h-screen relative w-full flex items-center justify-center p-4 font-sans text-slate-800 bg-slate-100">
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
              className="w-full py-3 bg-indigo-600 text-white text-xs font-bold rounded-xl transition shadow-md"
            >
              {loginLoading ? 'Authenticating...' : '🔐 Sign In to Management Portal'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative w-full text-slate-900 p-3 sm:p-6 font-sans bg-slate-950/5">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* HEADER & TOP NAVBAR */}
        <div className="sticky top-2 z-50 bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 text-white shadow-xl">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src="/logo.svg" alt="Melvex Business Solutions" className="h-12 sm:h-14 w-auto object-contain" />
              <div className="border-l border-slate-800 pl-4 hidden sm:block">
                <h1 className="text-lg font-extrabold tracking-tight">Management Dashboard</h1>
                <p className="text-xs text-slate-400">Optimized branch analytics, operations, and financial reporting.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-2xl">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Branch:</label>
                <select
                  value={branchKey}
                  onChange={(e) => setSelectedBranch?.(e.target.value)}
                  className="bg-transparent text-white text-xs font-semibold outline-none cursor-pointer"
                >
                  {branches.map((b) => (
                    <option key={b.id || b.code} value={b.id || b.code} className="bg-slate-900 text-white">
                      {b.name || b.branch_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* NAV TAB ITEMS */}
              <nav className="flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700">
                {[
                  { id: 'OVERVIEW', label: 'Overview' },
                  { id: 'OPERATIONS', label: 'Operations' },
                  { id: 'REVIEWS', label: 'Approvals', badge: summaryMetrics.pending },
                  { id: 'CASHBOOK', label: 'Cashbook' },
                  { id: 'BALANCE_SHEET', label: 'Balance Sheet' },
                  { id: 'REPORTS', label: 'Reports' },
                  { id: 'ACCOUNTS', label: 'Accounts' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    {tab.label}
                    {tab.badge > 0 && (
                      <span className="ml-1.5 bg-indigo-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>

              <button
                onClick={handleLogout}
                className="px-3.5 py-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-semibold rounded-xl border border-rose-500/30 transition cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* GLOBAL MANAGEMENT DATE FILTER BAR */}
        <ManagementDateFilterBar dateFilter={dateFilter} setDateFilter={setDateFilter} />

        {dashboardError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex justify-between items-center">
            <span>{dashboardError}</span>
            <button onClick={() => setDashboardError('')} className="font-bold">✕</button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1 text-xs text-slate-500">
          <span>
            Reporting dates:{' '}
            <strong className="text-slate-700">
              {effectiveRange.effectiveStartDate || 'Start not set'} – {effectiveRange.effectiveEndDate || 'End not set'}
            </strong>
          </span>
          <span>{lastUpdated ? `Last refreshed ${lastUpdated.toLocaleTimeString()}` : 'Dashboard'}</span>
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6 max-w-6xl mx-auto font-sans">
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg border border-slate-800">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">
                    Branch Executive Summary
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Business Performance
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-md">
                    Lightweight API analytics loaded directly from Django.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 backdrop-blur-sm">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                      Gross Sales Volume
                    </span>
                    <span className="text-lg sm:text-xl font-bold font-mono text-indigo-400">
                      {formatCurrency(summaryData?.sales?.gross_sales)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                      Cash Received from Sales
                    </span>
                    <span className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
                      {formatCurrency(summaryData?.sales?.sales_cash_received)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-800/80">
                <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/50">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Total Transactions
                  </span>
                  <span className="text-lg font-bold font-mono text-indigo-300">
                    {summaryData?.sales?.transaction_count || 0} Orders
                  </span>
                </div>

                <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/50">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Credit Issued
                  </span>
                  <span className="text-lg font-bold font-mono text-amber-300">
                    {formatCurrency(summaryData?.sales?.credit_issued)}
                  </span>
                </div>

                <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/50">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Pending Approvals
                  </span>
                  <span className="text-lg font-bold font-mono text-purple-400">
                    {summaryMetrics.pending} Requests
                  </span>
                </div>
              </div>
            </div>

            {/* Credit & Purchases Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Customer Credit Summary
                    </h2>
                    <p className="text-xs text-slate-500">Credit activity & collections for period</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                      New Credit Sales
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 block">
                      {formatCurrency(creditData?.new_credit_sales)}
                    </span>
                  </div>

                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase block mb-1">
                      Repayments Received
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-emerald-700 block">
                      {formatCurrency(creditData?.repayments_received_in_period)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Purchases & Restocks
                    </h2>
                    <p className="text-xs text-slate-500">Restock procurement total</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                    <span className="text-[9px] font-bold text-blue-600 uppercase block mb-1">
                      Restock Total Cost
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-blue-900 block">
                      {formatCurrency(purchasesData?.purchase_total)}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">
                      Purchase Invoices
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 block">
                      {purchasesData?.purchase_count || 0} Batches
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Inventory Valuation & Low Stock warning */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Inventory Status & Stock Valuation
                  </h2>
                  <p className="text-xs text-slate-500">Live store stock quantities and cost valuation</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <span className="block text-[10px] font-bold text-indigo-700 uppercase">
                    Inventory Value (Cost)
                  </span>
                  <span className="text-base font-bold font-mono text-indigo-900">
                    {formatCurrency(inventoryData?.inventory_value_at_cost)}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="block text-[10px] font-bold text-slate-600 uppercase">
                    Total Physical Stock Qty
                  </span>
                  <span className="text-base font-bold font-mono text-slate-900">
                    {formatNumber(inventoryData?.total_quantity)} Units
                  </span>
                </div>

                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                  <span className="block text-[10px] font-bold text-amber-700 uppercase">
                    Low Stock Threshold Warnings
                  </span>
                  <span className="text-base font-bold font-mono text-amber-800">
                    {inventoryData?.low_stock_count || 0} Items
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CASHBOOK & BALANCE SHEET TABS */}
        {(activeTab === 'CASHBOOK' || activeTab === 'BALANCE_SHEET') && (
          <Cashbook selectedBranch={branchKey} />
        )}

        {/* REPORTS TAB WITH CHARTS & PAYMENT BREAKDOWN */}
        {activeTab === 'REPORTS' && (
          <div className="space-y-6">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
              {[
                { id: 'PROFIT_LOSS', label: '📊 Profit & Loss Statement' },
                { id: 'SALES_ANALYSIS', label: '📈 Sales Performance Analysis' },
                { id: 'PAYMENT_BREAKDOWN', label: '💳 Payment Methods Breakdown' },
                { id: 'SUMMARIZED_REPORT', label: '📄 Comprehensive Executive Report' },
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setReportSubTab(sub.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    reportSubTab === sub.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* 1. PROFIT AND LOSS PANEL */}
            {reportSubTab === 'PROFIT_LOSS' && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 font-sans">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider">
                    Profit & Loss Statement (P&L)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Statement generated dynamically via Django backend viewset.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase">Profitability Chart</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={profitLossChartData} margin={{ top: 15, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600, fill: '#334155' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v) => `KSh ${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v) => [formatCurrency(v), 'Amount']} />
                        <Bar dataKey="amount" radius={[6, 6, 0, 0]} barSize={40}>
                          {profitLossChartData.map((entry, index) => (
                            <Cell key={`pl-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Revenue</span>
                    <span className="text-lg font-bold font-mono text-slate-900 block mt-1">
                      {formatCurrency(pnlData?.revenue)}
                    </span>
                  </div>

                  <div className="p-4 bg-rose-50 rounded-xl border border-rose-200">
                    <span className="text-[10px] font-bold text-rose-600 uppercase block">COGS</span>
                    <span className="text-lg font-bold font-mono text-rose-800 block mt-1">
                      {formatCurrency(pnlData?.cost_of_goods_sold)}
                    </span>
                  </div>

                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase block">Gross Profit</span>
                    <span className="text-lg font-bold font-mono text-emerald-800 block mt-1">
                      {formatCurrency(pnlData?.gross_profit)}
                    </span>
                  </div>

                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase block">Net Profit</span>
                    <span className="text-lg font-bold font-mono text-indigo-900 block mt-1">
                      {formatCurrency(pnlData?.net_profit)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. SALES ANALYSIS PANEL */}
            {reportSubTab === 'SALES_ANALYSIS' && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 font-sans">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider">
                    Sales & Performance Analytics
                  </h2>
                  <p className="text-xs text-slate-500">
                    Daily sales trends and order volumes for period.
                  </p>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold text-[11px] uppercase">
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4 text-right">Transactions</th>
                        <th className="py-3.5 px-4 text-right">Gross Sales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {!salesPerfData?.daily || salesPerfData.daily.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="py-8 text-center text-slate-500">
                            No sales records available for the selected period.
                          </td>
                        </tr>
                      ) : (
                        salesPerfData.daily.map((row) => (
                          <tr key={row.date} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4 font-bold text-slate-900">{row.date}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                              {row.transactions} orders
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600">
                              {formatCurrency(row.gross_sales)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. PAYMENT METHODS PANEL */}
            {reportSubTab === 'PAYMENT_BREAKDOWN' && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 font-sans">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider">
                    Payment Channel Breakdown
                  </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase">Settlement Chart</h3>
                    <div className="h-64 w-full">
                      {paymentBreakdownData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={paymentBreakdownData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {paymentBreakdownData.map((entry, index) => (
                                <Cell key={`pie-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => [formatCurrency(v), 'Amount']} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400">
                          No channel data available.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {paymentMethodsData?.sale_payments
                      ?.filter((sp) => sp.method !== 'SPLIT') // Exclude generic SPLIT card
                      ?.map((sp) => (
                        <div key={sp.method} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">{sp.method}</span>
                            <span className="text-base font-extrabold font-mono text-slate-900">{formatCurrency(sp.amount)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. SUMMARIZED REPORT */}
            {reportSubTab === 'SUMMARIZED_REPORT' && <Reports items={[]} />}
          </div>
        )}

        {/* ACCOUNTS TAB */}
        {activeTab === 'ACCOUNTS' && (
          <section className="mx-auto max-w-5xl space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-2 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">User Account</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">Account Details</h2>
                </div>
                <span className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Signed In</span>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  { label: 'Username', value: currentUser?.username || 'Not provided' },
                  { label: 'Email Address', value: currentUser?.email || 'Not provided' },
                  { label: 'Role', value: currentUser?.role || 'Manager' },
                  { label: 'Branch', value: selectedBranch?.name || branchKey || 'Not selected' },
                ].map((field) => (
                  <div key={field.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</p>
                    <p className="mt-2 break-words text-base font-semibold text-slate-900">{field.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex justify-end">
                <button type="button" onClick={handleLogout} className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Sign Out</button>
              </div>
            </div>
          </section>
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

      </div>
    </div>
  );
}