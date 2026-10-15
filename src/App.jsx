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
import AuthPage from './components/AuthPage';
import ReceiptsLogManagement from './components/ReceiptsLogManagement';
import ApprovalsDashboard from './components/ApprovalsDashboard';
import { useAnalyticsSocket } from './components/useAnalyticsSocket';
import RestockManagement from './components/RestockManagement';

/* =========================================================
   PORTAL-SPECIFIC ROUTE GUARDS
========================================================= */

const ProtectedRoute = () => {
  const token =
    localStorage.getItem('access_token') || localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

const AdminRoute = ({ onItemsUpdated }) => {
  const token =
    localStorage.getItem('access_token') || localStorage.getItem('token');

  if (!token) {
    return <AdminLogin />;
  }

  return <AdminDashboard onItemsUpdated={onItemsUpdated} />;
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

// Safe date extractor aligned with models.py (sale_date, purchase_date, date, created_at)
const getRecordDateStr = (record) => {
  const rawDate =
    record?.sale_date ||
    record?.purchase_date ||
    record?.date ||
    record?.created_at ||
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

/**
 * Normalizes raw payment method strings strictly aligned with backend `views.py` logic.
 */
const normalizePaymentMethod = (method) => {
  if (!method) return 'CASH';
  const clean = String(method).trim().toUpperCase().replace(/[- ]/g, '_');

  if (
    clean.includes('PAYBILL') ||
    clean.includes('PAY_BILL') ||
    clean.includes('C2B')
  ) {
    return 'PAYBILL';
  }

  if (
    clean.includes('MPESA') ||
    clean.includes('M_PESA') ||
    clean.includes('MOBILE') ||
    clean.includes('SEND_MONEY') ||
    clean.includes('SENDMONEY') ||
    clean.includes('TILL') ||
    clean.includes('BUY_GOODS') ||
    clean.includes('P2P')
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
    clean.includes('EFT') ||
    clean.includes('TRANSFER')
  ) {
    return 'BANK_TRANSFER';
  }

  return 'CASH';
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
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 sm:p-6 font-sans">
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-rose-200 max-w-lg w-full text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
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
              className="w-full bg-indigo-600 text-white py-3 rounded-xl text-xs sm:text-sm font-semibold hover:bg-indigo-500 transition-all shadow-md cursor-pointer"
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
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Active Analytics & Filter Horizon
          </h2>
          <p className="text-[11px] text-slate-500">
            Selected date boundaries apply across Dashboard, Sales, Restocks, and Expenses
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-700">Filter Period:</label>
          <select
            value={filterMode}
            onChange={(e) => setDateFilter((prev) => ({ ...prev, filterMode: e.target.value }))}
            className="bg-slate-100 border border-slate-300 font-bold text-xs text-slate-800 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
   PORTAL LANDING DASHBOARD
========================================================= */

function MainPortalDashboard({ items = [], pendingApprovalsCount = 0, effectiveRange }) {
  const safeItems = Array.isArray(items) ? items : [];
  const branchContext = useBranch() || {};
  const { selectedBranch = null } = branchContext;

  const { effectiveStartDate, effectiveEndDate } = effectiveRange;

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

  useEffect(() => {
    if (!selectedBranch) return;

    let isMounted = true;
    setLoadingFinancials(true);

    const fetchDashboardMetrics = async () => {
      try {
        const salesParams = new URLSearchParams({ branch: selectedBranch });
        const repaymentsParams = new URLSearchParams({ branch: selectedBranch });
        const purchasesParams = new URLSearchParams({ branch: selectedBranch });

        if (effectiveStartDate) {
          salesParams.append('sale_date__gte', `${effectiveStartDate}T00:00:00`);
          salesParams.append('start_date', effectiveStartDate);

          repaymentsParams.append('date__gte', effectiveStartDate);
          repaymentsParams.append('start_date', effectiveStartDate);

          purchasesParams.append('purchase_date__gte', `${effectiveStartDate}T00:00:00`);
          purchasesParams.append('start_date', effectiveStartDate);
        }

        if (effectiveEndDate) {
          salesParams.append('sale_date__lte', `${effectiveEndDate}T23:59:59`);
          salesParams.append('end_date', effectiveEndDate);

          repaymentsParams.append('date__lte', effectiveEndDate);
          repaymentsParams.append('end_date', effectiveEndDate);

          purchasesParams.append('purchase_date__lte', `${effectiveEndDate}T23:59:59`);
          purchasesParams.append('end_date', effectiveEndDate);
        }

        const [salesRes, repaymentsRes, purchasesRes] = await Promise.allSettled([
          API.get(`sales/?${salesParams.toString()}`),
          API.get(`credit-repayments/?${repaymentsParams.toString()}`),
          API.get(`purchases/?${purchasesParams.toString()}`),
        ]);

        if (!isMounted) return;

        let totalCreditIssued = 0;
        const totals = { MPESA: 0, CASH: 0, CREDIT: 0, PAYBILL: 0 };

        // 1. Process Period Sales
        if (salesRes.status === 'fulfilled') {
          const rawSales = Array.isArray(salesRes.value?.data)
            ? salesRes.value.data
            : salesRes.value?.data?.results || [];

          const sales = rawSales.filter((s) => {
            const dateStr = getRecordDateStr(s);
            if (!dateStr) return true;
            if (effectiveStartDate && dateStr < effectiveStartDate) return false;
            if (effectiveEndDate && dateStr > effectiveEndDate) return false;
            return true;
          });

          sales.forEach((sale) => {
            const rawMethod = String(sale?.payment_method || '').toUpperCase();
            const splitPayments = Array.isArray(sale?.split_payments) ? sale.split_payments : [];

            if (rawMethod === 'SPLIT' || splitPayments.length > 0) {
              splitPayments.forEach((sp) => {
                const spAmt = toNumber(sp?.amount);
                const spChannel = normalizePaymentMethod(sp?.method || sp?.payment_method);
                if (spChannel === 'MPESA') totals.MPESA += spAmt;
                else if (spChannel === 'PAYBILL') totals.PAYBILL += spAmt;
                else if (spChannel === 'CREDIT') {
                  totals.CREDIT += spAmt;
                  totalCreditIssued += spAmt;
                } else totals.CASH += spAmt;
              });
            } else {
              const amount = toNumber(sale?.total_amount || sale?.amount || sale?.total_price);
              const channel = normalizePaymentMethod(sale?.payment_method);

              if (channel === 'MPESA') totals.MPESA += amount;
              else if (channel === 'PAYBILL') totals.PAYBILL += amount;
              else if (channel === 'CREDIT') {
                totals.CREDIT += amount;
                totalCreditIssued += amount;
              } else totals.CASH += amount;
            }
          });
        }

        // 2. Process Period Repayments (Adds to Liquid Channel)
        let totalRecovered = 0;
        if (repaymentsRes.status === 'fulfilled') {
          const rawRepayments = Array.isArray(repaymentsRes.value?.data)
            ? repaymentsRes.value.data
            : repaymentsRes.value?.data?.results || [];

          const repayments = rawRepayments.filter((r) => {
            const dateStr = getRecordDateStr(r);
            if (!dateStr) return true;
            if (effectiveStartDate && dateStr < effectiveStartDate) return false;
            if (effectiveEndDate && dateStr > effectiveEndDate) return false;
            return true;
          });

          repayments.forEach((rep) => {
            const amount = toNumber(rep?.amount || rep?.amount_paid);
            const channel = normalizePaymentMethod(rep?.payment_method);

            totalRecovered += amount;

            if (channel === 'MPESA') totals.MPESA += amount;
            else if (channel === 'PAYBILL') totals.PAYBILL += amount;
            else totals.CASH += amount;
          });
        }

        // Calculate Net Outstanding Debt for Credit / On Account
        const netCreditOutstanding = Math.max(0, totalCreditIssued - totalRecovered);
        totals.CREDIT = netCreditOutstanding;

        setPaymentTotals(totals);

        setCreditSummary({
          totalCreditIssued,
          totalRecovered,
          outstandingCredit: netCreditOutstanding,
        });

        // 3. Process Restocks & Supplier Payables
        if (purchasesRes.status === 'fulfilled') {
          const rawPurchases = Array.isArray(purchasesRes.value?.data)
            ? purchasesRes.value.data
            : purchasesRes.value?.data?.results || [];

          const purchases = rawPurchases.filter((p) => {
            const dateStr = getRecordDateStr(p);
            if (!dateStr) return true;
            if (effectiveStartDate && dateStr < effectiveStartDate) return false;
            if (effectiveEndDate && dateStr > effectiveEndDate) return false;
            return true;
          });

          let totalRestocksValue = 0;
          let totalSupplierPayables = 0;

          purchases.forEach((p) => {
            const cost = toNumber(p?.total_cost || p?.quantity * p?.unit_cost_price);
            const paid = toNumber(p?.amount_paid);
            totalRestocksValue += cost;

            if (p?.payment_method === 'CREDIT') {
              totalSupplierPayables += Math.max(0, cost - paid);
            }
          });

          setRestockSummary({
            totalRestocksValue,
            totalSupplierPayables,
          });
        }
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        if (isMounted) setLoadingFinancials(false);
      }
    };

    fetchDashboardMetrics();

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

  const paymentBreakdown = useMemo(() => {
    return [
      {
        name: 'M-Pesa / Mobile Money',
        code: 'MPESA',
        amount: paymentTotals.MPESA,
        icon: '📱',
        color: 'border-emerald-200 bg-emerald-50/50 text-emerald-900',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      },
      {
        name: 'Cash Transactions',
        code: 'CASH',
        amount: paymentTotals.CASH,
        icon: '💵',
        color: 'border-indigo-200 bg-indigo-50/50 text-indigo-900',
        badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      },
      {
        name: 'Credit / On Account',
        code: 'CREDIT',
        amount: paymentTotals.CREDIT,
        icon: '💳',
        color: 'border-amber-200 bg-amber-50/50 text-amber-900',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      },
      {
        name: 'Paybill / Till Transfer',
        code: 'PAYBILL',
        amount: paymentTotals.PAYBILL,
        icon: '🏦',
        color: 'border-purple-200 bg-purple-50/50 text-purple-900',
        badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      },
    ];
  }, [paymentTotals]);

  const totalCount = safeItems.length || 1;
  const healthyPct = Math.round((metrics.healthyCount / totalCount) * 100);
  const lowStockPct = Math.round((metrics.lowStockCount / totalCount) * 100);
  const outOfStockPct = Math.round((metrics.outOfStockCount / totalCount) * 100);

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans">
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
              {safeItems.length} Products
            </span>
          </div>

          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Pending Management Sign-offs
            </span>
            <span
              className={`text-lg font-bold font-mono ${
                pendingApprovalsCount > 0 ? 'text-purple-400' : 'text-slate-200'
              }`}
            >
              {pendingApprovalsCount} Requests
            </span>
          </div>
        </div>
      </div>

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
            <span className="text-2xl">💳</span>
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
            <span className="text-2xl">📦</span>
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

      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Payment & Settlement Channels
            </h2>
            <p className="text-xs text-slate-500">
              Live settlement amounts processed per financial channel
            </p>
          </div>
          {loadingFinancials && (
            <span className="text-[11px] font-semibold text-indigo-600 animate-pulse">
              Syncing analytics...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {paymentBreakdown.map((pm, idx) => (
            <div key={idx} className={`p-4 rounded-2xl border space-y-2 ${pm.color}`}>
              <div className="flex items-center justify-between">
                <span className="text-xl">{pm.icon}</span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${pm.badgeColor}`}
                >
                  {pm.code}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-xs text-slate-700">{pm.name}</h3>
                <span className="text-base font-bold font-mono text-slate-900 block mt-1">
                  {formatCurrency(pm.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

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
          <div
            style={{ width: `${healthyPct}%` }}
            className="bg-emerald-500 transition-all duration-500"
            title={`Healthy Stock: ${healthyPct}%`}
          />
          <div
            style={{ width: `${lowStockPct}%` }}
            className="bg-amber-400 transition-all duration-500"
            title={`Low Stock: ${lowStockPct}%`}
          />
          <div
            style={{ width: `${outOfStockPct}%` }}
            className="bg-rose-500 transition-all duration-500"
            title={`Out of Stock: ${outOfStockPct}%`}
          />
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
    { key: 'approvals', label: 'Approvals & Requests', badge: pendingApprovalsCount, badgeColor: 'bg-indigo-500 text-white' },
    { key: 'alerts', label: 'Low Stock Alerts', badge: lowStockCount, badgeColor: 'bg-amber-500 text-white' },
    { key: 'restock', label: 'Restock' },
    { key: 'expenses', label: 'Expenses' },
  ];

  return (
    <div className="min-h-screen flex flex-col text-slate-900 font-sans">
      <nav className="flex-none bg-slate-900 border-b border-slate-800 px-3 sm:px-6 lg:px-8 py-2.5 sticky top-0 z-30 shadow-md">
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
                <div className="hidden md:flex items-center gap-2 text-[10px] text-slate-400 border-l border-slate-700 pl-3">
                  <span className="text-indigo-400 font-bold">Portals:</span>
                  <button onClick={() => navigate('/')} className={`hover:text-white underline cursor-pointer ${location.pathname === '/' ? 'text-indigo-300 font-bold' : ''}`}>User</button> •
                  <button onClick={() => navigate('/management')} className={`hover:text-white underline cursor-pointer ${location.pathname === '/management' ? 'text-indigo-300 font-bold' : ''}`}>Management</button> •
                  <button onClick={() => navigate('/admin')} className={`hover:text-white underline cursor-pointer ${location.pathname === '/admin' ? 'text-indigo-300 font-bold' : ''}`}>Admin</button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl">
              <label className="text-[10px] font-bold text-slate-300 uppercase">Branch:</label>
              <select
                value={selectedBranch || ''}
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={loadingBranches || !branches.length}
                className="bg-transparent text-white text-xs font-semibold outline-none cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-white">{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 justify-between xl:justify-end overflow-hidden">
            <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-800/80 rounded-xl border border-slate-700 overflow-x-auto scrollbar-none max-w-full">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === tab.key
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {tab.label}
                  {tab.badge > 0 && (
                    <span className={`ml-1.5 ${tab.badgeColor || 'bg-indigo-500 text-white'} text-[10px] font-extrabold px-1.5 py-0.2 rounded-full`}>
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
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">
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
      <Route path="/login" element={<AuthPage />} />
      <Route path="/management" element={<ManagementDashboard />} />
      <Route path="/admin" element={<AdminRoute onItemsUpdated={fetchItems} />} />
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