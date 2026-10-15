import React, { useState, useMemo } from 'react';
import API from '../api';

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const formatCurrency = (val) => {
  const num = toNumber(val);
  return `KSh ${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export default function RestockManagement({
  items = [],
  selectedBranch,
  onRestockSuccess,
  effectiveRange,
}) {
  const [activeSubTab, setActiveSubTab] = useState('new_order'); // 'new_order' | 'supplier_payables'
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [orderItems, setOrderItems] = useState([
    { id: Date.now(), item_id: '', quantity: '', unit_cost_price: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const safeItems = Array.isArray(items) ? items : [];

  const handleAddItemRow = () => {
    setOrderItems((prev) => [
      ...prev,
      { id: Date.now(), item_id: '', quantity: '', unit_cost_price: '' },
    ]);
  };

  const handleRemoveItemRow = (id) => {
    if (orderItems.length === 1) return;
    setOrderItems((prev) => prev.filter((row) => row.id !== id));
  };

  const handleItemRowChange = (id, field, value) => {
    setOrderItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };

        // Auto-fill cost price when item is selected
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

  const totalOrderValuation = useMemo(() => {
    return orderItems.reduce((acc, row) => {
      const qty = toNumber(row.quantity);
      const cost = toNumber(row.unit_cost_price);
      return acc + qty * cost;
    }, 0);
  }, [orderItems]);

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    if (!selectedBranch) {
      setFeedback({
        type: 'error',
        message: 'Please select a branch before submitting a purchase order.',
      });
      return;
    }

    const validRows = orderItems.filter(
      (row) => row.item_id && toNumber(row.quantity) > 0
    );

    if (validRows.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Please select at least one item with a valid quantity.',
      });
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        request_type: 'RESTOCK_PURCHASE',
        payload: {
          target_branch: selectedBranch,
          branch_id: selectedBranch,
          purchase_date: purchaseDate,
          payment_method: paymentMethod,
          purchases: validRows.map((row) => ({
            item: row.item_id,
            item_id: row.item_id,
            quantity: toNumber(row.quantity),
            unit_cost_price: toNumber(row.unit_cost_price),
            payment_method: paymentMethod,
            purchase_date: purchaseDate,
          })),
        },
      };

      await API.post('pending-approvals/', payload);

      setFeedback({
        type: 'success',
        message:
          'Purchase order submitted to Management for sign-off successfully!',
      });

      // Reset form
      setOrderItems([
        { id: Date.now(), item_id: '', quantity: '', unit_cost_price: '' },
      ]);

      if (onRestockSuccess) onRestockSuccess();
    } catch (err) {
      console.error('Failed to submit purchase order:', err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to submit purchase order. Please try again.';
      setFeedback({ type: 'error', message: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        {/* Header & Sub-tab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Restock & Supplier Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Submit restock requests to Management for approval before inventory updates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('new_order')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'new_order'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              + New Purchase Order
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('supplier_payables')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'supplier_payables'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              💳 Supplier Payables
            </button>
          </div>
        </div>

        {feedback.message && (
          <div
            className={`p-4 rounded-2xl text-xs font-semibold border ${
              feedback.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {activeSubTab === 'new_order' ? (
          <form onSubmit={handleSubmitOrder} className="space-y-6">
            {/* Control Fields Box */}
            <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="CASH">Cash</option>
                  <option value="MPESA">M-Pesa / Mobile Money</option>
                  <option value="PAYBILL">Paybill / Till Transfer</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CREDIT">Supplier Credit (On Account)</option>
                </select>
              </div>
            </div>

            {/* Order Items List */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Order Items ({orderItems.length})
              </span>

              <div className="space-y-3">
                {orderItems.map((row) => {
                  const lineTotal =
                    toNumber(row.quantity) * toNumber(row.unit_cost_price);

                  return (
                    <div
                      key={row.id}
                      className="bg-slate-50/60 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                    >
                      <div className="flex-1 min-w-[200px]">
                        <select
                          value={row.item_id}
                          onChange={(e) =>
                            handleItemRowChange(row.id, 'item_id', e.target.value)
                          }
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                          required
                        >
                          <option value="">-- Choose item --</option>
                          {safeItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.code || 'No Code'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-full sm:w-28">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={row.quantity}
                          onChange={(e) =>
                            handleItemRowChange(row.id, 'quantity', e.target.value)
                          }
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>

                      <div className="w-full sm:w-36">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Unit Cost"
                          value={row.unit_cost_price}
                          onChange={(e) =>
                            handleItemRowChange(
                              row.id,
                              'unit_cost_price',
                              e.target.value
                            )
                          }
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>

                      <div className="sm:w-32 text-right">
                        <span className="text-xs font-bold font-mono text-slate-900 block">
                          {formatCurrency(lineTotal)}
                        </span>
                      </div>

                      {orderItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(row.id)}
                          className="text-slate-400 hover:text-rose-600 text-xs font-bold p-1 transition cursor-pointer self-end sm:self-center"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
              <div>
                <span className="text-xs text-slate-500 font-medium">
                  Total Order Valuation:{' '}
                </span>
                <span className="text-base font-extrabold font-mono text-indigo-600 ml-1">
                  {formatCurrency(totalOrderValuation)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  + Add Another Item
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Purchase Order'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="p-8 text-center text-slate-500 text-xs">
            <p className="font-semibold text-slate-700">
              Supplier Payables Ledger
            </p>
            <p className="mt-1">
              All outstanding credit restock payables are tracked under Management Sign-offs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}