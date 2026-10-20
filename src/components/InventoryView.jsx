// src/components/InventoryView.jsx
import React, { useState, useEffect } from 'react';
import API from '../api';

const INVENTORY_MODULES = [
  {
    id: 'overview',
    title: 'Inventory Overview',
    subtitle: 'Real-time stock asset valuation, total SKUs, low-stock alerts, and movement summaries.',
    endpoint: 'management-analytics/inventory-overview/',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    )
  },
  {
    id: 'levels',
    title: 'Stock Levels & Pricing Master',
    subtitle: 'Live quantity on hand, minimum reorder thresholds, WAC unit costs, and asset values.',
    endpoint: 'management-analytics/stock-levels/',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    )
  },
  {
    id: 'inwards',
    title: 'Stock Inwards',
    subtitle: 'Inbound inventory logs from purchases, restocks, and customer returns.',
    endpoint: 'management-analytics/stock-inwards/',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    id: 'outwards',
    title: 'Stock Outwards',
    subtitle: 'Outbound stock movements driven by sales, damages, and supplier returns.',
    endpoint: 'management-analytics/stock-outwards/',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    id: 'transfers',
    title: 'Stock Transfers',
    subtitle: 'Inter-branch inventory transfer logs, dispatch dates, and receiving logs.',
    endpoint: 'management-analytics/stock-transfers/',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    )
  },
  {
    id: 'adjustments',
    title: 'Stock Adjustments & Shrinkage',
    subtitle: 'Manual inventory reconciliations, damage write-offs, and shrinkage entries.',
    endpoint: 'management-analytics/stock-adjustments/',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    )
  }
];

