// src/components/PurchaseReturnsManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

const toNumber = (val) => (Number.isFinite(Number(val)) ? Number(val) : 0);
const formatCurrency = (val) =>
  `KSh ${toNumber(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function PurchaseReturnsManagement({ items = [], selectedBranch, onReturnSubmitted }) {
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierName, setSupplierName] = useState('');
  const [reason, setReason] = useState('DAMAGED');
  const [notes, setNotes] = useState('');
  const [returnItems, setReturnItems] = useState([
    { id: Date.now(), item_id: '', quantity: '', unit_cost_price: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // History state
  const [returnsHistory, setReturnsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const safeItems = Array.isArray(items) ? items : [];

  const fetchReturnsHistory = useCallback(async () => {
    if (!selectedBranch) return;
    setLoadingHistory(true);
    try {
      const res = await API.get(`purchase-returns/?branch=${encodeURIComponent(selectedBranch)}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setReturnsHistory(data);
    } catch (err) {
      console.error('Failed to fetch purchase returns history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchReturnsHistory();
  }, [fetchReturnsHistory]);

  const handleAddItemRow = () => {
    setReturnItems((prev) => [
      ...prev,
      { id: Date.now(), item_id: '', quantity: '', unit_cost_price: '' },
    ]);
  };

  const handleRemoveItemRow = (id) => {
    if (returnItems.length === 1) return;
    setReturnItems((prev) => prev.filter((row) => row.id !== id));
  };

  const handleItemRowChange = (id, field, value) => {
    setReturnItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };

        if (field === 'item_id') {
          const selected = safeItems.find((i) => String(i.id) === String(value));
          if (selected) {
            updated.unit_cost_price =
              selected.unit_cost_price || selected.weighted_unit_cost || '';
          }
        }
        return updated;
      })
    );
  };

  const totalReturnValuation = useMemo(() => {
    return returnItems.reduce(
      (acc, row) => acc + toNumber(row.quantity) * toNumber(row.unit_cost_price),
      0
    );
  }, [returnItems]);

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    if (!selectedBranch) {
      setFeedback({ type: 'error', message: 'Please select a branch first.' });
      return;
    }

    const validRows = returnItems.filter(
      (row) => row.item_id && toNumber(row.quantity) > 0
    );

    if (validRows.length === 0) {
      setFeedback({ type: 'error', message: 'Please select at least one valid item and quantity.' });
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        branch: selectedBranch,
        return_date: returnDate,
        supplier_name: supplierName,
        reason: reason,
        notes: notes,
        items: validRows.map((row) => ({
          item: row.item_id,
          quantity: toNumber(row.quantity),
          unit_cost_price: toNumber(row.unit_cost_price),
        })),
      };

      await API.post('purchase-returns/', payload);

      setFeedback({
        type: 'success',
        message: 'Purchase return recorded successfully! Inventory balances updated.',
      });

      // Reset form
      setSupplierName('');
      setNotes('');
      setReturnItems([{ id: Date.now(), item_id: '', quantity: '', unit_cost_price: '' }]);

      fetchReturnsHistory();
      if (onReturnSubmitted) onReturnSubmitted();
    } catch (err) {
      console.error('Failed to process purchase return:', err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to log purchase return. Please try again.';
      setFeedback({ type: 'error', message: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans max-w-7xl mx-auto">
      {/* 1. Left Form Card */}
      <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 h-fit">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Debit Note / Purchase Return
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Log returned goods back to suppliers to adjust stock levels and supplier balances.
          </p>
        </div>

        {feedback.message && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-semibold border ${
              feedback.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <form onSubmit={handleSubmitReturn} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Return Date
            </label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Supplier / Vendor
            </label>
            <input
              type="text"
              placeholder="e.g. Crown Paints Kenya Ltd"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Reason for Return
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
            >
              <option value="DAMAGED">Damaged / Defective Goods</option>
              <option value="WRONG_SPEC">Wrong Specifications Delivered</option>
              <option value="EXPIRED">Expired Product</option>
              <option value="OVERSTOCK">Excess / Overstock Return</option>
            </select>
          </div>

          {/* Line Items */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Returned Items ({returnItems.length})
              </span>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-2">
              {returnItems.map((row) => (
                <div
                  key={row.id}
                  className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2"
                >
                  <select
                    value={row.item_id}
                    onChange={(e) => handleItemRowChange(row.id, 'item_id', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                    required
                  >
                    <option value="">-- Choose item --</option>
                    {safeItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.code || 'No Code'})
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={(e) => handleItemRowChange(row.id, 'quantity', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-rose-500"
                      required
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Cost Price"
                      value={row.unit_cost_price}
                      onChange={(e) => handleItemRowChange(row.id, 'unit_cost_price', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-rose-500"
                      required
                    />
                  </div>

                  <div className="flex justify-between items-center pt-1 text-[11px]">
                    <span className="font-bold font-mono text-rose-700">
                      Subtotal: {formatCurrency(toNumber(row.quantity) * toNumber(row.unit_cost_price))}
                    </span>
                    {returnItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(row.id)}
                        className="text-slate-400 hover:text-rose-600 font-bold"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Additional Notes
            </label>
            <textarea
              rows="2"
              placeholder="Provide context or credit note reference..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
            ></textarea>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Debit Valuation</span>
              <span className="text-base font-extrabold font-mono text-rose-600">
                {formatCurrency(totalReturnValuation)}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Submit Return'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Right Purchase Returns Log Table */}
      <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Purchase Returns History
          </h2>
          <button
            onClick={fetchReturnsHistory}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer"
          >
            🔄 Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">
                <th className="p-3">Ref / Date</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Reason</th>
                <th className="p-3 text-right">Items Count</th>
                <th className="p-3 text-right">Total Debit Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loadingHistory ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400 font-mono">
                    Loading purchase returns ledger...
                  </td>
                </tr>
              ) : returnsHistory.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400">
                    No purchase returns logged for this branch.
                  </td>
                </tr>
              ) : (
                returnsHistory.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <span className="font-mono font-bold text-rose-800 block">
                        PR-#{ret.id}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {ret.return_date ? new Date(ret.return_date).toLocaleDateString() : 'N/A'}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-800">
                      {ret.supplier_name || 'Vendor'}
                    </td>
                    <td className="p-3">
                      <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                        {ret.reason || 'DAMAGED'}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-slate-700">
                      {ret.items?.length || 1}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-rose-600">
                      {formatCurrency(ret.total_amount)}
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