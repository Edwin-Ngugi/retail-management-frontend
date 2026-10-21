import React, { useState, useEffect } from 'react';
import API from '../api';

const CASH_MODULES = [
  {
    id: 'overview',
    title: 'Cash Overview',
    subtitle: 'Real-time liquidity, daily cash inflows/outflows, and channel balances.',
    endpoint: '/management-analytics/cash-overview/',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    )
  },
  {
    id: 'receipts',
    title: 'Cash Receipts',
    subtitle: 'Inbound payments from cash sales, customer repayments, and direct deposits.',
    endpoint: '/management-analytics/cash-inflows/',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    )
  },
  {
    id: 'payments',
    title: 'Cash Payments',
    subtitle: 'Outbound cash disbursements, operational expenses, and vendor payouts.',
    endpoint: '/management-analytics/cash-expenses/',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
      </svg>
    )
  },
  {
    id: 'cashbook',
    title: 'Cash Book',
    subtitle: 'Comprehensive chronological journal of all cash transactions and ledger balances.',
    endpoint: '/management-analytics/cash-book/',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )
  },
  {
    id: 'bank',
    title: 'Bank Accounts',
    subtitle: 'Bank account deposits, transfer settlements, and bank balances.',
    endpoint: '/management-analytics/bank-accounts/',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V3h4v18" />
      </svg>
    )
  },
  {
    id: 'mpesa',
    title: 'M-Pesa Accounts',
    subtitle: 'Mobile money transactions, Paybill collections, and Till allocations.',
    endpoint: '/management-analytics/sales-collections/',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    id: 'transfers',
    title: 'Cash Transfers',
    subtitle: 'Inter-account sweeps, bank-to-till transfers, and safe deposits.',
    endpoint: '/management-analytics/cash-transfers/',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    )
  },
  {
    id: 'reconciliation',
    title: 'Reconciliation',
    subtitle: 'Bank & mobile money statement matching, variance audits, and clearing.',
    endpoint: '/management-analytics/cash-reconciliation/',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    id: 'petty_cash',
    title: 'Petty Cash',
    subtitle: 'Minor day-to-day office disbursements, floats, and replenishment logs.',
    endpoint: '/management-analytics/cash-expenses/',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    id: 'reports',
    title: 'Cash Reports',
    subtitle: 'Cash flow statements, liquidity analysis, and channel performance.',
    endpoint: '/management-analytics/cash-overview/',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }
];

export default function CashView({ branchId }) {
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
      setError("Unable to connect to live cash and bank records.");
    } finally {
      setLoading(false);
    }
  };

  const fmtCurr = (val) => `KSh ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const renderModuleContent = () => {
    if (!data) return null;

    const listEntries = data.entries || data.results || [];

    switch (selectedModule.id) {
      case 'overview':
      case 'reports':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
                <span className="text-[10px] font-bold text-teal-600 uppercase">Total Cash Inflows</span>
                <div className="text-xl font-black text-teal-900 mt-1">{fmtCurr(data.total_cash_inflows ?? data.summary?.total_cash_inflows)}</div>
              </div>
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-[10px] font-bold text-rose-600 uppercase">Total Outflows & Expenses</span>
                <div className="text-xl font-black text-rose-900 mt-1">{fmtCurr(data.total_cash_outflows ?? data.summary?.total_cash_outflows)}</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700 uppercase">Net Liquidity / Cash Flow</span>
                <div className="text-xl font-black text-emerald-900 mt-1">{fmtCurr(data.net_cash_flow ?? data.summary?.net_cash_flow)}</div>
              </div>
            </div>
          </div>
        );

      case 'mpesa':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Total Collections</span>
                <div className="text-xl font-black text-emerald-900 mt-1">{fmtCurr(data.total_collections)}</div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase">Channel Collections Breakdown</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Channel</th>
                      <th className="p-3">Total Amount</th>
                      <th className="p-3">Percentage Split</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.breakdown?.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-teal-700">{row.channel}</td>
                        <td className="p-3 font-black text-emerald-700">{fmtCurr(row.amount)}</td>
                        <td className="p-3 font-bold text-slate-700">{row.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'receipts':
      case 'payments':
      case 'cashbook':
      default:
        return (
          <div className="space-y-3">
            {data.summary && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">Total Inflows</span>
                  <div className="text-lg font-black text-emerald-900 mt-0.5">{fmtCurr(data.summary.total_inflow)}</div>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <span className="text-[10px] font-bold text-rose-700 uppercase">Total Outflows</span>
                  <div className="text-lg font-black text-rose-900 mt-0.5">{fmtCurr(data.summary.total_outflow)}</div>
                </div>
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
                  <span className="text-[10px] font-bold text-teal-700 uppercase">Net Position</span>
                  <div className="text-lg font-black text-teal-900 mt-0.5">{fmtCurr(data.summary.net_cash_flow)}</div>
                </div>
              </div>
            )}

            <h4 className="text-xs font-bold text-slate-700 uppercase">Cash Ledger Records ({data.count || listEntries.length})</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Reference / Doc</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Type / Description</th>
                    <th className="p-3">Channel / Method</th>
                    <th className="p-3">Inflow (+)</th>
                    <th className="p-3">Outflow (-)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listEntries.length > 0 ? (
                    listEntries.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-teal-700">{row.reference}</td>
                        <td className="p-3 text-slate-500">{row.date}</td>
                        <td className="p-3 font-bold text-slate-900">{row.description}</td>
                        <td className="p-3 font-semibold text-slate-600">{row.payment_method}</td>
                        <td className="p-3 font-bold text-emerald-600">{row.inflow > 0 || row.type === 'INFLOW' ? fmtCurr(row.inflow || row.amount) : '-'}</td>
                        <td className="p-3 font-bold text-rose-600">{row.outflow > 0 || row.type === 'OUTFLOW' ? fmtCurr(row.outflow || row.amount) : '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="p-4 text-center text-slate-400 italic">No ledger entries found for this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
    }
  };

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
                ← Back to Cash Portal
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
              <span className="text-xs font-semibold text-slate-500">Fetching live financial records for {selectedModule.title}...</span>
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
                <div className="text-xs text-slate-400 italic">No active records found for the selected branch or period.</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col space-y-6">
      <div className="bg-teal-700 text-white rounded-xl p-3.5 flex items-center gap-3 shadow-md">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        <h2 className="text-sm font-black tracking-widest uppercase">CASH MENU BAR</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CASH_MODULES.map((item) => (
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