export default function InventoryView({ branchId }) {
  const [selectedModule, setSelectedModule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const queryParams = new URLSearchParams(window.location.search);
  const activeBranch = branchId || queryParams.get('branch') || queryParams.get('branch_id');
  const activeStart = queryParams.get('startDate') || queryParams.get('start_date');
  const activeEnd = queryParams.get('endDate') || queryParams.get('end_date');
  const activeMonth = queryParams.get('month');
  const activeYear = queryParams.get('year');

  useEffect(() => {
    if (selectedModule) {
      fetchModuleData(selectedModule);
    }
  }, [selectedModule, activeBranch, activeStart, activeEnd, activeMonth, activeYear]);

  const fetchModuleData = async (moduleItem) => {
    setLoading(true);
    setError(null);
    try {
      const response = await API.get(moduleItem.endpoint, {
        params: { 
          branch_id: activeBranch,
          branch: activeBranch,
          start_date: activeStart,
          end_date: activeEnd,
          month: activeMonth,
          year: activeYear
        }
      });
      setData(response.data);
    } catch (err) {
      console.error(`Failed to load ${moduleItem.title}:`, err);
      setError("Unable to connect to live inventory records.");
    } finally {
      setLoading(false);
    }
  };

  const fmtCurr = (val) => `KSh ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const renderModuleContent = () => {
    if (!data) return null;

    switch (selectedModule.id) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
                <span className="text-[10px] font-bold text-teal-600 uppercase">Total Inventory Value</span>
                <div className="text-xl font-black text-teal-900 mt-1">{fmtCurr(data.summary?.total_asset_value)}</div>
              </div>
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-[10px] font-bold text-blue-600 uppercase">Active Catalog SKUs</span>
                <div className="text-xl font-black text-blue-900 mt-1">{data.summary?.total_items_count || 0} Items</div>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] font-bold text-amber-700 uppercase">Low Stock Alerts</span>
                <div className="text-xl font-black text-amber-900 mt-1">{data.summary?.low_stock_count || 0} Items</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Inbound Movements</span>
                <div className="text-lg font-bold text-emerald-900 mt-1">+{data.summary?.inbound_quantity || 0} Units</div>
              </div>
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-[10px] font-bold text-rose-600 uppercase">Outbound Movements</span>
                <div className="text-lg font-bold text-rose-900 mt-1">-{data.summary?.outbound_quantity || 0} Units</div>
              </div>
              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                <span className="text-[10px] font-bold text-purple-600 uppercase">Inter-Branch Transfers</span>
                <div className="text-lg font-bold text-purple-900 mt-1">{data.summary?.transfers_count || 0} Transfers</div>
              </div>
            </div>
          </div>
        );

      case 'levels':
        return (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase">Branch Inventory Pricing & Stock Master ({data.count || 0})</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">SKU / Code</th>
                    <th className="p-3">Item Name</th>
                    <th className="p-3 text-right">Remaining Stock</th>
                    <th className="p-3 text-right">Min Threshold</th>
                    <th className="p-3 text-right">WAC Unit Cost</th>
                    <th className="p-3 text-right">Selling Price</th>
                    <th className="p-3 text-right">Stock Asset Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.results && data.results.length > 0 ? (
                    data.results.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-teal-700">{row.sku_code || row.code || row.sku || `ITEM-${row.id}`}</td>
                        <td className="p-3 font-bold text-slate-900">{row.item_name}</td>
                        <td className={`p-3 text-right font-extrabold ${row.remaining_stock <= row.min_threshold ? 'text-rose-600' : 'text-slate-800'}`}>
                          {row.remaining_stock} {row.remaining_stock <= row.min_threshold && '⚠️'}
                        </td>
                        <td className="p-3 text-right text-slate-400">{row.min_threshold ?? row.reorder_level ?? 0}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-700">{fmtCurr(row.wac_unit_cost || row.unit_cost_price)}</td>
                        <td className="p-3 text-right font-mono font-semibold text-emerald-700">{fmtCurr(row.selling_price || row.unit_selling_price)}</td>
                        <td className="p-3 text-right font-mono font-black text-teal-900">{fmtCurr(row.stock_asset_value || row.stock_value)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-6 text-center text-xs text-slate-400 italic">
                        No active stock items registered for this branch.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'inwards':
        return (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase">
              Inbound Stock Movement Audit Log ({data.count || 0})
            </h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Ref Code</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Item Name</th>
                    <th className="p-3">Movement Type</th>
                    <th className="p-3 text-right">Quantity</th>
                    <th className="p-3 text-right">Unit Cost</th>
                    <th className="p-3 text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.results && data.results.length > 0 ? (
                    data.results.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-teal-700">
                          {m.ref_code || m.reference || `IN-${m.id}`}
                        </td>
                        <td className="p-3 text-slate-500">{m.date}</td>
                        <td className="p-3 font-bold text-slate-900">{m.item_name}</td>
                        <td className="p-3 font-semibold text-slate-600">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {m.movement_type || 'PURCHASE'}
                          </span>
                        </td>
                        <td className="p-3 text-right font-black text-emerald-600">
                          +{m.quantity}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-700">
                          {fmtCurr(m.unit_cost ?? m.unit_cost_price)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-teal-900">
                          {fmtCurr(m.total_cost)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-6 text-center text-xs text-slate-400 italic">
                        No inbound stock movement logs recorded for this branch or period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'outwards':
        return (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase">Stock Movement Audit Log ({data.count || 0})</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Ref Code</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Item Name</th>
                    <th className="p-3">Movement Type</th>
                    <th className="p-3 text-right">Quantity</th>
                    <th className="p-3 text-right">Unit Cost</th>
                    <th className="p-3 text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.results && data.results.length > 0 ? (
                    data.results.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-teal-700">{m.ref_code || m.reference || `MOV-${m.id}`}</td>
                        <td className="p-3 text-slate-500">{m.date}</td>
                        <td className="p-3 font-bold text-slate-900">{m.item_name}</td>
                        <td className="p-3 font-semibold text-slate-600">{m.movement_type}</td>
                        <td className={`p-3 text-right font-black ${selectedModule.id === 'inwards' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {selectedModule.id === 'inwards' ? `+${m.quantity}` : `-${m.quantity}`}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-700">{fmtCurr(m.unit_cost || m.unit_cost_price)}</td>
                        <td className="p-3 text-right font-mono font-bold text-teal-900">{fmtCurr(m.total_cost)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-6 text-center text-xs text-slate-400 italic">
                        No movement audit logs recorded for this branch or period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'transfers':
        return (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase">Stock Transfers ({data.count || 0})</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Transfer ID</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">From Branch</th>
                    <th className="p-3">To Branch</th>
                    <th className="p-3">Item</th>
                    <th className="p-3 text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.results && data.results.length > 0 ? (
                    data.results.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-purple-700">TRF-{t.id}</td>
                        <td className="p-3 text-slate-500">{t.date}</td>
                        <td className="p-3 font-medium text-slate-900">{t.from_branch}</td>
                        <td className="p-3 font-bold text-teal-800">{t.to_branch}</td>
                        <td className="p-3 font-bold text-slate-800">{t.item_name}</td>
                        <td className="p-3 text-right font-black text-purple-900">{t.quantity}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="p-6 text-center text-xs text-slate-400 italic">
                        No inter-branch transfers recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'adjustments':
        return (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase">Damaged / Shrinkage Audit Records ({data.count || 0})</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Record Ref</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Item Name</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Qty Affected</th>
                    <th className="p-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.results && data.results.length > 0 ? (
                    data.results.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-rose-700">DMG-{d.id}</td>
                        <td className="p-3 text-slate-500">{d.date}</td>
                        <td className="p-3 font-bold text-slate-900">{d.item_name}</td>
                        <td className="p-3 font-bold text-rose-600">{d.damage_type || 'Shrinkage'}</td>
                        <td className="p-3 text-right font-black text-rose-700">-{d.quantity}</td>
                        <td className="p-3 text-slate-500">{d.reason || 'N/A'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="p-6 text-center text-xs text-slate-400 italic">
                        No stock adjustment records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // FULL-SCREEN DEDICATED PAGE
  if (selectedModule) {
    return (
      <div className="space-y-6 w-full flex-1 flex flex-col">
        <div className="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-md pb-2 border-b border-slate-200/80">
          <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setSelectedModule(null); setData(null); setError(null); }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                ← Back to Inventory Portal
              </button>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${selectedModule.badgeColor}`}>
                  {selectedModule.icon}
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">{selectedModule.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedModule.subtitle}</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => fetchModuleData(selectedModule)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
            >
              Refresh Records
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex-1 min-h-[calc(100vh-220px)] h-fit w-full">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-3">
              <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-semibold text-slate-500">Fetching live inventory data for {selectedModule.title}...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
              {error}
            </div>
          ) : (
            <div className="space-y-4 h-full">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                {selectedModule.title} Operational Ledger
              </h3>
              
              {data ? renderModuleContent() : (
                <div className="text-xs text-slate-400 italic">No active inventory records found for the selected branch or period.</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // STREAMLINED GRID PORTAL
  return (
    <div className="w-full flex-1 flex flex-col space-y-6">
      <div className="bg-teal-700 text-white rounded-xl p-3.5 flex items-center gap-3 shadow-md">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        <h2 className="text-sm font-black tracking-widest uppercase">INVENTORY MENU BAR</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {INVENTORY_MODULES.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedModule(item)}
            className="flex items-center justify-between p-5 rounded-2xl border border-slate-200/90 hover:border-teal-600 bg-white hover:bg-teal-50/20 shadow-xs hover:shadow-lg transition-all text-left cursor-pointer min-h-[96px] group"
          >
            <div className="flex flex-col justify-between h-full space-y-2">
              <div className="p-2 rounded-xl bg-teal-50 border border-teal-100 w-fit group-hover:scale-110 transition-transform">
                {item.icon}
              </div>
              <div>
                <span className="text-base font-bold text-slate-800 group-hover:text-teal-900 transition-colors">
                  {item.title}
                </span>
                <p className="text-xs text-slate-400 mt-0.5">{item.subtitle}</p>
              </div>
            </div>

            <span className="text-slate-300 group-hover:text-teal-600 font-bold text-lg transition-colors">
              &rarr;
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}