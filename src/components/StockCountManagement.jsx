// src/components/StockCountManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

export default function StockCountManagement({ items = [], selectedBranch, onReconciliationSuccess }) {
  const [countDate, setCountDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [auditorName, setAuditorName] = useState('');
  const [notes, setNotes] = useState('');

  // Physical Counts Map: { [itemId]: physicalCountQuantity }
  const [physicalCounts, setPhysicalCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // History / Past Stock Count Audits
  const [countHistory, setCountHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('COUNT'); // 'COUNT' | 'HISTORY'

  const safeItems = Array.isArray(items) ? items : [];

  /* ================= FETCH STOCK COUNT HISTORY ================= */
  const fetchCountHistory = useCallback(async () => {
    if (!selectedBranch) return;
    setLoadingHistory(true);
    try {
      const res = await API.get(`stock-counts/?branch=${encodeURIComponent(selectedBranch)}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setCountHistory(data);
    } catch (err) {
      console.error('Failed to fetch stock count history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchCountHistory();
  }, [fetchCountHistory]);

  /* ================= FILTERED ITEMS ================= */
  const categories = useMemo(() => {
    const set = new Set();
    safeItems.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  }, [safeItems]);

  const filteredItems = useMemo(() => {
    return safeItems.filter((item) => {
      const nameMatch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (item.code || '').toLowerCase().includes(searchQuery.toLowerCase());
      const catMatch = categoryFilter === 'ALL' || item.category === categoryFilter;
      return nameMatch && catMatch;
    });
  }, [safeItems, searchQuery, categoryFilter]);

  /* ================= HANDLERS ================= */
  const handleQuantityChange = (itemId, val) => {
    setPhysicalCounts((prev) => ({
      ...prev,
      [itemId]: val,
    }));
  };

  // Helper to calculate total count statistics
  const countStats = useMemo(() => {
    let countedItemsCount = 0;
    let totalDiscrepancies = 0;
    let totalShortage = 0;
    let totalSurplus = 0;

    Object.entries(physicalCounts).forEach(([itemId, val]) => {
      if (val !== '' && !isNaN(val)) {
        countedItemsCount++;
        const item = safeItems.find((i) => String(i.id) === String(itemId));
        if (item) {
          const sysQty = Number(item.remaining_stock ?? item.quantity ?? 0);
          const physQty = Number(val);
          const diff = physQty - sysQty;

          if (diff !== 0) {
            totalDiscrepancies++;
            if (diff < 0) totalShortage += Math.abs(diff);
            else totalSurplus += diff;
          }
        }
      }
    });

    return { countedItemsCount, totalDiscrepancies, totalShortage, totalSurplus };
  }, [physicalCounts, safeItems]);

  /* ================= SUBMIT STOCK RECONCILIATION ================= */
  const handleSubmitReconciliation = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    if (!selectedBranch) {
      setFeedback({ type: 'error', message: 'Please select a branch first.' });
      return;
    }

    // Build payload of counted items
    const auditItems = [];
    Object.entries(physicalCounts).forEach(([itemId, val]) => {
      if (val !== '' && !isNaN(val)) {
        const item = safeItems.find((i) => String(i.id) === String(itemId));
        if (item) {
          const systemQty = Number(item.remaining_stock ?? item.quantity ?? 0);
          const physicalQty = Number(val);
          auditItems.push({
            item: Number(itemId),
            system_quantity: systemQty,
            physical_quantity: physicalQty,
            variance: physicalQty - systemQty,
          });
        }
      }
    });

    if (auditItems.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Please enter physical count values for at least one item before reconciling.',
      });
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        branch: selectedBranch,
        count_date: countDate,
        auditor_name: auditorName.trim(),
        notes: notes.trim(),
        items: auditItems,
        auto_reconcile: true, // Automatically adjust stock levels in system
      };

      await API.post('stock-counts/', payload);

      setFeedback({
        type: 'success',
        message: `Stock Audit & Reconciliation completed! Adjusted ${countStats.totalDiscrepancies} discrepant item(s).`,
      });

      // Reset form
      setPhysicalCounts({});
      setAuditorName('');
      setNotes('');

      fetchCountHistory();
      if (onReconciliationSuccess) onReconciliationSuccess();
    } catch (err) {
      console.error('Failed to submit stock count reconciliation:', err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to process stock reconciliation.';
      setFeedback({ type: 'error', message: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto font-sans space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Physical Stock Take & Reconciliation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare physical inventory counts against system records and automatically post inventory adjustments.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('COUNT')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === 'COUNT'
                ? 'bg-white text-teal-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
             Stock Count Entry
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'bg-white text-teal-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
             Reconciliation History
          </button>
        </div>
      </div>

      {feedback.message && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold border ${
            feedback.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* TAB 1: STOCK COUNT ENTRY */}
      {activeTab === 'COUNT' && (
        <div className="space-y-6">
          {/* Audit Summary Dashboard Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Items Counted</span>
              <span className="text-xl font-black font-mono text-slate-900">{countStats.countedItemsCount}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Discrepancies</span>
              <span className={`text-xl font-black font-mono ${countStats.totalDiscrepancies > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                {countStats.totalDiscrepancies}
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Shortage (-)</span>
              <span className="text-xl font-black font-mono text-rose-700">-{countStats.totalShortage}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Surplus (+)</span>
              <span className="text-xl font-black font-mono text-emerald-700">+{countStats.totalSurplus}</span>
            </div>
          </div>

          <form onSubmit={handleSubmitReconciliation} className="space-y-6">
            {/* Header Controls & Auditor Info */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Count Date *
                </label>
                <input
                  type="date"
                  value={countDate}
                  onChange={(e) => setCountDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Audit Notes / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. End of Month Stock Take..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-4 justify-between items-center text-xs">
              <input
                type="text"
                placeholder="Search item by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 sm:w-80"
              />

              {categories.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Category:</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-semibold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Stock Count Grid / Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50 text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">
                      <th className="p-3">Item Details</th>
                      <th className="p-3 text-center">System Stock</th>
                      <th className="p-3 text-center w-40">Physical Count</th>
                      <th className="p-3 text-center">Variance</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-slate-400">
                          No items match your search filter.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => {
                        const systemQty = Number(item.remaining_stock ?? item.quantity ?? 0);
                        const physInput = physicalCounts[item.id] ?? '';
                        const hasInput = physInput !== '' && !isNaN(physInput);
                        const physicalQty = hasInput ? Number(physInput) : systemQty;
                        const variance = physicalQty - systemQty;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3">
                              <span className="font-bold text-slate-900 block">{item.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">Code: {item.code || 'N/A'}</span>
                            </td>

                            <td className="p-3 text-center font-mono font-bold text-slate-700 bg-slate-50/50">
                              {systemQty}
                            </td>

                            <td className="p-3 text-center">
                              <input
                                type="number"
                                min="0"
                                placeholder={String(systemQty)}
                                value={physInput}
                                onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-mono font-extrabold text-center text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                              />
                            </td>

                            <td className="p-3 text-center font-mono font-black text-sm">
                              {!hasInput ? (
                                <span className="text-slate-300">0</span>
                              ) : variance === 0 ? (
                                <span className="text-slate-400">0</span>
                              ) : variance > 0 ? (
                                <span className="text-emerald-700">+{variance}</span>
                              ) : (
                                <span className="text-rose-700">{variance}</span>
                              )}
                            </td>

                            <td className="p-3">
                              {!hasInput ? (
                                <span className="text-[10px] text-slate-400 font-medium">Uncounted</span>
                              ) : variance === 0 ? (
                                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">
                                  Matched
                                </span>
                              ) : variance > 0 ? (
                                <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">
                                  Surplus (+{variance})
                                </span>
                              ) : (
                                <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">
                                  Shortage ({variance})
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Submit Actions */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium">
                Clicking Reconcile will adjust system stock balances to match physical counts.
              </span>

              <button
                type="submit"
                disabled={submitting || countStats.countedItemsCount === 0}
                className="px-6 py-2.5 bg-teal-800 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Reconciling Inventory...' : 'Confirm & Reconcile Stock'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: RECONCILIATION HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Audit & Reconciliation History</h2>
              <p className="text-xs text-slate-400">Past physical stock takes and adjustment records</p>
            </div>
            <button
              onClick={fetchCountHistory}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">
                  <th className="p-3">Audit Date</th>
                  <th className="p-3">Auditor</th>
                  <th className="p-3 text-center">Items Audited</th>
                  <th className="p-3">Notes</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loadingHistory ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400 font-mono">
                      Loading audit history...
                    </td>
                  </tr>
                ) : countHistory.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400">
                      No stock count audits performed for this branch yet.
                    </td>
                  </tr>
                ) : (
                  countHistory.map((audit) => (
                    <tr key={audit.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono text-slate-600">
                        {audit.count_date || audit.created_at
                          ? new Date(audit.count_date || audit.created_at).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        {audit.auditor_name || 'System Auditor'}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-800">
                        {Array.isArray(audit.items) ? audit.items.length : audit.items_count || '-'}
                      </td>
                      <td className="p-3 text-slate-500 max-w-xs truncate">
                        {audit.notes || 'Stock Reconciliation'}
                      </td>
                      <td className="p-3 text-center">
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">
                          Reconciled
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}