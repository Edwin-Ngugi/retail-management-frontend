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

import API from './api';

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
import ManagementLogin from './components/ManagementLogin';
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

const AdminRoute = ({ onItemsUpdated }) => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  if (!token) return <AdminLogin />;
  return <AdminDashboard onItemsUpdated={onItemsUpdated} />;
};

const ManagementRoute = () => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  if (!token) return <ManagementLogin />;
  return <AdminDashboard />;
};

/* =========================================================
   EXACT MATCH DASHBOARD OVERVIEW COMPONENT
========================================================= */

function ManagementDashboardCards({ selectedBranch }) {
  const currentDate = useMemo(() => new Date(), []);
  const [data, setData] = useState(null);

  // Period state initialization matching Reports logic
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

  // Sync state to URL & Storage
  const updateUrlAndStorage = useCallback((paramsUpdate) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);

    Object.entries(paramsUpdate).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        url.searchParams.set(key, String(val));
        localStorage.setItem(`dash_${key}`, String(val));
      } else {
        url.searchParams.delete(key);
      }
    });

    window.history.replaceState({}, '', url.toString());
  }, []);

  // Handlers
  const handlePeriodChange = (newPeriod) => {
    setPeriodType(newPeriod);
    updateUrlAndStorage({ 
      period_type: newPeriod,
      selectedDate,
      startDate,
      endDate,
      month,
      year
    });
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

  const fetchDashboardData = useCallback(() => {
    if (!selectedBranch) return;

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

    API.get(`dashboard-cards/?${queryParams.toString()}`)
      .then((res) => {
        if (res.data) {
          setData(res.data);
        }
      })
      .catch((err) => console.error("Error fetching dashboard cards:", err));
  }, [selectedBranch, periodType, selectedDate, startDate, endDate, year, month]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

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

          {/* Dynamic Date Pickers matching Reports logic */}
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

        <div className="text-[11px] font-mono font-bold text-slate-400">
          Showing: <span className="text-slate-700 uppercase">{getPeriodLabel()}</span>
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
              {prof.total_sales_formatted || 'KSh 0.00'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 border-t border-slate-100 pt-2 text-[10px]">
            <div>
              <span className="text-amber-600 font-extrabold block">COGS</span>
              <span className="font-mono text-slate-700">{prof.cogs_formatted || '0.00'}</span>
            </div>
            <div>
              <span className="text-teal-600 font-extrabold block">GROSS</span>
              <span className="font-mono text-slate-700">{prof.gross_profit_formatted || '0.00'}</span>
            </div>
            <div>
              <span className="text-blue-600 font-extrabold block">NET</span>
              <span className="font-mono text-slate-700">{prof.net_profit_formatted || '0.00'}</span>
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
              {debt.total_customer_debts_formatted || 'KSh 0.00'}
            </span>
          </div>
          <div className="border-t border-slate-100 pt-2 text-[10px] text-slate-400">
            Total unpaid customer credit balances
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
              {inv.total_stock_value_formatted || 'KSh 0.00'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 border-t border-slate-100 pt-2 text-center text-[10px]">
            <div className="bg-slate-50 py-1 rounded">
              <span className="text-[9px] text-slate-400 uppercase block font-bold">ACTIVE</span>
              <span className="font-bold font-mono text-slate-800">{inv.product_skus || 0}</span>
            </div>
            <div className="bg-amber-50 py-1 rounded">
              <span className="text-[9px] text-amber-600 uppercase block font-bold">LOW</span>
              <span className="font-bold font-mono text-amber-700">{inv.low_stock_items || 0}</span>
            </div>
            <div className="bg-rose-50 py-1 rounded">
              <span className="text-[9px] text-rose-600 uppercase block font-bold">OUT</span>
              <span className="font-bold font-mono text-rose-700">{inv.out_of_stock_items || 0}</span>
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
              {cash.receipts_formatted || 'KSh 0.00'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 border-t border-slate-100 pt-2 text-[10px]">
            <div>
              <span className="text-slate-400 font-bold block font-sans">Monthly Payments</span>
              <span className="font-mono text-slate-700">{cash.payments_formatted || 'KSh 0.00'}</span>
            </div>
            <div>
              <span className="text-blue-600 font-bold block font-sans">Purchases</span>
              <span className="font-mono text-blue-700">{cash.purchases_formatted || 'KSh 0.00'}</span>
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
              {cash.total_available_funds_formatted || 'KSh 0.00'}
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
                {prof.total_sales_formatted || 'KSh 0.00'}
              </span>
            </div>
          </div>
        </div>

        <div className="h-64 border border-slate-200 rounded-xl p-4 flex flex-col justify-end bg-slate-50/50">
          <div className="flex-1 flex items-end justify-between gap-1 px-2">
            {trajectory.length === 0 ? (
              <div className="w-full flex items-center justify-center text-xs text-slate-400 font-mono">
                No activity recorded for this selected date range.
              </div>
            ) : (
              trajectory.map((point, index) => (
                <div key={index} className="flex-1 flex flex-col items-center group relative">
                  <div className="w-full max-w-[12px] flex flex-col items-center gap-0.5">
                    <div
                      style={{ height: `${Math.min(100, (point.total_sales / (prof.total_sales || 1)) * 180)}px` }}
                      className="w-full bg-teal-500 rounded-t-xs"
                    ></div>
                  </div>
                  <span className="text-[8px] text-slate-400 font-mono mt-2">{point.date}</span>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-slate-300 w-full mt-2"></div>
        </div>

        <div className="flex items-center justify-center gap-6 text-[11px] font-bold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-amber-500 rounded-xs"></span>
            <span className="text-slate-600">COGS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-emerald-500 rounded-xs"></span>
            <span className="text-slate-600">Net Profit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-teal-600 rounded-xs"></span>
            <span className="text-slate-600">Total Sales</span>
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

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('user_active_tab') || 'dashboard';
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
    } catch (e) {}
    return { username: 'Store Manager', role: 'User' };
  }, []);

  const fetchPendingApprovalsCount = useCallback(async () => {
    try {
      const response = await API.get('pending-approvals/');
      const data = Array.isArray(response?.data) ? response.data : response?.data?.results || [];
      setPendingApprovalsCount(data.filter((item) => item.status === 'PENDING').length);
    } catch (e) {
      console.error('Failed to fetch pending approvals count:', e);
    }
  }, []);

  useEffect(() => {
    fetchPendingApprovalsCount();
  }, [fetchPendingApprovalsCount]);

  const handleLogout = useCallback(() => {
    localStorage.clear();
    navigate('/login');
  }, [navigate]);

  const safeItems = Array.isArray(items) ? items : [];

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
      group: 'Procurement',
      items: [
        { key: 'cash_purchase', label: 'Cash Purchase' },
        { key: 'credit_purchase', label: 'Credit Purchase' },
        { key: 'goods_received', label: 'Goods Received' },
        { key: 'purchase_returns', label: 'Purchase Returns' },
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
      group: 'Payments',
      items: [
        { key: 'supplier_payment', label: 'Supplier Payment' },
        { key: 'expenses', label: 'Operating Expenses' },
        { key: 'other_payments', label: 'Other Payments' },
        { key: 'payment_vouchers', label: 'Payment Vouchers' },
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
      group: 'Customers',
      items: [
        { key: 'customer_register', label: 'Customer Register' },
        { key: 'customer_statements', label: 'Customer Statements' },
        { key: 'outstanding_balances', label: 'Outstanding Balance' },
      ],
    },
    {
      group: 'Suppliers',
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
    Procurement: true,
    Inventory: true,
    Suppliers: true,
    Reports: true,
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
              return (
                <button
                  key={group.key}
                  onClick={() => {
                    setActiveTab(group.key);
                    localStorage.setItem('user_active_tab', group.key);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === group.key
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-teal-100 hover:bg-teal-900/60'
                  }`}
                >
                  <span className="uppercase tracking-wider text-[10px]">{group.label}</span>
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
                  <span className="text-xs">{isOpen ? '▾' : '▸'}</span>
                </button>

                {isOpen && (
                  <div className="px-2 py-1 space-y-1 bg-teal-950/60 border-t border-teal-900/30">
                    {group.items.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => {
                          setActiveTab(item.key);
                          localStorage.setItem('user_active_tab', item.key);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                          activeTab === item.key
                            ? 'bg-teal-600 text-white shadow-xs font-semibold'
                            : 'text-teal-200/80 hover:text-white hover:bg-teal-900/50'
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                        {Boolean(item.badge) && (
                          <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full ml-1">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    ))}
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

          <img src="/logo.svg" alt="Melvex Portal" className="h-9 w-auto object-contain cursor-pointer" onClick={() => setActiveTab('dashboard')} />

          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-teal-900 text-teal-100 text-xs font-semibold">
            <span>{currentUser.username}</span>
          </div>
        </header>

        {/* WORKSPACE CONTENT ROUTER */}
        <main className="flex-1 overflow-y-auto p-6 w-full bg-slate-50/50">
          {activeTab === 'dashboard' && (
            <ManagementDashboardCards selectedBranch={selectedBranch} />
          )}

          {activeTab === 'approvals' && (
            <ApprovalsDashboard items={safeItems} selectedBranch={selectedBranch} onApprovalComplete={fetchItems} />
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
    <BranchProvider>
      <Router>
        <AppContent />
      </Router>
    </BranchProvider>
  );
}