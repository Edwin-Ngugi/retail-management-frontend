import React, { useState, useEffect } from 'react';
import API from '../api';
import Reports from './Reports';
import SalesView from './SalesView';
import InventoryView from './InventoryView';
import PurchaseView from './PurchaseView';
import CashView from './CashView';

const REPORT_MODULES = [
  {
    id: 'sales',
    title: 'Sales',
    subtitle: 'Revenue performance trends, product lines, and payment channel split.',
    endpoint: '/management-reports/sales/',
    component: SalesView,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    )
  },
  {
    id: 'stock',
    title: 'Stock / Inventory',
    subtitle: 'Inventory valuation, stock movement history, and operational summary.',
    endpoint: '/management-reports/stock/',
    component: InventoryView,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )
  },
  {
    id: 'purchases',
    title: 'Purchases',
    subtitle: 'Supplier purchase orders, restock invoices, and accounts payable.',
    endpoint: '/management-reports/purchases/',
    component: PurchaseView,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    id: 'cash',
    title: 'Cash Operations',
    subtitle: 'Daily tills, bank transactions, and mobile paybill receipts.',
    endpoint: '/management-reports/cash-operations/',
    component: CashView,
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    id: 'debts',
    title: 'Debts',
    subtitle: 'Customer accounts receivable aging and supplier payables ledger.',
    endpoint: '/management-reports/debts/',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    id: 'expenses',
    title: 'Expenses',
    subtitle: 'Operating expenditure categories and operational cost breakdown.',
    endpoint: '/management-reports/expenses/',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    )
  },
  {
    id: 'branches',
    title: 'Branches',
    subtitle: 'Multi-branch profitability comparison and performance rankings.',
    endpoint: '/management-reports/branches/',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
      </svg>
    )
  },
  {
    id: 'summary',
    title: 'Executive Summary',
    subtitle: 'High-level executive overview of sales, gross profit, expenses, and net earnings.',
    endpoint: '/management-reports/summary/',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    )
  },
  {
    id: 'profit',
    title: 'Profit & Loss',
    subtitle: 'Comprehensive Profit & Loss Statement (P&L) breakdown.',
    endpoint: '/management-reports/profit-loss/',
    icon: null
  },
  {
    id: 'cashflow',
    title: 'Cash Flow',
    subtitle: 'Operating, investing, and financing cash flow activities statement.',
    endpoint: '/management-reports/cash-flow/',
    icon: null
  },
  {
    id: 'balancesheet',
    title: 'Balance Sheet',
    subtitle: 'Financial position including Assets, Liabilities, and Capital / Equity.',
    endpoint: '/management-reports/balance-sheet/',
    icon: null
  }
];

