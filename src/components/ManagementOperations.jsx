// src/components/ManagementOperations.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import API from '../api';

const money = (value) => `KSh ${(Number(value) || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number = (value) => (Number(value) || 0).toLocaleString('en-KE', { maximumFractionDigits: 3 });
const rowsFrom = (data) => Array.isArray(data) ? data : data?.results || data?.entries || data?.data || [];
const valueOf = (obj, keys, fallback = '') => {
  for (const key of keys) {
    const value = key.split('.').reduce((v, part) => v?.[part], obj);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
};

const PURCHASE_TYPES = new Set(['PURCHASE', 'ADJUSTMENT_IN', 'OPENING_STOCK']);

const SECTIONS = {
  inventory: {
    title: 'Inventory & Stock Control', subtitle: 'Review branch stock levels, pricing, and stock movement activity.', icon: '',
    sources: [
      { key: 'movements', label: 'Stock movements', endpoint: 'stock-movements/', params: true },
    ],
  },
  purchasing: {
    title: 'Purchases & Restock', subtitle: 'Monitor purchase, restock, and stock adjustment in records.', icon: '',
    sources: [
      { 
        key: 'purchases', 
        label: 'Purchases', 
        endpoint: 'stock-movements/', 
        params: true,
        filter: (row) => PURCHASE_TYPES.has(String(row.movement_type || '').toUpperCase())
      },
    ],
  },
  credit: {
    title: 'Customer Credit & Repayments', subtitle: 'Review repayments by the recorded repayment date and payment method.', icon: '',
    sources: [
      { key: 'repayments', label: 'Credit repayments', endpoint: 'credit-repayments/', params: true },
      { 
        key: 'sales', 
        label: 'Credit invoices', 
        endpoint: 'sales/', 
        params: true,
        filter: (row) => String(row.payment_method || '').toUpperCase() === 'CREDIT' || Boolean(row.is_invoice) || Number(row.balance_due || 0) > 0
      },
      { key: 'customers', label: 'Customers', endpoint: 'customers/', params: false },
    ],
  },
  returns: {
    title: 'Returns & Stock Losses', subtitle: 'Review customer returns, supplier returns, and inventory adjustments.', icon: '↩',
    sources: [
      { key: 'customerReturns', label: 'Customer returns', endpoint: 'customer-returns/', params: true },
      { key: 'supplierReturns', label: 'Supplier returns', endpoint: 'supplier-returns/', params: true },
      { key: 'movements', label: 'Stock movements', endpoint: 'stock-movements/', params: true },
    ],
  },
  branches: {
    title: 'Branch Performance', subtitle: 'Compare branch records where supported by the available APIs.', icon: '',
    sources: [
      { key: 'branches', label: 'Branches', endpoint: 'branches/', params: false },
      { key: 'cashbook', label: 'Cashbook', endpoint: 'cashbook/', params: true },
    ],
  },
};

const columnsFor = (section, key) => {
  const commonDate = { label: 'Date', keys: ['date', 'created_at', 'purchase_date', 'sale_date', 'updated_at'] };
  const maps = {
    items: [
      { label: 'Item', keys: ['item_detail.name', 'item_name', 'item.name', 'name', 'title'], fallback: 'Unknown' },
      { label: 'Branch', keys: ['branch_name', 'branch.name', 'branch_detail.name'] },
      { label: 'Available stock', keys: ['remaining_stock', 'current_stock', 'stock_quantity', 'quantity', 'stock'], numeric: true },
      { label: 'Opening stock', keys: ['opening_stock', 'branch_pricing.opening_stock'], numeric: true },
      { label: 'Cost / unit', keys: ['unit_cost_price', 'cost_price', 'branch_pricing.unit_cost_price'], money: true },
      { label: 'Selling price', keys: ['unit_selling_price', 'selling_price', 'unit_retail_price', 'retail_price', 'branch_pricing.unit_selling_price'], money: true },
    ],
    movements: [
      commonDate,
      { label: 'Item', keys: ['item_detail.name', 'item_name', 'item.name', 'name', 'title'], fallback: '—' },
      { label: 'Movement', keys: ['movement_type', 'type'] },
      { label: 'Quantity', keys: ['quantity'], numeric: true },
      { label: 'Unit Cost', keys: ['unit_cost_price', 'unit_cost'], money: true },
      { label: 'Reference', keys: ['reference', 'notes'] }
    ],
    purchases: [
      commonDate,
      { label: 'Item', keys: ['item_detail.name', 'item_name', 'item.name', 'title'], fallback: 'Unnamed item' },
      { label: 'Movement Type', keys: ['movement_type'] },
      { label: 'Reference / Notes', keys: ['reference', 'notes', 'supplier_name', 'supplier.name'], fallback: 'Restock / Purchase' },
      { label: 'Quantity', keys: ['quantity'], numeric: true },
      { label: 'Unit Cost', keys: ['unit_cost_price', 'unit_cost'], money: true },
      { label: 'Total Cost', keys: ['total_cost', 'total_amount', 'amount'], money: true }
    ],
    repayments: [
      { label: 'Repayment Date', keys: ['date', 'created_at'] },
      { label: 'Customer', keys: ['customer_detail.name', 'customer_name', 'customer.name', 'customer'], fallback: 'Walk-in / Direct' },
      { 
        label: 'Invoice Ref', 
        keys: [
          'transaction_detail.invoice_number',
          'transaction.invoice_number',
          'invoice_number',
          'transaction_detail.receipt_number',
          'transaction.receipt_number',
          'receipt_number',
          'transaction'
        ], 
        fallback: '—' 
      },
      { label: 'Payment Method', keys: ['payment_method', 'method'] },
      { label: 'Amount Received', keys: ['amount'], money: true },
      { label: 'Notes', keys: ['notes', 'reference'] }
    ],
    sales: [
      commonDate,
      { label: 'Invoice / Receipt', keys: ['invoice_number', 'receipt_number', 'id'] },
      { label: 'Customer', keys: ['customer_detail.name', 'customer_name', 'customer.name', 'customer'], fallback: 'Walk-in Customer' },
      { label: 'Payment Method', keys: ['payment_method'] },
      { label: 'Total Amount', keys: ['total_amount', 'total_selling_price'], money: true },
      { label: 'Balance Due', keys: ['balance_due', 'outstanding_balance'], money: true },
      { label: 'Status', keys: ['invoice_status', 'is_paid'], boolean: true }
    ],
    customers: [
      { label: 'Customer', keys: ['name', 'customer_name'] },
      { label: 'Customer ID', keys: ['customer_id', 'id'] },
      { label: 'Phone', keys: ['phone_number', 'phone'] },
      { label: 'Total Debt', keys: ['total_outstanding_balance', 'debt_balance', 'outstanding_balance'], money: true }
    ],
    customerReturns: [
      commonDate,
      { label: 'Item', keys: ['item_detail.name', 'item_name', 'item.name', 'name'] },
      { label: 'Quantity Returned', keys: ['quantity'], numeric: true },
      { label: 'Reason', keys: ['reason'] },
      { label: 'Recorded By', keys: ['created_by_name', 'created_by.username'] }
    ],
    supplierReturns: [
      commonDate,
      { label: 'Item', keys: ['item_detail.name', 'item_name', 'item.name', 'name'] },
      { label: 'Supplier', keys: ['supplier_name', 'supplier.name'] },
      { label: 'Quantity Returned', keys: ['quantity'], numeric: true },
      { label: 'Reason', keys: ['reason'] }
    ],
    branches: [
      { label: 'Branch Name', keys: ['name', 'branch_name'] },
      { label: 'Location', keys: ['location'] },
      { label: 'Created At', keys: ['created_at'] }
    ],
    cashbook: [
      commonDate,
      { label: 'Description', keys: ['description', 'category', 'title', 'reference'] },
      { label: 'Entry Type', keys: ['type', 'entry_type', 'transaction_type'] },
      { label: 'Method', keys: ['payment_method', 'method'] },
      { label: 'Amount', keys: ['amount', 'total'], money: true }
    ],
  };
  return maps[key] || [{ label: 'Record', keys: ['name', 'description', 'id'] }, commonDate];
};

export default function ManagementOperations({
  selectedBranch,
  initialSection = 'inventory',
  periodType = 'month',
  selectedDate,
  selectedMonth,
  selectedYear,
  onBack,
}) {
  const [section, setSection] = useState(SECTIONS[initialSection] ? initialSection : 'inventory');
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [search, setSearch] = useState('');
  const [activeSource, setActiveSource] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const config = SECTIONS[section];

  const loadSection = useCallback(async () => {
    setLoading(true);
    setErrors({});
    const nextRecords = {};
    const nextErrors = {};
    await Promise.all(config.sources.map(async (source) => {
      try {
        const params = {};
        if (source.params && selectedBranch) params.branch = selectedBranch;
        
        // Pass Period Date parameters
        if (periodType) params.period_type = periodType;
        if (periodType === 'day' && selectedDate) params.date = selectedDate;
        if (periodType === 'month') {
          if (selectedMonth) params.month = selectedMonth;
          if (selectedYear) params.year = selectedYear;
        }
        if (periodType === 'year' && selectedYear) params.year = selectedYear;

        let response;
        try {
          response = await API.get(source.endpoint, { params });
        } catch (err) {
          if (source.endpoint === 'sales/') {
            response = await API.get('sale-transactions/', { params });
          } else {
            throw err;
          }
        }

        let rawRows = rowsFrom(response.data);
        
        if (source.filter && typeof source.filter === 'function') {
          rawRows = rawRows.filter(source.filter);
        }

        // Additional date filtering on client side
        if (periodType && source.key !== 'customers' && source.key !== 'branches') {
          rawRows = rawRows.filter((row) => {
            const rawDate = valueOf(row, ['date', 'created_at', 'purchase_date', 'sale_date', 'updated_at']);
            if (!rawDate) return true;
            const d = new Date(rawDate);
            if (isNaN(d.getTime())) return true;

            if (periodType === 'day' && selectedDate) {
              return d.toISOString().split('T')[0] === selectedDate;
            }
            if (periodType === 'month') {
              return (d.getMonth() + 1) === Number(selectedMonth) && d.getFullYear() === Number(selectedYear);
            }
            if (periodType === 'year') {
              return d.getFullYear() === Number(selectedYear);
            }
            return true;
          });
        }
        
        nextRecords[source.key] = rawRows;
      } catch (error) {
        nextRecords[source.key] = [];
        nextErrors[source.key] = error.response?.data?.detail || error.response?.data?.error || error.message || 'Could not load data.';
      }
    }));
    setRecords(nextRecords);
    setErrors(nextErrors);
    setLastUpdated(new Date());
    setLoading(false);
    const first = config.sources.find((source) => nextRecords[source.key]?.length || nextErrors[source.key]);
    setActiveSource((current) => config.sources.some((source) => source.key === current) ? current : (first?.key || config.sources[0]?.key));
  }, [config, selectedBranch, periodType, selectedDate, selectedMonth, selectedYear]);

  useEffect(() => { loadSection(); }, [loadSection]);
  useEffect(() => { setSearch(''); setActiveSource(''); }, [section]);

  const source = config.sources.find((item) => item.key === activeSource) || config.sources[0];
  const allRows = records[source?.key] || [];
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return allRows;
    return allRows.filter((row) => JSON.stringify(row).toLowerCase().includes(query));
  }, [allRows, search]);

  const totalFor = (rows, keys) => (rows || []).reduce((sum, row) => {
    const directCost = Number(valueOf(row, keys, 0));
    if (directCost) return sum + directCost;
    const qty = Number(valueOf(row, ['quantity'], 0));
    const cost = Number(valueOf(row, ['unit_cost_price', 'unit_cost'], 0));
    return sum + (qty * cost);
  }, 0);

  const summaryCards = useMemo(() => {
    if (section === 'inventory') {
      return [
        { label: 'Movements Recorded', value: number((records.movements || []).length) }
      ];
    }
    if (section === 'purchasing') {
      const purchaseList = records.purchases || [];
      return [
        { label: 'Purchase Records', value: number(purchaseList.length) },
        { label: 'Total Purchase Value', value: money(totalFor(purchaseList, ['total_cost', 'total_amount', 'amount'])) },
      ];
    }
    if (section === 'credit') {
      return [
        { label: 'Repayments Logged', value: number((records.repayments || []).length) },
        { label: 'Repayments Collected', value: money((records.repayments || []).reduce((sum, row) => sum + (Number(valueOf(row, ['amount'], 0)) || 0), 0)) },
        { label: 'Credit Invoices', value: number((records.sales || []).length) }
      ];
    }
    if (section === 'returns') {
      return [
        { label: 'Customer Returns', value: number((records.customerReturns || []).length) },
        { label: 'Supplier Returns', value: number((records.supplierReturns || []).length) },
        { label: 'Adjustment Movements', value: number((records.movements || []).length) }
      ];
    }
    return [
      { label: 'Branches Available', value: number((records.branches || []).length) },
      { label: 'Cashbook Records', value: number((records.cashbook || []).length) },
      { label: 'Cashbook Volume', value: money((records.cashbook || []).reduce((sum, row) => sum + (Number(valueOf(row, ['amount', 'total'], 0)) || 0), 0)) }
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, records]);

  const exportCsv = () => {
    const cols = columnsFor(section, source.key);
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.map((col) => escape(col.label)).join(','), ...filteredRows.map((row) => cols.map((col) => escape(valueOf(row, col.keys, col.fallback || ''))).join(','))];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `management-${section}-${source.key}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = columnsFor(section, source.key);

  return (
    <section className="space-y-5" aria-label="Management operations">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden="true">{config.icon}</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600">Management Operations</p>
            <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">{config.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">{config.subtitle}</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {onBack && (
            <button type="button" onClick={onBack} className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer">
              ← Overview
            </button>
          )}
          <button type="button" onClick={loadSection} disabled={loading} className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer">
            {loading ? 'Refreshing…' : '↻ Refresh Data'}
          </button>
        </div>
      </div>

      {/* Section Selector Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {Object.entries(SECTIONS).map(([key, item]) => (
          <button
            type="button"
            key={key}
            onClick={() => setSection(key)}
            className={`text-left rounded-xl border p-3.5 transition cursor-pointer ${
              section === key
                ? 'border-indigo-500 bg-indigo-50/80 ring-1 ring-indigo-200'
                : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/50'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className={`block mt-1 text-[11px] font-bold ${section === key ? 'text-indigo-900' : 'text-slate-700'}`}>
              {item.title}
            </span>
          </button>
        ))}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{card.label}</p>
            <p className="mt-2 text-xl font-extrabold text-slate-900 tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      {/* API Error Notification */}
      {Object.keys(errors).length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4">
          <p className="text-xs font-bold text-amber-900">Some operational data could not be fetched</p>
          <p className="text-[11px] text-amber-800 mt-0.5">
            Check permissions or endpoint configuration. Other connected sections remain fully functional.
          </p>
          <ul className="mt-2 space-y-1">
            {Object.entries(errors).map(([key, error]) => (
              <li key={key} className="text-[11px] text-amber-800">
                <strong>{config.sources.find((s) => s.key === key)?.label || key}:</strong> {String(error)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Records Table Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Operational Records</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {selectedBranch ? `Filtered by Branch: ${selectedBranch}` : 'All Branches'}
                {lastUpdated ? ` · Updated ${lastUpdated.toLocaleTimeString()}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                aria-label="Search records"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search records…"
                className="min-w-0 w-48 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-600 focus:bg-white transition"
              />
              <button
                type="button"
                onClick={exportCsv}
                disabled={!filteredRows.length}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
              >
                Export CSV
              </button>
            </div>
          </div>

          {config.sources.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {config.sources.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => setActiveSource(item.key)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                    source.key === item.key
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {item.label} <span className="ml-1 opacity-70">({records[item.key]?.length ?? 0})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading records from server…</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No records found</p>
            <p className="text-xs text-slate-500 mt-1">There are no matching entries recorded for this view in the selected scope.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider">
                <tr>
                  {columns.map((col) => (
                    <th key={col.label} className="px-4 py-3 font-bold">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {filteredRows.map((row, index) => (
                  <tr key={row.id ?? row.pk ?? `${source.key}-${index}`} className="hover:bg-slate-50/80 transition">
                    {columns.map((col) => {
                      let value = valueOf(row, col.keys, col.fallback || '—');
                      
                      if (col.label === 'Total Cost' && (value === '—' || !value)) {
                        const qty = Number(valueOf(row, ['quantity'], 0));
                        const cost = Number(valueOf(row, ['unit_cost_price', 'unit_cost'], 0));
                        value = qty * cost;
                      }

                      const display = col.money
                        ? money(value)
                        : col.numeric
                        ? number(value)
                        : col.boolean
                        ? (value === true || String(value).toUpperCase() === 'PAID' ? '✅ Paid / Active' : '⚠️ Pending / Unpaid')
                        : (col.label.toLowerCase().includes('date') && value ? String(value).replace('T', ' ').slice(0, 19) : String(value));
                      return <td key={col.label} className="px-4 py-3">{display}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 bg-slate-50/50">
          <p className="text-[10px] font-semibold text-slate-500">Showing {filteredRows.length} of {allRows.length} records</p>
          <p className="text-[10px] text-slate-400">Live Backend View</p>
        </div>
      </div>
    </section>
  );
}