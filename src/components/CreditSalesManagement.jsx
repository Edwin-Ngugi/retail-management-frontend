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

  // Strict Filter Logic: Enforces exact / suffix matching on receipt number or exact customer prefix
  const filteredSales = useMemo(() => {
    if (!Array.isArray(sales)) return [];
    const rawTerm = searchTerm.trim().toLowerCase();

    // Hide records by default until user enters at least 2 characters
    if (!rawTerm || rawTerm.length < 2) return [];

    // Strip common prefixes like "inv", "receipt", "#" to isolate the core invoice identifier
    const cleanTerm = rawTerm.replace(/^(inv|invoice|receipt|rcpt|txn|#)\s*[-_:]?\s*/i, "").trim();

    return sales.filter((sale) => {
      const balance = Number(sale.balance_due ?? sale.due_balance ?? 0);
      const isPaid = sale.payment_status === "PAID" || balance <= 0;
      if (isPaid) return false;

      const receiptNum = String(getReceiptNumber(sale)).toLowerCase().trim();
      const cleanReceipt = receiptNum.replace(/^(inv|invoice|receipt|rcpt)\s*[-_:]?\s*/i, "").trim();
      const customer = String(sale.customer_name || "").toLowerCase().trim();
      const saleId = String(sale.id || "").toLowerCase().trim();

      // 1. Exact match on full or stripped receipt number
      const isExactReceipt = receiptNum === rawTerm || cleanReceipt === cleanTerm;

      // 2. Strict suffix match (e.g., typing "1_2" matches "INV 1_2" or "TW 1_2")
      const isSuffixReceipt = receiptNum.endsWith(cleanTerm) || cleanReceipt.endsWith(cleanTerm);

      // 3. Customer match requires at least 3 characters and must start with the query
      const isCustomerMatch = rawTerm.length >= 3 && customer.startsWith(rawTerm);

      // 4. Exact Transaction ID match
      const isSaleIdMatch = saleId === rawTerm || `#txn-${saleId}` === rawTerm || `txn-${saleId}` === rawTerm;

      return isExactReceipt || isSuffixReceipt || isCustomerMatch || isSaleIdMatch;
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
      {/* Top Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Customer Receipts & Repayments</h1>
          <p className="text-xs font-medium text-slate-500 mt-0.5">Search an invoice number or receipt to process credit account repayments.</p>
        </div>

        <button
          type="button"
          onClick={() => {
            fetchCreditSales();
            fetchCreditRepayments();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 transition-all cursor-pointer shadow-2xs w-fit"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5.64 9A7 7 0 0117.9 6.1L20 9M4 15l2.1 2.9A7 7 0 0018.36 15" />
          </svg>
          Refresh Data
        </button>
      </div>

      {/* Overview KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs relative">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Credit Value</span>
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 mt-2">
            KSh {creditTotals.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] font-semibold text-slate-500 mt-1 block">{creditTotals.count} Pending Credit Accounts</span>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs relative">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-500">Outstanding Balance</span>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          </div>
          <div className="text-2xl font-black font-mono text-rose-600 mt-2">
            KSh {creditTotals.totalBalanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] font-semibold text-rose-500/80 mt-1 block">Pending Collection</span>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs relative">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-600">Total Recovered</span>
            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
          </div>
          <div className="text-2xl font-black font-mono text-teal-700 mt-2">
            KSh {creditTotals.totalRecovered.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] font-semibold text-teal-600/80 mt-1 block">Repaid Amount</span>
        </div>
      </div>

      {/* Invoice Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 no-print">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-black text-teal-950 uppercase tracking-wider">
            SEARCH INVOICE / RECEIPT NUMBER
          </label>
          <span className="text-[10px] font-mono text-slate-400 font-bold">
            e.g. "INV 1_2", "1_2", or Customer Name
          </span>
        </div>

        <div className="relative w-full">
          <svg className="absolute left-3.5 top-3 h-4 w-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Type exact or ending invoice # (e.g. 1_2)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-20 py-2.5 w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 placeholder-slate-400 transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-2 px-2 py-0.5 text-[10px] font-black bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md transition-colors"
            >
              CLEAR
            </button>
          )}
        </div>
      </div>

      {/* Clean Repayments Table (Only Invoice, Customer, Balance & Repay Button) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden no-print">
        <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center">
          <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            Invoice Repayment Lookup
          </h2>
          {searchTerm.trim().length >= 2 && (
            <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-lg">
              Found {filteredSales.length} match(es)
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-slate-100/70 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="p-4">Invoice / Receipt No.</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Balance Due</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="4" className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg className="w-6 h-6 animate-spin text-teal-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      <span className="text-xs font-bold text-slate-600">Searching invoice records...</span>
                    </div>
                  </td>
                </tr>
              ) : !searchTerm.trim() ? (
                <tr>
                  <td colSpan="4" className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 text-xl font-bold">
                        🔍
                      </div>
                      <span className="font-extrabold text-slate-800 text-sm">Type an Invoice or Receipt Number to search</span>
                      <span className="text-xs text-slate-400 max-w-sm">
                        Enter the specific receipt code (e.g. <code className="font-mono bg-slate-100 text-teal-800 px-1 py-0.5 rounded">1_2</code>) in the search bar above to process repayments.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : searchTerm.trim().length < 2 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-slate-500 font-semibold">
                    Please enter at least 2 characters to search.
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-10 text-center text-slate-500">
                    <div className="space-y-1">
                      <p className="font-extrabold text-slate-700">No matching unpaid invoice found for "{searchTerm}"</p>
                      <p className="text-xs text-slate-400">Please verify the invoice number and try again.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const receiptNo = getReceiptNumber(sale);
                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-mono font-black text-teal-800 text-sm">
                        {receiptNo || `TXN-#${sale.id}`}
                      </td>
                      <td className="p-4 font-bold text-slate-800 text-xs">
                        {sale.customer_name || "Walk-in Customer"}
                      </td>
                      <td className="p-4 font-black font-mono text-rose-600 text-sm">
                        KSh {Number(sale.balance_due ?? sale.due_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenPaymentModal(sale)}
                          className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-2xs transition-all cursor-pointer"
                        >
                          Record Repayment
                        </button>
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-slate-900">Record Credit Repayment</h2>
              <button 
                type="button"
                onClick={() => setIsPaymentModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 transition-colors font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Receipt / Invoice:</span>
                  <span className="font-bold text-teal-800">
                    {getReceiptNumber(selectedSale) || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Customer:</span>
                  <span className="font-bold text-slate-800">{selectedSale.customer_name || "Walk-in Customer"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Outstanding Balance:</span>
                  <span className="font-extrabold text-rose-600">
                    KSh {Number(selectedSale.balance_due ?? selectedSale.due_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Receipt / Invoice Number</label>
                <input
                  type="text"
                  value={receiptNumberInput}
                  onChange={(e) => setReceiptNumberInput(e.target.value)}
                  placeholder="Enter receipt number..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Repayment Date</label>
                <input
                  type="date"
                  value={repaymentDate}
                  onChange={(e) => setRepaymentDate(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-semibold rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Repayment Amount (KSh)</label>
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
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => handleMethodChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-semibold rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none cursor-pointer"
                >
                  <option value="CASH">Cash</option>
                  <option value="PAYBILL">Paybill</option>
                  <option value="SEND_MONEY">Send Money</option>
                  <option value="SPLIT">Split Payment (Cash + Paybill + Send Money)</option>
                </select>
              </div>

              {/* Conditional Split Payment Breakdown */}
              {paymentMethod === "SPLIT" && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex justify-between items-center text-[11px] text-slate-500 border-b border-slate-200 pb-1.5">
                    <span className="font-bold uppercase tracking-wider text-[9px]">Split Allocation</span>
                    <span className="font-mono text-teal-800 font-bold">
                      Allocated: KSh {(splitBreakdown.cash + splitBreakdown.paybill + splitBreakdown.send_money).toLocaleString()} / {Number(paymentAmount || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Cash</label>
                      <input
                        type="number"
                        step="0.01"
                        value={splitBreakdown.cash}
                        onChange={(e) => handleSplitChange("cash", e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 font-mono font-semibold rounded-lg p-2 text-xs outline-none focus:border-teal-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Paybill</label>
                      <input
                        type="number"
                        step="0.01"
                        value={splitBreakdown.paybill}
                        onChange={(e) => handleSplitChange("paybill", e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 font-mono font-semibold rounded-lg p-2 text-xs outline-none focus:border-teal-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Send Money</label>
                      <input
                        type="number"
                        step="0.01"
                        value={splitBreakdown.send_money}
                        onChange={(e) => handleSplitChange("send_money", e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 font-mono font-semibold rounded-lg p-2 text-xs outline-none focus:border-teal-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reference Number / Txn Code (Optional)</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. M-Pesa Code"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional payment notes..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
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