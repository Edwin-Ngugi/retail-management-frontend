// src/components/PurchaseView.jsx
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

const PAYABLE_COLORS = ['#0D9488', '#2563EB', '#D97706', '#059669', '#7C3AED', '#DB2777', '#475569'];

const fmtCurr = (val) =>
  `KSh ${Number(val || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function PurchaseView({ branchId, startDate: propStartDate, endDate: propEndDate }) {
  const [loading, setLoading] = useState(true);
  const [exportingSummary, setExportingSummary] = useState(false);
  const [exportingDetailed, setExportingDetailed] = useState(false);
  const [error, setError] = useState(null);
  const [expandedOrderIds, setExpandedOrderIds] = useState([]);

  // URL Query Parameters Parsing
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const [periodType, setPeriodType] = useState(() => searchParams.get('period_type') || 'day');
  const [selectedDate, setSelectedDate] = useState(() => searchParams.get('selectedDate') || propStartDate || '');
  const [year, setYear] = useState(() => searchParams.get('year') || new Date().getFullYear().toString());
  const [month, setMonth] = useState(() => searchParams.get('month') || (new Date().getMonth() + 1).toString());

  const [startDate, setStartDate] = useState(propStartDate || '');
  const [endDate, setEndDate] = useState(propEndDate || '');

  const [overviewData, setOverviewData] = useState(null);
  const [ordersData, setOrdersData] = useState([]);
  const [grnData, setGrnData] = useState([]);
  const [invoicesData, setInvoicesData] = useState([]);
  const [paymentsData, setPaymentsData] = useState([]);
  const [suppliersData, setSuppliersData] = useState([]);

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
      const [resOverview, resOrders, resGrn, resInvoices, resPayments, resSuppliers] = await Promise.allSettled([
        API.get('purchases-analytics/purchases-overview/', { params }),
        API.get('purchases-analytics/purchase-orders/', { params }),
        API.get('purchases-analytics/goods-received/', { params }),
        API.get('purchases-analytics/supplier-invoices/', { params }),
        API.get('purchases-analytics/supplier-payments/', { params }),
        API.get('purchases-analytics/suppliers-list/', { params }),
      ]);

      if (resOverview.status === 'fulfilled') setOverviewData(resOverview.value.data);
      if (resOrders.status === 'fulfilled') {
        const d = resOrders.value.data;
        setOrdersData(Array.isArray(d) ? d : d?.results || []);
      }
      if (resGrn.status === 'fulfilled') {
        const d = resGrn.value.data;
        setGrnData(Array.isArray(d) ? d : d?.results || []);
      }
      if (resInvoices.status === 'fulfilled') {
        const d = resInvoices.value.data;
        setInvoicesData(Array.isArray(d) ? d : d?.results || []);
      }
      if (resPayments.status === 'fulfilled') {
        const d = resPayments.value.data;
        setPaymentsData(Array.isArray(d) ? d : d?.results || []);
      }
      if (resSuppliers.status === 'fulfilled') {
        const d = resSuppliers.value.data;
        setSuppliersData(Array.isArray(d) ? d : d?.results || []);
      }
    } catch (err) {
      console.error('Failed to fetch purchase report data:', err);
      setError('Unable to load live procurement endpoints. Please check server connectivity.');
    } finally {
      setLoading(false);
    }
  }, [activeBranch, periodType, selectedDate, year, month, startDate, endDate]);

  useEffect(() => {
    fetchAllAnalytics();
  }, [fetchAllAnalytics]);

  const toggleOrderExpand = (id) => {
    setExpandedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  /* ================= EXPORT PDF DOWNLOAD HANDLER ================= */
  const handleExportPdf = async (exportMode = 'summary') => {
    const isDetailed = exportMode === 'detailed';
    if (isDetailed) setExportingDetailed(true);
    else setExportingSummary(true);

    try {
      const params = {
        period_type: periodType,
        selectedDate: selectedDate,
        year: year,
        month: month,
        export_type: exportMode,
        type: exportMode,
      };

      if (activeBranch) {
        params.branch_id = activeBranch;
        params.branch = activeBranch;
      }
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await API.get('purchases-analytics/export-purchases-pdf/', {
        params,
        responseType: 'blob',
      });

      if (response.data.type === 'application/json') {
        const textData = await response.data.text();
        const errJson = JSON.parse(textData);
        alert(`PDF Generation Failed: ${errJson.error || 'Server error'}`);
        return;
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `${isDetailed ? 'Detailed' : 'Summary'}_Procurement_Report_${periodType}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to download PDF report:', err);
      alert(`Unable to generate PDF report. Server error: ${err.message}`);
    } finally {
      if (isDetailed) setExportingDetailed(false);
      else setExportingSummary(false);
    }
  };

  const summary = overviewData?.summary || {};

  const topSuppliersChart = useMemo(() => {
    return suppliersData
      .slice(0, 5)
      .map((s) => ({
        name: (s.supplier_name || 'Vendor').length > 15 ? `${(s.supplier_name || 'Vendor').substring(0, 15)}...` : (s.supplier_name || 'Vendor'),
        spend: Number(s.total_spend || 0),
        balance: Number(s.outstanding_balance || 0),
      }));
  }, [suppliersData]);

  const paymentTermsMix = useMemo(() => {
    const creditTotal = invoicesData.reduce((sum, inv) => sum + Number(inv.total_cost || 0), 0);
    const paidTotal = Number(summary.total_paid_suppliers || 0);
    return [
      { name: 'Disbursed Payments', value: paidTotal },
      { name: 'Outstanding Payables', value: Number(summary.outstanding_payables || creditTotal) },
    ];
  }, [invoicesData, summary]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 space-y-6 font-sans">
      
      {/* HEADER CONTROLS */}
      <header className="no-print bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-600 animate-pulse" />
            <span className="text-[11px] font-bold tracking-widest text-teal-800 uppercase">
              Procurement Intelligence
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-1">
            Purchase Orders & Vendor Payables Audit
          </h1>
        </div>

        {/* Filters and Dual PDF Download Buttons */}
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
            Compiling procurement & payables ledger...
          </span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-xs font-bold text-center">
          {error}
        </div>
      ) : (
        <div id="executive-purchase-report-area" className="space-y-6">
          
          {/* EXECUTIVE KPI SUMMARY METRICS */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Total Procurement Spend
              </span>
              <span className="text-2xl font-black font-mono text-slate-900 block">
                {fmtCurr(summary.total_procurement_spend)}
              </span>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 p-5 rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">
                Disbursed to Suppliers
              </span>
              <span className="text-2xl font-black font-mono text-emerald-900 block">
                {fmtCurr(summary.total_paid_suppliers)}
              </span>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 p-5 rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">
                Outstanding Payables
              </span>
              <span className="text-2xl font-black font-mono text-amber-900 block">
                {fmtCurr(summary.outstanding_payables)}
              </span>
            </div>

            <div className="bg-teal-50/70 border border-teal-200 p-5 rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-extrabold text-teal-800 uppercase tracking-wider block">
                Purchase Orders Issued
              </span>
              <span className="text-2xl font-black font-mono text-teal-900 block">
                {ordersData.length || summary.purchase_orders_count || 0} Orders
              </span>
            </div>
          </section>

          {/* CHARTS SECTION */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. TOP VENDOR SPEND ALLOCATION */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Top Vendor Spend Allocation
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Breakdown of total procurement spend distributed across major suppliers
                  </p>
                </div>
                <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                  Vendor Spend
                </span>
              </div>

              <div className="h-64 w-full">
                {topSuppliersChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topSuppliersChart} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v) => `KSh ${v}`} />
                      <Tooltip formatter={(val) => [fmtCurr(val), 'Total Spend']} />
                      <Bar dataKey="spend" fill="#0D9488" radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                    No vendor spend breakdown available.
                  </div>
                )}
              </div>
            </div>

            {/* 2. SETTLEMENT & PAYABLES RATIO */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Settlement & Payables Share
                </h3>
                <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                  Distribution
                </span>
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                {paymentTermsMix.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentTermsMix}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        innerRadius={40}
                        paddingAngle={4}
                      >
                        {paymentTermsMix.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PAYABLE_COLORS[index % PAYABLE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => [fmtCurr(val), 'Amount']} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-xs text-slate-400 font-mono">No payables ratio available</div>
                )}
              </div>
            </div>

          </section>

          {/* EXPANDABLE PURCHASE ORDERS LEDGER */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                   Purchase Orders & Restock Audit Log
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click 'View Details' on any purchase order to inspect line item restock details.
                </p>
              </div>
              <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                {ordersData.length} Orders Recorded
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 uppercase text-[9px] tracking-wider font-extrabold">
                    <th className="py-3 px-4">PO Ref</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Payment Terms</th>
                    <th className="py-3 px-4 text-right">Total Cost</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {ordersData.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-400 font-mono">
                        No purchase orders found for this selected period filter.
                      </td>
                    </tr>
                  ) : (
                    ordersData.map((po, idx) => {
                      const poId = po.id || idx;
                      const isExpanded = expandedOrderIds.includes(poId);
                      return (
                        <React.Fragment key={poId}>
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-teal-800">
                              {po.po_number || `PO-${poId}`}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-800">
                              {po.supplier_name || 'Vendor'}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                                po.payment_method === 'CREDIT' 
                                  ? 'bg-amber-50 text-amber-800 border-amber-200' 
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}>
                                {po.payment_method || 'CASH'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                              {fmtCurr(po.total_cost)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => toggleOrderExpand(poId)}
                                className="bg-slate-100 hover:bg-teal-800 hover:text-white text-slate-700 font-bold px-3 py-1 rounded-lg text-[10px] transition cursor-pointer"
                              >
                                {isExpanded ? '▲ Hide Details' : '▼ View Details'}
                              </button>
                            </td>
                          </tr>

                          {/* EXPANDABLE ITEM RESTOCK DETAILS */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90">
                              <td colSpan="5" className="p-4">
                                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Item Restock Details for PO: {po.po_number || `PO-${poId}`}
                                  </span>
                                  <table className="w-full text-left text-[11px] border-collapse">
                                    <thead>
                                      <tr className="border-b border-slate-200 text-slate-400 uppercase text-[9px]">
                                        <th className="py-1.5">Product Name</th>
                                        <th className="py-1.5 text-center">Quantity Restocked</th>
                                        <th className="py-1.5 text-right">Unit Cost Price</th>
                                        <th className="py-1.5 text-right">Subtotal Cost</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-mono">
                                      {po.items && po.items.length > 0 ? (
                                        po.items.map((item, iIdx) => (
                                          <tr key={iIdx} className="hover:bg-slate-50">
                                            <td className="py-2 font-sans font-semibold text-slate-800">
                                              {item.item_name}
                                            </td>
                                            <td className="py-2 text-center text-slate-600">
                                              {item.quantity}
                                            </td>
                                            <td className="py-2 text-right text-slate-700">
                                              {fmtCurr(item.unit_cost)}
                                            </td>
                                            <td className="py-2 text-right font-bold text-teal-800">
                                              {fmtCurr(item.total_cost)}
                                            </td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr className="hover:bg-slate-50">
                                          <td className="py-2 font-sans font-semibold text-slate-800">
                                            {po.item_name || 'Restocked Inventory Item'}
                                          </td>
                                          <td className="py-2 text-center text-slate-600">
                                            {po.quantity || 1}
                                          </td>
                                          <td className="py-2 text-right text-slate-700">
                                            {fmtCurr(Number(po.total_cost || 0) / Math.max(1, Number(po.quantity || 1)))}
                                          </td>
                                          <td className="py-2 text-right font-bold text-teal-800">
                                            {fmtCurr(po.total_cost)}
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

          {/* VENDOR DIRECTORY & OUTSTANDING PAYABLES LEDGER */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                🏢 Vendor Directory & Accounts Payable Ledger
              </h3>
              <span className="text-[10px] font-semibold text-slate-400">Supplier Ledger</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 uppercase text-[9px] tracking-wider font-extrabold">
                    <th className="py-3 px-4">Supplier Name</th>
                    <th className="py-3 px-4 text-center">Orders Count</th>
                    <th className="py-3 px-4 text-right">Lifetime Restock Spend</th>
                    <th className="py-3 px-4 text-right">Outstanding Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {suppliersData.length > 0 ? (
                    suppliersData.map((sup, idx) => (
                      <tr key={sup.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{sup.supplier_name}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">{sup.total_purchases_count || 1}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">{fmtCurr(sup.total_spend)}</td>
                        <td className={`py-3 px-4 text-right font-mono font-black ${Number(sup.outstanding_balance) > 0 ? 'text-rose-700' : 'text-teal-800'}`}>
                          {fmtCurr(sup.outstanding_balance)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-6 text-center text-slate-400 font-mono">No supplier directory entries found.</td>
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