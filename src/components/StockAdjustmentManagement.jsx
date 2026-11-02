// src/components/StockAdjustmentManagement.jsx
import React, { useState } from 'react';
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
    { id: Date.now(), item_id: '', direction: 'DECREASE', quantity: '', unit_cost: '', search_term: '' },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const safeItems = Array.isArray(items) ? items : [];

  /* ================= DYNAMIC ROW CONTROLS ================= */
  const handleAddRow = () => {
    setAdjustmentRows((prev) => [
      ...prev,
      { id: Date.now(), item_id: '', direction: 'DECREASE', quantity: '', unit_cost: '', search_term: '' },
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
            updated.search_term = `${matched.name} (${matched.code || 'No Code'})`;
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
        { id: Date.now(), item_id: '', direction: 'DECREASE', quantity: '', unit_cost: '', search_term: '' },
      ]);

      // Instantly trigger parent state update to reflect new stock levels without page refresh
      if (onAdjustmentSuccess) {
        onAdjustmentSuccess();
      }
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
              {adjustmentRows.map((row, idx) => {
                const filteredItems = safeItems.filter((i) => {
                  const term = (row.search_term || '').toLowerCase();
                  return (
                    i.name.toLowerCase().includes(term) ||
                    (i.code && i.code.toLowerCase().includes(term))
                  );
                });

                return (
                  <div
                    key={row.id}
                    className="p-3 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs"
                  >
                    <div className="sm:col-span-1 text-[10px] font-bold text-slate-400 font-mono text-center">
                      #{idx + 1}
                    </div>

                    {/* Searchable Item Input */}
                    <div className="sm:col-span-5 relative">
                      <input
                        type="text"
                        list={`item-options-${row.id}`}
                        placeholder="Search item by name or code..."
                        value={row.search_term || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleRowChange(row.id, 'search_term', val);

                          const matched = safeItems.find(
                            (i) =>
                              i.name.toLowerCase() === val.toLowerCase() ||
                              (i.code && i.code.toLowerCase() === val.toLowerCase()) ||
                              `${i.name} (${i.code || 'No Code'})`.toLowerCase() === val.toLowerCase()
                          );

                          if (matched) {
                            handleRowChange(row.id, 'item_id', matched.id);
                          } else {
                            handleRowChange(row.id, 'item_id', '');
                          }
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                        required
                      />
                      <datalist id={`item-options-${row.id}`}>
                        {filteredItems.map((item) => (
                          <option
                            key={item.id}
                            value={`${item.name} (${item.code || 'No Code'})`}
                          />
                        ))}
                      </datalist>
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
              {submitting ? 'Saving Adjustments...' : 'Submit Stock Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}