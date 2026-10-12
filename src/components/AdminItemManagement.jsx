import React, { useState, useEffect } from 'react';
import API from '../api';

export default function AdminItemManagement() {
  const [retailers, setRetailers] = useState([]);
  const [selectedRetailer, setSelectedRetailer] = useState('');
  const [retailerItems, setRetailerItems] = useState([]);
  const [message, setMessage] = useState('');

  // Form state for creating a single new item
  const [newItem, setNewItem] = useState({
    name: '',
    opening_stock: 0,
    unit_cost_price: '',
    unit_retail_price: '',
    min_stock_threshold: 5,
  });

  // Fetch list of all registered retailers (users) on load
  useEffect(() => {
    API.get('users/')
      .then((res) => setRetailers(res.data))
      .catch((err) => console.error('Failed to load retailers:', err));
  }, []);

  // Fetch items belonging to the selected retailer
  const fetchRetailerItems = (retailerId) => {
    if (!retailerId) return;
    API.get(`items/?retailer=${retailerId}`)
      .then((res) => setRetailerItems(res.data))
      .catch((err) => console.error('Failed to load retailer items:', err));
  };

  const handleRetailerChange = (e) => {
    const retailerId = e.target.value;
    setSelectedRetailer(retailerId);
    setRetailerItems([]);
    if (retailerId) {
      fetchRetailerItems(retailerId);
    }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!selectedRetailer) {
      setMessage('Please select a retailer first.');
      return;
    }

    try {
      await API.post('items/', {
        ...newItem,
        retailer: selectedRetailer,
      });
      setMessage('Item created successfully!');
      setNewItem({
        name: '',
        opening_stock: 0,
        unit_cost_price: '',
        unit_retail_price: '',
        min_stock_threshold: 5,
      });
      fetchRetailerItems(selectedRetailer);
    } catch (err) {
      setMessage('Error adding item. Ensure the item name is unique for this retailer.');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-5xl mx-auto space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold text-slate-800">Admin Item & Inventory Management</h2>
        <p className="text-sm text-slate-500">Manage and add products for registered retail clients.</p>
      </div>

      {message && (
        <div className="p-3 text-sm rounded bg-indigo-50 text-indigo-700 border border-indigo-200 flex justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="font-bold">✕</button>
        </div>
      )}

      {/* Retailer Selector */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          Select Target Retailer / Client
        </label>
        <select
          value={selectedRetailer}
          onChange={handleRetailerChange}
          className="w-full p-2.5 border rounded-md bg-white text-sm font-medium"
        >
          <option value="">-- Choose a Retailer --</option>
          {retailers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.username} ({user.email || 'Retailer'})
            </option>
          ))}
        </select>
      </div>

      {/* Form: Add New Item for Selected Retailer */}
      {selectedRetailer && (
        <div className="space-y-6">
          <form onSubmit={handleCreateItem} className="space-y-4 border p-4 rounded-lg bg-slate-50">
            <h3 className="font-semibold text-slate-700 text-sm">Add New Product</h3>
            
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Product Description / Name</label>
              <input
                type="text"
                placeholder="e.g. Foam sheet 1MD"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="w-full p-2 border rounded-md text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Opening Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={newItem.opening_stock}
                  onChange={(e) => setNewItem({ ...newItem, opening_stock: e.target.value })}
                  className="w-full p-2 border rounded-md text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Unit Cost Price (KSh)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newItem.unit_cost_price}
                  onChange={(e) => setNewItem({ ...newItem, unit_cost_price: e.target.value })}
                  className="w-full p-2 border rounded-md text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Unit Retail Price (KSh)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newItem.unit_retail_price}
                  onChange={(e) => setNewItem({ ...newItem, unit_retail_price: e.target.value })}
                  className="w-full p-2 border rounded-md text-sm"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg transition"
            >
              Add Item to Retailer Inventory
            </button>
          </form>

          {/* List of existing items for the selected retailer */}
          <div>
            <h3 className="font-semibold text-slate-700 text-sm mb-2">
              Existing Inventory for Selected Retailer ({retailerItems.length} items)
            </h3>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="p-3">Item Name</th>
                    <th className="p-3">Cost Price</th>
                    <th className="p-3">Retail Price</th>
                    <th className="p-3">Stock Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {retailerItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3">KSh {item.unit_cost_price}</td>
                      <td className="p-3">KSh {item.unit_retail_price}</td>
                      <td className="p-3">{item.remaining_stock} units</td>
                    </tr>
                  ))}
                  {retailerItems.length === 0 && (
                    <tr>
                      <td colSpan="4" className="p-4 text-center text-slate-400">
                        No items added for this retailer yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}