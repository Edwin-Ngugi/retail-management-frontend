// src/components/ApprovalsDashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import API from '../api';

export default function ApprovalsDashboard({ selectedBranch, onApprovalComplete }) {
  const [requests, setRequests] = useState([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [activeStatus, setActiveStatus] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Hidden Request IDs (Stored in localStorage)
  const [hiddenRequestIds, setHiddenRequestIds] = useState(() => {
    try {
      const saved = localStorage.getItem('hidden_approval_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [showHidden, setShowHidden] = useState(false);

  // Edit Modal State
  const [editingRequest, setEditingRequest] = useState(null);
  const [editPayloadItems, setEditPayloadItems] = useState([]);
  const [editRequestType, setEditRequestType] = useState('NEW_REGISTERED_ITEMS');
  const [editTargetBranch, setEditTargetBranch] = useState('');
  const [editMessage, setEditMessage] = useState('');

  // Persist hidden request IDs
  useEffect(() => {
    try {
      localStorage.setItem('hidden_approval_ids', JSON.stringify(hiddenRequestIds));
    } catch (e) {
      console.warn('Failed to save hidden request IDs to localStorage:', e);
    }
  }, [hiddenRequestIds]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('pending-approvals/');
      setRequests(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Hide Request Locally
  const handleHideRequest = (e, id) => {
    e.stopPropagation();
    setHiddenRequestIds((prev) => [...new Set([...prev, id])]);
  };

  // Unhide Request Locally
  const handleUnhideRequest = (e, id) => {
    e.stopPropagation();
    setHiddenRequestIds((prev) => prev.filter((hiddenId) => hiddenId !== id));
  };

  // Restore All Hidden Requests
  const handleUnhideAll = () => {
    setHiddenRequestIds([]);
  };

  // Compute Metrics
  const metrics = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'PENDING').length;
    const approved = requests.filter((r) => r.status === 'APPROVED').length;
    const rejected = requests.filter((r) => r.status === 'REJECTED').length;
    return { total, pending, approved, rejected };
  }, [requests]);

  // Filter requests by status, category, and hidden visibility
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const isHidden = hiddenRequestIds.includes(req.id);
      if (!showHidden && isHidden) return false;

      const matchesStatus = activeStatus === 'ALL' || req.status === activeStatus;
      const matchesCategory = activeCategory === 'ALL' || req.request_type === activeCategory;
      return matchesStatus && matchesCategory;
    });
  }, [requests, activeStatus, activeCategory, hiddenRequestIds, showHidden]);

  const categories = [
    { id: 'ALL', label: 'All Categories' },
    { id: 'SALE_ENTRY', label: 'Sales & Discounts' },
    { id: 'NEW_REGISTERED_ITEMS', label: 'Item Registrations' },
    { id: 'BRANCH_CREATION', label: 'Branch Requests' },
    { id: 'STOCK_ADJUSTMENT', label: 'Stock Adjustments' },
  ];

  const getCategoryInfo = (type) => {
    const key = String(type || '').toUpperCase();
    switch (key) {
      case 'NEW_REGISTERED_ITEMS':
      case 'NEW_ITEMS':
        return { label: 'ITEM REGISTRATION', style: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'SALE_ENTRY':
      case 'DISCOUNT_APPROVAL':
      case 'PRICE_QUERY':
        return { label: 'SALES & DISCOUNTS', style: 'bg-sky-100 text-sky-800 border-sky-300' };
      case 'BRANCH_CREATION':
        return { label: 'BRANCH CREATION', style: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'STOCK_ADJUSTMENT':
      case 'STOCK_OVERRIDE':
        return { label: 'STOCK OVERRIDE', style: 'bg-amber-100 text-amber-800 border-amber-300' };
      default:
        return { label: key.replace(/_/g, ' '), style: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
    }
  };

  // Delete Request
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this approval request?')) return;
    setActionLoading(id);
    try {
      await API.delete(`pending-approvals/${id}/`);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert('Failed to delete approval request: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  // Resend Request
  const handleResend = async (req) => {
    setActionLoading(req.id);
    try {
      await API.post(`pending-approvals/${req.id}/resend/`);
      alert('Request resent to management successfully!');
      fetchRequests();
    } catch (err) {
      alert('Failed to resend request: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (req) => {
    setEditingRequest(req);
    setEditRequestType(req.request_type || 'NEW_REGISTERED_ITEMS');
    setEditTargetBranch(req.payload?.target_branch || req.payload?.branch_id || '');
    setEditMessage(req.payload?.message || '');
    const items = req.payload?.items || req.payload?.cart_summary || [];
    setEditPayloadItems(JSON.parse(JSON.stringify(items)));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...editPayloadItems];
    updated[index][field] = value;
    setEditPayloadItems(updated);
  };

  const handleAddItem = () => {
    setEditPayloadItems((prev) => [
      ...prev,
      { name: '', unit_cost_price: '0.00', unit_retail_price: '0.00', opening_stock: 0 },
    ]);
  };

  const handleRemoveItem = (index) => {
    setEditPayloadItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveAndResend = async () => {
    if (!editingRequest) return;
    setActionLoading(editingRequest.id);

    const validRequestType = ['NEW_REGISTERED_ITEMS', 'SALE_ENTRY', 'BRANCH_CREATION'].includes(editRequestType)
      ? editRequestType
      : 'SALE_ENTRY';

    const updatedPayload = {
      ...editingRequest.payload,
      target_branch: editTargetBranch || selectedBranch || editingRequest.payload?.target_branch,
      message: editMessage,
      items: editPayloadItems,
      cart_summary: editPayloadItems,
    };

    try {
      await API.patch(`pending-approvals/${editingRequest.id}/`, {
        request_type: validRequestType,
        payload: updatedPayload,
        status: 'PENDING',
      });
      alert('Request updated and resent to management!');
      setEditingRequest(null);
      fetchRequests();
    } catch (err) {
      alert('Failed to save and resend: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await API.post(`pending-approvals/${id}/approve/`);
      alert('Request approved successfully!');
      if (onApprovalComplete) onApprovalComplete();
      fetchRequests();
    } catch (err) {
      alert('Approval failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Enter rejection reason for submitter:');
    if (reason === null) return;

    setActionLoading(id);
    try {
      await API.post(`pending-approvals/${id}/reject/`, { reason });
      alert('Request marked as REJECTED.');
      fetchRequests();
    } catch (err) {
      alert('Rejection failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-300 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-wide flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-indigo-600 shadow-sm"></span>
            Management Approvals & Requests Portal
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Track authorization status for special discounts, stock overrides, and item registrations.
          </p>
        </div>

        <button
          onClick={fetchRequests}
          disabled={loading}
          className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : '🔄 Refresh Data'}
        </button>
      </div>

      {/* EXECUTIVE KPI METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Total Submissions</span>
          <span className="text-2xl font-extrabold text-slate-900">{metrics.total}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-300 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-1">Pending Review</span>
          <span className="text-2xl font-extrabold text-amber-700">{metrics.pending}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-300 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">Approved & Committed</span>
          <span className="text-2xl font-extrabold text-emerald-700">{metrics.approved}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-rose-300 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block mb-1">Rejected</span>
          <span className="text-2xl font-extrabold text-rose-700">{metrics.rejected}</span>
        </div>
      </div>

      {/* CATEGORY & STATUS FILTER TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-300 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {hiddenRequestIds.length > 0 && (
            <button
              onClick={() => setShowHidden((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                showHidden
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              👁️ {showHidden ? 'Hide Hidden' : `Show Hidden (${hiddenRequestIds.length})`}
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

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-medium">Status Filter:</span>
            <select
              value={activeStatus}
              onChange={(e) => setActiveStatus(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-900 text-xs font-semibold rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* REQUEST LISTING CARD STREAM */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-300 text-xs text-slate-500 font-medium shadow-sm">
            No approval requests matching the current filter set.
          </div>
        ) : (
          filteredRequests.map((req) => {
            const isExpanded = expandedId === req.id;
            const isHidden = hiddenRequestIds.includes(req.id);
            const payload = req.payload || {};
            const items = payload.items || payload.cart_summary || [];
            const totalItems = items.length;
            const reqType = req.request_type || 'NEW_REGISTERED_ITEMS';
            const categoryBadge = getCategoryInfo(reqType);
            const status = req.status?.toUpperCase() || 'PENDING';
            const isPendingOrRejected = status.includes('PENDING') || status.includes('REJECTED');

            return (
              <div
                key={req.id}
                className={`border rounded-xl overflow-hidden transition-all duration-200 shadow-sm ${
                  isHidden
                    ? 'bg-slate-50 border-slate-200 opacity-60'
                    : 'bg-white border-slate-300 hover:border-slate-400'
                }`}
              >
                <div
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-300">
                      #{req.id?.toString().substring(0, 8) || req.id}
                    </span>

                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide border ${categoryBadge.style}`}>
                      {categoryBadge.label}
                    </span>

                    {payload.message && (
                      <span className="text-xs text-slate-700 font-medium truncate max-w-xs hidden md:inline">
                        "{payload.message}"
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                      Submitted: {req.created_at ? new Date(req.created_at).toLocaleDateString() : 'Today'}
                    </span>

                    <span
                      className={`px-3 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase transition-all border ${
                        status.includes('APPROVED')
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : status.includes('REJECTED')
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                      }`}
                    >
                      {status}
                    </span>

                    {/* DISMISS / HIDE FROM SCREEN BUTTON */}
                    {isHidden ? (
                      <button
                        onClick={(e) => handleUnhideRequest(e, req.id)}
                        className="p-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-slate-100 rounded-md cursor-pointer transition"
                        title="Unhide from screen"
                      >
                        👁️ Unhide
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleHideRequest(e, req.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer transition"
                        title="Remove from screen (Keep in Database)"
                      >
                        ✕
                      </button>
                    )}

                    <button className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1 rounded bg-slate-100 border border-slate-300 cursor-pointer font-semibold">
                      {isExpanded ? 'Hide Details ▲' : 'View Details ▼'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-4">
                    <div className="flex flex-wrap justify-between items-center text-xs text-slate-600 font-semibold gap-2">
                      <span>Submitted Items ({totalItems})</span>
                      
                      <div className="flex items-center gap-2">
                        {isPendingOrRejected && (
                          <>
                            <button
                              onClick={() => handleResend(req)}
                              disabled={actionLoading === req.id}
                              className="px-3 py-1 bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-semibold rounded-lg border border-sky-300 transition cursor-pointer"
                            >
                               Resend
                            </button>

                            <button
                              onClick={() => handleOpenEdit(req)}
                              disabled={actionLoading === req.id}
                              className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-semibold rounded-lg border border-amber-300 transition cursor-pointer"
                            >
                               Edit & Resend
                            </button>

                            <button
                              onClick={() => handleDelete(req.id)}
                              disabled={actionLoading === req.id}
                              className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold rounded-lg border border-rose-300 transition cursor-pointer"
                            >
                               Delete
                            </button>
                          </>
                        )}

                        {status.includes('PENDING') && (
                          <>
                            <button
                              onClick={() => handleApprove(req.id)}
                              disabled={actionLoading === req.id}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-sm"
                            >
                              ✅ Approve
                            </button>

                            <button
                              onClick={() => handleReject(req.id)}
                              disabled={actionLoading === req.id}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-sm"
                            >
                              ❌ Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {payload.message && (
                      <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-medium">
                        <strong className="text-slate-500">Request Details / Notes:</strong> {payload.message}
                      </div>
                    )}

                    {req.rejection_reason && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                        <strong>Management Rejection Reason:</strong> {req.rejection_reason}
                      </div>
                    )}

                    {items.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                            <tr>
                              <th className="py-3 px-4">Item Name</th>
                              <th className="py-3 px-4 text-right">Cost Price</th>
                              <th className="py-3 px-4 text-right">Retail / Sale Price</th>
                              <th className="py-3 px-4 text-right">Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-800">
                            {items.map((item, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="py-2.5 px-4 font-medium text-slate-900">{item.name || `Item #${item.item_id}`}</td>
                                <td className="py-2.5 px-4 text-right text-slate-600">KSh {item.unit_cost_price || 0}</td>
                                <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">KSh {item.unit_retail_price || item.unit_selling_price || 0}</td>
                                <td className="py-2.5 px-4 text-right text-slate-900 font-bold">{item.opening_stock ?? item.quantity ?? 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic p-2">
                        No line items attached to this request.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* EDIT & RESEND MODAL */}
      {editingRequest && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl relative text-slate-900">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Edit & Resend Request #{editingRequest.id}
              </h3>
              <button
                onClick={() => setEditingRequest(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 block mb-1 font-medium">Request Type</label>
                <select
                  value={editRequestType}
                  onChange={(e) => setEditRequestType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                >
                  <option value="DISCOUNT_APPROVAL">Discount Approval</option>
                  <option value="STOCK_OVERRIDE">Stock Limit Override</option>
                  <option value="NEW_REGISTERED_ITEMS">New Registered Items</option>
                  <option value="SALE_ENTRY">Sale Entry</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1 font-semibold">Message / Details</label>
                <input
                  type="text"
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  placeholder="e.g. Customer requests discount"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600 font-semibold">Request Items</span>
                <button
                  onClick={handleAddItem}
                  className="px-2.5 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-lg border border-indigo-300 hover:bg-indigo-200 cursor-pointer font-semibold"
                >
                  + Add Item
                </button>
              </div>

              {editPayloadItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 items-center">
                  <div className="sm:col-span-4">
                    <label className="text-[10px] text-slate-500 block mb-1">Item Name</label>
                    <input
                      type="text"
                      value={item.name || ''}
                      onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-500 block mb-1">Cost Price</label>
                    <input
                      type="text"
                      value={item.unit_cost_price || ''}
                      onChange={(e) => handleItemChange(idx, 'unit_cost_price', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-500 block mb-1">Retail Price</label>
                    <input
                      type="text"
                      value={item.unit_retail_price || item.unit_selling_price || ''}
                      onChange={(e) => handleItemChange(idx, 'unit_retail_price', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-[10px] text-slate-500 block mb-1">Quantity / Stock</label>
                    <input
                      type="number"
                      value={item.opening_stock ?? item.quantity ?? 0}
                      onChange={(e) => handleItemChange(idx, 'opening_stock', parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900"
                    />
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="text-rose-600 hover:text-rose-800 text-xs p-1 cursor-pointer"
                    >
                      
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                onClick={() => setEditingRequest(null)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAndResend}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm"
              >
                Save & Resend
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}