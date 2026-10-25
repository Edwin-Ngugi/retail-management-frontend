// src/App.jsx
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  Outlet,
  useLocation,
} from 'react-router-dom';

import API from './api';

import {
  BranchProvider,
  useBranch,
} from './components/BranchContext';

import ExpenseManagement from './components/ExpenseManagement';
import SalesEntry from './components/SalesEntry';
import CreditSaleManagement from './components/CreditSalesManagement';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import ManagementDashboard from './components/ManagementDashboard';
import ManagementLogin from './components/ManagementLogin';
import AuthPage from './components/AuthPage';
import ReceiptsLogManagement from './components/ReceiptsLogManagement';
import ApprovalsDashboard from './components/ApprovalsDashboard';
import { useAnalyticsSocket } from './components/useAnalyticsSocket';
import RestockManagement from './components/RestockManagement';
import StockOperations from './components/StockActivityLog';
import LowStockAlerts from './components/LowStocksAlerts';

/* =========================================================
   PORTAL-SPECIFIC ROUTE GUARDS
========================================================= */

// 1. Standard POS User Route Guard
const ProtectedRoute = () => {
  const token =
    localStorage.getItem('access_token') || localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

// 2. Admin Portal Route Guard
const AdminRoute = ({ onItemsUpdated }) => {
  const token =
    localStorage.getItem('access_token') || localStorage.getItem('token');

  if (!token) {
    return <AdminLogin />;
  }

  return <AdminDashboard onItemsUpdated={onItemsUpdated} />;
};

// 3. Management Portal Route Guard
const ManagementRoute = () => {
  const token =
    localStorage.getItem('access_token') || localStorage.getItem('token');

  if (!token) {
    return <ManagementLogin />;
  }

  return <ManagementDashboard />;
};

/* =========================================================
   HELPERS & COMMON UTILS
========================================================= */

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const formatNumber = (
  value,
  minimumFractionDigits = 0,
  maximumFractionDigits = 2
) => {
  return toNumber(value).toLocaleString(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
  });
};

const formatCurrency = (value) => {
  return `KSh ${formatNumber(value, 2, 2)}`;
};

const parseApiError = (error, defaultMessage = 'An unexpected error occurred.') => {
  if (!error?.response?.data) {
    return error?.message || defaultMessage;
  }

  const data = error.response.data;
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  if (Array.isArray(data)) return data.join(', ');

  if (typeof data === 'object') {
    return Object.entries(data)
      .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
      .join(' | ');
  }

  return defaultMessage;
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

  if (typeof rawDate === 'string') {
    return rawDate.split('T')[0];
  }

  try {
    return new Date(rawDate).toISOString().split('T')[0];
  } catch {
    return '';
  }
};

const normalizePaymentMethod = (methodName) => {
  if (!methodName) return 'CASH';
  const clean = String(methodName).trim().toUpperCase().replace(/[- ]/g, '_');

  if (
    clean.includes('PAYBILL') ||
    clean.includes('PAY_BILL') ||
    clean.includes('C2B')
  ) {
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

  if (
    clean.includes('CREDIT') ||
    clean.includes('DEBT') ||
    clean.includes('ON_ACCOUNT')
  ) {
    return 'CREDIT';
  }

  if (
    clean.includes('BANK') ||
    clean.includes('TRANSFER') ||
    clean.includes('EFT')
  ) {
    return 'BANK_TRANSFER';
  }

  if (clean.includes('SPLIT')) {
    return 'SPLIT';
  }

  return 'CASH';
};

const fetchPaginatedData = async (initialEndpoint) => {
  let results = [];
  let currentEndpoint = initialEndpoint;

  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  while (currentEndpoint) {
    let cleanPath = currentEndpoint;

    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      const urlObj = new URL(cleanPath);
      cleanPath = urlObj.pathname + urlObj.search;
    }

    if (cleanPath.startsWith('/api/')) {
      cleanPath = cleanPath.replace(/^\/api\//, '');
    } else if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.slice(1);
    }

    try {
      const res = await API.get(cleanPath, { headers: authHeader });
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
      console.warn(`Failed fetching paginated path: ${cleanPath}`, e);
      break;
    }
  }

  return results;
};

