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

  const [startDate, setStartDate] = useState(propStartDate || '');
  const [endDate, setEndDate] = useState(propEndDate || '');

  const [overviewData, setOverviewData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [collectionsData, setCollectionsData] = useState(null);
  const [receivablesData, setReceivablesData] = useState(null);
  const [registerData, setRegisterData] = useState([]);

  const queryParams = useMemo(() => new URLSearchParams(window.location.search), []);
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
      {/* FILTER & CONTROL BAR */}
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
              className="bg-transparent text-xs font-semibold outline-none"
            />
            <span className="text-[10px] font-bold text-slate-400 uppercase">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs font-semibold outline-none"
            />
          </div>

          <button
            onClick={fetchAllAnalytics}
            className="bg-teal-800 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
          >
            ↻ Filter Report
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

          {/* KPI METRIC CARDS */}
          <div className="space-y-3">
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
          </div>

        </div>
      )}
    </div>
  );
}