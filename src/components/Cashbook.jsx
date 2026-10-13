// src/components/Cashbook.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

// Currency Formatter for KSh
const formatCurrency = (value) => {
  const num = Number(value) || 0;
  return `KSh ${num.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Safe Date Formatter to avoid "Invalid Date"
const formatDateSafe = (rawDate) => {
  if (!rawDate) return '-';
  
  if (typeof rawDate === 'string' && rawDate.includes('to')) {
    return rawDate;
  }

  const parsed = new Date(rawDate);
  if (isNaN(parsed.getTime())) {
    return String(rawDate);
  }

  return parsed.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export default function Cashbook({ selectedBranch }) {
  // Navigation tab state: 'cashbook' | 'balance_sheet'
  const [activeTab, setActiveTab] = useState('cashbook');

  // Cashbook state
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({
    total_inflow: 0,
    total_outflow: 0,
    net_cash_flow: 0,
    total_entries: 0,
  });
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('ALL');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [groupBySummary, setGroupBySummary] = useState(true);

  // Period filter states
  const [periodType, setPeriodType] = useState('month');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Balance Sheet state
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [loadingBS, setLoadingBS] = useState(false);

  // Cash Voucher Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    type: 'INFLOW',
    category: 'Cash Sale',
    amount: '',
    description: '',
    payment_method: 'CASH',
    reference: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const buildPeriodParams = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedBranch) params.append('branch', selectedBranch);

    params.append('period_type', periodType);

    if (periodType === 'day') {
      if (selectedDate) params.append('date', selectedDate);
    } else if (periodType === 'month') {
      params.append('month', selectedMonth);
      params.append('year', selectedYear);
    } else if (periodType === 'year') {
      params.append('year', selectedYear);
    }

    return params;
  }, [selectedBranch, periodType, selectedDate, selectedMonth, selectedYear]);

  // Fetch Cashbook records
  const fetchCashbookEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildPeriodParams();
      if (selectedMethod) params.append('payment_method', selectedMethod);

      window.history.replaceState(null, '', `?${params.toString()}`);

      const response = await API.get(`cashbook/?${params.toString()}`);
      const data = response?.data || {};

      setEntries(Array.isArray(data.entries) ? data.entries : []);
      if (data.summary) {
        setSummary(data.summary);
      } else {
        setSummary({
          total_inflow: 0,
          total_outflow: 0,
          net_cash_flow: 0,
          total_entries: 0,
        });
      }
    } catch (err) {
      console.error('Error fetching cashbook records:', err);
      setEntries([]);
      setSummary({
        total_inflow: 0,
        total_outflow: 0,
        net_cash_flow: 0,
        total_entries: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [buildPeriodParams, selectedMethod]);

  // Fetch Balance Sheet Data
  const fetchBalanceSheet = useCallback(async () => {
    setLoadingBS(true);
    try {
      const params = buildPeriodParams();

      const response = await API.get(`balance-sheet/?${params.toString()}`);
      setBalanceSheet(response?.data || null);
    } catch (err) {
      console.error('Error fetching balance sheet:', err);
      setBalanceSheet(null);
    } finally {
      setLoadingBS(false);
    }
  }, [buildPeriodParams]);

  useEffect(() => {
    if (activeTab === 'cashbook') {
      fetchCashbookEntries();
    } else {
      fetchBalanceSheet();
    }
  }, [activeTab, fetchCashbookEntries, fetchBalanceSheet]);

  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) {
      setErrorMsg('Please provide a valid cash amount.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        amount: Number(formData.amount),
        branch: selectedBranch,
        date: selectedDate,
      };

      await API.post('cashbook/', payload);
      setShowAddModal(false);
      setFormData({
        type: 'INFLOW',
        category: 'Cash Sale',
        amount: '',
        description: '',
        payment_method: 'CASH',
        reference: '',
      });
      fetchCashbookEntries();
    } catch (err) {
      console.error('Failed to save cashbook record:', err);
      setErrorMsg(
        err.response?.data?.detail || 'Failed to submit cashbook entry.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesType =
        filterType === 'ALL' || entry.type?.toUpperCase() === filterType;
      const search = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !search ||
        (entry.description || '').toLowerCase().includes(search) ||
        (entry.category || '').toLowerCase().includes(search) ||
        (entry.reference || '').toLowerCase().includes(search);

      return matchesType && matchesSearch;
    });
  }, [entries, filterType, searchTerm]);

  const getMethodBadge = (method) => {
    switch (method?.toUpperCase()) {
      case 'CASH':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'MPESA':
      case 'PAYBILL':
      case 'SEND_MONEY':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'BANK_TRANSFER':
      case 'BANK':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-300';
    }
  };

  const getBalanceSheetDateLabel = () => {
    if (periodType === 'day') {
      return selectedDate
        ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-KE', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })
        : '-';
    }

    if (periodType === 'month') {
      return new Date(selectedYear, selectedMonth, 0).toLocaleDateString('en-KE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    }

    return new Date(selectedYear, 11, 31).toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden text-slate-900">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-4 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('cashbook')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'cashbook'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Cashbook & Liquidity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('balance_sheet')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === 'balance_sheet'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Balance Sheet
          </button>
        </div>

        {/* ---------------- CASHBOOK TAB ---------------- */}
        {activeTab === 'cashbook' && (
          <>
            <div className="p-6 border-b border-slate-200">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">Cashbook & Liquidity</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Monitor real-time cash inflows, outflows, and net cash balances.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-300">
                    {['day', 'month', 'year'].map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setPeriodType(pt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                          periodType === pt
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {pt}
                      </button>
                    ))}
                  </div>

                  {periodType === 'day' && (
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-slate-50 border border-slate-300 text-xs text-slate-900 px-3 py-1.5 rounded-xl outline-none"
                    />
                  )}

                  {periodType === 'month' && (
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl">
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="bg-transparent text-xs text-slate-900 outline-none"
                      >
                        {[
                          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                        ].map((m, idx) => (
                          <option key={m} value={idx + 1} className="bg-white text-slate-900">
                            {m}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-transparent text-xs text-slate-900 outline-none"
                      >
                        {[2024, 2025, 2026, 2027].map((y) => (
                          <option key={y} value={y} className="bg-white text-slate-900">
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {periodType === 'year' && (
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl">
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-transparent text-xs text-slate-900 outline-none"
                      >
                        {[2024, 2025, 2026, 2027].map((y) => (
                          <option key={y} value={y} className="bg-white text-slate-900">
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={fetchCashbookEntries}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-300 shadow-sm transition-all flex items-center gap-2"
                  >
                    <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5.64 9A7 7 0 0117.9 6.1L20 9M4 15l2.1 2.9A7 7 0 0018.36 15" />
                    </svg>
                    Refresh
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Record Cash Entry
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Inflows</span>
                  <p className="text-xl font-extrabold text-slate-900 mt-1 font-mono">
                    {formatCurrency(summary.total_inflow)}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Outflows</span>
                  <p className="text-xl font-extrabold text-slate-900 mt-1 font-mono">
                    {formatCurrency(summary.total_outflow)}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Net Cash Balance</span>
                  <p className={`text-xl font-extrabold mt-1 font-mono ${summary.net_cash_flow >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {formatCurrency(summary.net_cash_flow)}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search description, category, or ref..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64 pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-300">
                  {['ALL', 'INFLOW', 'OUTFLOW'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFilterType(t)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                        filterType === t
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t === 'ALL' ? 'All' : t === 'INFLOW' ? 'Inflows (+)' : 'Outflows (-)'}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setGroupBySummary(!groupBySummary)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    groupBySummary
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  {groupBySummary ? 'Summary Totals' : 'Detailed Itemized'}
                </button>

                <select
                  value={selectedMethod}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  className="bg-white border border-slate-300 text-xs text-slate-900 px-3 py-2 rounded-xl outline-none"
                >
                  <option value="">All Payment Methods</option>
                  <option value="CASH">Cash</option>
                  <option value="MPESA">M-Pesa</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              <div className="text-xs text-slate-500">
                Showing <span className="font-bold text-slate-900">{filteredEntries.length}</span> {groupBySummary ? 'total groups' : 'entries'}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 text-[10px] text-slate-600 uppercase font-bold tracking-wider">
                    <th className="px-6 py-4">Date & Time</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Payment Method</th>
                    <th className="px-6 py-4">Reference No</th>
                    <th className="px-6 py-4 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs text-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-500">
                        Loading cashbook records...
                      </td>
                    </tr>
                  ) : filteredEntries.length > 0 ? (
                    filteredEntries.map((entry) => {
                      const isInflow = entry.type?.toUpperCase() === 'INFLOW';
                      const formattedDate = formatDateSafe(entry.date);

                      return (
                        <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-slate-600 font-mono">{formattedDate}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isInflow
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}>
                              {isInflow ? 'INFLOW (+)' : 'OUTFLOW (-)'}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-900">{entry.category}</td>
                          <td className="px-6 py-4 text-slate-700 max-w-xs truncate">
                            {entry.description || '-'} {entry.transaction_count ? `(${entry.transaction_count} txns)` : ''}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${getMethodBadge(entry.payment_method)}`}>
                              {entry.payment_method}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-[11px] text-slate-600">{entry.reference || '-'}</td>
                          <td className={`px-6 py-4 text-right font-bold font-mono ${isInflow ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {isInflow ? `+${formatCurrency(entry.amount)}` : `-${formatCurrency(entry.amount)}`}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-500">
                        No cashbook records found for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ---------------- BALANCE SHEET TAB ---------------- */}
        {activeTab === 'balance_sheet' && (
          <div className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6 pb-5 border-b border-slate-200">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600 mb-1">
                  Financial Statement
                </p>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Statement of Financial Position
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Balance sheet <span className="text-slate-700 font-semibold">as at {getBalanceSheetDateLabel()}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-300">
                  {['day', 'month', 'year'].map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setPeriodType(pt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                        periodType === pt
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {pt}
                    </button>
                  ))}
                </div>

                {periodType === 'day' && (
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-slate-50 border border-slate-300 text-xs text-slate-900 px-3 py-1.5 rounded-xl outline-none"
                  />
                )}

                {periodType === 'month' && (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="bg-transparent text-xs text-slate-900 outline-none"
                    >
                      {[
                        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                      ].map((m, idx) => (
                        <option key={m} value={idx + 1} className="bg-white text-slate-900">
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="bg-transparent text-xs text-slate-900 outline-none"
                    >
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <option key={y} value={y} className="bg-white text-slate-900">
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {periodType === 'year' && (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl">
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="bg-transparent text-xs text-slate-900 outline-none"
                    >
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <option key={y} value={y} className="bg-white text-slate-900">
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="button"
                  onClick={fetchBalanceSheet}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-300 shadow-sm transition-all flex items-center gap-2"
                >
                  <svg className={`w-3.5 h-3.5 ${loadingBS ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5.64 9A7 7 0 0117.9 6.1L20 9M4 15l2.1 2.9A7 7 0 0018.36 15" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>

            {loadingBS ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                Generating Statement of Financial Position...
              </div>
            ) : balanceSheet ? (
              (() => {
                const assets = balanceSheet.assets || {};
                const currentAssets = assets.current_assets || {};
                const fixedAssets = assets.fixed_assets || {};
                const liabilities = balanceSheet.liabilities || {};
                const currentLiabilities = liabilities.current_liabilities || {};
                const nonCurrentLiabilities = liabilities.non_current_liabilities || {};
                const equity = balanceSheet.equity || {};

                const totalAssets = Number(assets.total_assets || 0);
                const totalLiabilities = Number(liabilities.total_liabilities || 0);
                const totalEquity = Number(equity.total_equity || 0);
                const totalLE = Number(
                  balanceSheet.total_liabilities_and_equity ??
                  (totalLiabilities + totalEquity)
                );

                const checkData = balanceSheet.accounting_check || {};
                const difference = Math.abs(Number(checkData.difference ?? (totalAssets - totalLE)));
                const isBalanced = checkData.balanced !== undefined ? checkData.balanced : difference < 0.01;

                const cash = Number(currentAssets.cash_and_equivalents || 0);
                const bankOverdraft = Number(currentLiabilities.bank_overdraft || 0);
                const accountsPayable = Number(currentLiabilities.accounts_payable || 0);

                const hasNonCurrentLiabilities =
                  Object.keys(nonCurrentLiabilities).length > 0 &&
                  Number(nonCurrentLiabilities.total || 0) !== 0;

                const ownerEquity = Number(equity.owner_equity ?? equity.total_equity ?? 0);

                return (
                  <div className="space-y-6">
                    {/* Accounting Check */}
                    <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                      isBalanced
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-rose-50 border-rose-200'
                    }`}>
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-wider ${
                          isBalanced ? 'text-emerald-800' : 'text-rose-700'
                        }`}>
                          {isBalanced ? 'Balance Sheet Balanced' : 'Balance Sheet Difference Detected'}
                        </p>
                        <p className="text-[11px] text-slate-600 mt-1">
                          Assets = Liabilities + Equity
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Difference</p>
                        <p className={`font-mono font-bold ${isBalanced ? 'text-emerald-800' : 'text-rose-700'}`}>
                          {formatCurrency(difference)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* ASSETS */}
                      <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">
                            Assets
                          </h3>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                            What the business owns
                          </span>
                        </div>

                        <div className="p-5 space-y-6">
                          <section>
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                              Current Assets
                            </h4>
                            <div className="space-y-3 pl-3">
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-600">Cash & Cash Equivalents</span>
                                <span className="font-mono text-slate-900">
                                  {formatCurrency(cash)}
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-600">Accounts Receivable</span>
                                <span className="font-mono text-slate-900">
                                  {formatCurrency(currentAssets.accounts_receivable)}
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-600">Inventory</span>
                                <span className="font-mono text-slate-900">
                                  {formatCurrency(currentAssets.inventory_value)}
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-between pt-3 mt-3 border-t border-slate-200 font-bold text-slate-900">
                              <span>Total Current Assets</span>
                              <span className="font-mono">{formatCurrency(currentAssets.total)}</span>
                            </div>
                          </section>

                          <section>
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                              Non-Current Assets
                            </h4>
                            <div className="space-y-3 pl-3">
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-600">Property, Plant & Equipment</span>
                                <span className="font-mono text-slate-900">
                                  {formatCurrency(fixedAssets.property_equipment)}
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-between pt-3 mt-3 border-t border-slate-200 font-bold text-slate-900">
                              <span>Total Non-Current Assets</span>
                              <span className="font-mono">{formatCurrency(fixedAssets.total)}</span>
                            </div>
                          </section>

                          <div className="p-4 rounded-xl bg-emerald-100 border border-emerald-300 flex justify-between items-center">
                            <span className="font-bold text-emerald-800 uppercase tracking-wider text-xs">
                              Total Assets
                            </span>
                            <span className="text-lg font-extrabold text-emerald-800 font-mono">
                              {formatCurrency(totalAssets)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* LIABILITIES & EQUITY */}
                      <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-wider">
                            Liabilities & Equity
                          </h3>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                            How assets are financed
                          </span>
                        </div>

                        <div className="p-5 space-y-6">
                          <section>
                            <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-3">
                              Current Liabilities
                            </h4>
                            <div className="space-y-3 pl-3">
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-600">Accounts Payable</span>
                                <span className="font-mono text-slate-900">
                                  {formatCurrency(accountsPayable)}
                                </span>
                              </div>

                              {bankOverdraft > 0 && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-rose-700 font-medium">Bank Overdraft (Negative Cash)</span>
                                  <span className="font-mono font-bold text-rose-700">
                                    {formatCurrency(bankOverdraft)}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex justify-between pt-3 mt-3 border-t border-slate-200 font-bold text-slate-900">
                              <span>Total Current Liabilities</span>
                              <span className="font-mono">
                                {formatCurrency(currentLiabilities.total || (accountsPayable + bankOverdraft))}
                              </span>
                            </div>
                          </section>

                          {hasNonCurrentLiabilities && (
                            <section>
                              <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-3">
                                Non-Current Liabilities
                              </h4>
                              <div className="space-y-3 pl-3">
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-600">Long-Term Liabilities</span>
                                  <span className="font-mono text-slate-900">
                                    {formatCurrency(nonCurrentLiabilities.total || 0)}
                                  </span>
                                </div>
                              </div>
                            </section>
                          )}

                          <div className="flex justify-between pt-3 border-t border-slate-200 font-bold text-slate-900">
                            <span>Total Liabilities</span>
                            <span className="font-mono">{formatCurrency(totalLiabilities)}</span>
                          </div>

                          <section>
                            <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3">
                              Owner's Equity
                            </h4>
                            <div className="space-y-3 pl-3">
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-600">Owner's Capital / Net Equity</span>
                                <span className="font-mono text-slate-900">
                                  {formatCurrency(ownerEquity)}
                                </span>
                              </div>
                            </div>

                            <div className="flex justify-between pt-3 mt-3 border-t border-slate-200 font-bold text-slate-900">
                              <span>Total Owner's Equity</span>
                              <span className="font-mono">{formatCurrency(totalEquity)}</span>
                            </div>
                          </section>

                          <div className="p-4 rounded-xl bg-indigo-100 border border-indigo-300 flex justify-between items-center">
                            <span className="font-bold text-indigo-800 uppercase tracking-wider text-xs">
                              Total Liabilities & Equity
                            </span>
                            <span className="text-lg font-extrabold text-indigo-800 font-mono">
                              {formatCurrency(totalLE)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="py-16 text-center text-slate-500 text-xs">
                Unable to load balance sheet data.
              </div>
            )}
          </div>
        )}

      </div>

      {/* Manual Cash Voucher Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-300 rounded-2xl max-w-md w-full p-6 shadow-xl relative text-slate-900">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-4">Record Cash Entry</h3>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddEntry} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'INFLOW' })}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      formData.type === 'INFLOW'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                  >
                    Inflow (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'OUTFLOW' })}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      formData.type === 'OUTFLOW'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                  >
                    Outflow (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Cash Sale, Supplier Payment, Utilities"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Amount (KSh)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Payment Method</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="CASH">Cash</option>
                  <option value="MPESA">M-Pesa</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Reference No</label>
                <input
                  type="text"
                  placeholder="e.g. CS-19823 or TRM-35423"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Details of transaction..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 bg-white border border-slate-300 text-slate-700 py-2.5 rounded-xl font-semibold hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}