export default function ReportsView({ branchId, items = [], initialModule = null }) {
  const [selectedModule, setSelectedModule] = useState(() => {
    if (initialModule) {
      return REPORT_MODULES.find(m => m.id === initialModule) || null;
    }
    return null;
  });

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
    if (initialModule) {
      const found = REPORT_MODULES.find(m => m.id === initialModule);
      if (found) setSelectedModule(found);
    }
  }, [initialModule]);

  useEffect(() => {
    if (selectedModule && !selectedModule.component && selectedModule.id !== 'summary') {
      fetchReportData(selectedModule);
    }
  }, [selectedModule, activeBranch, activeStart, activeEnd, activeMonth, activeYear]);

  const fetchReportData = async (moduleItem) => {
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
      console.error(`Failed to load ${moduleItem.title} Report:`, err);
      setError("Unable to connect to live financial report service.");
    } finally {
      setLoading(false);
    }
  };

  const fmtCurr = (val) => {
    if (val === null || val === undefined || isNaN(val)) return 'KSh 0';
    const num = Number(val);
    if (num < 0) return `(KSh ${Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`;
    return `KSh ${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const renderReportContent = () => {
    // If a dedicated operational view component is assigned, render it directly
    if (selectedModule?.component) {
      const Component = selectedModule.component;
      return <Component branchId={activeBranch} items={items} />;
    }

    if (selectedModule?.id === 'summary') {
      return <Reports items={items} />;
    }

    if (!data) return null;

    switch (selectedModule.id) {
      case 'debts':
        return (
          <div className="space-y-6 max-w-6xl mx-auto pb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider">Customer Debts (Receivables)</span>
                <div className="text-2xl font-black text-rose-900 mt-1">{fmtCurr(data.total_customer_debts)}</div>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider">Supplier Debts (Payables)</span>
                <div className="text-2xl font-black text-amber-900 mt-1">{fmtCurr(data.total_supplier_debts)}</div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                Customer Debtors Ledger
              </h3>
              <div className="divide-y divide-slate-100 text-xs">
                {data.customer_debtors?.length > 0 ? (
                  data.customer_debtors.map((debtor) => (
                    <div key={debtor.customer_id} className="py-2.5 flex justify-between items-center hover:bg-slate-50 px-2 rounded-lg transition">
                      <div>
                        <p className="font-bold text-slate-800">{debtor.customer_name}</p>
                        <p className="text-[10px] text-slate-500">{debtor.phone || 'No Phone'}</p>
                      </div>
                      <span className="font-mono font-bold text-rose-700">{fmtCurr(debtor.outstanding_balance)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-xs py-4 text-center">No outstanding customer debts.</p>
                )}
              </div>
            </div>
          </div>
        );

      case 'expenses':
        return (
          <div className="space-y-6 max-w-6xl mx-auto pb-8">
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center max-w-md mx-auto">
              <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider">Total Operating Expenses</span>
              <div className="text-3xl font-black text-rose-900 mt-1">{fmtCurr(data.total_expenses)}</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                Expenses Audit Log
              </h3>
              <div className="divide-y divide-slate-100 text-xs">
                {data.expenses?.length > 0 ? (
                  data.expenses.map((exp) => (
                    <div key={exp.id} className="py-2.5 flex justify-between items-center hover:bg-slate-50 px-2 rounded-lg transition">
                      <div>
                        <p className="font-bold text-slate-800">{exp.description}</p>
                        <p className="text-[10px] text-slate-500">{exp.date}</p>
                      </div>
                      <span className="font-mono font-bold text-rose-700">{fmtCurr(exp.amount)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-xs py-4 text-center">No expense logs found for this period.</p>
                )}
              </div>
            </div>
          </div>
        );

      case 'branches':
        return (
          <div className="space-y-6 max-w-6xl mx-auto pb-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                Multi-Branch Performance Overview
              </h3>
              <div className="divide-y divide-slate-100 text-xs">
                {data.branches?.length > 0 ? (
                  data.branches.map((b) => (
                    <div key={b.branch_id} className="py-3 flex justify-between items-center hover:bg-slate-50 px-2 rounded-lg transition">
                      <div>
                        <p className="font-bold text-slate-800">{b.branch_name}</p>
                        <p className="text-[10px] text-slate-500">Revenue: {fmtCurr(b.revenue)} • Expenses: {fmtCurr(b.expenses)}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Net Contribution</span>
                        <span className="font-mono font-bold text-teal-800 text-sm">{fmtCurr(b.net_contribution)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-xs py-4 text-center">No branch performance data available.</p>
                )}
              </div>
            </div>
          </div>
        );

      case 'profit':
        return (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-teal-800 text-white p-4 rounded-xl text-center shadow-md">
              <h2 className="text-xl font-black tracking-tight">PROFIT & LOSS STATEMENT</h2>
              <p className="text-xs text-teal-100 mt-1">Period: {data.period || 'Current Financial Period'}</p>
            </div>

            <div className="space-y-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm divide-y divide-slate-100">
              <div className="flex justify-between items-center py-2 text-sm font-bold text-slate-800">
                <span>Revenue</span>
                <span className="text-emerald-700 font-mono text-base">{fmtCurr(data.revenue)}</span>
              </div>
              <div className="flex justify-between items-center py-2 text-sm text-slate-600">
                <span>Less: Cost of Goods Sold</span>
                <span className="text-rose-600 font-mono">{fmtCurr(data.cogs ?? data.cost_of_goods_sold)}</span>
              </div>
              <div className="flex justify-between items-center py-3 text-base font-black text-slate-900 bg-slate-50 px-3 rounded-lg border border-slate-200/80">
                <span>Gross Profit</span>
                <span className="text-teal-700 font-mono">{fmtCurr(data.gross_profit)}</span>
              </div>

              <div className="flex justify-between items-center py-2 text-sm text-slate-600">
                <span>Less: Operating Expenses</span>
                <span className="text-rose-600 font-mono">{fmtCurr(data.operating_expenses ?? data.expenses)}</span>
              </div>
              <div className="flex justify-between items-center py-3 text-base font-black text-slate-900 bg-slate-50 px-3 rounded-lg border border-slate-200/80">
                <span>Operating Profit</span>
                <span className="text-teal-700 font-mono">{fmtCurr(data.operating_profit)}</span>
              </div>

              <div className="flex justify-between items-center py-2 text-sm text-slate-600">
                <span>Finance Costs & Tax</span>
                <span className="text-rose-600 font-mono">{fmtCurr(data.finance_costs_and_tax ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center py-4 text-lg font-black text-slate-900 bg-teal-50 px-4 rounded-xl border border-teal-200">
                <span className="text-teal-900">Net Profit / (Loss)</span>
                <span className="text-teal-800 font-mono text-xl">{fmtCurr(data.net_profit)}</span>
              </div>
            </div>
          </div>
        );

      case 'cashflow':
        return (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-teal-800 text-white p-4 rounded-xl text-center shadow-md">
              <h2 className="text-xl font-black tracking-tight">CASH FLOW STATEMENT</h2>
              <p className="text-xs text-teal-100 mt-1">Period: {data.period || 'Current Financial Period'}</p>
            </div>

            <div className="space-y-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="space-y-2">
                <div className="bg-teal-50 text-teal-800 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">
                  Operating activities
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="flex justify-between py-2"><span>Customer receipts</span><span className="font-mono">{fmtCurr(data.operating_activities?.customer_receipts)}</span></div>
                  <div className="flex justify-between py-2 text-rose-600"><span>Supplier payments</span><span className="font-mono">{fmtCurr(data.operating_activities?.supplier_payments)}</span></div>
                  <div className="flex justify-between py-2 text-rose-600"><span>Operating expenses</span><span className="font-mono">{fmtCurr(data.operating_activities?.operating_expenses)}</span></div>
                  <div className="flex justify-between py-2 text-rose-600"><span>Salaries & wages</span><span className="font-mono">{fmtCurr(data.operating_activities?.salaries_and_wages)}</span></div>
                  <div className="flex justify-between py-2 font-bold text-teal-800 bg-slate-50 px-2 rounded"><span>Net operating cash</span><span className="font-mono">{fmtCurr(data.operating_activities?.net_operating_cash)}</span></div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-2">
                <div className="flex justify-between text-sm font-bold text-slate-800"><span>Net increase in cash</span><span className="font-mono text-emerald-700">{fmtCurr(data.net_increase_in_cash)}</span></div>
                <div className="flex justify-between text-xs text-slate-500"><span>Opening cash</span><span className="font-mono">{fmtCurr(data.opening_cash)}</span></div>
                <div className="flex justify-between text-base font-black text-teal-900 bg-teal-100 p-3 rounded-xl border border-teal-200">
                  <span>CLOSING CASH</span>
                  <span className="font-mono">{fmtCurr(data.closing_cash)}</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'balancesheet':
        return (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-teal-800 text-white p-4 rounded-xl text-center shadow-md">
              <h2 className="text-xl font-black tracking-tight">BALANCE SHEET</h2>
              <p className="text-xs text-teal-100 mt-1">As at {data.as_at_date || 'Current Date'}</p>
            </div>

            <div className="space-y-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="space-y-2">
                <h3 className="text-sm font-black text-teal-900 uppercase tracking-wider border-b border-teal-100 pb-1">ASSETS</h3>
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="flex justify-between py-2"><span>Cash, Bank & M-Pesa</span><span className="font-mono font-semibold">{fmtCurr(data.assets?.cash_bank_mpesa)}</span></div>
                  <div className="flex justify-between py-2"><span>Customer Debts</span><span className="font-mono font-semibold">{fmtCurr(data.assets?.customer_debts)}</span></div>
                  <div className="flex justify-between py-2"><span>Inventory / Stock</span><span className="font-mono font-semibold">{fmtCurr(data.assets?.inventory_stock)}</span></div>
                  <div className="flex justify-between py-2"><span>Equipment</span><span className="font-mono font-semibold">{fmtCurr(data.assets?.equipment)}</span></div>
                  <div className="flex justify-between py-3 text-sm font-black text-teal-900 bg-slate-50 px-2 rounded-lg border border-slate-200/80">
                    <span>TOTAL ASSETS</span>
                    <span className="font-mono">{fmtCurr(data.assets?.total_assets)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-black text-teal-900 uppercase tracking-wider border-b border-teal-100 pb-1">LIABILITIES</h3>
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="flex justify-between py-2 text-rose-600"><span>Supplier Debts</span><span className="font-mono">{fmtCurr(data.liabilities?.supplier_debts)}</span></div>
                  <div className="flex justify-between py-2 text-rose-600"><span>Bank Loan</span><span className="font-mono">{fmtCurr(data.liabilities?.bank_loan)}</span></div>
                  <div className="flex justify-between py-3 text-sm font-black text-rose-800 bg-rose-50 px-2 rounded-lg border border-rose-200">
                    <span>TOTAL LIABILITIES</span>
                    <span className="font-mono">{fmtCurr(data.liabilities?.total_liabilities)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-black text-teal-900 uppercase tracking-wider border-b border-teal-100 pb-1">EQUITY</h3>
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="flex justify-between py-2"><span>Capital & Retained Profits</span><span className="font-mono font-semibold">{fmtCurr(data.equity?.capital_and_retained_profits)}</span></div>
                </div>
              </div>

              <div className="flex justify-between text-sm font-black text-teal-900 bg-teal-50 p-4 rounded-xl border border-teal-200">
                <span>LIABILITIES + EQUITY</span>
                <span className="font-mono text-base">{fmtCurr(data.liabilities_plus_equity)}</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (selectedModule) {
    return (
      <div className="space-y-6 w-full flex-1 flex flex-col">
        {!initialModule && (
          <div className="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-md pb-2 border-b border-slate-200/80">
            <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => { setSelectedModule(null); setData(null); setError(null); }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  ← Back to Management Reports
                </button>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">{selectedModule.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedModule.subtitle}</p>
                </div>
              </div>

              {!selectedModule.component && selectedModule.id !== 'summary' && (
                <button
                  onClick={() => fetchReportData(selectedModule)}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
                >
                  Refresh Report
                </button>
              )}
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex-1 min-h-[calc(100vh-220px)] h-fit w-full">
          {loading && !selectedModule.component && selectedModule.id !== 'summary' ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-3">
              <div className="w-8 h-8 border-4 border-teal-700 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-semibold text-slate-500">Generating live {selectedModule.title} report...</span>
            </div>
          ) : error && !selectedModule.component && selectedModule.id !== 'summary' ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
              {error}
            </div>
          ) : (
            renderReportContent()
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col space-y-6">
      <div className="bg-teal-700 text-white rounded-xl p-3.5 flex items-center gap-3 shadow-md">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 012 2h2a2 2 0 012-2z" />
        </svg>
        <h2 className="text-sm font-black tracking-widest uppercase">MANAGEMENT REPORTS</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {REPORT_MODULES.filter(m => !['profit', 'cashflow', 'balancesheet'].includes(m.id)).map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedModule(item)}
            className="flex flex-col items-center justify-center p-6 rounded-2xl bg-teal-800 hover:bg-teal-900 text-white shadow-md hover:shadow-xl transition-all cursor-pointer min-h-[120px] group border border-teal-700/50"
          >
            <div className="p-2 rounded-xl bg-teal-700/60 group-hover:scale-110 transition-transform mb-2">
              {item.icon}
            </div>
            <span className="text-base font-extrabold tracking-wide text-center">
              {item.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}