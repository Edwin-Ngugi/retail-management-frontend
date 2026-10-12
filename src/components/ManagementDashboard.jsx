// src/components/ManagementDashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import API from '../api';
import { useBranch } from './BranchContext';
import ManagementOperations from './ManagementOperations';

const formatCurrency = (amount) =>
  `KSh ${(Number(amount) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function ManagementDashboard({
  onLogout,
  currentUser: initialUser,
}) {
  const { selectedBranch, setSelectedBranch, branches = [] } = useBranch();

  // Authentication State
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

  // Dynamic Time-Based Greeting State
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Login Form State
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Tab State - Persisted in localStorage
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('mgmt_active_tab') || 'OVERVIEW';
  });

  const [operationsSection, setOperationsSection] = useState(() => {
    return localStorage.getItem('mgmt_operations_section') || 'inventory';
  });

  // Save active tab state when changed
  useEffect(() => {
    localStorage.setItem('mgmt_active_tab', activeTab);
  }, [activeTab]);

  // Save operations subsection when changed
  useEffect(() => {
    localStorage.setItem('mgmt_operations_section', operationsSection);
  }, [operationsSection]);

  // Review Requests State
  const [requests, setRequests] = useState([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [activeStatus, setActiveStatus] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Hidden Request IDs (Persisted in localStorage)
  const [hiddenRequestIds, setHiddenRequestIds] = useState(() => {
    try {
      const saved = localStorage.getItem('mgmt_hidden_approval_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHidden, setShowHidden] = useState(false);

  // Notifications Drawer State
  const [showAlertModal, setShowAlertModal] = useState(false);

  // Rejection & Feedback Modal State
  const [reviewingRequest, setReviewingRequest] = useState(null);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [reviewDecision, setReviewDecision] = useState('APPROVE');
  const [validationError, setValidationError] = useState('');

  // Cashbook State
  const [cashbookEntries, setCashbookEntries] = useState([]);
  const [cashbookLoading, setCashbookLoading] = useState(false);

  // Balance Sheet State & Period Filters
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [loadingBS, setLoadingBS] = useState(false);
  const [periodType, setPeriodType] = useState('month');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Edit Balance Sheet Modal State
  const [showEditBSModal, setShowEditBSModal] = useState(false);
  const [bsFormData, setBsFormData] = useState({});
  const [savingBS, setSavingBS] = useState(false);

  // Persist hidden request IDs
  useEffect(() => {
    try {
      localStorage.setItem('mgmt_hidden_approval_ids', JSON.stringify(hiddenRequestIds));
    } catch (e) {
      console.warn('Failed to save hidden request IDs:', e);
    }
  }, [hiddenRequestIds]);

  // Handle Logout
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
    if (typeof onLogout === 'function') {
      onLogout();
    }
  }, [onLogout]);

  // Handle Management Portal Login
  const handleManagementLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!loginForm.username.trim() || !loginForm.password) {
      setLoginError('Please enter both your admin username and password.');
      return;
    }

    setLoginLoading(true);

    try {
      const res = await API.post('auth/management-login/', {
        username: loginForm.username.trim(),
        password: loginForm.password,
      });

      const token = res.data?.access || res.data?.token;

      if (!token) {
        throw new Error('No access token returned from backend.');
      }

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
      const detail =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Authentication failed. Verify management credentials.';
      setLoginError(detail);
    } finally {
      setLoginLoading(false);
    }
  };

  // Fetch Review Requests
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

  // Fetch Cashbook Ledger
  const fetchCashbook = useCallback(async () => {
    if (!authToken) return;
    setCashbookLoading(true);
    try {
      const endpoint = `cashbook/?branch=${selectedBranch || ''}&period_type=${periodType}&month=${selectedMonth}&year=${selectedYear}&date=${selectedDate}`;
      const res = await API.get(endpoint);

      const entriesData =
        res.data?.entries ||
        (Array.isArray(res.data) ? res.data : res.data?.results || []);
      setCashbookEntries(entriesData);
    } catch (err) {
      console.error('Failed to load cashbook entries:', err);
      setCashbookEntries([]);
      if (err.response?.status === 401) handleLogout();
    } finally {
      setCashbookLoading(false);
    }
  }, [authToken, selectedBranch, periodType, selectedMonth, selectedYear, selectedDate, handleLogout]);

  // Fetch Balance Sheet Statement
  const fetchBalanceSheet = useCallback(async () => {
    if (!authToken) return;
    setLoadingBS(true);
    try {
      const endpoint = `balance-sheet/?branch=${selectedBranch || ''}&period_type=${periodType}&month=${selectedMonth}&year=${selectedYear}&date=${selectedDate}`;
      const res = await API.get(endpoint);
      setBalanceSheet(res.data || null);
    } catch (err) {
      console.error('Failed to load balance sheet:', err);
      setBalanceSheet(null);
      if (err.response?.status === 401) handleLogout();
    } finally {
      setLoadingBS(false);
    }
  }, [authToken, selectedBranch, periodType, selectedMonth, selectedYear, selectedDate, handleLogout]);

  useEffect(() => {
    if (!authToken) return;

    if (activeTab === 'OVERVIEW') {
      fetchRequests();
      fetchCashbook();
      fetchBalanceSheet();
    } else if (activeTab === 'REVIEWS') {
      fetchRequests();
    } else if (activeTab === 'CASHBOOK') {
      fetchCashbook();
    } else if (activeTab === 'BALANCE_SHEET') {
      fetchBalanceSheet();
    }
  }, [authToken, selectedBranch, activeTab, fetchRequests, fetchCashbook, fetchBalanceSheet]);

  const handleHideRequest = (e, id) => {
    e.stopPropagation();
    setHiddenRequestIds((prev) => [...new Set([...prev, id])]);
  };

  const handleUnhideRequest = (e, id) => {
    e.stopPropagation();
    setHiddenRequestIds((prev) => prev.filter((hiddenId) => hiddenId !== id));
  };

  const handleUnhideAll = () => {
    setHiddenRequestIds([]);
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const isHidden = hiddenRequestIds.includes(req.id);
      if (!showHidden && isHidden) return false;

      const reqType = req.request_type || req.category || req.type || req.approval_type || '';
      const matchesStatus =
        activeStatus === 'ALL' || req.status === activeStatus;
      const matchesCategory =
        activeCategory === 'ALL' || reqType === activeCategory;
      return matchesStatus && matchesCategory;
    });
  }, [requests, activeStatus, activeCategory, hiddenRequestIds, showHidden]);

  const summaryMetrics = useMemo(() => {
    const pending = requests.filter((r) => r.status?.toUpperCase().includes('PENDING')).length;
    const approved = requests.filter((r) => r.status?.toUpperCase().includes('APPROVED')).length;
    const rejected = requests.filter((r) => r.status?.toUpperCase().includes('REJECTED')).length;
    return { pending, approved, rejected, total: requests.length };
  }, [requests]);

  const cashbookSummary = useMemo(() => {
    const totals = cashbookEntries.reduce((acc, entry) => {
      const type = String(entry.type || '').toUpperCase();
      const amount = Number(entry.amount) || 0;
      if (type === 'INFLOW' || type === 'INCOME') acc.inflows += amount;
      else acc.outflows += amount;
      return acc;
    }, { inflows: 0, outflows: 0 });
    return {
      ...totals,
      netMovement: totals.inflows - totals.outflows,
      records: cashbookEntries.length,
    };
  }, [cashbookEntries]);

  const categories = [
    { id: 'ALL', label: 'All Requests' },
    { id: 'NEW_REGISTERED_ITEMS', label: 'New Items' },
    { id: 'SALE_ENTRY', label: 'Sale Entry' },
    { id: 'STOCK_ADJUSTMENT', label: 'Stock Adjustment' },
  ];

  const managementAreas = [
    { id: 'approvals', title: 'Approvals & User Reviews', description: 'Review staff submissions, approve valid requests, and return incorrect entries with feedback.', icon: '☑', tab: 'REVIEWS' },
    { id: 'finance', title: 'Financial Oversight', description: 'Monitor cash inflows and outflows, assets, liabilities, equity, and financial position.', icon: '▤', tab: 'CASHBOOK' },
    { id: 'inventory', title: 'Inventory & Stock Control', description: 'Review branch stock levels, stock movements, and pricing.', icon: '', operation: 'inventory' },
    { id: 'purchasing', title: 'Purchases & Restock', description: 'Monitor purchase records and stock costs.', icon: '', operation: 'purchasing' },
    { id: 'credit', title: 'Customer Credit & Repayments', description: 'Review customer credit invoices and repayments by actual repayment date and method.', icon: '', operation: 'credit' },
    { id: 'branches', title: 'Branch Performance', description: 'Review branch records and cashbook activity where the APIs provide them.', icon: '', operation: 'branches' },
    { id: 'expenses', title: 'Expenses & Cash Control', description: 'Review dated operating expenses and their impact on cash movement and profitability.', icon: '', tab: 'CASHBOOK' },
    { id: 'returns', title: 'Returns & Stock Losses', description: 'Review customer returns, supplier returns, and stock movements.', icon: '↩', operation: 'returns' },
  ];

  const getCategoryInfo = (rawType) => {
    const type = String(rawType || '').toUpperCase().trim();

    if (type.includes('SALE')) {
      return {
        label: 'SALE ENTRY',
        style: 'bg-sky-50 text-sky-700 border-sky-200',
      };
    }
    if (type.includes('STOCK') || type.includes('ADJUST')) {
      return {
        label: 'STOCK ADJUSTMENT',
        style: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }
    if (type.includes('NEW') || type.includes('ITEM') || type.includes('REGISTER')) {
      return {
        label: 'NEW ITEMS',
        style: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    return {
      label: rawType ? String(rawType).replace(/_/g, ' ').toUpperCase() : 'GENERAL ENTRY',
      style: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    };
  };

  const handleOpenReviewModal = (e, req, decision) => {
    e.stopPropagation();
    setReviewingRequest(req);
    setReviewDecision(decision);
    setFeedbackNote(req.feedback || req.rejection_reason || '');
    setValidationError('');
  };

  const handleActionSubmit = async () => {
    if (!reviewingRequest) return;

    if (reviewDecision === 'REJECT' && !feedbackNote.trim()) {
      setValidationError('Please enter a note explaining why this request is being rejected.');
      return;
    }

    setActionLoading(reviewingRequest.id);
    setValidationError('');

    try {
      if (reviewDecision === 'APPROVE') {
        await API.post(`pending-approvals/${reviewingRequest.id}/approve/`, {
          feedback: feedbackNote.trim() || 'Approved by management',
        });
      } else {
        await API.post(`pending-approvals/${reviewingRequest.id}/reject/`, {
          reason: feedbackNote.trim(),
          feedback: feedbackNote.trim(),
        });
      }
      setReviewingRequest(null);
      setFeedbackNote('');
      fetchRequests();
    } catch (err) {
      alert(
        'Action failed: ' +
          (err.response?.data?.error ||
            err.response?.data?.detail ||
            err.message)
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenEditBS = () => {
    if (!balanceSheet) return;
    const assets = balanceSheet.assets || {};
    const currAssets = assets.current_assets || {};
    const fixedAssets = assets.fixed_assets || {};
    const liabilities = balanceSheet.liabilities || {};
    const currLiab = liabilities.current_liabilities || {};
    const equity = balanceSheet.equity || {};

    setBsFormData({
      cash_and_equivalents: currAssets.cash_and_equivalents ?? 0,
      accounts_receivable: currAssets.accounts_receivable ?? 0,
      inventory_value: currAssets.inventory_value ?? 0,
      property_equipment: fixedAssets.property_equipment ?? 0,
      accumulated_depreciation: fixedAssets.accumulated_depreciation ?? 0,
      accounts_payable: currLiab.accounts_payable ?? 0,
      bank_overdraft: currLiab.bank_overdraft ?? 0,
      owner_capital: equity.owner_capital ?? 0,
      retained_earnings: equity.retained_earnings ?? 0,
      drawings: equity.drawings ?? 0,
    });

    setShowEditBSModal(true);
  };

  const handleSaveBalanceSheet = async (e) => {
    e.preventDefault();
    setSavingBS(true);

    try {
      const payload = {
        branch: selectedBranch,
        period_type: periodType,
        month: selectedMonth,
        year: selectedYear,
        date: selectedDate,
        ...bsFormData,
      };

      await API.post('balance-sheet/update/', payload);
      alert('Balance Sheet figures updated successfully!');
      setShowEditBSModal(false);
      fetchBalanceSheet();
    } catch (err) {
      alert(
        'Failed to save balance sheet updates: ' +
          (err.response?.data?.detail || err.message)
      );
    } finally {
      setSavingBS(false);
    }
  };

  const cannedRejectionNotes = [
    'Unit cost price appears incorrect or inflated.',
    'Profit margin is below minimum operational threshold.',
    'Duplicate transaction entry detected.',
    'Quantities do not align with current stock physically available.',
  ];

  if (!authToken) {
    return (
      <div className="min-h-screen relative w-full flex items-center justify-center p-4 font-sans text-slate-800 bg-slate-100">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <img
                src="/logo.svg"
                alt="Melvex Business Solutions"
                className="h-20 w-auto object-contain transition-transform duration-300 hover:scale-105"
              />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-wide">
              Management Portal
            </h1>
            <p className="text-xs text-slate-500">
              Sign in with management credentials to review pending requests, cashbook records, and balance sheets.
            </p>
          </div>

          {loginError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
              <span>{loginError}</span>
              <button
                type="button"
                onClick={() => setLoginError('')}
                className="text-rose-500 hover:text-rose-800 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleManagementLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                Username / Email
              </label>
              <input
                type="text"
                required
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                placeholder="e.g. manager_username"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="••••••••••••"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-indigo-600 focus:bg-white transition"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              {loginLoading ? 'Authenticating...' : '🔐 Sign In to Management Portal'}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400">
              Restricted Executive Access Session • Secure Token
            </p>
          </div>
        </div>
      </div>
    );
  }

  const userName = currentUser?.username || currentUser?.name || 'Manager';

  return (
    <div className="min-h-screen relative w-full text-slate-800 p-4 md:p-6 font-sans bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-5">
        
        {/* ================= HEADER & CONTROLS ================= */}
        <div className="flex flex-col gap-4 bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <img
                src="/logo.svg"
                alt="Melvex Business Solutions"
                className="h-16 sm:h-20 w-auto object-contain cursor-pointer transition-transform duration-200 hover:scale-105"
              />
              
              <div className="border-l border-slate-200 pl-4 hidden sm:block">
                <h1 className="text-base font-bold text-slate-900 tracking-wide flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  Management Review Portal
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Management overview, operational activity and financial oversight.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <button
                onClick={() => setShowAlertModal(true)}
                className="relative p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300 transition cursor-pointer flex items-center justify-center text-slate-700"
                title="Click to view pending approval notifications"
              >
                <span className="text-lg">🔔</span>
                {summaryMetrics.pending > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-white animate-bounce">
                    {summaryMetrics.pending}
                  </span>
                )}
              </button>

              <nav aria-label="Management sections" className="flex flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                {[
                  { id: 'OVERVIEW', label: 'Overview', icon: '▦' },
                  { id: 'REVIEWS', label: 'User Reviews', icon: '☷' },
                  { id: 'OPERATIONS', label: 'Operations', icon: '⚙' },
                  { id: 'CASHBOOK', label: 'Cashbook', icon: '▤' },
                  { id: 'BALANCE_SHEET', label: 'Balance Sheet', icon: '▥' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition cursor-pointer whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                    }`}
                  >
                    <span className="mr-1.5" aria-hidden="true">{tab.icon}</span>{tab.label}
                    {tab.id === 'REVIEWS' && summaryMetrics.pending > 0 && (
                      <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
                        {summaryMetrics.pending}
                      </span>
                    )}
                  </button>
                ))}
              </nav>

              <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    {userName[0]?.toUpperCase() || 'M'}
                  </div>
                  <div className="text-left hidden sm:block">
                    <span className="block text-xs font-bold text-slate-800 leading-tight">
                      {userName}
                    </span>
                    <span className="block text-[9px] text-indigo-600 font-semibold uppercase">
                      {currentUser?.is_superuser ? 'Superadmin' : (currentUser?.role || 'Management')}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-xl border border-rose-200 transition cursor-pointer"
                >
                  🚪 Logout
                </button>
              </div>
            </div>
          </div>

          {/* SHARED FILTER CONTROL BAR */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                 <span>Branch:</span>
              </span>
              <select
                value={selectedBranch || ''}
                onChange={(e) => setSelectedBranch?.(e.target.value)}
                className="bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-xl px-3 py-1.5 outline-none focus:border-indigo-600 cursor-pointer shadow-xs"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id || b.code || b.name} value={b.id || b.code}>
                    {b.name || b.branch_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                 <span>Period:</span>
              </span>
              <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-300 shadow-xs">
                {['day', 'month', 'year'].map((pt) => (
                  <button
                    key={pt}
                    onClick={() => setPeriodType(pt)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition cursor-pointer ${
                      periodType === pt
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {pt}
                  </button>
                ))}
              </div>

              {periodType === 'day' && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-xl px-3 py-1 outline-none focus:border-indigo-600 cursor-pointer shadow-xs"
                />
              )}

              {periodType === 'month' && (
                <div className="flex items-center gap-1 bg-white border border-slate-300 px-2 py-1 rounded-xl text-xs shadow-xs">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="bg-transparent text-slate-800 outline-none cursor-pointer font-medium"
                  >
                    {[
                      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                    ].map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="bg-transparent text-slate-800 outline-none cursor-pointer font-medium"
                  >
                    {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {periodType === 'year' && (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-white border border-slate-300 text-slate-800 text-xs font-medium rounded-xl px-3 py-1 outline-none focus:border-indigo-600 cursor-pointer shadow-xs"
                >
                  {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* ================= USER WELCOME INTERFACE ================= */}
        {activeTab === 'OVERVIEW' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
                <span>👋</span> {greeting}, <span className="text-slate-900 capitalize">{userName}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1">
                Welcome back
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Here is your management overview, with key financial indicators and operational activity at a glance.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div
                onClick={() => {
                  setActiveTab('REVIEWS');
                  setActiveStatus('PENDING');
                }}
                className={`p-3 rounded-xl border transition cursor-pointer flex items-center gap-3 shrink-0 ${
                  summaryMetrics.pending > 0
                    ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-500">
                    Pending Approvals
                  </span>
                  <span className="text-sm font-extrabold text-slate-900">
                    {summaryMetrics.pending > 0
                      ? `${summaryMetrics.pending} Action Required`
                      : 'No Pending Requests'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= MANAGEMENT OVERVIEW ================= */}
        {activeTab === 'OVERVIEW' && (() => {
          const assets = balanceSheet?.assets || {};
          const liabilities = balanceSheet?.liabilities || {};
          const equity = balanceSheet?.equity || {};
          const currentAssets = assets.current_assets || {};
          const currentLiabilities = liabilities.current_liabilities || {};
          const totalAssets = Number(assets.total_assets ?? 0);
          const totalLiabilities = Number(liabilities.total_liabilities ?? 0);
          const totalEquity = Number(equity.total_equity ?? 0);
          const reviewBase = Math.max(summaryMetrics.total, 1);
          const requestTypes = [
            { label: 'Sale entries', count: requests.filter((r) => String(r.request_type || r.category || r.type || r.approval_type || '').toUpperCase().includes('SALE')).length, color: 'bg-sky-500' },
            { label: 'Stock adjustments', count: requests.filter((r) => /STOCK|ADJUST/i.test(String(r.request_type || r.category || r.type || r.approval_type || ''))).length, color: 'bg-amber-500' },
            { label: 'New items', count: requests.filter((r) => /NEW|ITEM|REGISTER/i.test(String(r.request_type || r.category || r.type || r.approval_type || ''))).length, color: 'bg-emerald-500' },
          ];
          const recentRequests = [...requests].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 5);
          return (
            <section className="space-y-5" aria-label="Management overview and analysis">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600">Executive dashboard</p>
                  <h2 className="text-xl font-extrabold text-slate-900 mt-1">Management at a glance</h2>
                  <p className="text-xs text-slate-500 mt-1">A consolidated view of approvals, cash movement and the reported financial position.</p>
                </div>
                <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">
                  <span className="font-semibold text-slate-700">Reporting period:</span> {periodType === 'day' ? selectedDate : periodType === 'month' ? `${new Date(selectedYear, selectedMonth - 1, 1).toLocaleString(undefined, { month: 'long' })} ${selectedYear}` : selectedYear}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {[
                  { label: 'Total Assets', value: balanceSheet ? formatCurrency(totalAssets) : '—', note: 'Reported asset position', icon: '◈', tone: 'text-emerald-700', bg: 'bg-emerald-50' },
                  { label: 'Liabilities', value: balanceSheet ? formatCurrency(totalLiabilities) : '—', note: 'Reported obligations', icon: '⇄', tone: 'text-rose-700', bg: 'bg-rose-50' },
                  { label: 'Owner Equity', value: balanceSheet ? formatCurrency(totalEquity) : '—', note: 'Reported equity position', icon: '◆', tone: 'text-indigo-700', bg: 'bg-indigo-50' },
                  { label: 'Net Cash Movement', value: cashbookLoading ? 'Loading…' : formatCurrency(cashbookSummary.netMovement), note: 'Inflows less outflows in loaded cashbook', icon: '↗', tone: cashbookSummary.netMovement >= 0 ? 'text-emerald-700' : 'text-rose-700', bg: 'bg-sky-50' },
                ].map((metric) => (
                  <div key={metric.label} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{metric.label}</span>
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-lg ${metric.bg} ${metric.tone}`} aria-hidden="true">{metric.icon}</span>
                    </div>
                    <p className={`mt-3 text-lg sm:text-xl font-extrabold tabular-nums ${metric.tone}`}>{metric.value}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{metric.note}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Management Control Centre</h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Management responsibilities based on the business models.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {managementAreas.map((area) => (
                    <div key={area.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-2xl" aria-hidden="true">{area.icon}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 mt-3">{area.title}</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-2 flex-1">{area.description}</p>
                      {(area.tab || area.operation) && (
                        <button type="button" onClick={() => { if (area.tab) setActiveTab(area.tab); else { setOperationsSection(area.operation); setActiveTab('OPERATIONS'); } }} className="mt-4 w-full rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700 transition cursor-pointer">
                          Open section →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div><h3 className="text-sm font-bold text-slate-900">Operational activity</h3><p className="text-[11px] text-slate-500 mt-1">Status of staff submissions received by management</p></div>
                    <button type="button" onClick={fetchRequests} disabled={loading} className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 disabled:opacity-50">{loading ? 'Refreshing…' : 'Refresh'}</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {[
                      { label: 'Pending', count: summaryMetrics.pending, tone: 'text-amber-700', bg: 'bg-amber-50' },
                      { label: 'Approved', count: summaryMetrics.approved, tone: 'text-emerald-700', bg: 'bg-emerald-50' },
                      { label: 'Rejected', count: summaryMetrics.rejected, tone: 'text-rose-700', bg: 'bg-rose-50' },
                    ].map((item) => (
                      <div key={item.label} className={`rounded-xl p-3 ${item.bg}`}><p className={`text-[10px] font-bold uppercase ${item.tone}`}>{item.label}</p><p className="text-2xl font-extrabold text-slate-900 mt-1">{item.count}</p></div>
                    ))}
                  </div>
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Requests by category</p>
                    {requestTypes.map((item) => (
                      <div key={item.label}>
                        <div className="flex justify-between gap-3 text-xs mb-1.5"><span className="text-slate-700">{item.label}</span><span className="font-bold text-slate-900 tabular-nums">{item.count}</span></div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.min(100, (item.count / reviewBase) * 100)}%` }} /></div>
                      </div>
                    ))}
                    <p className="text-[10px] text-slate-400">Category counts are based on the review requests currently returned by the approvals API.</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-4"><div><h3 className="text-sm font-bold text-slate-900">Financial position</h3><p className="text-[11px] text-slate-500 mt-1">From the balance-sheet report</p></div><span className="text-lg text-indigo-600">▥</span></div>
                  {balanceSheet ? <div className="space-y-3 text-xs">
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Cash & equivalents</span><strong className="text-slate-900 text-right">{formatCurrency(currentAssets.cash_and_equivalents)}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Accounts receivable</span><strong className="text-slate-900 text-right">{formatCurrency(currentAssets.accounts_receivable)}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Inventory value</span><strong className="text-slate-900 text-right">{formatCurrency(currentAssets.inventory_value)}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Accounts payable</span><strong className="text-slate-900 text-right">{formatCurrency(currentLiabilities.accounts_payable)}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Bank Overdraft</span><strong className="text-slate-900 text-right">{formatCurrency(currentLiabilities.bank_overdraft || currentLiabilities.cash_overdraft || 0)}</strong></div>
                    <div className="pt-3 border-t border-slate-100 flex justify-between gap-3"><span className="font-semibold text-slate-700">Assets vs liabilities + equity</span><strong className={Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.01 ? 'text-emerald-700' : 'text-amber-700'}>{Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.01 ? 'Balanced' : `Variance ${formatCurrency(Math.abs(totalAssets - totalLiabilities - totalEquity))}`}</strong></div>
                    <button type="button" onClick={() => setActiveTab('BALANCE_SHEET')} className="w-full mt-2 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100">Open balance sheet →</button>
                  </div> : <p className="text-xs text-slate-500 py-6">{loadingBS ? 'Loading financial position…' : 'Financial position is not available. Refresh the dashboard or open the balance sheet.'}</p>}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
                  <div><h3 className="text-sm font-bold text-slate-900">Recent management requests</h3><p className="text-[11px] text-slate-500 mt-1">Latest submissions that may need follow-up</p></div>
                  <button type="button" onClick={() => { setActiveTab('REVIEWS'); setActiveStatus('ALL'); }} className="px-3 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Open user reviews →</button>
                </div>
                {recentRequests.length ? <div className="divide-y divide-slate-100">{recentRequests.map((req) => {
                  const status = String(req.status || 'PENDING').toUpperCase();
                  const label = req.request_type || req.category || req.type || req.approval_type || 'General request';
                  return <div key={req.id} className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-slate-800">{String(label).replace(/_/g, ' ')}</p><p className="text-[10px] text-slate-500 mt-1">Ref #{req.id} · {req.created_at ? new Date(req.created_at).toLocaleString() : 'Date unavailable'}</p></div><span className={`px-2.5 py-1 rounded-full border text-[9px] font-bold ${status.includes('APPROVED') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : status.includes('REJECTED') ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{status}</span></div>;
                })}</div> : <div className="p-8 text-center text-xs text-slate-500">{loading ? 'Loading management activity…' : 'No management requests are currently available.'}</div>}
              </div>
            </section>
          );
        })()}

        {/* ================= MANAGEMENT OPERATIONS ================= */}
        {activeTab === 'OPERATIONS' && (
          <ManagementOperations
            selectedBranch={selectedBranch}
            initialSection={operationsSection}
            periodType={periodType}
            selectedDate={selectedDate}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onBack={() => setActiveTab('OVERVIEW')}
          />
        )}

        {/* ================= USER REVIEWS TAB ================= */}
        {activeTab === 'REVIEWS' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase text-amber-600 tracking-wider">Pending Action</span>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{summaryMetrics.pending}</div>
                <p className="text-[10px] text-slate-500 mt-0.5">Awaiting manager review</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">Approved Requests</span>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{summaryMetrics.approved}</div>
                <p className="text-[10px] text-slate-500 mt-0.5">Verified & active in ledger</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase text-rose-600 tracking-wider">Returned / Rejected</span>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{summaryMetrics.rejected}</div>
                <p className="text-[10px] text-slate-500 mt-0.5">Sent back with notes</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-[10px] font-bold uppercase text-indigo-600 tracking-wider">Total Submitted</span>
                <div className="text-2xl font-extrabold text-slate-900 mt-1">{summaryMetrics.total}</div>
                <p className="text-[10px] text-slate-500 mt-0.5">All staff submissions</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer ${
                      activeCategory === cat.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap">
                {hiddenRequestIds.length > 0 && (
                  <button
                    onClick={() => setShowHidden((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                      showHidden
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    👁️ {showHidden ? 'Hide Dismissed' : `Show Hidden (${hiddenRequestIds.length})`}
                  </button>
                )}

                {hiddenRequestIds.length > 0 && showHidden && (
                  <button
                    onClick={handleUnhideAll}
                    className="text-xs text-indigo-600 hover:text-indigo-800 underline font-semibold cursor-pointer"
                  >
                    Restore All
                  </button>
                )}

                <select
                  value={activeStatus}
                  onChange={(e) => setActiveStatus(e.target.value)}
                  className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-medium rounded-xl px-3 py-1.5 outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="ALL">All Statuses ({summaryMetrics.total})</option>
                  <option value="PENDING">Pending Review ({summaryMetrics.pending})</option>
                  <option value="APPROVED">Approved ({summaryMetrics.approved})</option>
                  <option value="REJECTED">Rejected / Returned ({summaryMetrics.rejected})</option>
                </select>

                <button
                  onClick={fetchRequests}
                  disabled={loading}
                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition cursor-pointer"
                >
                  {loading ? 'Refreshing...' : '🔄 Refresh'}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {filteredRequests.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 shadow-sm">
                  <span className="text-2xl block mb-2">📥</span>
                  No review requests matching the current filters.
                </div>
              ) : (
                filteredRequests.map((req) => {
                  const isExpanded = expandedId === req.id;
                  const isHidden = hiddenRequestIds.includes(req.id);
                  const items = req.payload?.items || [];
                  const totalItems = items.length;
                  const reqType = req.request_type || req.category || req.type || req.approval_type || '';
                  const categoryBadge = getCategoryInfo(reqType);
                  const status = req.status?.toUpperCase() || 'PENDING';
                  const isPending = status.includes('PENDING');

                  return (
                    <div
                      key={req.id}
                      className={`border rounded-2xl overflow-hidden transition-all duration-200 shadow-sm ${
                        isHidden
                          ? 'bg-slate-100/60 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(isExpanded ? null : req.id); } }}
                        onClick={() => setExpandedId(isExpanded ? null : req.id)}
                        className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                            #{req.id?.toString().substring(0, 8) || req.id}
                          </span>

                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide border ${categoryBadge.style}`}>
                            {categoryBadge.label}
                          </span>

                          <span className="text-xs text-slate-700 font-semibold bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                             <strong>{totalItems}</strong> Items
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-slate-500 hidden sm:inline">
                            Submitted: {req.created_at ? new Date(req.created_at).toLocaleDateString() : 'Today'}
                          </span>

                          <span
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all border ${
                              status.includes('APPROVED')
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : status.includes('REJECTED')
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-300 animate-pulse'
                            }`}
                          >
                            {status}
                          </span>

                          <div className="flex items-center gap-1.5 ml-1">
                            <button
                              onClick={(e) => handleOpenReviewModal(e, req, 'APPROVE')}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white text-xs font-bold rounded-lg border border-emerald-200 transition cursor-pointer"
                              title="Approve request"
                            >
                              {isPending ? 'Approve' : 'Re-Approve'}
                            </button>
                            <button
                              onClick={(e) => handleOpenReviewModal(e, req, 'REJECT')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-xs font-bold rounded-lg border border-rose-200 transition cursor-pointer"
                              title="Reject & return to staff with feedback notes"
                            >
                              {isPending ? 'Reject & Return' : 'Re-Reject'}
                            </button>
                          </div>

                          {isHidden ? (
                            <button
                              onClick={(e) => handleUnhideRequest(e, req.id)}
                              className="p-1 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-slate-200 rounded-md cursor-pointer transition ml-1"
                              title="Unhide on management screen"
                            >
                              👁️ Unhide
                            </button>
                          ) : (
                            <button
                              onClick={(e) => handleHideRequest(e, req.id)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md cursor-pointer transition ml-1"
                              title="Remove from screen (Remain in database)"
                            >
                              ✕
                            </button>
                          )}

                          <span className="text-slate-400 text-xs pl-1">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-4">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-700 uppercase tracking-wide">
                              Item List Breakdown ({totalItems})
                            </span>
                            
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => handleOpenReviewModal(e, req, 'APPROVE')}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
                              >
                                ✅ Approve
                              </button>
                              <button
                                onClick={(e) => handleOpenReviewModal(e, req, 'REJECT')}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
                              >
                                ❌ Reject & Add Notes
                              </button>
                            </div>
                          </div>

                          {(req.feedback || req.rejection_reason) && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                              <span className="text-base">💬</span>
                              <div>
                                <strong className="text-amber-900 font-bold block">Management Feedback / Note:</strong>
                                <p className="mt-0.5">{req.feedback || req.rejection_reason}</p>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {items.map((item, i) => (
                              <div
                                key={i}
                                className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 shadow-sm"
                              >
                                <div className="flex justify-between items-center">
                                  <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100">
                                  <div>
                                    <span className="text-slate-500 block text-[9px] uppercase font-bold">Cost Price</span>
                                    <span className="font-semibold text-slate-800">{formatCurrency(item.unit_cost_price || 0)}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block text-[9px] uppercase font-bold">Retail Price</span>
                                    <span className="font-semibold text-emerald-600">{formatCurrency(item.unit_retail_price || 0)}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block text-[9px] uppercase font-bold">Stock Quantity</span>
                                    <span className="font-semibold text-slate-800">{item.opening_stock ?? 0}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block text-[9px] uppercase font-bold">Est. Margin</span>
                                    <span className="font-semibold text-indigo-600">
                                      {formatCurrency((item.unit_retail_price || 0) - (item.unit_cost_price || 0))}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: CASHBOOK LEDGER ================= */}
        {activeTab === 'CASHBOOK' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-slate-900">Branch Cashbook Ledger</h2>
                <p className="text-xs text-slate-500">Recorded cash inflows, repayment collections, and operational expenses.</p>
              </div>
              <button
                onClick={fetchCashbook}
                disabled={cashbookLoading}
                className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition cursor-pointer"
              >
                {cashbookLoading ? 'Updating...' : '🔄 Refresh Ledger'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Inflows</p>
                <p className="mt-2 text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(cashbookSummary.inflows)}</p>
                <p className="mt-1 text-[10px] text-slate-400">Income and collections in the loaded period</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Outflows</p>
                <p className="mt-2 text-lg font-bold text-rose-600 tabular-nums">{formatCurrency(cashbookSummary.outflows)}</p>
                <p className="mt-1 text-[10px] text-slate-400">Payments and expenses in the loaded period</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Net Cash Movement</p>
                <p className={`mt-2 text-lg font-bold tabular-nums ${cashbookSummary.netMovement >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(cashbookSummary.netMovement)}</p>
                <p className="mt-1 text-[10px] text-slate-400">Inflows less outflows; not the closing cash balance</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ledger Records</p>
                <p className="mt-2 text-lg font-bold text-slate-900 tabular-nums">{cashbookSummary.records.toLocaleString()}</p>
                <p className="mt-1 text-[10px] text-slate-400">Entries returned for the selected period</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type / Description</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {cashbookEntries.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-400 text-xs">
                        No cashbook records found for this branch and period.
                      </td>
                    </tr>
                  ) : (
                    cashbookEntries.map((entry, idx) => {
                      const isInflow =
                        entry.type?.toUpperCase() === 'INFLOW' ||
                        entry.type?.toUpperCase() === 'INCOME';

                      return (
                        <tr
                          key={entry.id || idx}
                          className="hover:bg-slate-50 transition"
                        >
                          <td className="py-2.5 px-4 text-slate-500 font-mono">
                            {entry.date
                              ? new Date(entry.date).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-800">
                            {entry.category || entry.description || entry.title || 'Transaction'}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-500">
                            {entry.reference || entry.receipt_number || '—'}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-indigo-600">
                            {entry.payment_method || 'CASH'}
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right font-bold font-mono ${
                              isInflow ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {isInflow ? '+' : '-'}{formatCurrency(entry.amount)}
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

        {/* ================= TAB 3: BALANCE SHEET STATEMENT ================= */}
        {activeTab === 'BALANCE_SHEET' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-6 shadow-sm">
            
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                  Financial Statement
                </span>
                <h2 className="text-lg font-bold text-slate-900 tracking-wide">
                  Statement of Financial Position
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live assets, liabilities, and owner equity balances.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={fetchBalanceSheet}
                  disabled={loadingBS}
                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition cursor-pointer"
                >
                  {loadingBS ? 'Updating...' : '🔄 Refresh Statement'}
                </button>

                <button
                  onClick={handleOpenEditBS}
                  disabled={!balanceSheet}
                  className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-xl border border-amber-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                   Edit Figures
                </button>
              </div>
            </div>

            {loadingBS ? (
              <div className="py-16 text-center text-slate-500 text-xs">
                Calculating Statement of Financial Position...
              </div>
            ) : balanceSheet ? (
              (() => {
                const assets = balanceSheet.assets || {};
                const currentAssets = assets.current_assets || {};
                const fixedAssets = assets.fixed_assets || {};
                const liabilities = balanceSheet.liabilities || {};
                const currentLiabilities = liabilities.current_liabilities || {};
                const equity = balanceSheet.equity || {};

                const bankOverdraft = Number(currentLiabilities.bank_overdraft || currentLiabilities.cash_overdraft || 0);
                const totalAssets = Number(assets.total_assets || 0);
                const totalLiabilities = Number(liabilities.total_liabilities || 0);
                const totalEquity = Number(equity.total_equity || 0);
                const totalLE = totalLiabilities + totalEquity;
                const difference = Math.abs(totalAssets - totalLE);
                const isBalanced = difference < 0.01;

                return (
                  <div className="space-y-6">
                    <div
                      className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isBalanced
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-rose-50 border-rose-200'
                      }`}
                    >
                      <div>
                        <p
                          className={`text-xs font-bold uppercase tracking-wider ${
                            isBalanced ? 'text-emerald-800' : 'text-rose-800'
                          }`}
                        >
                          {isBalanced
                            ? '✅ Balance Sheet In Balance'
                            : '⚠️ Variance Detected'}
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Assets = Liabilities + Owner Equity
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase block font-bold">Variance</span>
                        <span className={`font-mono font-bold text-xs ${isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {formatCurrency(difference)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* ASSETS SECTION */}
                      <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                          <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                            Assets (What You Own)
                          </h3>
                        </div>

                        <div className="p-4 space-y-4 text-xs">
                          <div>
                            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">
                              Current Assets
                            </h4>
                            <div className="space-y-2 pl-2 text-slate-700">
                              <div className="flex justify-between">
                                <span>Cash & Cash Equivalents</span>
                                <span className="font-mono font-semibold">{formatCurrency(currentAssets.cash_and_equivalents)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Accounts Receivable (Credit Sales)</span>
                                <span className="font-mono font-semibold">{formatCurrency(currentAssets.accounts_receivable)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Inventory Valuation</span>
                                <span className="font-mono font-semibold">{formatCurrency(currentAssets.inventory_value)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-200">
                            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">
                              Non-Current Assets
                            </h4>
                            <div className="space-y-2 pl-2 text-slate-700">
                              <div className="flex justify-between">
                                <span>Property, Plant & Equipment</span>
                                <span className="font-mono font-semibold">{formatCurrency(fixedAssets.property_equipment)}</span>
                              </div>
                              {fixedAssets.accumulated_depreciation !== undefined && (
                                <div className="flex justify-between text-slate-500">
                                  <span>Less: Accumulated Depreciation</span>
                                  <span className="font-mono">({formatCurrency(Math.abs(fixedAssets.accumulated_depreciation))})</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center font-bold">
                            <span className="text-emerald-800 uppercase text-[11px]">Total Assets</span>
                            <span className="font-mono text-emerald-700 text-sm">{formatCurrency(totalAssets)}</span>
                          </div>
                        </div>
                      </div>

                      {/* LIABILITIES & EQUITY SECTION */}
                      <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                          <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider">
                            Liabilities & Equity (Financing)
                          </h3>
                        </div>

                        <div className="p-4 space-y-4 text-xs">
                          <div>
                            <h4 className="font-bold text-rose-800 uppercase tracking-wider text-[10px] mb-2">
                              Current Liabilities
                            </h4>
                            <div className="space-y-2 pl-2 text-slate-700">
                              <div className="flex justify-between">
                                <span>Accounts Payable (Supplier Debts)</span>
                                <span className="font-mono font-semibold">{formatCurrency(currentLiabilities.accounts_payable)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Bank / Cash Overdraft</span>
                                <span className="font-mono font-semibold">{formatCurrency(bankOverdraft)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-200">
                            <h4 className="font-bold text-indigo-800 uppercase tracking-wider text-[10px] mb-2">
                              Owner's Equity
                            </h4>
                            <div className="space-y-2 pl-2 text-slate-700">
                              <div className="flex justify-between">
                                <span>Owner's Invested Capital</span>
                                <span className="font-mono font-semibold">{formatCurrency(equity.owner_capital)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Retained Earnings</span>
                                <span className="font-mono font-semibold">{formatCurrency(equity.retained_earnings)}</span>
                              </div>
                              {equity.current_period_profit !== undefined && (
                                <div className="flex justify-between">
                                  <span>Current Period Profit / (Loss)</span>
                                  <span className="font-mono font-semibold text-emerald-600">
                                    {formatCurrency(equity.current_period_profit)}
                                  </span>
                                </div>
                              )}
                              {equity.drawings !== undefined && Number(equity.drawings) !== 0 && (
                                <div className="flex justify-between text-slate-500">
                                  <span>Less: Owner Drawings</span>
                                  <span className="font-mono">({formatCurrency(Math.abs(equity.drawings))})</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex justify-between items-center font-bold">
                            <span className="text-indigo-800 uppercase text-[11px]">Total Liabilities & Equity</span>
                            <span className="font-mono text-indigo-700 text-sm">{formatCurrency(totalLE)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="py-16 text-center text-slate-500 text-xs">
                Unable to load balance sheet calculations.
              </div>
            )}
          </div>
        )}

        {/* ================= ALERTS & NOTIFICATIONS MODAL ================= */}
        {showAlertModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>🔔</span> Notifications ({summaryMetrics.pending})
                </h3>
                <button
                  onClick={() => setShowAlertModal(false)}
                  className="text-slate-400 hover:text-slate-700 text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                <div>
                  <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span></span> Pending Staff Approvals ({summaryMetrics.pending})
                  </h4>
                  {summaryMetrics.pending === 0 ? (
                    <p className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      No pending approval requests.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {requests
                        .filter((r) => r.status?.toUpperCase().includes('PENDING'))
                        .map((req) => (
                          <div
                            key={req.id}
                            onClick={() => {
                              setActiveTab('REVIEWS');
                              setActiveStatus('PENDING');
                              setExpandedId(req.id);
                              setShowAlertModal(false);
                            }}
                            className="bg-amber-50 hover:bg-amber-100 border border-amber-200 p-3 rounded-xl text-xs flex justify-between items-center cursor-pointer transition"
                          >
                            <div>
                              <span className="font-bold text-slate-900 block">
                                #{req.id?.toString().substring(0, 8)} — {getCategoryInfo(req.request_type).label}
                              </span>
                              <span className="text-[10px] text-amber-800">
                                Items: {req.payload?.items?.length || 0}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold uppercase bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300 text-amber-800">
                              Review
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 text-right">
                <button
                  onClick={() => setShowAlertModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= EDIT BALANCE SHEET MODAL ================= */}
        {showEditBSModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>✏️</span> Edit Balance Sheet Adjustments
                </h3>
                <button
                  onClick={() => setShowEditBSModal(false)}
                  className="text-slate-400 hover:text-slate-700 text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveBalanceSheet} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Cash Reserves (KSh)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bsFormData.cash_and_equivalents || 0}
                      onChange={(e) => setBsFormData({ ...bsFormData, cash_and_equivalents: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 outline-none focus:border-indigo-600 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Accounts Receivable (KSh)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bsFormData.accounts_receivable || 0}
                      onChange={(e) => setBsFormData({ ...bsFormData, accounts_receivable: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 outline-none focus:border-indigo-600 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Inventory Valuation (KSh)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bsFormData.inventory_value || 0}
                      onChange={(e) => setBsFormData({ ...bsFormData, inventory_value: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 outline-none focus:border-indigo-600 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Property & Equipment (KSh)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bsFormData.property_equipment || 0}
                      onChange={(e) => setBsFormData({ ...bsFormData, property_equipment: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 outline-none focus:border-indigo-600 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Accounts Payable (KSh)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bsFormData.accounts_payable || 0}
                      onChange={(e) => setBsFormData({ ...bsFormData, accounts_payable: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 outline-none focus:border-indigo-600 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Bank / Cash Overdraft (KSh)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bsFormData.bank_overdraft || 0}
                      onChange={(e) => setBsFormData({ ...bsFormData, bank_overdraft: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 outline-none focus:border-indigo-600 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Owner's Capital (KSh)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bsFormData.owner_capital || 0}
                      onChange={(e) => setBsFormData({ ...bsFormData, owner_capital: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 outline-none focus:border-indigo-600 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Retained Earnings (KSh)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bsFormData.retained_earnings || 0}
                      onChange={(e) => setBsFormData({ ...bsFormData, retained_earnings: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 outline-none focus:border-indigo-600 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Owner Drawings (KSh)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bsFormData.drawings || 0}
                      onChange={(e) => setBsFormData({ ...bsFormData, drawings: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 outline-none focus:border-indigo-600 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-3 mt-3">
                  <button
                    type="button"
                    onClick={() => setShowEditBSModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingBS}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
                  >
                    {savingBS ? 'Saving...' : 'Save & Recalculate'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= REJECTION MODAL ================= */}
        {reviewingRequest && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>{reviewDecision === 'APPROVE' ? '✅' : '❌'}</span>
                  {reviewDecision === 'APPROVE' ? 'Approve Entry' : 'Reject & Return to User'} #{reviewingRequest.id}
                </h3>
                <button
                  onClick={() => setReviewingRequest(null)}
                  className="text-slate-400 hover:text-slate-700 text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Decision Selection
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReviewDecision('APPROVE');
                      setValidationError('');
                    }}
                    className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                      reviewDecision === 'APPROVE'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Approve Request
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewDecision('REJECT');
                      setValidationError('');
                    }}
                    className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                      reviewDecision === 'REJECT'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Reject & Return
                  </button>
                </div>
              </div>

              {reviewDecision === 'REJECT' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Quick Rejection Templates:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {cannedRejectionNotes.map((note, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setFeedbackNote(note);
                          setValidationError('');
                        }}
                        className="text-[10px] bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg text-slate-700 transition text-left cursor-pointer"
                      >
                        + {note}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {reviewDecision === 'REJECT'
                    ? 'Rejection Reason / Guidance Note (Required):'
                    : 'Optional Approval Note:'}
                </label>
                <textarea
                  value={feedbackNote}
                  onChange={(e) => {
                    setFeedbackNote(e.target.value);
                    if (e.target.value.trim()) setValidationError('');
                  }}
                  placeholder={
                    reviewDecision === 'REJECT'
                      ? 'Specify why this submission is being rejected and returned to the staff user...'
                      : 'Add an optional manager comment...'
                  }
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 outline-none focus:border-indigo-600 focus:bg-white"
                />
                {validationError && (
                  <p className="text-[11px] font-semibold text-rose-600 mt-1">
                    ⚠️ {validationError}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-3">
                <button
                  onClick={() => setReviewingRequest(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleActionSubmit}
                  disabled={actionLoading === reviewingRequest.id}
                  className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm ${
                    reviewDecision === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {actionLoading ? 'Submitting...' : 'Confirm Decision & Notify Staff'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}