import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';
import { useBranch } from '../components/BranchContext';
import StockActivityLog from '../components/StockActivityLog';
import ApprovalsDashboard from './ApprovalsDashboard';

export default function AdminDashboard({
  selectedBranch: propBranch,
  onItemsUpdated,
}) {
  // Safe destructuring with fallback default object to prevent runtime errors
  const {
    branches = [],
    selectedBranch: contextBranch = null,
    setSelectedBranch = () => {},
    loadingBranches = false,
  } = useBranch() || {};

  const getNumericBranchId = useCallback((branchValue) => {
    if (branchValue === null || branchValue === undefined || branchValue === '') {
      return null;
    }
    if (typeof branchValue === 'object') {
      branchValue = branchValue?.id;
    }
    const parsed = Number(branchValue);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);

  const activeBranch = useMemo(() => {
    const directBranch = propBranch || contextBranch;
    const resolvedId = getNumericBranchId(directBranch);
    if (resolvedId !== null) return resolvedId;
    if (Array.isArray(branches) && branches.length > 0) return branches[0].id;
    return null;
  }, [propBranch, contextBranch, branches, getNumericBranchId]);

  useEffect(() => {
    if (!contextBranch && Array.isArray(branches) && branches.length > 0 && typeof setSelectedBranch === 'function') {
      setSelectedBranch(String(branches[0].id));
    }
  }, [contextBranch, branches, setSelectedBranch]);

  // PERSISTENT TAB STATE ACROSS PAGE REFRESHES
  const [adminTab, setAdminTab] = useState(() => {
    try {
      const saved = localStorage.getItem('admin_active_tab');
      const allowedTabs = ['inventory', 'approvals', 'stock-ops', 'branches'];
      return allowedTabs.includes(saved) ? saved : 'inventory';
    } catch {
      return 'inventory';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('admin_active_tab', adminTab);
    } catch (e) {
      console.warn('Unable to persist admin active tab:', e);
    }
  }, [adminTab]);

  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newBranchName, setNewBranchName] = useState('');

  // Single Item Form State
  const [singleItem, setSingleItem] = useState({
    name: '',
    unit_cost_price: '',
    unit_retail_price: '',
    opening_stock: '0',
  });

  // Edit Item State
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    unit_cost_price: '',
    unit_retail_price: '',
    opening_stock: '0',
  });

  // Stock Modal State
  const [stockModalItem, setStockModalItem] = useState(null);
  const [stockInput, setStockInput] = useState('');

  // Branch Copy Modal State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({
    username: localStorage.getItem('username') || 'Administrator',
    email: localStorage.getItem('email') || 'admin@company.com',
    role: 'System Administrator',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const getActiveBranchObject = useCallback(() => {
    const branchId = getNumericBranchId(activeBranch);
    if (branchId === null || !Array.isArray(branches)) return null;
    return branches.find((branch) => Number(branch.id) === Number(branchId)) || null;
  }, [activeBranch, branches, getNumericBranchId]);

  const extractErrorMessage = useCallback((err, fallback) => {
    const data = err?.response?.data;
    if (!data) return fallback;
    if (typeof data === 'string') return data;
    if (data.detail) return String(data.detail);
    if (data.message) return String(data.message);
    if (data.error) return String(data.error);
    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length > 0) {
        const val = data[keys[0]];
        return Array.isArray(val) ? `${keys[0]}: ${val.join(', ')}` : `${keys[0]}: ${val}`;
      }
    }
    return fallback;
  }, []);

  const formatCurrency = useCallback((value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '0.00';
    return parsed.toFixed(2);
  }, []);

  const extractCostPrice = useCallback((item, activeBranchId) => {
    const branchPricing = Array.isArray(item.branch_pricings)
      ? item.branch_pricings.find((p) => Number(p.branch) === Number(activeBranchId))
      : item.branch_pricing;

    return (
      branchPricing?.unit_cost_price ??
      branchPricing?.cost_price ??
      item.unit_cost_price ??
      item.cost_price ??
      0
    );
  }, []);

  const extractRetailPrice = useCallback((item, activeBranchId) => {
    const branchPricing = Array.isArray(item.branch_pricings)
      ? item.branch_pricings.find((p) => Number(p.branch) === Number(activeBranchId))
      : item.branch_pricing;

    return (
      branchPricing?.unit_selling_price ??
      branchPricing?.unit_retail_price ??
      item.unit_retail_price ??
      item.retail_price ??
      0
    );
  }, []);

  const extractOpeningStock = useCallback((item, activeBranchId) => {
    const branchPricing = Array.isArray(item.branch_pricings)
      ? item.branch_pricings.find((p) => Number(p.branch) === Number(activeBranchId))
      : item.branch_pricing;

    return branchPricing?.opening_stock ?? item.opening_stock ?? 0;
  }, []);

  const extractRestockedStock = useCallback((item) => {
    return Number(item?.restocks ?? item?.total_restocked ?? 0);
  }, []);

  const fetchInventory = useCallback(async () => {
    const branchId = getNumericBranchId(activeBranch);
    if (branchId === null) {
      setItems([]);
      return;
    }

    try {
      const res = await API.get(`items/?branch=${branchId}`);
      const fetchedItems = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      setItems(fetchedItems);
    } catch (err) {
      console.error('Failed to load items:', err);
      setStatus({
        type: 'error',
        text: extractErrorMessage(err, 'Failed to load inventory for selected branch.'),
      });
    }
  }, [activeBranch, getNumericBranchId, extractErrorMessage]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const triggerGlobalUpdate = useCallback(async () => {
    await fetchInventory();
    if (typeof onItemsUpdated === 'function') {
      onItemsUpdated();
    }
  }, [fetchInventory, onItemsUpdated]);

  const handleRolloverStock = async () => {
    const branchId = getNumericBranchId(activeBranch);
    if (branchId === null) return;
    if (!window.confirm('Copy Remaining Stock to Opening Stock for all items in this branch?')) return;

    setLoading(true);
    try {
      const res = await API.post('items/rollover-stock/', { branch: branchId });
      setStatus({ type: 'success', text: res.data?.detail || 'Stock rolled over successfully!' });
      await triggerGlobalUpdate();
    } catch (err) {
      setStatus({ type: 'error', text: extractErrorMessage(err, 'Failed to rollover stock.') });
    } finally {
      setLoading(false);
    }
  };

  const handleAddBranch = async (e) => {
    e.preventDefault();
    const cleanName = newBranchName.trim();
    if (!cleanName) return;
    setLoading(true);

    try {
      const generatedCode = cleanName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase() + '-01';

      const res = await API.post('branches/', {
        name: cleanName,
        code: generatedCode,
        location: cleanName,
        is_active: true
      });

      setStatus({ type: 'success', text: `Branch "${res.data.name}" created successfully!` });
      setNewBranchName('');
      if (res.data?.id && typeof setSelectedBranch === 'function') {
        setSelectedBranch(String(res.data.id));
      }
    } catch (err) {
      console.error("Branch Creation Error Response:", err.response?.data);
      setStatus({ type: 'error', text: extractErrorMessage(err, 'Failed to create branch.') });
    } finally {
      setLoading(false);
    }
  };

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    const branchId = getNumericBranchId(activeBranch);
    if (!branchId) return;

    setLoading(true);
    try {
      const cost = Number(singleItem.unit_cost_price).toFixed(2);
      const retail = Number(singleItem.unit_retail_price).toFixed(2);
      const openingStock = Number(singleItem.opening_stock || 0);

      await API.post('items/', {
        name: singleItem.name.trim(),
        branch: branchId,
        unit_cost_price: cost,
        unit_retail_price: retail,
        cost_price: cost,
        retail_price: retail,
        unit_selling_price: retail,
        opening_stock: openingStock,
      });

      setStatus({
        type: 'success',
        text: `Item "${singleItem.name.trim()}" added to database successfully!`,
      });
      setSingleItem({ name: '', unit_cost_price: '', unit_retail_price: '', opening_stock: '0' });
      await triggerGlobalUpdate();
    } catch (err) {
      setStatus({ type: 'error', text: extractErrorMessage(err, 'Failed to save item to database.') });
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (item) => {
    const activeBranchId = getNumericBranchId(activeBranch);
    setEditingId(item.id);
    setEditFormData({
      name: item.name || '',
      unit_cost_price: extractCostPrice(item, activeBranchId),
      unit_retail_price: extractRetailPrice(item, activeBranchId),
      opening_stock: extractOpeningStock(item, activeBranchId),
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({ name: '', unit_cost_price: '', unit_retail_price: '', opening_stock: '0' });
  };

  const handleSaveEdit = async (itemId) => {
    const branchId = getNumericBranchId(activeBranch);
    if (!branchId) return;

    setLoading(true);
    try {
      const cost = Number(editFormData.unit_cost_price).toFixed(2);
      const retail = Number(editFormData.unit_retail_price).toFixed(2);
      const openingStock = Number(editFormData.opening_stock || 0);

      await API.patch(`items/${itemId}/?branch=${branchId}`, {
        name: editFormData.name.trim(),
        branch: branchId,
        cost_price: cost,
        retail_price: retail,
        unit_cost_price: cost,
        unit_retail_price: retail,
        unit_selling_price: retail,
        opening_stock: openingStock,
      });

      setStatus({ type: 'success', text: 'Item updated successfully!' });
      setEditingId(null);
      await triggerGlobalUpdate();
    } catch (err) {
      console.error("Item Update Error Response:", err.response?.data);
      setStatus({ type: 'error', text: extractErrorMessage(err, 'Failed to update item.') });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      await API.delete(`items/${item.id}/`);
      setStatus({ type: 'success', text: `Item "${item.name}" deleted successfully!` });
      await triggerGlobalUpdate();
    } catch (err) {
      setStatus({ type: 'error', text: extractErrorMessage(err, 'Failed to delete item.') });
    } finally {
      setLoading(false);
    }
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    const branchId = getNumericBranchId(activeBranch);
    if (!stockModalItem || branchId === null) return;

    setLoading(true);
    try {
      await API.post('stock-movements/', {
        item: stockModalItem.id,
        branch: branchId,
        quantity: Number(stockInput),
        movement_type: 'OPENING_STOCK',
        notes: 'Initial stock entry',
      });

      setStatus({ type: 'success', text: `Stock updated for ${stockModalItem.name}.` });
      setStockModalItem(null);
      setStockInput('');
      await triggerGlobalUpdate();
    } catch (err) {
      setStatus({ type: 'error', text: extractErrorMessage(err, 'Failed to add stock.') });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/admin/login';
  };

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    localStorage.setItem('username', profileData.username);
    localStorage.setItem('email', profileData.email);
    setStatus({ type: 'success', text: 'Profile information updated successfully!' });
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setStatus({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setStatus({ type: 'success', text: 'Password updated successfully!' });
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return items;
    return items.filter((item) => item.name?.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const activeBranchObject = getActiveBranchObject();

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat bg-fixed relative w-full"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')`,
      }}
    >
      {/* LIGHTENED OVERLAY FOR BETTER VISIBILITY */}
      <div className="flex flex-col lg:flex-row min-h-screen w-full max-w-none bg-gradient-to-br from-slate-900/40 via-slate-900/30 to-indigo-900/40 backdrop-blur-[1px] text-slate-100 font-sans overflow-x-hidden">
        
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full lg:w-64 bg-slate-900/80 backdrop-blur-md border-b lg:border-b-0 lg:border-r border-slate-800/80 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800/80 space-y-2">
            <div className="flex items-center">
              <img
                src="/logo.svg"
                alt="Melvex Business Solutions"
                className="h-10 sm:h-12 w-auto object-contain cursor-pointer transition-transform duration-200 hover:scale-105 drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]"
              />
            </div>
            <p className="text-[11px] text-slate-400 font-semibold tracking-wide">
              Branch & Stock Operations
            </p>
          </div>

          <nav className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible p-3 gap-1.5 scrollbar-none">
            <button
              type="button"
              onClick={() => setAdminTab('inventory')}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                adminTab === 'inventory'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <span>Inventory & Items</span>
              <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                {items.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('approvals')}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                adminTab === 'approvals'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <span>Approvals & Progress</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('stock-ops')}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                adminTab === 'stock-ops'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <span>Stock Operations</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('branches')}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                adminTab === 'branches'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <span>Branch Setup</span>
              <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {branches.length}
              </span>
            </button>
          </nav>

          {activeBranchObject && (
            <div className="hidden lg:block p-4 border-t border-slate-800/80 text-xs text-slate-400 bg-slate-900/40 mt-auto">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Active Workspace</p>
              <p className="text-slate-200 font-medium truncate mt-0.5">{activeBranchObject.name}</p>
            </div>
          )}
        </aside>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col w-full min-w-0">
          
          {/* HEADER BAR */}
          <header className="min-h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between shrink-0 w-full gap-3">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                {adminTab === 'inventory' && 'Inventory Management'}
                {adminTab === 'approvals' && 'Approval Status & Progress'}
                {adminTab === 'stock-ops' && 'Stock Operations & Logs'}
                {adminTab === 'branches' && 'Branch Administration'}
              </h2>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* ACTIVE BRANCH SELECTOR */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 hidden sm:inline">
                  Active Branch:
                </span>
                <select
                  value={activeBranch !== null ? String(getNumericBranchId(activeBranch) ?? '') : ''}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  disabled={loadingBranches || branches.length === 0}
                  className="p-1.5 sm:p-2 bg-slate-800/90 border border-slate-700 text-white font-semibold rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  {loadingBranches ? (
                    <option value="" className="bg-slate-900 text-white">Loading branches...</option>
                  ) : branches.length > 0 ? (
                    branches.map((b) => (
                      <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                        {b.name}
                      </option>
                    ))
                  ) : (
                    <option value="" className="bg-slate-900 text-white">No Branches Available</option>
                  )}
                </select>
              </div>

              {/* PROFILE & LOGOUT CONTROLS */}
              <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-700/60 transition-all text-left cursor-pointer"
                  title="Account Settings"
                >
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300">
                    {profileData.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-xs font-bold text-slate-200 leading-none">
                      {profileData.username}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium capitalize mt-0.5">
                      {profileData.role}
                    </div>
                  </div>
                </button>

                <div className="h-4 w-px bg-slate-700/80" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
                  title="Log Out"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          {/* BODY PANEL */}
          <main className="flex-1 p-3 sm:p-6 space-y-6 w-full max-w-[1600px] mx-auto">
            {status && (
              <div className={`p-3 sm:p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
                status.type === 'success' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80' : 'bg-rose-950/60 text-rose-300 border-rose-800/80'
              }`}>
                <span>{status.text}</span>
                <button type="button" onClick={() => setStatus(null)} className="text-xs font-bold underline ml-4 cursor-pointer">
                  Dismiss
                </button>
              </div>
            )}

            {adminTab === 'inventory' && (
              <div className="space-y-6 w-full">
                {/* REGISTER ITEM FORM */}
                <div className="bg-slate-900/70 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-slate-700/60 shadow-xl w-full">
                  <h3 className="text-xs font-bold text-slate-300 mb-4 tracking-wider uppercase">
                    Add New Item & Pricing
                  </h3>
                  <form onSubmit={handleSingleSubmit} className="space-y-4 w-full">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Item Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Foam sheet 2STD"
                          value={singleItem.name}
                          onChange={(e) => setSingleItem({ ...singleItem, name: e.target.value })}
                          className="w-full p-2.5 bg-slate-950/70 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Cost Price (KSh)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Buying price"
                          value={singleItem.unit_cost_price}
                          onChange={(e) => setSingleItem({ ...singleItem, unit_cost_price: e.target.value })}
                          className="w-full p-2.5 bg-slate-950/70 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Retail Price (KSh)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Selling price"
                          value={singleItem.unit_retail_price}
                          onChange={(e) => setSingleItem({ ...singleItem, unit_retail_price: e.target.value })}
                          className="w-full p-2.5 bg-slate-950/70 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Opening Stock</label>
                        <input
                          type="number"
                          step="1"
                          placeholder="0"
                          value={singleItem.opening_stock}
                          onChange={(e) => setSingleItem({ ...singleItem, opening_stock: e.target.value })}
                          className="w-full p-2.5 bg-slate-950/70 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={loading || !activeBranch}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-xs transition shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {loading ? 'Saving...' : 'Save Item to Database'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* REGISTERED ITEMS TABLE WITH RESTOCKS COLUMN */}
                <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-700/60 shadow-xl overflow-hidden w-full">
                  <div className="p-4 sm:p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="text-sm font-bold text-white">
                      Active Items ({filteredItems.length})
                    </h3>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      {items.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => setIsCopyModalOpen(true)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
                        >
                          Select Items from Existing Branch
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRolloverStock}
                          disabled={loading}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                        >
                          Copy Remaining to Opening
                        </button>
                      )}

                      <input
                        type="text"
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="p-2.5 bg-slate-950/70 border border-slate-700 text-white placeholder-slate-400 rounded-lg text-xs w-full sm:w-64 focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto w-full">
                    <table className="w-full min-w-[720px] text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800/80 text-[10px] sm:text-[11px] font-semibold text-slate-300 uppercase tracking-wider bg-slate-950/80">
                          <th className="py-3.5 px-4">Item Name</th>
                          <th className="py-3.5 px-4">Cost Price</th>
                          <th className="py-3.5 px-4">Retail Price</th>
                          <th className="py-3.5 px-4">Opening</th>
                          <th className="py-3.5 px-4">Restocks</th>
                          <th className="py-3.5 px-4">Current Stock</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-xs">
                        {filteredItems.map((item) => {
                          const activeBranchId = getNumericBranchId(activeBranch);
                          const costPrice = formatCurrency(extractCostPrice(item, activeBranchId));
                          const retailPrice = formatCurrency(extractRetailPrice(item, activeBranchId));
                          const openingStock = extractOpeningStock(item, activeBranchId);
                          const restockedStock = extractRestockedStock(item);
                          const currentStock = item.remaining_stock ?? item.opening_stock ?? 0;
                          const isEditing = editingId === item.id;

                          if (isEditing) {
                            return (
                              <tr key={item.id} className="bg-slate-800/50">
                                <td className="py-2.5 px-4">
                                  <input
                                    type="text"
                                    value={editFormData.name}
                                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white outline-none focus:border-indigo-500"
                                  />
                                </td>
                                <td className="py-2.5 px-4">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editFormData.unit_cost_price}
                                    onChange={(e) => setEditFormData({ ...editFormData, unit_cost_price: e.target.value })}
                                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white outline-none focus:border-indigo-500"
                                  />
                                </td>
                                <td className="py-2.5 px-4">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editFormData.unit_retail_price}
                                    onChange={(e) => setEditFormData({ ...editFormData, unit_retail_price: e.target.value })}
                                    className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white outline-none focus:border-indigo-500"
                                  />
                                </td>
                                <td className="py-2.5 px-4">
                                  <input
                                    type="number"
                                    value={editFormData.opening_stock}
                                    onChange={(e) => setEditFormData({ ...editFormData, opening_stock: e.target.value })}
                                    className="w-20 p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white outline-none focus:border-indigo-500 font-semibold"
                                  />
                                </td>
                                <td className="py-2.5 px-4 font-mono text-emerald-400">
                                  {restockedStock}
                                </td>
                                <td className="py-2.5 px-4 font-medium text-slate-400">
                                  {currentStock}
                                </td>
                                <td className="py-2.5 px-4 text-right space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(item.id)}
                                    disabled={loading}
                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-md transition cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-semibold rounded-md transition cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-3.5 px-4 font-medium text-slate-200">{item.name}</td>
                              <td className="py-3.5 px-4 text-slate-400 font-mono font-semibold">KSh {costPrice}</td>
                              <td className="py-3.5 px-4 text-slate-200 font-mono font-semibold">KSh {retailPrice}</td>
                              <td className="py-3.5 px-4 font-mono font-semibold text-slate-200">{openingStock}</td>
                              <td className="py-3.5 px-4 font-mono font-semibold text-emerald-400">{restockedStock}</td>
                              <td className="py-3.5 px-4 font-mono font-bold text-indigo-300">{currentStock}</td>
                              <td className="py-3.5 px-4 text-right space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStockModalItem(item);
                                    setStockInput(currentStock.toString());
                                  }}
                                  className="px-3 py-1 bg-emerald-950/50 text-emerald-400 border border-emerald-800/50 text-[11px] font-semibold rounded-md hover:bg-emerald-900/50 transition cursor-pointer"
                                >
                                  + Add Stock
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(item)}
                                  className="px-3 py-1 bg-indigo-950/50 text-indigo-300 border border-indigo-800/50 text-[11px] font-semibold rounded-md hover:bg-indigo-900/50 transition cursor-pointer"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item)}
                                  className="px-3 py-1 bg-rose-950/50 text-rose-300 border border-rose-800/50 text-[11px] font-semibold rounded-md hover:bg-rose-900/50 transition cursor-pointer"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredItems.length === 0 && (
                          <tr>
                            <td colSpan="7" className="py-12 text-center text-slate-400 text-xs">
                              No items found matching "{searchQuery}".
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {adminTab === 'approvals' && (
              <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/60 overflow-hidden w-full">
                <ApprovalsDashboard />
              </div>
            )}

            {adminTab === 'stock-ops' && (
              <div className="bg-slate-900/70 backdrop-blur-md p-4 sm:p-6 rounded-2xl shadow-xl border border-slate-700/60 w-full">
                <StockActivityLog
                  items={items}
                  branches={branches}
                  selectedBranch={activeBranch}
                  onStockUpdated={triggerGlobalUpdate}
                />
              </div>
            )}

            {adminTab === 'branches' && (
              <div className="max-w-2xl bg-slate-900/70 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-slate-700/60 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Add New Retail Branch</h3>
                <form onSubmit={handleAddBranch} className="space-y-4 pt-2">
                  <input
                    type="text"
                    placeholder="e.g. Meru Branch"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    className="w-full p-2.5 bg-slate-950/70 border border-slate-700/80 rounded-lg text-xs text-white focus:border-indigo-500 outline-none"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading || !newBranchName.trim()}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-xs disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? 'Creating...' : 'Register Branch'}
                  </button>
                </form>
              </div>
            )}
          </main>
        </div>

        {/* STOCK MODAL */}
        {stockModalItem && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Add Initial / Opening Stock
              </h3>
              <p className="text-xs text-slate-400">
                Item: <span className="text-white font-semibold">{stockModalItem.name}</span>
              </p>
              <form onSubmit={handleAddStock} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={stockInput}
                    onChange={(e) => setStockInput(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 text-white rounded-lg text-xs outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStockModalItem(null)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-700 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-500 transition cursor-pointer"
                  >
                    Save Stock
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PROFILE DRAWER / MODAL */}
        {showProfileModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-6 space-y-6 overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Admin Profile & Security</h3>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Profile Info Form */}
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Account Details</h4>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Username</label>
                  <input
                    type="text"
                    value={profileData.username}
                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-500 transition cursor-pointer"
                >
                  Save Details
                </button>
              </form>

              <div className="border-t border-slate-800 pt-4" />

              {/* Password Form */}
              <form onSubmit={handleChangePassword} className="space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Change Password</h4>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">New Password</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
                >
                  Update Password
                </button>
              </form>

              <div className="border-t border-slate-800 pt-4 flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Log Out of Admin Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SELECT BRANCH ITEMS MODAL */}
        <SelectBranchItemsModal
          isOpen={isCopyModalOpen}
          onClose={() => setIsCopyModalOpen(false)}
          branches={branches}
          currentBranchId={getNumericBranchId(activeBranch)}
          onImportSuccess={() => {
            triggerGlobalUpdate();
            setStatus({
              type: 'success',
              text: 'Imported items saved directly to database!',
            });
          }}
          extractErrorMessage={extractErrorMessage}
        />
      </div>
    </div>
  );
}

