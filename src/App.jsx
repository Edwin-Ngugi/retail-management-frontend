// src/App.jsx
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  Outlet,
} from 'react-router-dom';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

import API from './api';
import { useAnalyticsSocket } from './hooks/useAnalyticsSocket';

import {
  BranchProvider,
  useBranch,
} from './components/BranchContext';

import ExpenseManagement from './components/ExpenseManagement';
import SalesEntry from './components/SalesEntry';
import CreditSalesEntry from './components/CreditSalesEntry';
import SalesInvoicesManagement from './components/SalesInvoicesManagement';
import SalesReturnsManagement from './components/SalesReturnsManagement';
import QuotationsManagement from './components/QuotationManagement';
import CreditSaleManagement from './components/CreditSalesManagement';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import AuthPage from './components/AuthPage';
import ReceiptsLogManagement from './components/ReceiptsLogManagement';
import ApprovalsDashboard from './components/ApprovalsDashboard';
import RestockManagement from './components/RestockManagement';
import CreditPurchaseManagement from './components/CreditPurchaseManagement';
import StockAdjustmentManagement from './components/StockAdjustmentManagement';
import StockTransferManagement from './components/StockTransfersManagement';
import ItemRegister from './components/ItemRegister';
import SupplierPaymentManagement from './components/SupplierPaymentManagement';
import OtherPaymentsManagement from './components/OtherPaymentsManagement';
import PaymentVouchersManagement from './components/PaymentVouchersManagement';
import StockCountManagement from './components/StockCountManagement';
import SupplierRegister from './components/SupplierRegister';
import SupplierStatements from './components/SupplierStatements';
import CustomerRegister from './components/CustomerRegister';
import CustomerStatements from './components/CustomerStatements';
import CustomerOutstandingBalances from './components/CustomerOutstandingBalances';
import SupplierOutstandingBalances from './components/SupplierOutstandingBalances';
import GoodsReceivedManagement from './components/GoodsReceivedManagement';
import PurchaseReturnsManagement from './components/PurchaseReturnsManagement';

// Official Report Views
import SalesView from './components/SalesView';
import PurchaseView from './components/PurchaseView';
import InventoryView from './components/InventoryView';
import DebtorsView from './components/DebtorsView';
import FinancialView from './components/FinancialView';

/* =========================================================
   PORTAL ROUTE GUARDS
========================================================= */

const ProtectedRoute = () => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
};

const AdminPortalRoute = ({ onItemsUpdated }) => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return localStorage.getItem('admin_authenticated') === 'true';
  });

  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user_data') || localStorage.getItem('user') || '{}');
  const isAdmin = user?.is_superuser || user?.is_staff || user?.can_access_admin || ['SUPERADMIN', 'ADMIN'].includes(user?.role);

  if (!token || !isAdmin || !isAdminAuthenticated) {
    return (
      <AdminLogin
        onLoginSuccess={() => {
          localStorage.setItem('admin_authenticated', 'true');
          setIsAdminAuthenticated(true);
        }}
      />
    );
  }

  return <AdminDashboard onItemsUpdated={onItemsUpdated} />;
};

const ManagementRoute = () => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;

  const user = JSON.parse(localStorage.getItem('user_data') || localStorage.getItem('user') || '{}');
  const isManagement = user.is_staff || user.is_superuser || user.role === 'ADMIN' || user.role === 'MANAGEMENT';

  if (!isManagement) {
    return <Navigate to="/" replace />;
  }

  return <AdminDashboard />;
};

/* =========================================================
   INLINE SPINNER HELPER COMPONENT
========================================================= */

const InlineSpinner = () => (
  <span className="inline-flex items-center gap-2 my-0.5">
    <span className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></span>
    <span className="text-xs font-mono font-medium text-slate-400">Loading...</span>
  </span>
);

/* =========================================================
   DASHBOARD OVERVIEW COMPONENT
========================================================= */

