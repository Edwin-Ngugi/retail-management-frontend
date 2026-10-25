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
        let summarySuccess = false;

        try {
          const reportParams = new URLSearchParams({ branch: selectedBranch });

          if (effectiveStartDate && effectiveEndDate && effectiveStartDate !== effectiveEndDate) {
            reportParams.append('period_type', 'custom');
            reportParams.append('startDate', effectiveStartDate);
            reportParams.append('endDate', effectiveEndDate);
          } else if (effectiveStartDate) {
            reportParams.append('period_type', 'day');
            reportParams.append('date', effectiveStartDate);
          }

          const res = await API.get(`financial-reports/summary/?${reportParams.toString()}`);
          const data = res.data;

          if (data && data.payment_channel_breakdown && data.summary) {
            const breakdown = data.payment_channel_breakdown;
            const sum = data.summary;

            const mpesaCombined = toNumber(breakdown.mpesa_std) + toNumber(breakdown.send_money);

            setPaymentTotals({
              MPESA: mpesaCombined,
              CASH: toNumber(breakdown.cash),
              CREDIT: toNumber(breakdown.credit_outstanding ?? sum.credit_outstanding),
              PAYBILL: toNumber(breakdown.paybill),
            });

            setCreditSummary({
              totalCreditIssued: toNumber(sum.new_credit_sales),
              totalRecovered: toNumber(sum.credit_repayments),
              outstandingCredit: toNumber(sum.credit_outstanding),
            });

            setRestockSummary({
              totalRestocksValue: toNumber(sum.purchases_cost),
              totalSupplierPayables: 0,
            });

            summarySuccess = true;
          }
        } catch (summaryErr) {
          /* Fallback handling */
        }

        if (summarySuccess || !isMounted) return;

        const salesParams = new URLSearchParams({ branch: selectedBranch });
        const repaymentsParams = new URLSearchParams({ branch: selectedBranch });
        const purchasesParams = new URLSearchParams({ branch: selectedBranch });

        const [rawSales, rawRepayments, rawPurchases, rawSplitPayments] = await Promise.all([
          fetchPaginatedData(`sales/?${salesParams.toString()}`),
          fetchPaginatedData(`credit-repayments/?${repaymentsParams.toString()}`),
          fetchPaginatedData(`purchases/?${purchasesParams.toString()}`),
          fetchPaginatedData(`sale-payments/?branch=${selectedBranch}`),
        ]);

        if (!isMounted) return;

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

        const sales = rawSales.filter((s) => {
          const dateStr = getRecordDateStr(s);
          if (!dateStr) return true;
          if (effectiveStartDate && dateStr < effectiveStartDate) return false;
          if (effectiveEndDate && dateStr > effectiveEndDate) return false;
          return true;
        });

        sales.forEach((sale) => {
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
        icon: '',
        color: 'border-teal-200 bg-teal-50/50 text-teal-950',
        badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
      },
      {
        name: 'Cash Transactions',
        code: 'CASH',
        amount: paymentTotals.CASH,
        icon: '',
        color: 'border-cyan-200 bg-cyan-50/50 text-cyan-950',
        badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      },
      {
        name: 'Credit / On Account',
        code: 'CREDIT',
        amount: paymentTotals.CREDIT,
        icon: '',
        color: 'border-amber-200 bg-amber-50/50 text-amber-950',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      },
      {
        name: 'Paybill / Till Transfer',
        code: 'PAYBILL',
        amount: paymentTotals.PAYBILL,
        icon: '',
        color: 'border-emerald-200 bg-emerald-50/50 text-emerald-950',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      },
    ];
  }, [paymentTotals]);

  const totalCount = safeItems.length || 1;
  const healthyPct = Math.round((metrics.healthyCount / totalCount) * 100);
  const lowStockPct = Math.round((metrics.lowStockCount / totalCount) * 100);
  const outOfStockPct = Math.round((metrics.outOfStockCount / totalCount) * 100);

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans">
      {/* Hero Banner with Teal Theme Gradient */}
      <div className="bg-gradient-to-r from-teal-950 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-teal-800/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-widest text-teal-300 bg-teal-900/80 px-2.5 py-1 rounded-full border border-teal-700/60 inline-block">
              Branch Overview
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight pt-1">
              Operational & COGS Analytics
            </h1>
            <p className="text-xs sm:text-sm text-teal-100/80 max-w-md">
              Real-time cost of goods sold, catalog metrics, and inventory ratios.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 bg-teal-900/60 p-4 rounded-2xl border border-teal-700/60 backdrop-blur-md shadow-inner">
            <div>
              <span className="text-[10px] uppercase font-bold text-teal-200/70 block mb-0.5">
                Total Inventory Valuation (Cost)
              </span>
              <span className="text-lg sm:text-xl font-bold font-mono text-teal-300">
                {formatCurrency(metrics.totalCostValuation)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-teal-200/70 block mb-0.5">
                Estimated Sales COGS
              </span>
              <span className="text-lg sm:text-xl font-bold font-mono text-amber-300">
                {formatCurrency(metrics.totalEstimatedCOGS)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-6 pt-6 border-t border-teal-800/80">
          <div className="bg-teal-900/40 p-4 rounded-2xl border border-teal-700/40 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-teal-200/70 block mb-0.5">
                Cataloged SKUs
              </span>
              <span className="text-lg font-bold font-mono text-teal-200">
                {safeItems.length} Products
              </span>
            </div>
            <span className="text-2xl"></span>
          </div>

          <div className="bg-teal-900/40 p-4 rounded-2xl border border-teal-700/40 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-teal-200/70 block mb-0.5">
                Pending Management Sign-offs
              </span>
              <span
                className={`text-lg font-bold font-mono ${
                  pendingApprovalsCount > 0 ? 'text-amber-300' : 'text-teal-100'
                }`}
              >
                {pendingApprovalsCount} Requests
              </span>
            </div>
            <span className="text-2xl">⏳</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-teal-100/90 shadow-sm space-y-4 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center border-b border-teal-50 pb-3">
            <div>
              <h2 className="text-xs font-bold text-teal-950 uppercase tracking-wider">
                Customer Credit Summary
              </h2>
              <p className="text-[11px] text-slate-500">
                Period credit activity & live total balance
              </p>
            </div>
            <span className="p-2 bg-amber-50 rounded-xl border border-amber-100 text-xl"></span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">
                Credit Issued (Period)
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 block">
                {formatCurrency(creditSummary.totalCreditIssued)}
              </span>
            </div>

            <div className="bg-teal-50/70 p-3 rounded-xl border border-teal-200/80">
              <span className="text-[9px] font-bold text-teal-700 uppercase block mb-1">
                Recovered (Period)
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono text-teal-800 block">
                {formatCurrency(creditSummary.totalRecovered)}
              </span>
            </div>

            <div className="bg-rose-50 p-3 rounded-xl border border-rose-200/80">
              <span className="text-[9px] font-bold text-rose-600 uppercase block mb-1">
                Live Total Debt Owed
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono text-rose-700 block">
                {formatCurrency(creditSummary.outstandingCredit)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-teal-100/90 shadow-sm space-y-4 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center border-b border-teal-50 pb-3">
            <div>
              <h2 className="text-xs font-bold text-teal-950 uppercase tracking-wider">
                Restocks & Supplier Payables
              </h2>
              <p className="text-[11px] text-slate-500">
                Purchases valuation & outstanding supplier payables
              </p>
            </div>
            <span className="p-2 bg-teal-50 rounded-xl border border-teal-100 text-xl"></span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-teal-50/60 p-3 rounded-xl border border-teal-200/80">
              <span className="text-[9px] font-bold text-teal-700 uppercase block mb-1">
                Total Restock Purchases
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono text-teal-950 block">
                {formatCurrency(restockSummary.totalRestocksValue)}
              </span>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200/80">
              <span className="text-[9px] font-bold text-amber-700 uppercase block mb-1">
                Supplier Owed Payables
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono text-amber-800 block">
                {formatCurrency(restockSummary.totalSupplierPayables)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-teal-100/90 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-teal-50 pb-3">
          <div>
            <h2 className="text-xs font-bold text-teal-950 uppercase tracking-wider">
              Payment & Settlement Channels
            </h2>
            <p className="text-[11px] text-slate-500">
              Live settlement amounts processed per financial channel
            </p>
          </div>
          {loadingFinancials && (
            <span className="text-[11px] font-semibold text-teal-600 animate-pulse bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
              Syncing analytics...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {paymentBreakdown.map((pm, idx) => (
            <div key={idx} className={`p-4 rounded-2xl border space-y-2.5 transition-transform hover:-translate-y-0.5 ${pm.color}`}>
              <div className="flex items-center justify-between">
                <span className="text-2xl">{pm.icon}</span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${pm.badgeColor}`}
                >
                  {pm.code}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-xs text-teal-950">{pm.name}</h3>
                <span className="text-base font-bold font-mono text-teal-950 block mt-1">
                  {formatCurrency(pm.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-teal-100/90 shadow-sm space-y-4">
        <div className="border-b border-teal-50 pb-3">
          <h2 className="text-xs font-bold text-teal-950 uppercase tracking-wider">
            Inventory Health Ratio
          </h2>
          <p className="text-[11px] text-slate-500">
            Proportion of optimal vs. threshold stock across registered items
          </p>
        </div>

        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${healthyPct}%` }}
            className="bg-teal-500 transition-all duration-500"
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

        <div className="grid grid-cols-3 gap-3 pt-1 text-center text-xs">
          <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-200/80">
            <span className="block text-[10px] font-bold text-teal-800 uppercase mb-0.5">
              Optimal Stock
            </span>
            <span className="text-base font-bold font-mono text-teal-950">
              {metrics.healthyCount} ({healthyPct}%)
            </span>
          </div>
          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80">
            <span className="block text-[10px] font-bold text-amber-800 uppercase mb-0.5">
              Low Stock Threshold
            </span>
            <span className="text-base font-bold font-mono text-amber-900">
              {metrics.lowStockCount} ({lowStockPct}%)
            </span>
          </div>
          <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200/80">
            <span className="block text-[10px] font-bold text-rose-800 uppercase mb-0.5">
              Out of Stock
            </span>
            <span className="text-base font-bold font-mono text-rose-900">
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