// src/components/ItemRegister.jsx
import React, { useState, useMemo } from 'react';

const toNumber = (val) => (Number.isFinite(Number(val)) ? Number(val) : 0);

const formatCurrency = (val) =>
  `KSh ${toNumber(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function ItemRegister({ items = [], selectedBranch }) {
  const [searchTerm, setSearchTerm] = useState('');

  const safeItems = Array.isArray(items) ? items : [];

  /* ================= HELPERS FOR ITEM METRICS ================= */
  const getOpeningStock = (item) =>
    toNumber(item.opening_stock ?? item.initial_stock ?? 0);

  const getSoldQty = (item) =>
    toNumber(item.quantity_sold ?? item.total_sold ?? 0);

  const getRestockQty = (item) =>
    toNumber(item.quantity_restocked ?? item.total_restocked ?? 0);

  const getRemainingStock = (item) => {
    if (item.remaining_stock !== undefined && item.remaining_stock !== null) {
      return toNumber(item.remaining_stock);
    }
    if (item.current_stock !== undefined && item.current_stock !== null) {
      return toNumber(item.current_stock);
    }
    return getOpeningStock(item) + getRestockQty(item) - getSoldQty(item);
  };

  const getCostPrice = (item) =>
    toNumber(
      item.unit_cost_price ?? item.cost_price ?? item.unit_cost ?? 0
    );

  const getWAC = (item) =>
    toNumber(
      item.wac ??
        item.weighted_average_cost ??
        item.unit_wac ??
        getCostPrice(item)
    );

  const getRetailPrice = (item) =>
    toNumber(
      item.unit_retail_price ??
        item.unit_price ??
        item.selling_price ??
        item.retail_price ??
        0
    );

  /* ================= SEARCH FILTERING ================= */
  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return safeItems;
    return safeItems.filter((item) => {
      const name = String(item.name || '').toLowerCase();
      const code = String(item.code || item.item_code || '').toLowerCase();
      return name.includes(term) || code.includes(term);
    });
  }, [safeItems, searchTerm]);

  /* ================= CSV EXPORT FUNCTION ================= */
  const handleExportCSV = () => {
    if (filteredItems.length === 0) return;

    const headers = [
      'Item Name',
      'Opening Stock',
      'Sold',
      'Restock',
      'Remaining Stock',
      'Current Cost Price (KSh)',
      'WAC (KSh)',
      'Retail Price (KSh)',
    ];

    const rows = filteredItems.map((item) => [
      `"${String(item.name || '').replace(/"/g, '""')}"`,
      getOpeningStock(item),
      getSoldQty(item),
      getRestockQty(item),
      getRemainingStock(item),
      getCostPrice(item).toFixed(2),
      getWAC(item).toFixed(2),
      getRetailPrice(item).toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Item_Register_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ================= PDF EXPORT FUNCTION ================= */
  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto font-sans space-y-6">
      {/* Printable CSS Styling for PDF Export */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #item-register-print-area, #item-register-print-area * {
            visibility: visible;
          }
          #item-register-print-area {
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

      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Item Register
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete inventory stock balance, cost valuation, weighted average cost, and pricing catalog.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search items by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-teal-500 w-64"
          />

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredItems.length === 0}
            className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 border border-slate-300 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <span>📊 Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={filteredItems.length === 0}
            className="bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <span>📄 Download PDF</span>
          </button>
        </div>
      </div>

      {/* Main Table Card (Print Target) */}
      <div id="item-register-print-area" className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        {/* Printable Header */}
        <div className="hidden print:block border-b border-slate-300 pb-3 mb-4">
          <h1 className="text-xl font-black text-slate-900">INVENTORY ITEM REGISTER REPORT</h1>
          <p className="text-xs text-slate-500">
            Generated on: {new Date().toLocaleDateString()} | Total Items Listed: {filteredItems.length}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">
                <th className="p-3">Item Name</th>
                <th className="p-3 text-center">Opening Stock</th>
                <th className="p-3 text-center">Sold</th>
                <th className="p-3 text-center">Restock</th>
                <th className="p-3 text-center">Remaining</th>
                <th className="p-3 text-right">Current Cost Price</th>
                <th className="p-3 text-right">WAC</th>
                <th className="p-3 text-right">Retail Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400 font-mono">
                    {searchTerm
                      ? `No inventory items found matching "${searchTerm}".`
                      : 'No items loaded for this branch.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const opening = getOpeningStock(item);
                  const sold = getSoldQty(item);
                  const restock = getRestockQty(item);
                  const remaining = getRemainingStock(item);
                  const cost = getCostPrice(item);
                  const wac = getWAC(item);
                  const retail = getRetailPrice(item);

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">{item.name}</span>
                        {item.code && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Code: {item.code}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold text-slate-600">
                        {opening}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-amber-700">
                        {sold}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-blue-700">
                        {restock}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-mono font-extrabold ${
                            remaining <= 0
                              ? 'bg-rose-100 text-rose-800'
                              : remaining <= (item.reorder_level || 5)
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {remaining}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-slate-700">
                        {formatCurrency(cost)}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-teal-800">
                        {formatCurrency(wac)}
                      </td>
                      <td className="p-3 text-right font-mono font-extrabold text-slate-900">
                        {formatCurrency(retail)}
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