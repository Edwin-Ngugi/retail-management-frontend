// src/components/ManagementDashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import API from '../api';
import { useBranch } from './BranchContext';
import ManagementLogin from './ManagementLogin';
import SalesView from './SalesView';
import PurchaseView from './PurchaseView';
import InventoryView from './InventoryView';
import CashView from './CashView';
import ReportsView from './ReportsView';
import ApprovalsDashboard from './ApprovalsDashboard';
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

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('mgmt_active_tab') || 'OVERVIEW';
  });

  const [finSubTab, setFinSubTab] = useState('PROFIT'); // PROFIT, CASHFLOW, BALANCESHEET
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  /* APPROVALS BADGE COUNT STATE */
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  /* IN-APP CHANGE PASSWORD STATE */
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  /* ENFORCED LOGOUT HANDLER FOR TOKEN EXPIRATION */
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

  /* AUTHENTICATION TOKEN AUTO-CHECK ON MOUNT */
  useEffect(() => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (!token) {
      handleLogout();
    }
  }, [handleLogout]);

  useEffect(() => {
    localStorage.setItem('mgmt_active_tab', activeTab);
  }, [activeTab]);

  /* DATE FILTER STATE */
  const [dateFilter, setDateFilter] = useState({
    filterMode: 'MONTHLY', 
    selectedDay: formatDateString(new Date()),
    selectedMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    selectedYear: `${new Date().getFullYear()}`,
    startDate: formatDateString(new Date()),
    endDate: formatDateString(new Date()),
  });

  const [dashboardCardsData, setDashboardCardsData] = useState(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [dashboardError, setDashboardError] = useState('');

  /* DYNAMIC RECEIPT AND PAYMENT LABELS BASED ON FILTER MODE */
  const dynamicReceiptsLabel = useMemo(() => {
    switch (dateFilter.filterMode) {
      case 'DAILY':
        return "Today's Receipts";
      case 'THIS_WEEK':
        return "Weekly Receipts";
      case 'MONTHLY':
        return "Monthly Receipts";
      case 'THIS_YEAR':
        return "Yearly Receipts";
      case 'CUSTOM':
        return "Period Receipts";
      default:
        return "Receipts";
    }
  }, [dateFilter.filterMode]);

  const dynamicPaymentsLabel = useMemo(() => {
    switch (dateFilter.filterMode) {
      case 'DAILY':
        return "Today's Payments";
      case 'THIS_WEEK':
        return "Weekly Payments";
      case 'MONTHLY':
        return "Monthly Payments";
      case 'THIS_YEAR':
        return "Yearly Payments";
      case 'CUSTOM':
        return "Period Payments";
      default:
        return "Payments";
    }
  }, [dateFilter.filterMode]);

  const handleLoginSuccess = (userObj) => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    setCurrentUser(userObj);
    setAuthToken(token);
  };

  /* FETCH PENDING APPROVALS COUNT FOR BADGE */
  const fetchPendingApprovalsCount = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await API.get('pending-approvals/?status=PENDING');
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setPendingApprovalsCount(list.length);
    } catch (err) {
      console.error('Failed to fetch pending approvals count:', err);
    }
  }, [authToken]);

  useEffect(() => {
    fetchPendingApprovalsCount();
  }, [fetchPendingApprovalsCount]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });

    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Please complete all password fields.' });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }

    setPasswordLoading(true);

    try {
      await API.post('auth/change-password/', {
        old_password: passwordForm.oldPassword,
        new_password: passwordForm.newPassword,
      });

      setPasswordMsg({ type: 'success', text: 'Password updated successfully!' });
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      console.error('Password change error:', err);
      if (err.response?.status === 401) {
        handleLogout();
        return;
      }
      setPasswordMsg({
        type: 'error',
        text: err.response?.data?.detail || err.response?.data?.error || 'Failed to update password. Check your current password.',
      });
    } finally {
      setPasswordLoading(false);
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
    if (!authToken) {
      handleLogout();
      return;
    }

    setLoadingFinancials(true);
    setDashboardError('');

    try {
      const queryStr = effectiveQueryParams;
      const cardsRes = await API.get(`management-analytics/dashboard-cards/?${queryStr}`);
      setDashboardCardsData(cardsRes.data);
    } catch (err) {
      console.error('Failed to fetch management analytics:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
        return;
      }
      setDashboardError('Failed to load dashboard metrics. Check server connection.');
    } finally {
      setLoadingFinancials(false);
    }
  }, [authToken, effectiveQueryParams, handleLogout]);           

  useEffect(() => {
    if (activeTab === 'OVERVIEW') {
      fetchManagementAnalytics();
    }
  }, [activeTab, fetchManagementAnalytics]);

  /* PDF DOWNLOAD HANDLER FOR FINANCIAL STATEMENTS */
  const handleDownloadPDF = async (statementType) => {
    setDownloadingPDF(true);
    try {
      const endpoints = {
        PROFIT: 'management-reports/export-profit-loss-pdf/',
        CASHFLOW: 'management-reports/export-cash-flow-pdf/',
        BALANCESHEET: 'management-reports/export-balance-sheet-pdf/'
      };

      const endpoint = endpoints[statementType];
      const queryStr = effectiveQueryParams;
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

      const response = await API.get(`${cleanEndpoint}?${queryStr}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${statementType.toLowerCase()}_statement.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
        return;
      }
      alert('Unable to generate PDF statement. Please try again.');
    } finally {
      setDownloadingPDF(false);
    }
  };

  /* Render ManagementLogin directly if no token/user present */
  if (!authToken || !currentUser) {
    return <ManagementLogin onLoginSuccess={handleLoginSuccess} />;
  }

  const menuItems = [
    { id: 'OVERVIEW', label: 'Dashboard' },
    { id: 'APPROVALS', label: 'Approvals', badge: pendingApprovalsCount },
    { id: 'FINANCIAL_STATEMENT', label: 'Financial Statement' },
    { id: 'REPORTS', label: 'Reports' },
    { id: 'ACCOUNTS', label: 'Accounts' },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900 font-sans">

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
                  {Boolean(item.badge) && (
                    <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
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
      <main className="flex-1 h-full min-w-0 overflow-y-auto flex flex-col bg-white">

        {/* TOP HEADER BAR */}
        <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white px-6 py-3 flex items-center justify-between shadow-md gap-4">
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

        {/* PAGE CONTENT */}
        <div className="p-6 space-y-6 flex-1 w-full bg-white">
          {dashboardError && (
            <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-xl flex justify-between items-center shadow-xs">
              <span>{dashboardError}</span>
              <button onClick={() => setDashboardError('')} className="font-bold ml-2">✕</button>
            </div>
          )}

          {/* DASHBOARD OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

                {/* 1. FINANCIAL PERFORMANCE CARD */}
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
                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[9px] font-bold uppercase">COGS</span>
                      <span className="font-bold text-amber-600 text-xs">
                        {dashboardCardsData?.profitability?.cogs_formatted || 'KSh 0.00'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] font-bold uppercase">Gross Profit</span>
                      <span className="font-bold text-emerald-700 text-xs">
                        {dashboardCardsData?.profitability?.gross_profit_formatted || 'KSh 0.00'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] font-bold uppercase">Net Profit</span>
                      <span className="font-bold text-teal-800 text-xs">
                        {dashboardCardsData?.profitability?.net_profit_formatted || 'KSh 0.00'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. INVENTORY & SKUs CARD */}
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

                {/* 3. CASH MOVEMENT CARD */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Cash Movement
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">{dynamicReceiptsLabel}</span>
                    <div className="text-2xl font-black text-slate-900 tracking-tight">
                      {dashboardCardsData?.cash_flow?.receipts_formatted || dashboardCardsData?.cash_flow?.todays_receipts_formatted || 'KSh 0.00'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">{dynamicPaymentsLabel}</span>
                      <span className="font-bold text-slate-800">
                        {dashboardCardsData?.cash_flow?.payments_formatted || dashboardCardsData?.cash_flow?.todays_payments_formatted || 'KSh 0.00'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Purchases</span>
                      <span className="font-bold text-blue-600">
                        {dashboardCardsData?.cash_flow?.purchases_formatted || dashboardCardsData?.cash_flow?.todays_purchases_formatted || 'KSh 0.00'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. CASH POSITION CARD */}
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

              {/* SALES PERFORMANCE TRAJECTORY CHART */}
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

                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dashboardCardsData?.trajectory || []}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                      <Tooltip formatter={(value, name) => [formatCurrency(value), name]} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar dataKey="total_sales" name="Total Sales" fill="#0D9488" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cogs" name="COGS" fill="#D97706" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="net_profit" name="Net Profit" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* APPROVALS MANAGEMENT PORTAL */}
          {activeTab === 'APPROVALS' && (
            <ApprovalsDashboard
              selectedBranch={branchKey}
              onApprovalComplete={() => {
                fetchPendingApprovalsCount();
                fetchManagementAnalytics();
              }}
            />
          )}

          {/* FINANCIAL STATEMENT MENU (PROFIT, CASH FLOW, BALANCE SHEET) */}
          {activeTab === 'FINANCIAL_STATEMENT' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="bg-teal-700 text-white rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h2 className="text-sm font-black tracking-widest uppercase">FINANCIAL STATEMENT</h2>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleDownloadPDF(finSubTab)}
                    disabled={downloadingPDF}
                    className="flex items-center gap-2 px-3.5 py-1.5 bg-teal-900 hover:bg-teal-950 text-teal-100 hover:text-white border border-teal-500/40 text-xs font-bold rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {downloadingPDF ? 'Generating PDF...' : `Export ${finSubTab.replace('CASHFLOW', 'CASH FLOW').replace('BALANCESHEET', 'BALANCE SHEET')} PDF`}
                  </button>

                  <div className="flex bg-teal-900/60 p-1 rounded-xl border border-teal-500/30 gap-1">
                    <button
                      onClick={() => setFinSubTab('PROFIT')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        finSubTab === 'PROFIT' ? 'bg-white text-teal-950 shadow-xs' : 'text-teal-200 hover:text-white'
                      }`}
                    >
                      Profit & Loss
                    </button>
                    <button
                      onClick={() => setFinSubTab('CASHFLOW')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        finSubTab === 'CASHFLOW' ? 'bg-white text-teal-950 shadow-xs' : 'text-teal-200 hover:text-white'
                      }`}
                    >
                      Cash Flow
                    </button>
                    <button
                      onClick={() => setFinSubTab('BALANCESHEET')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        finSubTab === 'BALANCESHEET' ? 'bg-white text-teal-950 shadow-xs' : 'text-teal-200 hover:text-white'
                      }`}
                    >
                      Balance Sheet
                    </button>
                  </div>
                </div>
              </div>

              {/* RENDER SELECTED FINANCIAL STATEMENT */}
              {finSubTab === 'PROFIT' && <ReportsView branchId={branchKey} initialModule="profit" />}
              {finSubTab === 'CASHFLOW' && <ReportsView branchId={branchKey} initialModule="cashflow" />}
              {finSubTab === 'BALANCESHEET' && <ReportsView branchId={branchKey} initialModule="balancesheet" />}
            </div>
          )}

          {/* MANAGEMENT REPORTS (SALES, PURCHASES, INVENTORY, CASH, ETC) */}
          {activeTab === 'REPORTS' && <ReportsView branchId={branchKey} />}

          {/* ACCOUNTS TAB */}
          {activeTab === 'ACCOUNTS' && (
            <section className="w-full max-w-5xl space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase border-b border-slate-100 pb-3">
                  Account Details
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Username</p>
                    <p className="mt-1 text-base font-bold text-teal-800">{currentUser?.username || 'N/A'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Role</p>
                    <p className="mt-1 text-base font-bold text-teal-800">{currentUser?.role || 'Manager'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase border-b border-slate-100 pb-3">
                  Security & Password Change
                </h2>

                {passwordMsg.text && (
                  <div
                    className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between ${
                      passwordMsg.type === 'success'
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border border-rose-200 text-rose-800'
                    }`}
                  >
                    <span>{passwordMsg.text}</span>
                    <button onClick={() => setPasswordMsg({ type: '', text: '' })} className="ml-2 font-black">
                      ✕
                    </button>
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                      Current Password
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordForm.oldPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-teal-600 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-teal-600 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-teal-600 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {passwordLoading ? 'Updating Password...' : 'Update Password'}
                  </button>
                </form>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}