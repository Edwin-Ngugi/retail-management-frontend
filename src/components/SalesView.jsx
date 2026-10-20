// src/components/SalesView.jsx
import React, { useState, useEffect } from 'react';
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
const COLLECTION_COLORS = ['#0D9488', '#4F46E5', '#F59E0B'];

const MODULE_SECTIONS = [
  {
    category: 'Analytics & Registers',
    items: [
      {
        id: 'overview',
        title: 'Sales Overview',
        subtitle: 'KPIs, performance trends, revenue targets, and critical sales alerts.',
        endpoint: 'management-analytics/sales-overview/',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: (
          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        )
      },
      {
        id: 'analysis',
        title: 'Sales Analysis',
        subtitle: 'Deep dive analytics for the selected branch (velocity, top performers, slow movers, margins).',
        endpoint: 'management-analytics/sales-analysis/',
        badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
        icon: (
          <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v619 8a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2h2a2 2 0 012 2m0 10V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        )
      },
      {
        id: 'register',
        title: 'Sales Register',
        subtitle: 'Comprehensive posted invoice, cash receipt, and credit note transaction logs.',
        endpoint: 'management-analytics/sales-register/',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: (
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      },
    ]
  },
  {
    category: 'Finance & Collections',
    items: [
      {
        id: 'receivables',
        title: 'Customer Receivables',
        subtitle: 'Track debtor balances, credit limit compliance, unpaid bills, and ageing.',
        endpoint: 'management-analytics/customer-receivables/',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: (
          <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      },
      {
        id: 'collections',
        title: 'Sales Collections',
        subtitle: 'Cash, bank transfer, M-Pesa paybill/till, and credit settlement analysis.',
        endpoint: 'management-analytics/sales-collections/',
        badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        icon: (
          <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        )
      },
      {
        id: 'returns',
        title: 'Returns & Discounts',
        subtitle: 'Audit customer product returns, price adjustments, discounts, and order voids.',
        endpoint: 'management-analytics/sales-returns-discounts/',
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: (
          <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H3m0 0l3-3m-3 3l3 3m9 14V12a4 4 0 00-4-4H3" />
          </svg>
        )
      },
    ]
  }
];

export default function SalesView({ branchId, startDate, endDate }) {
  const [selectedSection, setSelectedSection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const queryParams = new URLSearchParams(window.location.search);
  const activeBranch = branchId || queryParams.get('branch') || queryParams.get('branch_id');
  const activeStart = startDate || queryParams.get('startDate') || queryParams.get('start_date');
  const activeEnd = endDate || queryParams.get('endDate') || queryParams.get('end_date');
  const activeMonth = queryParams.get('month');
  const activeYear = queryParams.get('year');

  useEffect(() => {
    if (selectedSection) {
      fetchSectionData(selectedSection);
    }
  }, [selectedSection, activeBranch, activeStart, activeEnd, activeMonth, activeYear]);

  const fetchSectionData = async (section) => {
    setLoading(true);
    setError(null);

    const cleanEndpoint = section.endpoint.replace(/^\/+/, '');

    try {
      const response = await API.get(cleanEndpoint, {
        params: { 
          branch_id: activeBranch, 
          start_date: activeStart, 
          end_date: activeEnd,
          month: activeMonth,
          year: activeYear
        }
      });
      setData(response.data);
    } catch (err) {
      console.error(`Failed to load ${section.title} data:`, err);
      setError("Unable to load live endpoint metrics. Please check server connection.");
    } finally {
      setLoading(false);
    }
  };

  const fmtCurr = (val) => `KSh ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const renderModuleContent = () => {
    if (!data) return null;

    switch (selectedSection.id) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Gross Revenue</span>
                <div className="text-xl font-black text-slate-900 mt-1">{fmtCurr(data.summary?.gross_revenue)}</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Total Paid</span>
                <div className="text-xl font-black text-emerald-900 mt-1">{fmtCurr(data.summary?.total_paid)}</div>
              </div>
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-[10px] font-bold text-blue-600 uppercase">Transactions</span>
                <div className="text-xl font-black text-blue-900 mt-1">{data.summary?.transaction_count || 0} Orders</div>
              </div>
              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                <span className="text-[10px] font-bold text-purple-600 uppercase">Avg Order Value</span>
                <div className="text-xl font-black text-purple-900 mt-1">{fmtCurr(data.summary?.average_transaction_value)}</div>
              </div>
            </div>

            {/* Sales Operations & Audit Health */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Sales Operations & Audit Health
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1">
                  <span className="text-[10px] font-bold text-amber-700 uppercase">Credit Exposure (Unsettled Sales)</span>
                  <div className="text-lg font-black text-amber-900">{fmtCurr(data.operational_health?.credit_sales_exposure)}</div>
                  <p className="text-[11px] text-amber-600 font-medium">Booked as customer credit this period</p>
                </div>

                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 space-y-1">
                  <span className="text-[10px] font-bold text-purple-700 uppercase">Discounts Granted</span>
                  <div className="text-lg font-black text-purple-900">{fmtCurr(data.operational_health?.total_discounts_granted)}</div>
                  <p className="text-[11px] text-purple-600 font-medium">{data.operational_health?.discount_rate_percent}% effective discount rate</p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Basket Size & Item Velocity</span>
                  <div className="text-lg font-black text-slate-900">{data.operational_health?.average_items_per_basket} items / order</div>
                  <p className="text-[11px] text-slate-500 font-medium">{data.operational_health?.total_units_sold} total units sold</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'analysis':
        {
          const summary = data?.branch_summary || {};
          const dailyTrends = data?.daily_trends || [];
          const topPerformers = data?.top_performers || [];
          const slowMovers = data?.slow_movers || [];
          const categories = data?.category_breakdown || [];

          return (
            <div className="space-y-6 max-w-7xl mx-auto pb-8">
              {/* 1. TOP KPI CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Branch Revenue</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{fmtCurr(summary.gross_revenue)}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Total COGS</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{fmtCurr(summary.total_cogs)}</div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 shadow-sm">
                  <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">Gross Profit</span>
                  <div className="text-2xl font-black text-emerald-900 mt-1">{fmtCurr(summary.gross_profit)}</div>
                </div>
                <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 shadow-sm">
                  <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-wider">Branch Margin %</span>
                  <div className="text-2xl font-black text-teal-900 mt-1">{summary.profit_margin_percent ?? 0}%</div>
                </div>
              </div>

              {/* 2. CHARTS SECTION */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LINE CHART: Daily Revenue Trend */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Revenue & Velocity Trajectory
                    </h3>
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                      Daily Trend
                    </span>
                  </div>
                  <div className="h-64 w-full">
                    {dailyTrends.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v) => `KSh ${v}`} />
                          <Tooltip formatter={(val) => [fmtCurr(val), 'Revenue']} />
                          <Line type="monotone" dataKey="revenue" stroke="#0D9488" strokeWidth={3} dot={{ r: 4, fill: '#0D9488' }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        No trajectory records for this period.
                      </div>
                    )}
                  </div>
                </div>

                {/* PIE CHART: Revenue Distribution by Category */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                    Category Contribution Mix
                  </h3>
                  <div className="h-64 w-full">
                    {categories.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categories} dataKey="revenue" nameKey="category" cx="50%" cy="50%" outerRadius={75} innerRadius={45} paddingAngle={4}>
                            {categories.map((entry, idx) => (
                              <Cell key={`cat-${idx}`} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val) => [fmtCurr(val), 'Revenue']} />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        No category breakdown recorded.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. BAR CHART: Top Products Revenue Comparison */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Product Performance Comparison
                </h3>
                <div className="h-60 w-full">
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
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No top-performer data available.
                    </div>
                  )}
                </div>
              </div>

              {/* 4. PERFORMANCE TABLES */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-teal-200/80 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 border-b border-teal-100 pb-2">
                    <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                    <h3 className="text-xs font-black text-teal-900 uppercase tracking-wider">Best Performing Items</h3>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 uppercase text-[9px]">
                        <th className="py-2">Item Name</th>
                        <th className="py-2 text-right">Qty Sold</th>
                        <th className="py-2 text-right">Revenue</th>
                        <th className="py-2 text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {topPerformers.map((item) => (
                        <tr key={item.item_id}>
                          <td className="py-2 font-semibold text-slate-800">{item.item_name}</td>
                          <td className="py-2 text-right">{item.units_sold}</td>
                          <td className="py-2 text-right text-teal-800 font-mono font-bold">{fmtCurr(item.gross_revenue)}</td>
                          <td className="py-2 text-right font-mono">{item.profit_margin_percent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white border border-rose-200/80 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 border-b border-rose-100 pb-2">
                    <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                    <h3 className="text-xs font-black text-rose-900 uppercase tracking-wider">Slow-Moving Items</h3>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 uppercase text-[9px]">
                        <th className="py-2">Item Name</th>
                        <th className="py-2 text-right">Qty Sold</th>
                        <th className="py-2 text-right">Revenue</th>
                        <th className="py-2 text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {slowMovers.map((item) => (
                        <tr key={item.item_id}>
                          <td className="py-2 font-semibold text-slate-800">{item.item_name}</td>
                          <td className="py-2 text-right">{item.units_sold}</td>
                          <td className="py-2 text-right text-rose-800 font-mono font-bold">{fmtCurr(item.gross_revenue)}</td>
                          <td className="py-2 text-right font-mono">{item.profit_margin_percent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        }

      case 'register':
        return (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase">Posted Sales Register ({data.count || 0} Transactions)</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Receipt / Ref</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Served By</th>
                    <th className="p-3 text-right">Total Amount</th>
                    <th className="p-3 text-right">Paid Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.results && data.results.length > 0 ? (
                    data.results.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-500">{tx.sale_date}</td>
                        <td className="p-3 font-mono font-bold text-teal-700">{tx.receipt_number}</td>
                        <td className="p-3 font-medium text-slate-900">{tx.customer}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {tx.payment_method}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500">{tx.served_by}</td>
                        <td className="p-3 text-right font-bold text-slate-900">{fmtCurr(tx.total_amount)}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">{fmtCurr(tx.amount_paid)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-6 text-center text-xs text-slate-400 italic">
                        No posted transactions recorded for this branch or period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'receivables':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase">Debtors Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.debtors_summary?.map((d, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{d.customer_name}</div>
                      <div className="text-xs text-amber-700 mt-0.5">{d.unpaid_invoices_count} Unpaid Invoices</div>
                    </div>
                    <div className="text-right font-black text-rose-600 text-sm">{fmtCurr(d.outstanding_balance)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'collections':
        {
          const collectionsBreakdown = data.breakdown || [];

          return (
            <div className="space-y-6">
              {/* Total Collections Summary Header */}
              <div className="p-5 rounded-2xl bg-teal-50 border border-teal-200 flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">Total Collections</span>
                  <div className="text-2xl font-black text-teal-900 mt-1">{fmtCurr(data.total_collections)}</div>
                </div>
                <span className="text-xs px-3 py-1 bg-teal-600 text-white rounded-lg font-bold">Settled</span>
              </div>

              {/* Settlement Cards */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Channel Settlements
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {collectionsBreakdown.map((ch, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white space-y-1 shadow-sm">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{ch.channel}</span>
                      <div className="text-xl font-black text-slate-900">{fmtCurr(ch.amount)}</div>
                      <div className="text-xs font-bold text-teal-600">{ch.percentage}% of total</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                {/* BAR CHART: Collections Volume */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                    Settlement Volume by Channel
                  </h3>
                  <div className="h-64 w-full">
                    {collectionsBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={collectionsBreakdown} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="channel" tick={{ fontSize: 10, fill: '#334155' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v) => `KSh ${v}`} />
                          <Tooltip formatter={(val) => [fmtCurr(val), 'Amount']} />
                          <Bar dataKey="amount" fill="#0D9488" radius={[8, 8, 0, 0]} barSize={40}>
                            {collectionsBreakdown.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={COLLECTION_COLORS[idx % COLLECTION_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        No collection records found.
                      </div>
                    )}
                  </div>
                </div>

                {/* PIE CHART: Collection Contribution Mix */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                    Collection Channel Mix
                  </h3>
                  <div className="h-64 w-full">
                    {collectionsBreakdown.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={collectionsBreakdown}
                            dataKey="amount"
                            nameKey="channel"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            innerRadius={50}
                            paddingAngle={5}
                          >
                            {collectionsBreakdown.map((entry, idx) => (
                              <Cell key={`pie-${idx}`} fill={COLLECTION_COLORS[idx % COLLECTION_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val) => [fmtCurr(val), 'Amount']} />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        No collection records found.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        }

      case 'returns':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] font-bold text-amber-700 uppercase">Discounts Granted</span>
                <div className="text-xl font-black text-amber-900 mt-1">{fmtCurr(data.summary?.total_discounts_granted)}</div>
              </div>
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-[10px] font-bold text-rose-700 uppercase">Product Returns Value</span>
                <div className="text-xl font-black text-rose-900 mt-1">{fmtCurr(data.summary?.total_returns_value)}</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Total Returns Count</span>
                <div className="text-xl font-black text-slate-900 mt-1">{data.summary?.total_returns_count || 0} Items</div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (selectedSection) {
    return (
      <div className="space-y-6 w-full px-4 sm:px-6 lg:px-8">
        {/* Sticky Sub-Header bar for active section controls */}
        <div className="sticky top-0 z-30 bg-slate-100/90 backdrop-blur-md py-3 border-b border-slate-200/80 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setSelectedSection(null); setData(null); setError(null); }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                ← Back to Sales Portal
              </button>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${selectedSection.badgeColor}`}>
                  {selectedSection.icon}
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">{selectedSection.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedSection.subtitle}</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => fetchSectionData(selectedSection)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
            >
              Refresh Records
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm min-h-[520px] w-full">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-3">
              <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-semibold text-slate-500">Fetching records for {selectedSection.title}...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
              {error}
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                {selectedSection.title} Operational Ledger
              </h3>
              
              {data ? renderModuleContent() : (
                <div className="text-xs text-slate-400 italic">No records found for the selected branch or period.</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full px-4 sm:px-6 lg:px-8 py-2">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sales Operations Portal</h2>
          <p className="text-xs text-slate-500 mt-1">Select an operational module to view live performance reports, transactions, and ledgers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ACTIVE MODULES</span>
            <div className="text-xl font-black text-slate-900 mt-0.5">6 Reports Ready</div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
      </div>

      <div className="space-y-8">
        {MODULE_SECTIONS.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                {group.category}
              </span>
              <div className="flex-1 h-px bg-slate-200/80" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {group.items.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => setSelectedSection(sec)}
                  className="flex flex-col justify-between p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-teal-600 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all group cursor-pointer text-left relative overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={`p-2.5 rounded-xl border ${sec.badgeColor} transition-transform group-hover:scale-110`}>
                        {sec.icon}
                      </div>
                      <span className="text-slate-300 group-hover:text-teal-600 font-bold text-lg transition-colors">
                        &rarr;
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-base text-slate-900 group-hover:text-teal-700 transition-colors">
                        {sec.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                        {sec.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-[11px] font-bold text-slate-400 group-hover:text-teal-600 transition-colors">
                    <span>View Report</span>
                    <span>Module →</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}