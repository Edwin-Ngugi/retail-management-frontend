import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const formatCurrency = (val) => {
  return `KSh ${toNumber(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export default function ReceiptsLogManagement({
  selectedBranch,
  onTransactionAdjusted,
  effectiveRange,
}) {
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'SALE' | 'RESTOCK'
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedTxId, setExpandedTxId] = useState(null);

  // Modal state for adjustments
  const [adjustModalTx, setAdjustModalTx] = useState(null);
  const [adjustNotes, setAdjustNotes] = useState('');
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const { effectiveStartDate, effectiveEndDate } = effectiveRange || {};

  const getRecordDateStr = (record) => {
    const rawDate =
      record?.sale_date ||
      record?.purchase_date ||
      record?.date ||
      record?.created_at ||
      record?.timestamp;

    if (!rawDate) return '';
    if (typeof rawDate === 'string') {
      return rawDate.split('T')[0];
    }
    try {
      return new Date(rawDate).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const fetchLogs = useCallback(async () => {
    if (!selectedBranch) return;
    setLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      const salesParams = new URLSearchParams({ branch: selectedBranch });
      const purchasesParams = new URLSearchParams({ branch: selectedBranch });
      const movementsParams = new URLSearchParams({ branch: selectedBranch });

      if (effectiveStartDate) {
        salesParams.append('sale_date__gte', `${effectiveStartDate}T00:00:00`);
        salesParams.append('start_date', effectiveStartDate);

        purchasesParams.append('purchase_date__gte', `${effectiveStartDate}T00:00:00`);
        purchasesParams.append('start_date', effectiveStartDate);

        movementsParams.append('start_date', effectiveStartDate);
      }

      if (effectiveEndDate) {
        salesParams.append('sale_date__lte', `${effectiveEndDate}T23:59:59`);
        salesParams.append('end_date', effectiveEndDate);

        purchasesParams.append('purchase_date__lte', `${effectiveEndDate}T23:59:59`);
        purchasesParams.append('end_date', effectiveEndDate);

        movementsParams.append('end_date', effectiveEndDate);
      }

      const [salesRes, purchasesRes, movementsRes] = await Promise.allSettled([
        API.get(`sales/?${salesParams.toString()}`),
        API.get(`purchases/?${purchasesParams.toString()}`),
        API.get(`stock-movements/activity-history/?${movementsParams.toString()}`),
      ]);

      const combined = [];

      // 1. Process Sales Receipts
      if (salesRes.status === 'fulfilled') {
        const sales = Array.isArray(salesRes.value?.data)
          ? salesRes.value.data
          : salesRes.value?.data?.results || [];

        const filteredSales = sales.filter((s) => {
          const recordDate = getRecordDateStr(s);
          if (!recordDate) return true;
          if (effectiveStartDate && recordDate < effectiveStartDate) return false;
          if (effectiveEndDate && recordDate > effectiveEndDate) return false;
          return true;
        });

        filteredSales.forEach((s) => {
          combined.push({
            uniqueId: `sale_${s.id}`,
            id: s.id,
            category: 'SALE',
            typeLabel: 'Sale Receipt',
            refNo: s.receipt_number || `REC-${s.id}`,
            date: s.sale_date || s.created_at,
            amount: toNumber(s.total_amount || s.amount),
            paymentMethod: s.payment_method || 'CASH',
            customerName: s.customer?.name || s.customer_name || 'Walk-in Customer',
            items: s.items || [],
            rawRecord: s,
          });
        });
      }

      // 2. Process Restocks / Purchase Orders
      if (purchasesRes.status === 'fulfilled') {
        const purchases = Array.isArray(purchasesRes.value?.data)
          ? purchasesRes.value.data
          : purchasesRes.value?.data?.results || [];

        const filteredPurchases = purchases.filter((p) => {
          const recordDate = getRecordDateStr(p);
          if (!recordDate) return true;
          if (effectiveStartDate && recordDate < effectiveStartDate) return false;
          if (effectiveEndDate && recordDate > effectiveEndDate) return false;
          return true;
        });

        filteredPurchases.forEach((p) => {
          combined.push({
            uniqueId: `purchase_${p.id}`,
            id: p.id,
            category: 'RESTOCK',
            typeLabel: 'Restock Purchase',
            refNo: `PUR-${p.id}`,
            date: p.purchase_date || p.created_at,
            amount: toNumber(p.total_cost || p.quantity * p.unit_cost_price),
            paymentMethod: p.payment_method || 'CASH',
            customerName: p.supplier_name || p.supplier?.name || 'Vendor',
            items: [
              {
                id: p.id,
                item_name: p.item_name || p.item?.name || 'Restock Item',
                quantity: p.quantity,
                unit_price: p.unit_cost_price,
              },
            ],
            rawRecord: p,
          });
        });
      }

      // 3. Process Stock Adjustments IN (Categorized under RESTOCK)
      if (movementsRes.status === 'fulfilled') {
        const movements = Array.isArray(movementsRes.value?.data)
          ? movementsRes.value.data
          : movementsRes.value?.data?.results || [];

        const filteredMovements = movements.filter((m) => {
          const recordDate = getRecordDateStr(m);
          if (!recordDate) return true;
          if (effectiveStartDate && recordDate < effectiveStartDate) return false;
          if (effectiveEndDate && recordDate > effectiveEndDate) return false;
          return true;
        });

        filteredMovements.forEach((m) => {
          const actType = (m.activity_type || m.movement_type_display || '').toUpperCase();

          // Exclude transfers and standard sales/purchases already covered
          if (actType.includes('TRANSFER') || actType.includes('PURCHASE') || actType.includes('SALE')) {
            return;
          }

          combined.push({
            uniqueId: `mvt_${m.id}`,
            id: m.id,
            category: 'RESTOCK',
            typeLabel: m.activity_type || 'Stock Adjustment In',
            refNo: m.reference || `ADJUST-${m.id}`,
            date: m.date || m.created_at,
            amount: toNumber(m.quantity * m.unit_cost_price),
            paymentMethod: 'N/A',
            customerName: m.target || m.notes || 'Inventory Ledger',
            items: [
              {
                id: m.id,
                item_name: m.item_name || m.item || 'Adjusted Item',
                quantity: m.quantity,
                unit_price: m.unit_cost_price,
              },
            ],
            rawRecord: m,
          });
        });
      }

      // Sort chronological descending
      combined.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(combined);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
      setFeedback({ type: 'error', message: 'Failed to load transaction logs.' });
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, effectiveStartDate, effectiveEndDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    if (filterType === 'ALL') return transactions;
    return transactions.filter((tx) => tx.category === filterType);
  }, [transactions, filterType]);

  const handleToggleExpand = (uniqueId) => {
    setExpandedTxId((prev) => (prev === uniqueId ? null : uniqueId));
  };

  const handleOpenAdjustmentModal = (tx) => {
    setAdjustModalTx(tx);
    setAdjustNotes('');
  };

  const handleSubmitAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustModalTx) return;

    setSubmittingAdjustment(true);
    try {
      const payload = {
        request_type: 'STOCK_OPERATION',
        payload: {
          target_branch: selectedBranch,
          branch_id: selectedBranch,
          transaction_id: adjustModalTx.id,
          category: adjustModalTx.category,
          reference: adjustModalTx.refNo,
          notes: adjustNotes,
          items: adjustModalTx.items,
        },
      };

      await API.post('pending-approvals/', payload);
      setFeedback({
        type: 'success',
        message: `Adjustment request for ${adjustModalTx.refNo} submitted to Management for sign-off!`,
      });
      setAdjustModalTx(null);
      if (onTransactionAdjusted) onTransactionAdjusted();
    } catch (err) {
      console.error('Failed to submit adjustment:', err);
      setFeedback({
        type: 'error',
        message: 'Failed to submit adjustment request.',
      });
    } finally {
      setSubmittingAdjustment(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        {/* Header & Category Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Receipts & Transaction Logs
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Inspect daily sales and restocks (including stock adjustments). Click any row to view item breakdowns or request adjustments.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            {[
              { id: 'ALL', label: 'All Logs' },
              { id: 'SALE', label: 'Sales Receipts' },
              { id: 'RESTOCK', label: 'Restocks' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  filterType === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {feedback.message && (
          <div
            className={`p-4 rounded-2xl text-xs font-semibold border ${
              feedback.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Transaction Table */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs animate-pulse">
            Loading activity logs for selected horizon...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            No transaction records found for this period.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((tx) => {
              const isExpanded = expandedTxId === tx.uniqueId;

              return (
                <div
                  key={tx.uniqueId}
                  className="bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-200/80 transition overflow-hidden"
                >
                  <div
                    onClick={() => handleToggleExpand(tx.uniqueId)}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                          tx.category === 'SALE'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-blue-100 text-blue-800 border-blue-300'
                        }`}
                      >
                        {tx.typeLabel}
                      </span>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 font-mono">
                          {tx.refNo}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          {tx.customerName} • {new Date(tx.date).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 justify-between sm:justify-end">
                      <div className="text-right">
                        <span className="text-xs font-extrabold font-mono text-slate-900 block">
                          {formatCurrency(tx.amount)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">
                          {tx.paymentMethod}
                        </span>
                      </div>
                      <span className="text-slate-400 font-bold text-xs">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Items Drawer */}
                  {isExpanded && (
                    <div className="bg-white p-4 border-t border-slate-200 space-y-4">
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Line Items ({tx.items.length})
                        </h4>
                        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                          {tx.items.map((line, idx) => (
                            <div
                              key={idx}
                              className="p-3 text-xs flex justify-between items-center bg-slate-50/50"
                            >
                              <div>
                                <span className="font-bold text-slate-800 block">
                                  {line.item_name || line.item?.name || 'Item'}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  Qty: {line.quantity} × {formatCurrency(line.unit_price || line.unit_selling_price || line.unit_cost_price)}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-slate-900">
                                {formatCurrency(
                                  toNumber(line.quantity) *
                                    toNumber(line.unit_price || line.unit_selling_price || line.unit_cost_price)
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAdjustmentModal(tx);
                          }}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition cursor-pointer shadow-sm"
                        >
                          ✏️ Request Transaction Adjustment
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Adjustment Modal */}
      {adjustModalTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Adjust Transaction: {adjustModalTx.refNo}
            </h3>
            <p className="text-xs text-slate-500">
              Submitting an adjustment sends a sign-off request to Management before altering live ledgers.
            </p>

            <form onSubmit={handleSubmitAdjustment} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">
                  Reason / Adjustment Notes
                </label>
                <textarea
                  rows="3"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="State reason (e.g. incorrect quantity entered, customer returned item)..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalTx(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjustment}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {submittingAdjustment ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}