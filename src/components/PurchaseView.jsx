import React, { useState, useEffect } from 'react';
import API from '../api';

const PURCHASE_MODULES = [
  {
    id: 'overview',
    title: 'Purchase Overview',
    subtitle: 'KPIs, total spend, vendor orders, and purchasing summaries.',
    endpoint: 'management-analytics/purchases-overview/',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    )
  },
  {
    id: 'requisitions',
    title: 'Purchase Requisitions',
    subtitle: 'Internal purchase requests, approval workflows, and status tracking.',
    endpoint: 'management-analytics/purchase-requisitions/',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    )
  },
  {
    id: 'orders',
    title: 'Purchase Orders',
    subtitle: 'Official vendor purchase orders, quantities, costs, and issuance logs.',
    endpoint: 'management-analytics/purchase-orders/',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  {
    id: 'goods_received',
    title: 'Goods Received',
    subtitle: 'Track delivery notes, warehouse stock entries, and GRN receipts.',
    endpoint: 'management-analytics/goods-received/',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )
  },
  {
    id: 'invoices',
    title: 'Supplier Invoices',
    subtitle: 'Audit billed supplier invoices, tax calculations, and payables due.',
    endpoint: 'management-analytics/supplier-invoices/',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2zM9 9h6m-6 4h6" />
      </svg>
    )
  },
  {
    id: 'returns',
    title: 'Purchase Returns',
    subtitle: 'Vendor debit notes, damaged stock returns, and credit adjustments.',
    endpoint: 'management-analytics/purchase-returns/',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
    )
  },
  {
    id: 'payments',
    title: 'Supplier Payments',
    subtitle: 'Bank payouts, cash disbursements, and vendor account settlements.',
    endpoint: 'management-analytics/supplier-payments/',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    id: 'suppliers',
    title: 'Supplier Management',
    subtitle: 'Vendor contact directory, credit limits, terms, and balance ledgers.',
    endpoint: 'management-analytics/suppliers-list/',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    id: 'reports',
    title: 'Purchase Reports',
    subtitle: 'Comprehensive procurement audit logs and spending trend analytics.',
    endpoint: 'management-analytics/purchase-reports/',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: (
      <svg className="w-6 h-6 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }
];

export default function PurchaseView({ branchId }) {
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
          start_date: activeStart,
          end_date: activeEnd,
          month: activeMonth,
          year: activeYear
        }
      });
      setData(response.data);
    } catch (err) {
      console.error(`Failed to load ${moduleItem.title}:`, err);
      setError("Unable to connect to live purchase records.");
    } finally {
      setLoading(false);
    }
  };

  const fmtCurr = (val) => `KSh ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const renderModuleContent = () => {
    if (!data) return null;

    switch (selectedModule.id) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
                <span className="text-[10px] font-bold text-teal-600 uppercase">Procurement Spend</span>
                <div className="text-xl font-black text-teal-900 mt-1">{fmtCurr(data.summary?.total_procurement_spend)}</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Paid to Suppliers</span>
                <div className="text-xl font-black text-emerald-900 mt-1">{fmtCurr(data.summary?.total_paid_suppliers)}</div>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] font-bold text-amber-700 uppercase">Outstanding Payables</span>
                <div className="text-xl font-black text-amber-900 mt-1">{fmtCurr(data.summary?.outstanding_payables)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Purchase Orders</span>
                <div className="text-lg font-bold text-slate-900 mt-1">{data.summary?.purchase_orders_count || 0} Orders</div>
              </div>
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-[10px] font-bold text-blue-600 uppercase">Units Purchased</span>
                <div className="text-lg font-bold text-blue-900 mt-1">{data.summary?.total_units_purchased || 0} Units</div>
              </div>
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-[10px] font-bold text-rose-600 uppercase">Supplier Returns</span>
                <div className="text-lg font-bold text-rose-900 mt-1">{data.summary?.supplier_returns_count || 0} Records</div>
              </div>
            </div>
          </div>
        );

      case 'requisitions':
        return (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase">Reorder Alerts & Requisitions ({data.count || 0})</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Req Ref</th>
                    <th className="p-3">Item Name</th>
                    <th className="p-3">Current Stock</th>
                    <th className="p-3">Reorder Level</th>
                    <th className="p-3">Est. Unit Cost</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.results?.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-teal-700">{req.req_number}</td>
                      <td className="p-3 font-bold text-slate-900">{req.item_name}</td>
                      <td className="p-3 font-semibold text-rose-600">{req.current_stock}</td>
                      <td className="p-3 text-slate-500">{req.reorder_level}</td>
                      <td className="p-3 font-bold text-slate-800">{fmtCurr(req.unit_cost_price)}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'orders':
        return (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase">Restock Purchase Orders ({data.count || 0})</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">PO Ref</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Supplier</th>
                    <th className="p-3">Item</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">Total Cost</th>
                    <th className="p-3">Payment Terms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.results?.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-teal-700">{po.po_number}</td>
                      <td className="p-3 text-slate-500">{po.purchase_date}</td>
                      <td className="p-3 font-medium text-slate-900">{po.supplier_name}</td>
                      <td className="p-3 font-bold text-slate-800">{po.item_name}</td>
                      <td className="p-3 font-semibold text-slate-700">{po.quantity}</td>
                      <td className="p-3 font-black text-teal-800">{fmtCurr(po.total_cost)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          po.payment_method === 'CREDIT' 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {po.payment_method}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'goods_received':
        return (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase">Goods Received Notes / Stock Movements ({data.count || 0})</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">GRN Ref</th>
                    <th className="p-3">Date Received</th>
                    <th className="p-3">Item</th>
                    <th className="p-3">Qty Received</th>
                    <th className="p-3">Unit Cost</th>
                    <th className="p-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.results?.map((grn) => (
                    <tr key={grn.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-teal-700">{grn.grn_number}</td>
                      <td className="p-3 text-slate-500">{grn.received_date}</td>
                      <td className="p-3 font-bold text-slate-900">{grn.item_name}</td>
                      <td className="p-3 font-semibold text-emerald-700">+{grn.quantity_received}</td>
                      <td className="p-3 font-bold text-slate-700">{fmtCurr(grn.unit_cost_price)}</td>
                      <td className="p-3 text-slate-500">{grn.notes || 'Restock Stock Movement'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'invoices':
        return (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase">Supplier Credit Invoices ({data.count || 0})</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Invoice Ref</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Supplier</th>
                    <th className="p-3">Item</th>
                    <th className="p-3">Total Billed</th>
                    <th className="p-3">Paid Amount</th>
                    <th className="p-3">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.results?.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-amber-700">{inv.invoice_number}</td>
                      <td className="p-3 text-slate-500">{inv.purchase_date}</td>
                      <td className="p-3 font-bold text-slate-900">{inv.supplier_name}</td>
                      <td className="p-3 text-slate-700">{inv.item_name}</td>
                      <td className="p-3 font-bold text-slate-900">{fmtCurr(inv.total_cost)}</td>
                      <td className="p-3 font-semibold text-emerald-600">{fmtCurr(inv.amount_paid)}</td>
                      <td className="p-3 font-black text-rose-600">{fmtCurr(inv.balance_due)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'returns':
        return (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase">Supplier Returns Ledger ({data.count || 0})</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Return Ref</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Supplier</th>
                    <th className="p-3">Item Name</th>
                    <th className="p-3">Qty Returned</th>
                    <th className="p-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.results?.map((ret) => (
                    <tr key={ret.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-rose-700">{ret.return_number}</td>
                      <td className="p-3 text-slate-500">{ret.date}</td>
                      <td className="p-3 font-bold text-slate-900">{ret.supplier_name}</td>
                      <td className="p-3 text-slate-800">{ret.item_name}</td>
                      <td className="p-3 font-bold text-rose-600">-{ret.quantity}</td>
                      <td className="p-3 text-slate-500">{ret.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'payments':
        return (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase">Supplier Repayment Disbursements ({data.count || 0})</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Payment Ref</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Supplier</th>
                    <th className="p-3">Item</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Disbursed Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.results?.map((pmt) => (
                    <tr key={pmt.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-emerald-700">{pmt.payment_ref}</td>
                      <td className="p-3 text-slate-500">{pmt.payment_date}</td>
                      <td className="p-3 font-bold text-slate-900">{pmt.supplier_name}</td>
                      <td className="p-3 text-slate-700">{pmt.item_name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {pmt.payment_method}
                        </span>
                      </td>
                      <td className="p-3 font-black text-emerald-700">{fmtCurr(pmt.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'suppliers':
        return (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase">Registered Suppliers Directory ({data.count || 0})</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.results?.map((sup) => (
                <div key={sup.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-xs">
                  <div className="flex justify-between items-start">
                    <span className="font-extrabold text-slate-900 text-sm">{sup.supplier_name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                      {sup.total_purchases_count} Orders
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Total Spend:</span>
                    <span className="font-bold text-slate-900">{fmtCurr(sup.total_spend)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Outstanding Balance:</span>
                    <span className="font-black text-amber-600">{fmtCurr(sup.outstanding_balance)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'reports':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Total Purchases Count</span>
                <div className="text-xl font-black text-slate-900 mt-1">{data.audit_summary?.total_purchases_count || 0} Records</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Settled Cash Purchases</span>
                <div className="text-xl font-black text-emerald-900 mt-1">{fmtCurr(data.audit_summary?.settled_cash_purchases)}</div>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] font-bold text-amber-700 uppercase">Credit Purchases Value</span>
                <div className="text-xl font-black text-amber-900 mt-1">{fmtCurr(data.audit_summary?.credit_purchases_value)}</div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // DEDICATED WORKSPACE SCREEN
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
                ← Back to Purchase Portal
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
              <span className="text-xs font-semibold text-slate-500">Fetching records for {selectedModule.title}...</span>
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
                <div className="text-xs text-slate-400 italic">No active purchase records found for the selected branch or period.</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // PORTAL MENU SELECTION GRID
  return (
    <div className="w-full flex-1 flex flex-col space-y-6">
      <div className="bg-teal-700 text-white rounded-xl p-3.5 flex items-center gap-3 shadow-md">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        <h2 className="text-sm font-black tracking-widest uppercase">PURCHASE MENU BAR</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PURCHASE_MODULES.map((item) => (
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