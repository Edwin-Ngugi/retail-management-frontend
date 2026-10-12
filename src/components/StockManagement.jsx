import React, { useState, useEffect } from 'react';
import API from '../api';

export default function SalesEntry() {
  const [dbItems, setDbItems] = useState([]);
  const [rows, setRows] = useState([
    { item_id: '', quantity: 1, discount: 0, retail_price: 0, cost_price: 0, available_stock: 0 },
  ]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch available items and stock on load
  const fetchItems = async () => {
    try {
      const res = await API.get('items/');
      setDbItems(res.data);
    } catch (err) {
      console.error('Failed to load inventory items:', err);
      setStatus({ type: 'error', text: 'Could not fetch inventory items from server.' });
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleItemSelect = (index, selectedId) => {
    const selectedObj = dbItems.find((i) => i.id === parseInt(selectedId, 10));
    const newRows = [...rows];

    if (selectedObj) {
      const stock = selectedObj.remaining_stock ?? selectedObj.opening_stock ?? 0;
      newRows[index] = {
        ...newRows[index],
        item_id: selectedObj.id,
        retail_price: parseFloat(selectedObj.unit_retail_price || 0),
        cost_price: parseFloat(selectedObj.unit_cost_price || 0),
        available_stock: stock,
        quantity: stock > 0 ? 1 : 0,
      };
    } else {
      newRows[index] = {
        ...newRows[index],
        item_id: '',
        retail_price: 0,
        cost_price: 0,
        available_stock: 0,
        quantity: 1,
      };
    }
    setRows(newRows);
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value === '' ? 0 : parseFloat(value);
    setRows(newRows);
  };

  const handleAddRow = () => {
    setRows([
      ...rows,
      { item_id: '', quantity: 1, discount: 0, retail_price: 0, cost_price: 0, available_stock: 0 },
    ]);
  };

  const handleRemoveRow = (index) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const calculateLineTotal = (row) => {
    const effectivePrice = Math.max(0, row.retail_price - (row.discount || 0));
    return (effectivePrice * (row.quantity || 0)).toFixed(2);
  };

  const calculateGrandTotal = () => {
    return rows
      .reduce((sum, row) => sum + parseFloat(calculateLineTotal(row)), 0)
      .toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    // Validate entries
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.item_id) {
        setStatus({ type: 'error', text: `Please select a valid item for row #${i + 1}.` });
        setLoading(false);
        return;
      }
      if (r.quantity <= 0) {
        setStatus({ type: 'error', text: `Quantity must be greater than 0 for row #${i + 1}.` });
        setLoading(false);
        return;
      }
      if (r.quantity > r.available_stock) {
        setStatus({
          type: 'error',
          text: `Quantity for row #${i + 1} exceeds remaining stock (${r.available_stock} available).`,
        });
        setLoading(false);
        return;
      }
    }

    try {
      const payload = rows.map((r) => ({
        item: r.item_id,
        quantity: r.quantity,
        discount_per_unit: r.discount,
      }));

      await API.post('sales/', payload);
      setStatus({ type: 'success', text: 'Daily sales recorded successfully! Inventory updated.' });
      setRows([{ item_id: '', quantity: 1, discount: 0, retail_price: 0, cost_price: 0, available_stock: 0 }]);
      fetchItems(); // Refresh stock counts in UI
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Failed to submit sales transaction.';
      setStatus({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800">Record Daily Sales</h2>
        <p className="text-xs text-slate-500 mt-1">
          Select items sold, adjust quantities or discounts, and submit to update active stock balances.
        </p>
      </div>

      {status && (
        <div
          className={`p-4 rounded-lg border text-sm font-medium ${
            status.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          {status.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div className="space-y-4">
          {rows.map((row, index) => {
            const selectedItem = dbItems.find((i) => i.id === row.item_id);

            return (
              <div
                key={index}
                className="p-4 border border-slate-200 rounded-lg bg-slate-50/50 space-y-3 md:space-y-0 md:flex md:items-center md:gap-4"
              >
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Select Item</label>
                  <input
                    list={`item-list-${index}`}
                    type="text"
                    placeholder="Type item name..."
                    value={selectedItem ? selectedItem.name : ''}
                    onChange={(e) => {
                      const inputVal = e.target.value;
                      const matchedItem = dbItems.find(
                        (i) => i.name.toLowerCase() === inputVal.toLowerCase()
                      );
                      handleItemSelect(index, matchedItem ? matchedItem.id : '');
                    }}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />

                  <datalist id={`item-list-${index}`}>
                    {dbItems.map((item) => {
                      const stock = item.remaining_stock ?? item.opening_stock ?? 0;
                      if (stock <= 0) return null; // Exclude out-of-stock items
                      return (
                        <option key={item.id} value={item.name}>
                          Retail: KSh {item.unit_retail_price} ({stock} in stock)
                        </option>
                      );
                    })}
                  </datalist>
                </div>

                <div className="w-full md:w-28">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Qty {row.available_stock > 0 && <span className="text-slate-400">({row.available_stock})</span>}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={row.available_stock || 1}
                    value={row.quantity}
                    onChange={(e) => handleRowChange(index, 'quantity', e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>

                <div className="w-full md:w-32">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Discount/Item</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.discount}
                    onChange={(e) => handleRowChange(index, 'discount', e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="w-full md:w-36 text-right">
                  <span className="block text-xs font-semibold text-slate-500 mb-1">Subtotal</span>
                  <span className="text-base font-bold text-slate-800">KSh {calculateLineTotal(row)}</span>
                </div>

                {rows.length > 1 && (
                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(index)}
                      className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Remove item"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-200 gap-4">
          <button
            type="button"
            onClick={handleAddRow}
            className="w-full sm:w-auto px-4 py-2 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 rounded-lg font-semibold text-sm transition"
          >
            + Add Item Row
          </button>

          <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-right">
              <span className="text-xs text-slate-500 uppercase font-semibold block">Total Amount</span>
              <span className="text-xl font-extrabold text-indigo-600">KSh {calculateGrandTotal()}</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition shadow-sm disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Submit Transactions'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}