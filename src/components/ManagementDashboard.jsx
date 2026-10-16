// src/components/ManagementDashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import API from '../api';
import { useBranch } from './BranchContext';
import ManagementOperations from './ManagementOperations';

/* =========================================================
   HELPERS & CALCULATORS (ALIGNED WITH APP.JSX)
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

const getRemainingStock = (item) =>
  toNumber(item?.remaining_stock ?? item?.current_stock ?? item?.stock);

const formatDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getRecordDateStr = (record) => {
  const rawDate =
    record?.date ||
    record?.payment_date ||
    record?.repayment_date ||
    record?.created_at ||
    record?.sale_date ||
    record?.purchase_date ||
    record?.timestamp;

  if (!rawDate) return '';
  if (typeof rawDate === 'string') return rawDate.split('T')[0];

  try {
    return new Date(rawDate).toISOString().split('T')[0];
  } catch {
    return '';
  }
};

const normalizePaymentMethod = (methodName) => {
  if (!methodName) return 'CASH';
  const clean = String(methodName).trim().toUpperCase().replace(/[- ]/g, '_');

  if (clean.includes('PAYBILL') || clean.includes('PAY_BILL') || clean.includes('C2B')) {
    return 'PAYBILL';
  }

  if (
    clean.includes('SEND_MONEY') ||
    clean.includes('SENDMONEY') ||
    clean.includes('TILL') ||
    clean.includes('BUY_GOODS') ||
    clean.includes('BUYGOODS') ||
    clean.includes('P2P') ||
    clean.includes('MPESA') ||
    clean.includes('M_PESA') ||
    clean.includes('MOBILE')
  ) {
    return 'MPESA';
  }

  if (clean.includes('CREDIT') || clean.includes('DEBT') || clean.includes('ON_ACCOUNT')) {
    return 'CREDIT';
  }

  if (clean.includes('BANK') || clean.includes('TRANSFER') || clean.includes('EFT')) {
    return 'BANK_TRANSFER';
  }

  if (clean.includes('SPLIT')) return 'SPLIT';

  return 'CASH';
};

const fetchPaginatedData = async (initialEndpoint) => {
  let results = [];
  let currentEndpoint = initialEndpoint;

  while (currentEndpoint) {
    let cleanPath = currentEndpoint;

    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      try {
        const urlObj = new URL(cleanPath);
        cleanPath = urlObj.pathname + urlObj.search;
      } catch (e) {
        /* ignore */
      }
    }

    if (cleanPath.startsWith('/api/')) {
      cleanPath = cleanPath.replace(/^\/api\//, '');
    } else if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.slice(1);
    }

    try {
      const res = await API.get(cleanPath);
      const data = res.data;

      if (Array.isArray(data)) {
        results = results.concat(data);
        break;
      } else if (data?.results && Array.isArray(data.results)) {
        results = results.concat(data.results);
        currentEndpoint = data.next ? data.next : null;
      } else {
        break;
      }
    } catch (e) {
      console.warn(`Fetch error on path: ${cleanPath}`, e);
      break;
    }
  }

  return results;
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
            Management Analytics Horizon
          </h2>
          <p className="text-[11px] text-slate-500">
            Selected date boundaries apply across Dashboard, Inventory, Operations, and Reports
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-700">Filter Period:</label>
          <select
            value={filterMode}
            onChange={(e) => setDateFilter((prev) => ({ ...prev, filterMode: e.target.value }))}
            className="bg-slate-100 border border-slate-300 font-bold text-xs text-slate-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Time</option>
            <option value="DAILY">Daily Pick</option>
            <option value="THIS_WEEK">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="THIS_YEAR">Yearly</option>
            <option value="CUSTOM">Custom Range</option>
          </select>
        </div>
      </div>

      {filterMode === 'DAILY' && (
        <div className="flex items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <label className="font-bold text-slate-700">Choose Specific Day:</label>
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
          <label className="font-bold text-slate-700">Choose Specific Month:</label>
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

export default function ManagementDashboard({ onLogout, currentUser: initialUser }) {
  const { selectedBranch, setSelectedBranch, branches = [] } = useBranch();

  // Auth State
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

  // Login Form
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Active Nav Tab
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('mgmt_active_tab') || 'OVERVIEW';
  });

  const [operationsSection, setOperationsSection] = useState(() => {
    return localStorage.getItem('mgmt_operations_section') || 'inventory';
  });

  useEffect(() => {
    localStorage.setItem('mgmt_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('mgmt_operations_section', operationsSection);
  }, [operationsSection]);

  // Review Requests State
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Global Management Date Filter Horizon
  const [dateFilter, setDateFilter] = useState({
    filterMode: 'ALL',
    selectedDay: formatDateString(new Date()),
    selectedMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    startDate: '',
    endDate: '',
  });

  // Real-Time Calculated Financial Metrics
  const [items, setItems] = useState([]);
  const [paymentTotals, setPaymentTotals] = useState({
    MPESA: 0,
    CASH: 0,
    CREDIT: 0,
    PAYBILL: 0,
  });
  const [creditSummary, setCreditSummary] = useState({
    totalCreditIssued: 0,
    totalRecovered: 0,
    outstandingCredit: 0,
  });
  const [restockSummary, setRestockSummary] = useState({
    totalRestocksValue: 0,
    totalSupplierPayables: 0,
  });
  const [loadingFinancials, setLoadingFinancials] = useState(false);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_data');
    localStorage.removeItem('mgmt_active_tab');
    localStorage.removeItem('mgmt_operations_section');
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

      const userObj = res.data?.user || {
        username: loginForm.username,
        role: 'Manager',
        email: `${loginForm.username}@admin.com`,
      };

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

  const fetchItems = useCallback(async () => {
    if (!authToken || !selectedBranch) return;
    try {
      const res = await API.get(`items/?branch=${encodeURIComponent(selectedBranch)}`);
      const fetchedItems = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setItems(fetchedItems);
    } catch (e) {
      console.error('Failed to fetch items:', e);
    }
  }, [authToken, selectedBranch]);

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

  // Compute effective date bounds from dateFilter state
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

  // DIRECT METRICS COMPUTATION (APPLIES DATE RANGE PARITY WITH USER PORTAL)
  const computeDashboardMetricsDirectly = useCallback(async () => {
    if (!authToken || !selectedBranch) return;

    setLoadingFinancials(true);
    const { effectiveStartDate, effectiveEndDate } = effectiveRange;

    try {
      const salesParams = new URLSearchParams({ branch: selectedBranch });
      const repaymentsParams = new URLSearchParams({ branch: selectedBranch });
      const purchasesParams = new URLSearchParams({ branch: selectedBranch });

      const [rawSales, rawRepayments, rawPurchases] = await Promise.all([
        fetchPaginatedData(`sales/?${salesParams.toString()}`),
        fetchPaginatedData(`credit-repayments/?${repaymentsParams.toString()}`),
        fetchPaginatedData(`purchases/?${purchasesParams.toString()}`),
      ]);

      let totalCreditIssued = 0;
      const totals = { MPESA: 0, CASH: 0, CREDIT: 0, PAYBILL: 0 };

      // 1. Process Sales strictly based on effective date bounds
      const sales = rawSales.filter((s) => {
        const dateStr = getRecordDateStr(s);
        if (!dateStr) return true;
        if (effectiveStartDate && dateStr < effectiveStartDate) return false;
        if (effectiveEndDate && dateStr > effectiveEndDate) return false;
        return true;
      });

      sales.forEach((sale) => {
        const rawMethod = String(sale?.payment_method || '').toUpperCase();
        const splitPayments =
          Array.isArray(sale?.split_payments) && sale.split_payments.length > 0
            ? sale.split_payments
            : Array.isArray(sale?.payments) && sale.payments.length > 0
            ? sale.payments
            : [];

        const totalAmt = toNumber(sale?.total_amount || sale?.amount || sale?.total_price);
        const initialDeposit = toNumber(
          sale?.initial_deposit ?? sale?.deposit ?? sale?.down_payment ?? sale?.initial_paid
        );

        if (rawMethod === 'CREDIT' || Boolean(sale?.is_credit)) {
          const debtIssued = Math.max(0, totalAmt - initialDeposit);
          totals.CREDIT += debtIssued;
          totalCreditIssued += debtIssued;

          if (initialDeposit > 0) {
            const depositChannel = normalizePaymentMethod(
              sale?.deposit_payment_method || sale?.initial_payment_method || sale?.payment_mode
            );
            if (depositChannel === 'MPESA') totals.MPESA += initialDeposit;
            else if (depositChannel === 'PAYBILL') totals.PAYBILL += initialDeposit;
            else totals.CASH += initialDeposit;
          }
        } else if (rawMethod === 'SPLIT' || splitPayments.length > 0) {
          let splitLiquidTotal = 0;

          splitPayments.forEach((sp) => {
            const spAmt = toNumber(sp?.amount || sp?.amount_paid || sp?.value || sp?.total);
            const spRawMethod =
              sp?.payment_method ||
              sp?.method ||
              sp?.payment_mode ||
              sp?.channel ||
              sp?.type ||
              '';

            const spChannel = normalizePaymentMethod(spRawMethod);

            if (spChannel === 'CREDIT') {
              totals.CREDIT += spAmt;
              totalCreditIssued += spAmt;
            } else {
              splitLiquidTotal += spAmt;
              if (spChannel === 'MPESA') totals.MPESA += spAmt;
              else if (spChannel === 'PAYBILL') totals.PAYBILL += spAmt;
              else totals.CASH += spAmt;
            }
          });

          const unallocatedCredit = Math.max(0, totalAmt - (splitLiquidTotal + totals.CREDIT));
          if (unallocatedCredit > 0) {
            totals.CREDIT += unallocatedCredit;
            totalCreditIssued += unallocatedCredit;
          }
        } else {
          const channel = normalizePaymentMethod(sale?.payment_method);
          if (channel === 'MPESA') totals.MPESA += totalAmt;
          else if (channel === 'PAYBILL') totals.PAYBILL += totalAmt;
          else totals.CASH += totalAmt;
        }
      });

      // 2. Process Repayments strictly by date
      let totalRecovered = 0;
      const repayments = rawRepayments.filter((r) => {
        const dateStr = getRecordDateStr(r);
        if (!dateStr) return true;
        if (effectiveStartDate && dateStr < effectiveStartDate) return false;
        if (effectiveEndDate && dateStr > effectiveEndDate) return false;
        return true;
      });

      repayments.forEach((rep) => {
        const amount = toNumber(rep?.amount || rep?.amount_paid);
        const channel = normalizePaymentMethod(rep?.payment_method || rep?.method);

        totalRecovered += amount;

        if (channel === 'MPESA') totals.MPESA += amount;
        else if (channel === 'PAYBILL') totals.PAYBILL += amount;
        else totals.CASH += amount;
      });

      const netCreditOutstanding = Math.max(0, totalCreditIssued - totalRecovered);
      totals.CREDIT = netCreditOutstanding;

      setPaymentTotals(totals);

      setCreditSummary({
        totalCreditIssued,
        totalRecovered,
        outstandingCredit: netCreditOutstanding,
      });

      // 3. Process Restocks & Purchases strictly by date
      const purchases = rawPurchases.filter((p) => {
        const dateStr = getRecordDateStr(p);
        if (!dateStr) return true;
        if (effectiveStartDate && dateStr < effectiveStartDate) return false;
        if (effectiveEndDate && dateStr > effectiveEndDate) return false;
        return true;
      });

      let totalRestocksValue = 0;
      purchases.forEach((p) => {
        totalRestocksValue += toNumber(p?.total_cost || p?.quantity * p?.unit_cost_price);
      });

      setRestockSummary({
        totalRestocksValue,
        totalSupplierPayables: 0,
      });
    } catch (err) {
      console.error('Failed to compute management metrics:', err);
    } finally {
      setLoadingFinancials(false);
    }
  }, [authToken, selectedBranch, effectiveRange]);

  useEffect(() => {
    if (!authToken) return;

    fetchItems();
    fetchRequests();

    if (activeTab === 'OVERVIEW') {
      computeDashboardMetricsDirectly();
    }
  }, [authToken, selectedBranch, activeTab, fetchItems, fetchRequests, computeDashboardMetricsDirectly]);

  const metrics = useMemo(() => {
    let totalCostValuation = 0;
    let totalRetailValuation = 0;
    let totalEstimatedCOGS = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    items.forEach((item) => {
      const qty = getRemainingStock(item);
      const cost = toNumber(item?.unit_cost_price);
      const retail = toNumber(item?.unit_retail_price || item?.unit_selling_price);

      totalCostValuation += qty * cost;
      totalRetailValuation += qty * retail;

      const totalUnitsSold = toNumber(item?.total_stock_sold || item?.quantity_sold || 0);
      totalEstimatedCOGS += totalUnitsSold * cost;

      if (qty === 0) outOfStockCount++;
      else if (Boolean(item?.is_low_stock)) lowStockCount++;
    });

    const healthyCount = Math.max(0, items.length - lowStockCount - outOfStockCount);

    return {
      totalCostValuation,
      totalRetailValuation,
      totalEstimatedCOGS,
      lowStockCount,
      outOfStockCount,
      healthyCount,
    };
  }, [items]);

  const summaryMetrics = useMemo(() => {
    const pending = requests.filter((r) => r.status?.toUpperCase().includes('PENDING')).length;
    const approved = requests.filter((r) => r.status?.toUpperCase().includes('APPROVED')).length;
    const rejected = requests.filter((r) => r.status?.toUpperCase().includes('REJECTED')).length;
    return { pending, approved, rejected, total: requests.length };
  }, [requests]);

  const totalCount = items.length || 1;
  const healthyPct = Math.round((metrics.healthyCount / totalCount) * 100);
  const lowStockPct = Math.round((metrics.lowStockCount / totalCount) * 100);
  const outOfStockPct = Math.round((metrics.outOfStockCount / totalCount) * 100);

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
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 text-white shadow-lg">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src="/logo.svg" alt="Melvex Business Solutions" className="h-12 sm:h-14 w-auto object-contain" />
              <div className="border-l border-slate-800 pl-4 hidden sm:block">
                <h1 className="text-lg font-extrabold tracking-tight">Management Executive Dashboard</h1>
                <p className="text-xs text-slate-400">Branch operational metrics, inventory health, and reports.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-2xl">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Branch:</label>
                <select
                  value={selectedBranch || ''}
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

              <nav className="flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700">
                {[
                  { id: 'OVERVIEW', label: 'Dashboard' },
                  { id: 'INVENTORY', label: 'Inventory' },
                  { id: 'REPORTS', label: 'Reports' },
                  { id: 'REVIEWS', label: 'User Reviews', badge: summaryMetrics.pending },
                  { id: 'OPERATIONS', label: 'Operations' },
                  { id: 'CASHBOOK', label: 'Cashbook' },
                  { id: 'BALANCE_SHEET', label: 'Balance Sheet' },
                ].map((tab) => (
                  <button
                    key={tab.id}
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

        {/* OVERVIEW TAB */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6 max-w-6xl mx-auto font-sans">
            
            {/* Operational & COGS Analytics */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg border border-slate-800">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">
                    Branch Overview
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Operational & COGS Analytics
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-md">
                    Real-time cost of goods sold, catalog metrics, and inventory ratios.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 backdrop-blur-sm">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                      Total Inventory Valuation (Cost)
                    </span>
                    <span className="text-lg sm:text-xl font-bold font-mono text-indigo-400">
                      {formatCurrency(metrics.totalCostValuation)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                      Estimated Sales COGS
                    </span>
                    <span className="text-lg sm:text-xl font-bold font-mono text-amber-400">
                      {formatCurrency(metrics.totalEstimatedCOGS)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-800/80">
                <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/50">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Cataloged SKUs
                  </span>
                  <span className="text-lg font-bold font-mono text-indigo-300">
                    {items.length} Products
                  </span>
                </div>

                <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/50">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Pending Management Sign-offs
                  </span>
                  <span
                    className={`text-lg font-bold font-mono ${
                      summaryMetrics.pending > 0 ? 'text-purple-400' : 'text-slate-200'
                    }`}
                  >
                    {summaryMetrics.pending} Requests
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Credit & Restocks Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Customer Credit Summary
                    </h2>
                    <p className="text-xs text-slate-500">
                      Period credit activity & live total balance
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                      Credit Issued (Period)
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 block">
                      {formatCurrency(creditSummary.totalCreditIssued)}
                    </span>
                  </div>

                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase block mb-1">
                      Recovered (Period)
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-emerald-700 block">
                      {formatCurrency(creditSummary.totalRecovered)}
                    </span>
                  </div>

                  <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
                    <span className="text-[9px] font-bold text-rose-500 uppercase block mb-1">
                      Live Total Debt Owed
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-rose-700 block">
                      {formatCurrency(creditSummary.outstandingCredit)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Restocks & Supplier Payables
                    </h2>
                    <p className="text-xs text-slate-500">
                      Purchases valuation & outstanding supplier payables
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                    <span className="text-[9px] font-bold text-blue-600 uppercase block mb-1">
                      Total Restock Purchases
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-blue-900 block">
                      {formatCurrency(restockSummary.totalRestocksValue)}
                    </span>
                  </div>

                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                    <span className="text-[9px] font-bold text-amber-600 uppercase block mb-1">
                      Supplier Owed Payables
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-amber-800 block">
                      {formatCurrency(restockSummary.totalSupplierPayables)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment & Settlement Channels */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Payment & Settlement Channels
                  </h2>
                  <p className="text-xs text-slate-500">
                    Live settlement amounts processed per financial channel
                  </p>
                </div>
                {loadingFinancials && (
                  <span className="text-xs font-bold text-indigo-600 animate-pulse">
                    Syncing...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl border space-y-2 border-emerald-200 bg-emerald-50/50 text-emerald-900">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-300">
                      MPESA
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-700">M-Pesa / Mobile Money</h3>
                    <span className="text-base font-bold font-mono text-slate-900 block mt-1">
                      {formatCurrency(paymentTotals.MPESA)}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border space-y-2 border-indigo-200 bg-indigo-50/50 text-indigo-900">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-indigo-100 text-indigo-800 border-indigo-300">
                      CASH
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-700">Cash Transactions</h3>
                    <span className="text-base font-bold font-mono text-slate-900 block mt-1">
                      {formatCurrency(paymentTotals.CASH)}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border space-y-2 border-amber-200 bg-amber-50/50 text-amber-900">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-300">
                      CREDIT
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-700">Credit / On Account</h3>
                    <span className="text-base font-bold font-mono text-slate-900 block mt-1">
                      {formatCurrency(paymentTotals.CREDIT)}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border space-y-2 border-purple-200 bg-purple-50/50 text-purple-900">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-purple-100 text-purple-800 border-purple-300">
                      PAYBILL
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-700">Paybill / Till Transfer</h3>
                    <span className="text-base font-bold font-mono text-slate-900 block mt-1">
                      {formatCurrency(paymentTotals.PAYBILL)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Inventory Health Ratio */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Inventory Health Ratio
                </h2>
                <p className="text-xs text-slate-500">
                  Proportion of optimal vs. threshold stock across registered items
                </p>
              </div>

              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                <div style={{ width: `${healthyPct}%` }} className="bg-emerald-500" title={`Optimal Stock: ${healthyPct}%`} />
                <div style={{ width: `${lowStockPct}%` }} className="bg-amber-400" title={`Low Stock: ${lowStockPct}%`} />
                <div style={{ width: `${outOfStockPct}%` }} className="bg-rose-500" title={`Out of Stock: ${outOfStockPct}%`} />
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs">
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <span className="block text-[10px] font-bold text-emerald-700 uppercase">
                    Optimal Stock
                  </span>
                  <span className="text-base font-bold font-mono text-emerald-800">
                    {metrics.healthyCount} ({healthyPct}%)
                  </span>
                </div>
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                  <span className="block text-[10px] font-bold text-amber-700 uppercase">
                    Low Stock Threshold
                  </span>
                  <span className="text-base font-bold font-mono text-amber-800">
                    {metrics.lowStockCount} ({lowStockPct}%)
                  </span>
                </div>
                <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100">
                  <span className="block text-[10px] font-bold text-rose-700 uppercase">
                    Out of Stock
                  </span>
                  <span className="text-base font-bold font-mono text-rose-800">
                    {metrics.outOfStockCount} ({outOfStockPct}%)
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* INVENTORY TAB */}
        {activeTab === 'INVENTORY' && (
          <ManagementOperations
            selectedBranch={selectedBranch}
            initialSection="inventory"
            effectiveRange={effectiveRange}
            onBack={() => setActiveTab('OVERVIEW')}
          />
        )}

        {/* REPORTS TAB */}
        {activeTab === 'REPORTS' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
              Management Reports & Statements
            </h2>
            <p className="text-xs text-slate-500">
              Access cashbook ledgers, balance sheet statements, and audit reports.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <button
                onClick={() => setActiveTab('CASHBOOK')}
                className="p-5 border rounded-2xl bg-slate-50 hover:bg-slate-100 text-left space-y-2 cursor-pointer transition"
              >
                <h3 className="font-bold text-sm text-slate-800">Cashbook Statement</h3>
                <p className="text-xs text-slate-500">View detailed daily inflows, outflows, and net cash movements.</p>
              </button>
              <button
                onClick={() => setActiveTab('BALANCE_SHEET')}
                className="p-5 border rounded-2xl bg-slate-50 hover:bg-slate-100 text-left space-y-2 cursor-pointer transition"
              >
                <h3 className="font-bold text-sm text-slate-800">Statement of Financial Position</h3>
                <p className="text-xs text-slate-500">Review assets, liabilities, and equity calculations.</p>
              </button>
            </div>
          </div>
        )}

        {/* OPERATIONS TAB */}
        {activeTab === 'OPERATIONS' && (
          <ManagementOperations
            selectedBranch={selectedBranch}
            initialSection={operationsSection}
            effectiveRange={effectiveRange}
            onBack={() => setActiveTab('OVERVIEW')}
          />
        )}

      </div>
    </div>
  );
}