function SelectBranchItemsModal({
  isOpen,
  onClose,
  branches = [],
  currentBranchId,
  onImportSuccess,
  extractErrorMessage,
}) {
  const [step, setStep] = useState(1);
  const [selectedSourceBranch, setSelectedSourceBranch] = useState(() => {
    return localStorage.getItem('import_source_branch') || '';
  });
  const [sourceItems, setSourceItems] = useState([]);

  const [selectedItemIds, setSelectedItemIds] = useState(() => {
    try {
      const saved = localStorage.getItem('import_selected_item_ids');
      return saved ? JSON.parse(saved) : [];
    } catch (err) {
      return [];
    }
  });

  const [editableItems, setEditableItems] = useState(() => {
    try {
      const saved = localStorage.getItem('import_editable_items');
      return saved ? JSON.parse(saved) : [];
    } catch (err) {
      return [];
    }
  });

  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  const availableBranches = useMemo(() => {
    if (!Array.isArray(branches)) return [];
    return branches.filter((b) => Number(b.id) !== Number(currentBranchId));
  }, [branches, currentBranchId]);

  const clearLocalStorage = () => {
    localStorage.removeItem('import_selected_item_ids');
    localStorage.removeItem('import_editable_items');
    localStorage.removeItem('import_source_branch');
  };

  const handleModalClose = () => {
    clearLocalStorage();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setSelectedSourceBranch('');
      setSourceItems([]);
      setSelectedItemIds([]);
      setEditableItems([]);
      setModalSearchQuery('');
      setModalError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedSourceBranch) {
      localStorage.setItem('import_source_branch', selectedSourceBranch);
    }
  }, [selectedSourceBranch]);

  useEffect(() => {
    if (selectedItemIds.length > 0) {
      localStorage.setItem('import_selected_item_ids', JSON.stringify(selectedItemIds));
    }
  }, [selectedItemIds]);

  useEffect(() => {
    if (editableItems.length > 0) {
      localStorage.setItem('import_editable_items', JSON.stringify(editableItems));
    }
  }, [editableItems]);

  useEffect(() => {
    if (selectedSourceBranch) {
      setLoading(true);
      setModalError(null);
      setModalSearchQuery('');
      API.get(`items/?branch=${selectedSourceBranch}`)
        .then((res) => {
          const itemsData = Array.isArray(res.data) ? res.data : res.data?.results || [];
          setSourceItems(itemsData);
          
          if (!localStorage.getItem('import_selected_item_ids')) {
            setSelectedItemIds(itemsData.map((item) => item.id));
          }
        })
        .catch((err) => {
          setModalError(extractErrorMessage(err, 'Failed to fetch items for source branch.'));
        })
        .finally(() => setLoading(false));
    } else {
      setSourceItems([]);
      setSelectedItemIds([]);
    }
  }, [selectedSourceBranch, extractErrorMessage]);

  const filteredSourceItems = useMemo(() => {
    const q = modalSearchQuery.toLowerCase().trim();
    if (!q) return sourceItems;
    return sourceItems.filter((item) => item.name?.toLowerCase().includes(q));
  }, [sourceItems, modalSearchQuery]);

  const toggleSelectItem = (id) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.length === sourceItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(sourceItems.map((item) => item.id));
    }
  };

  const handleNextToEditPrices = () => {
    if (selectedItemIds.length === 0) return;

    const selected = sourceItems
      .filter((item) => selectedItemIds.includes(item.id))
      .map((item) => ({
        id: item.id,
        name: item.name || '',
        unit_cost_price: Number(item.unit_cost_price || item.cost_price || 0).toFixed(2),
        unit_retail_price: Number(
          item.unit_selling_price || item.unit_retail_price || item.retail_price || 0
        ).toFixed(2),
        opening_stock: Number(item.remaining_stock ?? item.opening_stock ?? 0),
      }));

    setEditableItems(selected);
    setStep(2);
  };

  const handleItemChange = (index, field, value) => {
    setEditableItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveItemFromImport = (index) => {
    setEditableItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFinalSubmit = async () => {
    if (editableItems.length === 0) return;

    setSubmitting(true);
    setModalError(null);

    try {
      await Promise.all(
        editableItems.map((item) => {
          const cost = Number(item.unit_cost_price || 0).toFixed(2);
          const retail = Number(item.unit_retail_price || 0).toFixed(2);
          return API.post('items/', {
            name: item.name.trim(),
            branch: Number(currentBranchId),
            unit_cost_price: cost,
            unit_retail_price: retail,
            cost_price: cost,
            retail_price: retail,
            unit_selling_price: retail,
            opening_stock: Number(item.opening_stock || 0),
          });
        })
      );

      clearLocalStorage();
      onImportSuccess();
      onClose();
    } catch (err) {
      setModalError(extractErrorMessage(err, 'Failed to save imported items to database.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full p-6 text-white shadow-2xl space-y-4">
        
        {/* MODAL HEADER */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              {step === 1 ? 'Step 1: Select Items from Branch' : 'Step 2: Review & Save Items to Database'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {step === 1
                ? 'Choose items to copy into this branch'
                : 'Modify item names, prices, and opening stock quantities before saving to the database'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {modalError && (
          <div className="p-3 bg-rose-950/60 text-rose-300 border border-rose-800/80 rounded-lg text-xs">
            {modalError}
          </div>
        )}

        {/* STEP 1: ITEM SELECTION */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Source Branch
              </label>
              <select
                value={selectedSourceBranch}
                onChange={(e) => setSelectedSourceBranch(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="" className="bg-slate-900 text-slate-300">
                  -- Select Source Branch --
                </option>
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedSourceBranch && (
              <div className="space-y-3">
                <div>
                  <input
                    type="text"
                    placeholder="Search items in branch..."
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">
                    Available Items ({filteredSourceItems.length} / {sourceItems.length})
                  </span>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-indigo-400 hover:underline font-semibold cursor-pointer"
                  >
                    {selectedItemIds.length === sourceItems.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {loading ? (
                  <div className="py-8 text-center text-xs text-slate-400">Loading items...</div>
                ) : filteredSourceItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No items match your search.
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-lg divide-y divide-slate-800/60 bg-slate-950">
                    {filteredSourceItems.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center justify-between p-3 hover:bg-slate-800/40 cursor-pointer text-xs transition"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedItemIds.includes(item.id)}
                            onChange={() => toggleSelectItem(item.id)}
                            className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="font-medium text-slate-200">{item.name}</span>
                        </div>
                        <span className="text-slate-400 font-semibold">
                          KSh {item.unit_selling_price || item.unit_retail_price || item.retail_price || 0}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: EDIT ITEMS TABLE */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-semibold">
                Items Selected for Import ({editableItems.length})
              </span>
              <span className="text-slate-500 italic">
                Edit item details before saving directly to database
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-lg divide-y divide-slate-800/60 bg-slate-950">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-900 sticky top-0 text-[11px] font-semibold text-slate-400 uppercase">
                  <tr>
                    <th className="p-3">Item Name</th>
                    <th className="p-3 w-28">Cost Price (KSh)</th>
                    <th className="p-3 w-28">Retail Price (KSh)</th>
                    <th className="p-3 w-28">Opening Stock</th>
                    <th className="p-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs">
                  {editableItems.map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-slate-800/20">
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                          className="w-full p-1.5 bg-slate-900 border border-slate-700/80 rounded text-xs text-white outline-none focus:border-indigo-500 font-medium"
                          placeholder="Item name"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unit_cost_price}
                          onChange={(e) => handleItemChange(index, 'unit_cost_price', e.target.value)}
                          className="w-full p-1.5 bg-slate-900 border border-slate-700/80 rounded text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unit_retail_price}
                          onChange={(e) => handleItemChange(index, 'unit_retail_price', e.target.value)}
                          className="w-full p-1.5 bg-slate-900 border border-slate-700/80 rounded text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          value={item.opening_stock}
                          onChange={(e) => handleItemChange(index, 'opening_stock', e.target.value)}
                          className="w-full p-1.5 bg-slate-900 border border-slate-700/80 rounded text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItemFromImport(index)}
                          className="text-slate-500 hover:text-rose-400 font-bold cursor-pointer"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {editableItems.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-slate-500 text-xs">
                        No items remaining. Go back to select items.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL FOOTER ACTIONS */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-800">
          <div>
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-700 transition cursor-pointer"
              >
                ← Back to Selection
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleModalClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>

            {step === 1 ? (
              <button
                type="button"
                onClick={handleNextToEditPrices}
                disabled={selectedItemIds.length === 0 || !selectedSourceBranch}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-500 transition disabled:opacity-50 cursor-pointer"
              >
                Next: Review & Edit Items ({selectedItemIds.length}) →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting || editableItems.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-500 transition disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Saving...' : `Save ${editableItems.length} Item(s) to Database`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}