// src/components/StockAdjustmentManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

export default function StockAdjustmentManagement({
  items = [],
  selectedBranch,
  onAdjustmentSuccess,
}) {
  const [adjustmentDate, setAdjustmentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [reason, setReason] = useState('DAMAGED');
  const [notes, setNotes] = useState('');

  // Multi-Item Adjustment Rows
  const [adjustmentRows, setAdjustmentRows] = useState([
    { id: Date.now(), item_id: '', direction: 'DECREASE', quantity: '', unit_cost: '' },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // History State
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const safeItems = Array.isArray(items) ? items : [];

  /* ================= FETCH HISTORY ================= */
  const fetchAdjustmentHistory = useCallback(async () => {
    if (!selectedBranch) return;
    setLoadingHistory(true);
    try {
      const res = await API.get(`stock-movements/activity-history/?branch=${selectedBranch}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      // Filter for stock adjustments only
      const adjustmentsOnly = data.filter((log) => {
        const type = String(log.activity_type || log.movement_type || '').toUpperCase();
        return type.includes('ADJUSTMENT');
      });
      setHistoryLogs(adjustmentsOnly);
    } catch (err) {
      console.error('Failed to fetch stock adjustments history:', err);
    } font-mono
      setLoadingHistory(false);
  }, [selectedBranch]);

  useEffect(() => {
    fetchAdjustmentHistory();
  }, [fetchAdjustmentHistory]);

  /* ================= DYNAMIC ROW CONTROLS ================= */
  const handleAddRow = () => {
    setAdjustmentRows((prev) => [
      ...prev,
      { id: Date.now(), item_id: '', direction: 'DECREASE', quantity: '', unit_cost: '' },
    ]);
  };

  const handleRemoveRow = (id) => {
    if (adjustmentRows.length === 1) return;
    setAdjustmentRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleRowChange = (id, field, value) => {
    setAdjustmentRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };

        if (field === 'item_id') {
          const matched = safeItems.find((i) => String(i.id) === String(value));
          if (matched) {
            updated.unit_cost = matched.unit_cost_price || matched.cost_price || matched.buying_price || '';
          }
        }
        return updated;
      })
    );
  };

  /* ================= SUBMIT ADJUSTMENTS ================= */
  const handleSubmitAdjustments = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    if (!selectedBranch) {
      setFeedback({ type: 'error', message: 'Please select a branch first.' });
      return;
    }

    const validRows = adjustmentRows.filter(
      (r) => r.item_id && parseFloat(r.quantity) > 0
    );

    if (validRows.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Please select at least one item and enter a valid quantity.',
      });
      return;
    }

    setSubmitting(true);

    try {
      // Post each item adjustment
      const promises = validRows.map((row) => {
        const payload = {
          branch: selectedBranch,
          item: row.item_id,
          movement_type: row.direction === 'INCREASE' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          adjustment_type: row.direction,
          quantity: parseFloat(row.quantity),
          unit_cost_price: row.unit_cost ? parseFloat(row.unit_cost).toFixed(2) : '0.00',
          date: adjustmentDate,
          notes: `${reason}: ${notes.trim() || 'Stock count adjustment'}`,
        };
        return API.post('stock-movements/', payload);
      });

      await Promise.all(promises);

      setFeedback({
        type: 'success',
        message: `Successfully recorded ${validRows.length} stock adjustment(s)!`,
      });

      // Reset Form
      setNotes('');
      setAdjustmentRows([
        { id: Date.now(), item_id: '', direction: 'DECREASE', quantity: '', unit_cost: '' },
      ]);

      fetchAdjustmentHistory();
      if (onAdjustmentSuccess) onAdjustmentSuccess();
    } catch (err) {
      console.error('Failed to save stock adjustments:', err);
      const msg = err?.response?.data?.detail || 'Failed to submit stock adjustments.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto font-sans space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Stock Adjustments
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manually write off damaged goods, lost items, or adjust stock counts after inventory audits.
          </p>
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

      {/* Main Adjustment Entry Form */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
          New Adjustment Entry
        </h2>

        <form onSubmit={handleSubmitAdjustments} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Adjustment Date *
              </label>
              <input
                type="date"
                value={adjustmentDate}
                onChange={(e) => setAdjustmentDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Primary Reason *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="DAMAGED">Damaged / Expired Goods</option>
                <option value="LOST_STOLEN">Stock Discrepancy / Shrinkage</option>
                <option value="INVENTORY_AUDIT">Stock Audit Correction</option>
                <option value="FOUND">Found Extra Inventory (+)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Reference / Auditor Notes
              </label>
              <input
                type="text"
                placeholder="Audit reference or reason..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Dynamic Adjustment Items List */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Adjusted Items List ({adjustmentRows.length})
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
              {adjustmentRows.map((row, idx) => (
                <div
                  key={row.id}
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs"
                >
                  <div className="sm:col-span-1 text-[10px] font-bold text-slate-400 font-mono text-center">
                    #{idx + 1}
                  </div>

                  <div className="sm:col-span-5">
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
                    <select
                      value={row.direction}
                      onChange={(e) => handleRowChange(row.id, 'direction', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                    >
                      <option value="DECREASE">Decrease Stock (-)</option>
                      <option value="INCREASE">Increase Stock (+)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
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

                  <div className="sm:col-span-1 text-right">
                    {adjustmentRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="text-xs text-slate-400 hover:text-rose-600 font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-teal-800 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Saving Adjustments...' : 'Submit Stock Adjustment'}
            </button>
          </div>
        </form>
      </div>

      {/* History Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h2 className="text-base font-extrabold text-slate-900">Adjustment History</h2>
          <button
            onClick={fetchAdjustmentHistory}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">
                <th className="p-3">Date</th>
                <th className="p-3">Item</th>
                <th className="p-3">Direction</th>
                <th className="p-3 text-center">Qty</th>
                <th className="p-3">Reason / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loadingHistory ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400 font-mono">
                    Loading adjustment logs...
                  </td>
                </tr>
              ) : historyLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400">
                    No adjustments recorded for this branch.
                  </td>
                </tr>
              ) : (
                historyLogs.map((log, i) => (
                  <tr key={log.id || i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono text-slate-600">
                      {log.date || log.created_at ? new Date(log.date || log.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {log.item_name || log.item?.name || `Item #${log.item}`}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          String(log.movement_type || '').includes('IN') || String(log.adjustment_type || '').includes('INCREASE')
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {String(log.movement_type || log.adjustment_type || 'ADJUSTMENT').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-slate-800">
                      {log.quantity}
                    </td>
                    <td className="p-3 text-slate-500">
                      {log.notes || log.reason || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}