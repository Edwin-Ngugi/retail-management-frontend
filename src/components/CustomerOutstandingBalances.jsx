// src/components/CustomerOutstandingBalances.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

const toNumber = (val) => (Number.isFinite(Number(val)) ? Number(val) : 0);
const formatCurrency = (val) =>
  `KSh ${toNumber(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function CustomerOutstandingBalances({ selectedBranch, onReceivePaymentClick }) {
  const [debtors, setDebtors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  /* ================= FETCH OUTSTANDING RECEIVABLES ================= */
  const fetchOutstandingBalances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(`customers/outstanding/?branch=${encodeURIComponent(selectedBranch || '')}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setDebtors(data);
    } catch (err) {
      console.error('Failed to fetch customer receivables:', err);
      setDebtors([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchOutstandingBalances();
  }, [fetchOutstandingBalances]);

  /* ================= SEARCH FILTER ================= */
  const filteredDebtors = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return debtors;
    return debtors.filter((d) => {
      const name = String(d.name || d.customer_name || '').toLowerCase();
      const phone = String(d.phone || d.phone_number || '').toLowerCase();
      const code = String(d.code || d.customer_code || '').toLowerCase();
      return name.includes(term) || phone.includes(term) || code.includes(term);
    });
  }, [debtors, searchTerm]);

  /* ================= TOTALS ================= */
  const totalReceivable = useMemo(() => {
    return filteredDebtors.reduce((sum, item) => sum + toNumber(item.outstanding_balance ?? item.balance ?? 0), 0);
  }, [filteredDebtors]);

  /* ================= EXPORT CSV ================= */
  const handleExportCSV = () => {
    if (filteredDebtors.length === 0) return;
    const headers = ['Customer Name', 'Phone', 'Unpaid Invoices Count', 'Total Outstanding Balance (KSh)'];
    const rows = filteredDebtors.map((d) => [
      `"${String(d.name || d.customer_name || '').replace(/"/g, '""')}"`,
      `"${String(d.phone || d.phone_number || '').replace(/"/g, '""')}"`,
      d.unpaid_invoices_count || d.pending_invoices_count || 1,
      toNumber(d.outstanding_balance ?? d.balance ?? 0).toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Customer_Outstanding_Balances_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ================= EXPORT PDF ================= */
  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto font-sans space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #customer-outstanding-print-area, #customer-outstanding-print-area * { visibility: visible; }
          #customer-outstanding-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Customer Outstanding Balances
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Accounts receivable summary, customer debt exposure, and unpaid credit invoices.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search debtor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-teal-500 w-60"
          />

          <button
            onClick={handleExportCSV}
            disabled={filteredDebtors.length === 0}
            className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            📊 CSV
          </button>

          <button
            onClick={handleExportPDF}
            disabled={filteredDebtors.length === 0}
            className="bg-teal-800 hover:bg-teal-700 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            📄 PDF
          </button>
        </div>
      </div>

      {/* Receivables Summary Dashboard Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex justify-between items-center no-print">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Accounts Receivable Exposure
          </span>
          <span className="text-3xl font-black font-mono text-rose-700">
            {formatCurrency(totalReceivable)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-slate-500 block">Debtors with Active Balances</span>
          <span className="text-xl font-black font-mono text-slate-900">{filteredDebtors.length} Customers</span>
        </div>
      </div>

      {/* Table Area */}
      <div id="customer-outstanding-print-area" className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="hidden print:block border-b border-slate-300 pb-3 mb-4">
          <h1 className="text-xl font-black text-slate-900">ACCOUNTS RECEIVABLE OUTSTANDING BALANCES</h1>
          <p className="text-xs text-slate-500">Date: {new Date().toLocaleDateString()} | Total Outstanding Exposure: {formatCurrency(totalReceivable)}</p>
        </div>

        <div className="flex justify-between items-center border-b border-slate-100 pb-3 no-print">
          <h2 className="text-base font-extrabold text-slate-900">Active Debtors Ledger</h2>
          <button
            onClick={fetchOutstandingBalances}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">
                <th className="p-3">Customer Name</th>
                <th className="p-3">Phone Number</th>
                <th className="p-3 text-center">Unpaid Invoices</th>
                <th className="p-3 text-right">Outstanding Balance</th>
                <th className="p-3 text-center no-print">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400 font-mono">
                    Loading customer accounts receivable...
                  </td>
                </tr>
              ) : filteredDebtors.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400">
                    No active customer credit balances found.
                  </td>
                </tr>
              ) : (
                filteredDebtors.map((d, idx) => {
                  const bal = toNumber(d.outstanding_balance ?? d.balance ?? 0);
                  return (
                    <tr key={d.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-slate-900">
                        {d.name || d.customer_name}
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {d.phone || d.phone_number || '-'}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-700">
                        {d.unpaid_invoices_count || d.pending_invoices_count || 1}
                      </td>
                      <td className="p-3 text-right font-mono font-extrabold text-rose-700">
                        {formatCurrency(bal)}
                      </td>
                      <td className="p-3 text-center no-print">
                        <button
                          onClick={() => onReceivePaymentClick && onReceivePaymentClick(d)}
                          className="bg-teal-800 hover:bg-teal-700 text-white px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Receive Payment
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}