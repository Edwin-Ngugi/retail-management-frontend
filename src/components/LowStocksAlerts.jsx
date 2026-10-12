import React, { useState } from 'react';
import API from '../api';
import { useBranch } from '../components/BranchContext';

export default function LowStocksAlerts({ items = [], onRestockSuccess }) {
  const { selectedBranch } = useBranch();
  const [searchTerm, setSearchTerm] = useState('');
  const [restockQuantities, setRestockQuantities] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Extract error details safely
  const extractErrorMessage = (err, fallback) => {
    if (!err.response?.data) return fallback;
    const data = err.response.data;
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;
    if (data.error) return data.error;
    if (data.non_field_errors) return data.non_field_errors.join(' ');
    return Object.entries(data)
      .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
      .join(' | ');
  };

  // Determine low stock items with fallback calculations
  const lowStockItems = (items || []).filter((item) => {
    const currentStock = item.remaining_stock ?? item.opening_stock ?? 0;
    const minThreshold = item.min_stock_threshold ?? 5;
    return item.is_low_stock || currentStock <= minThreshold;
  });

  const filteredItems = lowStockItems.filter((item) =>
    item.name ? item.name.toLowerCase().includes(searchTerm.toLowerCase()) : false
  );

  const handleQtyChange = (id, value) => {
    setRestockQuantities((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleBulkRestock = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const activeBranchId = selectedBranch?.id || selectedBranch;

    // Backend bulk_restock expects a top-level JSON array of objects with keys: id, add_quantity
    const payload = Object.entries(restockQuantities)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([id, qty]) => ({
        id: Number(id),
        add_quantity: Number(qty),
        ...(activeBranchId ? { branch: activeBranchId, branch_id: activeBranchId } : {}),
      }));

    if (payload.length === 0) {
      setMessage({
        type: 'error',
        text: 'Please enter a valid restock quantity greater than 0 for at least one item.',
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const url = activeBranchId
        ? `items/bulk_restock/?branch=${activeBranchId}`
        : 'items/bulk_restock/';

      const res = await API.post(url, payload);

      setMessage({
        type: 'success',
        text: res.data?.message || `Successfully restocked ${payload.length} item(s)!`,
      });
      setRestockQuantities({});
      if (onRestockSuccess) onRestockSuccess();
    } catch (err) {
      console.error('Restock Error:', err);
      setMessage({
        type: 'error',
        text: extractErrorMessage(err, 'Failed to update restock quantities.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-amber-500"></span>
            Low Stock Alerts
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Showing {filteredItems.length} of {lowStockItems.length} items requiring replenishment.
          </p>
        </div>

        <input
          type="text"
          placeholder="Search low stock items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none w-full md:w-72"
        />
      </div>

      {/* Alert Messages */}
      {message && (
        <div
          className={`p-4 rounded-lg text-sm font-medium border transition-all ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Main Content & Table Container */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">
            No low stock items match your criteria.
          </div>
        ) : (
          <form onSubmit={handleBulkRestock}>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-slate-50/50 text-xs text-slate-500 uppercase font-semibold tracking-wider">
                    <th className="p-4">Item Name</th>
                    <th className="p-4">Remaining Stock</th>
                    <th className="p-4">Min Threshold</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 w-48 text-right">Add Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredItems.map((item) => {
                    const currentStock = item.remaining_stock ?? item.opening_stock ?? 0;
                    const minThreshold = item.min_stock_threshold ?? 5;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-medium text-slate-800">
                          {item.name}
                        </td>
                        <td className="p-4 font-semibold text-rose-600">
                          {currentStock} remaining
                        </td>
                        <td className="p-4 text-slate-500">
                          {minThreshold}
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Low Stock
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={restockQuantities[item.id] ?? ''}
                            onChange={(e) => handleQtyChange(item.id, e.target.value)}
                            className="w-full max-w-[120px] ml-auto px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg transition shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Updating...' : 'Submit Bulk Restock'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}