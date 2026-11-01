// src/components/FinancialView.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

const fmtCurr = (val) => {
  if (val === null || val === undefined || isNaN(val)) return 'KSh 0.00';
  const num = Number(val);
  if (num < 0) return `(KSh ${Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  return `KSh ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtValOutflow = (val, isOutflow = false) => {
  const num = Number(val || 0);
  if (isOutflow && num > 0) {
    return `(${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  if (num < 0) {
    return `(${Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function FinancialView({ branchId }) {
  const currentDate = useMemo(() => new Date(), []);
  const [activeTab, setActiveTab] = useState('profit'); // 'profit' | 'cashflow' | 'balancesheet' | 'cashbook'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Statement state variables
  const [plData, setPlData] = useState(null);
  const [cashflowData, setCashflowData] = useState(null);
  const [balanceSheetData, setBalanceSheetData] = useState(null);
  const [cashbookData, setCashbookData] = useState(null);

  // -----------------------------------------------------------------
  // PERIOD FILTER STATES
  // -----------------------------------------------------------------
  const [periodType, setPeriodType] = useState(() => {
    if (typeof window === 'undefined') return 'month';
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('period_type') ||
      params.get('periodType') ||
      localStorage.getItem('fin_period_type') ||
      'month'
    );
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window === 'undefined') return currentDate.toISOString().split('T')[0];
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('selectedDate') ||
      localStorage.getItem('fin_selectedDate') ||
      currentDate.toISOString().split('T')[0]
    );
  });

  const [startDate, setStartDate] = useState(() => {
    if (typeof window === 'undefined') return currentDate.toISOString().split('T')[0];
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('start_date') ||
      localStorage.getItem('fin_start_date') ||
      currentDate.toISOString().split('T')[0]
    );
  });

  const [endDate, setEndDate] = useState(() => {
    if (typeof window === 'undefined') return currentDate.toISOString().split('T')[0];
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('end_date') ||
      localStorage.getItem('fin_end_date') ||
      currentDate.toISOString().split('T')[0]
    );
  });

  const [year, setYear] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const paramYear = params.get('year');
      if (paramYear && !isNaN(Number(paramYear))) return Number(paramYear);
      const savedYear = localStorage.getItem('fin_year');
      if (savedYear && !isNaN(Number(savedYear))) return Number(savedYear);
    }
    return currentDate.getFullYear();
  });

  const [month, setMonth] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const paramMonth = params.get('month');
      if (paramMonth && !isNaN(Number(paramMonth))) return Number(paramMonth);
      const savedMonth = localStorage.getItem('fin_month');
      if (savedMonth && !isNaN(Number(savedMonth))) return Number(savedMonth);
    }
    return currentDate.getMonth() + 1;
  });

  const monthNames = useMemo(() => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ], []);

  const availableYears = useMemo(() => {
    const currentYr = currentDate.getFullYear();
    return Array.from({ length: 7 }, (_, index) => currentYr - 3 + index);
  }, [currentDate]);

  const updateUrlAndStorage = useCallback((paramsUpdate) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);

    Object.entries(paramsUpdate).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        url.searchParams.set(key, String(val));
        localStorage.setItem(`fin_${key}`, String(val));
      } else {
        url.searchParams.delete(key);
        localStorage.removeItem(`fin_${key}`);
      }
    });

    window.history.replaceState({}, '', url.toString());
  }, []);

  const handlePeriodChange = (newPeriod) => {
    setPeriodType(newPeriod);

    if (newPeriod === 'month') {
      updateUrlAndStorage({ 
        period_type: newPeriod,
        month,
        year,
        selectedDate: null,
        start_date: null,
        end_date: null,
      });
    } else if (newPeriod === 'day' || newPeriod === 'weekly') {
      updateUrlAndStorage({ 
        period_type: newPeriod,
        selectedDate,
        month: null,
        year: null,
        start_date: null,
        end_date: null,
      });
    } else if (newPeriod === 'custom') {
      updateUrlAndStorage({ 
        period_type: newPeriod,
        start_date: startDate,
        end_date: endDate,
        selectedDate: null,
        month: null,
        year: null,
      });
    } else if (newPeriod === 'year') {
      updateUrlAndStorage({ 
        period_type: newPeriod,
        year,
        month: null,
        selectedDate: null,
        start_date: null,
        end_date: null,
      });
    }
  };

  const handleDateChange = (e) => {
    const val = e.target.value;
    setSelectedDate(val);
    let newYear = year;
    let newMonth = month;

    if (val) {
      const d = new Date(`${val}T00:00:00`);
      if (!isNaN(d.getTime())) {
        newYear = d.getFullYear();
        newMonth = d.getMonth() + 1;
        setYear(newYear);
        setMonth(newMonth);
      }
    }

    updateUrlAndStorage({
      selectedDate: val,
      year: newYear,
      month: newMonth,
      period_type: periodType,
    });
  };

  const handleStartDateChange = (e) => {
    const val = e.target.value;
    setStartDate(val);
    updateUrlAndStorage({
      start_date: val,
      period_type: periodType,
    });
  };

  const handleEndDateChange = (e) => {
    const val = e.target.value;
    setEndDate(val);
    updateUrlAndStorage({
      end_date: val,
      period_type: periodType,
    });
  };

  const handleMonthChange = (newMonth) => {
    setMonth(newMonth);
    const formattedMonth = String(newMonth).padStart(2, '0');
    const newDate = `${year}-${formattedMonth}-01`;
    setSelectedDate(newDate);

    updateUrlAndStorage({
      month: newMonth,
      selectedDate: newDate,
      period_type: periodType,
    });
  };

  const handleYearChange = (newYear) => {
    setYear(newYear);
    const formattedMonth = String(month).padStart(2, '0');
    const newDate = `${newYear}-${formattedMonth}-01`;
    setSelectedDate(newDate);

    updateUrlAndStorage({
      year: newYear,
      selectedDate: newDate,
      period_type: periodType,
    });
  };

  const queryParams = useMemo(() => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''), []);
  const activeBranch = branchId || queryParams.get('branch') || queryParams.get('branch_id');

  /* ================= FETCH ALL STATEMENTS IN PARALLEL ================= */
  const fetchFinancialStatements = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = {
      branch_id: activeBranch,
      branch: activeBranch,
      period_type: periodType,
    };

    if (periodType === 'custom') {
      params.start_date = startDate;
      params.end_date = endDate;
    } else if (periodType === 'day' || periodType === 'weekly') {
      params.date = selectedDate;
    } else if (periodType === 'month') {
      params.year = year;
      params.month = month;
    } else if (periodType === 'year') {
      params.year = year;
    }

    try {
      const [resPL, resCF, resBS, resCB] = await Promise.allSettled([
        API.get('/management-reports/profit-loss/', { params }),
        API.get('/management-reports/cash-flow/', { params }),
        API.get('/management-reports/balance-sheet/', { params }),
        API.get('/management-reports/cashbook/', { params }),
      ]);

      if (resPL.status === 'fulfilled') setPlData(resPL.value.data);
      if (resCF.status === 'fulfilled') setCashflowData(resCF.value.data);
      if (resBS.status === 'fulfilled') setBalanceSheetData(resBS.value.data);
      if (resCB.status === 'fulfilled') setCashbookData(resCB.value.data);
    } catch (err) {
      console.error('Failed to fetch financial statements:', err);
      setError('Unable to connect to live financial report service.');
    } finally {
      setLoading(false);
    }
  }, [activeBranch, periodType, startDate, endDate, selectedDate, year, month]);

  useEffect(() => {
    fetchFinancialStatements();
  }, [fetchFinancialStatements]);

  const handlePrint = () => {
    window.print();
  };

  const getPeriodLabel = () => {
    if (periodType === 'day') return `DATE: ${selectedDate}`;
    if (periodType === 'weekly') return `WEEK OF: ${selectedDate}`;
    if (periodType === 'custom') return `RANGE: ${startDate} TO ${endDate}`;
    if (periodType === 'month') return `MONTH: ${monthNames[month - 1]} ${year}`;
    if (periodType === 'year') return `YEAR: ${year}`;
    return '';
  };

  /* ================= RENDER STATEMENT CONTENT ================= */
  const renderStatementContent = () => {
    if (activeTab === 'profit') {
      const data = plData || {};
      return (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-teal-800 text-white p-4 rounded-xl text-center shadow-md">
            <h2 className="text-xl font-black tracking-tight uppercase">PROFIT & LOSS STATEMENT</h2>
            <p className="text-xs text-teal-100 mt-1 uppercase font-mono font-bold">Period: {data.period || getPeriodLabel()}</p>
          </div>

          <div className="space-y-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm divide-y divide-slate-100">
            <div className="flex justify-between items-center py-2 text-sm font-bold text-slate-800">
              <span>Gross Sales Revenue</span>
              <span className="text-emerald-700 font-mono text-base">{fmtCurr(data.revenue)}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-sm text-slate-600">
              <span>Less: Cost of Goods Sold (COGS)</span>
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
    }

    if (activeTab === 'cashflow') {
      const data = cashflowData || {};
      const op = data?.operating_activities || {};
      const inv = data?.investing_activities || {};
      const fin = data?.financing_activities || {};

      return (
        <div className="max-w-2xl mx-auto space-y-6 text-xs font-sans">
          <div className="bg-teal-900 text-white p-4 rounded-xl text-center space-y-1 shadow-md">
            <h2 className="text-base font-black tracking-wider uppercase">STATEMENT OF CASH FLOWS</h2>
            <p className="text-xs text-teal-200 font-semibold font-mono uppercase">Period: {data?.period || getPeriodLabel()} · KSh</p>
          </div>

          <div className="space-y-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            {/* 1. OPERATING ACTIVITIES */}
            <div className="space-y-2">
              <div className="bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100">
                <span className="text-[11px] font-bold text-teal-900 uppercase">1. Operating Activities</span>
              </div>
              <div className="px-2 space-y-1.5 font-medium text-slate-800">
                <div className="flex justify-between">
                  <span>Customer receipts</span>
                  <span className="font-bold text-slate-900">{fmtValOutflow(op.customer_receipts)}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Supplier payments</span>
                  <span className="font-bold">{fmtValOutflow(op.supplier_payments, true)}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Operating expenses</span>
                  <span className="font-bold">{fmtValOutflow(op.operating_expenses, true)}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Salaries & wages</span>
                  <span className="font-bold">{fmtValOutflow(op.salaries_and_wages, true)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 font-black text-teal-900 text-xs">
                  <span>Net Operating Cash Flow</span>
                  <span>{fmtValOutflow(op.net_operating_cash)}</span>
                </div>
              </div>
            </div>

            {/* 2. INVESTING ACTIVITIES */}
            <div className="space-y-2">
              <div className="bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100">
                <span className="text-[11px] font-bold text-teal-900 uppercase">2. Investing Activities</span>
              </div>
              <div className="px-2 space-y-1.5 font-medium text-slate-800">
                <div className="flex justify-between text-rose-600">
                  <span>Equipment purchased</span>
                  <span className="font-bold">{fmtValOutflow(inv.equipment_purchased, true)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 font-black text-teal-900 text-xs">
                  <span>Net Investing Cash Flow</span>
                  <span className={inv.net_investing_cash < 0 ? 'text-rose-600' : ''}>{fmtValOutflow(inv.net_investing_cash)}</span>
                </div>
              </div>
            </div>

            {/* 3. FINANCING ACTIVITIES */}
            <div className="space-y-2">
              <div className="bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100">
                <span className="text-[11px] font-bold text-teal-900 uppercase">3. Financing Activities</span>
              </div>
              <div className="px-2 space-y-1.5 font-medium text-slate-800">
                <div className="flex justify-between">
                  <span>Capital + Loan received</span>
                  <span className="font-bold text-slate-900">{fmtValOutflow(fin.capital_plus_loan_received || fin.capital_loan_received)}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Loan repayment</span>
                  <span className="font-bold">{fmtValOutflow(fin.loan_repayment, true)}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Drawings</span>
                  <span className="font-bold">{fmtValOutflow(fin.drawings, true)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 font-black text-teal-900 text-xs">
                  <span>Net Financing Cash Flow</span>
                  <span>{fmtValOutflow(fin.net_financing_cash)}</span>
                </div>
              </div>
            </div>

            {/* 4. SUMMARY */}
            <div className="pt-3 border-t-2 border-slate-300 space-y-2 text-xs font-bold">
              <div className="flex justify-between text-teal-900 font-black text-sm">
                <span>Net Increase / (Decrease) in Cash</span>
                <span>{fmtValOutflow(data?.net_increase_in_cash)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Opening Cash Balance</span>
                <span>{fmtValOutflow(data?.opening_cash)}</span>
              </div>
              <div className="bg-teal-100/80 p-3 rounded-xl flex justify-between text-teal-950 font-black text-sm">
                <span>CLOSING CASH BALANCE</span>
                <span>KSh {fmtValOutflow(data?.closing_cash)}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'balancesheet') {
      const data = balanceSheetData || {};
      const bankOverdraft = Number(data.liabilities?.bank_overdraft || 0);

      return (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-teal-800 text-white p-4 rounded-xl text-center shadow-md">
            <h2 className="text-xl font-black tracking-tight uppercase">STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)</h2>
            <p className="text-xs text-teal-100 mt-1 uppercase font-mono font-bold">As at {data.as_at_date || 'Current Financial Date'}</p>
          </div>

          <div className="space-y-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            {/* ASSETS */}
            <div className="space-y-2">
              <h3 className="text-sm font-black text-teal-900 uppercase tracking-wider border-b border-teal-100 pb-1">1. ASSETS</h3>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="flex justify-between py-2">
                  <span>Cash, Bank & M-Pesa Tills</span>
                  <span className="font-mono font-semibold">{fmtCurr(data.assets?.cash_bank_mpesa)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span>Customer Debts (Accounts Receivable)</span>
                  <span className="font-mono font-semibold">{fmtCurr(data.assets?.customer_debts)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span>Inventory / Stock Asset Value</span>
                  <span className="font-mono font-semibold">{fmtCurr(data.assets?.inventory_stock)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span>Equipment & Fixed Assets</span>
                  <span className="font-mono font-semibold">{fmtCurr(data.assets?.equipment)}</span>
                </div>
                <div className="flex justify-between py-3 text-sm font-black text-teal-900 bg-slate-50 px-2 rounded-lg border border-slate-200/80">
                  <span>TOTAL ASSETS</span>
                  <span className="font-mono">{fmtCurr(data.assets?.total_assets)}</span>
                </div>
              </div>
            </div>

            {/* LIABILITIES */}
            <div className="space-y-2">
              <h3 className="text-sm font-black text-rose-900 uppercase tracking-wider border-b border-rose-100 pb-1">2. LIABILITIES</h3>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="flex justify-between py-2 text-rose-600">
                  <span>Supplier Debts (Accounts Payable)</span>
                  <span className="font-mono">{fmtCurr(data.liabilities?.supplier_debts)}</span>
                </div>
                {bankOverdraft > 0 && (
                  <div className="flex justify-between py-2 text-rose-600">
                    <span>Bank Overdraft & Short-Term Credit</span>
                    <span className="font-mono">{fmtCurr(bankOverdraft)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 text-rose-600">
                  <span>Bank Loan & Borrowings</span>
                  <span className="font-mono">{fmtCurr(data.liabilities?.bank_loan)}</span>
                </div>
                <div className="flex justify-between py-3 text-sm font-black text-rose-800 bg-rose-50 px-2 rounded-lg border border-rose-200">
                  <span>TOTAL LIABILITIES</span>
                  <span className="font-mono">{fmtCurr(data.liabilities?.total_liabilities)}</span>
                </div>
              </div>
            </div>

            {/* EQUITY */}
            <div className="space-y-2">
              <h3 className="text-sm font-black text-teal-900 uppercase tracking-wider border-b border-teal-100 pb-1">3. EQUITY</h3>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="flex justify-between py-2">
                  <span>Capital & Retained Earnings</span>
                  <span className="font-mono font-semibold">{fmtCurr(data.equity?.capital_and_retained_profits)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between text-sm font-black text-teal-900 bg-teal-50 p-4 rounded-xl border border-teal-200">
              <span>TOTAL LIABILITIES + EQUITY</span>
              <span className="font-mono text-base">{fmtCurr(data.liabilities_plus_equity)}</span>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'cashbook') {
      const data = cashbookData || {};
      const entries = Array.isArray(data.entries) ? data.entries : Array.isArray(data.results) ? data.results : [];

      return (
        <div className="max-w-5xl mx-auto space-y-6 text-xs font-sans">
          <div className="bg-teal-950 text-white p-4 rounded-xl text-center space-y-1 shadow-md">
            <h2 className="text-base font-black tracking-wider uppercase">CASHBOOK & LIQUIDITY LEDGER</h2>
            <p className="text-xs text-teal-300 font-semibold font-mono uppercase">Period: {data?.period || getPeriodLabel()} · KSh</p>
          </div>

          {/* SUMMARY KPI BANNER */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-emerald-800 uppercase">Total Inflows (Receipts)</span>
              <span className="text-lg font-black font-mono text-emerald-700 mt-2">{fmtCurr(data.total_inflows)}</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-rose-800 uppercase">Total Outflows (Payments)</span>
              <span className="text-lg font-black font-mono text-rose-700 mt-2">{fmtCurr(data.total_outflows)}</span>
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-teal-900 uppercase">Closing Balance</span>
              <span className="text-lg font-black font-mono text-teal-800 mt-2">{fmtCurr(data.closing_balance)}</span>
            </div>
          </div>

          {/* CASHBOOK TRANSACTIONS TABLE */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-600 tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Reference / Details</th>
                    <th className="py-3 px-4 text-right">Debit (Inflow)</th>
                    <th className="py-3 px-4 text-right">Credit (Outflow)</th>
                    <th className="py-3 px-4 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400 font-sans italic text-xs">
                        No cash or liquidity entries recorded for this selected period.
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry, idx) => (
                      <tr key={entry.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4 font-sans text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {entry.date}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-[11px] font-bold text-teal-900 uppercase">
                          {entry.type || entry.transaction_type}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-xs text-slate-600 truncate max-w-xs">
                          {entry.reference || entry.description}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-600">
                          {entry.debit > 0 ? fmtCurr(entry.debit) : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-rose-600">
                          {entry.credit > 0 ? fmtCurr(entry.credit) : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-slate-900">
                          {fmtCurr(entry.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans text-slate-800 pb-12">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #executive-financial-report-area, #executive-financial-report-area * { visibility: visible; }
          #executive-financial-report-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* HEADER CONTROLS */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Executive Financial Statements</h1>
            <p className="text-xs text-slate-500 mt-0.5">Audited Profit & Loss, Cash Flow, Balance Sheet, and Cashbook ledgers.</p>
          </div>

          {/* SUB-TAB TOGGLES */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button
              onClick={() => setActiveTab('profit')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'profit' ? 'bg-teal-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Profit & Loss
            </button>
            <button
              onClick={() => setActiveTab('cashflow')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'cashflow' ? 'bg-teal-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cash Flow
            </button>
            <button
              onClick={() => setActiveTab('balancesheet')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'balancesheet' ? 'bg-teal-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Balance Sheet
            </button>
            <button
              onClick={() => setActiveTab('cashbook')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'cashbook' ? 'bg-teal-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cashbook
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchFinancialStatements}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              ↻ Refresh
            </button>

            <button
              onClick={handlePrint}
              className="bg-teal-800 hover:bg-teal-700 text-white px-5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer shadow-sm"
            >
              🖨️ Download / Print PDF
            </button>
          </div>
        </div>

        {/* PERIOD SELECTION BAR */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Period:
            </label>
            <select
              value={periodType}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-teal-900 text-xs font-bold rounded-lg px-3 py-1.5 outline-none focus:border-teal-500 cursor-pointer"
            >
              <option value="day">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
              <option value="custom">Custom Range</option>
            </select>

            {(periodType === 'day' || periodType === 'weekly') && (
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium outline-none focus:border-teal-500"
              />
            )}

            {periodType === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={handleStartDateChange}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium outline-none focus:border-teal-500"
                />
                <span className="text-xs text-slate-400 font-bold">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={handleEndDateChange}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium outline-none focus:border-teal-500"
                />
              </div>
            )}

            {periodType === 'month' && (
              <div className="flex items-center gap-1.5">
                <select
                  value={month}
                  onChange={(e) => handleMonthChange(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg px-2 py-1 outline-none cursor-pointer"
                >
                  {monthNames.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>{name.slice(0, 3)}</option>
                  ))}
                </select>
                <select
                  value={year}
                  onChange={(e) => handleYearChange(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg px-2 py-1 outline-none cursor-pointer"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}

            {periodType === 'year' && (
              <select
                value={year}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg px-2.5 py-1 outline-none cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </div>

          <div className="text-[11px] font-mono font-bold text-slate-400 flex items-center gap-2">
            <span>Showing:</span>
            <span className="text-slate-700 uppercase">{getPeriodLabel()}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl p-16 border border-slate-200/90 shadow-xs flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-700 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-500 font-mono">Generating financial statements...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-3xl text-xs font-bold text-center">
          {error}
        </div>
      ) : (
        <div id="executive-financial-report-area" className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xs space-y-8">
          {renderStatementContent()}

          {/* SIGNATURE BLOCK FOR EXECUTIVE USE */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs font-bold text-slate-600">
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