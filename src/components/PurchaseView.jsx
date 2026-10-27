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

const PAYABLE_COLORS = ['#0D9488', '#4F46E5', '#F59E0B', '#E11D48', '#8B5CF6'];

const fmtCurr = (val) =>
  `KSh ${Number(val || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function PurchaseView({ branchId, startDate, endDate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [overviewData, setOverviewData] = useState(null);
  const [ordersData, setOrdersData] = useState([]);
  const [grnData, setGrnData] = useState([]);
  const [invoicesData, setInvoicesData] = useState([]);
  const [paymentsData, setPaymentsData] = useState([]);
  const [suppliersData, setSuppliersData] = useState([]);

  const queryParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const activeBranch = branchId || queryParams.get('branch') || queryParams.get('branch_id');
  const activeStart = startDate || queryParams.get('startDate') || queryParams.get('start_date') || '';
  const activeEnd = endDate || queryParams.get('endDate') || queryParams.get('end_date') || '';

  const fetchAllAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = {
      branch_id: activeBranch,
      start_date: activeStart,
      end_date: activeEnd,
    };

    try {
      const [resOverview, resOrders, resGrn, resInvoices, resPayments, resSuppliers] = await Promise.allSettled([
        API.get('management-analytics/purchases-overview/', { params }),
        API.get('management-analytics/purchase-orders/', { params }),
        API.get('management-analytics/goods-received/', { params }),
        API.get('management-analytics/supplier-invoices/', { params }),
        API.get('management-analytics/supplier-payments/', { params }),
        API.get('management-analytics/suppliers-list/', { params }),
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
  }, [activeBranch, activeStart, activeEnd]);

  useEffect(() => {
    fetchAllAnalytics();
  }, [fetchAllAnalytics]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!ordersData || ordersData.length === 0) return;

    const headers = ['PO Ref', 'Purchase Date', 'Supplier', 'Item Name', 'Quantity', 'Total Cost', 'Payment Method'];
    const rows = ordersData.map((po) => [
      `"${po.po_number || ''}"`,
      `"${po.purchase_date || ''}"`,
      `"${String(po.supplier_name || '').replace(/"/g, '""')}"`,
      `"${String(po.item_name || '').replace(/"/g, '""')}"`,
      po.quantity || 0,
      Number(po.total_cost || 0).toFixed(2),
      `"${po.payment_method || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Executive_Purchase_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = overviewData?.summary || {};

  const topSuppliersChart = useMemo(() => {
    return suppliersData
      .slice(0, 5)
      .map((s) => ({
        name: s.supplier_name || 'Vendor',
        spend: Number(s.total_spend || 0),
        balance: Number(s.outstanding_balance || 0),
      }));
  }, [suppliersData]);

  const paymentTermsMix = useMemo(() => {
    const creditTotal = invoicesData.reduce((sum, inv) => sum + Number(inv.total_cost || 0), 0);
    const paidTotal = Number(summary.total_paid_suppliers || 0);
    return [
      { name: 'Paid Supplier Disburse', value: paidTotal },
      { name: 'Outstanding Payables', value: Number(summary.outstanding_payables || creditTotal) },
    ];
  }, [invoicesData, summary]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans text-slate-800 pb-12">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #executive-purchase-report-area, #executive-purchase-report-area * { visibility: visible; }
          #executive-purchase-report-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
          .no-print { display: none !important; }
          .chart-card-print { break-inside: avoid !important; page-break-inside: avoid !important; }
          .chart-container-print { height: 220px !important; }
        }
      `}</style>

      {/* ACTION CONTROLS HEADER */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Executive Procurement & Purchase Analytics Report</h1>
          <p className="text-xs text-slate-500 mt-0.5">Comprehensive audit of vendor restock orders, payables, GRN logs, and supplier spend.</p>
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
            disabled={ordersData.length === 0}
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
          <span className="text-xs font-bold text-slate-500 font-mono">Compiling procurement & purchase analytics...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-3xl text-xs font-bold text-center">
          {error}
        </div>
      ) : (
        <div id="executive-purchase-report-area" className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xs space-y-8">
          
          {/* REPORT HEADER */}
          <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-teal-600"></span>
                <span className="text-[10px] font-black text-teal-800 uppercase tracking-widest">OFFICIAL PROCUREMENT REPORT</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">PURCHASE & VENDOR ACCOUNTS PAYABLE AUDIT</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Branch ID: <span className="font-bold text-slate-800">{activeBranch || 'All Branches'}</span> | Generated on: {new Date().toLocaleDateString()}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl text-right text-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Report Period</span>
              <span className="font-mono font-bold text-slate-800">
                {activeStart || 'Beginning'} — {activeEnd || 'Present'}
              </span>
            </div>
          </div>

          {/* 1. EXECUTIVE SUMMARY KPI CARDS */}
          <div className="space-y-3 chart-card-print">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              1. Executive Procurement Indicators
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-teal-50/70 p-4 rounded-2xl border border-teal-200/80">
                <span className="text-[10px] font-extrabold text-teal-800 uppercase tracking-wider block">Total Procurement Spend</span>
                <span className="text-xl font-black font-mono text-teal-900 mt-1 block">
                  {fmtCurr(summary.total_procurement_spend)}
                </span>
              </div>

              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80">
                <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">Total Disbursed to Suppliers</span>
                <span className="text-xl font-black font-mono text-emerald-900 mt-1 block">
                  {fmtCurr(summary.total_paid_suppliers)}
                </span>
              </div>

              <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80">
                <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">Outstanding Payables</span>
                <span className="text-xl font-black font-mono text-amber-900 mt-1 block">
                  {fmtCurr(summary.outstanding_payables)}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Purchase Orders Issued</span>
                <span className="text-xl font-black font-mono text-slate-900 mt-1 block">
                  {ordersData.length || summary.purchase_orders_count || 0} Orders
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Units Restocked</span>
                <span className="text-sm font-extrabold text-slate-800 font-mono">{summary.total_units_purchased || 0} Units</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Goods Received Notes (GRN)</span>
                <span className="text-sm font-extrabold text-slate-800 font-mono">{grnData.length} Receipts</span>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Supplier Returns Value</span>
                <span className="text-sm font-extrabold text-rose-700 font-mono">{summary.supplier_returns_count || 0} Returns Logged</span>
              </div>
            </div>
          </div>

          {/* 2. CHARTS SECTION: SUPPLIER SPEND & PAYABLES MIX */}
          <div className="space-y-3 pt-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              2. Top Vendor Spend & Procurement Settlement Mix
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 space-y-3 chart-card-print">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase">Top Vendor Spend Allocation</h4>
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                    Vendor Analysis
                  </span>
                </div>
                <div className="h-64 w-full chart-container-print">
                  {topSuppliersChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topSuppliersChart} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#334155' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v) => `KSh ${v}`} />
                        <Tooltip formatter={(val) => [fmtCurr(val), 'Total Spend']} />
                        <Bar dataKey="spend" fill="#0D9488" radius={[8, 8, 0, 0]} barSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                      No vendor spend breakdown available.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 chart-card-print">
                <h4 className="text-xs font-bold text-slate-800 uppercase border-b border-slate-100 pb-2">
                  Settlement & Payables Ratio
                </h4>
                <div className="h-64 w-full chart-container-print">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentTermsMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={4}>
                        {paymentTermsMix.map((_, idx) => (
                          <Cell key={`pay-${idx}`} fill={PAYABLE_COLORS[idx % PAYABLE_COLORS.length]} />
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

          {/* 3. ACCOUNTS PAYABLE & SUPPLIER BALANCE LEDGER */}
          <div className="space-y-3 pt-4 chart-card-print">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              3. Vendor Directory & Outstanding Payables Ledger
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200 uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="p-3">Supplier Name</th>
                    <th className="p-3 text-center">Orders Count</th>
                    <th className="p-3 text-right">Total Lifetime Spend</th>
                    <th className="p-3 text-right">Outstanding Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {suppliersData.length > 0 ? (
                    suppliersData.map((sup, idx) => (
                      <tr key={sup.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-bold text-slate-900">{sup.supplier_name}</td>
                        <td className="p-3 text-center font-mono font-bold text-slate-700">{sup.total_purchases_count || 1}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-800">{fmtCurr(sup.total_spend)}</td>
                        <td className={`p-3 text-right font-mono font-black ${Number(sup.outstanding_balance) > 0 ? 'text-rose-700' : 'text-teal-800'}`}>
                          {fmtCurr(sup.outstanding_balance)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="p-6 text-center text-slate-400 font-mono">No supplier accounts found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. PURCHASE ORDERS & RESTOCK AUDIT LOG */}
          <div className="space-y-3 pt-4 chart-card-print">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              4. Purchase Orders & Restock Audit Log ({ordersData.length} Records)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200 uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="p-3">PO Ref</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Supplier</th>
                    <th className="p-3">Item Purchased</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Total Cost</th>
                    <th className="p-3 text-center">Terms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {ordersData.length > 0 ? (
                    ordersData.slice(0, 50).map((po, idx) => (
                      <tr key={po.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-teal-700">{po.po_number}</td>
                        <td className="p-3 text-slate-500 font-mono">{po.purchase_date}</td>
                        <td className="p-3 font-bold text-slate-900">{po.supplier_name}</td>
                        <td className="p-3 font-semibold text-slate-800">{po.item_name}</td>
                        <td className="p-3 text-center font-mono font-bold">{po.quantity}</td>
                        <td className="p-3 text-right font-mono font-black text-teal-900">{fmtCurr(po.total_cost)}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            po.payment_method === 'CREDIT' 
                              ? 'bg-amber-50 text-amber-700 border-amber-200' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {po.payment_method}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-400 font-mono">
                        No purchase orders recorded for this branch or period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {ordersData.length > 50 && (
              <p className="text-[10px] text-slate-400 font-mono text-center">
                Displaying first 50 purchase orders on preview. Export CSV to download complete audit log.
              </p>
            )}
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