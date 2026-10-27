// src/components/ReceiptsLogManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import API from '../api';
import { useBranch } from '../components/BranchContext';

export default function ReceiptsLogManagement({ mode = 'other_receipts', onReceiptAdded }) {
  const { selectedBranch } = useBranch();
  const [receipts, setReceipts] = useState([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    payment_method: 'CASH',
  });
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchReceipts = useCallback(() => {
    setLoading(true);
    const params = selectedBranch ? { branch: selectedBranch } : {};
    API.get('other-receipts/', { params })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setReceipts(data);
      })
      .catch((err) => console.error('Failed to load receipts:', err))
      .finally(() => setLoading(false));
  }, [selectedBranch]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        ...(selectedBranch && { branch: selectedBranch }),
      };
      await API.post('other-receipts/', payload);
      setStatusMsg('Receipt recorded successfully!');
      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        payment_method: 'CASH',
      });
      fetchReceipts();
      if (onReceiptAdded) onReceiptAdded();
    } catch (err) {
      setStatusMsg('Failed to record receipt. Please try again.');
    }
  };

  const handlePrintReceipt = (receipt) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt #${receipt.id || 'OFFICIAL'}</title>
          <style>
            body { font-family: monospace; padding: 20px; width: 300px; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .title { font-weight: bold; font-size: 14px; }
            .row { display: flex; justify-content: space-between; margin: 6px 0; }
            .total { border-top: 1px dashed #000; margin-top: 10px; padding-top: 5px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">MELVEX BUSINESS SOLUTIONS</div>
            <div>Other Receipts Voucher</div>
            <div>Date: ${receipt.date || new Date().toLocaleDateString()}</div>
          </div>
          <div class="row"><span>Description:</span> <span>${receipt.description}</span></div>
          <div class="row"><span>Method:</span> <span>${receipt.payment_method || 'CASH'}</span></div>
          <div class="total row"><span>AMOUNT RECEIVED:</span> <span>KSh ${Number(receipt.amount).toFixed(2)}</span></div>
          <br/>
          <center>Official Income Record</center>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
      {/* 1. Left Form Card */}
      <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200">
        <h2 className="text-xl font-semibold mb-4 text-slate-800">Record Other Income / Receipt</h2>
        
        {statusMsg && (
          <p className="mb-4 text-xs p-2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
            {statusMsg}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              style={{ colorScheme: 'light' }}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium [color-scheme:light]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Description / Source</label>
            <input
              type="text"
              placeholder="e.g. Donation, Interest, Capital Injection"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={{ colorScheme: 'light' }}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium [color-scheme:light]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Method</label>
            <select
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
            >
              <option value="CASH">Cash</option>
              <option value="MPESA">M-Pesa</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="PAYBILL">Paybill</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Amount (KSh)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              style={{ colorScheme: 'light' }}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium [color-scheme:light]"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 transition cursor-pointer"
          >
            Save Receipt
          </button>
        </form>
      </div>

      {/* 2. Right History Table Card */}
      <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-xs border border-slate-200">
        <h2 className="text-xl font-semibold mb-4 text-slate-800">Other Receipts History</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 text-xs text-slate-500 uppercase font-semibold">
                <th className="p-3">Date</th>
                <th className="p-3">Description</th>
                <th className="p-3">Method</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-4 text-center text-slate-400 text-xs">Loading receipt records...</td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-4 text-center text-slate-400 text-xs">No other receipts recorded yet.</td>
                </tr>
              ) : (
                receipts.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-600">{rec.date}</td>
                    <td className="p-3 text-slate-800">{rec.description}</td>
                    <td className="p-3"><span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-700">{rec.payment_method || 'CASH'}</span></td>
                    <td className="p-3 text-right font-semibold text-emerald-600">KSh {Number(rec.amount).toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handlePrintReceipt(rec)}
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded font-semibold border border-slate-200 transition cursor-pointer"
                      >
                        Print
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
  );
}