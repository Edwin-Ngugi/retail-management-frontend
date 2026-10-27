// src/components/StockTransferManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';
import { useBranch } from './BranchContext';

export default function StockTransferManagement({
  items = [],
  selectedBranch: propBranch,
  onTransferSuccess,
}) {
  const { branches = [], selectedBranch: contextBranch } = useBranch();
  const activeBranch = propBranch || contextBranch;

  // Transfer Form State
  const [transferDirection, setTransferDirection] = useState('OUT'); // 'OUT' or 'IN'
  const [targetBranchId, setTargetBranchId] = useState('');
  const [referenceNote, setReferenceNote] = useState('');

  // Multi-Item Transfer List
  const [transferRows, setTransferRows] = useState([
    { id: Date.now(), item_id: '', quantity: '' },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // History State
  const [transferHistory, setTransferHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const safeItems = Array.isArray(items) ? items : [];

  // Filter out the active branch from target branch dropdown
  const availableTargetBranches = useMemo(() => {
    return branches.filter((b) => String(b.id) !== String(activeBranch));
  }, [branches, activeBranch]);

  // Helper to get stock of an item
  const getItemStock = (itemId) => {
    const found = safeItems.find((i) => String(i.id) === String(itemId));
    if (!found) return 0;
    const stockVal =
      found.remaining_stock ??
      found.current_stock ??
      found.stock ??
      0;
    const parsed = parseFloat(stockVal);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  /* ================= MULTI-ITEM ROW CONTROLS ================= */
  const handleAddRow = () => {
    setTransferRows((prev) => [
      ...prev,
      { id: Date.now(), item_id: '', quantity: '' },
    ]);
  };

  const handleRemoveRow = (id) => {
    if (transferRows.length === 1) return;
    setTransferRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleRowChange = (id, field, value) => {
    setTransferRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  /* ================= FETCH TRANSFER HISTORY ================= */
  const fetchTransferHistory = useCallback(async () => {
    if (!activeBranch) return;
    setLoadingHistory(true);
    try {
      let url = `stock-transfers/?branch=${encodeURIComponent(activeBranch)}`;
      if (fromDate) url += `&from_date=${encodeURIComponent(fromDate)}`;
      if (toDate) url += `&to_date=${encodeURIComponent(toDate)}`;

      const res = await API.get(url);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setTransferHistory(data);
    } catch (err) {
      console.error('Failed to fetch stock transfer history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [activeBranch, fromDate, toDate]);

  useEffect(() => {
    fetchTransferHistory();
  }, [fetchTransferHistory]);

  /* ================= SUBMIT STOCK TRANSFER ================= */
  const handleSubmitTransfer = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    if (!activeBranch) {
      setFeedback({ type: 'error', message: 'Please select an active branch first.' });
      return;
    }

    if (!targetBranchId) {
      setFeedback({
        type: 'error',
        message: `Please select a ${transferDirection === 'OUT' ? 'destination' : 'source'} branch.`,
      });
      return;
    }

    // Validate rows
    const validRows = transferRows.filter(
      (r) => r.item_id && parseFloat(r.quantity) > 0
    );

    if (validRows.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Please select at least one item and enter a valid quantity.',
      });
      return;
    }

    // Check stock for Transfer OUT
    if (transferDirection === 'OUT') {
      for (const row of validRows) {
        const itemStock = getItemStock(row.item_id);
        const qtyNum = parseFloat(row.quantity);
        if (qtyNum > itemStock) {
          const itemObj = safeItems.find((i) => String(i.id) === String(row.item_id));
          setFeedback({
            type: 'error',
            message: `Quantity for "${itemObj?.name || 'item'}" (${qtyNum}) exceeds available stock (${itemStock}).`,
          });
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const payload = {
        source_branch: transferDirection === 'OUT' ? activeBranch : targetBranchId,
        destination_branch: transferDirection === 'OUT' ? targetBranchId : activeBranch,
        transfer_type: transferDirection,
        reference_note: referenceNote.trim(),
        items: validRows.map((r) => ({
          item: r.item_id,
          quantity: parseFloat(r.quantity),
        })),
      };

      await API.post('stock-transfers/', payload);

      setFeedback({
        type: 'success',
        message: `Stock Transfer (${validRows.length} item(s)) recorded successfully!`,
      });

      // Reset Form
      setReferenceNote('');
      setTransferRows([{ id: Date.now(), item_id: '', quantity: '' }]);

      fetchTransferHistory();
      if (onTransferSuccess) onTransferSuccess();
    } catch (err) {
      console.error('Failed to process stock transfer:', err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to process stock transfer. Please try again.';
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
            Inter-Branch Stock Transfers
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Dispatch or receive multi-item inventory batches between retail branches.
          </p>
        </div>

        {/* Direction Switcher with Teal Brand Color */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setTransferDirection('OUT')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
              transferDirection === 'OUT'
                ? 'bg-teal-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            ↗ Transfer OUT (Dispatch)
          </button>
          <button
            type="button"
            onClick={() => setTransferDirection('IN')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
              transferDirection === 'IN'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            ↘ Transfer IN (Receive)
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

      {/* Main Multi-Item Form Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
          New Multi-Item Transfer Entry ({transferDirection === 'OUT' ? 'Dispatching Stock' : 'Receiving Stock'})
        </h2>

        <form onSubmit={handleSubmitTransfer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target Branch Picker */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                {transferDirection === 'OUT' ? 'Destination Branch *' : 'Source Branch *'}
              </label>
              <select
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                required
              >
                <option value="">-- Select Target Branch --</option>
                {availableTargetBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reference Note */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Transfer Reference / Dispatch Note
              </label>
              <input
                type="text"
                placeholder="e.g. Stock transfer note #STN-2026-004 or driver reference..."
                value={referenceNote}
                onChange={(e) => setReferenceNote(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Dynamic Itemized Transfer Table */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Transfer Items List ({transferRows.length})
              </span>
              <button
                type="button"
                onClick={handleAddRow}
                className="text-xs font-bold text-teal-700 hover:text-teal-900 cursor-pointer"
              >
                + Add Another Item
              </button>
            </div>

            <div className="space-y-2.5">
              {transferRows.map((row, index) => {
                const currentStock = getItemStock(row.item_id);

                return (
                  <div
                    key={row.id}
                    className="p-3 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                  >
                    <div className="sm:col-span-1 text-[10px] font-bold text-slate-400 font-mono text-center">
                      #{index + 1}
                    </div>

                    <div className="sm:col-span-6">
                      <select
                        value={row.item_id}
                        onChange={(e) => handleRowChange(row.id, 'item_id', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                        required
                      >
                        <option value="">-- Choose Stock Item --</option>
                        {safeItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.code || 'No Code'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Quantity</span>
                        {row.item_id && (
                          <span className="text-[9px] font-bold font-mono text-emerald-700">
                            Stock: {currentStock}
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={row.quantity}
                        onChange={(e) => handleRowChange(row.id, 'quantity', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2 text-right">
                      {transferRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="text-xs text-slate-400 hover:text-rose-600 font-bold"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-teal-800 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {submitting
                ? 'Processing Transfer...'
                : `Submit Transfer Batch (${transferDirection === 'OUT' ? 'Dispatch' : 'Receive'})`}
            </button>
          </div>
        </form>
      </div>

      {/* Transfer History Ledger Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Transfer Movement History
            </h2>
            <p className="text-xs text-slate-400">
              Audit log of inter-branch inventory transfers for current branch.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium"
            />
            <button
              onClick={fetchTransferHistory}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">
                <th className="p-3">Transfer Date</th>
                <th className="p-3">Item</th>
                <th className="p-3">Direction / Type</th>
                <th className="p-3 text-center">Quantity</th>
                <th className="p-3">Source / Destination Branch</th>
                <th className="p-3">Reference / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loadingHistory ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400 font-mono">
                    Loading transfer movement ledger...
                  </td>
                </tr>
              ) : transferHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400">
                    No stock transfers recorded for this branch.
                  </td>
                </tr>
              ) : (
                transferHistory.map((tr) => {
                  const isOut =
                    tr.transfer_type === 'OUT' ||
                    String(tr.source_branch) === String(activeBranch);

                  return (
                    <tr key={tr.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono text-slate-600">
                        {tr.created_at || tr.transfer_date
                          ? new Date(tr.created_at || tr.transfer_date).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        {tr.item_name || tr.item?.name || `Item #${tr.item}`}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            isOut
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-teal-100 text-teal-900'
                          }`}
                        >
                          {isOut ? 'TRANSFER OUT' : 'TRANSFER IN'}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono font-black text-slate-800">
                        {tr.quantity}
                      </td>
                      <td className="p-3 font-semibold text-slate-700">
                        {isOut
                          ? `To: ${tr.destination_branch_name || tr.destination_branch || 'Branch'}`
                          : `From: ${tr.source_branch_name || tr.source_branch || 'Branch'}`}
                      </td>
                      <td className="p-3 text-slate-500 max-w-xs truncate">
                        {tr.reference_note || tr.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}