/* =========================================================
   ERROR BOUNDARY CLASS COMPONENT
========================================================= */

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-teal-50/50 p-4 sm:p-6 font-sans">
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-rose-200 max-w-lg w-full text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-teal-950 tracking-tight mb-2">
              Something went wrong
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mb-6">
              An unexpected application error occurred.
            </p>
            {this.state.error && (
              <pre className="text-xs bg-slate-50 p-4 rounded-xl text-rose-600 text-left overflow-x-auto border border-rose-200 mb-6 whitespace-pre-wrap font-mono">
                {parseApiError(this.state.error, this.state.error.toString())}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full bg-teal-600 text-white py-3 rounded-xl text-xs sm:text-sm font-semibold hover:bg-teal-700 transition-all shadow-md cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* =========================================================
   GLOBAL DATE RANGE SELECTOR BAR
========================================================= */

function GlobalDateFilterBar({ dateFilter, setDateFilter }) {
  const { filterMode, selectedDay, selectedMonth, startDate, endDate } = dateFilter;

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-teal-100/80 shadow-sm space-y-3 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold text-teal-950 uppercase tracking-wider">
            Active Analytics & Filter Horizon
          </h2>
          <p className="text-[11px] text-slate-500">
            Selected date boundaries apply across Dashboard, Sales, Restocks, and Expenses
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-teal-800">Filter Period:</label>
          <select
            value={filterMode}
            onChange={(e) => setDateFilter((prev) => ({ ...prev, filterMode: e.target.value }))}
            className="bg-teal-50/70 border border-teal-200 font-bold text-xs text-teal-900 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-xs"
          >
            <option value="DAILY">Daily Pick</option>
            <option value="THIS_WEEK">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="THIS_YEAR">Yearly</option>
            <option value="CUSTOM">Custom Range</option>
          </select>
        </div>
      </div>

      {filterMode === 'DAILY' && (
        <div className="flex items-center gap-3 pt-2 border-t border-teal-50 text-xs">
          <label className="font-bold text-teal-800">Choose Specific Day:</label>
          <input
            type="date"
            value={selectedDay}
            onChange={(e) =>
              setDateFilter((prev) => ({ ...prev, selectedDay: e.target.value }))
            }
            className="border border-teal-200 bg-teal-50/40 rounded-xl px-3 py-1.5 text-xs text-teal-950 outline-none focus:ring-2 focus:ring-teal-500 font-bold cursor-pointer"
          />
        </div>
      )}

      {filterMode === 'MONTHLY' && (
        <div className="flex items-center gap-3 pt-2 border-t border-teal-50 text-xs">
          <label className="font-bold text-teal-800">Choose Specific Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) =>
              setDateFilter((prev) => ({ ...prev, selectedMonth: e.target.value }))
            }
            className="border border-teal-200 bg-teal-50/40 rounded-xl px-3 py-1.5 text-xs text-teal-950 outline-none focus:ring-2 focus:ring-teal-500 font-bold cursor-pointer"
          />
        </div>
      )}

      {filterMode === 'CUSTOM' && (
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-teal-50 text-xs">
          <div className="flex items-center gap-1.5">
            <label className="font-bold text-teal-800">Start Date:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) =>
                setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))
              }
              className="border border-teal-200 bg-teal-50/40 rounded-xl px-2.5 py-1.5 text-xs text-teal-900 outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="font-bold text-teal-800">End Date:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) =>
                setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))
              }
              className="border border-teal-200 bg-teal-50/40 rounded-xl px-2.5 py-1.5 text-xs text-teal-900 outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   PORTAL LANDING DASHBOARD
========================================================= */

