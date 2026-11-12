// src/components/CreditSalesManagement.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import API from "../api";

const formatLocalDate = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const computePeriodBounds = (periodKey, customStart, customEnd) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (periodKey) {
    case "this_month": {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return {
        start_date: formatLocalDate(start),
        end_date: formatLocalDate(end),
        label: start.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
      };
    }
    case "last_month": {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      return {
        start_date: formatLocalDate(start),
        end_date: formatLocalDate(end),
        label: start.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
      };
    }
    case "this_quarter": {
      const qStartMonth = Math.floor(month / 3) * 3;
      const start = new Date(year, qStartMonth, 1);
      const end = new Date(year, qStartMonth + 3, 0);
      return {
        start_date: formatLocalDate(start),
        end_date: formatLocalDate(end),
        label: `Q${Math.floor(month / 3) + 1} ${year}`,
      };
    }
    case "this_year": {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31);
      return {
        start_date: formatLocalDate(start),
        end_date: formatLocalDate(end),
        label: `${year}`,
      };
    }
    case "all_time": {
      return {
        start_date: "2000-01-01",
        end_date: formatLocalDate(now),
        label: "All Time",
      };
    }
    case "custom": {
      if (customStart && customEnd) {
        return {
          start_date: customStart,
          end_date: customEnd,
          label: `${customStart} → ${customEnd}`,
        };
      }
      return { start_date: "", end_date: "", label: "Custom" };
    }
    default:
      return { start_date: "", end_date: "", label: "Active Period" };
  }
};