function ManagementDashboardCards({ selectedBranch, socketEvent }) {
  const currentDate = useMemo(() => new Date(), []);
  
  const cacheKey = `dash_cache_${selectedBranch}`;

  const [data, setData] = useState(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });

  const [loading, setLoading] = useState(() => !data);

  const [periodType, setPeriodType] = useState(() => {
    if (typeof window === 'undefined') return 'month';
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('period_type') ||
      params.get('periodType') ||
      localStorage.getItem('dash_period_type') ||
      'month'
    );
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window === 'undefined') return currentDate.toISOString().split('T')[0];
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('selectedDate') ||
      localStorage.getItem('dash_selectedDate') ||
      currentDate.toISOString().split('T')[0]
    );
  });

  const [startDate, setStartDate] = useState(() => {
    if (typeof window === 'undefined') return currentDate.toISOString().split('T')[0];
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('start_date') ||
      localStorage.getItem('dash_start_date') ||
      currentDate.toISOString().split('T')[0]
    );
  });

  const [endDate, setEndDate] = useState(() => {
    if (typeof window === 'undefined') return currentDate.toISOString().split('T')[0];
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('end_date') ||
      localStorage.getItem('dash_end_date') ||
      currentDate.toISOString().split('T')[0]
    );
  });

  const [year, setYear] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const paramYear = params.get('year');
      if (paramYear && !isNaN(Number(paramYear))) return Number(paramYear);
      const savedYear = localStorage.getItem('dash_year');
      if (savedYear && !isNaN(Number(savedYear))) return Number(savedYear);
    }
    return currentDate.getFullYear();
  });

  const [month, setMonth] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const paramMonth = params.get('month');
      if (paramMonth && !isNaN(Number(paramMonth))) return Number(paramMonth);
      const savedMonth = localStorage.getItem('dash_month');
      if (savedMonth && !isNaN(Number(savedMonth))) return Number(savedMonth);
    }
    return currentDate.getMonth() + 1;
  });

  const monthNames = useMemo(() => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ], []);

  const availableYears = useMemo(() => {
    const currentYr = currentDate.getFullYear();
    return Array.from({ length: 7 }, (_, index) => currentYr - 3 + index);
  }, [currentDate]);

  const updateUrlAndStorage = useCallback((paramsUpdate) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);

    Object.entries(paramsUpdate).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        url.searchParams.set(key, String(val));
        localStorage.setItem(`dash_${key}`, String(val));
      } else {
        url.searchParams.delete(key);
        localStorage.removeItem(`dash_${key}`);
      }
    });

    window.history.replaceState({}, '', url.toString());
  }, []);

  const handlePeriodChange = (newPeriod) => {
    setPeriodType(newPeriod);

    if (newPeriod === 'month') {
      updateUrlAndStorage({ 
        period_type: newPeriod,
        month,
        year,
        selectedDate: null,
        start_date: null,
        end_date: null,
        startDate: null,
        endDate: null,
        date: null,
      });
    } else if (newPeriod === 'day' || newPeriod === 'weekly') {
      updateUrlAndStorage({ 
        period_type: newPeriod,
        selectedDate,
        month: null,
        year: null,
        start_date: null,
        end_date: null,
        startDate: null,
        endDate: null,
      });
    } else if (newPeriod === 'custom') {
      updateUrlAndStorage({ 
        period_type: newPeriod,
        start_date: startDate,
        end_date: endDate,
        selectedDate: null,
        month: null,
        year: null,
        date: null,
      });
    } else if (newPeriod === 'year') {
      updateUrlAndStorage({ 
        period_type: newPeriod,
        year,
        month: null,
        selectedDate: null,
        start_date: null,
        end_date: null,
        startDate: null,
        endDate: null,
        date: null,
      });
    }
  };

  const handleDateChange = (e) => {
    const val = e.target.value;
    setSelectedDate(val);
    let newYear = year;
    let newMonth = month;

    if (val) {
      const d = new Date(`${val}T00:00:00`);
      if (!isNaN(d.getTime())) {
        newYear = d.getFullYear();
        newMonth = d.getMonth() + 1;
        setYear(newYear);
        setMonth(newMonth);
      }
    }

    updateUrlAndStorage({
      selectedDate: val,
      year: newYear,
      month: newMonth,
      period_type: periodType,
    });
  };

  const handleStartDateChange = (e) => {
    const val = e.target.value;
    setStartDate(val);
    updateUrlAndStorage({
      start_date: val,
      period_type: periodType,
    });
  };

  const handleEndDateChange = (e) => {
    const val = e.target.value;
    setEndDate(val);
    updateUrlAndStorage({
      end_date: val,
      period_type: periodType,
    });
  };

  const handleMonthChange = (newMonth) => {
    setMonth(newMonth);
    const formattedMonth = String(newMonth).padStart(2, '0');
    const newDate = `${year}-${formattedMonth}-01`;
    setSelectedDate(newDate);

    updateUrlAndStorage({
      month: newMonth,
      selectedDate: newDate,
      period_type: periodType,
    });
  };

  const handleYearChange = (newYear) => {
    setYear(newYear);
    const formattedMonth = String(month).padStart(2, '0');
    const newDate = `${newYear}-${formattedMonth}-01`;
    setSelectedDate(newDate);

    updateUrlAndStorage({
      year: newYear,
      selectedDate: newDate,
      period_type: periodType,
    });
  };

  const fetchDashboardData = useCallback((silent = false) => {
    if (!selectedBranch) return;

    if (!silent) setLoading(true);

    const queryParams = new URLSearchParams();
    queryParams.append('branch_id', String(selectedBranch));
    queryParams.append('period_type', periodType);

    if (periodType === 'custom') {
      queryParams.append('start_date', startDate);
      queryParams.append('end_date', endDate);
    } else if (periodType === 'day' || periodType === 'weekly') {
      queryParams.append('date', selectedDate);
    } else if (periodType === 'month') {
      queryParams.append('year', String(year));
      queryParams.append('month', String(month));
    } else if (periodType === 'year') {
      queryParams.append('year', String(year));
    }

    API.get(`management-analytics/dashboard-cards/?${queryParams.toString()}`)
      .then((res) => {
        if (res.data) {
          setData(res.data);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(res.data));
          } catch (e) {}
        }
      })
      .catch((err) => console.error("Error fetching dashboard cards:", err))
      .finally(() => setLoading(false));
  }, [selectedBranch, periodType, selectedDate, startDate, endDate, year, month, cacheKey]);

  useEffect(() => {
    fetchDashboardData(Boolean(data));
  }, [fetchDashboardData]);

  const lastAction = socketEvent?.action || socketEvent?.event;

  useEffect(() => {
    if (['SALE_CHANGED', 'EXPENSE_CHANGED', 'CREDIT_REPAYMENT_UPDATED', 'STOCK_UPDATED', 'STOCK_MOVEMENT_CHANGED', 'STOCK_ADJUSTED'].includes(lastAction)) {
      fetchDashboardData(true);
    }
  }, [lastAction, fetchDashboardData]);

  const getPeriodLabel = () => {
    if (periodType === 'day') return `DATE: ${selectedDate}`;
    if (periodType === 'weekly') return `WEEK OF: ${selectedDate}`;
    if (periodType === 'custom') return `RANGE: ${startDate} TO ${endDate}`;
    if (periodType === 'month') return `MONTH: ${monthNames[month - 1]} ${year}`;
    if (periodType === 'year') return `YEAR: ${year}`;
    return '';
  };

  const prof = data?.profitability || {};
  const debt = data?.debtors || {};
  const inv = data?.inventory || {};
  const cash = data?.cash_flow || {};
  const trajectory = data?.trajectory || [];

  return (
    <div className="space-y-6 w-full font-sans max-w-7xl mx-auto">
      {/* Date Range Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Period:
          </label>
          <select
            value={periodType}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-teal-900 text-xs font-bold rounded-lg px-3 py-1.5 outline-none focus:border-teal-500 cursor-pointer"
          >
            <option value="day">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
            <option value="custom">Custom Range</option>
          </select>

          {(periodType === 'day' || periodType === 'weekly') && (
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium outline-none focus:border-teal-500"
            />
          )}

          {periodType === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={handleStartDateChange}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium outline-none focus:border-teal-500"
              />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={handleEndDateChange}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium outline-none focus:border-teal-500"
              />
            </div>
          )}

          {periodType === 'month' && (
            <div className="flex items-center gap-1.5">
              <select
                value={month}
                onChange={(e) => handleMonthChange(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg px-2 py-1 outline-none"
              >
                {monthNames.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>{name.slice(0, 3)}</option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg px-2 py-1 outline-none"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {periodType === 'year' && (
            <select
              value={year}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg px-2.5 py-1 outline-none"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
        </div>

        <div className="text-[11px] font-mono font-bold text-slate-400 flex items-center gap-2">
          <span>Showing:</span>
          <span className="text-slate-700 uppercase">{getPeriodLabel()}</span>
        </div>
      </div>

      {/* Top Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* FINANCIAL PERFORMANCE */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs relative flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">FINANCIAL PERFORMANCE</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="my-3">
            <span className="text-[11px] text-slate-500 block">Total Sales</span>
            <span className="text-xl font-black font-mono text-slate-900 block">
              {loading ? <InlineSpinner /> : (prof.total_sales_formatted || 'KSh 0.00')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 border-t border-slate-100 pt-2 text-[10px]">
            <div>
              <span className="text-amber-600 font-extrabold block">COGS</span>
              <span className="font-mono text-slate-700">
                {loading ? '...' : (prof.cogs_formatted || '0.00')}
              </span>
            </div>
            <div>
              <span className="text-teal-600 font-extrabold block">GROSS</span>
              <span className="font-mono text-slate-700">
                {loading ? '...' : (prof.gross_profit_formatted || '0.00')}
              </span>
            </div>
            <div>
              <span className="text-blue-600 font-extrabold block">NET</span>
              <span className="font-mono text-slate-700">
                {loading ? '...' : (prof.net_profit_formatted || '0.00')}
              </span>
            </div>
          </div>
        </div>

        {/* CUSTOMER DEBTS */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs relative flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CUSTOMER DEBTS</span>
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          </div>
          <div className="my-3">
            <span className="text-[11px] text-slate-500 block">Receivables Ledger</span>
            <span className="text-xl font-black font-mono text-rose-600 block">
              {loading ? <InlineSpinner /> : (debt.total_customer_debts_formatted || 'KSh 0.00')}
            </span>
          </div>
          <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-[10px]">
            <div>
              <span className="text-teal-600 font-bold block uppercase tracking-wider text-[9px]">Recovered</span>
              <span className="font-mono font-extrabold text-teal-700">
                {loading ? '...' : (debt.total_recovered_formatted || 'KSh 0.00')}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[9px]">Unpaid Credit</span>
              <span className="font-mono font-bold text-slate-600">
                {loading ? '...' : (debt.unpaid_count !== undefined ? `${debt.unpaid_count} Invoices` : 'Pending')}
              </span>
            </div>
          </div>
        </div>

        {/* INVENTORY & SKUS */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs relative flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">INVENTORY & SKUS</span>
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          </div>
          <div className="my-3">
            <span className="text-[11px] text-slate-500 block">Stock Value (Cost)</span>
            <span className="text-xl font-black font-mono text-slate-900 block">
              {loading ? <InlineSpinner /> : (inv.total_stock_value_formatted || 'KSh 0.00')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 border-t border-slate-100 pt-2 text-center text-[10px]">
            <div className="bg-slate-50 py-1 rounded">
              <span className="text-[9px] text-slate-400 uppercase block font-bold">ACTIVE</span>
              <span className="font-bold font-mono text-slate-800">
                {loading ? '...' : (inv.product_skus || 0)}
              </span>
            </div>
            <div className="bg-amber-50 py-1 rounded">
              <span className="text-[9px] text-amber-600 uppercase block font-bold">LOW</span>
              <span className="font-bold font-mono text-amber-700">
                {loading ? '...' : (inv.low_stock_items || 0)}
              </span>
            </div>
            <div className="bg-rose-50 py-1 rounded">
              <span className="text-[9px] text-rose-600 uppercase block font-bold">OUT</span>
              <span className="font-bold font-mono text-rose-700">
                {loading ? '...' : (inv.out_of_stock_items || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* CASH MOVEMENT */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs relative flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CASH MOVEMENT</span>
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          </div>
          <div className="my-3">
            <span className="text-[11px] text-slate-500 block">Monthly Receipts</span>
            <span className="text-xl font-black font-mono text-slate-900 block">
              {loading ? <InlineSpinner /> : (cash.receipts_formatted || 'KSh 0.00')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 border-t border-slate-100 pt-2 text-[10px]">
            <div>
              <span className="text-slate-400 font-bold block font-sans">Monthly Payments</span>
              <span className="font-mono text-slate-700">
                {loading ? '...' : (cash.payments_formatted || 'KSh 0.00')}
              </span>
            </div>
            <div>
              <span className="text-blue-600 font-bold block font-sans">Purchases</span>
              <span className="font-mono text-blue-700">
                {loading ? '...' : (cash.purchases_formatted || 'KSh 0.00')}
              </span>
            </div>
          </div>
        </div>

        {/* CASH POSITION */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs relative flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CASH POSITION</span>
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
          </div>
          <div className="my-3">
            <span className="text-[11px] text-slate-500 block">Available Funds</span>
            <span className="text-xl font-black font-mono text-teal-700 block">
              {loading ? <InlineSpinner /> : (cash.total_available_funds_formatted || 'KSh 0.00')}
            </span>
          </div>
          <div className="border-t border-slate-100 pt-2 text-[10px] text-slate-400">
            Combined cash, bank accounts & till balances
          </div>
        </div>

      </div>

      {/* SALES PERFORMANCE TRAJECTORY GRAPH */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">SALES PERFORMANCE TRAJECTORY</h2>
            <div className="mt-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">TOTAL SALES (PERIOD)</span>
              <span className="text-lg font-black font-mono text-slate-900">
                {loading ? <InlineSpinner /> : (prof.total_sales_formatted || 'KSh 0.00')}
              </span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center space-y-2">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-mono font-bold text-slate-400">Compiling performance trajectory...</span>
            </div>
          ) : trajectory.length === 0 || !trajectory.some(t => (t.total_sales > 0 || t.cogs > 0)) ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-mono bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              No sales or financial activity recorded for this selected date range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trajectory.filter(t => t.total_sales > 0 || t.cogs > 0 || t.net_profit > 0 || periodType !== 'month')}
                margin={{ top: 10, right: 20, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `KSh ${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val, name) => [
                    `KSh ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                    name === 'total_sales' ? 'Total Sales' : name === 'cogs' ? 'COGS' : 'Net Profit'
                  ]}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#fff', fontSize: '11px', border: 'none' }}
                  itemStyle={{ color: '#F8FAFC' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={(value) => <span className="text-slate-700 font-bold">{value === 'total_sales' ? 'Total Sales' : value === 'cogs' ? 'COGS' : 'Net Profit'}</span>}
                />
                <Bar dataKey="cogs" fill="#F59E0B" name="cogs" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="net_profit" fill="#10B981" name="net_profit" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="total_sales" fill="#0D9488" name="total_sales" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   USER DASHBOARD PORTAL
========================================================= */

function UserDashboard({ items, fetchItems, socketEvent }) {
  const navigate = useNavigate();
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user_data') || localStorage.getItem('user');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return { username: 'Store Manager', role: 'User' };
  });

  useEffect(() => {
    API.get('auth/profile/')
      .then((res) => {
        if (res.data) {
          setCurrentUser((prev) => {
            const updated = { ...prev, ...res.data };
            localStorage.setItem('user_data', JSON.stringify(updated));
            return updated;
          });
        }
      })
      .catch((err) => console.error("Could not sync permissions:", err));
  }, []);

  const userPermissions = useMemo(() => {
    return currentUser?.permissions || {};
  }, [currentUser]);

  const hasAccess = useCallback((key) => {
    if (currentUser?.is_superuser || currentUser?.role === 'SUPERADMIN' || currentUser?.role === 'ADMIN') {
      return true;
    }

    if (!userPermissions || typeof userPermissions !== 'object') {
      return true;
    }

    if (key in userPermissions) {
      return Boolean(userPermissions[key]?.view);
    }

    const singularKey = key.endsWith('s') ? key.slice(0, -1) : key;
    const pluralKey = key.endsWith('s') ? key : `${key}s`;

    if (singularKey in userPermissions) {
      return Boolean(singularKey in userPermissions && userPermissions[singularKey]?.view);
    }
    if (pluralKey in userPermissions) {
      return Boolean(pluralKey in userPermissions && userPermissions[pluralKey]?.view);
    }

    return true;
  }, [currentUser, userPermissions]);

  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('user_active_tab');
    if (saved && saved !== 'dashboard') return saved;
    return hasAccess('dashboard') ? 'dashboard' : 'cash_sale';
  });

  useEffect(() => {
    if (activeTab === 'dashboard' && !hasAccess('dashboard')) {
      setActiveTab('cash_sale');
      localStorage.setItem('user_active_tab', 'cash_sale');
    }
  }, [activeTab, hasAccess]);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      const response = await API.get('pending-approvals/');
      const data = Array.isArray(response?.data) 
        ? response.data 
        : response?.data?.results || [];
      const pendingOnly = data.filter((item) => item.status === 'PENDING');
      setPendingApprovals(pendingOnly);
    } catch (e) {
      console.error('Failed to fetch pending approvals:', e);
    }
  }, []);

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  const handleLogout = useCallback(() => {
    localStorage.clear();
    navigate('/login');
  }, [navigate]);

  const safeItems = Array.isArray(items) ? items : [];

  const branchContext = useBranch() || {};
  const {
    branches = [],
    selectedBranch = null,
    setSelectedBranch = () => {},
    loadingBranches = false,
  } = branchContext;

  const menuGroups = useMemo(() => [
    {
      group: 'Dashboard',
      isDirect: true,
      key: 'dashboard',
      label: 'Dashboard',
    },
    {
      group: 'Sales',
      items: [
        { key: 'cash_sale', label: 'Cash Sale' },
        { key: 'credit_sale', label: 'Credit Sale' },
        { key: 'sales_invoices', label: 'Sales Invoices' },
        { key: 'sales_returns', label: 'Sales Returns' },
        { key: 'quotations', label: 'Quotations' },
      ],
    },
    {
      group: 'Receipts',
      items: [
        { key: 'customer_receipts', label: 'Customer Receipts' },
        { key: 'other_receipts', label: 'Other Receipts' },
        { key: 'receipts_allocation', label: 'Receipts Allocation' },
      ],
    },
    {
      group: 'Purchase',
      items: [
        { key: 'cash_purchase', label: 'Cash Purchase' },
        { key: 'credit_purchase', label: 'Credit Purchase' },
        { key: 'goods_received', label: 'Goods Received' },
        { key: 'purchase_returns', label: 'Purchase Returns' },
      ],
    },
    {
      group: 'Payments',
      items: [
        { key: 'supplier_payment', label: 'Supplier Payment' },
        { key: 'expenses', label: 'Operating Expenses' },
        { key: 'other_payments', label: 'Other Payments' },
        { key: 'payment_vouchers', label: 'Payment Vouchers' },
      ],
    },
    {
      group: 'Inventory',
      items: [
        { key: 'item_register', label: 'Item Register' },
        { key: 'stock_transfer', label: 'Stock Transfer' },
        { key: 'stock_adjustment', label: 'Stock Adjustment' },
        { key: 'stock_count', label: 'Stock Count' },
      ],
    },
    {
      group: 'Customer',
      items: [
        { key: 'customer_register', label: 'Customer Register' },
        { key: 'customer_statements', label: 'Customer Statements' },
        { key: 'outstanding_balances', label: 'Outstanding Balance' },
      ],
    },
    {
      group: 'Supplier',
      items: [
        { key: 'supplier_register', label: 'Supplier Register' },
        { key: 'supplier_statements', label: 'Supplier Statements' },
        { key: 'supplier_outstanding', label: 'Outstanding Balances' },
      ],
    },
    {
      group: 'Reports',
      items: [
        { key: 'rep_sales', label: 'Sales Reports' },
        { key: 'rep_purchases', label: 'Purchase Reports' },
        { key: 'rep_inventory', label: 'Inventory Reports' },
        { key: 'rep_debtors', label: 'Debtors Reports' },
        { key: 'rep_financial', label: 'Financial Statements' },
      ],
    },
  ], []);

  const [openGroups, setOpenGroups] = useState({
    Sales: true,
    Receipts: false,
    Purchase: false,
    Payments: false,
    Inventory: false,
    Customer: false,
    Supplier: false,
    Reports: false,
  });

  const toggleGroup = (groupName) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden text-teal-950 font-sans bg-slate-100">
      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="w-60 bg-teal-950 text-white flex flex-col shrink-0 h-full border-r border-teal-900 shadow-xl">
        <div className="p-4 border-b border-teal-900 shrink-0 bg-teal-950 flex items-center justify-between">
          <span className="text-[11px] font-black tracking-widest text-teal-300 uppercase">
            MAIN NAVIGATION
          </span>
        </div>

        <nav className="p-3 space-y-2 flex-1 overflow-y-auto">
          {menuGroups.map((group) => {
            if (group.isDirect) {
              const allowed = hasAccess(group.key);
              if (group.key === 'dashboard' && !allowed) {
                return null;
              }

              return (
                <button
                  key={group.key}
                  disabled={!allowed}
                  onClick={() => {
                    if (!allowed) return;
                    setActiveTab(group.key);
                    localStorage.setItem('user_active_tab', group.key);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition ${
                    !allowed
                      ? 'opacity-40 cursor-not-allowed text-teal-300/50 bg-teal-950/20'
                      : activeTab === group.key
                        ? 'bg-teal-600 text-white shadow-xs cursor-pointer'
                        : 'text-teal-100 hover:bg-teal-900/60 cursor-pointer'
                  }`}
                >
                  <span className="uppercase tracking-wider text-[10px]">{group.label}</span>
                  {!allowed && <span className="text-[10px]" title="Access Restricted">🔒</span>}
                </button>
              );
            }

            const isOpen = Boolean(openGroups[group.group]);
            const hasActiveItem = group.items.some((i) => i.key === activeTab);

            return (
              <div key={group.group} className="rounded-xl overflow-hidden border border-teal-900/40 bg-teal-900/20">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.group)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition cursor-pointer ${
                    hasActiveItem
                      ? 'text-teal-300 bg-teal-900/60'
                      : 'text-teal-100 hover:bg-teal-900/40'
                  }`}
                >
                  <span className="uppercase tracking-wider text-[10px]">{group.group}</span>
                  <span className="text-xs">{isOpen ? '▼' : '►'}</span>
                </button>

                {isOpen && (
                  <div className="px-2 py-1 space-y-1 bg-teal-950/60 border-t border-teal-900/30">
                    {group.items.map((item) => {
                      const allowed = hasAccess(item.key);
                      return (
                        <button
                          key={item.key}
                          disabled={!allowed}
                          onClick={() => {
                            if (!allowed) return;
                            setActiveTab(item.key);
                            localStorage.setItem('user_active_tab', item.key);
                          }}
                          title={!allowed ? 'Module access restricted by administrator' : item.label}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                            !allowed
                              ? 'opacity-40 cursor-not-allowed text-teal-300/40 bg-teal-950/40'
                              : activeTab === item.key
                                ? 'bg-teal-600 text-white shadow-xs font-semibold cursor-pointer'
                                : 'text-teal-200/80 hover:text-white hover:bg-teal-900/50 cursor-pointer'
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          {!allowed && <span className="text-[10px]" title="Restricted">🔒</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-teal-900 bg-teal-900/60 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full py-2 rounded-xl bg-rose-900/40 hover:bg-rose-800 text-rose-200 text-xs font-bold transition cursor-pointer"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN WORKSPACE AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white">
        <header className="bg-teal-950 border-b border-teal-900 px-6 py-2.5 shrink-0 shadow-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-teal-900/80 border border-teal-800 px-3 py-1 rounded-xl">
            <label className="text-[10px] font-bold text-teal-200 uppercase">BRANCH:</label>
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

          <img 
            src="/logo.svg" 
            alt="Melvex Portal" 
            className="h-9 w-auto object-contain cursor-pointer" 
            onClick={() => {
              const targetTab = hasAccess('dashboard') ? 'dashboard' : 'cash_sale';
              setActiveTab(targetTab);
              localStorage.setItem('user_active_tab', targetTab);
            }} 
          />

          <div className="flex items-center gap-4">
            {/* NOTIFICATION BELL ALERT BADGE FOR APPROVALS */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationOpen((prev) => !prev)}
                className="relative p-2 rounded-xl bg-teal-900 hover:bg-teal-800 text-teal-100 transition cursor-pointer"
              >
                <svg className="w-5 h-5 text-teal-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {pendingApprovals.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-teal-950 animate-bounce shadow-md">
                    {pendingApprovals.length}
                  </span>
                )}
              </button>

              {/* NOTIFICATION DROPDOWN MODAL */}
              {isNotificationOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 bg-teal-950 text-white flex justify-between items-center">
                    <span className="text-xs font-extrabold uppercase tracking-wider">Pending Approvals</span>
                    <span className="bg-teal-800 text-teal-200 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                      {pendingApprovals.length} Pending
                    </span>
                  </div>

                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {pendingApprovals.length === 0 ? (
                      <div className="p-6 text-center text-xs font-semibold text-slate-400">
                        No pending approval requests.
                      </div>
                    ) : (
                      pendingApprovals.map((req) => (
                        <div
                          key={req.id}
                          onClick={() => {
                            setIsNotificationOpen(false);
                            setActiveTab('approvals');
                            localStorage.setItem('user_active_tab', 'approvals');
                          }}
                          className="p-3 hover:bg-slate-50 transition cursor-pointer space-y-1"
                        >
                          <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                            <span>{req.request_type_display || req.request_type}</span>
                            <span className="text-[10px] font-mono text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              PENDING
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            Submitted by: {req.submitted_by_username || "User"}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNotificationOpen(false);
                        setActiveTab('approvals');
                        localStorage.setItem('user_active_tab', 'approvals');
                      }}
                      className="text-xs font-bold text-teal-700 hover:text-teal-900 transition"
                    >
                      Open Approvals Dashboard →
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-teal-900 text-teal-100 text-xs font-semibold">
              <span>{currentUser.username}</span>
            </div>
          </div>
        </header>

        {/* WORKSPACE CONTENT ROUTER */}
        <main className="flex-1 overflow-y-auto p-6 w-full bg-slate-50/50">
          {activeTab === 'dashboard' && (
            hasAccess('dashboard') ? (
              <ManagementDashboardCards selectedBranch={selectedBranch} socketEvent={socketEvent} />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-xs">
                <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-2xl font-bold">
                  🔒
                </div>
                <h3 className="text-base font-bold text-slate-800">Dashboard Access Restricted</h3>
                <p className="text-xs text-slate-500 max-w-md">
                  Your account role does not have permission to view executive financial analytics. You have been redirected to active operational features.
                </p>
              </div>
            )
          )}

          {activeTab === 'approvals' && (
            <ApprovalsDashboard items={safeItems} selectedBranch={selectedBranch} onApprovalComplete={() => {
              fetchItems();
              fetchPendingApprovals();
            }} />
          )}

          {activeTab === 'cash_sale' && (
            <SalesEntry items={safeItems} selectedBranch={selectedBranch} onSalesSubmitted={fetchItems} />
          )}

          {activeTab === 'credit_sale' && (
            <CreditSalesEntry items={safeItems} selectedBranch={selectedBranch} onCreditSaleSubmitted={fetchItems} />
          )}

          {activeTab === 'sales_invoices' && (
            <SalesInvoicesManagement selectedBranch={selectedBranch} />
          )}

          {activeTab === 'sales_returns' && (
            <SalesReturnsManagement items={safeItems} selectedBranch={selectedBranch} onReturnSubmitted={fetchItems} />
          )}

          {activeTab === 'quotations' && (
            <QuotationsManagement items={safeItems} selectedBranch={selectedBranch} onQuotationConverted={fetchItems} />
          )}

          {/* PROCUREMENT MODULES */}
          {activeTab === 'cash_purchase' && (
            <RestockManagement items={safeItems} selectedBranch={selectedBranch} onRestockSuccess={fetchItems} />
          )}

          {activeTab === 'credit_purchase' && (
            <CreditPurchaseManagement items={safeItems} selectedBranch={selectedBranch} onPurchaseSuccess={fetchItems} />
          )}

          {activeTab === 'goods_received' && (
            <GoodsReceivedManagement selectedBranch={selectedBranch} />
          )}

          {activeTab === 'purchase_returns' && (
            <PurchaseReturnsManagement items={safeItems} selectedBranch={selectedBranch} onReturnSubmitted={fetchItems} />
          )}

          {/* INVENTORY MODULES */}
          {activeTab === 'item_register' && (
            <ItemRegister items={safeItems} selectedBranch={selectedBranch} />
          )}

          {activeTab === 'stock_transfer' && (
            <StockTransferManagement items={safeItems} selectedBranch={selectedBranch} onTransferSuccess={fetchItems} />
          )}

          {activeTab === 'stock_adjustment' && (
            <StockAdjustmentManagement items={safeItems} selectedBranch={selectedBranch} onAdjustmentSuccess={fetchItems} />
          )}

          {activeTab === 'stock_count' && (
            <StockCountManagement items={safeItems} selectedBranch={selectedBranch} onReconciliationSuccess={fetchItems} />
          )}

          {/* PAYMENTS MODULES */}
          {activeTab === 'supplier_payment' && (
            <SupplierPaymentManagement selectedBranch={selectedBranch} onPaymentSuccess={fetchItems} />
          )}

          {activeTab === 'other_payments' && (
            <OtherPaymentsManagement selectedBranch={selectedBranch} onPaymentSuccess={fetchItems} />
          )}

          {activeTab === 'expenses' && (
            <ExpenseManagement selectedBranch={selectedBranch} />
          )}

          {activeTab === 'payment_vouchers' && (
            <PaymentVouchersManagement selectedBranch={selectedBranch} onVoucherSuccess={fetchItems} />
          )}

          {/* RECEIPTS MODULES */}
          {activeTab === 'customer_receipts' && (
            <CreditSaleManagement selectedBranch={selectedBranch} items={safeItems} onTransactionComplete={fetchItems} />
          )}

          {['other_receipts', 'receipts_allocation'].includes(activeTab) && (
            <ReceiptsLogManagement selectedBranch={selectedBranch} mode={activeTab} onTransactionAdjusted={fetchItems} />
          )}

          {/* CUSTOMER MODULES */}
          {activeTab === 'customer_register' && (
            <CustomerRegister selectedBranch={selectedBranch} />
          )}

          {activeTab === 'customer_statements' && (
            <CustomerStatements selectedBranch={selectedBranch} />
          )}

          {activeTab === 'outstanding_balances' && (
            <CustomerOutstandingBalances
              selectedBranch={selectedBranch}
              onReceivePaymentClick={() => {
                setActiveTab('customer_receipts');
                localStorage.setItem('user_active_tab', 'customer_receipts');
              }}
            />
          )}

          {/* SUPPLIER MODULES */}
          {activeTab === 'supplier_register' && (
            <SupplierRegister selectedBranch={selectedBranch} />
          )}

          {activeTab === 'supplier_statements' && (
            <SupplierStatements selectedBranch={selectedBranch} />
          )}

          {activeTab === 'supplier_outstanding' && (
            <SupplierOutstandingBalances
              selectedBranch={selectedBranch}
              onPaySupplierClick={() => {
                setActiveTab('supplier_payment');
                localStorage.setItem('user_active_tab', 'supplier_payment');
              }}
            />
          )}

          {/* EXECUTIVE REPORT MODULES */}
          {activeTab === 'rep_sales' && (
            <SalesView branchId={selectedBranch} />
          )}

          {activeTab === 'rep_purchases' && (
            <PurchaseView branchId={selectedBranch} />
          )}

          {activeTab === 'rep_inventory' && (
            <InventoryView branchId={selectedBranch} />
          )}

          {activeTab === 'rep_debtors' && (
            <DebtorsView branchId={selectedBranch} />
          )}

          {activeTab === 'rep_financial' && (
            <FinancialView branchId={selectedBranch} />
          )}
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
  const [latestSocketEvent, setLatestSocketEvent] = useState(null);
  const branchContext = useBranch() || {};
  const { selectedBranch = null } = branchContext;

  const fetchItems = useCallback(async () => {
    if (!selectedBranch) return;
    try {
      const response = await API.get(`items/?branch=${encodeURIComponent(selectedBranch)}`);
      const data = Array.isArray(response?.data) ? response.data : response?.data?.results || [];
      setItems(data);
    } catch (error) {
      console.error('Failed to fetch branch items:', error);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Live Real-Time WebSockets Listener
  useAnalyticsSocket(selectedBranch, (event) => {
    setLatestSocketEvent(event);

    const action = event?.action || event?.event;

    // Direct O(1) state mutation for live remaining stock updates
    if (action === 'STOCK_UPDATED' && event?.item_id !== undefined) {
      const targetStock = event.new_stock !== undefined ? event.new_stock : event.remaining_stock;

      setItems((prevItems) =>
        prevItems.map((item) =>
          String(item.id) === String(event.item_id)
            ? {
                ...item,
                remaining_stock: targetStock,
                current_stock: targetStock,
              }
            : item
        )
      );
    } 
    // Triggers full items refresh on stock adjustments, restocks, sales, and movement broadcasts
    else if ([
      'DATA_CHANGED', 
      'SALE_CHANGED', 
      'STOCK_MOVEMENT_CHANGED', 
      'STOCK_ADJUSTED'
    ].includes(action)) {
      fetchItems();
    }
  });

  return (
    <Routes>
      {/* General Auth Entrypoint */}
      <Route path="/login" element={<AuthPage />} />

      {/* Role-guarded workspaces */}
      <Route path="/management" element={<ManagementRoute />} />
      <Route path="/admin" element={<AdminPortalRoute onItemsUpdated={fetchItems} />} />
      
      {/* General workspace protected route */}
      <Route element={<ProtectedRoute />}>
        <Route
          path="/"
          element={
            <UserDashboard
              items={items}
              fetchItems={fetchItems}
              socketEvent={latestSocketEvent}
            />
          }
        />
      </Route>
      
      {/* Catch-all fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BranchProvider>
      <Router>
        <AppContent />
      </Router>
    </BranchProvider>
  );
}