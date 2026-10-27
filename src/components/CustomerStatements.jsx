// src/components/CustomerStatements.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

const toNumber = (val) => (Number.isFinite(Number(val)) ? Number(val) : 0);
const formatCurrency = (val) =>
  `KSh ${toNumber(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function CustomerStatements({ selectedBranch }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [statementData, setStatementData] = useState(null);
  const [loading, setLoading] = useState(false);

  /* ================= FETCH CUSTOMERS LIST ================= */
  const fetchCustomers = useCallback(async () => {
    try {
      const res = await API.get('customers/');
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setCustomers(data);
    } catch (err) {
      console.error('Failed to fetch customers for statements:', err);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  /* ================= FETCH STATEMENT DATA ================= */
  const fetchStatement = useCallback(async () => {
    if (!selectedCustomerId) return;
    setLoading(true);
    try {
      let url = `customer-statements/${selectedCustomerId}/?branch=${encodeURIComponent(selectedBranch || '')}`;
      if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
      if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;

      const res = await API.get(url);
      setStatementData(res.data);
    } catch (err) {
      console.error('Failed to fetch customer statement:', err);
      setStatementData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerId, selectedBranch, startDate, endDate]);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchStatement();
    }
  }, [selectedCustomerId, fetchStatement]);

  const selectedCustomerObj = useMemo(() => {
    return customers.find((c) => String(c.id) === String(selectedCustomerId));
  }, [customers, selectedCustomerId]);

  const transactions = Array.isArray(statementData?.transactions) ? statementData.transactions : [];

  const handlePrintStatement = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto font-sans space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #customer-statement-print-area, #customer-statement-print-area * { visibility: visible; }
          #customer-statement-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Controls Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Customer Account Statement</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit credit sales invoices, customer receipts, credit notes, and running debtor balance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer min-w-[200px]"
          >
            <option value="">-- Select Customer --</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.customer_name} ({c.phone || 'No Phone'})
              </option>
            ))}
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 outline-none"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 outline-none"
          />

          <button
            onClick={fetchStatement}
            disabled={!selectedCustomerId}
            className="bg-teal-800 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-extrabold transition cursor-pointer"
          >
            Generate Statement
          </button>

          {statementData && (
            <button
              onClick={handlePrintStatement}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-2 rounded-xl font-bold transition cursor-pointer"
            >
              🖨️ Print Statement PDF
            </button>
          )}
        </div>
      </div>

      {/* Statement Area */}
      {!selectedCustomerId ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-xs text-center text-slate-400 text-xs font-mono">
          Select a customer above to view their statement ledger.
        </div>
      ) : (
        <div id="customer-statement-print-area" className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          {/* Header Banner */}
          <div className="flex justify-between items-start border-b border-slate-300 pb-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wide">STATEMENT OF ACCOUNT</h2>
              <p className="text-xs text-slate-500">Debtor Account Activity Summary</p>
              <div className="mt-2 text-xs">
                <span className="font-extrabold text-slate-900 text-sm block">{selectedCustomerObj?.name || selectedCustomerObj?.customer_name}</span>
                <span className="text-slate-500 block">Phone: {selectedCustomerObj?.phone || selectedCustomerObj?.phone_number || 'N/A'}</span>
                {selectedCustomerObj?.email && <span className="text-slate-500 block">Email: {selectedCustomerObj.email}</span>}
              </div>
            </div>

            <div className="text-right text-xs">
              <span className="text-slate-400 font-bold uppercase block">Date Printed</span>
              <span className="font-mono font-bold text-slate-800 block">{new Date().toLocaleDateString()}</span>
              {startDate && endDate && (
                <span className="text-[10px] text-slate-400 block font-mono mt-1">
                  Period: {startDate} to {endDate}
                </span>
              )}
              <div className="mt-3 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                <span className="text-[10px] text-rose-700 font-bold uppercase block">Total Outstanding Balance</span>
                <span className="text-lg font-black font-mono text-rose-900">
                  {formatCurrency(statementData?.current_balance ?? selectedCustomerObj?.outstanding_balance ?? 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">
                  <th className="p-3">Date</th>
                  <th className="p-3">Particulars / Description</th>
                  <th className="p-3 text-right">Debit Sales (KSh)</th>
                  <th className="p-3 text-right">Credit Payment (KSh)</th>
                  <th className="p-3 text-right">Balance Due (KSh)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400 font-mono">
                      Generating account statement...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400">
                      No statement transactions recorded for this customer in the selected range.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono text-slate-600">
                        {tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800 block">{tx.description || tx.type}</span>
                        {tx.reference && <span className="text-[10px] text-slate-400 font-mono block">Invoice / Ref: {tx.reference}</span>}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-900">
                        {tx.debit_amount > 0 ? formatCurrency(tx.debit_amount) : '-'}
                      </td>
                      <td className="p-3 text-right font-mono text-teal-700 font-semibold">
                        {tx.credit_amount > 0 ? formatCurrency(tx.credit_amount) : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-extrabold text-slate-900">
                        {formatCurrency(tx.running_balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}