// src/components/SalesView.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';
import {
  ResponsiveContainer,
  LineChart,
  Line,
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

const CATEGORY_COLORS = ['#0D9488', '#4F46E5', '#F59E0B', '#E11D48', '#8B5CF6', '#0EA5E9'];
const COLLECTION_COLORS = ['#0D9488', '#4F46E5', '#F59E0B', '#6366F1'];

const fmtCurr = (val) =>
  `KSh ${Number(val || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function SalesView({ branchId, startDate: propStartDate, endDate: propEndDate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Controlled date states
  const [startDate, setStartDate] = useState(propStartDate || '');
  const [endDate, setEndDate] = useState(propEndDate || '');

  const [overviewData, setOverviewData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [collectionsData, setCollectionsData] = useState(null);
  const [receivablesData, setReceivablesData] = useState(null);
  const [registerData, setRegisterData] = useState([]);

  const queryParams = useMemo(() => new URLSearchParams(window.location.search), []);
  
  // Safely coerce branch ID string for Django ORM compatibility
  const activeBranch = useMemo(() => {
    const raw = branchId || queryParams.get('branch') || queryParams.get('branch_id');
    return raw && raw !== 'all' ? String(raw) : '';
  }, [branchId, queryParams]);

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
      const [resOverview, resAnalysis, resCollections, resReceivables, resRegister] = await Promise.allSettled([
        API.get('management-analytics/sales-overview/', { params }),
        API.get('management-analytics/sales-analysis/', { params }),
        API.get('management-analytics/sales-collections/', { params }),
        API.get('management-analytics/customer-receivables/', { params }),
        API.get('management-analytics/sales-register/', { params }),
      ]);

      if (resOverview.status === 'fulfilled') setOverviewData(resOverview.value.data);
      if (resAnalysis.status === 'fulfilled') setAnalysisData(resAnalysis.value.data);
      if (resCollections.status === 'fulfilled') setCollectionsData(resCollections.value.data);
      if (resReceivables.status === 'fulfilled') setReceivablesData(resReceivables.value.data);
      if (resRegister.status === 'fulfilled') {
        const reg = resRegister.value.data;
        setRegisterData(Array.isArray(reg) ? reg : reg?.results || []);
      }
    } catch (err) {
      console.error('Failed to fetch sales report data:', err);
      setError('Unable to load live financial endpoints. Please check server connectivity.');
    } finally {
      setLoading(false);
    }
  }, [activeBranch, startDate, endDate]);

  useEffect(() => {
    fetchAllAnalytics();
  }, [fetchAllAnalytics]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!registerData || registerData.length === 0) return;

    const headers = ['Sale Date', 'Receipt No', 'Customer', 'Payment Method', 'Served By', 'Total Amount', 'Amount Paid'];
    const rows = registerData.map((tx) => [
      `"${tx.sale_date || ''}"`,
      `"${tx.receipt_number || ''}"`,
      `"${String(tx.customer || '').replace(/"/g, '""')}"`,
      `"${tx.payment_method || ''}"`,
      `"${tx.served_by || ''}"`,
      Number(tx.total_amount || 0).toFixed(2),
      Number(tx.amount_paid || 0).toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Executive_Sales_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = overviewData?.summary || analysisData?.branch_summary || {};
  const health = overviewData?.operational_health || {};
  const dailyTrends = analysisData?.daily_trends || [];
  const topPerformers = analysisData?.top_performers || [];
  const slowMovers = analysisData?.slow_movers || [];
  const categories = analysisData?.category_breakdown || [];
  const collectionsBreakdown = collectionsData?.breakdown || [];
  const debtors = receivablesData?.debtors_summary || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans text-slate-800 pb-12">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #executive-sales-report-area, #executive-sales-report-area * { visibility: visible; }
          #executive-sales-report-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
          .no-print { display: none !important; }
          .chart-card-print { break-inside: avoid !important; page-break-inside: avoid !important; }
          .chart-container-print { height: 220px !important; }
        }
      `}</style>

      {/* ACTION CONTROLS & DATE FILTER HEADER */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Executive Sales Analytics & Performance Report</h1>
          <p className="text-xs text-slate-500 mt-0.5">Comprehensive analysis for management decision making and operational audit.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs font-semibold outline-none cursor-pointer"
            />
            <span className="text-[10px] font-bold text-slate-400 uppercase">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs font-semibold outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={fetchAllAnalytics}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            ↻ Refresh Data
          </button>

          <button
            onClick={handleExportCSV}
            disabled={registerData.length === 0}
            className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            📊 Export CSV
          </button>

          <button
            onClick={handlePrint}
            className="bg-teal-800 hover:bg-teal-700 text-white px-5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer shadow-sm"
          >
            🖨️ Print PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl p-16 border border-slate-200/90 shadow-xs flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-700 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-500 font-mono">Compiling executive sales analytics...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-3xl text-xs font-bold text-center">
          {error}
        </div>
      ) : (
        <div id="executive-sales-report-area" className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xs space-y-8">
          
          {/* REPORT HEADER */}
          <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-teal-600"></span>
                <span className="text-[10px] font-black text-teal-800 uppercase tracking-widest">OFFICIAL FINANCIAL REPORT</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">SALES PERFORMANCE & ANALYTICS AUDIT</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Branch ID: <span className="font-bold text-slate-800">{activeBranch || 'All Branches'}</span> | Generated on: {new Date().toLocaleDateString()}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-right text-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Report Period</span>
              <span className="font-mono font-bold text-slate-800">
                {startDate || 'All Time'} — {endDate || 'Present'}
              </span>
            </div>
          </div>

          {/* 1. EXECUTIVE SUMMARY KPI CARDS */}
          <div className="space-y-3 chart-card-print">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              1. Executive Performance Indicators
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Gross Sales Revenue</span>
                <span className="text-xl font-black font-mono text-slate-900 mt-1 block">
                  {fmtCurr(summary.gross_revenue)}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Cost of Goods Sold (COGS)</span>
                <span className="text-xl font-black font-mono text-amber-700 mt-1 block">
                  {fmtCurr(summary.total_cogs)}
                </span>
              </div>

              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80">
                <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">Gross Profit</span>
                <span className="text-xl font-black font-mono text-emerald-900 mt-1 block">
                  {fmtCurr(summary.gross_profit)}
                </span>
              </div>

              <div className="bg-teal-50/70 p-4 rounded-2xl border border-teal-200/80">
                <span className="text-[10px] font-extrabold text-teal-800 uppercase tracking-wider block">Profit Margin %</span>
                <span className="text-xl font-black font-mono text-teal-900 mt-1 block">
                  {summary.profit_margin_percent ?? 0}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Orders / Tills</span>
                <span className="text-sm font-extrabold text-slate-800 font-mono">{summary.transaction_count || 0} Transactions</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Avg Order Value (AOV)</span>
                <span className="text-sm font-extrabold text-slate-800 font-mono">{fmtCurr(summary.average_transaction_value)}</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Units Sold</span>
                <span className="text-sm font-extrabold text-slate-800 font-mono">{health.total_units_sold || 0} Units</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Discounts Granted</span>
                <span className="text-sm font-extrabold text-rose-700 font-mono">{fmtCurr(health.total_discounts_granted)}</span>
              </div>
            </div>
          </div>

          {/* 2. CHARTS SECTION: TRAJECTORY & CATEGORY MIX */}
          <div className="space-y-3 pt-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              2. Revenue Velocity & Product Category Distribution
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 space-y-3 chart-card-print">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase">Daily Revenue Trajectory</h4>
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                    Velocity
                  </span>
                </div>
                <div className="h-64 w-full chart-container-print">
                  {dailyTrends.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v) => `KSh ${v}`} />
                        <Tooltip formatter={(val) => [fmtCurr(val), 'Revenue']} />
                        <Line type="monotone" dataKey="revenue" stroke="#0D9488" strokeWidth={3} dot={{ r: 4, fill: '#0D9488' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                      No trajectory data recorded for this selection.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 chart-card-print">
                <h4 className="text-xs font-bold text-slate-800 uppercase border-b border-slate-100 pb-2">
                  Category Mix
                </h4>
                <div className="h-64 w-full chart-container-print">
                  {categories.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categories} dataKey="revenue" nameKey="category" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={4}>
                          {categories.map((_, idx) => (
                            <Cell key={`cat-${idx}`} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val) => [fmtCurr(val), 'Revenue']} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                      No category distribution available.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* 3. CHARTS SECTION: TOP PERFORMERS & COLLECTIONS MIX */}
          <div className="space-y-3 pt-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              3. Top Product Sales & Payment Channel Settlement
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 chart-card-print">
                <h4 className="text-xs font-bold text-slate-800 uppercase border-b border-slate-100 pb-2">
                  Top Product Revenue Comparison
                </h4>
                <div className="h-64 w-full chart-container-print">
                  {topPerformers.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topPerformers} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="item_name" tick={{ fontSize: 9, fill: '#334155' }} interval={0} angle={-15} textAnchor="end" />
                        <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v) => `KSh ${v}`} />
                        <Tooltip formatter={(val) => [fmtCurr(val), 'Revenue']} />
                        <Bar dataKey="gross_revenue" fill="#4F46E5" radius={[6, 6, 0, 0]} barSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                      No top performer data recorded.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 chart-card-print">
                <h4 className="text-xs font-bold text-slate-800 uppercase border-b border-slate-100 pb-2">
                  Collection Channel Settlement
                </h4>
                <div className="h-64 w-full chart-container-print">
                  {collectionsBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={collectionsBreakdown} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="channel" tick={{ fontSize: 10, fill: '#334155' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v) => `KSh ${v}`} />
                        <Tooltip formatter={(val) => [fmtCurr(val), 'Amount']} />
                        <Bar dataKey="amount" radius={[8, 8, 0, 0]} barSize={36}>
                          {collectionsBreakdown.map((_, idx) => (
                            <Cell key={`coll-${idx}`} fill={COLLECTION_COLORS[idx % COLLECTION_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                      No collections breakdown recorded.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* 4. MERCHANDISE PERFORMANCE TABLES */}
          <div className="space-y-3 pt-4 chart-card-print">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              4. Item Performance & Velocity Ranking
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="bg-white border border-teal-200/80 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 border-b border-teal-100 pb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
                  <h4 className="text-xs font-extrabold text-teal-900 uppercase">Top Revenue Generating Products</h4>
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase text-[9px]">
                      <th className="py-2">Item Name</th>
                      <th className="py-2 text-right">Units</th>
                      <th className="py-2 text-right">Gross Revenue</th>
                      <th className="py-2 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {topPerformers.length > 0 ? (
                      topPerformers.map((item, idx) => (
                        <tr key={item.item_id || idx} className="hover:bg-slate-50">
                          <td className="py-2 font-bold text-slate-900">{item.item_name}</td>
                          <td className="py-2 text-right font-mono">{item.units_sold}</td>
                          <td className="py-2 text-right font-mono font-black text-teal-800">{fmtCurr(item.gross_revenue)}</td>
                          <td className="py-2 text-right font-mono text-slate-700">{item.profit_margin_percent}%</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="p-4 text-center text-slate-400">No top performers recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-white border border-rose-200/80 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 border-b border-rose-100 pb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                  <h4 className="text-xs font-extrabold text-rose-900 uppercase">Slow Moving & Low Velocity Items</h4>
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase text-[9px]">
                      <th className="py-2">Item Name</th>
                      <th className="py-2 text-right">Units</th>
                      <th className="py-2 text-right">Gross Revenue</th>
                      <th className="py-2 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {slowMovers.length > 0 ? (
                      slowMovers.map((item, idx) => (
                        <tr key={item.item_id || idx} className="hover:bg-slate-50">
                          <td className="py-2 font-bold text-slate-900">{item.item_name}</td>
                          <td className="py-2 text-right font-mono">{item.units_sold}</td>
                          <td className="py-2 text-right font-mono font-black text-rose-800">{fmtCurr(item.gross_revenue)}</td>
                          <td className="py-2 text-right font-mono text-slate-700">{item.profit_margin_percent}%</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="p-4 text-center text-slate-400">No slow movers recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </div>

          {/* 5. ACCOUNTS RECEIVABLE EXPOSURE */}
          {debtors.length > 0 && (
            <div className="space-y-3 pt-4 chart-card-print">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                5. Customer Credit Exposure & Receivables Aging
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {debtors.map((d, idx) => (
                  <div key={idx} className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{d.customer_name}</div>
                      <div className="text-[10px] text-amber-700 mt-0.5">{d.unpaid_invoices_count || 1} Unpaid Invoices</div>
                    </div>
                    <div className="text-right font-black font-mono text-rose-700 text-sm">
                      {fmtCurr(d.outstanding_balance)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. DETAILED POSTED SALES TRANSACTION REGISTER */}
          <div className="space-y-3 pt-4 chart-card-print">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              6. Detailed Sales Audit Log ({registerData.length} Transactions)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200 uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Receipt / Ref</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Served By</th>
                    <th className="p-3 text-right">Total Amount</th>
                    <th className="p-3 text-right">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {registerData.length > 0 ? (
                    registerData.slice(0, 50).map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-slate-500 font-mono">{tx.sale_date}</td>
                        <td className="p-3 font-mono font-bold text-teal-700">{tx.receipt_number}</td>
                        <td className="p-3 font-bold text-slate-900">{tx.customer}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {tx.payment_method}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500">{tx.served_by}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">{fmtCurr(tx.total_amount)}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">{fmtCurr(tx.amount_paid)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-400 font-mono">
                        No posted transactions recorded for this branch or period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {registerData.length > 50 && (
              <p className="text-[10px] text-slate-400 font-mono text-center">
                Displaying first 50 transactions on preview. Export CSV to download complete audit log.
              </p>
            )}
          </div>

          {/* SIGNATURE / APPROVAL BLOCK */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs font-bold text-slate-600 chart-card-print">
            <div className="text-right flex flex-col items-end">
              <span className="text-[10px] uppercase text-slate-400 block font-mono">Approved By:</span>
              <div className="mt-6 border-b border-slate-400 w-48"></div>
              <span className="mt-1 block text-slate-800">Management</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}