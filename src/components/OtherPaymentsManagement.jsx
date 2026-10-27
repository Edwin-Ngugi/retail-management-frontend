// src/components/OtherPaymentsManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import API from '../api';

const toNumber = (val) => (Number.isFinite(Number(val)) ? Number(val) : 0);
const formatCurrency = (val) =>
  `KSh ${toNumber(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function OtherPaymentsManagement({ selectedBranch, onPaymentSuccess }) {
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [paymentCategory, setPaymentCategory] = useState('LOAN_REPAYMENT');
  const [payeeName, setPayeeName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // History State
  const [paymentsHistory, setPaymentsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  /* ================= FETCH OTHER PAYMENTS HISTORY ================= */
  const fetchOtherPaymentsHistory = useCallback(async () => {
    if (!selectedBranch) return;
    setLoadingHistory(true);
    try {
      const res = await API.get(`other-payments/?branch=${encodeURIComponent(selectedBranch)}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setPaymentsHistory(data);
    } catch (err) {
      console.error('Failed to fetch other payments history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchOtherPaymentsHistory();
  }, [fetchOtherPaymentsHistory]);

  /* ================= SUBMIT PAYMENT ================= */
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    if (!selectedBranch) {
      setFeedback({ type: 'error', message: 'Please select a branch first.' });
      return;
    }

    if (!payeeName.trim()) {
      setFeedback({ type: 'error', message: 'Please enter the Payee / Recipient Name.' });
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
        payment_date: paymentDate,
        category: paymentCategory,
        payee_name: payeeName.trim(),
        amount: numericAmount.toFixed(2),
        payment_method: paymentMethod,
        reference: reference.trim(),
        notes: notes.trim(),
      };

      await API.post('other-payments/', payload);

      setFeedback({
        type: 'success',
        message: `Payment of KSh ${numericAmount.toLocaleString()} to "${payeeName.trim()}" recorded successfully!`,
      });

      // Reset form
      setAmount('');
      setReference('');
      setNotes('');
      setPayeeName('');

      fetchOtherPaymentsHistory();
      if (onPaymentSuccess) onPaymentSuccess();
    } catch (err) {
      console.error('Failed to record other payment:', err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to record payment.';
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
            Other Financial Disbursements
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record non-operating and non-supplier payments like loan repayments, director withdrawals, tax remittances, and capital investments.
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

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT 5 COLS: FORM */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4 h-fit">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Record Other Payment
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

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Payment Category *
              </label>
              <select
                value={paymentCategory}
                onChange={(e) => setPaymentCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="LOAN_REPAYMENT">Bank / Loan Repayment</option>
                <option value="DIRECTOR_DRAWINGS">Director Drawings / Dividends</option>
                <option value="TAX_PAYMENT">Statutory Taxes / KRA Payments</option>
                <option value="ASSET_PURCHASE">Capital Asset / Equipment Purchase</option>
                <option value="REFUND">Customer Refund / Settlement</option>
                <option value="OTHER">Miscellaneous Payment</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Payee / Recipient Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Kenya Revenue Authority, Equity Bank, Director Name..."
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

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
                Cheque / Reference Number
              </label>
              <input
                type="text"
                placeholder="e.g. Bank slip or M-Pesa transaction code"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Description / Purpose
              </label>
              <textarea
                rows="2"
                placeholder="e.g. Monthly loan installment or equipment purchase..."
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
              {submitting ? 'Recording Disbursement...' : 'Submit Payment'}
            </button>
          </form>
        </div>

        {/* RIGHT 7 COLS: PAYMENTS HISTORY TABLE */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Other Payments Ledger</h2>
              <p className="text-xs text-slate-400">Non-supplier & non-operating payment entries</p>
            </div>
            <button
              onClick={fetchOtherPaymentsHistory}
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
                  <th className="p-3">Payee / Category</th>
                  <th className="p-3">Method / Ref</th>
                  <th className="p-3">Notes</th>
                  <th className="p-3 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loadingHistory ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400 font-mono">
                      Loading payment ledger...
                    </td>
                  </tr>
                ) : paymentsHistory.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400">
                      No other payments recorded for this branch yet.
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
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">{p.payee_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono uppercase">
                          {String(p.category || 'OTHER').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase block w-fit">
                          {p.payment_method || 'CASH'}
                        </span>
                        {p.reference && (
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            Ref: {p.reference}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-500 max-w-xs truncate">
                        {p.notes || p.description || '-'}
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