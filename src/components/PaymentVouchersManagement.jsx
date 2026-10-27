// src/components/PaymentVouchersManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

const toNumber = (val) => (Number.isFinite(Number(val)) ? Number(val) : 0);
const formatCurrency = (val) =>
  `KSh ${toNumber(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function PaymentVouchersManagement({ selectedBranch, onVoucherSuccess }) {
  const [voucherDate, setVoucherDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [payeeName, setPayeeName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [chequeRef, setChequeRef] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [notes, setNotes] = useState('');

  // Voucher Line Items
  const [lineItems, setLineItems] = useState([
    { id: Date.now(), description: '', account_category: 'OFFICE_EXPENSE', amount: '' },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Vouchers History & Print Target
  const [vouchersHistory, setVouchersHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activePrintVoucher, setActivePrintVoucher] = useState(null);

  /* ================= FETCH VOUCHERS HISTORY ================= */
  const fetchVouchersHistory = useCallback(async () => {
    if (!selectedBranch) return;
    setLoadingHistory(true);
    try {
      const res = await API.get(`payment-vouchers/?branch=${encodeURIComponent(selectedBranch)}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setVouchersHistory(data);
    } catch (err) {
      console.error('Failed to fetch payment vouchers history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchVouchersHistory();
  }, [fetchVouchersHistory]);

  /* ================= LINE ITEM CONTROLS ================= */
  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: Date.now(), description: '', account_category: 'OFFICE_EXPENSE', amount: '' },
    ]);
  };

  const handleRemoveLineItem = (id) => {
    if (lineItems.length === 1) return;
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleLineItemChange = (id, field, value) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const totalVoucherAmount = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + toNumber(item.amount), 0);
  }, [lineItems]);

  /* ================= SUBMIT PAYMENT VOUCHER ================= */
  const handleSubmitVoucher = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    if (!selectedBranch) {
      setFeedback({ type: 'error', message: 'Please select a branch first.' });
      return;
    }

    if (!payeeName.trim()) {
      setFeedback({ type: 'error', message: 'Please enter the Payee Name.' });
      return;
    }

    const validLines = lineItems.filter(
      (item) => item.description.trim() && parseFloat(item.amount) > 0
    );

    if (validLines.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Please enter at least one valid line item description and amount.',
      });
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        branch: selectedBranch,
        voucher_date: voucherDate,
        payee_name: payeeName.trim(),
        payment_method: paymentMethod,
        cheque_ref: chequeRef.trim(),
        prepared_by: preparedBy.trim(),
        approved_by: approvedBy.trim(),
        notes: notes.trim(),
        total_amount: totalVoucherAmount.toFixed(2),
        line_items: validLines.map((item) => ({
          description: item.description.trim(),
          account_category: item.account_category,
          amount: parseFloat(item.amount).toFixed(2),
        })),
      };

      const res = await API.post('payment-vouchers/', payload);

      setFeedback({
        type: 'success',
        message: `Payment Voucher successfully created for KSh ${totalVoucherAmount.toLocaleString()}!`,
      });

      // Reset Form
      setPayeeName('');
      setChequeRef('');
      setPreparedBy('');
      setApprovedBy('');
      setNotes('');
      setLineItems([
        { id: Date.now(), description: '', account_category: 'OFFICE_EXPENSE', amount: '' },
      ]);

      fetchVouchersHistory();
      if (onVoucherSuccess) onVoucherSuccess();

      // Trigger preview modal for created voucher
      if (res.data) {
        setActivePrintVoucher(res.data);
      }
    } catch (err) {
      console.error('Failed to create payment voucher:', err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to generate payment voucher.';
      setFeedback({ type: 'error', message: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  /* ================= DOWNLOAD SINGLE VOUCHER AS PDF ================= */
  const handleDownloadSinglePDF = (voucher) => {
    setActivePrintVoucher(voucher);
    setTimeout(() => {
      const element = document.getElementById('printable-payment-voucher');
      if (window.html2pdf && element) {
        const opt = {
          margin: [10, 10, 10, 10],
          filename: `Payment_Voucher_${voucher.voucher_number || voucher.id}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        };
        window.html2pdf().set(opt).from(element).save();
      } else {
        // Fallback to print dialog
        window.print();
      }
    }, 200);
  };

  /* ================= DOWNLOAD ALL VOUCHERS LEDGER AS PDF ================= */
  const handleDownloadLedgerPDF = () => {
    const element = document.getElementById('vouchers-ledger-table-container');
    if (!element) return;

    if (window.html2pdf) {
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Payment_Vouchers_Ledger_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      };
      window.html2pdf().set(opt).from(element).save();
    } else {
      window.print();
    }
  };

  return (
    <div className="max-w-7xl mx-auto font-sans space-y-6">
      {/* Printable CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-payment-voucher, #printable-payment-voucher * {
            visibility: visible;
          }
          #printable-payment-voucher {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex justify-between items-center gap-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Payment Vouchers & Petty Cash Disbursements
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Issue, authorize, print, and download official payment vouchers in PDF format.
          </p>
        </div>
      </div>

      {feedback.message && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold border no-print ${
            feedback.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        {/* LEFT 6 COLS: FORM */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            New Payment Voucher Form
          </h2>

          <form onSubmit={handleSubmitVoucher} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Voucher Date *
                </label>
                <input
                  type="date"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="CASH">Petty Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="MPESA">M-Pesa / Mobile</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Payee Name *
                </label>
                <input
                  type="text"
                  placeholder="Recipient / Vendor name..."
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Cheque / Transaction Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. CHQ-88201 or Ref ID"
                  value={chequeRef}
                  onChange={(e) => setChequeRef(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Line Items Allocation */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  Line Items & Account Allocation ({lineItems.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="text-xs font-bold text-teal-700 hover:text-teal-900 cursor-pointer"
                >
                  + Add Line
                </button>
              </div>

              <div className="space-y-2">
                {lineItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                  >
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        placeholder="Item description / particulars..."
                        value={item.description}
                        onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                        required
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <select
                        value={item.account_category}
                        onChange={(e) => handleLineItemChange(item.id, 'account_category', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                      >
                        <option value="OFFICE_EXPENSE">Office Expense</option>
                        <option value="TRANSPORT">Transport & Freight</option>
                        <option value="UTILITIES">Utilities (Water/Power)</option>
                        <option value="SUPPLIER_SETTLEMENT">Supplier Payment</option>
                        <option value="MAINTENANCE">Repairs & Maintenance</option>
                        <option value="MISCELLANEOUS">Miscellaneous</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Amount"
                        value={item.amount}
                        onChange={(e) => handleLineItemChange(item.id, 'amount', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                        required
                      />
                    </div>

                    <div className="sm:col-span-1 text-right">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(item.id)}
                          className="text-xs text-slate-400 hover:text-rose-600 font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center bg-teal-50 p-3 rounded-2xl border border-teal-200">
                <span className="text-xs font-bold text-teal-900">Total Voucher Amount:</span>
                <span className="text-base font-black font-mono text-teal-900">
                  {formatCurrency(totalVoucherAmount)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Prepared By
                </label>
                <input
                  type="text"
                  placeholder="Officer name..."
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Authorized / Approved By
                </label>
                <input
                  type="text"
                  placeholder="Manager name..."
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-teal-800 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Generating Voucher...' : 'Generate & Save Payment Voucher'}
            </button>
          </form>
        </div>

        {/* RIGHT 6 COLS: VOUCHERS LEDGER TABLE */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Payment Vouchers Ledger</h2>
              <p className="text-xs text-slate-400">Issued vouchers and authorization history</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadLedgerPDF}
                disabled={vouchersHistory.length === 0}
                className="text-xs bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1"
              >
                📄 Download Ledger PDF
              </button>
              <button
                onClick={fetchVouchersHistory}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer"
              >
                Refresh
              </button>
            </div>
          </div>

          <div id="vouchers-ledger-table-container" className="overflow-x-auto bg-white p-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">
                  <th className="p-3">Voucher #</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Payee</th>
                  <th className="p-3 text-right">Total Amount</th>
                  <th className="p-3 text-center no-print">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loadingHistory ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400 font-mono">
                      Loading voucher history...
                    </td>
                  </tr>
                ) : vouchersHistory.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400">
                      No payment vouchers issued for this branch yet.
                    </td>
                  </tr>
                ) : (
                  vouchersHistory.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-teal-800">
                        #{v.voucher_number || v.id}
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {v.voucher_date || v.created_at
                          ? new Date(v.voucher_date || v.created_at).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        {v.payee_name}
                      </td>
                      <td className="p-3 text-right font-mono font-extrabold text-slate-900">
                        {formatCurrency(v.total_amount)}
                      </td>
                      <td className="p-3 text-center no-print">
                        <button
                          onClick={() => handleDownloadSinglePDF(v)}
                          className="bg-teal-50 hover:bg-teal-100 text-teal-800 px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition"
                        >
                          📄 Download PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PRINT / DOWNLOAD MODAL */}
      {activePrintVoucher && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full space-y-6 shadow-2xl relative border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 no-print">
              <h2 className="text-base font-extrabold text-slate-900">Official Payment Voucher</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownloadSinglePDF(activePrintVoucher)}
                  className="bg-teal-700 hover:bg-teal-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold cursor-pointer shadow-xs"
                >
                  📥 Download PDF
                </button>
                <button
                  onClick={() => setActivePrintVoucher(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Voucher Format Target */}
            <div id="printable-payment-voucher" className="p-6 bg-white border border-slate-300 rounded-2xl space-y-6">
              <div className="flex justify-between items-start border-b border-slate-400 pb-4">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-wider uppercase">PAYMENT VOUCHER</h1>
                  <p className="text-xs text-slate-500">Official Financial Disbursement Authorization</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 uppercase block">Voucher No.</span>
                  <span className="text-lg font-black font-mono text-teal-900">
                    #{activePrintVoucher.voucher_number || activePrintVoucher.id}
                  </span>
                  <span className="text-xs text-slate-500 font-mono block">
                    Date: {new Date(activePrintVoucher.voucher_date || activePrintVoucher.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase block">Paid To (Payee):</span>
                  <span className="font-extrabold text-slate-900 text-sm">{activePrintVoucher.payee_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block">Payment Method & Ref:</span>
                  <span className="font-bold text-slate-800">
                    {activePrintVoucher.payment_method || 'CASH'}{' '}
                    {activePrintVoucher.cheque_ref ? `(Ref: ${activePrintVoucher.cheque_ref})` : ''}
                  </span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] text-slate-600 uppercase font-black border-b border-slate-300">
                      <th className="p-2.5 border-r border-slate-300">Particulars / Description</th>
                      <th className="p-2.5 border-r border-slate-300">Account Allocation</th>
                      <th className="p-2.5 text-right">Amount (KSh)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs font-medium">
                    {Array.isArray(activePrintVoucher.line_items) && activePrintVoucher.line_items.length > 0 ? (
                      activePrintVoucher.line_items.map((line, i) => (
                        <tr key={i}>
                          <td className="p-2.5 border-r border-slate-300">{line.description}</td>
                          <td className="p-2.5 border-r border-slate-300 uppercase font-mono text-[10px] text-slate-600">
                            {String(line.account_category || 'EXPENSE').replace(/_/g, ' ')}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold">
                            {formatCurrency(line.amount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="p-2.5 border-r border-slate-300">{activePrintVoucher.notes || 'General Payment'}</td>
                        <td className="p-2.5 border-r border-slate-300">GENERAL</td>
                        <td className="p-2.5 text-right font-mono font-bold">
                          {formatCurrency(activePrintVoucher.total_amount)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-400 bg-slate-50 font-black text-xs">
                      <td colSpan="2" className="p-2.5 text-right uppercase tracking-wider">
                        Total Paid:
                      </td>
                      <td className="p-2.5 text-right font-mono text-sm text-teal-900">
                        {formatCurrency(activePrintVoucher.total_amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures Section */}
              <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                <div className="border-t border-slate-400 pt-1 text-center">
                  <span>Prepared By</span>
                  <p className="font-mono text-slate-900 mt-1">{activePrintVoucher.prepared_by || '________________'}</p>
                </div>
                <div className="border-t border-slate-400 pt-1 text-center">
                  <span>Approved By</span>
                  <p className="font-mono text-slate-900 mt-1">{activePrintVoucher.approved_by || '________________'}</p>
                </div>
                <div className="border-t border-slate-400 pt-1 text-center">
                  <span>Receiver Signature</span>
                  <p className="font-mono text-slate-900 mt-1">________________</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}