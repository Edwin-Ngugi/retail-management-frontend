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
import RestockManagement from './components/RestockManagement';
import StockOperations from './components/StockActivityLog';
import LowStockAlerts from './components/LowStocksAlerts';

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
        <div className="min-h-screen flex items-center justify-center bg-white p-4 sm:p-6 font-sans">
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
    paymentTotals: { SEND_MONEY: 0, CASH: 0, CREDIT: 0, PAYBILL: 0 },
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
              SEND_MONEY: data.payment_channels?.send_money || data.payment_channels?.mpesa || 0,
              CASH: data.payment_channels?.cash || 0,
              CREDIT: data.payment_channels?.credit_outstanding || 0,
              PAYBILL: data.payment_channels?.paybill || 0,
            },
          });
        }
      } catch (e) {
        console.warn("Falling back to local calculation for dashboard...", e);
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

    safeItems.forEach((item) => {
      const qty = getRemainingStock(item);
      const cost = toNumber(item?.unit_cost_price);
      const retail = toNumber(item?.unit_retail_price || item?.unit_selling_price);

      totalCostValuation += qty * cost;
      totalRetailValuation += qty * retail;

      const totalUnitsSold = toNumber(item?.total_stock_sold || item?.quantity_sold || 0);
      totalEstimatedCOGS += totalUnitsSold * cost;
    });

    return {
      totalCostValuation,
      totalRetailValuation,
      totalEstimatedCOGS,
    };
  }, [safeItems]);

  return (
    <div className="space-y-6 w-full font-sans">
      {/* 1. Top Overview KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
              Inventory Cost Value
            </span>
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700"></div>
          </div>
          <div className="mt-4">
            <span className="text-2xl lg:text-3xl font-black font-mono text-[#005F73] block">
              {formatCurrency(metrics.totalCostValuation)}
            </span>
            <span className="text-xs text-slate-500 font-medium mt-1 block">
              {safeItems.length} SKUs Cataloged
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
              Sales COGS (Cost of Goods)
            </span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700"></div>
          </div>
          <div className="mt-4">
            <span className="text-2xl lg:text-3xl font-black font-mono text-[#CA6702] block">
              {formatCurrency(metrics.totalEstimatedCOGS)}
            </span>
            <span className="text-xs text-slate-500 font-medium mt-1 block">
              Real-time Sold Cost
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
              Outstanding Debt Owed
            </span>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700"></div>
          </div>
          <div className="mt-4">
            <span className="text-2xl lg:text-3xl font-black font-mono text-[#9B2226] block">
              {formatCurrency(dashboardData.creditSummary.outstandingCredit)}
            </span>
            <span className="text-xs text-slate-500 font-medium mt-1 block">
              Pending Collection
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
              Pending Sign-Offs
            </span>
            <div className="p-2.5 rounded-xl bg-cyan-50 text-cyan-700"></div>
          </div>
          <div className="mt-4">
            <span className="text-2xl lg:text-3xl font-black font-mono text-[#0A9396] block">
              {pendingApprovalsCount} Requests
            </span>
            <span className="text-xs text-slate-500 font-medium mt-1 block">
              Awaiting Approval
            </span>
          </div>
        </div>
      </div>

      {/* 2. Middle Grid Section: Credit & Restocks Summaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Customer Credit Summary
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Period credit activity & live total balance
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Credit Operations
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">
                Credit Issued
              </span>
              <span className="text-base font-bold font-mono text-slate-900 block">
                {formatCurrency(dashboardData.creditSummary.totalCreditIssued)}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-extrabold text-[#0A9396] uppercase block mb-1">
                Recovered
              </span>
              <span className="text-base font-bold font-mono text-[#0A9396] block">
                {formatCurrency(dashboardData.creditSummary.totalRecovered)}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-extrabold text-[#9B2226] uppercase block mb-1">
                Outstanding Balance
              </span>
              <span className="text-base font-bold font-mono text-[#9B2226] block">
                {formatCurrency(dashboardData.creditSummary.outstandingCredit)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Restocks & Supplier Payables
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Purchases valuation & supplier liabilities
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              Restock Log
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-extrabold text-[#005F73] uppercase block mb-1">
                Restock Purchases
              </span>
              <span className="text-base font-bold font-mono text-[#005F73] block">
                {formatCurrency(dashboardData.restockSummary.totalRestocksValue)}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-extrabold text-[#CA6702] uppercase block mb-1">
                Supplier Owed
              </span>
              <span className="text-base font-bold font-mono text-[#CA6702] block">
                {formatCurrency(dashboardData.restockSummary.totalSupplierPayables)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Payment & Settlement Channels */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-5">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Payment & Settlement Channels
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Live settlement amounts processed per financial channel
            </p>
          </div>
          {loading && (
            <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200 animate-pulse">
              Syncing analytics...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-teal-300 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700">Send Money</span>
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-teal-50 text-[#005F73] border border-teal-200">
                SEND_MONEY
              </span>
            </div>
            <span className="text-2xl font-bold font-mono text-[#005F73]">
              {formatCurrency(dashboardData.paymentTotals.SEND_MONEY)}
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-cyan-300 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700">Cash Transactions</span>
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-50 text-[#0A9396] border border-cyan-200">
                CASH
              </span>
            </div>
            <span className="text-2xl font-bold font-mono text-[#0A9396]">
              {formatCurrency(dashboardData.paymentTotals.CASH)}
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-amber-300 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700">Credit / On Account</span>
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-[#CA6702] border border-amber-200">
                CREDIT
              </span>
            </div>
            <span className="text-2xl font-bold font-mono text-[#CA6702]">
              {formatCurrency(dashboardData.paymentTotals.CREDIT)}
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700">Paybill</span>
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                PAYBILL
              </span>
            </div>
            <span className="text-2xl font-bold font-mono text-emerald-800">
              {formatCurrency(dashboardData.paymentTotals.PAYBILL)}
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

  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

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
    { key: 'approvals', label: 'Approvals & Requests', badge: pendingApprovalsCount, badgeColor: 'bg-[#005F73] text-white' },
    { key: 'alerts', label: 'Low Stock Alerts', badge: lowStockCount, badgeColor: 'bg-[#CA6702] text-white' },
    { key: 'restock', label: 'Restock' },
    { key: 'expenses', label: 'Expenses' },
  ];

  return (
    <div className="min-h-screen flex text-teal-950 font-sans bg-white">
      {/* 1. LEFT SIDEBAR MENU */}
      <aside className="w-64 bg-teal-950 text-white flex flex-col fixed inset-y-0 left-0 z-40 border-r border-teal-900 shadow-xl">
        <div className="p-5 border-b border-teal-900 flex items-center justify-center">
          <span className="text-xs font-black tracking-widest text-teal-300 uppercase">
            Navigation Menu
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                localStorage.setItem('user_active_tab', tab.key);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-teal-100/80 hover:text-white hover:bg-teal-900/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span>{tab.label}</span>
              </div>
              {tab.badge > 0 && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${tab.badgeColor}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-teal-900 bg-teal-900/40">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-rose-900/40 hover:bg-rose-800 text-rose-200 text-xs font-bold border border-rose-700/50 transition cursor-pointer"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA WITH TOP BAR */}
      <div className="flex-1 pl-64 flex flex-col min-w-0 bg-white min-h-screen">
        {/* TOP BAR: Branch, Centered Logo, Date Selector & Account */}
        <header className="bg-teal-950 border-b border-teal-900 px-6 py-3 sticky top-0 z-30 shadow-md">
          <div className="flex items-center justify-between gap-4 w-full">
            {/* Left Controls: Branch & Portals */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 bg-teal-900/80 border border-teal-800 px-3 py-1.5 rounded-xl">
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

              {(currentUser.is_staff || currentUser.is_superuser) && (
                <div className="hidden xl:flex items-center gap-2 text-[10px] text-teal-300/80 border-l border-teal-800 pl-3">
                  <span className="text-teal-300 font-bold">Portals:</span>
                  <button onClick={() => navigate('/')} className={`hover:text-white underline cursor-pointer ${location.pathname === '/' ? 'text-teal-200 font-bold' : ''}`}>User</button> •
                  <button onClick={() => navigate('/management')} className={`hover:text-white underline cursor-pointer ${location.pathname === '/management' ? 'text-teal-200 font-bold' : ''}`}>Management</button> •
                  <button onClick={() => navigate('/admin')} className={`hover:text-white underline cursor-pointer ${location.pathname === '/admin' ? 'text-teal-200 font-bold' : ''}`}>Admin</button>
                </div>
              )}
            </div>

            {/* CENTERED LOGO */}
            <div className="flex items-center justify-center shrink-0">
              <img
                src="/logo.svg"
                alt="Melvex Business Solutions"
                className="h-10 sm:h-12 w-auto object-contain cursor-pointer transition-transform hover:scale-105"
                onClick={() => setActiveTab('dashboard')}
              />
            </div>

            {/* Right Controls: Integrated Date Horizon Picker & Account */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 bg-teal-900/80 border border-teal-800 px-3 py-1 rounded-xl text-xs">
                <span className="text-[10px] font-bold text-teal-300 uppercase hidden md:inline">Period:</span>
                <select
                  value={dateFilter.filterMode}
                  onChange={(e) => setDateFilter((prev) => ({ ...prev, filterMode: e.target.value }))}
                  className="bg-transparent text-white text-xs font-semibold outline-none cursor-pointer"
                >
                  <option value="DAILY" className="bg-teal-950 text-white">Daily Pick</option>
                  <option value="THIS_WEEK" className="bg-teal-950 text-white">Weekly</option>
                  <option value="MONTHLY" className="bg-teal-950 text-white">Monthly</option>
                  <option value="THIS_YEAR" className="bg-teal-950 text-white">Yearly</option>
                  <option value="CUSTOM" className="bg-teal-950 text-white">Custom Range</option>
                </select>

                {dateFilter.filterMode === 'DAILY' && (
                  <input
                    type="date"
                    value={dateFilter.selectedDay}
                    onChange={(e) => setDateFilter((prev) => ({ ...prev, selectedDay: e.target.value }))}
                    className="bg-teal-950 border border-teal-700 text-white rounded-lg px-2 py-0.5 text-xs outline-none cursor-pointer"
                  />
                )}

                {dateFilter.filterMode === 'MONTHLY' && (
                  <input
                    type="month"
                    value={dateFilter.selectedMonth}
                    onChange={(e) => setDateFilter((prev) => ({ ...prev, selectedMonth: e.target.value }))}
                    className="bg-teal-950 border border-teal-700 text-white rounded-lg px-2 py-0.5 text-xs outline-none cursor-pointer"
                  />
                )}

                {dateFilter.filterMode === 'CUSTOM' && (
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={dateFilter.startDate}
                      onChange={(e) => setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))}
                      className="bg-teal-950 border border-teal-700 text-white rounded-lg px-1.5 py-0.5 text-[11px] outline-none"
                    />
                    <span className="text-teal-300">-</span>
                    <input
                      type="date"
                      value={dateFilter.endDate}
                      onChange={(e) => setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))}
                      className="bg-teal-950 border border-teal-700 text-white rounded-lg px-1.5 py-0.5 text-[11px] outline-none"
                    />
                  </div>
                )}
              </div>

              {/* User Avatar */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-900 text-teal-100 text-xs font-semibold border border-teal-800">
                <div className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                  {currentUser.username ? currentUser.username.charAt(0) : 'U'}
                </div>
                <span className="hidden sm:inline">{currentUser.username}</span>
              </div>
            </div>
          </div>
        </header>

        {/* MAIN BODY CONTENT */}
        <main className="flex-1 p-6 lg:p-8 w-full bg-white">
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
      <Route path="/management" element={<ManagementRoute />} />
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