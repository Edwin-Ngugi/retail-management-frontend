// src/components/SupplierPaymentManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

const toNumber = (val) => (Number.isFinite(Number(val)) ? Number(val) : 0);
const formatCurrency = (val) =>
  `KSh ${toNumber(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function SupplierPaymentManagement({ selectedBranch, onPaymentSuccess }) {
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  
  // Pending Credit Purchase Invoices for selected supplier
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Supplier Payments History
  const [paymentsHistory, setPaymentsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  /* ================= FETCH SUPPLIERS ================= */
  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await API.get('suppliers/');
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setSuppliers(data);
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    }
  }, []);

  /* ================= FETCH PENDING INVOICES FOR SUPPLIER ================= */
  const fetchPendingInvoices = useCallback(async (supplierId) => {
    if (!supplierId) {
      setPendingInvoices([]);
      return;
    }
    setLoadingInvoices(true);
    try {
      const res = await API.get(
        `credit-purchases/?supplier=${supplierId}&status=UNPAID&branch=${encodeURIComponent(selectedBranch)}`
      );
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setPendingInvoices(data);
    } catch (err) {
      console.error('Failed to fetch pending invoices:', err);
      setPendingInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (selectedSupplierId) {
      fetchPendingInvoices(selectedSupplierId);
    } else {
      setPendingInvoices([]);
      setSelectedInvoiceId('');
    }
  }, [selectedSupplierId, fetchPendingInvoices]);

  /* ================= FETCH SUPPLIER PAYMENTS HISTORY ================= */
  const fetchSupplierPaymentsHistory = useCallback(async () => {
    if (!selectedBranch) return;
    setLoadingHistory(true);
    try {
      const res = await API.get(`supplier-payments/?branch=${encodeURIComponent(selectedBranch)}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setPaymentsHistory(data);
    } catch (err) {
      console.error('Failed to fetch supplier payments history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchSuppliers();
    fetchSupplierPaymentsHistory();
  }, [fetchSuppliers, fetchSupplierPaymentsHistory]);

  const selectedSupplierObj = useMemo(() => {
    return suppliers.find((s) => String(s.id) === String(selectedSupplierId));
  }, [suppliers, selectedSupplierId]);

  const selectedInvoiceObj = useMemo(() => {
    return pendingInvoices.find((i) => String(i.id) === String(selectedInvoiceId));
  }, [pendingInvoices, selectedInvoiceId]);

  // When an invoice is selected, auto-fill the payment amount with its remaining due balance
  const handleInvoiceSelect = (invoiceId) => {
    setSelectedInvoiceId(invoiceId);
    const inv = pendingInvoices.find((i) => String(i.id) === String(invoiceId));
    if (inv) {
      const remainingDue = toNumber(inv.balance_due ?? inv.amount_due ?? inv.total_amount);
      setAmount(remainingDue > 0 ? String(remainingDue) : '');
    }
  };

  /* ================= SUBMIT PAYMENT ================= */
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    if (!selectedBranch) {
      setFeedback({ type: 'error', message: 'Please select a branch first.' });
      return;
    }

    if (!selectedSupplierId) {
      setFeedback({ type: 'error', message: 'Please select a supplier.' });
      return;
    }

    const numericAmount = parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid positive payment amount.' });
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        branch: selectedBranch,
        supplier: selectedSupplierId,
        purchase_invoice: selectedInvoiceId || null,
        payment_date: paymentDate,
        amount: numericAmount.toFixed(2),
        payment_method: paymentMethod,
        reference: reference.trim(),
        notes: notes.trim() || (selectedInvoiceObj ? `Payment for Credit Purchase #${selectedInvoiceObj.id}` : 'General Credit Settlement'),
      };

      await API.post('supplier-payments/', payload);

      setFeedback({
        type: 'success',
        message: `Accounts Payable Settlement of KSh ${numericAmount.toLocaleString()} to "${
          selectedSupplierObj?.name || 'Supplier'
        }" saved successfully!`,
      });

      // Reset form
      setAmount('');
      setReference('');
      setNotes('');
      setSelectedInvoiceId('');

      // Refresh supplier invoices and history
      fetchPendingInvoices(selectedSupplierId);
      fetchSupplierPaymentsHistory();
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err) {
      console.error('Failed to record supplier payment:', err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to process payable settlement.';
      setFeedback({ type: 'error', message: errMsg });
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
            Accounts Payable & Credit Purchase Settlements
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Settle outstanding balances for inventory and goods purchased on credit from suppliers.
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

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT 5 COLS: FORM */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4 h-fit">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Pay Credit Supplier (Payables)
          </h2>

          <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Payment Date *
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                required
              />
            </div>

            {/* Supplier Picker */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">
                  Select Credit Supplier *
                </label>
                {selectedSupplierObj && (
                  <span className="text-[10px] font-bold text-rose-700 font-mono">
                    Total Due: {formatCurrency(selectedSupplierObj.outstanding_balance)}
                  </span>
                )}
              </div>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                required
              >
                <option value="">-- Choose Creditor / Vendor --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.outstanding_balance ? `(Payable: KSh ${toNumber(s.outstanding_balance).toLocaleString()})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Credit Invoice/Bill Picker */}
            {selectedSupplierId && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Target Credit Purchase Bill / Invoice
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => handleInvoiceSelect(e.target.value)}
                  disabled={loadingInvoices}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="">-- General Account Settlement --</option>
                  {pendingInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      Bill #{inv.id} ({new Date(inv.created_at || inv.purchase_date).toLocaleDateString()}) - Due: KSh {toNumber(inv.balance_due ?? inv.total_amount).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="MPESA">M-Pesa / Mobile</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Amount Paid (KSh) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Cheque / Transaction Ref Number
              </label>
              <input
                type="text"
                placeholder="e.g. CHQ-00124 or M-Pesa Ref ID"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Notes / Reference
              </label>
              <textarea
                rows="2"
                placeholder="e.g. Settlement for timber supply..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-teal-800 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Processing Payment...' : 'Submit Payable Settlement'}
            </button>
          </form>
        </div>

        {/* RIGHT 7 COLS: PAYABLE SETTLEMENT HISTORY TABLE */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Payables Settlement History</h2>
              <p className="text-xs text-slate-400">Strictly supplier repayments for credit purchases</p>
            </div>
            <button
              onClick={fetchSupplierPaymentsHistory}
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
                  <th className="p-3">Supplier Name</th>
                  <th className="p-3">Method / Ref</th>
                  <th className="p-3">Notes</th>
                  <th className="p-3 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loadingHistory ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400 font-mono">
                      Loading supplier payment ledger...
                    </td>
                  </tr>
                ) : paymentsHistory.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400">
                      No payable payments recorded for this branch yet.
                    </td>
                  </tr>
                ) : (
                  paymentsHistory.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono text-slate-600">
                        {p.payment_date || p.created_at
                          ? new Date(p.payment_date || p.created_at).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        {p.supplier_name || p.supplier?.name || `Supplier #${p.supplier}`}
                      </td>
                      <td className="p-3">
                        <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase block w-fit">
                          {p.payment_method || 'CASH'}
                        </span>
                        {p.reference && (
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            Ref: {p.reference}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-500 max-w-xs truncate">
                        {p.notes || p.description || 'Credit Purchase Settlement'}
                      </td>
                      <td className="p-3 text-right font-mono font-extrabold text-teal-800">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}