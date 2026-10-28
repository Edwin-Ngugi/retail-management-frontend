// src/components/CreditSalesManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import API from "../api";

export default function CreditSalesManagement({ selectedBranch, effectiveRange, onTransactionComplete }) {
  const [sales, setSales] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [repaymentDate, setRepaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [splitBreakdown, setSplitBreakdown] = useState({
    cash: 0,
    paybill: 0,
    send_money: 0,
  });
  const [referenceNumber, setReferenceNumber] = useState("");
  const [receiptNumberInput, setReceiptNumberInput] = useState("");
  const [notes, setNotes] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Helper to resolve receipt / invoice number across backend payload variations
  const getReceiptNumber = (sale) => {
    if (!sale) return "";
    return (
      sale.receipt_number ||
      sale.invoice_number ||
      sale.invoice_no ||
      sale.invoice ||
      sale.customer_invoice_number ||
      ""
    );
  };

  // Helper to safely resolve customer ID across all possible model structures
  const getCustomerId = (sale) => {
    if (!sale) return null;

    if (typeof sale.customer === "object" && sale.customer !== null) {
      return sale.customer.id || sale.customer.pk || null;
    }

    const candidateId =
      sale.customer ||
      sale.customer_id ||
      sale.client ||
      sale.client_id;

    if (candidateId !== undefined && candidateId !== null && candidateId !== "") {
      const parsed = Number(candidateId);
      return !isNaN(parsed) ? parsed : null;
    }

    return null;
  };

  // Fetch Credit Sales
  const fetchCreditSales = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranch) {
        params.append("branch", selectedBranch);
      }

      if (effectiveRange?.effectiveStartDate) {
        params.append("startDate", effectiveRange.effectiveStartDate);
      }
      if (effectiveRange?.effectiveEndDate) {
        params.append("endDate", effectiveRange.effectiveEndDate);
      }

      const response = await API.get(`sales/?${params.toString()}`);
      
      const data = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.results)
        ? response.data.results
        : [];

      setSales(data);
    } catch (error) {
      console.error("Error fetching credit sales:", error);
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, effectiveRange]);

  // Fetch Credit Repayments Log
  const fetchCreditRepayments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedBranch) {
        params.append("branch", selectedBranch);
      }

      if (effectiveRange?.effectiveStartDate) {
        params.append("startDate", effectiveRange.effectiveStartDate);
        params.append("date", effectiveRange.effectiveStartDate);
      }
      if (effectiveRange?.effectiveEndDate) {
        params.append("endDate", effectiveRange.effectiveEndDate);
      }

      const endpoint = `credit-repayments/?${params.toString()}`;
      const response = await API.get(endpoint);
      
      const data = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.results)
        ? response.data.results
        : [];

      setRepayments(data);
    } catch (error) {
      console.error("Error fetching credit repayments:", error);
      setRepayments([]);
    }
  }, [selectedBranch, effectiveRange]);

  useEffect(() => {
    fetchCreditSales();
    fetchCreditRepayments();
  }, [fetchCreditSales, fetchCreditRepayments]);

  // Filter sales ONLY when a search term is actively entered by the user
  const filteredSales = useMemo(() => {
    if (!Array.isArray(sales)) return [];
    const term = searchTerm.toLowerCase().trim();
    if (!term) return []; // Hide table list by default until user searches

    return sales.filter((sale) => {
      const balance = Number(sale.balance_due ?? sale.due_balance ?? 0);
      const isPaid = sale.payment_status === "PAID" || balance <= 0;
      if (isPaid) return false;

      const customer = String(sale.customer_name || "").toLowerCase();
      const saleId = String(sale.id || "");
      const receiptNum = String(getReceiptNumber(sale)).toLowerCase();
      return (
        customer.includes(term) ||
        saleId.includes(term) ||
        receiptNum.includes(term)
      );
    });
  }, [sales, searchTerm]);

  // Overall calculations across all pending credit sales
  const creditTotals = useMemo(() => {
    const pendingSales = (Array.isArray(sales) ? sales : []).filter((sale) => {
      const balance = Number(sale.balance_due ?? sale.due_balance ?? 0);
      return sale.payment_status !== "PAID" && balance > 0;
    });

    const totalAmount = pendingSales.reduce((acc, sale) => {
      return acc + Number(sale.total_amount || 0);
    }, 0);

    const totalBalanceDue = pendingSales.reduce((acc, sale) => {
      return acc + Number(sale.balance_due ?? sale.due_balance ?? 0);
    }, 0);

    const totalRecovered = (Array.isArray(repayments) ? repayments : []).reduce(
      (acc, rep) => acc + Number(rep.amount || rep.amount_paid || 0),
      0
    );

    return {
      totalAmount,
      totalBalanceDue,
      totalRecovered,
      count: pendingSales.length,
    };
  }, [sales, repayments]);

  const handleOpenPaymentModal = (sale) => {
    const dueAmount = sale.balance_due ?? sale.due_balance ?? sale.total_amount ?? "";
    const activeReceiptNo = getReceiptNumber(sale);
    setSelectedSale(sale);
    setPaymentAmount(dueAmount);
    setRepaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("CASH");
    setSplitBreakdown({
      cash: parseFloat(dueAmount) || 0,
      paybill: 0,
      send_money: 0,
    });
    setReferenceNumber("");
    setReceiptNumberInput(activeReceiptNo);
    setNotes("");
    setIsPaymentModalOpen(true);
  };

  const handleMethodChange = (method) => {
    setPaymentMethod(method);
    if (method === "SPLIT") {
      const total = parseFloat(paymentAmount) || 0;
      setSplitBreakdown({ cash: total, paybill: 0, send_money: 0 });
    }
  };

  const handleSplitChange = (field, val) => {
    const numVal = parseFloat(val) || 0;
    setSplitBreakdown((prev) => ({ ...prev, [field]: numVal }));
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedSale) return;

    const parsedAmount = parseFloat(paymentAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    if (paymentMethod === "SPLIT") {
      const splitSum = splitBreakdown.cash + splitBreakdown.paybill + splitBreakdown.send_money;
      if (Math.abs(splitSum - parsedAmount) > 0.01) {
        alert(`Split allocations (KSh ${splitSum.toLocaleString()}) must equal the total repayment amount (KSh ${parsedAmount.toLocaleString()}).`);
        return;
      }
    }

    setSubmittingPayment(true);
    try {
      const activeReceiptNo = receiptNumberInput || getReceiptNumber(selectedSale);
      const customerPk = getCustomerId(selectedSale);

      const payload = {
        sale_transaction: selectedSale.id,
        branch: selectedBranch || selectedSale.branch,
        amount: parsedAmount,
        date: repaymentDate,
        repayment_date: repaymentDate,
        payment_method: paymentMethod,
        reference_number: referenceNumber,
        receipt_number: activeReceiptNo,
        invoice_number: activeReceiptNo,
        notes: notes,
        ...(customerPk !== null && { customer: customerPk }),
        ...(paymentMethod === "SPLIT" && {
          split_details: {
            cash: splitBreakdown.cash,
            paybill: splitBreakdown.paybill,
            send_money: splitBreakdown.send_money,
          },
        }),
      };

      await API.post(`credit-repayments/`, payload);

      setIsPaymentModalOpen(false);
      setSelectedSale(null);
      fetchCreditSales();
      fetchCreditRepayments();
      
      if (typeof onTransactionComplete === 'function') {
        onTransactionComplete();
      }
    } catch (error) {
      console.error("Error recording credit repayment:", error);
      
      const errData = error.response?.data;
      let errorMsg = "Failed to record repayment. Please try again.";

      if (typeof errData === "string") {
        errorMsg = errData;
      } else if (errData?.detail) {
        errorMsg = errData.detail;
      } else if (typeof errData === "object" && errData !== null) {
        const firstKey = Object.keys(errData)[0];
        const val = errData[firstKey];
        if (Array.isArray(val)) {
          errorMsg = `${firstKey}: ${val[0]}`;
        } else if (typeof val === "string") {
          errorMsg = `${firstKey}: ${val}`;
        }
      }

      alert(errorMsg);
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Receipts & Repayments</h1>
          <p className="text-xs text-slate-600 mt-0.5">Search for an invoice number or receipt to process credit repayments.</p>
        </div>

        <button
          type="button"
          onClick={() => {
            fetchCreditSales();
            fetchCreditRepayments();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-300 transition-all cursor-pointer shadow-sm w-fit"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5.64 9A7 7 0 0117.9 6.1L20 9M4 15l2.1 2.9A7 7 0 0018.36 15" />
          </svg>
          Refresh Data
        </button>
      </div>

      {/* Overview KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
        <div className="bg-white border border-slate-300 p-4 rounded-2xl shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Credit Value</span>
          <div className="text-xl font-black text-slate-900 mt-1">
            KSh {creditTotals.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">{creditTotals.count} Active Credit Accounts</span>
        </div>

        <div className="bg-white border border-slate-300 p-4 rounded-2xl shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Total Outstanding Balance</span>
          <div className="text-xl font-black text-rose-600 mt-1">
            KSh {creditTotals.totalBalanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Pending Collection</span>
        </div>

        <div className="bg-white border border-slate-300 p-4 rounded-2xl shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Total Recovered</span>
          <div className="text-xl font-black text-emerald-700 mt-1">
            KSh {creditTotals.totalRecovered.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Repaid Amount</span>
        </div>
      </div>

      {/* Invoice Search Input Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm space-y-2 no-print">
        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
          Search Invoice / Receipt Number
        </label>
        <div className="relative w-full">
          <svg className="absolute left-3.5 top-3 h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Type Invoice Number, Receipt No., Customer Name, or Transaction ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10 py-2.5 w-full text-xs bg-slate-50 border border-slate-300 text-slate-900 font-medium rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Credit Repayment Results Table */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden no-print">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-slate-800">Invoice Repayment Lookup</h2>
          {searchTerm && (
            <span className="text-xs font-mono font-bold text-slate-600">
              Found {filteredSales.length} matching invoice(s)
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <th className="p-4">Transaction ID</th>
                <th className="p-4">Receipt / Invoice No.</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Date</th>
                <th className="p-4">Total Amount</th>
                <th className="p-4">Balance Due</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg className="w-6 h-6 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      <span>Searching credit records...</span>
                    </div>
                  </td>
                </tr>
              ) : !searchTerm.trim() ? (
                <tr>
                  <td colSpan="8" className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 text-base">
                        🔍
                      </div>
                      <span className="font-semibold text-slate-700">Enter an Invoice or Receipt Number above to search</span>
                      <span className="text-[11px] text-slate-400">Accounts will appear here when searched.</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-500 font-medium">
                    No matching unpaid invoice found for <span className="font-bold text-slate-700">"{searchTerm}"</span>.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const receiptNo = getReceiptNumber(sale);
                  return (
                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-900">#TXN-{sale.id}</td>
                      <td className="p-4 font-mono font-bold text-indigo-600">
                        {receiptNo || "N/A"}
                      </td>
                      <td className="p-4 font-medium text-slate-800">{sale.customer_name || "Walk-in Customer"}</td>
                      <td className="p-4 text-slate-600">{sale.sale_date ? new Date(sale.sale_date).toLocaleDateString() : "N/A"}</td>
                      <td className="p-4 font-bold text-slate-900">KSh {Number(sale.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-4 font-bold text-rose-600">
                        KSh {Number(sale.balance_due ?? sale.due_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4">
                        {sale.payment_status === "PAID" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Paid
                          </span>
                        ) : sale.payment_status === "PARTIAL" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                            Partial
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        {sale.payment_status !== "PAID" && (
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentModal(sale)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm transition-all cursor-pointer"
                          >
                            Record Repayment
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Repayment Modal */}
      {isPaymentModalOpen && selectedSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white border border-slate-300 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold text-slate-900">Record Credit Repayment</h2>
              <button 
                type="button"
                onClick={() => setIsPaymentModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt Number:</span>
                  <span className="font-mono font-medium text-indigo-600">
                    {getReceiptNumber(selectedSale) || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction Ref:</span>
                  <span className="font-mono font-medium text-slate-800">#TXN-{selectedSale.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Outstanding Balance:</span>
                  <span className="font-bold text-rose-600">
                    KSh {Number(selectedSale.balance_due ?? selectedSale.due_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt / Invoice Number</label>
                <input
                  type="text"
                  value={receiptNumberInput}
                  onChange={(e) => setReceiptNumberInput(e.target.value)}
                  placeholder="Enter receipt number..."
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Repayment Date</label>
                <input
                  type="date"
                  value={repaymentDate}
                  onChange={(e) => setRepaymentDate(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Repayment Amount (KSh)</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedSale.balance_due ?? selectedSale.due_balance ?? selectedSale.total_amount}
                  value={paymentAmount}
                  onChange={(e) => {
                    const newAmount = e.target.value;
                    setPaymentAmount(newAmount);
                    if (paymentMethod === "SPLIT") {
                      setSplitBreakdown({ cash: parseFloat(newAmount) || 0, paybill: 0, send_money: 0 });
                    }
                  }}
                  placeholder="Enter amount..."
                  required
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => handleMethodChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="CASH">Cash</option>
                  <option value="PAYBILL">Paybill</option>
                  <option value="SEND_MONEY">Send Money</option>
                  <option value="SPLIT">Split Payment (Cash + Paybill + Send Money)</option>
                </select>
              </div>

              {/* Conditional Split Payment Fields */}
              {paymentMethod === "SPLIT" && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center text-[11px] text-slate-500 border-b border-slate-200 pb-2">
                    <span>Split Allocation</span>
                    <span className="font-mono text-indigo-600 font-bold">
                      Total: KSh {(splitBreakdown.cash + splitBreakdown.paybill + splitBreakdown.send_money).toLocaleString()} / {Number(paymentAmount || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Cash (KSh)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={splitBreakdown.cash}
                        onChange={(e) => handleSplitChange("cash", e.target.value)}
                        className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg p-2 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Paybill (KSh)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={splitBreakdown.paybill}
                        onChange={(e) => handleSplitChange("paybill", e.target.value)}
                        className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg p-2 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Send Money (KSh)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={splitBreakdown.send_money}
                        onChange={(e) => handleSplitChange("send_money", e.target.value)}
                        className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg p-2 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reference Number / Txn Code (Optional)</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. M-Pesa Receipt Ref"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional payment notes..."
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {submittingPayment ? "Recording..." : "Record Repayment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}