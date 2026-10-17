// src/components/ManagementOperations.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import API from '../api';

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const formatNumber = (value, minimumFractionDigits = 0, maximumFractionDigits = 2) => {
  return toNumber(value).toLocaleString(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
  });
};

const formatCurrency = (value) => {
  return `KSh ${formatNumber(value, 2, 2)}`;
};

const getRecordDateStr = (record) => {
  const rawDate =
    record?.date ||
    record?.payment_date ||
    record?.repayment_date ||
    record?.created_at ||
    record?.sale_date ||
    record?.purchase_date ||
    record?.timestamp;

  if (!rawDate) return '';
  if (typeof rawDate === 'string') return rawDate.split('T')[0];

  try {
    return new Date(rawDate).toISOString().split('T')[0];
  } catch {
    return '';
  }
};

const fetchPaginatedData = async (initialEndpoint) => {
  let results = [];
  let currentEndpoint = initialEndpoint;

  while (currentEndpoint) {
    let cleanPath = currentEndpoint;

    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      try {
        const urlObj = new URL(cleanPath);
        cleanPath = urlObj.pathname + urlObj.search;
      } catch (e) {
        /* ignore */
      }
    }

    if (cleanPath.startsWith('/api/')) {
      cleanPath = cleanPath.replace(/^\/api\//, '');
    } else if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.slice(1);
    }

    try {
      const res = await API.get(cleanPath);
      const data = res.data;

      if (Array.isArray(data)) {
        results = results.concat(data);
        break;
      } else if (data?.results && Array.isArray(data.results)) {
        results = results.concat(data.results);
        currentEndpoint = data.next ? data.next : null;
      } else {
        break;
      }
    } catch (e) {
      console.warn(`Fetch error on path: ${cleanPath}`, e);
      break;
    }
  }

  return results;
};

