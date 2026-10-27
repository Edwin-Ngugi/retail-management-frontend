// src/components/SupplierOutstandingBalances.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

const toNumber = (val) => (Number.isFinite(Number(val)) ? Number(val) : 0);
const formatCurrency = (val) =>
  `KSh ${toNumber(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function SupplierOutstandingBalances({ selectedBranch, onPaySupplierClick }) {
  const [payables, setPayables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  /* ================= FETCH OUTSTANDING PAYABLES ================= */
  const fetchOutstandingBalances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(`suppliers/outstanding/?branch=${encodeURIComponent(selectedBranch || '')}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setPayables(data);
    } catch (err) {
      console.error('Failed to fetch supplier payables:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchOutstandingBalances();
  }, [fetchOutstandingBalances]);

  const filteredPayables = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return payables;
    return payables.filter((p) => {
      const name = String(p.name || p.supplier_name || '').toLowerCase();
      const phone = String(p.phone || '').toLowerCase();
      return name.includes(term) || phone.includes(term);
    });
  }, [payables, searchTerm]);

  const totalOutstanding = useMemo(() => {
    return filteredPayables.reduce((sum, item) => sum + toNumber(item.outstanding_balance ?? item.balance ?? 0), 0);
  }, [filteredPayables]);

  const handleExportCSV = () => {
    if (filteredPayables.length === 0) return;
    const headers = ['Supplier Name', 'Phone', 'Pending Invoices', 'Total Outstanding Payable (KSh)'];
    const rows = filteredPayables.map((p) => [
      `"${String(p.name || p.supplier_name || '').replace(/"/g, '""')}"`,
      `"${String(p.phone || '').replace(/"/g, '""')}"`,
      p.pending_invoices_count || 0,
      toNumber(p.outstanding_balance ?? p.balance ?? 0).toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Supplier_Outstanding_Balances_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto font-sans space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Supplier Outstanding Balances</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Accounts payable liability summary and unpaid supplier credit bills.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search creditor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-teal-500 w-60"
          />

          <button
            onClick={handleExportCSV}
            disabled={filteredPayables.length === 0}
            className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            📊 Export CSV
          </button>
        </div>
      </div>

      {/* Exposure Summary Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex justify-between items-center">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Accounts Payable Liability</span>
          <span className="text-3xl font-black font-mono text-rose-700">{formatCurrency(totalOutstanding)}</span>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-slate-500 block">Creditors with Unpaid Balances</span>
          <span className="text-xl font-black font-mono text-slate-900">{filteredPayables.length} Suppliers</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h2 className="text-base font-extrabold text-slate-900">Unpaid Creditors Ledger</h2>
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
                <th className="p-3">Supplier Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3 text-center">Unpaid Bills Count</th>
                <th className="p-3 text-right">Outstanding Balance</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400 font-mono">
                    Loading payable balances...
                  </td>
                </tr>
              ) : filteredPayables.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400">
                    No outstanding supplier balances recorded.
                  </td>
                </tr>
              ) : (
                filteredPayables.map((p) => {
                  const bal = toNumber(p.outstanding_balance ?? p.balance ?? 0);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{p.name || p.supplier_name}</td>
                      <td className="p-3 font-mono text-slate-600">{p.phone || '-'}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-700">
                        {p.pending_invoices_count || 1}
                      </td>
                      <td className="p-3 text-right font-mono font-extrabold text-rose-700">
                        {formatCurrency(bal)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => onPaySupplierClick && onPaySupplierClick(p)}
                          className="bg-teal-800 hover:bg-teal-700 text-white px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Make Payment
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