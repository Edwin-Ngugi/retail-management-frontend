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
  const hourlyTrends = detailedReport?.hourly_trends || [];
  const categories = detailedReport?.category_breakdown || [];
  const paymentBreakdown = detailedReport?.payment_breakdown || [];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 space-y-6 font-sans">
      
      {/* HEADER CONTROLS */}
      <header className="no-print bg-slate-800/80 backdrop-blur border border-slate-700/60 rounded-2xl p-5 shadow-lg flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase">
              Live Sales Intelligence
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mt-1">
            Granular Sales & Margin Analysis
          </h1>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-3 py-2 rounded-xl text-xs font-medium">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer focus:text-white"
            />
            <span className="text-slate-500">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer focus:text-white"
            />
          </div>

          <button
            onClick={fetchAllAnalytics}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-slate-600"
          >
            ↻ Refresh
          </button>

          <button
            onClick={handlePrint}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-black tracking-wide transition-all shadow-md shadow-emerald-900/30"
          >
            🖨️ Export PDF
          </button>
        </div>
      </header>

      {loading ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-20 flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono">
            Processing analytics ledger...
          </span>
        </div>
      ) : error ? (
        <div className="bg-rose-900/30 border border-rose-700/60 text-rose-300 p-6 rounded-2xl text-xs font-bold text-center">
          {error}
        </div>
      ) : (
        <div id="executive-sales-report-area" className="space-y-6">
          
          {/* PRIMARY FINANCIAL METRICS */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800/90 border border-slate-700/70 p-5 rounded-2xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Gross Revenue
              </span>
              <span className="text-2xl font-black font-mono text-white block">
                {fmtCurr(summary.gross_revenue)}
              </span>
            </div>

            <div className="bg-slate-800/90 border border-slate-700/70 p-5 rounded-2xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-amber-400/90 uppercase tracking-wider block">
                Cost of Goods Sold (COGS)
              </span>
              <span className="text-2xl font-black font-mono text-amber-400 block">
                {fmtCurr(summary.total_cogs)}
              </span>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-700/50 p-5 rounded-2xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                Gross Profit
              </span>
              <span className="text-2xl font-black font-mono text-emerald-300 block">
                {fmtCurr(summary.gross_profit)}
              </span>
            </div>

            <div className="bg-teal-950/40 border border-teal-700/50 p-5 rounded-2xl shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">
                Profit Margin Rate
              </span>
              <span className="text-2xl font-black font-mono text-teal-300 block">
                {summary.profit_margin_percent || 0}%
              </span>
            </div>
          </section>

          {/* SECONDARY BASKET STATS */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-800/40 border border-slate-700/40 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Orders</span>
              <span className="text-base font-bold text-slate-200 font-mono mt-0.5 block">
                {summary.transaction_count || 0} Txns
              </span>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/40 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Average Basket</span>
              <span className="text-base font-bold text-slate-200 font-mono mt-0.5 block">
                {fmtCurr(summary.avg_basket_value)}
              </span>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/40 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Items per Basket</span>
              <span className="text-base font-bold text-slate-200 font-mono mt-0.5 block">
                {summary.avg_items_per_basket || 0} Units
              </span>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/40 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-rose-400 uppercase block">Discounts Granted</span>
              <span className="text-base font-bold text-rose-300 font-mono mt-0.5 block">
                {fmtCurr(summary.total_discounts)} ({summary.discount_rate_percent || 0}%)
              </span>
            </div>
          </section>

          {/* HOURLY CHART */}
          <section className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Peak Operating Hours (Hourly Sales Velocity)
              </h3>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-0.5 rounded-full">
                24-Hour Timeline
              </span>
            </div>

            <div className="h-64 w-full">
              {hourlyTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(v) => `KSh ${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px' }}
                      formatter={(val) => [fmtCurr(val), 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                  No sales activity registered for this timeframe.
                </div>
              )}
            </div>
          </section>

          {/* CATEGORY & PAYMENT BREAKDOWNS */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Category Performance */}
            <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-6 shadow-md space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-700/60 pb-3">
                Category Contribution
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 uppercase text-[9px] tracking-wider">
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5 text-right">Units</th>
                      <th className="py-2.5 text-right">Revenue</th>
                      <th className="py-2.5 text-right">Gross Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40 font-medium">
                    {categories.length > 0 ? (
                      categories.map((cat, idx) => (
                        <tr key={idx} className="hover:bg-slate-750 transition-colors">
                          <td className="py-3 font-bold text-slate-200">{cat.category}</td>
                          <td className="py-3 text-right font-mono text-slate-400">{cat.units}</td>
                          <td className="py-3 text-right font-mono font-bold text-emerald-400">{fmtCurr(cat.revenue)}</td>
                          <td className="py-3 text-right font-mono text-teal-300">{fmtCurr(cat.profit)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-6 text-center text-slate-500 font-mono">
                          No category data recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-6 shadow-md space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-700/60 pb-3">
                Payment Channel Distribution
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 uppercase text-[9px] tracking-wider">
                      <th className="py-2.5">Channel / Method</th>
                      <th className="py-2.5 text-right">Settled Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40 font-medium">
                    {paymentBreakdown.length > 0 ? (
                      paymentBreakdown.map((pm, idx) => (
                        <tr key={idx} className="hover:bg-slate-750 transition-colors">
                          <td className="py-3 font-bold text-slate-200">{pm.method}</td>
                          <td className="py-3 text-right font-mono font-bold text-indigo-400">{fmtCurr(pm.amount)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="2" className="py-6 text-center text-slate-500 font-mono">
                          No payment transactions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </section>

        </div>
      )}
    </div>
  );
}