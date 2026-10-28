// src/components/SalesInvoicesManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

const toNumber = (val) => (Number.isFinite(Number(val)) ? Number(val) : 0);
const formatCurrency = (val) =>
  `KSh ${toNumber(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function SalesInvoicesManagement({ selectedBranch }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const fetchInvoices = useCallback(async () => {
    if (!selectedBranch) return;
    setLoading(true);
    try {
      const res = await API.get(`sales/?branch=${encodeURIComponent(selectedBranch)}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setInvoices(data);
    } catch (err) {
      console.error('Failed to fetch sales invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return invoices.filter((inv) => {
      const invNo = String(inv.invoice_number || inv.id || '').toLowerCase();
      const customer = String(inv.customer_name || inv.customer?.name || '').toLowerCase();
      const method = String(inv.payment_method || '').toLowerCase();
      return invNo.includes(term) || customer.includes(term) || method.includes(term);
    });
  }, [invoices, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto font-sans space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Sales Invoices & Receipts</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit history of generated cash & credit invoices for the selected branch.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search invoice #, customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500 w-64"
          />
          <button
            onClick={fetchInvoices}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Main Workspace Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`${selectedInvoice ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">
                  <th className="p-3">Invoice / Date</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3 text-right">Items</th>
                  <th className="p-3 text-right">Total Valuation</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-400 font-mono">
                      Loading sales invoices ledger...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-400">
                      No invoices found for this branch.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <span className="font-mono font-bold text-teal-800 block">
                          {inv.invoice_number || `INV-#${inv.id}`}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {inv.sale_date ? new Date(inv.sale_date).toLocaleDateString() : 'N/A'}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-800">
                        {inv.customer_name || inv.customer?.name || 'Walk-in Customer'}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          inv.payment_method === 'CREDIT'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-teal-100 text-teal-800'
                        }`}>
                          {inv.payment_method || 'CASH'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-slate-700">
                        {inv.items?.length || 1}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-teal-900">
                        {formatCurrency(inv.total_amount)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="bg-slate-100 hover:bg-teal-50 text-teal-700 hover:text-teal-900 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoice Detail Preview Side Panel */}
        {selectedInvoice && (
          <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Invoice Breakdown
                </span>
                <h2 className="text-base font-extrabold text-slate-900 font-mono">
                  {selectedInvoice.invoice_number || `INV-#${selectedInvoice.id}`}
                </h2>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-xs text-slate-400 hover:text-rose-600 font-bold p-1 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-800">
                  {selectedInvoice.customer_name || 'Walk-in Customer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Channel:</span>
                <span className="font-bold uppercase text-teal-700">
                  {selectedInvoice.payment_method}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-mono">
                  {new Date(selectedInvoice.sale_date).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Line Items
              </span>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {(selectedInvoice.items || []).map((item, idx) => (
                  <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-slate-800 block">{item.item_name || item.name || 'Item'}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Qty: {item.quantity_sold} × {formatCurrency(item.unit_selling_price)}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      {formatCurrency(item.total_amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500">Total Invoice Amount</span>
              <span className="text-lg font-black font-mono text-teal-700">
                {formatCurrency(selectedInvoice.total_amount)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}