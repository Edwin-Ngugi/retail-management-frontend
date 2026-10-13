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
import Reports from './components/Reports';
import CreditSaleManagement from './components/CreditSalesManagement';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import ManagementDashboard from './components/ManagementDashboard';
import AuthPage from './components/AuthPage';
import Cashbook from './components/Cashbook';
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

const roundMoney = (value) => {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
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

/* =========================================================
   INVENTORY VALUE HELPERS
========================================================= */

const getOpeningStock = (item) => toNumber(item?.opening_stock ?? item?.initial_stock ?? item?.starting_stock);
const getRestockedStock = (item) => toNumber(item?.restocks ?? item?.total_restocked);
const getRemainingStock = (item) => toNumber(item?.remaining_stock ?? item?.current_stock ?? item?.stock);
const getSoldStock = (item) => toNumber(item?.total_stock_sold ?? item?.quantity_sold ?? item?.sold_quantity ?? item?.sold);

const getLatestCostPrice = (item) => {
  const candidates = [
    item?.latest_unit_cost,
    item?.latest_unit_cost_price,
    item?.latest_purchase_cost,
    item?.last_purchase_cost,
    item?.unit_cost_price,
  ];

  for (const candidate of candidates) {
    const value = toNumber(candidate);
    if (value > 0) return value;
  }
  return 0;
};

const getWacCost = (item) => {
  const candidates = [
    item?.weighted_unit_cost,
    item?.weighted_average_cost,
    item?.wac,
    item?.current_wac,
  ];

  for (const candidate of candidates) {
    const value = toNumber(candidate);
    if (value > 0) return roundMoney(value);
  }
  return getLatestCostPrice(item);
};

const getRetailPrice = (item) => toNumber(item?.unit_retail_price ?? item?.unit_price ?? item?.retail_price);

const getStockValue = (item) => {
  const remaining = getRemainingStock(item);
  const wac = getWacCost(item);
  return roundMoney(remaining * wac);
};

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
   STOCK MOVEMENT CHOICES
========================================================= */

const STOCK_MOVEMENT_CHOICES = [
  { value: 'OPENING_STOCK', label: 'Opening Stock' },
  { value: 'PURCHASE', label: 'Purchase / Restock' },
  { value: 'ADJUSTMENT_IN', label: 'Adjustment (In)' },
  { value: 'ADJUSTMENT_OUT', label: 'Adjustment (Out)' },
  { value: 'DAMAGE', label: 'Damage / Spoilage' },
  { value: 'CUSTOMER_RETURN', label: 'Customer Return' },
  { value: 'SUPPLIER_RETURN', label: 'Supplier Return' },
];

/* =========================================================
   LOW STOCK ALERTS & MANUAL MOVEMENT MODAL
========================================================= */

function LowStockAlerts({ items = [], selectedBranch, onRestockSuccess }) {
  const safeItems = Array.isArray(items) ? items : [];

  const lowStockItems = useMemo(() => {
    return safeItems
      .filter((item) => Boolean(item?.is_low_stock))
      .sort((a, b) => getRemainingStock(a) - getRemainingStock(b));
  }, [safeItems]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemForMovement, setSelectedItemForMovement] = useState(null);
  const [movementQuantity, setMovementQuantity] = useState('');
  const [movementType, setMovementType] = useState('PURCHASE');
  const [movementCost, setMovementCost] = useState('');
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [movementNotes, setMovementNotes] = useState('');
  const [apiError, setApiError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return lowStockItems;
    return lowStockItems.filter((item) =>
      String(item?.name || '').toLowerCase().includes(term)
    );
  }, [lowStockItems, searchTerm]);

  const handleRefresh = async () => {
    if (typeof onRestockSuccess === 'function') {
      await onRestockSuccess();
    }
  };

  const handleOpenMovementModal = (item) => {
    setSelectedItemForMovement(item);
    setMovementQuantity('');
    setMovementType('PURCHASE');
    setMovementCost(item?.unit_cost_price || item?.latest_unit_cost || '');
    setMovementDate(new Date().toISOString().slice(0, 10));
    setMovementNotes('');
    setApiError(null);
  };

  const handleMovementSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItemForMovement || !selectedBranch) return;

    setIsSubmitting(true);
    setApiError(null);

    try {
      const payload = {
        item: selectedItemForMovement.id,
        branch: selectedBranch,
        movement_type: movementType,
        quantity: toNumber(movementQuantity),
        unit_cost: movementCost !== '' ? toNumber(movementCost) : undefined,
        created_at: movementDate,
        notes: movementNotes,
      };

      await API.post('stock-movements/', payload);
      setSelectedItemForMovement(null);
      await handleRefresh();
    } catch (err) {
      console.error('Failed to record stock movement:', err);
      setApiError(parseApiError(err, 'Failed to update stock. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
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
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 sm:py-16 text-slate-500 text-xs">
            No low-stock items detected for this branch.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {filteredItems.map((item) => {
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
                  <button
                    type="button"
                    onClick={() => handleOpenMovementModal(item)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm"
                  >
                    Adjust / Restock
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedItemForMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative text-xs my-auto max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Record Stock Movement</h3>
            {apiError && <p className="text-rose-600 mb-2">{apiError}</p>}
            <form onSubmit={handleMovementSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-700 mb-1">Movement Type</label>
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-900"
                >
                  {STOCK_MOVEMENT_CHOICES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  required
                  value={movementQuantity}
                  onChange={(e) => setMovementQuantity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-900"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItemForMovement(null)}
                  className="w-1/2 bg-slate-100 text-slate-700 py-2 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 bg-indigo-600 text-white py-2 rounded-xl font-bold cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Submit'}
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
   USER DASHBOARD PORTAL
========================================================= */

function UserDashboard({ items, fetchItems }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('user_active_tab');
      const allowedTabs = [
        'sales',
        'credit',
        'cashbook',
        'approvals',
        'alerts',
        'inventory',
        'expenses',
        'reports',
      ];
      return allowedTabs.includes(saved) ? saved : 'sales';
    } catch {
      return 'sales';
    }
  });

  const [searchTerm] = useState('');
  const [stockFilter] = useState('all');
  const [sortColumn] = useState('name');
  const [sortDirection] = useState('asc');
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

  const processedItems = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return [...safeItems]
      .filter((item) => {
        const itemName = String(item?.name || item?.item_name || '').toLowerCase();
        const matchesSearch = !search || itemName.includes(search);
        if (!matchesSearch) return false;
        if (stockFilter === 'low') return Boolean(item?.is_low_stock);
        if (stockFilter === 'normal') return !Boolean(item?.is_low_stock);
        return true;
      })
      .sort((a, b) => {
        let valueA = String(a?.name || '').toLowerCase();
        let valueB = String(b?.name || '').toLowerCase();

        if (sortColumn === 'opening_stock') {
          valueA = getOpeningStock(a);
          valueB = getOpeningStock(b);
        } else if (sortColumn === 'remaining_stock') {
          valueA = getRemainingStock(a);
          valueB = getRemainingStock(b);
        } else if (sortColumn === 'unit_retail_price') {
          valueA = getRetailPrice(a);
          valueB = getRetailPrice(b);
        }

        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [safeItems, searchTerm, stockFilter, sortColumn, sortDirection]);

  const totalStockValue = useMemo(() => {
    return processedItems.reduce((total, item) => total + getStockValue(item), 0);
  }, [processedItems]);

  const tabs = [
    { key: 'sales', label: 'Sales Entry' },
    { key: 'credit', label: 'Credit Sales' },
    { key: 'cashbook', label: 'Cashbook' },
    { key: 'approvals', label: 'Approvals & Requests', badge: pendingApprovalsCount, badgeColor: 'bg-indigo-500 text-white' },
    { key: 'alerts', label: 'Low Stock Alerts', badge: lowStockCount, badgeColor: 'bg-amber-500 text-white' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'reports', label: 'Monthly P&L Report' },
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
                onClick={() => navigate('/')}
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
            {/* Navigation Tabs */}
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

            {/* Account Dropdown */}
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
        {activeTab === 'sales' && (
          <SalesEntry items={safeItems} selectedBranch={selectedBranch} onSalesSubmitted={fetchItems} />
        )}
        {activeTab === 'credit' && (
          <CreditSaleManagement selectedBranch={selectedBranch} items={safeItems} onTransactionComplete={fetchItems} />
        )}
        {activeTab === 'cashbook' && <Cashbook selectedBranch={selectedBranch} />}
        {activeTab === 'approvals' && (
          <ApprovalsDashboard selectedBranch={selectedBranch} onApprovalComplete={fetchItems} />
        )}
        {activeTab === 'alerts' && (
          <LowStockAlerts items={safeItems} selectedBranch={selectedBranch} onRestockSuccess={fetchItems} />
        )}
        {activeTab === 'inventory' && (
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 space-y-4 shadow-sm">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">Stock Status</h2>
              <span className="text-xs sm:text-sm font-bold text-indigo-600">Total Valuation: {formatCurrency(totalStockValue)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 sm:px-4">Item Name</th>
                    <th className="py-3 px-3 sm:px-4">Opening</th>
                    <th className="py-3 px-3 sm:px-4">Restocks</th>
                    <th className="py-3 px-3 sm:px-4">Sold</th>
                    <th className="py-3 px-3 sm:px-4">Remaining</th>
                    <th className="py-3 px-3 sm:px-4">Cost Price</th>
                    <th className="py-3 px-3 sm:px-4">Retail Price</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {processedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 sm:px-4 font-semibold text-slate-900">{item.name}</td>
                      <td className="py-2.5 px-3 sm:px-4 font-mono">{getOpeningStock(item)}</td>
                      <td className="py-2.5 px-3 sm:px-4 font-mono text-emerald-600">{getRestockedStock(item)}</td>
                      <td className="py-2.5 px-3 sm:px-4 font-mono text-amber-600">{getSoldStock(item)}</td>
                      <td className="py-2.5 px-3 sm:px-4 font-mono font-bold text-indigo-600">{getRemainingStock(item)}</td>
                      <td className="py-2.5 px-3 sm:px-4 font-mono">{formatCurrency(getWacCost(item))}</td>
                      <td className="py-2.5 px-3 sm:px-4 font-mono">{formatCurrency(getRetailPrice(item))}</td>
                      <td className="py-2.5 px-3 sm:px-4 font-bold text-emerald-600 font-mono text-right">{formatCurrency(getStockValue(item))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === 'expenses' && <ExpenseManagement selectedBranch={selectedBranch} />}
        {activeTab === 'reports' && <Reports selectedBranch={selectedBranch} items={safeItems} />}
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
          {/* Public Auth Routes */}
          <Route path="/login" element={<AuthPage />} />
          <Route path="/auth" element={<AuthPage />} />

          {/* Dedicated Management Portal Route */}
          <Route
            path="/management"
            element={<ManagementDashboard />}
          />

          {/* Dedicated Admin Portal Route */}
          <Route
            path="/admin"
            element={<AdminRoute onItemsUpdated={fetchItems} />}
          />
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Protected User Portal Route */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="/"
              element={<UserDashboard items={items} fetchItems={fetchItems} />}
            />
          </Route>

          {/* Fallback */}
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