// src/components/InventoryView.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const CHART_COLORS = ['#0D9488', '#4F46E5', '#F59E0B', '#E11D48', '#8B5CF6', '#0EA5E9'];

const fmtCurr = (val) =>
  `KSh ${Number(val || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function InventoryView({ branchId, startDate, endDate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Aggregated live analytics state
  const [overviewData, setOverviewData] = useState(null);
  const [stockLevelsData, setStockLevelsData] = useState([]);
  const [inwardsData, setInwardsData] = useState([]);
  const [outwardsData, setOutwardsData] = useState([]);
  const [transfersData, setTransfersData] = useState([]);
  const [adjustmentsData, setAdjustmentsData] = useState([]);

  // Query parameter fallbacks
  const queryParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const activeBranch = branchId || queryParams.get('branch') || queryParams.get('branch_id');
  const activeStart = startDate || queryParams.get('startDate') || queryParams.get('start_date') || '';
  const activeEnd = endDate || queryParams.get('endDate') || queryParams.get('end_date') || '';

  /* ================= FETCH ALL LIVE ANALYTICS IN PARALLEL ================= */
  const fetchAllAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = {
      branch_id: activeBranch,
      branch: activeBranch,
      start_date: activeStart,
      end_date: activeEnd,
    };

    try {
      const [resOverview, resLevels, resInwards, resOutwards, resTransfers, resAdjustments] = await Promise.allSettled([
        API.get('management-analytics/inventory-overview/', { params }),
        API.get('management-analytics/stock-levels/', { params }),
        API.get('management-analytics/stock-inwards/', { params }),
        API.get('management-analytics/stock-outwards/', { params }),
        API.get('management-analytics/stock-transfers/', { params }),
        API.get('management-analytics/stock-adjustments/', { params }),
      ]);

      if (resOverview.status === 'fulfilled') setOverviewData(resOverview.value.data);
      if (resLevels.status === 'fulfilled') {
        const d = resLevels.value.data;
        setStockLevelsData(Array.isArray(d) ? d : d?.results || []);
      }
      if (resInwards.status === 'fulfilled') {
        const d = resInwards.value.data;
        setInwardsData(Array.isArray(d) ? d : d?.results || []);
      }
      if (resOutwards.status === 'fulfilled') {
        const d = resOutwards.value.data;
        setOutwardsData(Array.isArray(d) ? d : d?.results || []);
      }
      if (resTransfers.status === 'fulfilled') {
        const d = resTransfers.value.data;
        setTransfersData(Array.isArray(d) ? d : d?.results || []);
      }
      if (resAdjustments.status === 'fulfilled') {
        const d = resAdjustments.value.data;
        setAdjustmentsData(Array.isArray(d) ? d : d?.results || []);
      }
    } catch (err) {
      console.error('Failed to fetch inventory report data:', err);
      setError('Unable to load live inventory endpoints. Please check server connectivity.');
    } finally {
      setLoading(false);
    }
  }, [activeBranch, activeStart, activeEnd]);

  useEffect(() => {
    fetchAllAnalytics();
  }, [fetchAllAnalytics]);

  /* ================= PRINT / PDF EXPORT ================= */
  const handlePrint = () => {
    window.print();
  };

  /* ================= CSV EXPORT ================= */
  const handleExportCSV = () => {
    if (!stockLevelsData || stockLevelsData.length === 0) return;

    const headers = ['SKU / Code', 'Item Name', 'Remaining Stock', 'Min Threshold', 'WAC Unit Cost', 'Selling Price', 'Stock Asset Value'];
    const rows = stockLevelsData.map((row) => [
      `"${row.sku_code || row.code || row.sku || `ITEM-${row.id}`}"`,
      `"${String(row.item_name || '').replace(/"/g, '""')}"`,
      row.remaining_stock || 0,
      row.min_threshold ?? row.reorder_level ?? 0,
      Number(row.wac_unit_cost || row.unit_cost_price || 0).toFixed(2),
      Number(row.selling_price || row.unit_selling_price || 0).toFixed(2),
      Number(row.stock_asset_value || row.stock_value || 0).toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Executive_Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = overviewData?.summary || {};

  // Top Stock Items Valuation Chart Data
  const topValuedItemsChart = useMemo(() => {
  return stockLevelsData
    .map((s) => {
      const value = Number(
        s.stock_asset_value || 
        s.stock_value || 
        (Number(s.remaining_stock || 0) * Number(s.wac_unit_cost || s.unit_cost_price || 0))
      );
      return {
        name: s.item_name || 'Item',
        value: value,
        stock: Number(s.remaining_stock || 0),
      };
    })
    .filter((item) => item.value > 0) // Remove items with 0 valuation
    .sort((a, b) => b.value - a.value) // Sort descending so the highest values display
    .slice(0, 5);
}, [stockLevelsData]);

  // Movement Ratio Pie Chart
  const movementMix = useMemo(() => {
    const inQty = Number(summary.inbound_quantity || inwardsData.reduce((acc, i) => acc + Number(i.quantity || 0), 0));
    const outQty = Number(summary.outbound_quantity || outwardsData.reduce((acc, o) => acc + Number(o.quantity || 0), 0));
    return [
      { name: 'Inbound Restocks', value: inQty },
      { name: 'Outbound Dispatches', value: outQty },
    ];
  }, [inwardsData, outwardsData, summary]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans text-slate-800 pb-12">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #executive-inventory-report-area, #executive-inventory-report-area * { visibility: visible; }
          #executive-inventory-report-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
          .no-print { display: none !important; }
          .chart-card-print { break-inside: avoid !important; page-break-inside: avoid !important; }
          .chart-container-print { height: 220px !important; }
        }
      `}</style>

      {/* ACTION CONTROLS HEADER */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Executive Inventory Valuation & Movement Report</h1>
          <p className="text-xs text-slate-500 mt-0.5">Comprehensive audit of stock asset values, SKU levels, movements, transfers, and shrinkage.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAllAnalytics}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            ↻ Refresh Data
          </button>

          <button
            onClick={handleExportCSV}
            disabled={stockLevelsData.length === 0}
            className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            📊 Export CSV
          </button>

          <button
            onClick={handlePrint}
            className="bg-teal-800 hover:bg-teal-700 text-white px-5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer shadow-sm"
          >
            🖨️ Download / Print Report PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl p-16 border border-slate-200/90 shadow-xs flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-700 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-500 font-mono">Compiling inventory analytics...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-3xl text-xs font-bold text-center">
          {error}
        </div>
      ) : (
        <div id="executive-inventory-report-area" className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xs space-y-8">
          
          {/* REPORT HEADER */}
          <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-teal-600"></span>
                <span className="text-[10px] font-black text-teal-800 uppercase tracking-widest">OFFICIAL INVENTORY ASSET REPORT</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">STOCK VALUATION & MOVEMENT AUDIT</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Branch ID: <span className="font-bold text-slate-800">{activeBranch || 'All Branches'}</span> | Generated on: {new Date().toLocaleDateString()}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-right text-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Report Period</span>
              <span className="font-mono font-bold text-slate-800">
                {activeStart || 'Beginning'} — {activeEnd || 'Present'}
              </span>
            </div>
          </div>

          {/* 1. EXECUTIVE SUMMARY KPI CARDS */}
          <div className="space-y-3 chart-card-print">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              1. Executive Inventory Indicators
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-teal-50/70 p-4 rounded-2xl border border-teal-200/80">
                <span className="text-[10px] font-extrabold text-teal-800 uppercase tracking-wider block">Total Stock Valuation</span>
                <span className="text-xl font-black font-mono text-teal-900 mt-1 block">
                  {fmtCurr(summary.total_asset_value)}
                </span>
              </div>

              <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200/80">
                <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider block">Active Catalog SKUs</span>
                <span className="text-xl font-black font-mono text-blue-900 mt-1 block">
                  {summary.total_items_count || stockLevelsData.length || 0} Items
                </span>
              </div>

              <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80">
                <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">Low Stock Threshold Alerts</span>
                <span className="text-xl font-black font-mono text-amber-900 mt-1 block">
                  {summary.low_stock_count || stockLevelsData.filter((i) => i.remaining_stock <= (i.min_threshold || i.reorder_level || 0)).length || 0} Items
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Inter-Branch Transfers</span>
                <span className="text-xl font-black font-mono text-slate-900 mt-1 block">
                  {summary.transfers_count || transfersData.length || 0} Logs
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Inbound Stock Units</span>
                <span className="text-sm font-extrabold text-emerald-700 font-mono">+{summary.inbound_quantity || 0} Units</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Outbound Stock Units</span>
                <span className="text-sm font-extrabold text-rose-700 font-mono">-{summary.outbound_quantity || 0} Units</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Damaged / Shrinkage Logs</span>
                <span className="text-sm font-extrabold text-rose-700 font-mono">{adjustmentsData.length} Records</span>
              </div>
            </div>
          </div>

          {/* 2. CHARTS SECTION: STOCK VALUATION & MOVEMENT MIX */}
          <div className="space-y-3 pt-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              2. Stock Asset Allocation & Inbound/Outbound Movement Mix
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 space-y-3 chart-card-print">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase">Highest Valuation Inventory Items</h4>
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                    Asset Value
                  </span>
                </div>
                <div className="h-64 w-full chart-container-print">
                  {topValuedItemsChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topValuedItemsChart} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#334155' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v) => `KSh ${v}`} />
                        <Tooltip formatter={(val) => [fmtCurr(val), 'Asset Value']} />
                        <Bar dataKey="value" fill="#0D9488" radius={[8, 8, 0, 0]} barSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                      No stock valuation data recorded.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 chart-card-print">
                <h4 className="text-xs font-bold text-slate-800 uppercase border-b border-slate-100 pb-2">
                  Inbound vs Outbound Quantity
                </h4>
                <div className="h-64 w-full chart-container-print">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={movementMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={4}>
                        {movementMix.map((_, idx) => (
                          <Cell key={`mov-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => [`${val} Units`, 'Quantity']} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>

          {/* 3. STOCK MASTER & VALUATION LEDGER */}
          <div className="space-y-3 pt-4 chart-card-print">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              3. Master Stock Levels & Valuation Ledger ({stockLevelsData.length} Items)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200 uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="p-3">SKU / Code</th>
                    <th className="p-3">Item Name</th>
                    <th className="p-3 text-right">Remaining Qty</th>
                    <th className="p-3 text-right">Min Reorder</th>
                    <th className="p-3 text-right">WAC Unit Cost</th>
                    <th className="p-3 text-right">Selling Price</th>
                    <th className="p-3 text-right">Stock Asset Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {stockLevelsData.length > 0 ? (
                    stockLevelsData.map((row, idx) => (
                      <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-teal-700">
                          {row.sku_code || row.code || row.sku || `ITEM-${row.id}`}
                        </td>
                        <td className="p-3 font-bold text-slate-900">{row.item_name}</td>
                        <td className={`p-3 text-right font-mono font-black ${row.remaining_stock <= (row.min_threshold ?? row.reorder_level ?? 0) ? 'text-rose-600' : 'text-slate-800'}`}>
                          {row.remaining_stock} {row.remaining_stock <= (row.min_threshold ?? row.reorder_level ?? 0) && '⚠️'}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-400">{row.min_threshold ?? row.reorder_level ?? 0}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-700">{fmtCurr(row.wac_unit_cost || row.unit_cost_price)}</td>
                        <td className="p-3 text-right font-mono font-semibold text-emerald-700">{fmtCurr(row.selling_price || row.unit_selling_price)}</td>
                        <td className="p-3 text-right font-mono font-black text-teal-900">{fmtCurr(row.stock_asset_value || row.stock_value)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-400 font-mono">
                        No active stock items registered for this branch.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. STOCK MOVEMENTS & ADJUSTMENTS */}
          <div className="space-y-3 pt-4 chart-card-print">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              4. Inbound & Outbound Movement Logs
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Inwards Log */}
              <div className="bg-white border border-emerald-200/80 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 border-b border-emerald-100 pb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  <h4 className="text-xs font-extrabold text-emerald-900 uppercase">Recent Inbound Stock Movement</h4>
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase text-[9px]">
                      <th className="py-2">Ref Code</th>
                      <th className="py-2">Item</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {inwardsData.length > 0 ? (
                      inwardsData.slice(0, 10).map((m, idx) => (
                        <tr key={m.id || idx} className="hover:bg-slate-50">
                          <td className="py-2 font-mono font-bold text-teal-700">{m.ref_code || m.reference || `IN-${m.id}`}</td>
                          <td className="py-2 font-bold text-slate-800">{m.item_name}</td>
                          <td className="py-2 text-right font-mono font-black text-emerald-700">+{m.quantity}</td>
                          <td className="py-2 text-right font-mono">{fmtCurr(m.total_cost)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="p-4 text-center text-slate-400">No inbound logs recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Outwards Log */}
              <div className="bg-white border border-rose-200/80 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 border-b border-rose-100 pb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                  <h4 className="text-xs font-extrabold text-rose-900 uppercase">Recent Outbound Stock Movement</h4>
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase text-[9px]">
                      <th className="py-2">Ref Code</th>
                      <th className="py-2">Item</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {outwardsData.length > 0 ? (
                      outwardsData.slice(0, 10).map((m, idx) => (
                        <tr key={m.id || idx} className="hover:bg-slate-50">
                          <td className="py-2 font-mono font-bold text-teal-700">{m.ref_code || m.reference || `OUT-${m.id}`}</td>
                          <td className="py-2 font-bold text-slate-800">{m.item_name}</td>
                          <td className="py-2 text-right font-mono font-black text-rose-700">-{m.quantity}</td>
                          <td className="py-2 text-right font-mono">{fmtCurr(m.total_cost)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="p-4 text-center text-slate-400">No outbound logs recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </div>

          {/* SIGNATURE / APPROVAL BLOCK FOR EXECUTIVE USE */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs font-bold text-slate-600 chart-card-print">
            <div>
              <span className="text-[10px] uppercase text-slate-400 block font-mono">Prepared By:</span>
              <div className="mt-6 border-b border-slate-400 w-48"></div>
              <span className="mt-1 block text-slate-800">Inventory Manager / Warehouse Controller</span>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-[10px] uppercase text-slate-400 block font-mono">Approved By:</span>
              <div className="mt-6 border-b border-slate-400 w-48"></div>
              <span className="mt-1 block text-slate-800">Operations Director / Auditor</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}