export default function CreditSalesManagement({ selectedBranch, effectiveRange, onTransactionComplete }) {
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Period selector state
  const [periodOption, setPeriodOption] = useState("this_month");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    return formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [customEndDate, setCustomEndDate] = useState(() => formatLocalDate(new Date()));

  const abortControllerRef = useRef(null);

  // Receivables summary fetched directly from backend
  const [receivablesSummary, setReceivablesSummary] = useState({
    total_credit_issued: 0,
    total_receivables: 0,
    total_recovered: 0,
    active_debtors_count: 0,
    total_unpaid_invoices: 0,
    period_label: "",
  });

  const [paymentAmount, setPaymentAmount] = useState("");
  const [repaymentDate, setRepaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [splitBreakdown, setSplitBreakdown] = useState({
    cash: 0,
    paybill: 0,
    send_money: 0,
  });
  const [splitReferences, setSplitReferences] = useState({
    paybill: "",
    send_money: "",
  });
  const [referenceNumber, setReferenceNumber] = useState("");
  const [receiptNumberInput, setReceiptNumberInput] = useState("");
  const [notes, setNotes] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const activeRange = useMemo(() => {
    if (periodOption === "global" && effectiveRange?.start_date && effectiveRange?.end_date) {
      return {
        start_date: effectiveRange.start_date,
        end_date: effectiveRange.end_date,
        label: `${effectiveRange.start_date} → ${effectiveRange.end_date}`,
      };
    }
    return computePeriodBounds(periodOption, customStartDate, customEndDate);
  }, [periodOption, customStartDate, customEndDate, effectiveRange]);

  // Fetch Receivables Report Metrics
  const fetchReceivablesSummary = useCallback(async () => {
    if (periodOption === "custom" && (!activeRange.start_date || !activeRange.end_date)) {
      return;
    }

    try {
      const params = new URLSearchParams();
      if (selectedBranch) {
        params.append("branch_id", selectedBranch);
        params.append("branch", selectedBranch);
      }
      if (activeRange.start_date) {
        params.append("start_date", activeRange.start_date);
      }
      if (activeRange.end_date) {
        params.append("end_date", activeRange.end_date);
      }

      const response = await API.get(`management-analytics/customer-receivables/?${params.toString()}`);
      if (response?.data) {
        setReceivablesSummary({
          total_credit_issued: Number(response.data.total_credit_issued || 0),
          total_receivables: Number(response.data.total_receivables || 0),
          total_recovered: Number(response.data.total_recovered || 0),
          active_debtors_count: Number(response.data.active_debtors_count || 0),
          total_unpaid_invoices: Number(response.data.total_unpaid_invoices || 0),
          period_label: response.data.period_label || activeRange.label,
        });
      }
    } catch (error) {
      console.error("Error fetching receivables summary:", error);
    }
  }, [selectedBranch, activeRange, periodOption]);

  useEffect(() => {
    fetchReceivablesSummary();
  }, [fetchReceivablesSummary]);

  // Debounced backend search lookup
  useEffect(() => {
    const rawTerm = searchTerm.trim();

    const isSpecificQuery = rawTerm.length >= 3 || rawTerm.includes("_") || rawTerm.includes("-") || rawTerm.includes(" ");

    if (!rawTerm || !isSpecificQuery) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.append("q", rawTerm);
        if (selectedBranch) {
          params.append("branch", selectedBranch);
        }

        const response = await API.get(`credit-repayments/lookup/?${params.toString()}`, {
          signal: abortControllerRef.current.signal,
        });

        const data = Array.isArray(response?.data) ? response.data : [];
        setSearchResults(data);
      } catch (error) {
        if (error.name !== "CanceledError" && error.name !== "AbortError") {
          console.error("Error looking up invoice:", error);
          setSearchResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedBranch]);

  const handleOpenPaymentModal = (sale) => {
    const dueAmount = sale.balance_due ?? sale.total_amount ?? "";
    const activeReceiptNo = sale.invoice_number || sale.receipt_number || "";
    setSelectedSale(sale);
    setPaymentAmount(dueAmount);
    setRepaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentMethod("CASH");
    setSplitBreakdown({
      cash: parseFloat(dueAmount) || 0,
      paybill: 0,
      send_money: 0,
    });
    setSplitReferences({ paybill: "", send_money: "" });
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
    setSplitBreakdown((prev) => {
      const updated = { ...prev, [field]: numVal };
      const newTotal = updated.cash + updated.paybill + updated.send_money;
      setPaymentAmount(newTotal > 0 ? newTotal.toString() : "");
      return updated;
    });
  };

  const handleSplitRefChange = (field, val) => {
    setSplitReferences((prev) => ({ ...prev, [field]: val }));
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedSale) return;

    const parsedAmount = parseFloat(paymentAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }

    let splitPaymentsList = [];

    if (paymentMethod === "SPLIT") {
      const splitSum = splitBreakdown.cash + splitBreakdown.paybill + splitBreakdown.send_money;
      if (Math.abs(splitSum - parsedAmount) > 0.01) {
        alert(`Split allocations (KSh ${splitSum.toLocaleString()}) must equal total repayment amount (KSh ${parsedAmount.toLocaleString()}).`);
        return;
      }

      if (splitBreakdown.cash > 0) {
        splitPaymentsList.push({ method: "CASH", amount: splitBreakdown.cash });
      }
      if (splitBreakdown.paybill > 0) {
        splitPaymentsList.push({
          method: "PAYBILL",
          amount: splitBreakdown.paybill,
          reference_code: splitReferences.paybill,
        });
      }
      if (splitBreakdown.send_money > 0) {
        splitPaymentsList.push({
          method: "SEND_MONEY",
          amount: splitBreakdown.send_money,
          reference_code: splitReferences.send_money,
        });
      }
    }

    setSubmittingPayment(true);
    try {
      const activeReceiptNo = receiptNumberInput || selectedSale.invoice_number || selectedSale.receipt_number;

      const payload = {
        customer: selectedSale.customer_id,
        customer_id: selectedSale.customer_id,
        transaction: selectedSale.id,
        sale_transaction: selectedSale.id,
        sale: selectedSale.id,
        branch: selectedBranch || selectedSale.branch,
        amount: parsedAmount,
        date: repaymentDate,
        repayment_date: repaymentDate,
        payment_method: paymentMethod,
        reference_number: referenceNumber,
        receipt_number: activeReceiptNo,
        invoice_number: activeReceiptNo,
        notes: notes,
        ...(paymentMethod === "SPLIT" && {
          split_payments: splitPaymentsList,
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
      setSearchTerm("");
      fetchReceivablesSummary();

      if (typeof onTransactionComplete === "function") {
        onTransactionComplete();
      }
    } catch (error) {
      console.error("Error recording credit repayment:", error);
      alert(error.response?.data?.error || "Failed to record repayment. Please try again.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Page Header & Period Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-teal-50 border border-teal-200/60 text-teal-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Customer Receipts & Repayments</h1>
          </div>
          <p className="text-xs font-medium text-slate-500 mt-1 ml-10">
            Search credit sales invoices, track debtor balances, and process collections.
          </p>
        </div>

        {/* Period Filter Bar + Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            {[
              { id: "this_month", label: "This Month" },
              { id: "last_month", label: "Last Month" },
              { id: "this_quarter", label: "Quarter" },
              { id: "this_year", label: "Year" },
              { id: "all_time", label: "All Time" },
              { id: "custom", label: "Custom" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriodOption(opt.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  periodOption === opt.id
                    ? "bg-white text-teal-800 shadow-2xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {periodOption === "custom" && (
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-[11px] font-mono font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
              />
              <span className="text-slate-400 text-xs">→</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-[11px] font-mono font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => fetchReceivablesSummary()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200/90 shadow-2xs transition-all cursor-pointer active:scale-98"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 4v5h5M20 20v-5h-5M5.64 9A7 7 0 0117.9 6.1L20 9M4 15l2.1 2.9A7 7 0 0018.36 15" />
            </svg>
            Refresh Data
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Credit Issued */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-slate-300 group-hover:bg-slate-400 transition-colors"></div>
          <div className="flex justify-between items-start gap-2">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Total Credit Issued
              </span>
              <span className="text-[10px] font-bold text-teal-700 font-mono">
                {activeRange.label}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-extrabold font-mono">
              {receivablesSummary.active_debtors_count} Debtors
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 mt-3 tracking-tight">
            KSh {receivablesSummary.total_credit_issued.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] font-semibold text-slate-500 mt-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            {receivablesSummary.total_unpaid_invoices} Credit invoices in period
          </p>
        </div>

        {/* Outstanding Balance */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs relative overflow-hidden group hover:border-rose-200 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500"></div>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-500 block">
                Outstanding Balance
              </span>
              <span className="text-[10px] font-bold text-slate-400 font-mono">
                Cumulative Unpaid
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 text-[10px] font-extrabold font-mono border border-rose-100 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
              Pending
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-rose-600 mt-3 tracking-tight">
            KSh {receivablesSummary.total_receivables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] font-semibold text-rose-500/90 mt-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Awaiting collection
          </p>
        </div>

        {/* Total Recovered */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs relative overflow-hidden group hover:border-teal-200 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-teal-500"></div>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-600 block">
                Total Recovered
              </span>
              <span className="text-[10px] font-bold text-teal-700 font-mono">
                {activeRange.label}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 text-[10px] font-extrabold font-mono border border-teal-100">
              Recovered
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-teal-700 mt-3 tracking-tight">
            KSh {receivablesSummary.total_recovered.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] font-semibold text-teal-600/90 mt-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
            Cleared debt payments
          </p>
        </div>
      </div>

      {/* Invoice Search Bar Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <span>Search Invoice / Receipt Number</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-400">Quick test:</span>
            {["2_42", "2_36", "KYALU"].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setSearchTerm(sample)}
                className="text-[10px] font-mono font-bold bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md transition-all cursor-pointer"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Type exact receipt code (e.g. 2_36 or KYALU)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-24 py-3 w-full text-xs font-mono font-bold bg-slate-50/80 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:border-teal-600 focus:bg-white focus:ring-3 focus:ring-teal-500/15 placeholder-slate-400 transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-2.5 px-2.5 py-1 text-[10px] font-extrabold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              CLEAR
            </button>
          )}
        </div>
      </div>

      {/* Lookup Results Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/60 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Invoice Repayment Lookup
            </h2>
            {isSearching && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
                Searching...
              </span>
            )}
          </div>

          {searchResults.length > 0 && !isSearching && (
            <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-lg">
              Found {searchResults.length} match(es)
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[550px]">
            <thead>
              <tr className="bg-slate-100/60 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                <th className="p-4">Invoice / Receipt No.</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Original Value</th>
                <th className="p-4">Balance Due</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800 font-medium">
              {isSearching ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-bold text-slate-600 mt-1">Searching invoice records...</span>
                    </div>
                  </td>
                </tr>
              ) : !searchTerm.trim() ? (
                <tr>
                  <td colSpan="5" className="p-14 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 text-lg">
                        🔎
                      </div>
                      <span className="font-extrabold text-slate-800 text-sm">Enter an Invoice Number</span>
                      <p className="text-xs text-slate-400">
                        Type an exact code like <code className="font-mono bg-slate-100 text-slate-800 px-1 py-0.5 rounded">2_36</code> in the search field above to search for outstanding balances.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (searchTerm.trim().length < 3 && !searchTerm.includes("_") && !searchTerm.includes("-")) ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400 font-medium">
                    Please enter at least 3 characters or an exact invoice number (e.g., <code className="font-mono text-teal-700 bg-teal-50 px-1 py-0.5 rounded">2_36</code>).
                  </td>
                </tr>
              ) : searchResults.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center">
                    <div className="space-y-1">
                      <p className="font-extrabold text-slate-800">No matching open invoice found for "{searchTerm}"</p>
                      <p className="text-xs text-slate-400">Verify the receipt number or ensure the credit sale has an unpaid balance.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                searchResults.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="p-4 font-mono font-black text-teal-800 text-sm">
                      <span className="bg-teal-50 group-hover:bg-teal-100/80 px-2 py-1 rounded-lg border border-teal-200/60 transition-colors">
                        {sale.invoice_number || `INV-${sale.id}`}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-800 text-xs">
                      {sale.customer_name || "Walk-in Customer"}
                    </td>
                    <td className="p-4 font-mono font-semibold text-slate-500 text-xs">
                      KSh {Number(sale.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 font-black font-mono text-rose-600 text-sm">
                      KSh {Number(sale.balance_due || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenPaymentModal(sale)}
                        className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-xl shadow-2xs transition-all cursor-pointer"
                      >
                        Record Repayment
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Repayment Modal */}
      {isPaymentModalOpen && selectedSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Record Credit Repayment</h2>
                <p className="text-[11px] font-medium text-slate-400">Process debt collection for invoice</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              {/* Invoice Summary Box */}
              <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2 font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans text-[11px]">Invoice / Receipt:</span>
                  <span className="font-bold text-teal-800 text-xs bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60">
                    {selectedSale.invoice_number || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans text-[11px]">Customer:</span>
                  <span className="font-bold text-slate-800 text-xs">{selectedSale.customer_name || "Walk-in Customer"}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 font-sans text-[11px]">Outstanding Balance:</span>
                  <span className="font-extrabold text-rose-600 text-sm">
                    KSh {Number(selectedSale.balance_due || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Repayment Date Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Repayment Date</label>
                <input
                  type="date"
                  value={repaymentDate}
                  onChange={(e) => setRepaymentDate(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-semibold rounded-xl p-2.5 text-xs outline-none focus:border-teal-600 focus:bg-white transition-all cursor-pointer"
                />
              </div>

              {/* Repayment Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Repayment Amount (KSh)</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount..."
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold rounded-xl p-2.5 text-xs outline-none focus:border-teal-600 focus:bg-white transition-all"
                />
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => handleMethodChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-semibold rounded-xl p-2.5 text-xs outline-none cursor-pointer focus:border-teal-600 focus:bg-white transition-all"
                >
                  <option value="CASH">Cash</option>
                  <option value="PAYBILL">Paybill</option>
                  <option value="SEND_MONEY">Send Money</option>
                  <option value="SPLIT">Split Payment (Cash + Paybill + Send Money)</option>
                </select>
              </div>

              {/* Reference Code for Single PAYBILL / SEND_MONEY */}
              {(paymentMethod === "PAYBILL" || paymentMethod === "SEND_MONEY") && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {paymentMethod === "PAYBILL" ? "Paybill Reference Code" : "M-Pesa Transaction Code"}
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. QX782910AK"
                    required
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold rounded-xl p-2.5 text-xs outline-none focus:border-teal-600 focus:bg-white transition-all uppercase"
                  />
                </div>
              )}

              {/* Split Payment Allocation Fields with Reference Codes */}
              {paymentMethod === "SPLIT" && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center text-[11px] text-slate-500 border-b border-slate-200 pb-1.5">
                    <span className="font-bold uppercase tracking-wider text-[9px]">Split Breakdown & Reference Codes</span>
                    <span className="font-mono text-teal-800 font-bold">
                      Allocated: KSh {(splitBreakdown.cash + splitBreakdown.paybill + splitBreakdown.send_money).toLocaleString()}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {/* Cash Allocation */}
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[11px] font-bold text-slate-600 w-24">Cash Amount:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={splitBreakdown.cash}
                        onChange={(e) => handleSplitChange("cash", e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 font-mono font-semibold rounded-lg p-2 text-xs outline-none focus:border-teal-600"
                      />
                    </div>

                    {/* Paybill Allocation & Ref Code */}
                    <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200/80">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[11px] font-bold text-slate-700 w-24">Paybill Amount:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={splitBreakdown.paybill}
                          onChange={(e) => handleSplitChange("paybill", e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-mono font-semibold rounded-lg p-2 text-xs outline-none focus:border-teal-600"
                        />
                      </div>
                      {splitBreakdown.paybill > 0 && (
                        <div className="pt-1">
                          <input
                            type="text"
                            value={splitReferences.paybill}
                            onChange={(e) => handleSplitRefChange("paybill", e.target.value)}
                            placeholder="Paybill Ref / Code (e.g. QX782910AK)"
                            required
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-mono text-[11px] rounded-lg p-1.5 outline-none focus:border-teal-600 uppercase"
                          />
                        </div>
                      )}
                    </div>

                    {/* Send Money Allocation & Ref Code */}
                    <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200/80">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[11px] font-bold text-slate-700 w-24">Send Money Amount:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={splitBreakdown.send_money}
                          onChange={(e) => handleSplitChange("send_money", e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-mono font-semibold rounded-lg p-2 text-xs outline-none focus:border-teal-600"
                        />
                      </div>
                      {splitBreakdown.send_money > 0 && (
                        <div className="pt-1">
                          <input
                            type="text"
                            value={splitReferences.send_money}
                            onChange={(e) => handleSplitRefChange("send_money", e.target.value)}
                            placeholder="M-Pesa Txn Code (e.g. RK982310XZ)"
                            required
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-mono text-[11px] rounded-lg p-1.5 outline-none focus:border-teal-600 uppercase"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Remarks (Optional)</label>
                <textarea
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional payment notes..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl p-2.5 text-xs outline-none focus:border-teal-600 focus:bg-white transition-all resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
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