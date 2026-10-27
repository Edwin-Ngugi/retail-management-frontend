// src/components/CreditSalesEntry.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import API from '../api';
import { useBranch } from './BranchContext';

export default function CreditSalesEntry({
  items = [],
  selectedBranch: propBranch,
  onCreditSaleSubmitted,
}) {
  const { selectedBranch: contextBranch } = useBranch();
  const activeBranch = propBranch || contextBranch;

  // Customer State
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [isAddingNewCustomer, setIsAddingNewCustomer] = useState(false);

  // Transaction Details
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [saleDate, setSaleDate] = useState(getLocalDateString());

  // Item Picker & Cart
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState(null);
  const [inputQty, setInputQty] = useState('');
  const [inputDiscount, setInputDiscount] = useState('');
  const [cart, setCart] = useState([]);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  /* ================= FETCH CUSTOMERS ================= */
  const fetchCustomers = useCallback(async () => {
    if (!activeBranch) return;
    setLoadingCustomers(true);
    try {
      const res = await API.get(`customers/?branch=${encodeURIComponent(activeBranch)}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setCustomers(data);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoadingCustomers(false);
    }
  }, [activeBranch]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

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

  const toMoney = (value) => {
    const number = parseFloat(value);
    if (!Number.isFinite(number)) return 0;
    return Math.round((number + Number.EPSILON) * 100) / 100;
  };

  const toPositiveNumber = (value) => {
    const number = parseFloat(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return number;
  };

  /* ================= SEARCH FILTERING ================= */
  const filteredCatalogItems = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return (items || []).filter((item) => {
      const name = String(item?.name || '').toLowerCase();
      const code = String(item?.code || item?.item_code || '').toLowerCase();
      return name.includes(term) || code.includes(term);
    });
  }, [items, searchTerm]);

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
    const qty = toPositiveNumber(inputQty);
    const discount = Math.max(0, parseFloat(inputDiscount) || 0);
    const stock = getItemStock(selectedCatalogItem);
    const retailPrice = getItemRetailPrice(selectedCatalogItem);

    if (qty <= 0) {
      setStatus({ type: 'error', text: 'Please enter a valid quantity.' });
      return;
    }

    if (qty > stock) {
      setStatus({
        type: 'error',
        text: `Quantity (${qty}) exceeds available stock (${stock}).`,
      });
      return;
    }

    if (discount > retailPrice) {
      setStatus({
        type: 'error',
        text: `Discount cannot exceed retail price of KSh ${retailPrice.toFixed(2)}.`,
      });
      return;
    }

    setStatus(null);

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

  const grandTotalAmount = useMemo(() => {
    return cart.reduce((sum, entry) => {
      const price = getItemRetailPrice(entry.item);
      const effective = Math.max(0, price - entry.discount);
      return sum + toMoney(entry.quantity * effective);
    }, 0);
  }, [cart]);

  /* ================= SUBMISSION ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setStatus(null);

    if (!activeBranch) {
      setStatus({ type: 'error', text: 'Please select a branch first.' });
      return;
    }

    if (!invoiceNumber.trim()) {
      setStatus({ type: 'error', text: 'Invoice Number is required for credit sales.' });
      return;
    }

    if (!isAddingNewCustomer && !selectedCustomerId) {
      setStatus({ type: 'error', text: 'Please select a customer or add a new customer.' });
      return;
    }

    if (isAddingNewCustomer && !newCustomerName.trim()) {
      setStatus({ type: 'error', text: 'Please enter the new customer name.' });
      return;
    }

    if (cart.length === 0) {
      setStatus({ type: 'error', text: 'Cart is empty. Please search and add items to credit sale.' });
      return;
    }

    setSubmitting(true);

    try {
      let customerVal = selectedCustomerId;

      // Handle Quick-Add Customer
      if (isAddingNewCustomer) {
        const custRes = await API.post('customers/', {
          branch: activeBranch,
          name: newCustomerName.trim(),
          phone_number: newCustomerPhone.trim(),
        });
        customerVal = custRes.data?.id || newCustomerName.trim();
      }

      const cartItems = cart.map(({ item, quantity, discount }) => {
        const retailPrice = getItemRetailPrice(item);
        return {
          item: getItemId(item),
          quantity_sold: toMoney(quantity),
          unit_selling_price: toMoney(retailPrice).toFixed(2),
          discount_per_item: toMoney(discount).toFixed(2),
          total_amount: toMoney(quantity * (retailPrice - discount)).toFixed(2),
        };
      });

      const payload = {
        branch: activeBranch,
        payment_method: 'CREDIT',
        customer: customerVal,
        customer_name: isAddingNewCustomer ? newCustomerName.trim() : undefined,
        invoice_number: invoiceNumber.trim(),
        due_date: dueDate || null,
        notes: notes.trim(),
        sale_date: saleDate,
        total_amount: toMoney(grandTotalAmount).toFixed(2),
        items: cartItems,
        payments: [
          {
            method: 'CREDIT',
            amount: toMoney(grandTotalAmount).toFixed(2),
          },
        ],
      };

      const res = await API.post('sales/', payload);

      setStatus({
        type: 'success',
        text: `Credit Sale (Invoice #${invoiceNumber}) recorded successfully!`,
      });

      // Reset Form
      setCart([]);
      setInvoiceNumber('');
      setDueDate('');
      setNotes('');
      setSelectedCustomerId('');
      setNewCustomerName('');
      setNewCustomerPhone('');
      setIsAddingNewCustomer(false);

      if (onCreditSaleSubmitted) onCreditSaleSubmitted(res.data);
    } catch (err) {
      console.error('Failed to submit credit sale:', err);
      const errMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Failed to process credit sale transaction.';
      setStatus({ type: 'error', text: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto font-sans space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Record Credit Sale</h1>
            <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
              Accounts Receivable
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Issue credit invoices to verified customers and track debtor balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600">Sale Date:</label>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {status && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold border ${
            status.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {status.text}
        </div>
      )}

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT 7 COLS: CUSTOMER & ITEM PICKER */}
        <div className="lg:col-span-7 space-y-6">
          {/* Customer & Invoice Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
              Customer & Debt Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Invoice Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-089"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Payment Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Customer Picker / Quick-Add */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">
                  Customer / Debtor <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingNewCustomer(!isAddingNewCustomer)}
                  className="text-[11px] font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
                >
                  {isAddingNewCustomer ? '← Select Existing' : '+ New Customer'}
                </button>
              </div>

              {!isAddingNewCustomer ? (
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  disabled={loadingCustomers}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone_number ? `(${c.phone_number})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded-2xl border border-amber-200">
                  <input
                    type="text"
                    placeholder="Customer Name *"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold"
                  />
                  <input
                    type="text"
                    placeholder="Phone Number"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-semibold"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Credit Notes / Agreement Terms
              </label>
              <input
                type="text"
                placeholder="e.g. Payable within 30 days upon receipt"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Item Search Picker */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
              Select Stock Items
            </h2>

            <div className="space-y-2 relative">
              <input
                type="text"
                placeholder="Type item name or code to search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
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
                          className="w-full p-3 text-left hover:bg-amber-50 flex justify-between items-center transition cursor-pointer"
                        >
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">{item.name}</span>
                            <span className="text-[10px] text-slate-400">
                              Code: {item.code || 'N/A'} | Stock: {stock}
                            </span>
                          </div>
                          <span className="text-xs font-mono font-bold text-amber-800">
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
              <div className="bg-slate-50 border border-amber-200 rounded-2xl p-4 space-y-4">
                <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{selectedCatalogItem.name}</h3>
                    <div className="flex gap-2 mt-1">
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                        In Stock: {getItemStock(selectedCatalogItem)}
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
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={getItemStock(selectedCatalogItem)}
                      value={inputQty}
                      onChange={(e) => setInputQty(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
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
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-xs font-bold font-mono text-amber-800">
                    Subtotal: KSh{' '}
                    {(
                      toPositiveNumber(inputQty) *
                      Math.max(
                        0,
                        getItemRetailPrice(selectedCatalogItem) - (parseFloat(inputDiscount) || 0)
                      )
                    ).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer shadow-xs"
                  >
                    + Add to Invoice
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs">
                Search and pick an item above to add to this credit sale.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT 5 COLS: CART & SUMMARY */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Credit Invoice Items ({cart.length})
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

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs font-mono">
                  No items added to invoice yet.
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
                  Total Credit Amount
                </span>
                <span className="text-2xl font-black font-mono text-amber-600">
                  KSh {grandTotalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || cart.length === 0 || grandTotalAmount <= 0}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Processing Invoice...' : 'Submit Credit Sale'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}