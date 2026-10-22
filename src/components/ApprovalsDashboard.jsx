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
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setRequests(data);
      if (data.length > 0 && !expandedId) {
        setExpandedId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  }, [expandedId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

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

  const metrics = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'PENDING').length;
    const approved = requests.filter((r) => r.status === 'APPROVED').length;
    const rejected = requests.filter((r) => r.status === 'REJECTED').length;
    return { total, pending, approved, rejected };
  }, [requests]);

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
    { id: 'PRICE_QUERY', label: 'Price Queries' },
    { id: 'NEW_REGISTERED_ITEMS', label: 'Item Registrations' },
    { id: 'BRANCH_CREATION', label: 'Branch Requests' },
    { id: 'STOCK_ADJUSTMENT', label: 'Stock Adjustments' },
  ];

  const getCategoryInfo = (type) => {
    const key = String(type || '').toUpperCase();
    switch (key) {
      case 'NEW_REGISTERED_ITEMS':
      case 'NEW_ITEMS':
        return { label: 'ITEM REGISTRATION', style: 'bg-teal-50 text-teal-800 border-teal-200' };
      case 'SALE_ENTRY':
      case 'DISCOUNT_APPROVAL':
      case 'PRICE_QUERY':
        return { label: 'SALES & DISCOUNTS', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'BRANCH_CREATION':
        return { label: 'BRANCH CREATION', style: 'bg-teal-100 text-teal-900 border-teal-300' };
      case 'STOCK_ADJUSTMENT':
      case 'STOCK_OVERRIDE':
        return { label: 'STOCK OVERRIDE', style: 'bg-amber-50 text-amber-800 border-amber-200' };
      default:
        return { label: key.replace(/_/g, ' '), style: 'bg-teal-50 text-teal-800 border-teal-200' };
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this approval request?')) return;
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

  const handleResend = async (req) => {
    setActionLoading(req.id);
    try {
      await API.post(`pending-approvals/${req.id}/resend/`);
      alert('Request resent successfully!');
      fetchRequests();
    } catch (err) {
      alert('Failed to resend request: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(null);
    }
  };

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
      { name: '', unit_cost_price: '0.00', unit_retail_price: '0.00', quantity: 1 },
    ]);
  };

  const handleRemoveItem = (index) => {
    setEditPayloadItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveAndResend = async () => {
    if (!editingRequest) return;
    setActionLoading(editingRequest.id);

    const validRequestType = ['NEW_REGISTERED_ITEMS', 'SALE_ENTRY', 'BRANCH_CREATION', 'PRICE_QUERY'].includes(editRequestType)
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

  const toNumber = (val) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <div className="space-y-5 text-slate-800 font-sans max-w-7xl mx-auto">
      {/* TOP HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-teal-900 text-white p-5 rounded-2xl border border-teal-800 shadow-md">
        <div>
          <h1 className="text-lg font-black tracking-tight flex items-center gap-2 text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-300"></span>
            Management Approvals & Requests Portal
          </h1>
          <p className="text-xs text-teal-100/80 mt-0.5">
            Authorize price check queries, sales discounts, stock overrides, and item registrations.
          </p>
        </div>

        <button
          onClick={fetchRequests}
          disabled={loading}
          className="px-3.5 py-1.5 bg-teal-950 hover:bg-black text-teal-100 hover:text-white text-xs font-bold rounded-xl border border-teal-700/60 transition cursor-pointer shadow-xs disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-teal-100 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 block mb-1">TOTAL SUBMISSIONS</span>
          <span className="text-2xl font-black text-teal-950">{metrics.total}</span>
        </div>
        <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/80 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block mb-1">PENDING REVIEW</span>
          <span className="text-2xl font-black text-amber-900">{metrics.pending}</span>
        </div>
        <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/80 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block mb-1">APPROVED</span>
          <span className="text-2xl font-black text-emerald-900">{metrics.approved}</span>
        </div>
        <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-200/80 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 block mb-1">REJECTED</span>
          <span className="text-2xl font-black text-rose-900">{metrics.rejected}</span>
        </div>
      </div>

      {/* CATEGORY & STATUS FILTER TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-teal-100 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-teal-800 text-white shadow-xs'
                  : 'text-teal-900 hover:bg-teal-50'
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
              className="px-3 py-1 rounded-lg text-xs font-bold border border-teal-200 bg-teal-50/50 text-teal-900 hover:bg-teal-100 transition cursor-pointer"
            >
              {showHidden ? 'Hide Hidden' : `Show Hidden (${hiddenRequestIds.length})`}
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-teal-900 font-bold uppercase text-[10px]">Status:</span>
            <select
              value={activeStatus}
              onChange={(e) => setActiveStatus(e.target.value)}
              className="bg-teal-50/60 border border-teal-200 text-teal-950 text-xs font-bold rounded-lg px-2.5 py-1 outline-none cursor-pointer"
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
          <div className="p-10 text-center bg-white rounded-2xl border border-teal-100 text-xs text-teal-800 font-bold shadow-xs">
            No approval requests matching the selected filter.
          </div>
        ) : (
          filteredRequests.map((req) => {
            const isExpanded = expandedId === req.id;
            const isHidden = hiddenRequestIds.includes(req.id);
            const payload = req.payload || {};
            const items = payload.items || payload.cart_summary || [];
            const reqType = req.request_type || 'NEW_REGISTERED_ITEMS';
            const categoryBadge = getCategoryInfo(reqType);
            const status = req.status?.toUpperCase() || 'PENDING';
            const isPendingOrRejected = status.includes('PENDING') || status.includes('REJECTED');

            return (
              <div
                key={req.id}
                className={`border rounded-xl transition-all shadow-xs ${
                  isHidden
                    ? 'bg-slate-50 border-slate-200 opacity-60'
                    : 'bg-white border-teal-100 hover:border-teal-300'
                }`}
              >
                {/* HEADER ROW */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none hover:bg-teal-50/30"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-mono font-bold text-teal-950 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      #{req.id?.toString().substring(0, 8) || req.id}
                    </span>

                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black tracking-wide uppercase border ${categoryBadge.style}`}>
                      {categoryBadge.label}
                    </span>

                    {payload.message && (
                      <span className="text-xs text-slate-700 font-bold truncate max-w-sm hidden sm:inline">
                        "{payload.message}"
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400 font-medium hidden md:inline">
                      Submitted: {req.created_at ? new Date(req.created_at).toLocaleString() : 'Today'}
                    </span>

                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase border ${
                        status.includes('APPROVED')
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : status.includes('REJECTED')
                          ? 'bg-rose-100 text-rose-900 border-rose-300'
                          : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}
                    >
                      {status}
                    </span>

                    <button className="text-xs text-teal-900 font-bold px-2.5 py-1 rounded-lg bg-teal-50/80 border border-teal-200 cursor-pointer hover:bg-teal-100">
                      {isExpanded ? 'Hide Details ▲' : 'View Details ▼'}
                    </button>
                  </div>
                </div>

                {/* EXPANDED CONTENT VIEW */}
                {isExpanded && (
                  <div className="p-4 border-t border-teal-100 bg-teal-50/20 space-y-4">
                    <div className="flex flex-wrap justify-between items-center text-xs text-teal-950 font-bold gap-2">
                      <span>Submitted Items ({items.length})</span>

                      <div className="flex items-center gap-2">
                        {isPendingOrRejected && (
                          <>
                            <button
                              onClick={() => handleResend(req)}
                              disabled={actionLoading === req.id}
                              className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-bold rounded-lg border border-teal-200 transition cursor-pointer"
                            >
                              Resend
                            </button>

                            <button
                              onClick={() => handleOpenEdit(req)}
                              disabled={actionLoading === req.id}
                              className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-lg border border-amber-200 transition cursor-pointer"
                            >
                              Edit & Resend
                            </button>

                            <button
                              onClick={() => handleDelete(req.id)}
                              disabled={actionLoading === req.id}
                              className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-900 text-xs font-bold rounded-lg border border-rose-200 transition cursor-pointer"
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
                              className="px-4 py-1.5 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                            >
                              Approve
                            </button>

                            <button
                              onClick={() => handleReject(req.id)}
                              disabled={actionLoading === req.id}
                              className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {payload.message && (
                      <div className="p-3 bg-white border border-teal-100 rounded-xl text-xs text-slate-800 font-medium">
                        <strong className="text-teal-800 uppercase text-[10px] block mb-0.5">Request Details / Notes:</strong>
                        {payload.message}
                      </div>
                    )}

                    {/* ITEM PRICE AND QUANTITY TABLE */}
                    {items.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-teal-100 bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-teal-900 text-teal-100 uppercase text-[10px] font-extrabold tracking-wider border-b border-teal-800">
                            <tr>
                              <th className="py-2.5 px-4">ITEM NAME</th>
                              <th className="py-2.5 px-4 text-right">COST PRICE</th>
                              <th className="py-2.5 px-4 text-right">RETAIL / SALE PRICE</th>
                              <th className="py-2.5 px-4 text-right">QTY</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-teal-50 text-slate-800">
                            {items.map((item, i) => {
                              const costPrice = toNumber(
                                item.unit_cost_price ?? item.cost_price ?? item.cost ?? 0
                              );
                              const retailPrice = toNumber(
                                item.unit_retail_price ?? item.unit_selling_price ?? item.unit_price ?? item.price ?? 0
                              );
                              const qty = toNumber(
                                item.opening_stock ?? item.quantity ?? item.qty ?? 1
                              );

                              return (
                                <tr key={i} className="hover:bg-teal-50/40">
                                  <td className="py-2.5 px-4 font-bold text-slate-900">
                                    {item.name || item.product_name || `Item #${item.item_id || item.id}`}
                                  </td>
                                  <td className="py-2.5 px-4 text-right text-slate-600 font-mono">
                                    KSh {costPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-black text-teal-800 font-mono">
                                    KSh {retailPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2.5 px-4 text-right text-slate-900 font-extrabold font-mono">
                                    {qty}
                                  </td>
                                </tr>
                              );
                            })}
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

      {/* EDIT MODAL */}
      {editingRequest && (
        <div className="fixed inset-0 z-[9999] bg-teal-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-teal-100 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl relative text-slate-900">
            <div className="flex justify-between items-center border-b border-teal-100 pb-3">
              <h3 className="text-sm font-black text-teal-950 uppercase">
                Edit Request #{editingRequest.id}
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
                <label className="text-xs text-teal-900 block mb-1 font-bold">Request Type</label>
                <select
                  value={editRequestType}
                  onChange={(e) => setEditRequestType(e.target.value)}
                  className="w-full bg-teal-50/50 border border-teal-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none"
                >
                  <option value="PRICE_QUERY">Price Query</option>
                  <option value="DISCOUNT_APPROVAL">Discount Approval</option>
                  <option value="STOCK_OVERRIDE">Stock Limit Override</option>
                  <option value="NEW_REGISTERED_ITEMS">New Registered Items</option>
                  <option value="SALE_ENTRY">Sale Entry</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-teal-900 block mb-1 font-bold">Notes / Message</label>
                <input
                  type="text"
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  placeholder="Notes for management"
                  className="w-full bg-teal-50/50 border border-teal-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-teal-950 font-bold uppercase">Items</span>
                <button
                  onClick={handleAddItem}
                  className="px-3 py-1 bg-teal-800 text-white text-xs rounded-lg hover:bg-teal-900 cursor-pointer font-bold shadow-xs"
                >
                  + Add Item
                </button>
              </div>

              {editPayloadItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-teal-50/30 p-3 rounded-xl border border-teal-100 items-center">
                  <div className="sm:col-span-4">
                    <label className="text-[10px] text-teal-800 block mb-1 font-bold uppercase">Item Name</label>
                    <input
                      type="text"
                      value={item.name || item.product_name || ''}
                      onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                      className="w-full bg-white border border-teal-200 rounded-lg px-2 py-1 text-xs text-slate-900 font-bold"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-teal-800 block mb-1 font-bold uppercase">Cost Price</label>
                    <input
                      type="text"
                      value={item.unit_cost_price ?? item.cost_price ?? ''}
                      onChange={(e) => handleItemChange(idx, 'unit_cost_price', e.target.value)}
                      className="w-full bg-white border border-teal-200 rounded-lg px-2 py-1 text-xs text-slate-900 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-[10px] text-teal-800 block mb-1 font-bold uppercase">Retail Price</label>
                    <input
                      type="text"
                      value={item.unit_retail_price ?? item.unit_price ?? item.price ?? ''}
                      onChange={(e) => handleItemChange(idx, 'unit_retail_price', e.target.value)}
                      className="w-full bg-white border border-teal-200 rounded-lg px-2 py-1 text-xs text-slate-900 font-mono font-bold text-teal-800"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-teal-800 block mb-1 font-bold uppercase">Qty</label>
                    <input
                      type="number"
                      value={item.quantity ?? item.opening_stock ?? 1}
                      onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full bg-white border border-teal-200 rounded-lg px-2 py-1 text-xs text-slate-900 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="text-rose-600 hover:text-rose-800 text-xs p-1 cursor-pointer font-bold"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 border-t border-teal-100 pt-4">
              <button
                onClick={() => setEditingRequest(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl cursor-pointer hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAndResend}
                className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
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