function MainPortalDashboard({ items = [], pendingApprovalsCount = 0, effectiveRange }) {
  const safeItems = Array.isArray(items) ? items : [];
  const branchContext = useBranch() || {};
  const { selectedBranch = null } = branchContext;

  const { effectiveStartDate, effectiveEndDate } = effectiveRange;

  const [dashboardData, setDashboardData] = useState({
    creditSummary: { totalCreditIssued: 0, totalRecovered: 0, outstandingCredit: 0 },
    restockSummary: { totalRestocksValue: 0, totalSupplierPayables: 0 },
    paymentTotals: { MPESA: 0, CASH: 0, CREDIT: 0, PAYBILL: 0 },
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedBranch) return;

    let isMounted = true;
    setLoading(true);

    const loadDashboardMetrics = async () => {
      try {
        const params = new URLSearchParams({ branch: selectedBranch });

        if (effectiveStartDate && effectiveEndDate && effectiveStartDate !== effectiveEndDate) {
          params.append('period_type', 'custom');
          params.append('startDate', effectiveStartDate);
          params.append('endDate', effectiveEndDate);
        } else if (effectiveStartDate) {
          params.append('period_type', 'day');
          params.append('date', effectiveStartDate);
        }

        const res = await API.get(`dashboard/overview/?${params.toString()}`);
        const data = res.data;

        if (isMounted && data) {
          setDashboardData({
            creditSummary: {
              totalCreditIssued: data.credit_summary?.total_credit_issued || 0,
              totalRecovered: data.credit_summary?.total_recovered || 0,
              outstandingCredit: data.credit_summary?.outstanding_credit || 0,
            },
            restockSummary: {
              totalRestocksValue: data.restocks?.total_purchases_cost || 0,
              totalSupplierPayables: data.restocks?.supplier_payables || 0,
            },
            paymentTotals: {
              MPESA: data.payment_channels?.mpesa || 0,
              CASH: data.payment_channels?.cash || 0,
              CREDIT: data.payment_channels?.credit_outstanding || 0,
              PAYBILL: data.payment_channels?.paybill || 0,
            },
          });
        }
      } catch (e) {
        console.warn("Falling back to client calculation for dashboard...", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDashboardMetrics();

    return () => {
      isMounted = false;
    };
  }, [selectedBranch, effectiveStartDate, effectiveEndDate]);

  const metrics = useMemo(() => {
    let totalCostValuation = 0;
    let totalRetailValuation = 0;
    let totalEstimatedCOGS = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    safeItems.forEach((item) => {
      const qty = getRemainingStock(item);
      const cost = toNumber(item?.unit_cost_price);
      const retail = toNumber(item?.unit_retail_price || item?.unit_selling_price);

      totalCostValuation += qty * cost;
      totalRetailValuation += qty * retail;

      const totalUnitsSold = toNumber(item?.total_stock_sold || item?.quantity_sold || 0);
      totalEstimatedCOGS += totalUnitsSold * cost;

      if (qty === 0) {
        outOfStockCount++;
      } else if (Boolean(item?.is_low_stock)) {
        lowStockCount++;
      }
    });

    const healthyCount = Math.max(0, safeItems.length - lowStockCount - outOfStockCount);

    return {
      totalCostValuation,
      totalRetailValuation,
      totalEstimatedCOGS,
      lowStockCount,
      outOfStockCount,
      healthyCount,
    };
  }, [safeItems]);

  const totalCount = safeItems.length || 1;
  const healthyPct = Math.round((metrics.healthyCount / totalCount) * 100);
  const lowStockPct = Math.round((metrics.lowStockCount / totalCount) * 100);
  const outOfStockPct = Math.round((metrics.outOfStockCount / totalCount) * 100);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Overview KPI Row - White Cards with Logo Color Numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Inventory Cost Valuation Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Inventory Cost Value
            </span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
              📊
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-[#005F73] block">
              {formatCurrency(metrics.totalCostValuation)}
            </span>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">
              {safeItems.length} SKUs Cataloged
            </span>
          </div>
        </div>

        {/* Estimated COGS Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Sales COGS (Cost of Goods)
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              🏷️
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-[#CA6702] block">
              {formatCurrency(metrics.totalEstimatedCOGS)}
            </span>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">
              Real-time Sold Cost
            </span>
          </div>
        </div>

        {/* Live Total Debt Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Outstanding Debt Owed
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
              ⚖️
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-[#9B2226] block">
              {formatCurrency(dashboardData.creditSummary.outstandingCredit)}
            </span>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">
              Pending Collection
            </span>
          </div>
        </div>

        {/* Pending Approvals Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Pending Sign-Offs
            </span>
            <div className="p-2 rounded-xl bg-cyan-50 text-cyan-700">
              ⏳
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black font-mono text-[#0A9396] block">
              {pendingApprovalsCount} Requests
            </span>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">
              Awaiting Approval
            </span>
          </div>
        </div>
      </div>

      {/* Middle Grid Section: Credit & Restocks Summaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Customer Credit Summary Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Customer Credit Summary
              </h2>
              <p className="text-[11px] text-slate-500">
                Period credit activity & live total balance
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Credit Operations
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <span className="text-[9px] font-extrabold text-slate-500 uppercase block mb-1">
                Credit Issued
              </span>
              <span className="text-sm font-bold font-mono text-slate-900 block">
                {formatCurrency(dashboardData.creditSummary.totalCreditIssued)}
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <span className="text-[9px] font-extrabold text-[#0A9396] uppercase block mb-1">
                Recovered
              </span>
              <span className="text-sm font-bold font-mono text-[#0A9396] block">
                {formatCurrency(dashboardData.creditSummary.totalRecovered)}
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <span className="text-[9px] font-extrabold text-[#9B2226] uppercase block mb-1">
                Outstanding Balance
              </span>
              <span className="text-sm font-bold font-mono text-[#9B2226] block">
                {formatCurrency(dashboardData.creditSummary.outstandingCredit)}
              </span>
            </div>
          </div>
        </div>

        {/* Restocks & Supplier Payables Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Restocks & Supplier Payables
              </h2>
              <p className="text-[11px] text-slate-500">
                Purchases valuation & supplier liabilities
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              Restock Log
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <span className="text-[9px] font-extrabold text-[#005F73] uppercase block mb-1">
                Restock Purchases
              </span>
              <span className="text-sm font-bold font-mono text-[#005F73] block">
                {formatCurrency(dashboardData.restockSummary.totalRestocksValue)}
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <span className="text-[9px] font-extrabold text-[#CA6702] uppercase block mb-1">
                Supplier Owed
              </span>
              <span className="text-sm font-bold font-mono text-[#CA6702] block">
                {formatCurrency(dashboardData.restockSummary.totalSupplierPayables)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment & Settlement Channels - Pure White Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Payment & Settlement Channels
            </h2>
            <p className="text-[11px] text-slate-500">
              Live settlement amounts processed per financial channel
            </p>
          </div>
          {loading && (
            <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200 animate-pulse">
              Syncing analytics...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* M-Pesa Channel */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 hover:border-teal-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">M-Pesa / Mobile</span>
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-teal-50 text-[#005F73] border border-teal-200">
                MPESA
              </span>
            </div>
            <span className="text-lg font-bold font-mono text-[#005F73]">
              {formatCurrency(dashboardData.paymentTotals.MPESA)}
            </span>
          </div>

          {/* Cash Channel */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 hover:border-cyan-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Cash Transactions</span>
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-50 text-[#0A9396] border border-cyan-200">
                CASH
              </span>
            </div>
            <span className="text-lg font-bold font-mono text-[#0A9396]">
              {formatCurrency(dashboardData.paymentTotals.CASH)}
            </span>
          </div>

          {/* Credit Channel */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 hover:border-amber-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Credit / On Account</span>
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-[#CA6702] border border-amber-200">
                CREDIT
              </span>
            </div>
            <span className="text-lg font-bold font-mono text-[#CA6702]">
              {formatCurrency(dashboardData.paymentTotals.CREDIT)}
            </span>
          </div>

          {/* Paybill Channel */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Paybill / Till Transfer</span>
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                PAYBILL
              </span>
            </div>
            <span className="text-lg font-bold font-mono text-emerald-800">
              {formatCurrency(dashboardData.paymentTotals.PAYBILL)}
            </span>
          </div>
        </div>
      </div>

      {/* Inventory Health Ratio */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Inventory Health Ratio
          </h2>
          <p className="text-[11px] text-slate-500">
            Proportion of optimal vs. threshold stock across registered items
          </p>
        </div>

        <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${healthyPct}%` }}
            className="bg-[#0A9396] transition-all duration-500"
            title={`Healthy Stock: ${healthyPct}%`}
          />
          <div
            style={{ width: `${lowStockPct}%` }}
            className="bg-[#EE9B00] transition-all duration-500"
            title={`Low Stock: ${lowStockPct}%`}
          />
          <div
            style={{ width: `${outOfStockPct}%` }}
            className="bg-[#9B2226] transition-all duration-500"
            title={`Out of Stock: ${outOfStockPct}%`}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1 text-center text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="block text-[10px] font-extrabold text-[#0A9396] uppercase mb-0.5">
              Optimal Stock
            </span>
            <span className="text-sm font-bold font-mono text-slate-900">
              {metrics.healthyCount} ({healthyPct}%)
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="block text-[10px] font-extrabold text-[#CA6702] uppercase mb-0.5">
              Low Stock Threshold
            </span>
            <span className="text-sm font-bold font-mono text-slate-900">
              {metrics.lowStockCount} ({lowStockPct}%)
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="block text-[10px] font-extrabold text-[#9B2226] uppercase mb-0.5">
              Out of Stock
            </span>
            <span className="text-sm font-bold font-mono text-slate-900">
              {metrics.outOfStockCount} ({outOfStockPct}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   USER DASHBOARD PORTAL
========================================================= */

function UserDashboard({ items, fetchItems }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('user_active_tab');
      const allowedTabs = [
        'dashboard',
        'sales',
        'receipts',
        'credit',
        'stock_ops',
        'approvals',
        'alerts',
        'restock',
        'expenses',
      ];
      return allowedTabs.includes(saved) ? saved : 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  const [dateFilter, setDateFilter] = useState({
    filterMode: 'DAILY',
    selectedDay: formatDateString(new Date()),
    selectedMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    startDate: '',
    endDate: '',
  });

  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const dropdownRef = useRef(null);

  const branchContext = useBranch() || {};
  const {
    branches = [],
    selectedBranch = null,
    setSelectedBranch = () => {},
    loadingBranches = false,
  } = branchContext;

  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem('user_data') || localStorage.getItem('user');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      /* ignore */
    }
    return {
      username: localStorage.getItem('username') || 'Store Manager',
      role: localStorage.getItem('role') || 'User',
      is_staff: localStorage.getItem('is_staff') === 'true',
      is_superuser: localStorage.getItem('is_superuser') === 'true',
    };
  }, []);

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

  const fetchPendingApprovalsCount = useCallback(async () => {
    try {
      const response = await API.get('pending-approvals/');
      const data = Array.isArray(response?.data)
        ? response.data
        : response?.data?.results || [];
      const pendingCount = data.filter((item) => item.status === 'PENDING').length;
      setPendingApprovalsCount(pendingCount);
    } catch (e) {
      console.error('Failed to fetch pending approvals count:', e);
    }
  }, []);

  useEffect(() => {
    fetchPendingApprovalsCount();
  }, [fetchPendingApprovalsCount]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('user');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('is_staff');
    localStorage.removeItem('is_superuser');
    navigate('/login');
  }, [navigate]);

  const safeItems = Array.isArray(items) ? items : [];
  const lowStockCount = safeItems.filter((item) => Boolean(item?.is_low_stock)).length;

  const tabs = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'sales', label: 'Sales Entry' },
    { key: 'receipts', label: 'Receipts & Sales Logs' },
    { key: 'credit', label: 'Credit Sales' },
    { key: 'stock_ops', label: 'Stock Operations' },
    { key: 'approvals', label: 'Approvals & Requests', badge: pendingApprovalsCount, badgeColor: 'bg-teal-500 text-white' },
    { key: 'alerts', label: 'Low Stock Alerts', badge: lowStockCount, badgeColor: 'bg-amber-500 text-white' },
    { key: 'restock', label: 'Restock' },
    { key: 'expenses', label: 'Expenses' },
  ];

  return (
    <div className="min-h-screen flex flex-col text-teal-950 font-sans bg-slate-50/50">
      {/* Navigation Header in Dark Teal */}
      <nav className="flex-none bg-teal-950 border-b border-teal-900 px-3 sm:px-6 lg:px-8 py-2.5 sticky top-0 z-30 shadow-md">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 sm:gap-4 max-w-[1600px] mx-auto w-full">
          <div className="flex flex-wrap items-center justify-between xl:justify-start gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo.svg"
                alt="Melvex Business Solutions"
                className="h-10 sm:h-12 xl:h-14 w-auto object-contain cursor-pointer transition-transform duration-200 hover:scale-105"
                onClick={() => setActiveTab('dashboard')}
              />

              {(currentUser.is_staff || currentUser.is_superuser) && (
                <div className="hidden md:flex items-center gap-2 text-[10px] text-teal-300/80 border-l border-teal-800 pl-3">
                  <span className="text-teal-300 font-bold">Portals:</span>
                  <button onClick={() => navigate('/')} className={`hover:text-white underline cursor-pointer ${location.pathname === '/' ? 'text-teal-200 font-bold' : ''}`}>User</button> •
                  <button onClick={() => navigate('/management')} className={`hover:text-white underline cursor-pointer ${location.pathname === '/management' ? 'text-teal-200 font-bold' : ''}`}>Management</button> •
                  <button onClick={() => navigate('/admin')} className={`hover:text-white underline cursor-pointer ${location.pathname === '/admin' ? 'text-teal-200 font-bold' : ''}`}>Admin</button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 bg-teal-900/80 border border-teal-800 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl">
              <label className="text-[10px] font-bold text-teal-200 uppercase">Branch:</label>
              <select
                value={selectedBranch || ''}
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={loadingBranches || !branches.length}
                className="bg-transparent text-white text-xs font-semibold outline-none cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-teal-950 text-white">{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 justify-between xl:justify-end overflow-hidden">
            <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-teal-900/60 rounded-xl border border-teal-800 overflow-x-auto scrollbar-none max-w-full">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === tab.key
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-teal-100/80 hover:text-white hover:bg-teal-800/50'
                  }`}
                >
                  {tab.label}
                  {tab.badge > 0 && (
                    <span className={`ml-1.5 ${tab.badgeColor || 'bg-teal-500 text-white'} text-[10px] font-extrabold px-1.5 py-0.2 rounded-full`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowAccountDropdown((prev) => !prev)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-teal-900 text-teal-100 text-xs font-semibold border border-teal-800 hover:bg-teal-800 transition cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                  {currentUser.username ? currentUser.username.charAt(0) : 'A'}
                </div>
                <span className="hidden sm:inline">Account</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
        <GlobalDateFilterBar dateFilter={dateFilter} setDateFilter={setDateFilter} />

        {activeTab === 'dashboard' && (
          <MainPortalDashboard
            items={safeItems}
            pendingApprovalsCount={pendingApprovalsCount}
            effectiveRange={effectiveRange}
          />
        )}
        {activeTab === 'sales' && (
          <SalesEntry items={safeItems} selectedBranch={selectedBranch} onSalesSubmitted={fetchItems} />
        )}
        {activeTab === 'receipts' && (
          <ReceiptsLogManagement selectedBranch={selectedBranch} onTransactionAdjusted={fetchItems} effectiveRange={effectiveRange} />
        )}
        {activeTab === 'credit' && (
          <CreditSaleManagement selectedBranch={selectedBranch} items={safeItems} onTransactionComplete={fetchItems} effectiveRange={effectiveRange} />
        )}
        {activeTab === 'stock_ops' && (
          <StockOperations items={safeItems} selectedBranch={selectedBranch} onItemUpdateSuccess={fetchItems} />
        )}
        {activeTab === 'approvals' && (
          <ApprovalsDashboard selectedBranch={selectedBranch} onApprovalComplete={fetchItems} />
        )}
        {activeTab === 'alerts' && (
          <LowStockAlerts items={safeItems} selectedBranch={selectedBranch} onRestockSuccess={fetchItems} />
        )}
        {activeTab === 'restock' && (
          <RestockManagement items={safeItems} selectedBranch={selectedBranch} onRestockSuccess={fetchItems} effectiveRange={effectiveRange} />
        )}
        {activeTab === 'expenses' && <ExpenseManagement selectedBranch={selectedBranch} effectiveRange={effectiveRange} />}
      </main>
    </div>
  );
}

/* =========================================================
   APP ROOT & ROUTER
========================================================= */

function AppContent() {
  const [items, setItems] = useState([]);
  const branchContext = useBranch() || {};
  const { selectedBranch = null } = branchContext;

  const fetchItems = useCallback(async () => {
    if (!selectedBranch) return;
    try {
      const response = await API.get(`items/?branch=${encodeURIComponent(selectedBranch)}`);
      const data = Array.isArray(response?.data)
        ? response.data
        : response?.data?.results || [];
      setItems(data);
    } catch (error) {
      console.error('Failed to fetch branch items:', error);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <Routes>
      {/* Standard User Auth */}
      <Route path="/login" element={<AuthPage />} />

      {/* Management Portal */}
      <Route path="/management" element={<ManagementRoute />} />

      {/* Admin Portal */}
      <Route path="/admin" element={<AdminRoute onItemsUpdated={fetchItems} />} />

      {/* User POS Portal */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<UserDashboard items={items} fetchItems={fetchItems} />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BranchProvider>
        <Router>
          <AppContent />
        </Router>
      </BranchProvider>
    </ErrorBoundary>
  );
}