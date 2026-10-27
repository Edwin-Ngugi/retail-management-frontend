// src/components/GoodsReceivedManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import API from '../api';

const toNumber = (val) => (Number.isFinite(Number(val)) ? Number(val) : 0);
const formatCurrency = (val) =>
  `KSh ${toNumber(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function GoodsReceivedManagement({ selectedBranch }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPurchaseOrders = useCallback(async () => {
    if (!selectedBranch) return;
    setLoading(true);
    try {
      const res = await API.get(`purchases/?branch=${encodeURIComponent(selectedBranch)}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch purchase orders:', err);
    } font-mono
      setLoading(false);
  }, [selectedBranch]);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [fetchPurchaseOrders]);

  const filteredOrders = orders.filter((order) => {
    const term = searchTerm.toLowerCase();
    const itemName = order.item_name || order.item?.name || '';
    const supplier = order.supplier_name || '';
    const method = order.payment_method || '';
    return (
      itemName.toLowerCase().includes(term) ||
      supplier.toLowerCase().includes(term) ||
      method.toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Goods Received Notes (Purchase Orders Log)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Complete history of verified restocks and goods received into branch inventory.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search item, supplier, method..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500 w-60"
            />
            <button
              onClick={fetchPurchaseOrders}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Purchase Orders Log Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">
                <th className="p-3">Ref / Date</th>
                <th className="p-3">Item / Catalog Name</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Payment Channel</th>
                <th className="p-3 text-right">Quantity Received</th>
                <th className="p-3 text-right">Unit Cost</th>
                <th className="p-3 text-right">Total Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400 font-mono">
                    Loading received purchase orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400">
                    No received purchase orders found for this branch.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const qty = toNumber(order.quantity);
                  const unitCost = toNumber(order.unit_cost_price);
                  const totalCost = qty * unitCost;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <span className="font-mono font-bold text-teal-800 block">
                          PO-#{order.id}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {order.purchase_date
                            ? new Date(order.purchase_date).toLocaleDateString()
                            : 'N/A'}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-800">
                        {order.item_name || order.item?.name || 'Stock Item'}
                      </td>
                      <td className="p-3 text-slate-600 font-medium">
                        {order.supplier_name || 'Direct Procurement'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            order.payment_method === 'CREDIT'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-teal-100 text-teal-800'
                          }`}
                        >
                          {order.payment_method || 'CASH'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {qty.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600">
                        {formatCurrency(unitCost)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-teal-900">
                        {formatCurrency(totalCost)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}