export default function ManagementOperations({
  selectedBranch,
  initialSection = 'inventory',
  effectiveRange = {},
  onBack,
}) {
  const [activeSection, setActiveSection] = useState(initialSection);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [items, setItems] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [repayments, setRepayments] = useState([]);

  const { effectiveStartDate, effectiveEndDate } = effectiveRange;

  const loadData = useCallback(async () => {
    if (!selectedBranch) return;
    setLoading(true);

    try {
      const branchParam = `branch=${encodeURIComponent(selectedBranch)}`;

      const [rawItems, rawSales, rawPurchases, rawRepayments] = await Promise.all([
        fetchPaginatedData(`items/?${branchParam}`),
        fetchPaginatedData(`sales/?${branchParam}`),
        fetchPaginatedData(`purchases/?${branchParam}`),
        fetchPaginatedData(`credit-repayments/?${branchParam}`),
      ]);

      setItems(Array.isArray(rawItems) ? rawItems : []);
      setSales(Array.isArray(rawSales) ? rawSales : []);
      setPurchases(Array.isArray(rawPurchases) ? rawPurchases : []);
      setRepayments(Array.isArray(rawRepayments) ? rawRepayments : []);
    } catch (err) {
      console.error('Error loading operations data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute Detailed Stock Table Metrics per item
  const stockControlData = useMemo(() => {
    // Filter sales within period
    const filteredSales = sales.filter((s) => {
      const dateStr = getRecordDateStr(s);
      if (!dateStr) return true;
      if (effectiveStartDate && dateStr < effectiveStartDate) return false;
      if (effectiveEndDate && dateStr > effectiveEndDate) return false;
      return true;
    });

    // Filter purchases within period
    const filteredPurchases = purchases.filter((p) => {
      const dateStr = getRecordDateStr(p);
      if (!dateStr) return true;
      if (effectiveStartDate && dateStr < effectiveStartDate) return false;
      if (effectiveEndDate && dateStr > effectiveEndDate) return false;
      return true;
    });

    // Map sales by item_id
    const soldByItem = {};
    filteredSales.forEach((sale) => {
      const saleItems = sale.items || sale.sale_items || [];
      saleItems.forEach((si) => {
        const itemId = si.item || si.item_id || si.product || si.id;
        const qty = toNumber(si.quantity || si.qty || 1);
        if (itemId) {
          soldByItem[itemId] = (soldByItem[itemId] || 0) + qty;
        }
      });
    });

    // Map purchases by item_id
    const restockedByItem = {};
    const purchaseCostByItem = {};
    const purchaseQtyByItem = {};

    filteredPurchases.forEach((p) => {
      const pItems = p.items || p.purchase_items || [p];
      pItems.forEach((pi) => {
        const itemId = pi.item || pi.item_id || pi.product || pi.id;
        const qty = toNumber(pi.quantity || pi.qty || 0);
        const cost = toNumber(pi.unit_cost_price || pi.unit_cost || pi.cost_price || 0);

        if (itemId) {
          restockedByItem[itemId] = (restockedByItem[itemId] || 0) + qty;
          purchaseCostByItem[itemId] = (purchaseCostByItem[itemId] || 0) + qty * cost;
          purchaseQtyByItem[itemId] = (purchaseQtyByItem[itemId] || 0) + qty;
        }
      });
    });

    return items.map((item) => {
      const currentStock = toNumber(item.remaining_stock ?? item.current_stock ?? item.stock ?? 0);
      const sold = soldByItem[item.id] || 0;
      const restocked = restockedByItem[item.id] || 0;

      // Opening Stock = Current Stock + Sold - Restocked
      const openingStock = Math.max(0, currentStock + sold - restocked);

      const costPrice = toNumber(item.unit_cost_price || item.cost_price || 0);
      const retailPrice = toNumber(item.unit_retail_price || item.unit_selling_price || item.retail_price || 0);

      // Weighted Average Cost (WAC) = (Total Purchase Cost + Current Stock Value) / Total Units
      const totalPurchaseCost = purchaseCostByItem[item.id] || 0;
      const totalPurchaseQty = purchaseQtyByItem[item.id] || 0;

      let wac = costPrice;
      if (totalPurchaseQty > 0) {
        wac = (totalPurchaseCost + currentStock * costPrice) / (totalPurchaseQty + currentStock);
      } else if (item.wac_price || item.weighted_average_cost) {
        wac = toNumber(item.wac_price || item.weighted_average_cost);
      }

      return {
        id: item.id,
        name: item.name || item.item_name || 'Unnamed Product',
        sku: item.sku || item.code || `#${item.id}`,
        openingStock,
        restocked,
        sold,
        currentStock,
        costPrice,
        wac,
        retailPrice,
      };
    });
  }, [items, sales, purchases, effectiveStartDate, effectiveEndDate]);

  const filteredStockData = useMemo(() => {
    if (!searchTerm.trim()) return stockControlData;
    const term = searchTerm.toLowerCase();
    return stockControlData.filter(
      (row) => row.name.toLowerCase().includes(term) || row.sku.toLowerCase().includes(term)
    );
  }, [stockControlData, searchTerm]);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-6 font-sans">
      
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600 block">
            Management Operations
          </span>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Inventory & Stock Control
          </h1>
          <p className="text-xs text-slate-500">
            Review branch stock levels, opening balances, restocks, sales, and pricing valuation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              ← Overview
            </button>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : '🔄 Refresh Data'}
          </button>
        </div>
      </div>

      {/* OPERATIONS SUB-NAV PANELS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { id: 'inventory', title: 'Inventory & Stock Control', subtitle: 'Stock flow & pricing' },
          { id: 'purchases', title: 'Purchases & Restock', subtitle: 'Supplier orders' },
          { id: 'credit', title: 'Customer Credit & Repayments', subtitle: 'Debtors ledger' },
          { id: 'returns', title: 'Returns & Stock Losses', subtitle: 'Adjustments' },
          { id: 'performance', title: 'Branch Performance', subtitle: 'Target metrics' },
        ].map((panel) => (
          <button
            key={panel.id}
            onClick={() => setActiveSection(panel.id)}
            className={`p-3.5 rounded-2xl border text-left transition cursor-pointer space-y-1 ${
              activeSection === panel.id
                ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 text-indigo-950'
                : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/60 text-slate-700'
            }`}
          >
            <h3 className="text-xs font-bold leading-snug">{panel.title}</h3>
            <p className="text-[10px] text-slate-500 font-medium">{panel.subtitle}</p>
          </button>
        ))}
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search items or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>
        <span className="text-xs font-semibold text-slate-500 self-end sm:self-center">
          Showing {filteredStockData.length} of {stockControlData.length} catalog items
        </span>
      </div>

      {/* INVENTORY & STOCK CONTROL TABLE */}
      {activeSection === 'inventory' && (
        <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3.5 px-4">Items</th>
                <th className="py-3.5 px-4 text-right">Opening Stock</th>
                <th className="py-3.5 px-4 text-right">Restocks</th>
                <th className="py-3.5 px-4 text-right">Sold</th>
                <th className="py-3.5 px-4 text-right">Current Stock</th>
                <th className="py-3.5 px-4 text-right">Current Cost Price</th>
                <th className="py-3.5 px-4 text-right">WAC</th>
                <th className="py-3.5 px-4 text-right">Retail Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400 font-semibold">
                    Loading inventory records...
                  </td>
                </tr>
              ) : filteredStockData.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500">
                    No matching items found.
                  </td>
                </tr>
              ) : (
                filteredStockData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div>{row.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{row.sku}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {formatNumber(row.openingStock)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 font-bold">
                      +{formatNumber(row.restocked)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-600 font-bold">
                      -{formatNumber(row.sold)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatNumber(row.currentStock)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {formatCurrency(row.costPrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-indigo-600 font-bold">
                      {formatCurrency(row.wac)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                      {formatCurrency(row.retailPrice)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeSection !== 'inventory' && (
        <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-slate-500 text-xs">
          Operational records view for <strong className="text-slate-800 uppercase">{activeSection}</strong>.
        </div>
      )}

    </div>
  );
}