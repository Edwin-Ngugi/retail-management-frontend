// src/components/QuotationsManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../api';

const toNumber = (val) => (Number.isFinite(Number(val)) ? Number(val) : 0);
const formatCurrency = (val) =>
  `KSh ${toNumber(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function QuotationsManagement({
  items = [],
  selectedBranch,
  onQuotationConverted,
}) {
  const [quotationDate, setQuotationDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [expiryDate, setExpiryDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');

  // Item Picker & Cart
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState(null);
  const [inputQty, setInputQty] = useState('');
  const [inputDiscount, setInputDiscount] = useState('');
  const [cart, setCart] = useState([]);

  // Form & History State
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [quotationsList, setQuotationsList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState(null);

  const safeItems = Array.isArray(items) ? items : [];

  /* ================= HELPERS ================= */
  const getItemId = (item) => {
    if (!item) return null;
    if (typeof item.id === 'object' && item.id !== null) {
      return item.id.id ?? item.id.pk ?? item.id.value ?? null;
    }
    return item.id ?? item.pk ?? null;
  };

  const getItemRetailPrice = (item) => {
    if (!item) return 0;
    const value =
      item.unit_retail_price ??
      item.unit_price ??
      item.selling_price ??
      item.unit_selling_price ??
      item.retail_price ??
      item.price ??
      0;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getItemStock = (item) => {
    if (!item) return 0;
    const value =
      item.remaining_stock ??
      item.current_stock ??
      item.stock ??
      item.quantity_in_stock ??
      0;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  /* ================= FETCH HISTORY ================= */
  const fetchQuotationsHistory = useCallback(async () => {
    if (!selectedBranch) return;
    setLoadingHistory(true);
    try {
      const res = await API.get(`quotations/?branch=${encodeURIComponent(selectedBranch)}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setQuotationsList(data);
    } catch (err) {
      console.error('Failed to fetch quotations:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchQuotationsHistory();
  }, [fetchQuotationsHistory]);

  /* ================= SEARCH FILTERING ================= */
  const filteredCatalogItems = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return safeItems.filter((item) => {
      const name = String(item?.name || '').toLowerCase();
      const code = String(item?.code || item?.item_code || '').toLowerCase();
      return name.includes(term) || code.includes(term);
    });
  }, [safeItems, searchTerm]);

  /* ================= CART MANAGEMENT ================= */
  const handleSelectItem = (item) => {
    setSelectedCatalogItem(item);
    setSearchTerm('');
    setInputQty('1');
    setInputDiscount('');
  };

  const handleAddToCart = () => {
    if (!selectedCatalogItem) return;
    const itemId = getItemId(selectedCatalogItem);
    const qty = toNumber(inputQty);
    const discount = Math.max(0, parseFloat(inputDiscount) || 0);
    const retailPrice = getItemRetailPrice(selectedCatalogItem);

    if (qty <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid quantity.' });
      return;
    }

    if (discount > retailPrice) {
      setFeedback({
        type: 'error',
        message: `Discount cannot exceed retail price of KSh ${retailPrice.toFixed(2)}.`,
      });
      return;
    }

    setFeedback({ type: '', message: '' });

    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex((c) => getItemId(c.item) === itemId);
      if (existingIdx >= 0) {
        const updated = [...prevCart];
        updated[existingIdx] = {
          item: selectedCatalogItem,
          quantity: qty,
          discount,
        };
        return updated;
      }
      return [...prevCart, { item: selectedCatalogItem, quantity: qty, discount }];
    });

    setSelectedCatalogItem(null);
    setInputQty('');
    setInputDiscount('');
  };

  const handleRemoveFromCart = (itemId) => {
    setCart((prevCart) => prevCart.filter((c) => getItemId(c.item) !== itemId));
  };

  const grandTotalValuation = useMemo(() => {
    return cart.reduce((sum, entry) => {
      const price = getItemRetailPrice(entry.item);
      const effectivePrice = Math.max(0, price - entry.discount);
      return sum + entry.quantity * effectivePrice;
    }, 0);
  }, [cart]);

  /* ================= SUBMIT QUOTATION ================= */
  const handleSubmitQuotation = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });

    if (!selectedBranch) {
      setFeedback({ type: 'error', message: 'Please select a branch first.' });
      return;
    }

    if (!customerName.trim()) {
      setFeedback({ type: 'error', message: 'Customer Name is required.' });
      return;
    }

    if (cart.length === 0) {
      setFeedback({ type: 'error', message: 'Please add at least one item to the quotation.' });
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        branch: selectedBranch,
        quotation_date: quotationDate,
        expiry_date: expiryDate || null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim(),
        notes: notes.trim(),
        total_amount: grandTotalValuation.toFixed(2),
        items: cart.map(({ item, quantity, discount }) => {
          const retailPrice = getItemRetailPrice(item);
          return {
            item: getItemId(item),
            quantity: quantity,
            unit_price: retailPrice.toFixed(2),
            discount: discount.toFixed(2),
            total_amount: (quantity * (retailPrice - discount)).toFixed(2),
          };
        }),
      };

      await API.post('quotations/', payload);

      setFeedback({
        type: 'success',
        message: 'Quotation generated successfully!',
      });

      // Reset
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setNotes('');
      setExpiryDate('');
      setCart([]);

      fetchQuotationsHistory();
    } catch (err) {
      console.error('Failed to create quotation:', err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to generate quotation. Please try again.';
      setFeedback({ type: 'error', message: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  /* ================= CONVERT TO SALE ================= */
  const handleConvertQuotationToSale = async (quotation) => {
    if (!quotation) return;
    try {
      await API.post(`quotations/${quotation.id}/convert-to-sale/`);
      setFeedback({
        type: 'success',
        message: `Quotation #QT-${quotation.id} converted into an active sale transaction!`,
      });
      setSelectedQuotation(null);
      fetchQuotationsHistory();
      if (onQuotationConverted) onQuotationConverted();
    } catch (err) {
      console.error('Failed to convert quotation:', err);
      const msg = err?.response?.data?.detail || 'Failed to convert quotation to sale.';
      setFeedback({ type: 'error', message: msg });
    }
  };

  return (
    <div className="max-w-7xl mx-auto font-sans space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Quotations & Proforma Invoices</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Prepare formal price estimates for prospective buyers and convert them to sales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600">Quotation Date:</label>
          <input
            type="date"
            value={quotationDate}
            onChange={(e) => setQuotationDate(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {feedback.message && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold border ${
            feedback.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT 7 COLS: FORM & ITEM SEARCH */}
        <div className="lg:col-span-7 space-y-6">
          {/* Customer Details Form */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
              Client & Expiry Info
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Customer / Organization Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apex Hardware Ltd"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Valid Until / Expiry Date
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. +254 712 345 678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. procurement@apex.co.ke"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Terms / Quotation Notes
              </label>
              <textarea
                rows="2"
                placeholder="Specify delivery timeline, tax inclusion, or payment terms..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Item Search Picker */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
              Select Quotation Items
            </h2>

            <div className="space-y-2 relative">
              <input
                type="text"
                placeholder="Type item name or code to search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
              />

              {searchTerm.trim().length > 0 && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {filteredCatalogItems.length > 0 ? (
                    filteredCatalogItems.map((item) => {
                      const stock = getItemStock(item);
                      const retail = getItemRetailPrice(item);

                      return (
                        <button
                          key={getItemId(item)}
                          type="button"
                          onClick={() => handleSelectItem(item)}
                          className="w-full p-3 text-left hover:bg-teal-50 flex justify-between items-center transition cursor-pointer"
                        >
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">{item.name}</span>
                            <span className="text-[10px] text-slate-400">
                              Code: {item.code || 'N/A'} | Stock: {stock}
                            </span>
                          </div>
                          <span className="text-xs font-mono font-bold text-teal-800">
                            KSh {retail.toFixed(2)}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-4 text-xs text-slate-400 text-center font-mono">
                      No matching items found.
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedCatalogItem ? (
              <div className="bg-slate-50 border border-teal-200 rounded-2xl p-4 space-y-4">
                <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{selectedCatalogItem.name}</h3>
                    <div className="flex gap-2 mt-1">
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                        Stock: {getItemStock(selectedCatalogItem)}
                      </span>
                      <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                        Retail: KSh {getItemRetailPrice(selectedCatalogItem).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCatalogItem(null)}
                    className="text-xs text-slate-400 hover:text-rose-600 font-bold"
                  >
                    ✕ Clear
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Quoted Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={inputQty}
                      onChange={(e) => setInputQty(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Discount / Unit (KSh)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={inputDiscount}
                      onChange={(e) => setInputDiscount(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-xs font-bold font-mono text-teal-800">
                    Line Total: KSh{' '}
                    {(
                      toNumber(inputQty) *
                      Math.max(
                        0,
                        getItemRetailPrice(selectedCatalogItem) - (parseFloat(inputDiscount) || 0)
                      )
                    ).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer shadow-xs"
                  >
                    + Add to Quote
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs">
                Search and select an item above to add to this quotation.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT 5 COLS: CART SUMMARY & HISTORY */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Quotation Items ({cart.length})
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-mono">
                  No items added to quotation yet.
                </div>
              ) : (
                cart.map(({ item, quantity, discount }) => {
                  const id = getItemId(item);
                  const retailPrice = getItemRetailPrice(item);
                  const effective = Math.max(0, retailPrice - discount);
                  const lineTotal = quantity * effective;

                  return (
                    <div
                      key={id}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-slate-800 truncate block">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-mono font-bold text-slate-600">
                            Qty: {quantity}
                          </span>
                          <span className="text-[10px] text-slate-400">× KSh {effective.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1">
                        <span className="text-xs font-extrabold font-mono text-slate-900">
                          KSh {lineTotal.toFixed(2)}
                        </span>
                        <button
                          onClick={() => handleRemoveFromCart(id)}
                          className="text-[10px] text-slate-400 hover:text-rose-600 font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Quoted Amount
                </span>
                <span className="text-2xl font-black font-mono text-teal-700">
                  {formatCurrency(grandTotalValuation)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmitQuotation}
              disabled={submitting || cart.length === 0 || grandTotalValuation <= 0}
              className="w-full py-3 bg-teal-700 hover:bg-teal-600 text-white font-extrabold text-xs rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Generating Quotation...' : 'Save & Issue Quotation'}
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: RECENT QUOTATIONS HISTORY TABLE */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
            Generated Quotations Ledger
          </h2>
          <button
            onClick={fetchQuotationsHistory}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer"
          >
            🔄 Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">
                <th className="p-3">Ref / Date</th>
                <th className="p-3">Client Name</th>
                <th className="p-3">Expiry Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Total Amount</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loadingHistory ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400 font-mono">
                    Loading quotations history...
                  </td>
                </tr>
              ) : quotationsList.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400">
                    No quotations generated for this branch yet.
                  </td>
                </tr>
              ) : (
                quotationsList.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <span className="font-mono font-bold text-teal-800 block">
                        QT-#{q.id}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {q.quotation_date ? new Date(q.quotation_date).toLocaleDateString() : 'N/A'}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-800">
                      {q.customer_name || 'Client'}
                    </td>
                    <td className="p-3 font-mono text-slate-600">
                      {q.expiry_date ? new Date(q.expiry_date).toLocaleDateString() : 'No Limit'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          q.status === 'CONVERTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {q.status || 'PENDING'}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-teal-900">
                      {formatCurrency(q.total_amount)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setSelectedQuotation(q)}
                        className="bg-slate-100 hover:bg-teal-50 text-teal-800 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INSPECT / CONVERT MODAL */}
      {selectedQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 text-slate-800 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-teal-600 uppercase block">Proforma Inspection</span>
                <h3 className="text-lg font-black font-mono text-slate-900">
                  QT-#{selectedQuotation.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedQuotation(null)}
                className="text-slate-400 hover:text-rose-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Client</span>
                <span className="font-semibold text-slate-800">{selectedQuotation.customer_name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                <span className="font-bold text-teal-800 uppercase">{selectedQuotation.status || 'PENDING'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Quoted Line Items</span>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50 rounded-2xl border border-slate-200 p-2 text-xs">
                {(selectedQuotation.items || []).map((line, idx) => (
                  <div key={idx} className="py-2 flex justify-between items-center px-2">
                    <div>
                      <span className="font-semibold text-slate-800 block">{line.item_name || `Item #${line.item}`}</span>
                      <span className="text-[10px] text-slate-400">
                        Qty: {line.quantity} × {formatCurrency(line.unit_price)}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      {formatCurrency(line.total_amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Valuation</span>
                <span className="text-xl font-extrabold font-mono text-teal-800">
                  {formatCurrency(selectedQuotation.total_amount)}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  🖨️ Print Quote
                </button>
                {selectedQuotation.status !== 'CONVERTED' && (
                  <button
                    onClick={() => handleConvertQuotationToSale(selectedQuotation)}
                    className="bg-teal-700 hover:bg-teal-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Convert to Sale
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}