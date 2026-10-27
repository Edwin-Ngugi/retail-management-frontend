// src/components/SupplierRegister.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

const toNumber = (val) => (Number.isFinite(Number(val)) ? Number(val) : 0);
const formatCurrency = (val) =>
  `KSh ${toNumber(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function SupplierRegister({ selectedBranch }) {
  const [purchaseRecords, setPurchaseRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  /* ================= FETCH PURCHASES ================= */
  const fetchPurchaseSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      // Endpoint for purchase logs / credit purchases / restocks
      const res = await API.get(`purchases/?branch=${encodeURIComponent(selectedBranch || '')}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setPurchaseRecords(data);
    } catch (err) {
      console.error('Failed to fetch purchase records for suppliers:', err);
      setPurchaseRecords([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchPurchaseSuppliers();
  }, [fetchPurchaseSuppliers]);

  /* ================= AGGREGATE SUPPLIERS FROM PURCHASES ================= */
  const aggregatedSuppliers = useMemo(() => {
    const map = new Map();

    purchaseRecords.forEach((record) => {
      // Determine supplier identifier & name
      const supplierName =
        record.supplier_name ||
        record.supplier?.name ||
        record.vendor_name ||
        (typeof record.supplier === 'string' ? record.supplier : null) ||
        'Unspecified Supplier';

      const key = supplierName.trim().toLowerCase();
      if (!key) return;

      const recordAmount = toNumber(
        record.total_amount ?? record.amount ?? record.total_cost ?? 0
      );
      const recordDate = record.purchase_date || record.created_at || record.date;

      if (!map.has(key)) {
        map.set(key, {
          id: record.supplier_id || record.supplier?.id || key,
          name: supplierName,
          phone: record.supplier_phone || record.supplier?.phone || record.phone || '-',
          email: record.supplier_email || record.supplier?.email || record.email || '-',
          kra_pin: record.kra_pin || record.supplier?.kra_pin || '-',
          purchase_count: 1,
          total_purchased: recordAmount,
          last_purchase_date: recordDate,
        });
      } else {
        const existing = map.get(key);
        existing.purchase_count += 1;
        existing.total_purchased += recordAmount;
        if (recordDate && new Date(recordDate) > new Date(existing.last_purchase_date)) {
          existing.last_purchase_date = recordDate;
        }
      }
    });

    return Array.from(map.values());
  }, [purchaseRecords]);

  /* ================= SEARCH FILTER ================= */
  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return aggregatedSuppliers;
    return aggregatedSuppliers.filter((s) => {
      const nameMatch = String(s.name || '').toLowerCase().includes(term);
      const phoneMatch = String(s.phone || '').toLowerCase().includes(term);
      const pinMatch = String(s.kra_pin || '').toLowerCase().includes(term);
      return nameMatch || phoneMatch || pinMatch;
    });
  }, [aggregatedSuppliers, searchTerm]);

  /* ================= EXPORT CSV ================= */
  const handleExportCSV = () => {
    if (filteredSuppliers.length === 0) return;
    const headers = ['Supplier Name', 'Phone', 'KRA PIN', 'Total Orders', 'Total Purchased (KSh)', 'Last Purchase Date'];
    const rows = filteredSuppliers.map((s) => [
      `"${String(s.name || '').replace(/"/g, '""')}"`,
      `"${String(s.phone || '').replace(/"/g, '""')}"`,
      `"${String(s.kra_pin || '').replace(/"/g, '""')}"`,
      s.purchase_count,
      s.total_purchased.toFixed(2),
      s.last_purchase_date ? new Date(s.last_purchase_date).toLocaleDateString() : 'N/A',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Purchase_Suppliers_Register_${new Date().toISOString().split('T')[0]}.csv`);
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
          #supplier-register-print-area, #supplier-register-print-area * { visibility: visible; }
          #supplier-register-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Supplier Register</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Directory of suppliers captured from recorded cash and credit purchases.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search supplier, phone, PIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-teal-500 w-64"
          />

          <button
            onClick={fetchPurchaseSuppliers}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Refresh
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredSuppliers.length === 0}
            className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
             Export CSV
          </button>

          <button
            onClick={handleExportPDF}
            disabled={filteredSuppliers.length === 0}
            className="bg-teal-800 hover:bg-teal-700 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
             Download PDF
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div id="supplier-register-print-area" className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="hidden print:block border-b border-slate-300 pb-3 mb-4">
          <h1 className="text-xl font-black text-slate-900">PURCHASE SUPPLIERS REGISTER</h1>
          <p className="text-xs text-slate-500">Generated on: {new Date().toLocaleDateString()} | Total Suppliers Listed: {filteredSuppliers.length}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">
                <th className="p-3">Supplier Name</th>
                <th className="p-3">Contact Details</th>
                <th className="p-3 text-center">Purchase Orders</th>
                <th className="p-3 font-mono">Last Purchase Date</th>
                <th className="p-3 text-right">Total Purchased Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400 font-mono">
                    Loading purchase suppliers...
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400">
                    No suppliers found from recorded purchases.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s, idx) => (
                  <tr key={s.id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-900">
                      {s.name}
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-slate-800 block">{s.phone}</span>
                      {s.email !== '-' && <span className="text-[10px] text-slate-400 block">{s.email}</span>}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700">
                      {s.purchase_count} batch(es)
                    </td>
                    <td className="p-3 font-mono text-slate-600">
                      {s.last_purchase_date ? new Date(s.last_purchase_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-3 text-right font-mono font-extrabold text-teal-800">
                      {formatCurrency(s.total_purchased)}
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