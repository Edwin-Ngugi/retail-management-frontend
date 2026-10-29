// src/components/SalesView.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const fmtCurr = (val) =>
  `KSh ${Number(val || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function SalesView({ branchId, startDate: propStartDate, endDate: propEndDate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [startDate, setStartDate] = useState(propStartDate || '');
  const [endDate, setEndDate] = useState(propEndDate || '');

  const [detailedReport, setDetailedReport] = useState(null);

  const activeBranch = useMemo(() => {
    if (branchId && String(branchId).toLowerCase() !== 'all') {
      return String(branchId);
    }
    const params = new URLSearchParams(window.location.search);
    const urlBranch = params.get('branch') || params.get('branch_id');
    return urlBranch && String(urlBranch).toLowerCase() !== 'all' ? String(urlBranch) : '';
  }, [branchId]);

  const fetchAllAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = {};
    if (activeBranch) {
      params.branch_id = activeBranch;
      params.branch = activeBranch;
    }
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    try {
      const resDetailed = await API.get('sales-analysis-detailed/detailed-report/', { params });
      setDetailedReport(resDetailed.data);
    } catch (err) {
      console.error('Failed to fetch detailed sales report data:', err);
      setError('Unable to load live sales analytics. Please check server connection.');
    } finally {
      setLoading(false);
    }
  }, [activeBranch, startDate, endDate]);

  useEffect(() => {
    fetchAllAnalytics();
  }, [fetchAllAnalytics]);

  const handlePrint = () => window.print();

  const summary = detailedReport?.summary || {};
  const dailyTrends = detailedReport?.daily_trends || [];
  const rawPaymentBreakdown = detailedReport?.payment_breakdown || [];
  const insights = detailedReport?.insights || [];

  // Strictly exclude 'SPLIT' row and distribute only concrete liquid payment methods
  const paymentBreakdown = useMemo(() => {
    return rawPaymentBreakdown.filter(
      (pm) => String(pm.method).toUpperCase() !== 'SPLIT' && pm.amount > 0
    );
  }, [rawPaymentBreakdown]);

  const fastMovers = useMemo(() => {
    return (
      detailedReport?.fast_movers ||
      detailedReport?.top_performers ||
      detailedReport?.top_fast_movers ||
      []
    );
  }, [detailedReport]);

  const slowMovers = useMemo(() => {
    return (
      detailedReport?.slow_movers ||
      detailedReport?.bottom_performers ||
      []
    );
  }, [detailedReport]);

  const getInsightStyle = (type) => {
    switch (type) {
      case 'danger':
        return 'bg-rose-50 border-rose-200 text-rose-800';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'success':
        return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      default:
        return 'bg-teal-50 border-teal-200 text-teal-800';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 space-y-6 font-sans">
      
      {/* HEADER CONTROLS */}
      <header className="no-print bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold tracking-widest text-emerald-700 uppercase">
              Live Sales Intelligence
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-1">
            Granular Sales & Margin Analysis
          </h1>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-slate-700 outline-none cursor-pointer focus:text-slate-900 font-semibold"
            />
            <span className="text-slate-400">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-slate-700 outline-none cursor-pointer focus:text-slate-900 font-semibold"
            />
          </div>

          <button
            onClick={fetchAllAnalytics}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-slate-200 cursor-pointer"
          >
            ↻ Refresh
          </button>

          <button
            onClick={handlePrint}
            className="bg-teal-800 hover:bg-teal-700 text-white px-5 py-2 rounded-xl text-xs font-black tracking-wide transition-all shadow-xs cursor-pointer"
          >
            🖨️ Export PDF
          </button>
        </div>
      </header>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-20 flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-700 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-500 tracking-wider uppercase font-mono">
            Processing analytics ledger...
          </span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-xs font-bold text-center">
          {error}
        </div>
      ) : (
        <div id="executive-sales-report-area" className="space-y-6">
          
          {/* PRIMARY FINANCIAL METRICS */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Gross Revenue
              </span>
              <span className="text-2xl font-black font-mono text-slate-900 block">
                {fmtCurr(summary.gross_revenue)}
              </span>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider block">
                Cost of Goods Sold (COGS)
              </span>
              <span className="text-2xl font-black font-mono text-amber-700 block">
                {fmtCurr(summary.total_cogs)}
              </span>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 p-5 rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">
                Gross Profit
              </span>
              <span className="text-2xl font-black font-mono text-emerald-900 block">
                {fmtCurr(summary.gross_profit)}
              </span>
            </div>

            <div className="bg-teal-50/70 border border-teal-200 p-5 rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-teal-800 uppercase tracking-wider block">
                Profit Margin Rate
              </span>
              <span className="text-2xl font-black font-mono text-teal-900 block">
                {summary.profit_margin_percent || 0}%
              </span>
            </div>
          </section>

          {/* SECONDARY BASKET & CREDIT STATS */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Orders</span>
              <span className="text-base font-extrabold text-slate-800 font-mono mt-0.5 block">
                {summary.transaction_count || 0} Txns
              </span>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Average Basket</span>
              <span className="text-base font-extrabold text-slate-800 font-mono mt-0.5 block">
                {fmtCurr(summary.avg_basket_value)}
              </span>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Items per Basket</span>
              <span className="text-base font-extrabold text-slate-800 font-mono mt-0.5 block">
                {summary.avg_items_per_basket || 0} Units
              </span>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-amber-700 uppercase block">Credit Sales Exposure</span>
              <span className="text-base font-extrabold text-amber-800 font-mono mt-0.5 block">
                {fmtCurr(summary.credit_sales_exposure)}
              </span>
            </div>
          </section>

          {/* STRATEGIC INSIGHTS & EXECUTIVE NOTES */}
          {insights.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <span className="text-base">💡</span>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Executive Insights & Decision Notes
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {insights.map((note, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border text-xs font-medium space-y-1 ${getInsightStyle(
                      note.type
                    )}`}
                  >
                    <span className="font-bold block text-[11px] uppercase tracking-wider">
                      {note.title}
                    </span>
                    <p className="leading-relaxed opacity-90">{note.message}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* COMPREHENSIVE FINANCIAL COMPARISON GRAPH: REVENUE vs COGS vs PROFIT */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Daily Financial Breakdown (Revenue vs COGS vs Gross Profit)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Comparative analysis of daily sales income against direct product cost and generated profit
                </p>
              </div>
              <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                Financial Velocity
              </span>
            </div>

            <div className="h-72 w-full">
              {dailyTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTrends} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v) => `KSh ${v}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#CBD5E1',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(val, name) => [fmtCurr(val), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="revenue" name="Gross Revenue" fill="#0D9488" radius={[4, 4, 0, 0]} barSize={16} minPointSize={3} />
                    <Bar dataKey="cogs" name="COGS" fill="#D97706" radius={[4, 4, 0, 0]} barSize={16} minPointSize={3} />
                    <Bar dataKey="profit" name="Gross Profit" fill="#059669" radius={[4, 4, 0, 0]} barSize={16} minPointSize={3} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                  No daily sales or financial trends recorded for this range.
                </div>
              )}
            </div>
          </section>

          {/* FAST & SLOW MOVING GOODS ANALYSIS */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Fast-Moving Goods */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  🚀 Fast-Moving Products (Top Performers)
                </h3>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Top Revenue Drivers
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase text-[9px] tracking-wider">
                      <th className="py-2.5">Product</th>
                      <th className="py-2.5 text-center">Units Sold</th>
                      <th className="py-2.5 text-right">Revenue</th>
                      <th className="py-2.5 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {fastMovers.length > 0 ? (
                      fastMovers.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 font-bold text-slate-800">{item.item_name}</td>
                          <td className="py-3 text-center font-mono text-slate-600">{item.units_sold}</td>
                          <td className="py-3 text-right font-mono font-bold text-teal-800">{fmtCurr(item.gross_revenue)}</td>
                          <td className="py-3 text-right font-mono text-emerald-700 font-bold">{item.profit_margin_percent}%</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-6 text-center text-slate-400 font-mono">No fast-moving items recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Slow-Moving Goods */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  🐢 Slow-Moving Products (Stagnant Inventory)
                </h3>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">
                  Lowest Velocity
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase text-[9px] tracking-wider">
                      <th className="py-2.5">Product</th>
                      <th className="py-2.5 text-center">Units Sold</th>
                      <th className="py-2.5 text-right">Revenue</th>
                      <th className="py-2.5 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {slowMovers.length > 0 ? (
                      slowMovers.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 font-bold text-slate-800">{item.item_name}</td>
                          <td className="py-3 text-center font-mono text-slate-600">{item.units_sold}</td>
                          <td className="py-3 text-right font-mono font-bold text-slate-800">{fmtCurr(item.gross_revenue)}</td>
                          <td className="py-3 text-right font-mono text-slate-500">{item.profit_margin_percent}%</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-6 text-center text-slate-400 font-mono">No slow-moving items recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </section>

          {/* RESOLVED PAYMENT BREAKDOWN */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Resolved Payment Channel Distribution
              </h3>
              <span className="text-[10px] font-semibold text-slate-400">Fully Split-Resolved</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase text-[9px] tracking-wider">
                    <th className="py-2.5">Channel / Method</th>
                    <th className="py-2.5 text-right">Settled Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paymentBreakdown.length > 0 ? (
                    paymentBreakdown.map((pm, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 font-bold text-slate-800">{pm.method}</td>
                        <td className="py-3 text-right font-mono font-bold text-indigo-700">{fmtCurr(pm.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="2" className="py-6 text-center text-slate-400 font-mono">
                        No payment transactions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      )}
    </div>
  );
}