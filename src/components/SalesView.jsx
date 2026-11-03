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
  const [exportingSummary, setExportingSummary] = useState(false);
  const [exportingDetailed, setExportingDetailed] = useState(false);
  const [error, setError] = useState(null);
  const [expandedTxnIds, setExpandedTxnIds] = useState([]);

  // Read URL query parameters for period context
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  
  const [periodType, setPeriodType] = useState(() => searchParams.get('period_type') || 'day');
  const [selectedDate, setSelectedDate] = useState(() => searchParams.get('selectedDate') || propStartDate || '');
  const [year, setYear] = useState(() => searchParams.get('year') || new Date().getFullYear().toString());
  const [month, setMonth] = useState(() => searchParams.get('month') || (new Date().getMonth() + 1).toString());

  const [startDate, setStartDate] = useState(propStartDate || '');
  const [endDate, setEndDate] = useState(propEndDate || '');

  const [detailedReport, setDetailedReport] = useState(null);

  const activeBranch = useMemo(() => {
    if (branchId && String(branchId).toLowerCase() !== 'all') {
      return String(branchId);
    }
    const urlBranch = searchParams.get('branch') || searchParams.get('branch_id');
    return urlBranch && String(urlBranch).toLowerCase() !== 'all' ? String(urlBranch) : '';
  }, [branchId, searchParams]);

  const fetchAllAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = {
      period_type: periodType,
      selectedDate: selectedDate,
      year: year,
      month: month,
    };

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
  }, [activeBranch, periodType, selectedDate, year, month, startDate, endDate]);

  useEffect(() => {
    fetchAllAnalytics();
  }, [fetchAllAnalytics]);

  const toggleTxnExpand = (id) => {
    setExpandedTxnIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  /* ================= EXPORT PDF DOWNLOAD LOGIC ================= */
  const handleExportPdf = async (type = 'summary') => {
    const isDetailed = type === 'detailed';
    if (isDetailed) setExportingDetailed(true);
    else setExportingSummary(true);

    try {
      const params = {
        period_type: periodType,
        selectedDate: selectedDate,
        year: year,
        month: month,
        export_type: type,
      };

      if (activeBranch) {
        params.branch_id = activeBranch;
        params.branch = activeBranch;
      }
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await API.get('sales-analysis-detailed/export-sales-analysis-pdf/', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `${type === 'detailed' ? 'Detailed' : 'Summary'}_Sales_Report_${periodType}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to download PDF report:', err);
      window.print();
    } fontally {
      if (isDetailed) setExportingDetailed(false);
      else setExportingSummary(false);
    }
  };

  const summary = detailedReport?.summary || {};
  const dailyTrends = detailedReport?.daily_trends || [];
  const rawPaymentBreakdown = detailedReport?.payment_breakdown || [];
  const insights = detailedReport?.insights || [];
  const transactions = detailedReport?.transactions || [];

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

        {/* Filters and Download Actions */}
        <div className="flex flex-wrap items-center gap-3">
          
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            {['day', 'week', 'month', 'year'].map((type) => (
              <button
                key={type}
                onClick={() => setPeriodType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                  periodType === type
                    ? 'bg-teal-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {periodType === 'day' || periodType === 'week' ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium">
              <span className="text-slate-500 text-[10px] uppercase font-bold">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-slate-700 outline-none cursor-pointer focus:text-slate-900 font-semibold"
              />
            </div>
          ) : periodType === 'month' ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium">
              <span className="text-slate-500 text-[10px] uppercase font-bold">Month:</span>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-transparent text-slate-700 outline-none cursor-pointer focus:text-slate-900 font-semibold"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
              <span className="text-slate-400">—</span>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-16 bg-transparent text-slate-700 outline-none font-semibold"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium">
              <span className="text-slate-500 text-[10px] uppercase font-bold">Year:</span>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-16 bg-transparent text-slate-700 outline-none font-semibold"
              />
            </div>
          )}

          <button
            onClick={fetchAllAnalytics}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-all border border-slate-200 cursor-pointer"
          >
            ↻ Refresh
          </button>

          {/* DUAL DOWNLOAD BUTTONS */}
          <button
            onClick={() => handleExportPdf('summary')}
            disabled={exportingSummary || exportingDetailed}
            className="bg-teal-800 hover:bg-teal-700 disabled:bg-teal-400 text-white px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            {exportingSummary ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              '📊 Summary Report PDF'
            )}
          </button>

          <button
            onClick={() => handleExportPdf('detailed')}
            disabled={exportingSummary || exportingDetailed}
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            {exportingDetailed ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              '📑 Detailed Report PDF'
            )}
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

          {/* DETAILED SALE TRANSACTIONS LEDGER WITH EXPANDABLE ITEM BREAKDOWN */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  🛒 Sale Transactions Ledger
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click 'View Details' on any transaction row to expand line item breakdowns.
                </p>
              </div>
              <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                {transactions.length} Sales Recorded
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 uppercase text-[9px] tracking-wider font-extrabold">
                    <th className="py-3 px-4">Receipt No</th>
                    <th className="py-3 px-4">Date / Time</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Payment Channel</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400 font-mono">
                        No sale transactions found for this period filter.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((txn) => {
                      const isExpanded = expandedTxnIds.includes(txn.id);
                      return (
                        <React.Fragment key={txn.id}>
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-800">
                              {txn.receipt_number}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                              {txn.sale_date}
                            </td>
                            <td className="py-3 px-4 text-slate-800">
                              {txn.customer_name}
                            </td>
                            <td className="py-3 px-4">
                              <span className="bg-teal-50 border border-teal-200 text-teal-900 font-bold px-2 py-0.5 rounded-full text-[10px] uppercase">
                                {txn.payment_method}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                              {fmtCurr(txn.total_amount)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => toggleTxnExpand(txn.id)}
                                className="bg-slate-100 hover:bg-teal-800 hover:text-white text-slate-700 font-bold px-3 py-1 rounded-lg text-[10px] transition cursor-pointer"
                              >
                                {isExpanded ? '▲ Hide Details' : '▼ View Details'}
                              </button>
                            </td>
                          </tr>

                          {/* EXPANDABLE ITEMIZED BASKET BREAKDOWN */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90">
                              <td colSpan="6" className="p-4">
                                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Itemized Basket Breakdown for Receipt: {txn.receipt_number}
                                  </span>
                                  <table className="w-full text-left text-[11px] border-collapse">
                                    <thead>
                                      <tr className="border-b border-slate-200 text-slate-400 uppercase text-[9px]">
                                        <th className="py-1.5">Product Name</th>
                                        <th className="py-1.5 text-center">Qty</th>
                                        <th className="py-1.5 text-right">Unit Price</th>
                                        <th className="py-1.5 text-right">Discount / Unit</th>
                                        <th className="py-1.5 text-right">Subtotal Revenue</th>
                                        <th className="py-1.5 text-right">Est. Profit</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-mono">
                                      {txn.items && txn.items.length > 0 ? (
                                        txn.items.map((item, idx) => (
                                          <tr key={idx} className="hover:bg-slate-50">
                                            <td className="py-2 font-sans font-semibold text-slate-800">
                                              {item.item_name}
                                            </td>
                                            <td className="py-2 text-center text-slate-600">
                                              {item.quantity}
                                            </td>
                                            <td className="py-2 text-right text-slate-700">
                                              {fmtCurr(item.unit_price)}
                                            </td>
                                            <td className="py-2 text-right text-rose-600">
                                              {item.discount > 0 ? fmtCurr(item.discount) : '-'}
                                            </td>
                                            <td className="py-2 text-right font-bold text-teal-800">
                                              {fmtCurr(item.line_revenue)}
                                            </td>
                                            <td className="py-2 text-right font-bold text-emerald-700">
                                              {fmtCurr(item.line_profit)}
                                            </td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td colSpan="6" className="py-3 text-center text-slate-400 font-sans italic">
                                            No line items recorded for this sale.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* FAST & SLOW MOVING GOODS ANALYSIS */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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