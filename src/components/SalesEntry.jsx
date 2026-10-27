// src/components/SalesEntry.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import API from '../api';
import { useBranch } from '../components/BranchContext';

export default function SalesEntry({
  items = [],
  selectedBranch: propBranch,
  onSalesSubmitted,
}) {
  const { selectedBranch: contextBranch } = useBranch();
  const activeBranch = propBranch || contextBranch;

  // Search & Item Picker State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState(null);
  const [inputQty, setInputQty] = useState('');
  const [inputDiscount, setInputDiscount] = useState('');

  // Cart State: Array of { item, quantity, discount }
  const [cart, setCart] = useState([]);

  // Payment Options (CREDIT REMOVED)
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [splitPayments, setSplitPayments] = useState({
    cash: '',
    paybill: '',
    paybill_ref: '',
    send_money: '',
    send_money_ref: '',
  });

  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [saleDate, setSaleDate] = useState(getLocalDateString());
  const [customerInfo, setCustomerInfo] = useState({ name: '', invoice_number: '', notes: '' });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  // Management Request Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState('DISCOUNT_APPROVAL');
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

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

  const buildSaleDateTime = (dateString) => {
    if (!dateString) return new Date().toISOString();
    const localDate = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(localDate.getTime())) return new Date().toISOString();
    return localDate.toISOString();
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
      setStatus({ type: 'error', text: 'Please enter a valid quantity sold.' });
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

    // Reset picker
    setSelectedCatalogItem(null);
    setInputQty('');
    setInputDiscount('');
  };

  const handleRemoveFromCart = (itemId) => {
    setCart((prevCart) => prevCart.filter((c) => getItemId(c.item) !== itemId));
  };

  const handleUpdateCartQty = (itemId, newQty) => {
    setCart((prevCart) =>
      prevCart.map((c) => {
        if (getItemId(c.item) !== itemId) return c;
        const qty = Math.max(0, parseFloat(newQty) || 0);
        return { ...c, quantity: qty };
      })
    );
  };

  const handleUpdateCartDiscount = (itemId, newDiscount) => {
    setCart((prevCart) =>
      prevCart.map((c) => {
        if (getItemId(c.item) !== itemId) return c;
        const discount = Math.max(0, parseFloat(newDiscount) || 0);
        return { ...c, discount };
      })
    );
  };

  /* ================= TOTAL CALCULATIONS ================= */

  const grandTotalAmount = useMemo(() => {
    return cart.reduce((sum, entry) => {
      const price = getItemRetailPrice(entry.item);
      const effPrice = Math.max(0, price - entry.discount);
      return sum + toMoney(entry.quantity * effPrice);
    }, 0);
  }, [cart]);

  const splitTotalAmount = useMemo(() => {
    const cash = toMoney(splitPayments.cash);
    const paybill = toMoney(splitPayments.paybill);
    const sendMoney = toMoney(splitPayments.send_money);
    return toMoney(cash + paybill + sendMoney);
  }, [splitPayments]);

  const remainingBalance = toMoney(grandTotalAmount - splitTotalAmount);

  const handleSplitChange = (field, value) => {
    setSplitPayments((prev) => ({ ...prev, [field]: value }));
  };

  /* ================= SUBMIT TRANSACTION ================= */

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setStatus(null);

    if (!activeBranch) {
      setStatus({ type: 'error', text: 'Please select a retail branch.' });
      setLoading(false);
      return;
    }

    const branchId =
      typeof activeBranch === 'object' && activeBranch !== null
        ? activeBranch.id ?? activeBranch.pk ?? activeBranch.value
        : activeBranch;

    if (cart.length === 0) {
      setStatus({ type: 'error', text: 'Cart is empty. Please search and add items first.' });
      setLoading(false);
      return;
    }

    if (grandTotalAmount <= 0) {
      setStatus({ type: 'error', text: 'Total sale valuation must be greater than KSh 0.00.' });
      setLoading(false);
      return;
    }

    if (paymentMethod === 'SPLIT') {
      if (splitTotalAmount <= 0) {
        setStatus({ type: 'error', text: 'Please allocate split payment amounts.' });
        setLoading(false);
        return;
      }
      if (Math.abs(remainingBalance) > 0.01) {
        setStatus({
          type: 'error',
          text: `Split total (KSh ${splitTotalAmount.toFixed(2)}) must equal Grand Total (KSh ${grandTotalAmount.toFixed(2)}).`,
        });
        setLoading(false);
        return;
      }
    }

    const paybillAmount = toPositiveNumber(splitPayments.paybill);
    const sendMoneyAmount = toPositiveNumber(splitPayments.send_money);

    if (paymentMethod === 'PAYBILL' || (paymentMethod === 'SPLIT' && paybillAmount > 0)) {
      if (!String(splitPayments.paybill_ref || '').trim()) {
        setStatus({ type: 'error', text: 'Paybill reference code is required.' });
        setLoading(false);
        return;
      }
    }

    if (paymentMethod === 'SEND_MONEY' || (paymentMethod === 'SPLIT' && sendMoneyAmount > 0)) {
      if (!String(splitPayments.send_money_ref || '').trim()) {
        setStatus({ type: 'error', text: 'Send Money reference code is required.' });
        setLoading(false);
        return;
      }
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

    const payments = [];
    if (paymentMethod === 'SPLIT') {
      const cashAmount = toPositiveNumber(splitPayments.cash);
      if (cashAmount > 0) payments.push({ method: 'CASH', amount: toMoney(cashAmount).toFixed(2) });
      if (paybillAmount > 0) {
        payments.push({
          method: 'PAYBILL',
          amount: toMoney(paybillAmount).toFixed(2),
          reference_code: String(splitPayments.paybill_ref || '').trim().toUpperCase(),
        });
      }
      if (sendMoneyAmount > 0) {
        payments.push({
          method: 'SEND_MONEY',
          amount: toMoney(sendMoneyAmount).toFixed(2),
          reference_code: String(splitPayments.send_money_ref || '').trim().toUpperCase(),
        });
      }
    } else {
      const payment = {
        method: paymentMethod.toUpperCase(),
        amount: toMoney(grandTotalAmount).toFixed(2),
      };
      if (paymentMethod === 'PAYBILL') {
        payment.reference_code = String(splitPayments.paybill_ref || '').trim().toUpperCase();
      }
      if (paymentMethod === 'SEND_MONEY') {
        payment.reference_code = String(splitPayments.send_money_ref || '').trim().toUpperCase();
      }
      payments.push(payment);
    }

    const checkoutPayload = {
      branch: branchId,
      payment_method: paymentMethod.toUpperCase(),
      customer_name: customerInfo.name,
      invoice_number: customerInfo.invoice_number,
      sale_date: buildSaleDateTime(saleDate),
      total_amount: toMoney(grandTotalAmount).toFixed(2),
      items: cartItems,
      payments,
    };

    try {
      const res = await API.post('sales/', checkoutPayload);
      setStatus({
        type: 'success',
        text: `Sale recorded successfully for ${cart.length} item(s)!`,
      });

      // Reset
      setCart([]);
      setSelectedCatalogItem(null);
      setSearchTerm('');
      setCustomerInfo({ name: '', invoice_number: '', notes: '' });
      setSplitPayments({ cash: '', paybill: '', paybill_ref: '', send_money: '', send_money_ref: '' });
      setPaymentMethod('CASH');

      if (onSalesSubmitted) onSalesSubmitted(res?.data);
    } catch (err) {
      console.error('Failed to submit sale:', err);
      const msg = err?.response?.data?.detail || err?.message || 'Failed to submit sale.';
      setStatus({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  /* ================= MANAGEMENT REQUEST ================= */

  const handleSendManagementRequest = async (e) => {
    e.preventDefault();
    if (!requestMessage.trim()) return;
    setSendingRequest(true);

    try {
      await API.post('pending-approvals/', {
        request_type: requestType,
        payload: {
          branch_id: activeBranch,
          message: requestMessage,
          cart_summary: cart.map((c) => ({
            name: c.item.name,
            quantity: c.quantity,
            discount: c.discount,
          })),
          total_amount: grandTotalAmount,
        },
      });
      setStatus({ type: 'success', text: 'Request sent to Management successfully!' });
      setShowRequestModal(false);
      setRequestMessage('');
    } catch (err) {
      setStatus({ type: 'error', text: 'Failed to send approval request.' });
    } finally {
      setSendingRequest(false);
    }
  };

  // Payment Options (CREDIT REMOVED)
  const paymentOptions = [
    { id: 'CASH', label: 'CASH' },
    { id: 'PAYBILL', label: 'PAYBILL' },
    { id: 'SEND_MONEY', label: 'SEND MONEY' },
    { id: 'SPLIT', label: 'Split Payment' },
  ];

  return (
    <div className="max-w-7xl mx-auto font-sans space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Record Daily Cash Sales</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Search items from catalog, specify quantity & discounts, then submit sales receipt.
          </p>
        </div>

        {/* Styled Payment Selector (No Credit) */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
          <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Payment:</span>
          {paymentOptions.map((opt) => {
            const isActive = paymentMethod === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPaymentMethod(opt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600">Date:</label>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-teal-500"
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

      {/* Main POS 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT 7 COLS: SEARCH & ITEM PICKER */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="space-y-2 relative">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Search Catalog Item
            </label>
            <input
              type="text"
              placeholder="Type item name or code to search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
            />

            {/* Live Search Dropdown */}
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

          {/* Selected Item Config Box */}
          {selectedCatalogItem ? (
            <div className="bg-slate-50 border border-teal-200 rounded-2xl p-4 space-y-4 animate-in fade-in duration-150">
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
                    Quantity Sold
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={getItemStock(selectedCatalogItem)}
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
                  Item Total: KSh{' '}
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
                  className="bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer shadow-xs"
                >
                  + Add to Sale
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs">
              Search and pick an item above to add to current transaction.
            </div>
          )}

          {/* Reference fields for M-Pesa */}
          {paymentMethod === 'PAYBILL' && (
            <div className="space-y-1 pt-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">
                Paybill M-Pesa Reference Code *
              </label>
              <input
                type="text"
                placeholder="e.g. QX12345678"
                value={splitPayments.paybill_ref}
                onChange={(e) => handleSplitChange('paybill_ref', e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono uppercase font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          )}

          {paymentMethod === 'SEND_MONEY' && (
            <div className="space-y-1 pt-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">
                Send Money M-Pesa Reference Code *
              </label>
              <input
                type="text"
                placeholder="e.g. QX12345678"
                value={splitPayments.send_money_ref}
                onChange={(e) => handleSplitChange('send_money_ref', e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono uppercase font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          )}

          {/* Split payment inputs */}
          {paymentMethod === 'SPLIT' && (
            <div className="p-4 bg-teal-50/60 rounded-2xl border border-teal-200 space-y-3">
              <span className="text-xs font-bold text-teal-900 uppercase block">Split Breakdown</span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Cash (KSh)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={splitPayments.cash}
                    onChange={(e) => handleSplitChange('cash', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Paybill (KSh)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={splitPayments.paybill}
                    onChange={(e) => handleSplitChange('paybill', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Send Money</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={splitPayments.send_money}
                    onChange={(e) => handleSplitChange('send_money', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT 5 COLS: CART & GRAND TOTAL */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Current Sale Items ({cart.length})
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Cart List */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-mono">
                  No items added to cart yet.
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
                          <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => handleUpdateCartQty(id, e.target.value)}
                            className="w-14 bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-center"
                          />
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

          {/* Grand Total & Checkout */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Payable Amount
                </span>
                <span className="text-2xl font-black font-mono text-teal-700">
                  KSh {grandTotalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowRequestModal(true)}
                className="w-1/3 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[11px] rounded-xl transition cursor-pointer"
              >
                📩 Request
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || cart.length === 0 || grandTotalAmount <= 0}
                className="w-2/3 py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-extrabold text-xs rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Processing...' : 'Submit Sale'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* REQUEST MANAGEMENT MODAL */}
      {showRequestModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-slate-800 relative z-[100000]">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  Send Request to Management
                </h3>
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSendManagementRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Request Category
                  </label>
                  <select
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 font-semibold outline-none"
                  >
                    <option value="DISCOUNT_APPROVAL">Discount Approval</option>
                    <option value="STOCK_OVERRIDE">Stock Limit Override</option>
                    <option value="PRICE_QUERY">Unit Price Query</option>
                    <option value="OTHER">Other Query</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Details / Reason *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Customer requests custom discount..."
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 placeholder:text-slate-400 outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="w-1/2 px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingRequest}
                    className="w-1/2 px-4 py-2 bg-teal-700 text-white rounded-xl text-xs font-bold hover:bg-teal-600 transition cursor-pointer"
                  >
                    {sendingRequest ? 'Sending...' : 'Send Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}