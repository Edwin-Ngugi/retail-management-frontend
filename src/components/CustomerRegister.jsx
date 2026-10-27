// src/components/CustomerRegister.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

const toNumber = (val) => (Number.isFinite(Number(val)) ? Number(val) : 0);
const formatCurrency = (val) =>
  `KSh ${toNumber(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function CustomerRegister({ selectedBranch }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  /* ================= FETCH CUSTOMERS / SALES DIRECTORY ================= */
  const fetchCustomerDirectory = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch customers master or compile from sales & credit sales
      const res = await API.get(`customers/?branch=${encodeURIComponent(selectedBranch || '')}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setCustomers(data);
    } catch (err) {
      console.error('Failed to fetch customer directory:', err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchCustomerDirectory();
  }, [fetchCustomerDirectory]);

  /* ================= SEARCH FILTER ================= */
  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return customers;
    return customers.filter((c) => {
      const name = String(c.name || c.customer_name || '').toLowerCase();
      const phone = String(c.phone || c.phone_number || '').toLowerCase();
      const code = String(c.code || c.customer_code || '').toLowerCase();
      return name.includes(term) || phone.includes(term) || code.includes(term);
    });
  }, [customers, searchTerm]);

  /* ================= EXPORT CSV ================= */
  const handleExportCSV = () => {
    if (filteredCustomers.length === 0) return;
    const headers = ['Customer Name', 'Phone', 'Email', 'Account Code', 'Total Sales Value (KSh)', 'Current Balance (KSh)'];
    const rows = filteredCustomers.map((c) => [
      `"${String(c.name || c.customer_name || '').replace(/"/g, '""')}"`,
      `"${String(c.phone || c.phone_number || '').replace(/"/g, '""')}"`,
      `"${String(c.email || '').replace(/"/g, '""')}"`,
      `"${String(c.code || c.customer_code || '').replace(/"/g, '""')}"`,
      toNumber(c.total_sales || 0).toFixed(2),
      toNumber(c.outstanding_balance ?? c.balance ?? 0).toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Customer_Register_${new Date().toISOString().split('T')[0]}.csv`);
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
          #customer-register-print-area, #customer-register-print-area * { visibility: visible; }
          #customer-register-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Customer Register Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Master directory of trade credit clients, cash customers, and accounts receivable logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search customer, phone, code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-teal-500 w-64"
          />

          <button
            onClick={fetchCustomerDirectory}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Refresh
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredCustomers.length === 0}
            className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            📊 CSV
          </button>

          <button
            onClick={handleExportPDF}
            disabled={filteredCustomers.length === 0}
            className="bg-teal-800 hover:bg-teal-700 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            📄 PDF
          </button>
        </div>
      </div>

      {/* Directory Table */}
      <div id="customer-register-print-area" className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="hidden print:block border-b border-slate-300 pb-3 mb-4">
          <h1 className="text-xl font-black text-slate-900">CUSTOMER REGISTER DIRECTORY</h1>
          <p className="text-xs text-slate-500">Generated on: {new Date().toLocaleDateString()} | Total Clients: {filteredCustomers.length}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">
                <th className="p-3">Customer Name</th>
                <th className="p-3">Phone / Contact</th>
                <th className="p-3">Account Code</th>
                <th className="p-3 text-right">Lifetime Sales Value</th>
                <th className="p-3 text-right">Outstanding Receivable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400 font-mono">
                    Loading customer directory...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400">
                    No customer records found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c, idx) => {
                  const bal = toNumber(c.outstanding_balance ?? c.balance ?? 0);
                  return (
                    <tr key={c.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-slate-900">
                        {c.name || c.customer_name}
                      </td>
                      <td className="p-3 font-mono text-slate-700">
                        {c.phone || c.phone_number || '-'}
                      </td>
                      <td className="p-3 font-mono text-slate-500">
                        {c.code || c.customer_code || `CUST-${c.id || idx + 1}`}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-800">
                        {formatCurrency(c.total_sales ?? 0)}
                      </td>
                      <td className={`p-3 text-right font-mono font-black ${bal > 0 ? 'text-rose-700' : 'text-teal-800'}`}>
                        {formatCurrency(bal)}
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