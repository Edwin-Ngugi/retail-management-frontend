import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import API from '../api';
import { useBranch } from '../components/BranchContext';

export default function SalesEntry({
  items,
  selectedBranch: propBranch,
  onSalesSubmitted,
}) {
  const { selectedBranch: contextBranch } = useBranch();
  const activeBranch = propBranch || contextBranch;

  const [salesData, setSalesData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  const [splitPayments, setSplitPayments] = useState({
    cash: '',
    paybill: '',
    paybill_ref: '',
    send_money: '',
    send_money_ref: '',
    credit: '',
  });

  /*
   * LOCAL DATE HELPER
   */
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [saleDate, setSaleDate] = useState(getLocalDateString());

  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    invoice_number: '',
    notes: '',
    id: null,
  });

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  /*
   * MANAGEMENT REQUEST STATE
   */
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState('DISCOUNT_APPROVAL');
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  /*
   * HELPERS
   */
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

  const getItemCostPrice = (item) => {
    if (!item) return 0;
    const value = item.unit_cost_price ?? item.cost_price ?? item.unit_cost ?? 0;
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

  /*
   * INITIALIZE SALES DATA
   */
  useEffect(() => {
    if (!items || !Array.isArray(items)) return;

    setSalesData((prev) => {
      const nextState = {};
      items.forEach((item) => {
        const itemId = getItemId(item);
        if (itemId === null || itemId === undefined) return;
        nextState[itemId] = {
          discount_per_item: prev[itemId]?.discount_per_item ?? '',
          quantity_sold: prev[itemId]?.quantity_sold ?? 0,
        };
      });
      return nextState;
    });
  }, [items]);

  /*
   * INPUT HANDLING
   */
  const handleChange = (itemId, field, value) => {
    let val;
    if (value === '') {
      val = '';
    } else {
      const parsed = parseFloat(value);
      val = !Number.isFinite(parsed) ? 0 : Math.max(0, parsed);
    }

    setSalesData((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { discount_per_item: '', quantity_sold: 0 }),
        [field]: val,
      },
    }));
  };

  const handleSplitChange = (field, value) => {
    setSplitPayments((prev) => ({ ...prev, [field]: value }));
  };

  /*
   * TOTAL CALCULATIONS
   */
  const calculateItemTotal = (item, itemState) => {
    if (!itemState) return 0;
    const quantity = toPositiveNumber(itemState.quantity_sold);
    const retailPrice = getItemRetailPrice(item);
    const discount = Math.max(0, parseFloat(itemState.discount_per_item) || 0);
    const effectivePrice = Math.max(0, retailPrice - discount);
    return toMoney(quantity * effectivePrice);
  };

  const calculateGrandTotal = () => {
    if (!items || !Array.isArray(items) || items.length === 0) return 0;
    const total = items.reduce((sum, item) => {
      const itemId = getItemId(item);
      if (itemId === null || itemId === undefined) return sum;
      return sum + calculateItemTotal(item, salesData[itemId]);
    }, 0);
    return toMoney(total);
  };

  const grandTotalAmount = calculateGrandTotal();

  const calculateSplitTotal = () => {
    const cash = toMoney(splitPayments.cash);
    const paybill = toMoney(splitPayments.paybill);
    const sendMoney = toMoney(splitPayments.send_money);
    const credit = toMoney(splitPayments.credit);
    return toMoney(cash + paybill + sendMoney + credit);
  };

  const splitTotalAmount = calculateSplitTotal();
  const remainingBalance = toMoney(grandTotalAmount - splitTotalAmount);

  const isCreditRequired =
    paymentMethod === 'CREDIT' ||
    (paymentMethod === 'SPLIT' && toPositiveNumber(splitPayments.credit) > 0);

  const filteredItems = (items || []).filter((item) =>
    String(item?.name || '')
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  /*
   * ERROR PARSER
   */
  const parseBackendError = (err) => {
    if (!err?.response?.data) return err?.message || 'Failed to submit sales records.';
    const data = err.response.data;
    if (typeof data === 'string') return data;
    if (data.detail && typeof data.detail === 'string') return data.detail;

    const extractValue = (value) => {
      if (Array.isArray(value)) return value.map(extractValue).filter(Boolean).join(', ');
      if (typeof value === 'object' && value !== null) {
        return Object.entries(value)
          .map(([key, val]) => {
            const extracted = extractValue(val);
            return extracted ? `${key}: ${extracted}` : '';
          })
          .filter(Boolean)
          .join(', ');
      }
      return value === null || value === undefined ? '' : String(value);
    };

    if (typeof data === 'object' && data !== null) {
      const parsedErrors = [];
      Object.entries(data).forEach(([key, value]) => {
        const formattedVal = extractValue(value);
        if (!formattedVal) return;
        const numericKey = Number(key);
        const isNumericIndex = !Number.isNaN(numericKey) && String(Math.floor(numericKey)) === key;
        const keyLabel = isNumericIndex ? `Item ${numericKey + 1}` : key;
        parsedErrors.push(`${keyLabel}: ${formattedVal}`);
      });
      if (parsedErrors.length > 0) return parsedErrors.join(' | ');
    }

    return 'Failed to submit sales records.';
  };

  /*
   * SEND REQUEST TO MANAGEMENT
   */
  const handleSendManagementRequest = async (e) => {
    e.preventDefault();
    if (!requestMessage.trim()) return;

    setSendingRequest(true);

    const branchId =
      typeof activeBranch === 'object' && activeBranch !== null
        ? activeBranch.id ?? activeBranch.pk ?? activeBranch.value
        : activeBranch;

    const currentCartSummary = (items || [])
      .map((item) => {
        const itemId = getItemId(item);
        const state = salesData[itemId];
        if (!state || parseFloat(state.quantity_sold) <= 0) return null;
        return {
          item_id: itemId,
          name: item.name,
          quantity: state.quantity_sold,
          discount: state.discount_per_item || 0,
        };
      })
      .filter(Boolean);

    const payload = {
      request_type: requestType,
      payload: {
        branch_id: branchId,
        message: requestMessage,
        cart_summary: currentCartSummary,
        total_amount: grandTotalAmount,
      },
    };

    try {
      await API.post('pending-approvals/', payload);
      setStatus({
        type: 'success',
        text: 'Request sent to Management successfully!',
      });
      setShowRequestModal(false);
      setRequestMessage('');
    } catch (err) {
      console.error('Failed to send management request:', err);
      setStatus({
        type: 'error',
        text: parseBackendError(err),
      });
    } finally {
      setSendingRequest(false);
    }
  };

  /*
   * SUBMIT SALE
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setStatus(null);

    if (!activeBranch) {
      setStatus({ type: 'error', text: 'Please select a retail branch before submitting transactions.' });
      setLoading(false);
      return;
    }

    const branchId =
      typeof activeBranch === 'object' && activeBranch !== null
        ? activeBranch.id ?? activeBranch.pk ?? activeBranch.value
        : activeBranch;

    if (branchId === null || branchId === undefined || branchId === '') {
      setStatus({ type: 'error', text: 'The selected branch does not have a valid branch ID.' });
      setLoading(false);
      return;
    }

    const selectedItems = (items || [])
      .map((item) => {
        const itemId = getItemId(item);
        if (itemId === null || itemId === undefined) return null;
        const state = salesData[itemId] || { discount_per_item: '', quantity_sold: 0 };
        const quantity = parseFloat(state.quantity_sold) || 0;
        if (quantity <= 0) return null;

        return {
          itemId,
          item,
          quantity,
          retailPrice: getItemRetailPrice(item),
          discount: Math.max(0, parseFloat(state.discount_per_item) || 0),
          stock: getItemStock(item),
        };
      })
      .filter(Boolean);

    if (selectedItems.length === 0) {
      setStatus({ type: 'error', text: 'Please enter a quantity sold (> 0) for at least one item.' });
      setLoading(false);
      return;
    }

    for (const selected of selectedItems) {
      if (selected.quantity > selected.stock) {
        setStatus({
          type: 'error',
          text: `Quantity for "${selected.item.name}" exceeds remaining stock (${selected.stock} available).`,
        });
        setLoading(false);
        return;
      }
      if (selected.discount > selected.retailPrice) {
        setStatus({
          type: 'error',
          text: `Discount for "${selected.item.name}" cannot exceed retail price of KSh ${selected.retailPrice.toFixed(2)}.`,
        });
        setLoading(false);
        return;
      }
    }

    const cartItems = selectedItems.map(({ itemId, quantity, retailPrice, discount }) => ({
      item: itemId,
      quantity_sold: toMoney(quantity),
      unit_selling_price: toMoney(retailPrice).toFixed(2),
      discount_per_item: toMoney(discount).toFixed(2),
      total_amount: toMoney(quantity * (retailPrice - discount)).toFixed(2),
    }));

    if (grandTotalAmount <= 0) {
      setStatus({ type: 'error', text: 'The sale total must be greater than KSh 0.00.' });
      setLoading(false);
      return;
    }

    if (paymentMethod === 'SPLIT') {
      if (splitTotalAmount <= 0) {
        setStatus({ type: 'error', text: 'Please allocate at least one payment amount.' });
        setLoading(false);
        return;
      }
      if (Math.abs(remainingBalance) > 0.01) {
        setStatus({
          type: 'error',
          text: `Split payments total (KSh ${splitTotalAmount.toFixed(2)}) must equal Grand Total (KSh ${grandTotalAmount.toFixed(2)}). Remaining: KSh ${remainingBalance.toFixed(2)}`,
        });
        setLoading(false);
        return;
      }
    }

    const paybillAmount = toPositiveNumber(splitPayments.paybill);
    const sendMoneyAmount = toPositiveNumber(splitPayments.send_money);

    if (paymentMethod === 'PAYBILL' || (paymentMethod === 'SPLIT' && paybillAmount > 0)) {
      if (!String(splitPayments.paybill_ref || '').trim()) {
        setStatus({ type: 'error', text: 'Please enter the Paybill M-Pesa reference number.' });
        setLoading(false);
        return;
      }
    }

    if (paymentMethod === 'SEND_MONEY' || (paymentMethod === 'SPLIT' && sendMoneyAmount > 0)) {
      if (!String(splitPayments.send_money_ref || '').trim()) {
        setStatus({ type: 'error', text: 'Please enter the Send Money M-Pesa reference number.' });
        setLoading(false);
        return;
      }
    }

    const payments = [];

    if (paymentMethod === 'SPLIT') {
      const cashAmount = toPositiveNumber(splitPayments.cash);
      const creditAmount = toPositiveNumber(splitPayments.credit);

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
      if (creditAmount > 0) payments.push({ method: 'CREDIT', amount: toMoney(creditAmount).toFixed(2) });
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

    const customerVal = String(customerInfo.name || '').trim();

    const checkoutPayload = {
      branch: branchId,
      payment_method: paymentMethod.toUpperCase(),
      customer: customerInfo.id || customerVal || null,
      customer_name: customerVal,
      invoice_number: String(customerInfo.invoice_number || '').trim(),
      credit_notes: String(customerInfo.notes || '').trim(),
      sale_date: buildSaleDateTime(saleDate),
      total_amount: toMoney(grandTotalAmount).toFixed(2),
      items: cartItems,
      payments,
    };

    try {
      const response = await API.post('sales/', checkoutPayload);

      setStatus({
        type: 'success',
        text: `Sale recorded successfully! Single receipt generated for ${cartItems.length} item(s).`,
      });

      // Reset state
      setSalesData((prev) => {
        const reset = { ...prev };
        Object.keys(reset).forEach((id) => {
          reset[id] = { ...reset[id], quantity_sold: 0, discount_per_item: '' };
        });
        return reset;
      });

      setCustomerInfo({ name: '', invoice_number: '', notes: '', id: null });
      setSplitPayments({ cash: '', paybill: '', paybill_ref: '', send_money: '', send_money_ref: '', credit: '' });
      setPaymentMethod('CASH');
      setSaleDate(getLocalDateString());

      if (onSalesSubmitted) {
        onSalesSubmitted(response?.data);
      }
    } catch (err) {
      const msg = parseBackendError(err);
      setStatus({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  const paymentOptions = [
    { id: 'CASH', label: 'CASH' },
    { id: 'PAYBILL', label: 'PAYBILL' },
    { id: 'SEND_MONEY', label: 'SEND MONEY' },
    { id: 'CREDIT', label: 'CREDIT' },
    { id: 'SPLIT', label: 'Split Payment' },
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6 relative">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Record Daily Sales</h2>
          <p className="text-xs text-slate-500 mt-1">
            Apply discounts and specify quantities sold for inventory items for the selected branch.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search items by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ colorScheme: 'light' }}
            className="w-full px-3 py-2 bg-white !text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium [color-scheme:light]"
          />
        </div>
      </div>

      {status && (
        <div
          className={`p-4 rounded-lg border text-sm font-medium ${
            status.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          {status.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            
            {/* STYLED PAYMENT METHOD BUTTONS */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mr-2">
                Payment Method:
              </span>
              {paymentOptions.map((opt) => {
                const isActive = paymentMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentMethod(opt.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Sale Date:</label>
              <input
                type="date"
                required
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                style={{ colorScheme: 'light' }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium [color-scheme:light]"
              />
            </div>
          </div>

          {paymentMethod === 'PAYBILL' && (
            <div className="pt-2 border-t border-slate-200 flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Paybill Reference Code <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                required
                placeholder="e.g. QX12345678"
                value={splitPayments.paybill_ref}
                onChange={(e) => handleSplitChange('paybill_ref', e.target.value)}
                style={{ colorScheme: 'light' }}
                className="w-64 px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 placeholder:text-slate-400 font-mono uppercase focus:ring-2 focus:ring-indigo-500 outline-none [color-scheme:light]"
              />
            </div>
          )}

          {paymentMethod === 'SEND_MONEY' && (
            <div className="pt-2 border-t border-slate-200 flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Send Money Reference Code <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                required
                placeholder="e.g. QX12345678"
                value={splitPayments.send_money_ref}
                onChange={(e) => handleSplitChange('send_money_ref', e.target.value)}
                style={{ colorScheme: 'light' }}
                className="w-64 px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 placeholder:text-slate-400 font-mono uppercase focus:ring-2 focus:ring-indigo-500 outline-none [color-scheme:light]"
              />
            </div>
          )}

          {paymentMethod === 'SPLIT' && (
            <div className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-200 space-y-4 mt-2">
              <div className="flex flex-wrap justify-between items-center border-b border-indigo-200 pb-2">
                <span className="text-sm font-bold text-indigo-900">Split Payment Breakdown</span>
                <div className="flex gap-4 text-xs font-semibold">
                  <span className="text-slate-600">Total Due: <strong className="text-slate-900">KSh {grandTotalAmount.toFixed(2)}</strong></span>
                  <span className="text-slate-600">Allocated: <strong className="text-indigo-700">KSh {splitTotalAmount.toFixed(2)}</strong></span>
                  <span className={Math.abs(remainingBalance) <= 0.01 ? 'text-emerald-600' : 'text-rose-600'}>
                    Remaining: <strong>KSh {remainingBalance.toFixed(2)}</strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cash Amount (KSh)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={splitPayments.cash}
                    onChange={(e) => handleSplitChange('cash', e.target.value)}
                    style={{ colorScheme: 'light' }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold [color-scheme:light]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Paybill Amount (KSh)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={splitPayments.paybill}
                    onChange={(e) => handleSplitChange('paybill', e.target.value)}
                    style={{ colorScheme: 'light' }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold mb-1.5 [color-scheme:light]"
                  />
                  {parseFloat(splitPayments.paybill) > 0 && (
                    <input
                      type="text"
                      placeholder="M-Pesa Paybill Ref"
                      value={splitPayments.paybill_ref}
                      onChange={(e) => handleSplitChange('paybill_ref', e.target.value)}
                      style={{ colorScheme: 'light' }}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs bg-white !text-slate-900 placeholder:text-slate-400 font-mono uppercase focus:ring-2 focus:ring-indigo-500 outline-none [color-scheme:light]"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Send Money Amount (KSh)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={splitPayments.send_money}
                    onChange={(e) => handleSplitChange('send_money', e.target.value)}
                    style={{ colorScheme: 'light' }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold mb-1.5 [color-scheme:light]"
                  />
                  {parseFloat(splitPayments.send_money) > 0 && (
                    <input
                      type="text"
                      placeholder="M-Pesa Ref"
                      value={splitPayments.send_money_ref}
                      onChange={(e) => handleSplitChange('send_money_ref', e.target.value)}
                      style={{ colorScheme: 'light' }}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs bg-white !text-slate-900 placeholder:text-slate-400 font-mono uppercase focus:ring-2 focus:ring-indigo-500 outline-none [color-scheme:light]"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Credit Sale Amount (KSh)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={splitPayments.credit}
                    onChange={(e) => handleSplitChange('credit', e.target.value)}
                    style={{ colorScheme: 'light' }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold [color-scheme:light]"
                  />
                </div>
              </div>
            </div>
          )}

          {isCreditRequired && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Invoice Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required={isCreditRequired}
                  placeholder="e.g. INV-2026-001"
                  value={customerInfo.invoice_number}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, invoice_number: e.target.value })}
                  style={{ colorScheme: 'light' }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none font-mono [color-scheme:light]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Customer Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                  style={{ colorScheme: 'light' }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none [color-scheme:light]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Credit Notes / Due Date</label>
                <input
                  type="text"
                  placeholder="e.g. Pay by Friday"
                  value={customerInfo.notes}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, notes: e.target.value })}
                  style={{ colorScheme: 'light' }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none [color-scheme:light]"
                />
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 text-xs text-slate-500 uppercase font-semibold">
                <th className="p-3">Item Description</th>
                <th className="p-3">In Stock</th>
                <th className="p-3">Cost Price (KSh)</th>
                <th className="p-3">Retail Price (KSh)</th>
                <th className="p-3">Discount / Unit (KSh)</th>
                <th className="p-3">Qty Sold</th>
                <th className="p-3 text-right">Total Selling Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const itemId = getItemId(item);
                  const state = salesData[itemId] || { discount_per_item: '', quantity_sold: 0 };
                  const lineTotal = calculateItemTotal(item, state);
                  const costPrice = getItemCostPrice(item);
                  const retailPrice = getItemRetailPrice(item);
                  const stock = getItemStock(item);

                  return (
                    <tr
                      key={itemId}
                      className={state.quantity_sold > 0 ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : 'hover:bg-slate-50'}
                    >
                      <td className="p-3 font-medium text-slate-800">{item.name}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-md text-xs font-semibold ${
                            stock <= 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {stock}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-600">KSh {costPrice.toFixed(2)}</td>
                      <td className="p-3 font-semibold text-indigo-900">KSh {retailPrice.toFixed(2)}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={retailPrice}
                          placeholder="0"
                          value={state.discount_per_item}
                          onChange={(e) => handleChange(itemId, 'discount_per_item', e.target.value)}
                          style={{ colorScheme: 'light' }}
                          className="w-24 px-3 py-1.5 border border-slate-300 rounded-md text-sm bg-white !text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-right [color-scheme:light]"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          max={stock}
                          step="any"
                          value={state.quantity_sold}
                          onChange={(e) => handleChange(itemId, 'quantity_sold', e.target.value)}
                          style={{ colorScheme: 'light' }}
                          className="w-20 px-3 py-1.5 border border-slate-300 rounded-md text-sm bg-white !text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-center [color-scheme:light]"
                        />
                      </td>
                      <td className="p-3 text-right font-bold text-slate-800">KSh {lineTotal.toFixed(2)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-slate-400 font-medium">
                    {searchTerm ? `No items found matching "${searchTerm}".` : 'No items loaded for this branch.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setShowRequestModal(true);
            }}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span>📩 Request Management Approval</span>
          </button>

          <div className="flex items-center gap-6 ml-auto">
            <div className="text-right">
              <span className="text-xs text-slate-500 uppercase font-semibold block">Grand Total Amount</span>
              <span className="text-2xl font-extrabold text-indigo-600">KSh {grandTotalAmount.toFixed(2)}</span>
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                !items ||
                items.length === 0 ||
                !activeBranch ||
                grandTotalAmount <= 0 ||
                (paymentMethod === 'SPLIT' && Math.abs(remainingBalance) > 0.01)
              }
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Processing...' : 'Submit Transactions'}
            </button>
          </div>
        </div>
      </form>

      {/* REQUEST MANAGEMENT MODAL */}
      {showRequestModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-slate-800 relative z-[100000] animate-in fade-in zoom-in duration-150">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-base font-bold text-slate-900">
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
              <p className="text-xs text-slate-500 mb-4">
                Send a query or seek approval for discounts, custom pricing, or stock overrides.
              </p>

              <form onSubmit={handleSendManagementRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Request Category
                  </label>
                  <select
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="DISCOUNT_APPROVAL">Discount Approval</option>
                    <option value="STOCK_OVERRIDE">Stock Limit Override</option>
                    <option value="PRICE_QUERY">Unit Price Query</option>
                    <option value="CREDIT_APPROVAL">Credit Terms Approval</option>
                    <option value="OTHER">Other Query</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Message / Details <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Customer requests 15% discount on bulk purchase..."
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="w-1/2 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingRequest}
                    className="w-1/2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition cursor-pointer"
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