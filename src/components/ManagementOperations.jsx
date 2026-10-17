// src/components/ManagementOperations.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import API from '../api';
import { useBranch } from './BranchContext';

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
  selectedBranch: initialBranch,
  initialSection = 'inventory',
  effectiveRange = {},
  onBack,
}) {
  const { selectedBranch: contextBranch, setSelectedBranch: setContextBranch, branches = [] } = useBranch();
  const [internalBranch, setInternalBranch] = useState(initialBranch || contextBranch || '');

  const branchKey = useMemo(() => {
    const active = internalBranch || contextBranch || initialBranch || '';
    if (typeof active === 'object') return active?.id || active?.code || '';
    return active;
  }, [internalBranch, contextBranch, initialBranch]);

  const handleBranchChange = (e) => {
    const newBranch = e.target.value;
    setInternalBranch(newBranch);
    if (typeof setContextBranch === 'function') {
      setContextBranch(newBranch);
    }
  };

  const [activeSection, setActiveSection] = useState(initialSection);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [rawPricings, setRawPricings] = useState([]);
  const [items, setItems] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);

  const { effectiveStartDate, effectiveEndDate } = effectiveRange;

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const branchParam = branchKey ? `branch=${encodeURIComponent(branchKey)}` : '';

      const [
        pricingsBranch,
        pricingsAll,
        itemsBranch,
        itemsAll,
        salesBranch,
        purchasesBranch
      ] = await Promise.all([
        branchParam ? fetchPaginatedData(`branch-item-pricings/?${branchParam}`) : Promise.resolve([]),
        fetchPaginatedData('branch-item-pricings/'),
        branchParam ? fetchPaginatedData(`items/?${branchParam}`) : Promise.resolve([]),
        fetchPaginatedData('items/'),
        branchParam ? fetchPaginatedData(`sales/?${branchParam}`) : fetchPaginatedData('sales/'),
        branchParam ? fetchPaginatedData(`purchases/?${branchParam}`) : fetchPaginatedData('purchases/'),
      ]);

      const mergedPricings = pricingsBranch.length > 0 ? pricingsBranch : pricingsAll;
      const mergedItems = itemsBranch.length > 0 ? itemsBranch : itemsAll;

      setRawPricings(mergedPricings);
      setItems(mergedItems);
      setSales(salesBranch);
      setPurchases(purchasesBranch);
    } catch (err) {
      console.error('Error loading operations data:', err);
    } finally {
      setLoading(false);
    }
  }, [branchKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Combine BranchItemPricing and Item Catalog entries
  const catalogList = useMemo(() => {
    const catalogMap = new Map();

    if (rawPricings.length > 0) {
      rawPricings.forEach((p) => {
        const itemObj = p.item && typeof p.item === 'object' ? p.item : {};
        const id = itemObj.id || p.item_id || p.item || p.id;
        if (!id) return;

        catalogMap.set(String(id), {
          id,
          name: itemObj.name || p.item_name || p.name || `Item #${id}`,
          sku: itemObj.sku || itemObj.code || p.sku || p.code || `#${id}`,
          opening_stock: toNumber(p.opening_stock),
          current_cost_price: toNumber(p.unit_cost_price || p.opening_stock_unit_cost_price),
          unit_selling_price: toNumber(p.unit_selling_price || p.unit_retail_price),
          remaining_stock: toNumber(p.remaining_stock ?? p.quantity ?? itemObj.remaining_stock),
        });
      });
    }

    if (items.length > 0) {
      items.forEach((item) => {
        const id = String(item.id);
        const existing = catalogMap.get(id);

        if (!existing) {
          catalogMap.set(id, {
            id: item.id,
            name: item.name || `Item #${item.id}`,
            sku: item.sku || item.code || `#${item.id}`,
            opening_stock: toNumber(item.opening_stock),
            current_cost_price: toNumber(item.unit_cost_price || item.cost_price),
            unit_selling_price: toNumber(item.unit_selling_price || item.unit_retail_price || item.retail_price),
            remaining_stock: toNumber(item.remaining_stock ?? item.current_stock ?? item.stock),
          });
        } else {
          if (!existing.current_cost_price) existing.current_cost_price = toNumber(item.unit_cost_price || item.cost_price);
          if (!existing.unit_selling_price) existing.unit_selling_price = toNumber(item.unit_selling_price || item.unit_retail_price);
          if (!existing.remaining_stock) existing.remaining_stock = toNumber(item.remaining_stock ?? item.current_stock ?? item.stock);
        }
      });
    }

    return Array.from(catalogMap.values());
  }, [rawPricings, items]);

  // Compute Detailed Stock Control Metrics
  const stockControlData = useMemo(() => {
    const filteredSales = sales.filter((s) => {
      const dateStr = getRecordDateStr(s);
      if (!dateStr) return true;
      if (effectiveStartDate && dateStr < effectiveStartDate) return false;
      if (effectiveEndDate && dateStr > effectiveEndDate) return false;
      return true;
    });

    const filteredPurchases = purchases.filter((p) => {
      const dateStr = getRecordDateStr(p);
      if (!dateStr) return true;
      if (effectiveStartDate && dateStr < effectiveStartDate) return false;
      if (effectiveEndDate && dateStr > effectiveEndDate) return false;
      return true;
    });

    const soldByItem = {};
    filteredSales.forEach((sale) => {
      const saleItems = sale.items || sale.sale_items || [sale];
      saleItems.forEach((si) => {
        const itemId = String(si.item || si.item_id || si.product || si.id);
        const qty = toNumber(si.quantity_sold || si.quantity || si.qty || 1);
        if (itemId) {
          soldByItem[itemId] = (soldByItem[itemId] || 0) + qty;
        }
      });
    });

    const restockedByItem = {};
    const purchaseCostByItem = {};
    const purchaseQtyByItem = {};

    filteredPurchases.forEach((p) => {
      const pItems = p.items || p.purchase_items || [p];
      pItems.forEach((pi) => {
        const itemId = String(pi.item || pi.item_id || pi.product || pi.id);
        const qty = toNumber(pi.quantity || pi.qty || 0);
        const cost = toNumber(pi.unit_cost_price || pi.unit_cost || pi.cost_price || 0);

        if (itemId) {
          restockedByItem[itemId] = (restockedByItem[itemId] || 0) + qty;
          purchaseCostByItem[itemId] = (purchaseCostByItem[itemId] || 0) + qty * cost;
          purchaseQtyByItem[itemId] = (purchaseQtyByItem[itemId] || 0) + qty;
        }
      });
    });

    return catalogList.map((row) => {
      const itemIdStr = String(row.id);
      const currentStock = row.remaining_stock;
      const sold = soldByItem[itemIdStr] || 0;
      const restocked = restockedByItem[itemIdStr] || 0;

      const openingStock = row.opening_stock > 0
        ? row.opening_stock
        : Math.max(0, currentStock + sold - restocked);

      const costPrice = row.current_cost_price;
      const retailPrice = row.unit_selling_price;

      const totalPurchaseCost = purchaseCostByItem[itemIdStr] || 0;
      const totalPurchaseQty = purchaseQtyByItem[itemIdStr] || 0;

      let wac = costPrice;
      if (totalPurchaseQty > 0) {
        wac = (totalPurchaseCost + currentStock * costPrice) / (totalPurchaseQty + currentStock);
      }

      return {
        id: row.id,
        name: row.name,
        sku: row.sku,
        openingStock,
        restocked,
        sold,
        currentStock,
        costPrice,
        wac,
        retailPrice,
      };
    });
  }, [catalogList, sales, purchases, effectiveStartDate, effectiveEndDate]);

  const filteredStockData = useMemo(() => {
    if (!searchTerm.trim()) return stockControlData;
    const term = searchTerm.toLowerCase();
    return stockControlData.filter(
      (row) => row.name.toLowerCase().includes(term) || row.sku.toLowerCase().includes(term)
    );
  }, [stockControlData, searchTerm]);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-6 font-sans">
      
      {/* SECTION HEADER WITH BRANCH SELECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
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

        <div className="flex flex-wrap items-center gap-3">
          {/* BRANCH SELECTION DROPDOWN */}
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-xl">
            <label className="text-[10px] font-bold text-slate-600 uppercase">Select Branch:</label>
            <select
              value={branchKey}
              onChange={handleBranchChange}
              className="bg-transparent text-slate-900 text-xs font-bold outline-none cursor-pointer"
            >
              {branches.length > 0 ? (
                branches.map((b) => (
                  <option key={b.id || b.code} value={b.id || b.code}>
                    {b.name || b.branch_name}
                  </option>
                ))
              ) : (
                <option value={branchKey}>{branchKey ? `Branch #${branchKey}` : 'All Branches'}</option>
              )}
            </select>
          </div>

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