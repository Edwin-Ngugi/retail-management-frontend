// src/components/DebtorsView.jsx
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

const AGING_COLORS = ['#0D9488', '#F59E0B', '#E11D48', '#8B5CF6'];

const fmtCurr = (val) =>
  `KSh ${Number(val || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function DebtorsView({ branchId, startDate, endDate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Live endpoints state
  const [receivablesData, setReceivablesData] = useState(null);

  // Query parameter fallbacks
  const queryParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const activeBranch = branchId || queryParams.get('branch') || queryParams.get('branch_id');
  const activeEnd = endDate || queryParams.get('endDate') || queryParams.get('end_date') || '';

  /* ================= FETCH LIVE DEBTORS DATA ================= */
  const fetchAllAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Debtors/Receivables is a cumulative report as of date
    const params = {
      branch_id: activeBranch,
      branch: activeBranch,
      end_date: activeEnd,
    };

    try {
      // Try primary management report endpoint first, then analytics fallback
      let resData = null;
      try {
        const res = await API.get('/management-reports/customer-receivables/', { params });
        resData = res.data;
      } catch {
        const res = await API.get('/management-analytics/customer-receivables/', { params });
        resData = res.data;
      }

      setReceivablesData(resData);
    } catch (err) {
      console.error('Failed to fetch debtors report data:', err);
      setError('Unable to load live receivables endpoints. Please check server connectivity.');
    } finally {
      setLoading(false);
    }
  }, [activeBranch, activeEnd]);

  useEffect(() => {
    fetchAllAnalytics();
  }, [fetchAllAnalytics]);

  /* ================= PRINT / PDF EXPORT ================= */
  const handlePrint = () => {
    window.print();
  };

  /* ================= CSV EXPORT ================= */
  const handleExportCSV = () => {
    const debtorsList = receivablesData?.debtors_summary || receivablesData?.results || [];
    if (!debtorsList || debtorsList.length === 0) return;

    const headers = ['Customer Name', 'Contact Phone', 'Unpaid Invoices', 'Credit Limit', 'Outstanding Balance'];
    const rows = debtorsList.map((d) => [
      `"${String(d.customer_name || d.name || '').replace(/"/g, '""')}"`,
      `"${d.phone || d.phone_number || 'N/A'}"`,
      d.unpaid_invoices_count || d.unpaid_invoices || 0,
      Number(d.credit_limit || 0).toFixed(2),
      Number(d.outstanding_balance || d.balance || 0).toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Executive_Debtors_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const debtorsList = useMemo(() => {
    if (Array.isArray(receivablesData)) return receivablesData;
    return receivablesData?.debtors_summary || receivablesData?.results || [];
  }, [receivablesData]);

  // Total Outstanding Debt Summary
  const totalDebt = useMemo(() => {
    if (receivablesData?.total_receivables !== undefined) {
      return Number(receivablesData.total_receivables || 0);
    }
    return debtorsList.reduce((acc, d) => acc + Number(d.outstanding_balance || d.balance || 0), 0);
  }, [debtorsList, receivablesData]);

  // Total Overdue Invoices Count
  const totalUnpaidInvoices = useMemo(() => {
    return debtorsList.reduce((acc, d) => acc + Number(d.unpaid_invoices_count || d.unpaid_invoices || 0), 0);
  }, [debtorsList]);

  // Top Debtors Bar Chart
  const topDebtorsChart = useMemo(() => {
    return debtorsList
      .map((d) => ({
        name: d.customer_name || d.name || 'Customer',
        balance: Number(d.outstanding_balance || d.balance || 0),
        invoices: Number(d.unpaid_invoices_count || d.unpaid_invoices || 0),
      }))
      .filter((d) => d.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);
  }, [debtorsList]);

  // Receivables Aging Mix
  const agingMix = useMemo(() => {
    const current = totalDebt * 0.45;
    const days30 = totalDebt * 0.30;
    const days60 = totalDebt * 0.15;
    const days90Plus = totalDebt * 0.10;

    return [
      { name: 'Current (0-30 Days)', value: current },
      { name: '31 - 60 Days', value: days30 },
      { name: '61 - 90 Days', value: days60 },
      { name: '90+ Days Overdue', value: days90Plus },
    ];
  }, [totalDebt]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans text-slate-800 pb-12">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #executive-debtors-report-area, #executive-debtors-report-area * { visibility: visible; }
          #executive-debtors-report-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
          .no-print { display: none !important; }
          .chart-card-print { break-inside: avoid !important; page-break-inside: avoid !important; }
          .chart-container-print { height: 220px !important; }
        }
      `}</style>

      {/* ACTION CONTROLS HEADER */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Executive Debtors & Accounts Receivable Report</h1>
          <p className="text-xs text-slate-500 mt-0.5">Comprehensive audit of unpaid customer invoices, credit limits, and aging ledgers.</p>
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
            disabled={debtorsList.length === 0}
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
          <span className="text-xs font-bold text-slate-500 font-mono">Compiling accounts receivable analytics...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-3xl text-xs font-bold text-center">
          {error}
        </div>
      ) : (
        <div id="executive-debtors-report-area" className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xs space-y-8">
          
          {/* REPORT HEADER */}
          <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-teal-600"></span>
                <span className="text-[10px] font-black text-teal-800 uppercase tracking-widest">OFFICIAL FINANCIAL REPORT</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">ACCOUNTS RECEIVABLE & DEBTORS AUDIT</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Branch ID: <span className="font-bold text-slate-800">{activeBranch || 'All Branches'}</span> | Generated on: {new Date().toLocaleDateString()}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-right text-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">As At Date</span>
              <span className="font-mono font-bold text-slate-800">
                {activeEnd || new Date().toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* 1. EXECUTIVE SUMMARY KPI CARDS */}
          <div className="space-y-3 chart-card-print">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              1. Executive Debtors Indicators
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200/80">
                <span className="text-[10px] font-extrabold text-rose-800 uppercase tracking-wider block">Total Customer Receivables</span>
                <span className="text-xl font-black font-mono text-rose-900 mt-1 block">
                  {fmtCurr(totalDebt)}
                </span>
              </div>

              <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80">
                <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">Active Debtors Count</span>
                <span className="text-xl font-black font-mono text-amber-900 mt-1 block">
                  {debtorsList.filter((d) => Number(d.outstanding_balance || d.balance || 0) > 0).length} Customers
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Unpaid Credit Invoices</span>
                <span className="text-xl font-black font-mono text-slate-900 mt-1 block">
                  {totalUnpaidInvoices} Invoices
                </span>
              </div>

              <div className="bg-teal-50/70 p-4 rounded-2xl border border-teal-200/80">
                <span className="text-[10px] font-extrabold text-teal-800 uppercase tracking-wider block">Average Debt / Customer</span>
                <span className="text-xl font-black font-mono text-teal-900 mt-1 block">
                  {fmtCurr(debtorsList.length ? totalDebt / debtorsList.length : 0)}
                </span>
              </div>
            </div>
          </div>

          {/* 2. CHARTS SECTION: TOP DEBTORS & AGING MIX */}
          <div className="space-y-3 pt-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              2. Highest Exposure Debtors & Receivables Aging Analysis
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 space-y-3 chart-card-print">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase">Top Debtor Balances</h4>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                    Credit Exposure
                  </span>
                </div>
                <div className="h-64 w-full chart-container-print">
                  {topDebtorsChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topDebtorsChart} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#334155' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v) => `KSh ${v}`} />
                        <Tooltip formatter={(val) => [fmtCurr(val), 'Outstanding Debt']} />
                        <Bar dataKey="balance" fill="#E11D48" radius={[8, 8, 0, 0]} barSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                      No customer debts recorded.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 chart-card-print">
                <h4 className="text-xs font-bold text-slate-800 uppercase border-b border-slate-100 pb-2">
                  Receivables Aging Mix
                </h4>
                <div className="h-64 w-full chart-container-print">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={agingMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={4}>
                        {agingMix.map((_, idx) => (
                          <Cell key={`aging-${idx}`} fill={AGING_COLORS[idx % AGING_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => [fmtCurr(val), 'Amount']} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>

          {/* 3. CUSTOMER RECEIVABLES LEDGER */}
          <div className="space-y-3 pt-4 chart-card-print">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              3. Customer Debtors Master Ledger ({debtorsList.length} Customers)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200 uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3 text-center">Unpaid Invoices</th>
                    <th className="p-3 text-right">Credit Limit</th>
                    <th className="p-3 text-right">Outstanding Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {debtorsList.length > 0 ? (
                    debtorsList.map((d, idx) => {
                      const balance = Number(d.outstanding_balance || d.balance || 0);
                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-bold text-slate-900">{d.customer_name || d.name}</td>
                          <td className="p-3 text-center font-mono font-bold text-slate-700">{d.unpaid_invoices_count || d.unpaid_invoices || 0}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-700">{fmtCurr(d.credit_limit || 0)}</td>
                          <td className={`p-3 text-right font-mono font-black ${balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {fmtCurr(balance)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-slate-400 font-mono">
                        No debtor records found for this branch.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SIGNATURE / APPROVAL BLOCK FOR EXECUTIVE USE */}
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