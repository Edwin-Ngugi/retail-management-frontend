// src/components/ManagementDashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import API from '../api';
import { useBranch } from './BranchContext';
import ManagementOperations from './ManagementOperations';
import Reports from './Reports';
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

const PAYMENT_COLORS = ['#10B981', '#6366F1', '#F59E0B', '#8B5CF6', '#EC4899'];

/* =========================================================
   HELPERS & CALCULATORS
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
      console.error(`Fetch failed for ${cleanPath}`, e);
      throw e;
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
            Reporting period
          </h2>
          <p className="text-[11px] text-slate-500">
            The selected dates apply to the dashboard, operations and reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDateFilter({
              filterMode: 'DAILY',
              selectedDay: formatDateString(new Date()),
              selectedMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
              startDate: '',
              endDate: '',
            })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >Today
          </button>
          <label className="text-xs font-bold text-slate-700">Period:</label>
          <select
            value={filterMode}
            onChange={(e) => setDateFilter((prev) => ({ ...prev, filterMode: e.target.value }))}
            className="bg-slate-100 border border-slate-300 font-bold text-xs text-slate-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="DAILY">Today / specific day</option>
            <option value="THIS_WEEK">This week</option>
            <option value="MONTHLY">This month / specific month</option>
            <option value="THIS_YEAR">This year</option>
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
            <label className="font-bold text-slate-600">Start date:</label>
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
            <label className="font-bold text-slate-600">End date:</label>
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

  // Active Nav Tab & Reports Sub-Tab persistence
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
        /* fallback below */
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

  const [items, setItems] = useState(initialItems);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
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

      // Use the identity returned by the backend. The backend remains the authority
      // for roles and permissions; do not invent a role or email in the browser.
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

  const fetchItems = useCallback(async () => {
    if (!authToken) return;
    try {
      const endpoint = branchKey ? `items/?branch=${encodeURIComponent(branchKey)}` : 'items/';
      const fetchedItems = await fetchPaginatedData(endpoint);
      // An empty branch result is valid. Never replace it with all-branch inventory.
      setItems(Array.isArray(fetchedItems) ? fetchedItems : []);
    } catch (e) {
      console.error('Failed to fetch items:', e);
      setDashboardError('Some dashboard data could not be loaded. Check your connection and refresh.');
      if (e.response?.status === 401) handleLogout();
    }
  }, [authToken, branchKey, handleLogout]);

  const fetchRequests = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await API.get('pending-approvals/');
      const fetchedRequests = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setRequests(fetchedRequests);
    } catch (err) {
      console.error('Failed to load review requests:', err);
      setDashboardError('Approvals could not be loaded. Check your access and connection, then refresh.');
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

  const computeDashboardMetricsDirectly = useCallback(async () => {
    if (!authToken || !branchKey) return;

    const { effectiveStartDate, effectiveEndDate } = effectiveRange;
    if (effectiveStartDate && effectiveEndDate && effectiveStartDate > effectiveEndDate) {
      setDashboardError('Invalid reporting period: the start date must be on or before the end date.');
      setLoadingFinancials(false);
      return;
    }

    setLoadingFinancials(true);
    setDashboardError('');

    try {
      const salesParams = new URLSearchParams({ branch: branchKey });
      const repaymentsParams = new URLSearchParams({ branch: branchKey });
      const purchasesParams = new URLSearchParams({ branch: branchKey });
      const expensesParams = new URLSearchParams({ branch: branchKey });

      const [rawSales, rawRepayments, rawPurchases, rawSplitPayments, rawExpenses] = await Promise.all([
        fetchPaginatedData(`sales/?${salesParams.toString()}`),
        fetchPaginatedData(`credit-repayments/?${repaymentsParams.toString()}`),
        fetchPaginatedData(`purchases/?${purchasesParams.toString()}`),
        fetchPaginatedData(`sale-payments/?branch=${branchKey}`),
        fetchPaginatedData(`expenses/?${expensesParams.toString()}`),
      ]);

      setSales(rawSales);
      setExpenses(rawExpenses);

      const splitMap = {};
      if (Array.isArray(rawSplitPayments)) {
        rawSplitPayments.forEach((sp) => {
          const saleId = sp.sale || sp.transaction || sp.sale_id || sp.transaction_id;
          if (saleId) {
            if (!splitMap[saleId]) splitMap[saleId] = [];
            splitMap[saleId].push(sp);
          }
        });
      }

      let totalCreditIssued = 0;
      const totals = { MPESA: 0, CASH: 0, CREDIT: 0, PAYBILL: 0 };

      const filteredSales = rawSales.filter((s) => {
        const dateStr = getRecordDateStr(s);
        if (!dateStr) return true;
        if (effectiveStartDate && dateStr < effectiveStartDate) return false;
        if (effectiveEndDate && dateStr > effectiveEndDate) return false;
        return true;
      });

      filteredSales.forEach((sale) => {
        const rawMethod = String(sale?.payment_method || '').toUpperCase();
        const inlineSplits =
          Array.isArray(sale?.split_payments) && sale.split_payments.length > 0 && typeof sale.split_payments[0] === 'object'
            ? sale.split_payments
            : Array.isArray(sale?.payments) && sale.payments.length > 0 && typeof sale.payments[0] === 'object'
            ? sale.payments
            : [];

        const splitPayments = inlineSplits.length > 0 ? inlineSplits : splitMap[sale.id] || [];

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
        totalRecovered += amount;
      });

      // Period activity and outstanding debt are different measures. Calculate the
      // cumulative outstanding amount from all available sales and repayment records.
      const allTimeCreditIssued = rawSales.reduce((sum, sale) => {
        const method = String(sale?.payment_method || '').toUpperCase();
        const totalAmt = toNumber(sale?.total_amount || sale?.amount || sale?.total_price);
        const deposit = toNumber(sale?.initial_deposit ?? sale?.deposit ?? sale?.down_payment ?? sale?.initial_paid);
        const inlineSplits = Array.isArray(sale?.split_payments) && sale.split_payments.length
          ? sale.split_payments
          : Array.isArray(sale?.payments) && sale.payments.length
            ? sale.payments
            : [];
        const splits = inlineSplits.length ? inlineSplits : splitMap[sale.id] || [];
        if (method === 'CREDIT' || Boolean(sale?.is_credit)) return sum + Math.max(0, totalAmt - deposit);
        if (method === 'SPLIT' || splits.length) {
          const splitCredit = splits.reduce((creditSum, sp) => {
            const splitMethod = normalizePaymentMethod(sp?.payment_method || sp?.method || sp?.payment_mode || sp?.channel || sp?.type);
            return creditSum + (splitMethod === 'CREDIT' ? toNumber(sp?.amount || sp?.amount_paid || sp?.value || sp?.total) : 0);
          }, 0);
          const allocated = splits.reduce((allocatedSum, sp) => allocatedSum + toNumber(sp?.amount || sp?.amount_paid || sp?.value || sp?.total), 0);
          return sum + splitCredit + Math.max(0, totalAmt - allocated);
        }
        return sum;
      }, 0);
      const allTimeRecovered = rawRepayments.reduce((sum, rep) => sum + toNumber(rep?.amount || rep?.amount_paid), 0);
      const netCreditOutstanding = Math.max(0, allTimeCreditIssued - allTimeRecovered);
      // This payment channel card is period credit issued, not the cumulative balance.
      totals.CREDIT = totalCreditIssued;

      setPaymentTotals(totals);
      setCreditSummary({
        totalCreditIssued,
        totalRecovered,
        outstandingCredit: netCreditOutstanding,
      });

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
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to compute management metrics:', err);
      setDashboardError('Some dashboard data could not be loaded. Values may be incomplete; refresh before relying on them.');
      if (err.response?.status === 401) handleLogout();
    } finally {
      setLoadingFinancials(false);
    }
  }, [authToken, branchKey, effectiveRange, handleLogout]);

  useEffect(() => {
    if (!authToken) return;

    fetchItems();
    fetchRequests();
    computeDashboardMetricsDirectly();
  }, [authToken, branchKey, fetchItems, fetchRequests, computeDashboardMetricsDirectly]);

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

  // Analytics Calculation for Reports Tab
  const reportAnalytics = useMemo(() => {
    const { effectiveStartDate, effectiveEndDate } = effectiveRange;

    const periodSales = sales.filter((s) => {
      const dateStr = getRecordDateStr(s);
      if (!dateStr) return true;
      if (effectiveStartDate && dateStr < effectiveStartDate) return false;
      if (effectiveEndDate && dateStr > effectiveEndDate) return false;
      return true;
    });

    const periodExpenses = expenses.filter((e) => {
      const dateStr = getRecordDateStr(e);
      if (!dateStr) return true;
      if (effectiveStartDate && dateStr < effectiveStartDate) return false;
      if (effectiveEndDate && dateStr > effectiveEndDate) return false;
      return true;
    });

    let totalRevenue = 0;
    let totalCogs = 0;
    const itemSalesMap = {};

    periodSales.forEach((sale) => {
      const saleAmt = toNumber(sale.total_amount || sale.amount || sale.total_price);
      const method = String(sale?.payment_method || '').toUpperCase();
      const deposit = toNumber(sale?.initial_deposit ?? sale?.deposit ?? sale?.down_payment ?? sale?.initial_paid);
      const splitList = Array.isArray(sale?.split_payments) && sale.split_payments.length
        ? sale.split_payments
        : Array.isArray(sale?.payments) && sale.payments.length
          ? sale.payments
          : [];
      let recognizedRevenue = saleAmt;
      if (method === 'CREDIT' || Boolean(sale?.is_credit)) {
        // Credit sales are tracked in the credit ledger, not recognized as cash revenue here.
        recognizedRevenue = deposit;
      } else if (method === 'SPLIT' || splitList.length) {
        recognizedRevenue = splitList.reduce((sum, payment) => {
          const channel = normalizePaymentMethod(payment?.payment_method || payment?.method || payment?.payment_mode || payment?.channel || payment?.type);
          return sum + (channel === 'CREDIT' ? 0 : toNumber(payment?.amount || payment?.amount_paid || payment?.value || payment?.total));
        }, 0);
      }
      totalRevenue += recognizedRevenue;

      const saleItems = sale.items || sale.sale_items || [];
      saleItems.forEach((si) => {
        const itemId = String(si.item || si.item_id || si.product || si.id);
        const itemName = si.name || si.item_name || si.product_name || `Item #${itemId}`;
        const qty = toNumber(si.quantity_sold || si.quantity || si.qty || 1);
        const price = toNumber(si.unit_price || si.price || 0);
        const cost = toNumber(si.unit_cost_price || si.unit_cost || si.cost_price || 0);

        totalCogs += qty * cost;

        if (!itemSalesMap[itemId]) {
          itemSalesMap[itemId] = { id: itemId, name: itemName, qty: 0, revenue: 0 };
        }
        itemSalesMap[itemId].qty += qty;
        itemSalesMap[itemId].revenue += qty * (price || saleAmt);
      });
    });

    let totalExpenseAmount = 0;
    periodExpenses.forEach((exp) => {
      totalExpenseAmount += toNumber(exp.amount || exp.total || exp.cost);
    });

    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalExpenseAmount;

    const itemsPerformanceList = Object.values(itemSalesMap).sort((a, b) => b.revenue - a.revenue);

    return {
      totalRevenue,
      totalCogs,
      grossProfit,
      totalExpenses: totalExpenseAmount,
      netProfit,
      itemsPerformanceList,
    };
  }, [sales, expenses, effectiveRange]);

  // Payment Breakdown Chart Data
  const paymentBreakdownData = useMemo(() => {
    return [
      { name: 'M-Pesa / Mobile', value: paymentTotals.MPESA, fill: '#10B981' },
      { name: 'Cash', value: paymentTotals.CASH, fill: '#6366F1' },
      { name: 'Paybill / Till', value: paymentTotals.PAYBILL, fill: '#F59E0B' },
      { name: 'Credit issued (period)', value: paymentTotals.CREDIT, fill: '#8B5CF6' },
    ].filter((item) => item.value > 0);
  }, [paymentTotals]);

  // P&L Chart Data
  const profitLossChartData = useMemo(() => {
    return [
      { name: 'Revenue', amount: reportAnalytics.totalRevenue, fill: '#4F46E5' },
      { name: 'COGS', amount: reportAnalytics.totalCogs, fill: '#E11D48' },
      { name: 'Gross Profit', amount: reportAnalytics.grossProfit, fill: '#10B981' },
      { name: 'Expenses', amount: reportAnalytics.totalExpenses, fill: '#F59E0B' },
      { name: 'Net Profit', amount: reportAnalytics.netProfit, fill: '#0EA5E9' },
    ];
  }, [reportAnalytics]);

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

        {/* HEADER & TOP NAVBAR (REPORTS MOVED TO END) */}
        <div className="sticky top-2 z-50 bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 text-white shadow-xl">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src="/logo.svg" alt="Melvex Business Solutions" className="h-12 sm:h-14 w-auto object-contain" />
              <div className="border-l border-slate-800 pl-4 hidden sm:block">
                <h1 className="text-lg font-extrabold tracking-tight">Management Dashboard</h1>
                <p className="text-xs text-slate-400">Branch performance, inventory, approvals and financial reports.</p>
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

              {/* REPORTS IS NOW AT THE END OF THE TOP NAV */}
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1 text-xs text-slate-500">
          <span>Reporting dates: <strong className="text-slate-700">{effectiveRange.effectiveStartDate || 'Start not set'} – {effectiveRange.effectiveEndDate || 'End not set'}</strong></span>
          <span>{lastUpdated ? `Last refreshed ${lastUpdated.toLocaleTimeString()}` : 'Dashboard'}</span>
        </div>


        {/* OVERVIEW TAB */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6 max-w-6xl mx-auto font-sans">
            
            {/* Business performance */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg border border-slate-800">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">
                    Branch Overview
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Business performance
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-md">
                    Inventory value, product performance and stock status.
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
                      Estimated cost of goods sold
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
                    Registered products
                  </span>
                  <span className="text-lg font-bold font-mono text-indigo-300">
                    {items.length} Products
                  </span>
                </div>

                <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/50">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Pending approvals
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
                      Credit issued and repayments for the selected period, plus cumulative outstanding credit.
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
                      Credit repayments (period)
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-emerald-700 block">
                      {formatCurrency(creditSummary.totalRecovered)}
                    </span>
                  </div>

                  <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
                    <span className="text-[9px] font-bold text-rose-500 uppercase block mb-1">
                      Outstanding customer credit
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
                      Purchases and supplier balances
                    </h2>
                    <p className="text-xs text-slate-500">
                      Purchase value for the selected period and supplier balances where available.
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

            {/* Payments by method */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Payments by method
                  </h2>
                  <p className="text-xs text-slate-500">
                    Payment amounts recorded for the selected period.
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
                    <h3 className="font-bold text-xs text-slate-700">Credit issued in period</h3>
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

            {/* Stock status */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Stock status
                </h2>
                <p className="text-xs text-slate-500">
                  Registered products grouped by current stock level.
                </p>
              </div>

              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                <div style={{ width: `${healthyPct}%` }} className="bg-emerald-500 transition-all duration-500" title={`Optimal Stock: ${healthyPct}%`} />
                <div style={{ width: `${lowStockPct}%` }} className="bg-amber-400 transition-all duration-500" title={`Low Stock: ${lowStockPct}%`} />
                <div style={{ width: `${outOfStockPct}%` }} className="bg-rose-500 transition-all duration-500" title={`Out of Stock: ${outOfStockPct}%`} />
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

        {/* REPORTS TAB WITH CHARTS & PAYMENT BREAKDOWN */}
        {activeTab === 'REPORTS' && (
          <div className="space-y-6">
            
            {/* SUB-NAVIGATOR FOR REPORTS */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
              {[
                { id: 'PROFIT_LOSS', label: ' Profit & Loss Statement' },
                { id: 'SALES_ANALYSIS', label: ' Sales Performance Analysis' },
                { id: 'PAYMENT_BREAKDOWN', label: ' Payment Methods Breakdown' },
                { id: 'SUMMARIZED_REPORT', label: ' Comprehensive Executive Report' },
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

            {/* 1. PROFIT AND LOSS REPORT PANEL WITH CHARTS */}
            {reportSubTab === 'PROFIT_LOSS' && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 font-sans">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider">
                    Profit & Loss Statement (P&L)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Revenue shown here excludes unpaid credit sales; repayments are tracked separately in the credit activity summary.
                  </p>
                </div>

                {/* VISUAL CHART */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase">Profitability Breakdown Chart</h3>
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
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Recognized revenue (excluding unpaid credit)</span>
                    <span className="text-lg font-bold font-mono text-slate-900 block mt-1">
                      {formatCurrency(reportAnalytics.totalRevenue)}
                    </span>
                  </div>

                  <div className="p-4 bg-rose-50 rounded-xl border border-rose-200">
                    <span className="text-[10px] font-bold text-rose-600 uppercase block">Cost of Goods Sold (COGS)</span>
                    <span className="text-lg font-bold font-mono text-rose-800 block mt-1">
                      {formatCurrency(reportAnalytics.totalCogs)}
                    </span>
                  </div>

                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase block">Gross Profit</span>
                    <span className="text-lg font-bold font-mono text-emerald-800 block mt-1">
                      {formatCurrency(reportAnalytics.grossProfit)}
                    </span>
                  </div>

                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase block">Net Operating Profit</span>
                    <span className="text-lg font-bold font-mono text-indigo-900 block mt-1">
                      {formatCurrency(reportAnalytics.netProfit)}
                    </span>
                  </div>
                </div>

                {/* DETAILED P&L TABLE */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold text-[11px] uppercase">
                        <th className="py-3 px-4">Financial Statement Line Item</th>
                        <th className="py-3 px-4 text-right">Amount (KSh)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      <tr>
                        <td className="py-3 px-4 font-bold text-slate-900">Gross Sales Revenue</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(reportAnalytics.totalRevenue)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-slate-600 pl-8">Less: Direct Cost of Sales (COGS)</td>
                        <td className="py-3 px-4 text-right font-mono text-rose-600">
                          -{formatCurrency(reportAnalytics.totalCogs)}
                        </td>
                      </tr>
                      <tr className="bg-slate-50 font-bold">
                        <td className="py-3 px-4 text-slate-900">GROSS MARGIN / PROFIT</td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-700">
                          {formatCurrency(reportAnalytics.grossProfit)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-slate-600 pl-8">Less: Total Operating Expenses</td>
                        <td className="py-3 px-4 text-right font-mono text-amber-600">
                          -{formatCurrency(reportAnalytics.totalExpenses)}
                        </td>
                      </tr>
                      <tr className="bg-indigo-50/80 font-extrabold border-t-2 border-indigo-200">
                        <td className="py-3.5 px-4 text-indigo-950 uppercase">NET OPERATING INCOME / PROFIT</td>
                        <td className="py-3.5 px-4 text-right font-mono text-indigo-950 text-sm">
                          {formatCurrency(reportAnalytics.netProfit)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. SALES ANALYSIS REPORT PANEL WITH VISUAL PROGRESS BARS */}
            {reportSubTab === 'SALES_ANALYSIS' && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 font-sans">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider">
                    Sales & Product Movement Analysis
                  </h2>
                  <p className="text-xs text-slate-500">
                    Review fast-moving items, revenue contribution, and volume per item.
                  </p>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold text-[11px] uppercase">
                        <th className="py-3.5 px-4">Rank & Item Name</th>
                        <th className="py-3.5 px-4 text-right">Units Sold</th>
                        <th className="py-3.5 px-4 text-right">Recognized revenue</th>
                        <th className="py-3.5 px-4 text-right">Revenue Contribution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {reportAnalytics.itemsPerformanceList.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="py-8 text-center text-slate-500">
                            No sales records available for the selected period.
                          </td>
                        </tr>
                      ) : (
                        reportAnalytics.itemsPerformanceList.map((item, idx) => {
                          const pct = reportAnalytics.totalRevenue > 0
                            ? Math.round((item.revenue / reportAnalytics.totalRevenue) * 100)
                            : 0;

                          return (
                            <tr key={item.id} className="hover:bg-slate-50 transition">
                              <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                                <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-800 flex items-center justify-center text-[10px] font-extrabold">
                                  #{idx + 1}
                                </span>
                                {item.name}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                                {formatNumber(item.qty)} units
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600">
                                {formatCurrency(item.revenue)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div style={{ width: `${pct}%` }} className="h-full bg-indigo-600 rounded-full" />
                                  </div>
                                  <span className="font-mono text-[10px] font-bold text-slate-500">{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. PAYMENT METHODS BREAKDOWN PANEL */}
            {reportSubTab === 'PAYMENT_BREAKDOWN' && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 font-sans">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider">
                    Payment Methods Breakdown & Settlement Mix
                  </h2>
                  <p className="text-xs text-slate-500">
                    Detailed distribution across M-Pesa, Cash, Credit, and Paybill channels.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase">Settlement Mix Pie Chart</h3>
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
                          No settlement transactions for selected horizon.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase block">M-Pesa / Mobile Money</span>
                        <span className="text-base font-extrabold font-mono text-emerald-900">{formatCurrency(paymentTotals.MPESA)}</span>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {paymentTotals.MPESA > 0 && reportAnalytics.totalRevenue > 0
                          ? `${Math.round((paymentTotals.MPESA / reportAnalytics.totalRevenue) * 100)}%`
                          : '0%'}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/60 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-700 uppercase block">Cash Payments</span>
                        <span className="text-base font-extrabold font-mono text-indigo-900">{formatCurrency(paymentTotals.CASH)}</span>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300">
                        {paymentTotals.CASH > 0 && reportAnalytics.totalRevenue > 0
                          ? `${Math.round((paymentTotals.CASH / reportAnalytics.totalRevenue) * 100)}%`
                          : '0%'}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-amber-700 uppercase block">Paybill / Till Transfer</span>
                        <span className="text-base font-extrabold font-mono text-amber-900">{formatCurrency(paymentTotals.PAYBILL)}</span>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        {paymentTotals.PAYBILL > 0 && reportAnalytics.totalRevenue > 0
                          ? `${Math.round((paymentTotals.PAYBILL / reportAnalytics.totalRevenue) * 100)}%`
                          : '0%'}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/60 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-purple-700 uppercase block">Credit / Debt Sales</span>
                        <span className="text-base font-extrabold font-mono text-purple-900">{formatCurrency(paymentTotals.CREDIT)}</span>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                        {paymentTotals.CREDIT > 0 && reportAnalytics.totalRevenue > 0
                          ? `${Math.round((paymentTotals.CREDIT / reportAnalytics.totalRevenue) * 100)}%`
                          : '0%'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. SUMMARIZED COMPREHENSIVE REPORT (IMPORTED REPORTS.JSX) */}
            {reportSubTab === 'SUMMARIZED_REPORT' && (
              <Reports items={items} />
            )}

          </div>
        )}

        {/* ACCOUNTS TAB */}
        {activeTab === 'ACCOUNTS' && (
          <section className="mx-auto max-w-5xl space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-2 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">User account</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">Account details</h2>
                  <p className="mt-1 text-sm text-slate-500">Signed-in user information and assigned access role.</p>
                </div>
                <span className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Signed in</span>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  { label: 'Username', value: currentUser?.username || currentUser?.user_name || currentUser?.name || 'Not provided' },
                  { label: 'Email address', value: currentUser?.email || currentUser?.user?.email || 'Not provided by server' },
                  { label: 'Role', value: currentUser?.role || currentUser?.user_role || currentUser?.group_name || currentUser?.user?.role || (Array.isArray(currentUser?.groups) ? currentUser.groups.map((g) => typeof g === 'string' ? g : g?.name).filter(Boolean).join(', ') : '') || 'Not provided by server' },
                  { label: 'Branch', value: selectedBranch?.name || selectedBranch?.branch_name || branches.find((b) => String(b.id || b.code) === String(branchKey))?.name || (typeof selectedBranch === 'string' ? selectedBranch : 'Not selected') },
                ].map((field) => (
                  <div key={field.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</p>
                    <p className="mt-2 break-words text-base font-semibold text-slate-900">{field.value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 rounded-lg bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">Account details are displayed from information available in the current session. If email or role is missing, update the management-login API to return those fields; the dashboard will not guess them.</p>
              <div className="mt-5 flex justify-end">
                <button type="button" onClick={handleLogout} className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">Sign out</button>
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