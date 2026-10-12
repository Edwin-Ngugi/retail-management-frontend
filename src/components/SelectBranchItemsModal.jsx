import React, { useState, useEffect } from 'react';
import axios from 'axios';

export function SelectBranchItemsModal({ isOpen, onClose, currentBranchId, onImportSuccess }) {
  const [branches, setBranches] = useState([]);
  const [selectedSourceBranch, setSelectedSourceBranch] = useState('');
  const [sourceItems, setSourceItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch available branches
  useEffect(() => {
    if (isOpen) {
      axios.get('/api/branches/').then((res) => {
        // Exclude current branch from options
        const otherBranches = res.data.filter((b) => b.id !== currentBranchId);
        setBranches(otherBranches);
      });
    }
  }, [isOpen, currentBranchId]);

  // Fetch items whenever a source branch is selected
  useEffect(() => {
    if (selectedSourceBranch) {
      setLoading(true);
      axios
        .get(`/api/items/?branch_id=${selectedSourceBranch}`)
        .then((res) => {
          setSourceItems(res.data);
          // Default: select all items
          setSelectedItemIds(res.data.map((item) => item.id));
        })
        .finally(() => setLoading(false));
    } else {
      setSourceItems([]);
      setSelectedItemIds([]);
    }
  }, [selectedSourceBranch]);

  const toggleSelectItem = (id) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.length === sourceItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(sourceItems.map((item) => item.id));
    }
  };

  const handleImport = async () => {
    if (!selectedSourceBranch || selectedItemIds.length === 0) return;

    setSubmitting(true);
    try {
      await axios.post('/api/branches/copy-items/', {
        source_branch: selectedSourceBranch,
        target_branch: currentBranchId,
        item_ids: selectedItemIds,
        copy_prices: true,
      });

      onImportSuccess();
      onClose();
    } catch (err) {
      alert('Failed to copy items to new branch');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 text-white shadow-2xl">
        <h2 className="text-xl font-bold mb-4">Select Items from Existing Branch</h2>

        {/* Source Branch Dropdown */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Select Source Branch (e.g. Car Wash)
          </label>
          <select
            value={selectedSourceBranch}
            onChange={(e) => setSelectedSourceBranch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-purple-500"
          >
            <option value="">-- Choose Branch --</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Item Selection List */}
        {selectedSourceBranch && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-400">
                Available Items ({sourceItems.length})
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-purple-400 hover:underline"
              >
                {selectedItemIds.length === sourceItems.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-400">Loading items...</div>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-lg divide-y divide-slate-800">
                {sourceItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center justify-between p-3 hover:bg-slate-800/50 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => toggleSelectItem(item.id)}
                        className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="font-medium text-sm">{item.name}</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      KSh {item.unit_selling_price || item.unit_retail_price || 0}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={submitting || selectedItemIds.length === 0}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            {submitting ? 'Importing...' : `Import ${selectedItemIds.length} Items`}
          </button>
        </div>
      </div>
    </div>
  );
}