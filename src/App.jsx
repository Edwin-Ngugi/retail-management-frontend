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
import ApprovalsDashboard from './components/ApprovalsDashboard';
import { useAnalyticsSocket } from './components/useAnalyticsSocket';

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
   HELPERS
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

  if (typeof data === 'string') {
    return data;
  }

  if (data.detail) {
    return data.detail;
  }

  if (Array.isArray(data)) {
    return data.join(', ');
  }

  if (typeof data === 'object') {
    return Object.entries(data)
      .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
      .join(' | ');
  }

  return defaultMessage;
};

const getRemainingStock = (item) => toNumber(item?.remaining_stock ?? item?.current_stock ?? item?.stock);

/* =========================================================
   ERROR BOUNDARY
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
   PORTAL LANDING DASHBOARD
========================================================= */

function MainPortalDashboard({ items = [], pendingApprovalsCount = 0 }) {
  const safeItems = Array.isArray(items) ? items : [];
  const branchContext = useBranch() || {};
  const { selectedBranch = null } = branchContext;

  const [paymentTotals, setPaymentTotals] = useState({
    MPESA: 0,
    CASH: 0,
    CREDIT: 0,
    BANK: 0,
  });

  const [creditSummary, setCreditSummary] = useState({
    totalCreditSales: 0,
    totalRecovered: 0,
    outstandingCredit: 0,
  });

  const [restockSummary, setRestockSummary] = useState({
    totalRestocksValue: 0,
    totalSupplierPayables: 0,
    totalSupplierPaid: 0,
  });

  const [loadingFinancials, setLoadingFinancials] = useState(false);

  useEffect(() => {
    if (!selectedBranch) return;

    let isMounted = true;
    setLoadingFinancials(true);

    const fetchDashboardMetrics = async () => {
      try {
        const [salesRes, creditRes, purchasesRes] = await Promise.allSettled([
          API.get(`sales/?branch=${encodeURIComponent(selectedBranch)}`),
          API.get(`credit-sales/?branch=${encodeURIComponent(selectedBranch)}`),
          API.get(`purchases/?branch=${encodeURIComponent(selectedBranch)}`),
        ]);

        if (!isMounted) return;

        if (salesRes.status === 'fulfilled') {
          const sales = Array.isArray(salesRes.value?.data)
            ? salesRes.value.data
            : salesRes.value?.data?.results || [];

          const totals = { MPESA: 0, CASH: 0, CREDIT: 0, BANK: 0 };

          sales.forEach((sale) => {
            const method = (sale?.payment_method || '').toUpperCase();
            const amount = toNumber(sale?.total_amount || sale?.amount || sale?.total_price);

            if (method.includes('MPESA') || method.includes('PAYBILL') || method.includes('SEND_MONEY')) {
              totals.MPESA += amount;
            } else if (method.includes('CASH')) {
              totals.CASH += amount;
            } else if (method.includes('CREDIT')) {
              totals.CREDIT += amount;
            } else if (method.includes('BANK') || method.includes('TRANSFER')) {
              totals.BANK += amount;
            } else {
              totals.CASH += amount;
            }
          });

          setPaymentTotals(totals);
        }

        if (creditRes.status === 'fulfilled') {
          const creditData = Array.isArray(creditRes.value?.data)
            ? creditRes.value.data
            : creditRes.value?.data?.results || [];

          let totalCreditSales = 0;
          let totalRecovered = 0;

          creditData.forEach((cs) => {
            const total = toNumber(cs?.total_amount || cs?.amount);
            const paid = toNumber(cs?.amount_paid || cs?.total_paid);
            totalCreditSales += total;
            totalRecovered += paid;
          });

          setCreditSummary({
            totalCreditSales,
            totalRecovered,
            outstandingCredit: Math.max(0, totalCreditSales - totalRecovered),
          });
        }

        if (purchasesRes.status === 'fulfilled') {
          const purchases = Array.isArray(purchasesRes.value?.data)
            ? purchasesRes.value.data
            : purchasesRes.value?.data?.results || [];

          let totalRestocksValue = 0;
          let totalSupplierPayables = 0;
          let totalSupplierPaid = 0;

          purchases.forEach((p) => {
            const cost = toNumber(p?.total_cost || p?.quantity * p?.unit_cost_price);
            const paid = toNumber(p?.amount_paid);
            totalRestocksValue += cost;

            if (p?.payment_method === 'CREDIT') {
              totalSupplierPayables += Math.max(0, cost - paid);
              totalSupplierPaid += paid;
            }
          });

          setRestockSummary({
            totalRestocksValue,
            totalSupplierPayables,
            totalSupplierPaid,
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
  }, [selectedBranch]);

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
    const potentialGrossMargin = Math.max(0, totalRetailValuation - totalCostValuation);
    const marginPercentage =
      totalRetailValuation > 0
        ? ((potentialGrossMargin / totalRetailValuation) * 100).toFixed(1)
        : '0.0';

    return {
      totalCostValuation,
      totalRetailValuation,
      totalEstimatedCOGS,
      potentialGrossMargin,
      marginPercentage,
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
        name: 'Bank / Paybill Transfer',
        code: 'BANK',
        amount: paymentTotals.BANK,
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
              Real-time cost of goods sold, margin projections, and inventory ratios.
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Projected Gross Profit Margin
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold font-mono text-emerald-400">
                {formatCurrency(metrics.potentialGrossMargin)}
              </span>
              <span className="text-xs font-bold font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
                {metrics.marginPercentage}%
              </span>
            </div>
          </div>

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
                Credit sales balance & repayment recoveries
              </p>
            </div>
            <span className="text-2xl">💳</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                Total Credit Issued
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono text-slate-900 block">
                {formatCurrency(creditSummary.totalCreditSales)}
              </span>
            </div>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <span className="text-[9px] font-bold text-emerald-600 uppercase block mb-1">
                Recovered / Paid
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono text-emerald-700 block">
                {formatCurrency(creditSummary.totalRecovered)}
              </span>
            </div>

            <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
              <span className="text-[9px] font-bold text-rose-500 uppercase block mb-1">
                Outstanding Balance
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
   NEW: RECEIPTS & SALES LOGS COMPONENT (WITH ADJUSTMENT WORKFLOW)
========================================================= */

function ReceiptsLogManagement({ selectedBranch, onTransactionAdjusted }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceiptForItems, setSelectedReceiptForItems] = useState(null);
  const [selectedReceiptForEdit, setSelectedReceiptForEdit] = useState(null);

  const [editFormData, setEditFormData] = useState({
    amount: '',
    payment_method: 'CASH',
    notes: '',
  });

  const [statusMsg, setStatusMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSalesLogs = useCallback(async () => {
    if (!selectedBranch) return;
    setLoading(true);
    try {
      const res = await API.get(`sales/?branch=${encodeURIComponent(selectedBranch)}`);
      const data = Array.isArray(res?.data) ? res.data : res?.data?.results || [];
      setSales(data);
    } catch (err) {
      console.error('Failed to fetch sales logs:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchSalesLogs();
  }, [fetchSalesLogs]);

  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return sales;
    const query = searchQuery.toLowerCase();
    return sales.filter(
      (sale) =>
        (sale.receipt_number && sale.receipt_number.toLowerCase().includes(query)) ||
        (sale.id && String(sale.id).includes(query)) ||
        (sale.payment_method && sale.payment_method.toLowerCase().includes(query)) ||
        (sale.customer_name && sale.customer_name.toLowerCase().includes(query))
    );
  }, [sales, searchQuery]);

  const handleOpenEditModal = (receipt) => {
    setSelectedReceiptForEdit(receipt);
    setEditFormData({
      amount: receipt.total_amount || receipt.amount || '',
      payment_method: receipt.payment_method || 'CASH',
      notes: '',
    });
    setStatusMsg(null);
  };

  const handleSubmitAdjustment = async (e) => {
    e.preventDefault();
    if (!selectedReceiptForEdit || !selectedBranch) return;

    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      await API.post('pending-approvals/', {
        request_type: 'SALES_EDIT',
        payload: {
          branch: selectedBranch,
          target_branch: selectedBranch,
          sale_id: selectedReceiptForEdit.id,
          receipt_number: selectedReceiptForEdit.receipt_number || `REC-#${selectedReceiptForEdit.id}`,
          original_amount: selectedReceiptForEdit.total_amount || selectedReceiptForEdit.amount,
          new_amount: toNumber(editFormData.amount),
          original_payment_method: selectedReceiptForEdit.payment_method,
          new_payment_method: editFormData.payment_method,
          notes: editFormData.notes,
        },
      });

      setStatusMsg({
        type: 'success',
        text: `Receipt adjustment for #${selectedReceiptForEdit.receipt_number || selectedReceiptForEdit.id} submitted for Management Approval!`,
      });

      setTimeout(() => {
        setSelectedReceiptForEdit(null);
        if (typeof onTransactionAdjusted === 'function') {
          onTransactionAdjusted();
        }
      }, 1500);
    } catch (err) {
      console.error('Failed to submit receipt adjustment:', err);
      setStatusMsg({
        type: 'error',
        text: parseApiError(err, 'Failed to submit receipt adjustment request.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Receipts & Sales Logs
            </h2>
            <p className="text-xs text-slate-500">
              Inspect transaction receipts, itemized breakdown, and request adjustment approvals.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search receipt # or method..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={fetchSalesLogs}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-xl text-xs transition cursor-pointer"
            >
              🔄 Refresh Logs
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-xs text-slate-500">
            Loading branch sales receipts...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            No sales receipts recorded for this branch.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Receipt # / ID</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4 text-center">Items Sold</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSales.map((sale) => {
                  const itemsCount = Array.isArray(sale?.items)
                    ? sale.items.length
                    : Array.isArray(sale?.items_detail)
                    ? sale.items_detail.length
                    : 1;

                  return (
                    <tr key={sale.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {sale.receipt_number || `#${sale.id}`}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {sale.created_at
                          ? new Date(sale.created_at).toLocaleString()
                          : sale.sale_date || 'N/A'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {sale.customer_name || 'Walk-in Customer'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-indigo-700">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-50 border border-indigo-200 font-bold">
                          {sale.payment_method || 'CASH'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                        {formatCurrency(sale.total_amount || sale.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedReceiptForItems(sale)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer"
                        >
                          📦 View Items ({itemsCount})
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(sale)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1 rounded-xl text-[11px] transition shadow-sm cursor-pointer"
                        >
                          ✏️ Adjust / Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: ITEMIZED RECEIPT BREAKDOWN */}
      {selectedReceiptForItems && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative text-xs my-auto space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Receipt Breakdown: {selectedReceiptForItems.receipt_number || `#${selectedReceiptForItems.id}`}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Itemized list of products sold in this transaction
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceiptForItems(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {(
                selectedReceiptForItems.items ||
                selectedReceiptForItems.items_detail ||
                []
              ).length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-xl text-slate-500 text-center">
                  Single line transaction total: {formatCurrency(selectedReceiptForItems.total_amount || selectedReceiptForItems.amount)}
                </div>
              ) : (
                (
                  selectedReceiptForItems.items ||
                  selectedReceiptForItems.items_detail ||
                  []
                ).map((itemRow, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block">
                        {itemRow.item_name || itemRow.name || `Item #${itemRow.item}`}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {itemRow.quantity || 1} x {formatCurrency(itemRow.unit_price || itemRow.price)}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-indigo-700">
                      {formatCurrency(
                        toNumber(itemRow.quantity || 1) * toNumber(itemRow.unit_price || itemRow.price)
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center font-bold text-xs">
              <span>Grand Total Realized:</span>
              <span className="font-mono text-emerald-700 text-sm">
                {formatCurrency(selectedReceiptForItems.total_amount || selectedReceiptForItems.amount)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedReceiptForItems(null)}
              className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl transition cursor-pointer"
            >
              Close Breakdown
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: RECEIPT ADJUSTMENT / EDIT FORM */}
      {selectedReceiptForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative text-xs my-auto space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Request Receipt Adjustment
              </h3>
              <p className="text-slate-500">
                Receipt #{selectedReceiptForEdit.receipt_number || selectedReceiptForEdit.id}
              </p>
            </div>

            {statusMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  statusMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {statusMsg.text}
              </div>
            )}

            <form onSubmit={handleSubmitAdjustment} className="space-y-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Adjusted Total Amount (KSh)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  value={editFormData.amount}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Payment Channel
                </label>
                <select
                  value={editFormData.payment_method}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, payment_method: e.target.value }))
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-semibold"
                >
                  <option value="CASH">Cash</option>
                  <option value="MPESA">M-Pesa</option>
                  <option value="PAYBILL">Paybill</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CREDIT">Credit</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Reason for Adjustment / Notes
                </label>
                <textarea
                  required
                  rows="3"
                  placeholder="e.g. Correcting mistaken cash amount entered by cashier..."
                  value={editFormData.notes}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReceiptForEdit(null)}
                  className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   STOCK & ITEMS OPERATIONS COMPONENT
========================================================= */

function StockOperations({ items = [], selectedBranch, onItemUpdateSuccess }) {
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const [newItem, setNewItem] = useState({
    name: '',
    unit_cost_price: '',
    unit_retail_price: '',
    opening_stock: '0',
  });

  const [editedRows, setEditedRows] = useState({});

  useEffect(() => {
    const initialMap = {};
    items.forEach((item) => {
      initialMap[item.id] = {
        unit_cost_price: item.unit_cost_price ?? '',
        unit_retail_price: item.unit_retail_price ?? '',
        remaining_stock: item.remaining_stock ?? '',
      };
    });
    setEditedRows(initialMap);
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    return items.filter((i) =>
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.code && i.code.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [items, searchQuery]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItemIds(filteredItems.map((i) => i.id));
    } else {
      setSelectedItemIds([]);
    }
  };

  const handleToggleSelectItem = (id) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item_id) => item_id !== id) : [...prev, id]
    );
  };

  const handleRowInputChange = (id, field, value) => {
    setEditedRows((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));

    if (!selectedItemIds.includes(id)) {
      setSelectedItemIds((prev) => [...prev, id]);
    }
  };

  const handleRegisterItemSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBranch) {
      setStatusMsg({ type: 'error', text: 'Please select an active branch.' });
      return;
    }

    if (!newItem.name.trim()) {
      setStatusMsg({ type: 'error', text: 'Item Name is required.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      await API.post('pending-approvals/', {
        request_type: 'NEW_REGISTERED_ITEMS',
        payload: {
          branch: selectedBranch,
          target_branch: selectedBranch,
          items: [
            {
              name: newItem.name.trim(),
              unit_cost_price: toNumber(newItem.unit_cost_price),
              unit_retail_price: toNumber(newItem.unit_retail_price),
              opening_stock: toNumber(newItem.opening_stock),
            },
          ],
        },
      });

      setStatusMsg({
        type: 'success',
        text: `Item "${newItem.name}" registration submitted to Management for approval!`,
      });
      setNewItem({ name: '', unit_cost_price: '', unit_retail_price: '', opening_stock: '0' });
    } catch (err) {
      console.error('Failed to submit item registration:', err);
      setStatusMsg({ type: 'error', text: parseApiError(err, 'Failed to submit item registration for approval.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchSaveSubmit = async () => {
    if (!selectedBranch) {
      setStatusMsg({ type: 'error', text: 'Please select an active branch.' });
      return;
    }
    if (selectedItemIds.length === 0) {
      setStatusMsg({ type: 'error', text: 'Please select at least one item row to update.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      const updates = selectedItemIds.map((id) => {
        const rowData = editedRows[id] || {};
        return {
          id,
          unit_cost_price: rowData.unit_cost_price,
          unit_retail_price: rowData.unit_retail_price,
          remaining_stock: rowData.remaining_stock,
        };
      });

      await API.post('pending-approvals/', {
        request_type: 'STOCK_OPERATION',
        payload: {
          branch: selectedBranch,
          target_branch: selectedBranch,
          items: updates,
        },
      });

      setStatusMsg({
        type: 'success',
        text: `Stock changes for ${selectedItemIds.length} item(s) submitted to Management for approval!`,
      });

      setSelectedItemIds([]);
    } catch (err) {
      console.error('Batch approval submit error:', err);
      setStatusMsg({
        type: 'error',
        text: parseApiError(err, 'Failed to submit inline modifications for management approval.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Add New Item & Pricing (Requires Approval)
        </h2>

        {statusMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-bold ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        <form onSubmit={handleRegisterItemSubmit} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Item Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Foam sheet 2STD"
              value={newItem.name}
              onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Cost Price (KSh)
            </label>
            <input
              type="number"
              step="0.01"
              required
              min="0"
              placeholder="Buying price"
              value={newItem.unit_cost_price}
              onChange={(e) => setNewItem((prev) => ({ ...prev, unit_cost_price: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Retail Price (KSh)
            </label>
            <input
              type="number"
              step="0.01"
              required
              min="0"
              placeholder="Selling price"
              value={newItem.unit_retail_price}
              onChange={(e) => setNewItem((prev) => ({ ...prev, unit_retail_price: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase">
              Select Items to Modify ({filteredItems.length})
            </h3>
            <p className="text-xs text-slate-500">
              Modify values inline per item row. Checked items will be sent to Management for approval before saving.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={handleBatchSaveSubmit}
              disabled={isSubmitting || selectedItemIds.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition shadow-md disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isSubmitting ? 'Submitting...' : `Submit Changes for Approval (${selectedItemIds.length})`}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 uppercase text-[10px] font-bold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={
                      filteredItems.length > 0 &&
                      selectedItemIds.length === filteredItems.length
                    }
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="p-3">Item Name</th>
                <th className="p-3 w-36">Cost Price (KSh)</th>
                <th className="p-3 w-36">Retail Price (KSh)</th>
                <th className="p-3">Opening</th>
                <th className="p-3">Restocks</th>
                <th className="p-3 w-36">Current Remaining Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const isSelected = selectedItemIds.includes(item.id);
                const rowData = editedRows[item.id] || {
                  unit_cost_price: item.unit_cost_price ?? '',
                  unit_retail_price: item.unit_retail_price ?? '',
                  remaining_stock: item.remaining_stock ?? '',
                };

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50 transition ${
                      isSelected ? 'bg-indigo-50/40' : ''
                    }`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectItem(item.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 font-semibold text-slate-900">{item.name}</td>

                    <td className="p-2">
                      <input
                        type="number"
                        step="0.01"
                        value={rowData.unit_cost_price}
                        onChange={(e) =>
                          handleRowInputChange(item.id, 'unit_cost_price', e.target.value)
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs text-slate-900 font-mono font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </td>

                    <td className="p-2">
                      <input
                        type="number"
                        step="0.01"
                        value={rowData.unit_retail_price}
                        onChange={(e) =>
                          handleRowInputChange(item.id, 'unit_retail_price', e.target.value)
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs text-slate-900 font-mono font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </td>

                    <td className="p-3 font-mono">{item.opening_stock || 0}</td>
                    <td className="p-3 font-mono text-emerald-600 font-bold">
                      {item.total_stock_purchased || 0}
                    </td>

                    <td className="p-2">
                      <input
                        type="number"
                        value={rowData.remaining_stock}
                        onChange={(e) =>
                          handleRowInputChange(item.id, 'remaining_stock', e.target.value)
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs text-slate-900 font-mono font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   RESTOCK & SUPPLIER PAYABLES COMPONENT
========================================================= */

function RestockManagement({ items = [], selectedBranch, onRestockSuccess }) {
  const [subTab, setSubTab] = useState('new_order');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [orderItems, setOrderItems] = useState([
    { item_id: '', quantity: '', unit_cost_price: '' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [creditPurchases, setCreditPurchases] = useState([]);
  const [loadingPayables, setLoadingPayables] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [repaymentMethod, setRepaymentMethod] = useState('CASH');
  const [repaymentNotes, setRepaymentNotes] = useState('');

  const paymentMethods = [
    { code: 'CASH', label: 'Cash' },
    { code: 'MPESA', label: 'M-Pesa' },
    { code: 'PAYBILL', label: 'Paybill' },
    { code: 'SEND_MONEY', label: 'Send Money' },
    { code: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { code: 'CREDIT', label: 'Credit / On Account' },
  ];

  const fetchCreditPurchases = useCallback(async () => {
    if (!selectedBranch) return;
    setLoadingPayables(true);
    try {
      const res = await API.get(`purchases/?branch=${selectedBranch}&payment_method=CREDIT`);
      const data = Array.isArray(res?.data) ? res.data : res?.data?.results || [];
      setCreditPurchases(data);
    } catch (err) {
      console.error('Failed to fetch credit purchases:', err);
    } finally {
      setLoadingPayables(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (subTab === 'supplier_payables') {
      fetchCreditPurchases();
    }
  }, [subTab, fetchCreditPurchases]);

  const handleAddItemRow = () => {
    setOrderItems((prev) => [
      ...prev,
      { item_id: '', quantity: '', unit_cost_price: '' },
    ]);
  };

  const handleRemoveItemRow = (index) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setOrderItems((prev) => {
      const updated = [...prev];
      updated[index][field] = value;

      if (field === 'item_id') {
        const found = items.find((i) => String(i.id) === String(value));
        if (found) {
          updated[index].unit_cost_price =
            found.unit_cost_price || found.latest_unit_cost || '';
        }
      }
      return updated;
    });
  };

  const grandTotal = useMemo(() => {
    return orderItems.reduce((acc, row) => {
      const qty = toNumber(row.quantity);
      const cost = toNumber(row.unit_cost_price);
      return acc + qty * cost;
    }, 0);
  }, [orderItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBranch) {
      setErrorMsg('Please select an active branch.');
      return;
    }

    const validItems = orderItems.filter(
      (r) => r.item_id && toNumber(r.quantity) > 0
    );

    if (validItems.length === 0) {
      setErrorMsg('Please add at least one valid item with a quantity.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const purchasesPayload = validItems.map((row) => ({
        item: row.item_id,
        quantity: toNumber(row.quantity),
        unit_cost_price: toNumber(row.unit_cost_price),
        payment_method: paymentMethod,
        purchase_date: purchaseDate,
      }));

      await API.post('pending-approvals/', {
        request_type: 'RESTOCK_PURCHASE',
        payload: {
          branch: selectedBranch,
          target_branch: selectedBranch,
          purchases: purchasesPayload,
        },
      });

      setSuccessMsg(`Restock purchase order for ${validItems.length} item(s) submitted to Management for approval!`);
      setOrderItems([{ item_id: '', quantity: '', unit_cost_price: '' }]);
    } catch (err) {
      console.error('Restock purchase submission error:', err);
      setErrorMsg(parseApiError(err, 'Failed to submit purchase order for approval.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordSupplierPayment = async (e) => {
    e.preventDefault();
    if (!selectedOrderForPayment) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        purchase: selectedOrderForPayment.id,
        amount: toNumber(repaymentAmount),
        payment_method: repaymentMethod,
        notes: repaymentNotes,
      };

      await API.post('supplier-payments/', payload);
      setSelectedOrderForPayment(null);
      setRepaymentAmount('');
      setRepaymentNotes('');
      await fetchCreditPurchases();
    } catch (err) {
      console.error('Failed to submit supplier payment:', err);
      setErrorMsg(parseApiError(err, 'Failed to record supplier payment.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const payablesSummary = useMemo(() => {
    return creditPurchases.reduce(
      (acc, order) => {
        const totalCost = toNumber(order.total_cost || order.quantity * order.unit_cost_price);
        const totalPaid = toNumber(order.amount_paid);
        const balance = Math.max(0, totalCost - totalPaid);

        acc.totalCreditValue += totalCost;
        acc.totalPaid += totalPaid;
        acc.totalOutstanding += balance;
        return acc;
      },
      { totalCreditValue: 0, totalPaid: 0, totalOutstanding: 0 }
    );
  }, [creditPurchases]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-5xl mx-auto font-sans">
      <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4 bg-slate-50/50">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Restock & Supplier Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Submit restock requests to Management for approval before inventory updates.
          </p>
        </div>

        <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setSubTab('new_order')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              subTab === 'new_order'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            + New Purchase Order
          </button>
          <button
            type="button"
            onClick={() => setSubTab('supplier_payables')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              subTab === 'supplier_payables'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            💳 Supplier Payables
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-bold">
            {successMsg}
          </div>
        )}

        {subTab === 'new_order' && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Purchase Date
                </label>
                <input
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  {paymentMethods.map((pm) => (
                    <option key={pm.code} value={pm.code}>
                      {pm.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                  Order Items ({orderItems.length})
                </h3>
              </div>

              {orderItems.map((row, idx) => {
                const rowTotal = toNumber(row.quantity) * toNumber(row.unit_cost_price);
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-200"
                  >
                    <div className="sm:col-span-5">
                      <select
                        required
                        value={row.item_id}
                        onChange={(e) => handleItemChange(idx, 'item_id', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Choose item --</option>
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} (Stock: {getRemainingStock(item)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="Qty"
                        value={row.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        required
                        min="0"
                        placeholder="Unit Cost"
                        value={row.unit_cost_price}
                        onChange={(e) => handleItemChange(idx, 'unit_cost_price', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="sm:col-span-2 font-mono text-xs font-bold text-slate-700 text-right">
                      {formatCurrency(rowTotal)}
                    </div>

                    <div className="sm:col-span-1 text-right">
                      {orderItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="text-rose-600 hover:text-rose-800 text-xs font-bold px-2 py-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-200 gap-4">
              <div className="text-sm font-bold text-slate-900">
                Total Order Valuation: <span className="text-indigo-600 font-mono">{formatCurrency(grandTotal)}</span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
                >
                  + Add Another Item
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition shadow-md cursor-pointer"
                >
                  {isSubmitting ? 'Submitting Order...' : 'Submit Purchase Order'}
                </button>
              </div>
            </div>
          </form>
        )}

        {subTab === 'supplier_payables' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Total Credit Value</span>
                <span className="text-lg font-bold font-mono text-slate-900">{formatCurrency(payablesSummary.totalCreditValue)}</span>
              </div>
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200">
                <span className="text-[10px] font-bold text-rose-500 uppercase block mb-1">Total Outstanding Owed</span>
                <span className="text-lg font-bold font-mono text-rose-700">{formatCurrency(payablesSummary.totalOutstanding)}</span>
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-500 uppercase block mb-1">Total Settled</span>
                <span className="text-lg font-bold font-mono text-emerald-700">{formatCurrency(payablesSummary.totalPaid)}</span>
              </div>
            </div>

            {loadingPayables ? (
              <div className="text-center py-12 text-slate-500 text-xs">Loading supplier credit payables...</div>
            ) : creditPurchases.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No outstanding credit purchases found for this branch.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Item Name</th>
                      <th className="py-3 px-4">Qty</th>
                      <th className="py-3 px-4">Total Cost</th>
                      <th className="py-3 px-4">Paid</th>
                      <th className="py-3 px-4">Balance Due</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {creditPurchases.map((order) => {
                      const totalCost = toNumber(order.total_cost || order.quantity * order.unit_cost_price);
                      const paid = toNumber(order.amount_paid);
                      const balance = Math.max(0, totalCost - paid);

                      let statusBadge = (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          PENDING
                        </span>
                      );
                      if (balance === 0) {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            PAID
                          </span>
                        );
                      } else if (paid > 0) {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            PARTIAL
                          </span>
                        );
                      }

                      return (
                        <tr key={order.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-mono">{order.purchase_date || 'N/A'}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{order.item_name || `Item #${order.item}`}</td>
                          <td className="py-3 px-4 font-mono">{order.quantity}</td>
                          <td className="py-3 px-4 font-mono">{formatCurrency(totalCost)}</td>
                          <td className="py-3 px-4 font-mono text-emerald-600">{formatCurrency(paid)}</td>
                          <td className="py-3 px-4 font-mono font-bold text-rose-600">{formatCurrency(balance)}</td>
                          <td className="py-3 px-4">{statusBadge}</td>
                          <td className="py-3 px-4 text-right">
                            {balance > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOrderForPayment(order);
                                  setRepaymentAmount(balance);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-xl text-[11px] transition cursor-pointer shadow-sm"
                              >
                                Record Payment
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-semibold">Settled</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedOrderForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative text-xs my-auto">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Record Supplier Payment</h3>
            <p className="text-slate-500 mb-4">
              Settle payment for <strong>{selectedOrderForPayment.item_name || `Item #${selectedOrderForPayment.item}`}</strong>
            </p>

            <form onSubmit={handleRecordSupplierPayment} className="space-y-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Repayment Amount (KSh)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="1"
                  max={Math.max(
                    0,
                    toNumber(selectedOrderForPayment.total_cost || selectedOrderForPayment.quantity * selectedOrderForPayment.unit_cost_price) -
                      toNumber(selectedOrderForPayment.amount_paid)
                  )}
                  value={repaymentAmount}
                  onChange={(e) => setRepaymentAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Payment Method</label>
                <select
                  value={repaymentMethod}
                  onChange={(e) => setRepaymentMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 text-xs font-semibold"
                >
                  <option value="CASH">Cash</option>
                  <option value="MPESA">M-Pesa</option>
                  <option value="PAYBILL">Paybill</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Payment Reference / Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. M-Pesa Code QX789..."
                  value={repaymentNotes}
                  onChange={(e) => setRepaymentNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForPayment(null)}
                  className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold cursor-pointer transition shadow-md"
                >
                  {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   LOW STOCK ALERTS COMPONENT
========================================================= */

function LowStockAlerts({ items = [], onRestockSuccess }) {
  const safeItems = Array.isArray(items) ? items : [];

  const lowStockItems = useMemo(() => {
    return safeItems
      .filter((item) => Boolean(item?.is_low_stock))
      .sort((a, b) => getRemainingStock(a) - getRemainingStock(b));
  }, [safeItems]);

  const handleRefresh = async () => {
    if (typeof onRestockSuccess === 'function') {
      await onRestockSuccess();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden font-sans">
      <div className="p-4 sm:p-6 border-b border-slate-100">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Low Stock Alerts
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Items that have reached or fallen below their minimum stock threshold.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition cursor-pointer"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {lowStockItems.length === 0 ? (
          <div className="text-center py-12 sm:py-16 text-slate-500 text-xs">
            No low-stock items detected for this branch.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {lowStockItems.map((item) => {
              const remaining = getRemainingStock(item);
              const threshold = toNumber(item?.min_stock_threshold, 5);
              return (
                <div
                  key={item.id}
                  className="border border-amber-300 bg-amber-50/40 rounded-2xl p-4 sm:p-5 space-y-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm truncate">{item.name}</h3>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold shrink-0">
                      LOW
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-400 block text-[9px] uppercase">Remaining</span>
                      <span className="font-bold text-rose-600 text-sm">{remaining}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-400 block text-[9px] uppercase">Threshold</span>
                      <span className="font-bold text-slate-700 text-sm">{threshold}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowAccountDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('user_active_tab', activeTab);
    } catch (error) {
      console.warn('Unable to save active tab:', error);
    }
  }, [activeTab]);

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
                <svg
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showAccountDropdown ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showAccountDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">{currentUser.username}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{currentUser.role || 'Store Manager'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountDropdown(false);
                      handleLogout();
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition flex items-center gap-2 cursor-pointer"
                  >
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
        {activeTab === 'dashboard' && (
          <MainPortalDashboard
            items={safeItems}
            pendingApprovalsCount={pendingApprovalsCount}
          />
        )}
        {activeTab === 'sales' && (
          <SalesEntry items={safeItems} selectedBranch={selectedBranch} onSalesSubmitted={fetchItems} />
        )}
        {activeTab === 'receipts' && (
          <ReceiptsLogManagement selectedBranch={selectedBranch} onTransactionAdjusted={fetchItems} />
        )}
        {activeTab === 'credit' && (
          <CreditSaleManagement selectedBranch={selectedBranch} items={safeItems} onTransactionComplete={fetchItems} />
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
          <RestockManagement items={safeItems} selectedBranch={selectedBranch} onRestockSuccess={fetchItems} />
        )}
        {activeTab === 'expenses' && <ExpenseManagement selectedBranch={selectedBranch} />}
      </main>
    </div>
  );
}

/* =========================================================
   APP CONTENT & ROUTING ENGINES
========================================================= */

function AppContent() {
  const [items, setItems] = useState([]);
  const branchContext = useBranch() || {};
  const { selectedBranch = null } = branchContext;
  const fetchSequenceRef = useRef(0);

  const fetchItems = useCallback(async () => {
    if (!selectedBranch) {
      setItems([]);
      return;
    }

    const requestSequence = ++fetchSequenceRef.current;

    try {
      const response = await API.get(`items/?branch=${encodeURIComponent(selectedBranch)}`);

      if (requestSequence !== fetchSequenceRef.current) return;

      const data = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.results)
        ? response.data.results
        : [];

      setItems(data);
    } catch (error) {
      console.error('Failed to fetch branch items:', error);
      if (requestSequence === fetchSequenceRef.current) setItems([]);
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (!selectedBranch) {
      setItems([]);
      return;
    }
    fetchItems();
  }, [selectedBranch, fetchItems]);

  const handleSocketEvent = useCallback(
    (eventData) => {
      if (!eventData) return;
      window.setTimeout(() => fetchItems(), 150);
    },
    [fetchItems]
  );

  useAnalyticsSocket(selectedBranch, handleSocketEvent);

  return (
    <div className="min-h-screen bg-[#E2E8F0] text-slate-900 font-sans relative overflow-x-hidden">
      <div className="relative z-10 min-h-screen">
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/auth" element={<AuthPage />} />

          <Route
            path="/management"
            element={<ManagementDashboard />}
          />

          <Route
            path="/admin"
            element={<AdminRoute onItemsUpdated={fetchItems} />}
          />
          <Route path="/admin/login" element={<AdminLogin />} />

          <Route element={<ProtectedRoute />}>
            <Route
              path="/"
              element={<UserDashboard items={items} fetchItems={fetchItems} />}
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

/* =========================================================
   ROOT APP EXPORT
========================================================= */

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