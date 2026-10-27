// src/components/SalesReturnsManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

const toNumber = (val) => (Number.isFinite(Number(val)) ? Number(val) : 0);
const formatCurrency = (val) =>
  `KSh ${toNumber(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function SalesReturnsManagement({ items = [], selectedBranch, onSalesReturnSubmitted }) {
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [originalInvoice, setOriginalInvoice] = useState('');
  const [reason, setReason] = useState('DEFECTIVE');
  const [notes, setNotes] = useState('');
  
  const [returnItems, setReturnItems] = useState([
    { id: Date.now(), item_id: '', quantity: '', unit_price: '' },
  ]);
  
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const [returnsHistory, setReturnsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const safeItems = Array.isArray(items) ? items : [];

  const fetchReturnsHistory = useCallback(async () => {
    if (!selectedBranch) return;
    setLoadingHistory(true);
    try {
      const res = await API.get(`sales-returns/?branch=${encodeURIComponent(selectedBranch)}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setReturnsHistory(data);
    } catch (err) {
      console.error('Failed to fetch sales returns history:', err);
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
      { id: Date.now(), item_id: '', quantity: '', unit_price: '' },
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
            updated.unit_price = selected.unit_retail_price || selected.selling_price || '';
          }
        }
        return updated;
      })
    );
  };

  const totalReturnValuation = useMemo(() => {
    return returnItems.reduce(
      (acc, row) => acc + toNumber(row.quantity) * toNumber(row.unit_price),
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
        customer_name: customerName.trim(),
        invoice_number: originalInvoice.trim(),
        reason: reason,
        notes: notes.trim(),
        items: validRows.map((row) => ({
          item: row.item_id,
          quantity: toNumber(row.quantity),
          unit_price: toNumber(row.unit_price),
        })),
      };

      await API.post('sales-returns/', payload);

      setFeedback({
        type: 'success',
        message: 'Sales return processed successfully! Stock restocked to inventory.',
      });

      // Reset
      setCustomerName('');
      setOriginalInvoice('');
      setNotes('');
      setReturnItems([{ id: Date.now(), item_id: '', quantity: '', unit_price: '' }]);

      fetchReturnsHistory();
      if (onSalesReturnSubmitted) onSalesReturnSubmitted();
    } catch (err) {
      console.error('Failed to submit sales return:', err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to log sales return. Please try again.';
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
            Record Sales Return
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Accept returned goods from customers to credit accounts or return stock to store.
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
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Original Invoice Number
            </label>
            <input
              type="text"
              placeholder="e.g. INV-2026-001"
              value={originalInvoice}
              onChange={(e) => setOriginalInvoice(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Customer Name
            </label>
            <input
              type="text"
              placeholder="e.g. Walk-in Customer / John Doe"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Reason for Return
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="DEFECTIVE">Defective / Damaged Item</option>
              <option value="WRONG_ITEM">Wrong Item Purchased</option>
              <option value="EXCHANGE">Customer Exchange</option>
              <option value="REFUND">Refund Request</option>
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
                className="text-[11px] font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
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
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
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
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Unit Price"
                      value={row.unit_price}
                      onChange={(e) => handleItemRowChange(row.id, 'unit_price', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>

                  <div className="flex justify-between items-center pt-1 text-[11px]">
                    <span className="font-bold font-mono text-amber-800">
                      Subtotal: {formatCurrency(toNumber(row.quantity) * toNumber(row.unit_price))}
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
              placeholder="Provide reason or refund notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
            ></textarea>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Credit Credit</span>
              <span className="text-base font-extrabold font-mono text-amber-600">
                {formatCurrency(totalReturnValuation)}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Submit Return'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Right Sales Returns Log Table */}
      <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Sales Returns Log
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
                <th className="p-3">Customer</th>
                <th className="p-3">Invoice Ref</th>
                <th className="p-3">Reason</th>
                <th className="p-3 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loadingHistory ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400 font-mono">
                    Loading sales returns history...
                  </td>
                </tr>
              ) : returnsHistory.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400">
                    No sales returns logged for this branch.
                  </td>
                </tr>
              ) : (
                returnsHistory.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <span className="font-mono font-bold text-amber-800 block">
                        SR-#{ret.id}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {ret.return_date ? new Date(ret.return_date).toLocaleDateString() : 'N/A'}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-800">
                      {ret.customer_name || 'Walk-in Customer'}
                    </td>
                    <td className="p-3 font-mono text-slate-600">
                      {ret.invoice_number || 'N/A'}
                    </td>
                    <td className="p-3">
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                        {ret.reason || 'DEFECTIVE'}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-amber-600">
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