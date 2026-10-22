// src/components/StockActivityLog.jsx
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

import API from '../api';
import { useBranch } from './BranchContext';

export default function StockActivityLog({
  items = [],
  branches: propBranches = [],
  selectedBranch: propSelectedBranch,
  onStockUpdated,
}) {
  const branchContext = useBranch ? useBranch() : {};

  const contextBranch = branchContext?.selectedBranch;
  const contextBranches = branchContext?.branches || [];

  const branches =
    propBranches.length > 0
      ? propBranches
      : contextBranches;

  const targetBranch =
    propSelectedBranch ||
    contextBranch ||
    localStorage.getItem('activeBranch');

  // ============================================================
  // DATE HELPERS
  // ============================================================

  const getTodayFormatted = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }, []);

  // ============================================================
  // STATE
  // ============================================================

  // Operation categories: ADJUSTMENT | CUSTOMER_RETURN | SUPPLIER_RETURN | TRANSFER
  const [operationCategory, setOperationCategory] = useState('ADJUSTMENT');
  const [adjustmentType, setAdjustmentType] = useState('INCREASE'); // INCREASE | DECREASE
  const [destinationBranchId, setDestinationBranchId] = useState('');

  const [selectedItemId, setSelectedItemId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');
  const [createdDate, setCreatedDate] = useState(() => getTodayFormatted());

  // Filter States
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  // Helper to retrieve full item name safely
  const getItemDisplayName = useCallback((item) => {
    return item?.name || item?.item_name || `Item #${item?.id}`;
  }, []);

  const getItemId = useCallback((log) => {
    if (typeof log?.item === 'number') return log.item;
    if (typeof log?.item?.id === 'number') return log.item.id;
    if (typeof log?.item_detail?.id === 'number') return log.item_detail.id;
    return null;
  }, []);

  const normalizeCost = useCallback((val) => {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    return Number.isNaN(num) ? null : Number(num.toFixed(2));
  }, []);

  const extractLogCost = useCallback(
    (log) => {
      const rawCost =
        log?.unit_cost_price ??
        log?.unit_cost ??
        log?.buying_price ??
        log?.cost_price ??
        log?.unit_price ??
        log?.price ??
        log?.cost ??
        log?.item?.buying_price ??
        log?.item?.unit_cost ??
        log?.item_detail?.buying_price ??
        log?.item_detail?.unit_cost ??
        null;

      return normalizeCost(rawCost);
    },
    [normalizeCost]
  );

  const itemPriceMap = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const currentPrice = extractLogCost(item);
      if (currentPrice !== null) {
        map.set(Number(item.id), currentPrice);
      }
    });
    return map;
  }, [items, extractLogCost]);

  useEffect(() => {
    if (!selectedItemId) {
      setUnitCost('');
      return;
    }

    const selectedItem = items.find((i) => Number(i.id) === Number(selectedItemId));
    const baselinePrice = extractLogCost(selectedItem);
    setUnitCost(baselinePrice !== null ? String(baselinePrice) : '');
  }, [selectedItemId, items, extractLogCost]);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    const matchedItem = items.find(
      (i) => getItemDisplayName(i).toLowerCase() === val.trim().toLowerCase()
    );

    if (matchedItem) {
      setSelectedItemId(String(matchedItem.id));
    } else {
      setSelectedItemId('');
    }
  };

  // ============================================================
  // GET ACTIVE BRANCH ID
  // ============================================================

  const getBranchId = useCallback(() => {
    if (!targetBranch) return null;

    if (typeof targetBranch === 'number') return targetBranch;

    if (typeof targetBranch === 'object') {
      const id = targetBranch.id ?? targetBranch.branch_id ?? targetBranch.pk;
      if (id !== undefined && id !== null && id !== '') {
        const numericId = Number(id);
        return Number.isFinite(numericId) ? numericId : null;
      }
      return null;
    }

    if (typeof targetBranch === 'string') {
      const trimmed = targetBranch.trim();
      if (!trimmed) return null;
      if (/^\d+$/.test(trimmed)) return Number(trimmed);

      const found = branches.find((branch) => {
        const branchName = branch?.name || branch?.branch_name || '';
        return String(branchName).trim().toLowerCase() === trimmed.toLowerCase();
      });

      if (found) {
        const id = found.id ?? found.branch_id ?? found.pk;
        if (id !== undefined && id !== null && id !== '') {
          const numericId = Number(id);
          return Number.isFinite(numericId) ? numericId : null;
        }
      }
      return null;
    }

    return null;
  }, [targetBranch, branches]);

  // ============================================================
  // FETCH STOCK ACTIVITY HISTORY
  // ============================================================

  const fetchLogs = useCallback(async () => {
    const branchId = getBranchId();

    if (!branchId) {
      setLogs([]);
      return;
    }

    setLoading(true);

    try {
      const response = await API.get(
        `stock-movements/activity-history/?branch=${branchId}`
      );

      let rawData = [];

      if (Array.isArray(response.data)) {
        rawData = response.data;
      } else if (Array.isArray(response.data?.results)) {
        rawData = response.data.results;
      } else if (Array.isArray(response.data?.data)) {
        rawData = response.data.data;
      }

      const seen = new Set();
      const uniqueLogs = [];

      for (const activity of rawData) {
        const uniqueKey =
          activity.id ??
          [
            activity.item,
            activity.date || activity.created_at,
            activity.movement_type,
            activity.adjustment_type,
            activity.quantity,
            activity.reference,
          ].join('|');

        if (!seen.has(uniqueKey)) {
          seen.add(uniqueKey);
          uniqueLogs.push(activity);
        }
      }

      setLogs(uniqueLogs);
    } catch (error) {
      console.error('Failed to fetch stock activity logs:', error);

      setLogs([]);
      setStatus({
        type: 'error',
        text:
          error?.response?.data?.detail ||
          'Failed to load stock activity records.',
      });
    } finally {
      setLoading(false);
    }
  }, [getBranchId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const isValidDateString = (value) => {
    if (typeof value !== 'string' || !value) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const [year, month, day] = value.split('-').map(Number);
    const testDate = new Date(year, month - 1, day);

    return (
      testDate.getFullYear() === year &&
      testDate.getMonth() === month - 1 &&
      testDate.getDate() === day
    );
  };

  // ============================================================
  // SUBMIT STOCK OPERATION / ADJUSTMENT / TRANSFER
  // ============================================================

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);

    const branchId = getBranchId();

    if (!selectedItemId) {
      setStatus({ type: 'error', text: 'Please select a valid item.' });
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      setStatus({ type: 'error', text: 'Please enter a valid positive quantity.' });
      return;
    }

    if (!branchId) {
      setStatus({ type: 'error', text: 'Active source branch could not be determined.' });
      return;
    }

    if (!isValidDateString(createdDate)) {
      setStatus({ type: 'error', text: 'Please select a valid transaction date.' });
      return;
    }

    if (operationCategory === 'TRANSFER') {
      if (!destinationBranchId) {
        setStatus({ type: 'error', text: 'Please select a destination branch for stock transfer.' });
        return;
      }
      if (Number(destinationBranchId) === Number(branchId)) {
        setStatus({ type: 'error', text: 'Source and destination branches must be different.' });
        return;
      }
    }

    const itemId = Number(selectedItemId);
    const numericBranchId = Number(branchId);
    const numericQuantity = Number(quantity);
    const numericUnitCost = unitCost !== '' ? Number(unitCost) : null;

    setSubmitting(true);

    try {
      if (operationCategory === 'TRANSFER') {
        // Inter-branch Stock Transfer Endpoint
        const transferPayload = {
          from_branch: numericBranchId,
          to_branch: Number(destinationBranchId),
          item: itemId,
          quantity: numericQuantity,
          date: createdDate,
          notes: notes.trim() || 'Branch Stock Transfer',
        };

        await API.post('stock-transfers/', transferPayload);
      } else if (operationCategory === 'CUSTOMER_RETURN') {
        const returnPayload = {
          branch: numericBranchId,
          item: itemId,
          quantity: numericQuantity,
          reason: notes.trim() || 'Customer Return',
          date: createdDate,
        };

        await API.post('customer-returns/', returnPayload);
      } else if (operationCategory === 'SUPPLIER_RETURN') {
        const supplierPayload = {
          branch: numericBranchId,
          item: itemId,
          quantity: numericQuantity,
          reason: notes.trim() || 'Supplier Return',
          date: createdDate,
        };

        await API.post('supplier-returns/', supplierPayload);
      } else {
        // Manual Stock Adjustment
        const mappedMovementType =
          adjustmentType === 'INCREASE' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';

        const formattedCost = numericUnitCost !== null ? numericUnitCost.toFixed(2) : '0.00';

        const payload = {
          item: itemId,
          branch: numericBranchId,
          movement_type: mappedMovementType,
          adjustment_type: adjustmentType,
          reference: `ADJUST-${Date.now()}`,
          quantity: numericQuantity,
          unit_cost_price: formattedCost,
          date: createdDate,
          notes: notes.trim() || 'stock adjustment',
        };

        await API.post('stock-movements/', payload);
      }

      setStatus({
        type: 'success',
        text: 'Stock operation recorded successfully.',
      });

      setSelectedItemId('');
      setSearchQuery('');
      setQuantity('');
      setUnitCost('');
      setNotes('');
      setDestinationBranchId('');
      setCreatedDate(getTodayFormatted());

      await fetchLogs();

      if (typeof onStockUpdated === 'function') {
        onStockUpdated();
      }
    } catch (error) {
      console.error('Stock operation submission error:', error);

      const responseData = error?.response?.data;
      let errorDetail = 'Failed to record stock operation.';

      if (responseData) {
        if (typeof responseData === 'string') {
          errorDetail = responseData;
        } else if (responseData.detail) {
          errorDetail = responseData.detail;
        } else if (responseData.error) {
          errorDetail = responseData.error;
        } else if (typeof responseData === 'object') {
          errorDetail = Object.entries(responseData)
            .map(([key, value]) => {
              const msg = Array.isArray(value) ? value.join(', ') : String(value);
              return `${key}: ${msg}`;
            })
            .join(' | ');
        }
      }

      setStatus({ type: 'error', text: errorDetail });
    } finally {
      setSubmitting(false);
    }
  };

  const formatLogDate = (log) => {
    const rawDate = log?.date ?? log?.transaction_date ?? log?.created_at ?? null;

    if (!rawDate) return '-';

    const dateString = String(rawDate).split('T')[0].trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);

      return localDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }

    return String(rawDate);
  };

  const getRawLogDateString = (log) => {
    const rawDate = log?.date ?? log?.transaction_date ?? log?.created_at ?? null;
    if (!rawDate) return '';
    return String(rawDate).split('T')[0].trim();
  };

  const getItemName = (log) => {
    if (typeof log?.item === 'string') return log.item;
    if (log?.item_name) return log.item_name;
    if (log?.item?.name) return log.item.name;
    if (log?.item_detail?.name) return log.item_detail.name;

    if (log?.item !== undefined && log?.item !== null) {
      const matched = items.find((item) => Number(item?.id) === Number(log.item));
      if (matched) {
        return matched.name || matched.item_name || 'Unknown';
      }
      return `Item #${log.item}`;
    }

    return 'Unknown';
  };

  const getTypeLabel = (log) => {
    const rawType =
      log?.activity_type ||
      log?.movement_type_display ||
      log?.adjustment_type ||
      log?.movement_type ||
      '';

    if (!rawType) return 'INCREASE';

    const uppercaseType = String(rawType).toUpperCase().trim();

    if (uppercaseType.includes('TRANSFER_IN')) return 'TRANSFER IN (+)';
    if (uppercaseType.includes('TRANSFER_OUT')) return 'TRANSFER OUT (-)';
    if (uppercaseType.includes('CUSTOMER_RETURN')) return 'CUSTOMER RETURN (+)';
    if (uppercaseType.includes('SUPPLIER_RETURN')) return 'SUPPLIER RETURN (-)';

    if (uppercaseType.includes('ADJUSTMENT')) {
      if (
        uppercaseType.includes('DECREASE') ||
        uppercaseType.includes('OUT') ||
        uppercaseType.includes('REDUCE')
      ) {
        return 'ADJUSTMENT (DECREASE)';
      }
      return 'ADJUSTMENT (INCREASE)';
    }

    return uppercaseType.replace(/_/g, ' ');
  };

  const isIncreaseType = (typeLabel) => {
    return (
      typeLabel.includes('INCREASE') ||
      typeLabel.includes('IN') ||
      typeLabel.includes('CUSTOMER RETURN') ||
      typeLabel.includes('PURCHASE')
    );
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const logDate = getRawLogDateString(log);
      if (!logDate) return true;

      if (startDateFilter && logDate < startDateFilter) return false;
      if (endDateFilter && logDate > endDateFilter) return false;

      return true;
    });
  }, [logs, startDateFilter, endDateFilter]);

  const currentBranchId = getBranchId();

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      {/* FORM CONTAINER */}
      <div className="bg-white border border-slate-300 p-5 rounded-xl shadow-sm">
        <h3 className="text-xs font-bold text-slate-800 mb-4 uppercase tracking-wider">
          Stock Operations & Inter-Branch Adjustments
        </h3>

        {/* STATUS ALERT */}
        {status && (
          <div
            className={`p-3 rounded-lg text-xs font-semibold mb-4 flex justify-between items-center ${
              status.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : 'bg-rose-50 text-rose-800 border border-rose-300'
            }`}
          >
            <span>{status.text}</span>
            <button
              type="button"
              onClick={() => setStatus(null)}
              className="underline ml-4 hover:opacity-75 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* OPERATION CATEGORY */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Operation Type *
              </label>
              <select
                value={operationCategory}
                onChange={(e) => setOperationCategory(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-lg text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
              >
                <option value="ADJUSTMENT">Manual Stock Adjustment</option>
                <option value="CUSTOMER_RETURN">Customer Return (+ Stock)</option>
                <option value="SUPPLIER_RETURN">Supplier Return (- Stock)</option>
                <option value="TRANSFER">Stock Transfer (Branch-to-Branch)</option>
              </select>
            </div>

            {/* ADJUSTMENT DIRECTION OR TRANSFER DESTINATION */}
            {operationCategory === 'ADJUSTMENT' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adjustment Direction *
                </label>
                <select
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-lg text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="INCREASE">Increase Stock (+)</option>
                  <option value="DECREASE">Decrease Stock (-)</option>
                </select>
              </div>
            )}

            {operationCategory === 'TRANSFER' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Destination Branch *
                </label>
                <select
                  value={destinationBranchId}
                  onChange={(e) => setDestinationBranchId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-lg text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                  required
                >
                  <option value="">-- Select Destination Branch --</option>
                  {branches
                    .filter((b) => Number(b.id) !== Number(currentBranchId))
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* ITEM SEARCH INPUT WITH DATALIST */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Item *
              </label>
              <input
                list="stock-activity-item-list-2"
                type="text"
                placeholder="Type item name..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-lg text-xs font-medium placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />

              <datalist id="stock-activity-item-list-2">
                {items.map((item) => (
                  <option key={item.id} value={getItemDisplayName(item)}>
                    {item.remaining_stock !== undefined ? `In Stock: ${item.remaining_stock}` : ''}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* QUANTITY INPUT */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quantity *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-lg text-xs placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>

            {/* COST PRICE */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit Cost Price (KSh)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-lg text-xs placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* TRANSACTION DATE */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transaction Date *
              </label>
              <input
                type="date"
                value={createdDate}
                onChange={(e) => setCreatedDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-lg text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
          </div>

          {/* NOTES INPUT */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes / Reason / Reference
            </label>
            <input
              type="text"
              placeholder="e.g., Damaged item return or Stock transfer note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-lg text-xs placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* SUBMIT BUTTON */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={
                submitting ||
                !selectedItemId ||
                !quantity ||
                !createdDate ||
                !getBranchId()
              }
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Processing...' : 'Submit Operation'}
            </button>
          </div>
        </form>
      </div>

      {/* ACTIVITY HISTORY CONTAINER */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 border border-slate-300 rounded-xl shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Stock Activity & Transfer History
            </h3>
            <p className="text-xs text-slate-600">
              Complete movement history for current branch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <span className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                From Date
              </span>
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="p-1.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-md text-xs outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                To Date
              </span>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className="p-1.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-md text-xs outline-none focus:border-indigo-500"
              />
            </div>

            {(startDateFilter || endDateFilter) && (
              <button
                type="button"
                onClick={() => {
                  setStartDateFilter('');
                  setEndDateFilter('');
                }}
                className="mt-4 text-xs text-slate-600 hover:text-slate-900 underline font-medium cursor-pointer"
              >
                Clear
              </button>
            )}

            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              className="mt-4 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* LOGS TABLE */}
        <div className="overflow-x-auto border border-slate-300 rounded-xl bg-white shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="p-3">Transaction Date</th>
                <th className="p-3">Item</th>
                <th className="p-3">Type</th>
                <th className="p-3">Quantity</th>
                <th className="p-3">Reference / Destination</th>
                <th className="p-3">Notes</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-xs text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-slate-500">
                    Loading stock activity...
                  </td>
                </tr>
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const label = getTypeLabel(log);
                  const isPositive = isIncreaseType(label);

                  const keyId =
                    log.id ??
                    [
                      log.item,
                      log.date || log.created_at,
                      log.quantity,
                      log.reference,
                    ].join('-');

                  return (
                    <tr key={keyId} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {formatLogDate(log)}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">
                        {getItemName(log)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                            isPositive
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}
                        >
                          {label}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-800">
                        {log.quantity ?? log.quantity_level ?? '-'}
                      </td>
                      <td className="p-3 text-slate-600 font-mono text-[11px]">
                        {log.reference || log.target || '-'}
                      </td>
                      <td className="p-3 text-slate-600 italic">
                        {log.notes || log.reason || '-'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-slate-500">
                    No activity logs found for the selected date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}