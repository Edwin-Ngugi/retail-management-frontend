import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
  useMemo,
} from 'react';
import API from '../api';
import BranchContext from './BranchContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';

const PAYMENT_COLORS = [
  '#10B981', // Cash
  '#6366F1', // Paybill / M-Pesa
  '#F59E0B', // Send Money
  '#8B5CF6', // Credit Repayments
  '#EC4899', // Other
];

export default function Reports({ items = [] }) {
  const currentDate = useMemo(() => new Date(), []);

  const branchContextValue = useContext(BranchContext) || {};
  const { selectedBranch, activeBranch, branches = [] } = branchContextValue;

  const resolveBranchDetails = useCallback(
    (branchInput) => {
      if (!branchInput) return { id: null, name: '' };
      if (typeof branchInput === 'object') {
        return {
          id: branchInput.id || null,
          name: branchInput.name || '',
        };
      }
      if (!isNaN(Number(branchInput)) && Array.isArray(branches)) {
        const found = branches.find(
          (b) => String(b.id) === String(branchInput)
        );
        if (found) return { id: found.id, name: found.name };
      }
      return { id: null, name: String(branchInput) };
    },
    [branches]
  );

  const initialBranchDetails = useMemo(() => {
    const activeRes = resolveBranchDetails(activeBranch);
    if (activeRes.id || activeRes.name) return activeRes;
    return resolveBranchDetails(selectedBranch);
  }, [activeBranch, selectedBranch, resolveBranchDetails]);

  const [periodType, setPeriodType] = useState(() => {
    if (typeof window === 'undefined') return 'month';
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('period_type') ||
      params.get('periodType') ||
      localStorage.getItem('reports_period_type') ||
      'month'
    );
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window === 'undefined') return currentDate.toISOString().split('T')[0];
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('selectedDate') ||
      localStorage.getItem('reports_selectedDate') ||
      currentDate.toISOString().split('T')[0]
    );
  });

  const [startDate, setStartDate] = useState(() => {
    if (typeof window === 'undefined') return currentDate.toISOString().split('T')[0];
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('start_date') ||
      localStorage.getItem('reports_start_date') ||
      currentDate.toISOString().split('T')[0]
    );
  });

  const [endDate, setEndDate] = useState(() => {
    if (typeof window === 'undefined') return currentDate.toISOString().split('T')[0];
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('end_date') ||
      localStorage.getItem('reports_end_date') ||
      currentDate.toISOString().split('T')[0]
    );
  });

  const [year, setYear] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const paramYear = params.get('year');
      if (paramYear && !isNaN(Number(paramYear))) return Number(paramYear);
      const savedYear = localStorage.getItem('reports_year');
      if (savedYear && !isNaN(Number(savedYear))) return Number(savedYear);
    }

    if (selectedDate) {
      const parsed = new Date(`${selectedDate}T00:00:00`);
      if (!isNaN(parsed.getTime())) return parsed.getFullYear();
    }
    return currentDate.getFullYear();
  });

  const [month, setMonth] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const paramMonth = params.get('month');
      if (paramMonth && !isNaN(Number(paramMonth))) return Number(paramMonth);
      const savedMonth = localStorage.getItem('reports_month');
      if (savedMonth && !isNaN(Number(savedMonth))) return Number(savedMonth);
    }

    if (selectedDate) {
      const parsed = new Date(`${selectedDate}T00:00:00`);
      if (!isNaN(parsed.getTime())) return parsed.getMonth() + 1;
    }
    return currentDate.getMonth() + 1;
  });

  const [reportTitle, setReportTitle] = useState('Comprehensive Business & Financial Report');
  const [branchName, setBranchName] = useState(initialBranchDetails.name);
  const [branchId, setBranchId] = useState(initialBranchDetails.id);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [inventoryItems, setInventoryItems] = useState([]);

  const reportRef = useRef(null);

  const reportPeriodEndDate = useMemo(() => {
    if (periodType === 'day' && selectedDate) {
      const d = new Date(`${selectedDate}T23:59:59.999Z`);
      if (!isNaN(d.getTime())) return d;
    }
    if (periodType === 'custom' && endDate) {
      const d = new Date(`${endDate}T23:59:59.999Z`);
      if (!isNaN(d.getTime())) return d;
    }
    if (periodType === 'month') {
      return new Date(year, month, 0, 23, 59, 59, 999);
    }
    if (periodType === 'year') {
      return new Date(year, 11, 31, 23, 59, 59, 999);
    }
    return new Date();
  }, [periodType, selectedDate, endDate, year, month]);

  const updateUrlAndStorage = useCallback((paramsUpdate) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);

    Object.entries(paramsUpdate).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        url.searchParams.set(key, String(val));
        localStorage.setItem(`reports_${key}`, String(val));
      } else {
        url.searchParams.delete(key);
      }
    });

    window.history.replaceState({}, '', url.toString());
  }, []);

  useEffect(() => {
    const activeRes = resolveBranchDetails(activeBranch);
    const selectedRes = resolveBranchDetails(selectedBranch);
    const resolved = activeRes.name ? activeRes : selectedRes;

    if (resolved.name || resolved.id) {
      setBranchName(resolved.name);
      setBranchId(resolved.id);
    }
  }, [selectedBranch, activeBranch, resolveBranchDetails]);

  const handlePeriodChange = (newPeriod) => {
    setPeriodType(newPeriod);
    updateUrlAndStorage({ 
      period_type: newPeriod,
      selectedDate,
      startDate,
      endDate,
      month,
      year
    });
  };

  const handleDateChange = (e) => {
    const val = e.target.value;
    setSelectedDate(val);
    let newYear = year;
    let newMonth = month;

    if (val) {
      const d = new Date(`${val}T00:00:00`);
      if (!isNaN(d.getTime())) {
        newYear = d.getFullYear();
        newMonth = d.getMonth() + 1;
        setYear(newYear);
        setMonth(newMonth);
      }
    }

    updateUrlAndStorage({
      selectedDate: val,
      year: newYear,
      month: newMonth,
      period_type: periodType,
    });
  };

  const handleStartDateChange = (e) => {
    const val = e.target.value;
    setStartDate(val);
    updateUrlAndStorage({
      start_date: val,
      period_type: periodType,
    });
  };

  const handleEndDateChange = (e) => {
    const val = e.target.value;
    setEndDate(val);
    updateUrlAndStorage({
      end_date: val,
      period_type: periodType,
    });
  };

  const handleMonthChange = (newMonth) => {
    setMonth(newMonth);
    const formattedMonth = String(newMonth).padStart(2, '0');
    const newDate = `${year}-${formattedMonth}-01`;
    setSelectedDate(newDate);

    updateUrlAndStorage({
      month: newMonth,
      selectedDate: newDate,
      period_type: periodType,
    });
  };

  const handleYearChange = (newYear) => {
    setYear(newYear);
    const formattedMonth = String(month).padStart(2, '0');
    const newDate = `${newYear}-${formattedMonth}-01`;
    setSelectedDate(newDate);

    updateUrlAndStorage({
      year: newYear,
      selectedDate: newDate,
      period_type: periodType,
    });
  };

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');

    const queryParams = new URLSearchParams();
    queryParams.append('period_type', periodType);

    const branchVal = branchId || branchName;
    if (branchVal) queryParams.append('branch', String(branchVal));

    if (periodType === 'custom') {
      queryParams.append('start_date', startDate);
      queryParams.append('end_date', endDate);
    } else if (periodType === 'day' || periodType === 'weekly') {
      queryParams.append('date', selectedDate);
      queryParams.append('target_date', selectedDate);
    } else if (periodType === 'month') {
      queryParams.append('year', String(year));
      queryParams.append('month', String(month));
    } else if (periodType === 'year') {
      queryParams.append('year', String(year));
    }

    try {
      const res = await API.get(`reports/summary/?${queryParams.toString()}`);
      const rawData = res.data;

      setReport(rawData);

      const reportAnalytics =
        rawData?.item_analytics ||
        rawData?.inventory_items ||
        rawData?.inventory?.items ||
        rawData?.inventory?.stock_items ||
        [...(rawData?.fast_moving_items || []), ...(rawData?.slow_moving_items || [])];

      if (Array.isArray(reportAnalytics) && reportAnalytics.length > 0) {
        setInventoryItems(reportAnalytics);
      } else {
        setInventoryItems([]);
      }
    } catch (err) {
      console.error('Report API Error:', err?.response?.data || err.message);
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.error ||
          'Failed to fetch the report for the selected period.'
      );
    } finally {
      setLoading(false);
    }
  }, [periodType, selectedDate, startDate, endDate, year, month, branchName, branchId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const monthNames = useMemo(() => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ], []);

  const availableYears = useMemo(() => {
    const currentYear = currentDate.getFullYear();
    return Array.from({ length: 7 }, (_, index) => currentYear - 3 + index);
  }, [currentDate]);

  const getPeriodLabel = () => {
    if (periodType === 'day') return `DATE: ${selectedDate}`;
    if (periodType === 'weekly') return `WEEK OF: ${selectedDate}`;
    if (periodType === 'custom') return `RANGE: ${startDate} TO ${endDate}`;
    if (periodType === 'month') return `MONTH: ${monthNames[month - 1]} ${year}`;
    if (periodType === 'year') return `YEAR: ${year}`;
    return '';
  };

  const numberValue = useCallback((value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }, []);

  const firstNumber = useCallback((...values) => {
    for (const value of values) {
      if (
        value !== null &&
        value !== undefined &&
        value !== '' &&
        Number.isFinite(Number(value))    
      ) {
        return Number(value);
      }
    }
    return 0;
  }, []);

  const firstValue = useCallback((...values) => {
    for (const value of values) {
      if (value !== null && value !== undefined && value !== '') {
        return value;
      }
    }
    return '';
  }, []);

  const expenseData = useMemo(() => {
    const source = report?.expenses_breakdown || report?.expense_breakdown || {};
    let expenseList = report?.expense_details || report?.expenses || [];

    if (!Array.isArray(expenseList)) expenseList = [];

    const rawBreakdown =
      expenseList.length > 0
        ? expenseList
        : Array.isArray(source)
        ? source
        : Object.entries(source).map(([name, value]) => ({ name, amount: firstNumber(value) }));

    const normalizedBreakdown = rawBreakdown.map((expense, index) => ({
      id: expense.id || index,
      name: firstValue(expense.name, expense.category, expense.description, 'Other Expense'),
      amount: firstNumber(expense.amount, expense.total, expense.cost),
      receiptNumber: firstValue(expense.receipt_number, expense.reference, expense.number),
      date: firstValue(expense.date, expense.created_at),
      description: firstValue(expense.description, expense.notes),
      paymentMethod: firstValue(expense.payment_method, expense.method, 'Not specified'),
    }));

    const totalExpenses = firstNumber(report?.summary?.expenses);

    return { breakdown: normalizedBreakdown, totalExpenses };
  }, [report, firstNumber, firstValue]);

  const financials = useMemo(() => {
    const summary = report?.summary || {};
    return {
      revenue: numberValue(summary.revenue),
      cogs: numberValue(summary.cogs),
      expenses: numberValue(summary.expenses),
      grossProfit: numberValue(summary.gross_profit),
      netProfit: numberValue(summary.net_profit),
      grossMargin: numberValue(summary.gross_margin_percent),
      netMargin: numberValue(summary.net_margin_percent),
      opexRatio: numberValue(summary.opex_ratio_percent),
      cogsRatio: numberValue(summary.cogs_ratio_percent),
    };
  }, [report, numberValue]);

  const payments = useMemo(() => {
    const source = report?.payment_channel_breakdown || {};
    const summary = report?.summary || {};
    return {
      cash: numberValue(source.cash),
      paybill: numberValue(source.paybill),
      sendMoney: numberValue(source.send_money),
      mpesa: numberValue(source.mpesa_std),
      bankTransfer: numberValue(source.bank_transfer),
      other: numberValue(source.other),
      credit: numberValue(source.credit),
      creditRepayments: numberValue(source.credit_repayments),
      totalCollected: numberValue(summary.total_liquid_collections),
      accountsReceivable: {
        newDebtIssued: numberValue(summary.new_credit_sales),
        debtRecovered: numberValue(summary.credit_repayments),
        netReceivableChange: numberValue(summary.net_receivable_change),
        outstanding: numberValue(summary.credit_outstanding),
      },
    };
  }, [report, numberValue]);

  const fastMovingItems = useMemo(() => {
    const list = report?.fast_moving || report?.fast_moving_items || [];
    if (!Array.isArray(list)) return [];
    return list.map((item, index) => ({
      id: item.id || index,
      name: firstValue(item.name, item.item_name, item.product_name, 'Unknown Item'),
      code: firstValue(item.code, item.sku, '—'),
      unitsSold: firstNumber(item.units_sold, item.quantity_sold, item.qty_sold),
      revenue: firstNumber(item.total_revenue, item.revenue, item.amount),
      currentStock: firstNumber(
        item.ending_stock,
        item.period_stock,
        item.historical_stock,
        item.current_stock,
        item.remaining_stock,
        item.stock
      ),
    }));
  }, [report, firstNumber, firstValue]);

  const slowMovingItems = useMemo(() => {
    const list = report?.slow_moving || report?.slow_moving_items || [];
    if (!Array.isArray(list)) return [];
    return list.map((item, index) => ({
      id: item.id || index,
      name: firstValue(item.name, item.item_name, item.product_name, 'Unknown Item'),
      code: firstValue(item.code, item.sku, '—'),
      unitsSold: firstNumber(item.units_sold, item.quantity_sold, item.qty_sold),
      revenue: firstNumber(item.total_revenue, item.revenue, item.amount),
      currentStock: firstNumber(
        item.ending_stock,
        item.period_stock,
        item.historical_stock,
        item.current_stock,
        item.remaining_stock,
        item.stock
      ),
    }));
  }, [report, firstNumber, firstValue]);

  const receiptRecords = useMemo(() => {
    const possible = report?.receipt_details || report?.receipts || report?.transactions || [];
    if (!Array.isArray(possible)) return [];

    return possible.map((receipt, index) => ({
      id: receipt.id || index,
      receiptNumber: firstValue(receipt.receipt_number, receipt.number, `REC-${index + 1}`),
      date: firstValue(receipt.date, receipt.created_at),
      customer: firstValue(receipt.customer_name, receipt.customer, 'Walk-in Customer'),
      amount: firstNumber(receipt.amount, receipt.total),
      paymentMethod: firstValue(receipt.payment_method, receipt.method, 'Not specified'),
      type: 'Sale',
    }));
  }, [report, firstNumber, firstValue]);

  const businessDocuments = useMemo(() => {
    const salesDocs = receiptRecords.map((r) => ({
      id: `sale-${r.id}`,
      date: r.date,
      number: r.receiptNumber,
      type: 'Sales Receipt',
      description: r.customer,
      paymentMethod: r.paymentMethod,
      amount: r.amount,
    }));

    const expenseDocs = expenseData.breakdown
      .filter((e) => e.receiptNumber || e.amount > 0)
      .map((e) => ({
        id: `expense-${e.id}`,
        date: e.date,
        number: e.receiptNumber || `EXP-${e.id}`,
        type: 'Expense Receipt',
        description: e.description || e.name,
        paymentMethod: e.paymentMethod,
        amount: e.amount,
      }));

    return [...salesDocs, ...expenseDocs].sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    );
  }, [receiptRecords, expenseData]);

  const activeInventoryItems = useMemo(() => {
    const rawList =
      inventoryItems.length > 0
        ? inventoryItems
        : report?.item_analytics ||
          report?.inventory_items ||
          report?.inventory?.items ||
          report?.inventory?.stock_items ||
          items;

    if (!Array.isArray(rawList)) return [];

    return rawList
      .filter((invItem) => {
        const createdAt = invItem.created_at || invItem.date_added || invItem.created;
        if (!createdAt) return true;

        const itemDate = new Date(createdAt);
        return !isNaN(itemDate.getTime()) ? itemDate <= reportPeriodEndDate : true;
      })
      .map((invItem) => {
        const openingStock = firstNumber(invItem.opening_stock);
        const restocks = firstNumber(invItem.restocks, invItem.total_restocked);
        const sold = firstNumber(invItem.total_stock_sold, invItem.units_sold, invItem.quantity_sold);
        const remainingStock = firstNumber(
          invItem.remaining_stock,
          invItem.ending_stock,
          invItem.period_stock,
          invItem.current_stock,
          invItem.stock,
          invItem.quantity
        );

        const latestCost = firstNumber(
          invItem.latest_unit_cost,
          invItem.unit_cost_price,
          invItem.cost_price,
          invItem.unit_cost
        );

        const retailPrice = firstNumber(
          invItem.unit_retail_price,
          invItem.unit_selling_price,
          invItem.retail_price,
          invItem.selling_price,
          invItem.price
        );

        const stockValue = remainingStock * latestCost;
        const isLowStock = Boolean(invItem.is_low_stock || remainingStock <= firstNumber(invItem.min_stock_threshold, 5));

        return {
          ...invItem,
          computedOpeningStock: openingStock,
          computedRestocks: restocks,
          computedSold: sold,
          computedRemainingStock: remainingStock,
          computedLatestCost: latestCost,
          computedRetailPrice: retailPrice,
          computedStockValue: stockValue,
          computedIsLowStock: isLowStock,
        };
      });
  }, [inventoryItems, items, report, reportPeriodEndDate, firstNumber]);

  const totalInventoryValuation = useMemo(() => {
    return activeInventoryItems.reduce(
      (total, item) => total + item.computedStockValue,
      0
    );
  }, [activeInventoryItems]);

  const inventoryMovementSummary = useMemo(() => {
    return activeInventoryItems.reduce(
      (acc, item) => {
        const cost = item.computedLatestCost || 0;
        acc.openingValue += (item.computedOpeningStock || 0) * cost;
        acc.restocksValue += (item.computedRestocks || 0) * cost;
        acc.soldValue += (item.computedSold || 0) * cost;
        
        acc.totalOpeningUnits += (item.computedOpeningStock || 0);
        acc.totalRestockUnits += (item.computedRestocks || 0);
        acc.totalSoldUnits += (item.computedSold || 0);
        acc.totalRemainingUnits += (item.computedRemainingStock || 0);

        return acc;
      },
      { 
        openingValue: 0, 
        restocksValue: 0, 
        soldValue: 0,
        totalOpeningUnits: 0,
        totalRestockUnits: 0,
        totalSoldUnits: 0,
        totalRemainingUnits: 0
      }
    );
  }, [activeInventoryItems]);

  const stockMovementTotals = useMemo(() => {
    const openingValue = inventoryMovementSummary.openingValue;
    const restocksValue = inventoryMovementSummary.restocksValue;
    const totalStockValue = openingValue + restocksValue;
    const remainingStockValue = totalInventoryValuation;

    return {
      totalStockValue,
      restocksValue,
      remainingStockValue,
    };
  }, [inventoryMovementSummary, totalInventoryValuation]);

  const paymentChartData = useMemo(() => {
    return [
      { name: 'Cash', value: payments.cash },
      { name: 'Paybill / M-Pesa', value: payments.paybill },
      { name: 'Send Money', value: payments.sendMoney },
      { name: 'Credit Repayments', value: payments.creditRepayments },
    ].filter((item) => item.value > 0);
  }, [payments]);

  const profitabilityChartData = useMemo(() => {
    return [
      { name: 'Revenue', value: Math.abs(financials.revenue), fill: '#4F46E5' },
      { name: 'COGS', value: Math.abs(financials.cogs), fill: '#E11D48' },
      { name: 'Gross Profit', value: Math.abs(financials.grossProfit), fill: '#0EA5E9' },
      { name: 'Expenses', value: Math.abs(financials.expenses), fill: '#F59E0B' },
      { name: 'Net Profit', value: Math.abs(financials.netProfit), fill: '#059669' },
    ];
  }, [financials]);

  const insights = useMemo(() => {
    return Array.isArray(report?.insights) ? report.insights : [];
  }, [report]);

  const formatCurrency = useCallback(
    (value) => {
      const num = numberValue(value);
      const formatted = Math.abs(num).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return num < 0 ? `-KSh ${formatted}` : `KSh ${formatted}`;
    },
    [numberValue]
  );

  const formatPercent = (value) => `${numberValue(value).toFixed(2)}%`;

  const preparePdfClone = () => {
    if (!reportRef.current) throw new Error('Report element is unavailable.');

    const source = reportRef.current;
    const clone = source.cloneNode(true);
    clone.classList.add('pdf-export-mode');

    clone.style.width = '710px';
    clone.style.maxWidth = '710px';
    clone.style.minHeight = '100px';
    clone.style.boxSizing = 'border-box';
    clone.style.margin = '0 auto';
    clone.style.padding = '4px 4px 14px';
    clone.style.backgroundColor = '#ffffff';
    clone.style.color = '#0f172a';
    clone.style.overflow = 'visible';

    clone.querySelectorAll('.no-print').forEach((el) => el.remove());

    const sourceElements = source.querySelectorAll('*');
    const cloneElements = clone.querySelectorAll('*');

    const cleanColor = (val, defaultFallback) => {
      if (!val) return val;
      if (val.includes('oklab') || val.includes('oklch')) {
        return defaultFallback;
      }
      return val;
    };

    cloneElements.forEach((cloneEl, index) => {
      const sourceEl = sourceElements[index];
      if (!sourceEl) return;

      const computed = window.getComputedStyle(sourceEl);

      cloneEl.style.backgroundColor = cleanColor(computed.backgroundColor, '#ffffff');
      cloneEl.style.color = cleanColor(computed.color, '#0f172a');
      cloneEl.style.borderColor = cleanColor(computed.borderColor, '#e2e8f0');

      if (cloneEl.hasAttribute('fill')) {
        const fillVal = cloneEl.getAttribute('fill');
        if (fillVal && (fillVal.includes('oklab') || fillVal.includes('oklch'))) {
          cloneEl.setAttribute('fill', '#4f46e5');
        }
      }
      if (cloneEl.hasAttribute('stroke')) {
        const strokeVal = cloneEl.getAttribute('stroke');
        if (strokeVal && (strokeVal.includes('oklab') || strokeVal.includes('oklch'))) {
          cloneEl.setAttribute('stroke', '#e2e8f0');
        }
      }
    });

    const host = document.createElement('div');
    host.setAttribute('data-pdf-host', 'true');
    host.style.position = 'absolute';
    host.style.top = '0';
    host.style.left = '0';
    host.style.width = '710px';
    host.style.background = '#ffffff';
    host.style.color = '#0f172a';
    host.style.zIndex = '-9999';
    host.style.opacity = '1';
    
    host.appendChild(clone);
    document.body.appendChild(host);

    return { host, clone };
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current || !report || downloading) return;

    setDownloading(true);
    let pdfHost = null;

    const prefix = (reportTitle || 'Report').replace(/[^a-zA-Z0-9]+/g, '_');
    const safeBranch = (branchName || 'All_Branches').replace(/[^a-zA-Z0-9]+/g, '_');
    const periodTag =
      periodType === 'day' || periodType === 'weekly'
        ? selectedDate
        : periodType === 'custom'
        ? `${startDate}_to_${endDate}`
        : periodType === 'month'
        ? `${monthNames[month - 1]}_${year}`
        : `${year}`;

    try {
      await new Promise((resolve) => setTimeout(resolve, 200));

      const html2pdfModule = await import('html2pdf.js');
      const pdfExporter = typeof html2pdfModule.default === 'function' 
        ? html2pdfModule.default 
        : html2pdfModule;

      if (typeof pdfExporter !== 'function') {
        throw new Error('html2pdf.js was not loaded correctly.');
      }

      const prepared = preparePdfClone();
      pdfHost = prepared.host;
      const pdfClone = prepared.clone;

      const opt = {
        margin: [10, 10, 12, 10],
        filename: `${prefix}_${safeBranch}_${periodTag}.pdf`,
        image: {
          type: 'jpeg',
          quality: 0.97,
        },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 710,
          letterRendering: true,
          onclone: (clonedDoc) => {
            const styleTags = clonedDoc.querySelectorAll('style');
            styleTags.forEach((style) => {
              if (style.innerHTML.includes('oklab') || style.innerHTML.includes('oklch')) {
                style.innerHTML = style.innerHTML
                  .replace(/oklab\([^)]+\)/g, '#0f172a')
                  .replace(/oklch\([^)]+\)/g, '#0f172a');
              }
            });
          },
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
          compress: true,
        },
        pagebreak: {
          mode: ['css', 'legacy'],
          before: ['.pdf-page-break-before'],
          after: ['.pdf-page-break-after'],
          avoid: [
            '.report-hero',
            '.kpi-card',
            '.collection-card',
            '.section-heading',
            '.visual-card',
            '.product-panel',
            '.product-row',
            '.insight-card',
            'tr',
          ],
        },
      };

      const worker = pdfExporter().set(opt).from(pdfClone);

      const pdf = await worker.toPdf().get('pdf');
      const totalPages = pdf.internal.getNumberOfPages();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let page = 1; page <= totalPages; page += 1) {
        pdf.setPage(page);

        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.25);
        pdf.line(10, pageHeight - 10, pageWidth - 10, pageHeight - 10);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);

        pdf.text(
          `${branchName || 'Main Operations'} | ${getPeriodLabel()}`,
          10,
          pageHeight - 5.5
        );

        pdf.text(
          `Page ${page} of ${totalPages}`,
          pageWidth - 10,
          pageHeight - 5.5,
          { align: 'right' }
        );
      }

      await worker.save();
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert(`An error occurred while generating the PDF.\n\n${err?.message || err}`);
    } finally {
      if (pdfHost && pdfHost.parentNode) {
        pdfHost.parentNode.removeChild(pdfHost);
      }
      setDownloading(false);
    }
  };

  return (
    <div className="reports-wrapper space-y-6 text-slate-800 font-sans w-full max-w-7xl mx-auto p-4 md:p-6 text-sm">
      <div className="no-print bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Business Intelligence & Advisory Reports</h2>
            <p className="text-sm text-slate-500 mt-1">A visual financial sales and inventory report for the selected period.</p>
          </div>
          {report && !loading && (
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs md:text-sm font-semibold px-4 py-2.5 rounded-lg transition shadow-sm"
            >
              {downloading ? 'Exporting PDF...' : 'Download PDF Report'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-xs md:text-sm">
          <div className="lg:col-span-2">
            <label className="block font-semibold text-slate-600 mb-1">Report Title</label>
            <input type="text" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 text-sm" />
          </div>
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Branch</label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => { setBranchName(e.target.value); setBranchId(null); }}
              placeholder="All Branches"
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 text-sm"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-600 mb-1">Period</label>
            <select value={periodType} onChange={(e) => handlePeriodChange(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-lg font-semibold text-indigo-700 focus:ring-1 focus:ring-indigo-500 text-sm">
              <option value="day">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-600 mb-1">
              {periodType === 'custom' ? 'Date Range' : 'Select Date'}
            </label>
            {(periodType === 'day' || periodType === 'weekly') && (
              <input type="date" value={selectedDate} onChange={handleDateChange} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm" />
            )}
            {periodType === 'custom' && (
              <div className="flex gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={handleStartDateChange}
                  className="w-1/2 p-2 border border-slate-300 rounded-lg text-xs"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={handleEndDateChange}
                  className="w-1/2 p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            )}
            {periodType === 'month' && (
              <div className="flex gap-1.5">
                <select value={month} onChange={(e) => handleMonthChange(Number(e.target.value))} className="w-1/2 p-2.5 border border-slate-300 rounded-lg text-sm">
                  {monthNames.map((name, idx) => <option key={idx + 1} value={idx + 1}>{name.slice(0, 3)}</option>)}
                </select>
                <select value={year} onChange={(e) => handleYearChange(Number(e.target.value))} className="w-1/2 p-2.5 border border-slate-300 rounded-lg text-sm">
                  {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}
            {periodType === 'year' && (
              <select value={year} onChange={(e) => handleYearChange(Number(e.target.value))} className="w-full p-2.5 border border-slate-300 rounded-lg text-sm">
                {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      {error && <div className="no-print p-4 bg-rose-50 text-rose-800 border border-rose-200 text-sm rounded-xl">{error}</div>}

      {loading ? (
        <div className="no-print p-16 flex flex-col items-center justify-center text-slate-500 text-base gap-3">
          <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="font-medium">Loading report content...</span>
        </div>
      ) : report ? (
        <div
          ref={reportRef}
          className="printable-document bg-white p-6 md:p-8 rounded-2xl border border-slate-200 space-y-7 text-slate-800 w-full shadow-lg"
          style={{ backgroundColor: '#ffffff', color: '#1e293b' }}
        >
          <div className="page-section report-hero rounded-2xl overflow-hidden">
            <div className="report-hero-main">
              <div>
                <div className="report-eyebrow">BUSINESS PERFORMANCE REPORT</div>
                <h1>{branchName ? `${branchName} Branch` : 'Main Operations'}</h1>
                <p>{reportTitle}</p>
              </div>
              <div className="report-period-pill">{getPeriodLabel()}</div>
            </div>
            <div className="report-hero-strip">
              <span>Revenue <strong>{formatCurrency(financials.revenue)}</strong></span>
              <span>Gross Margin <strong>{formatPercent(financials.grossMargin)}</strong></span>
              <span>Net Margin <strong>{formatPercent(financials.netMargin)}</strong></span>
              <span>Total Cash Inflow <strong>{formatCurrency(payments.totalCollected)}</strong></span>
            </div>
          </div>

          <div className="page-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">01 · OVERVIEW</span>
                <h2>Executive Performance</h2>
              </div>
              <span className="section-note">{getPeriodLabel()}</span>
            </div>

            <div className="kpi-grid-container">
              {[
                ['Revenue', financials.revenue, '100% sales volume', 'indigo'],
                ['COGS', financials.cogs, `${formatPercent(financials.cogsRatio)} of revenue`, 'rose'],
                ['Gross Profit', financials.grossProfit, `${formatPercent(financials.grossMargin)} margin`, 'sky'],
                ['Expenses', financials.expenses, `${formatPercent(financials.opexRatio)} of revenue`, 'amber'],
                ['Net Profit', financials.netProfit, `${formatPercent(financials.netMargin)} net margin`, 'emerald'],
              ].map(([label, value, sub, tone]) => (
                <div key={label} className={`kpi-card kpi-${tone}`}>
                  <div className="kpi-accent"></div>
                  <p className="kpi-label">{label}</p>
                  <p className="kpi-value">{formatCurrency(value)}</p>
                  <p className="kpi-sub">{sub}</p>
                </div>
              ))}
            </div>

            <div className="metric-ribbon">
              <div><span>Gross Margin</span><strong>{formatPercent(financials.grossMargin)}</strong><div className="metric-track"><i style={{ width: `${Math.min(100, Math.max(0, financials.grossMargin))}%` }} /></div></div>
              <div><span>Net Margin</span><strong>{formatPercent(financials.netMargin)}</strong><div className="metric-track"><i style={{ width: `${Math.min(100, Math.max(0, financials.netMargin))}%` }} /></div></div>
              <div><span>COGS Ratio</span><strong>{formatPercent(financials.cogsRatio)}</strong><div className="metric-track"><i style={{ width: `${Math.min(100, Math.max(0, financials.cogsRatio))}%` }} /></div></div>
            </div>
          </div>

          <div className="page-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">02 · FINANCIALS</span>
                <h2>Financial Performance & Cash Flow</h2>
              </div>
              <span className="section-note">KSh values</span>
            </div>

            <div className="chart-card-box visual-card w-full">
              <div className="chart-title-row">
                <div><h3>Profitability & Cost Breakdown</h3><p>Revenue, COGS, Gross Profit, Expenses & Net Profit</p></div>
                <span className="chart-badge green">{formatPercent(financials.netMargin)} net margin</span>
              </div>
              <div className="responsive-chart-container chart-container-wrapper" style={{ width: '100%', height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={profitabilityChartData}
                    margin={{ top: 20, right: 24, left: 28, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600, fill: '#334155' }} interval={0} />
                    <YAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(val) => `KSh ${(val / 1000).toFixed(0)}k`} width={70} />
                    <Tooltip formatter={(val) => [formatCurrency(val), 'Amount']} />
                    <Bar
                      dataKey="value"
                      radius={[6, 6, 0, 0]}
                      barSize={36}
                      minPointSize={10}
                      isAnimationActive={false}>
                      {profitabilityChartData.map((entry, index) => (
                        <Cell key={`profit-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="page-section">
            <div className="section-heading">
              <div><span className="section-kicker">03 · COLLECTIONS & RECEIVABLES</span><h2>Payment Methods & Cash Flow</h2></div>
              <span className="section-total">Total Inflow: {formatCurrency(payments.totalCollected)}</span>
            </div>

            <div className="collection-grid mb-4">
              {[
                ['Cash', payments.cash, 'cash', '#059669', '#ecfdf5', '#10b981'],
                ['Paybill / M-Pesa', payments.paybill, 'paybill', '#4f46e5', '#eef2ff', '#6366f1'],
                ['Send Money', payments.sendMoney, 'send', '#d97706', '#fffbeb', '#f59e0b'],
                ['Credit Repayments', payments.creditRepayments, 'credit', '#7c3aed', '#f5f3ff', '#8b5cf6'],
              ].map(([label, amount, tone, textColor, bgColor, barColor]) => {
                const pct = payments.totalCollected > 0 ? (amount / payments.totalCollected) * 100 : 0;
                return (
                  <div className="collection-card group hover:shadow-sm transition-all duration-200" key={label}>
                    <div className="collection-icon" style={{ color: textColor, backgroundColor: bgColor }}>
                      {label.slice(0, 1)}
                    </div>
                    <div className="collection-info">
                      <span className="text-slate-500 font-semibold">{label}</span>
                      <strong className="text-slate-900 text-xs">{formatCurrency(amount)}</strong>
                      <div className="collection-track overflow-hidden rounded-full" style={{ backgroundColor: '#f1f5f9' }}>
                        <i 
                          className="transition-all duration-500 rounded-full block h-full" 
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: barColor }} 
                        />
                      </div>
                    </div>
                    <span 
                      className="text-[10px] font-bold px-2 py-1 rounded-md" 
                      style={{ color: textColor, backgroundColor: bgColor, border: `1px solid ${barColor}33` }}
                    >
                      {formatPercent(pct)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-3">
                Accounts Receivable (Outstanding Debt Flow)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="block text-[10px] font-bold uppercase text-slate-500">New Debt Issued</span>
                  <strong className="block text-sm font-extrabold text-amber-600 mt-1">
                    {formatCurrency(payments.accountsReceivable.newDebtIssued)}
                  </strong>
                  <span className="block text-[10px] text-slate-400 mt-0.5">Credit sales initiated in period</span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="block text-[10px] font-bold uppercase text-slate-500">Debt Recovered</span>
                  <strong className="block text-sm font-extrabold text-emerald-600 mt-1">
                    {formatCurrency(payments.accountsReceivable.debtRecovered)}
                  </strong>
                  <span className="block text-[10px] text-slate-400 mt-0.5">Repayments collected in period</span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="block text-[10px] font-bold uppercase text-slate-500">Net Receivable Change</span>
                  <strong className={`block text-sm font-extrabold mt-1 ${payments.accountsReceivable.netReceivableChange > 0 ? 'text-rose-600' : 'text-indigo-600'}`}>
                    {formatCurrency(payments.accountsReceivable.netReceivableChange)}
                  </strong>
                  <span className="block text-[10px] text-slate-400 mt-0.5">New Debt Issued - Debt Recovered</span>
                </div>
              </div>
            </div>

            <div className="chart-card-box visual-card w-full mt-4">
              <div className="chart-title-row">
                <div><h3>Cash Collection Mix</h3><p>Distribution across payment channels (including repayments on payment date)</p></div>
                <span className="chart-badge indigo">{formatCurrency(payments.totalCollected)}</span>
              </div>
              <div className="responsive-chart-container chart-container-wrapper" style={{ width: '100%', height: '240px' }}>
                {paymentChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentChartData}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {paymentChartData.map((entry, index) => <Cell key={`payment-${entry.name}-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(val) => [formatCurrency(val), 'Amount']} />
                      <Legend verticalAlign="bottom" height={32} iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="empty-chart">No payment data recorded.</div>}
              </div>
            </div>
          </div>

          <div className="page-section">
            <div className="section-heading">
              <div><span className="section-kicker">04 · COST CONTROL</span><h2>Operating Expenses</h2></div>
              <span className="section-total expense-total">{formatCurrency(expenseData.totalExpenses)}</span>
            </div>

            <div className="table-card">
              <div className="mini-card-title">Expense Register</div>
              <table className="report-table">
                <thead><tr><th style={{ width: '18%' }}>Date</th><th style={{ width: '42%' }}>Expense</th><th style={{ width: '20%' }}>Payment Method</th><th style={{ width: '20%' }} className="text-right">Amount</th></tr></thead>
                <tbody>
                  {expenseData.breakdown.length > 0 ? expenseData.breakdown.map((expense) => (
                    <tr key={expense.id}>
                      <td>{expense.date ? new Date(expense.date).toLocaleDateString() : '—'}</td>
                      <td className="font-medium">{expense.name}</td>
                      <td>{expense.paymentMethod}</td>
                      <td className="text-right font-bold text-rose-700">{formatCurrency(expense.amount)}</td>
                    </tr>
                  )) : <tr><td colSpan="4" className="empty-cell">No expense records available.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="page-section">
            <div className="section-heading">
              <div><span className="section-kicker">05 · SALES MIX</span><h2>Product Performance</h2></div>
              <span className="section-note">Fast vs slow moving</span>
            </div>

            <div className="product-grid">
              <div className="product-panel fast-panel">
                <div className="panel-title"><span className="status-dot healthy"></span><div><h3>Fast Moving</h3><p>Products generating activity</p></div></div>
                {fastMovingItems.length > 0 ? fastMovingItems.slice(0, 6).map((item, idx) => {
                  const max = Math.max(...fastMovingItems.map((x) => x.unitsSold), 1);
                  return (
                    <div className="product-row" key={item.id}>
                      <div className="product-rank">{idx + 1}</div>
                      <div className="product-main"><strong>{item.name}</strong><span>{item.unitsSold} units · {formatCurrency(item.revenue)}</span><div className="product-track"><i style={{ width: `${Math.min(100, (item.unitsSold / max) * 100)}%` }} /></div></div>
                    </div>
                  );
                }) : <div className="empty-cell">No fast moving data available.</div>}
              </div>

              <div className="product-panel slow-panel">
                <div className="panel-title"><span className="status-dot warning"></span><div><h3>Slow / At-Risk</h3><p>Items needing attention</p></div></div>
                {slowMovingItems.length > 0 ? slowMovingItems.slice(0, 6).map((item, idx) => (
                  <div className="product-row" key={item.id}>
                    <div className="product-rank warning-rank">{idx + 1}</div>
                    <div className="product-main"><strong>{item.name}</strong><span>{item.unitsSold} units sold · {item.currentStock} in stock</span><div className="product-track warning-track"><i style={{ width: `${Math.min(100, Math.max(5, item.currentStock * 5))}%` }} /></div></div>
                  </div>
                )) : <div className="empty-cell">No slow moving data available.</div>}
              </div>
            </div>
          </div>

          <div className="page-section">
            <div className="section-heading">
              <div><span className="section-kicker">06 · AUDIT TRAIL</span><h2>Business Documents</h2></div>
              <span className="section-total">{businessDocuments.length} records</span>
            </div>
            <div className="table-card">
              <table className="report-table">
                <thead><tr><th style={{ width: '14%' }}>Date</th><th style={{ width: '22%' }}>Number</th><th style={{ width: '16%' }}>Type</th><th style={{ width: '20%' }}>Customer / Ref</th><th style={{ width: '12%' }}>Method</th><th style={{ width: '16%' }} className="text-right">Amount</th></tr></thead>
                <tbody>
                  {businessDocuments.length > 0 ? businessDocuments.map((doc) => (
                    <tr key={doc.id}>
                      <td>{doc.date ? new Date(doc.date).toLocaleDateString() : '—'}</td>
                      <td className="font-mono font-semibold text-indigo-700">{doc.number}</td>
                      <td><span className={`doc-tag ${doc.type === 'Expense Receipt' ? 'expense' : 'sale'}`}>{doc.type}</span></td>
                      <td>{doc.description}</td>
                      <td>{doc.paymentMethod}</td>
                      <td className={`text-right font-bold ${doc.type === 'Expense Receipt' ? 'text-rose-700' : 'text-emerald-700'}`}>{formatCurrency(doc.amount)}</td>
                    </tr>
                  )) : <tr><td colSpan="6" className="empty-cell">No transactions recorded for this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* =========================================================
              07 · INVENTORY TABLE & MOVEMENT SUMMARY
          ========================================================= */}
          <div className="page-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">07 · INVENTORY</span>
                <h2>Stock Status & Valuation</h2>
              </div>
              <span className="section-total">
                Total Stock Valuation: {formatCurrency(totalInventoryValuation)}
              </span>
            </div>

            {/* Inventory Table First */}
            <div className="table-card inventory-table">
              <table className="report-table">
                <thead>
                  <tr>
                    <th style={{ width: '24%' }}>Item Name</th>
                    <th style={{ width: '11%' }} className="text-right">Opening</th>
                    <th style={{ width: '11%' }} className="text-right">Restocks</th>
                    <th style={{ width: '10%' }} className="text-right">Sold</th>
                    <th style={{ width: '13%' }} className="text-right">Remaining</th>
                    <th style={{ width: '14%' }} className="text-right">Latest Cost</th>
                    <th style={{ width: '14%' }} className="text-right">Retail Price</th>
                    <th style={{ width: '15%' }} className="text-right">Stock Value</th>
                  </tr>
                </thead>
                <tbody>
                  {activeInventoryItems.length > 0 ? (
                    activeInventoryItems.map((invItem, idx) => {
                      const name = firstValue(invItem.name, invItem.item_name, 'Unnamed Item');
                      const sku = invItem.sku || invItem.code || null;

                      return (
                        <tr
                          key={invItem.id || idx}
                          className={invItem.computedIsLowStock ? 'bg-amber-500/10' : ''}
                        >
                          <td className="font-semibold text-slate-900">
                            <div>{name}</div>
                            {sku && <div className="text-[9px] font-mono text-slate-400">{sku}</div>}
                          </td>
                          <td className="text-right">{invItem.computedOpeningStock}</td>
                          <td className="text-right font-medium text-indigo-700">{invItem.computedRestocks}</td>
                          <td className="text-right text-slate-600">{invItem.computedSold}</td>
                          <td className="text-right font-bold">
                            <span
                              className={`px-1.5 py-0.5 rounded ${
                                invItem.computedIsLowStock
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {invItem.computedRemainingStock}
                            </span>
                          </td>
                          <td className="text-right font-medium">{formatCurrency(invItem.computedLatestCost)}</td>
                          <td className="text-right">{formatCurrency(invItem.computedRetailPrice)}</td>
                          <td className="text-right font-bold text-slate-900">
                            {formatCurrency(invItem.computedStockValue)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" className="empty-cell">
                        No inventory records available for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
                {activeInventoryItems.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                      <td colSpan="7" className="text-right uppercase text-[9px] text-slate-600">
                        Total Stock Valuation:
                      </td>
                      <td className="text-right text-indigo-700 font-extrabold text-xs">
                        {formatCurrency(totalInventoryValuation)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Inventory Stock & Valuation Movement Summary Cards */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-3">
                Stock Valuation & Movement Summary (At Cost Price)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="block text-[10px] font-bold uppercase text-slate-500">
                    Total Opening Stock Value
                  </span>
                  <strong className="block text-sm font-extrabold text-indigo-600 mt-1">
                    {formatCurrency(inventoryMovementSummary.openingValue)}
                  </strong>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Initial stock value for period
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="block text-[10px] font-bold uppercase text-slate-500">
                    Total Restocks Value
                  </span>
                  <strong className="block text-sm font-extrabold text-emerald-600 mt-1">
                    {formatCurrency(inventoryMovementSummary.restocksValue)}
                  </strong>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Inbound inventory added
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="block text-[10px] font-bold uppercase text-slate-500">
                    Total Stock Value
                  </span>
                  <strong className="block text-sm font-extrabold text-indigo-700 mt-1">
                    {formatCurrency(stockMovementTotals.totalStockValue)}
                  </strong>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Opening Value + Restocks Value
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="block text-[10px] font-bold uppercase text-slate-500">
                    Total Value of Goods Sold
                  </span>
                  <strong className="block text-sm font-extrabold text-rose-600 mt-1">
                    {formatCurrency(inventoryMovementSummary.soldValue)}
                  </strong>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Cost value of stock sold
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="block text-[10px] font-bold uppercase text-slate-500">
                    Total Remaining Stock Value
                  </span>
                  <strong className="block text-sm font-extrabold text-slate-900 mt-1">
                    {formatCurrency(totalInventoryValuation)}
                  </strong>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Closing inventory valuation balance
                  </span>
                </div>
              </div>
            </div>
          </div>

          {insights.length > 0 && (
            <div className="page-section">
              <div className="section-heading">
                <div><span className="section-kicker">08 · ADVISORY</span><h2>Decision Insights & Action Plan</h2></div>
                <span className="section-note">Automated from report metrics</span>
              </div>
              <div className="insight-grid">
                {insights.map((insight, idx) => (
                  <div key={idx} className="insight-card">
                    <div className="insight-number">{String(idx + 1).padStart(2, '0')}</div>
                    <div><h3>{insight.title}</h3><p>{insight.advice}</p></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="report-footer">
            <span>{branchName || 'Main Operations'} · {getPeriodLabel()}</span>
            <span>Business Intelligence Report</span>
          </div>
        </div>
      ) : null}

      <style>{`
        :root {
          --primary-bg: #0f172a;
          --card-bg: #ffffff;
          --muted-bg: #f8fafc;
          --border-color: #e2e8f0;
          --text-primary: #0f172a;
          --text-secondary: #64748b;
          --text-muted: #94a3b8;
          
          --accent-indigo: #4f46e5;
          --accent-emerald: #10b981;
          --accent-rose: #e11d48;
          --accent-amber: #f59e0b;
          --accent-sky: #0ea5e9;
        }

        * { 
          box-sizing: border-box !important; 
        }

        .printable-document {
          width: 100% !important;
          max-width: 710px !important;
          margin: 0 auto !important;
          padding: 8px !important;
          background: #ffffff !important;
          color: #0f172a !important;
          overflow: visible !important;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif !important;
          line-height: 1.35 !important;
        }

        .page-section {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 0 12px !important;
          overflow: visible !important;
          page-break-inside: auto !important;
          break-inside: auto !important;
        }

        .report-hero {
          width: 100% !important;
          margin: 0 0 10px !important;
          border: 0 !important;
          border-radius: 10px !important;
          overflow: hidden !important;
          background: var(--primary-bg) !important;
          color: #ffffff !important;
          box-shadow: none !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .report-hero-main {
          min-height: 95px;
          padding: 18px 20px 14px !important;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: nowrap;
        }

        .report-eyebrow {
          margin: 0 0 4px !important;
          color: #93c5fd !important;
          font-size: 9.5px !important;
          line-height: 1.2 !important;
          font-weight: 800 !important;
          letter-spacing: 1.5px !important;
          text-transform: uppercase;
        }

        .report-hero h1 {
          margin: 0 !important;
          color: #ffffff !important;
          font-size: 22px !important;
          line-height: 1.15 !important;
          font-weight: 800 !important;
          word-break: break-word !important;
        }

        .report-hero p {
          margin: 4px 0 0 !important;
          color: var(--text-muted) !important;
          font-size: 11px !important;
          line-height: 1.3 !important;
        }

        .report-period-pill {
          flex: 0 0 auto;
          margin-top: 2px;
          padding: 5px 10px !important;
          border: 1px solid #334155 !important;
          border-radius: 999px !important;
          background: #1e293b !important;
          color: #f1f5f9 !important;
          font-size: 9.5px !important;
          line-height: 1.2 !important;
          font-weight: 800 !important;
          white-space: nowrap !important;
        }

        .report-hero-strip {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 1px !important;
          width: 100% !important;
          background: #334155 !important;
        }

        .report-hero-strip span {
          min-width: 0;
          padding: 10px 12px !important;
          background: #1e293b !important;
          color: var(--text-muted) !important;
          font-size: 9px !important;
          font-weight: 700 !important;
        }

        .report-hero-strip strong {
          display: block;
          margin-top: 3px !important;
          color: #ffffff !important;
          font-size: 11.5px !important;
          font-weight: 800 !important;
          word-break: break-word !important;
        }

        .section-heading {
          display: flex !important;
          justify-content: space-between !important;
          align-items: flex-end !important;
          gap: 10px !important;
          margin: 0 0 6px !important;
          padding: 0 0 3px !important;
          border-bottom: 2px solid var(--border-color) !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          page-break-after: avoid !important;
          break-after: avoid !important;
        }

        .section-heading h2 {
          margin: 2px 0 0 !important;
          color: var(--text-primary) !important;
          font-size: 15px !important;
          line-height: 1.2 !important;
          font-weight: 800 !important;
        }

        .section-kicker {
          color: var(--accent-indigo) !important;
          font-size: 8.5px !important;
          line-height: 1 !important;
          font-weight: 800 !important;
          letter-spacing: 1px !important;
          text-transform: uppercase;
        }

        .section-note,
        .section-total {
          color: var(--text-secondary) !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          white-space: nowrap !important;
        }

        .section-total {
          color: #059669 !important;
          font-size: 11px !important;
        }

        .expense-total { 
          color: var(--accent-rose) !important; 
        }

        .kpi-grid-container {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 8px !important;
          width: 100% !important;
          margin: 0 0 8px !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .kpi-card {
          position: relative;
          min-width: 0;
          min-height: 74px;
          padding: 10px 8px 8px 12px !important;
          border: 1px solid var(--border-color) !important;
          border-radius: 8px !important;
          background: var(--muted-bg) !important;
          overflow: hidden !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .kpi-accent {
          position: absolute;
          left: 0;
          top: 0;
          width: 3px;
          height: 100%;
          background: var(--accent-indigo);
        }

        .kpi-rose .kpi-accent { background: var(--accent-rose); }
        .kpi-sky .kpi-accent { background: var(--accent-sky); }
        .kpi-amber .kpi-accent { background: var(--accent-amber); }
        .kpi-emerald .kpi-accent { background: var(--accent-emerald); }

        .kpi-label {
          margin: 0 !important;
          color: var(--text-secondary) !important;
          font-size: 8.5px !important;
          line-height: 1.1 !important;
          font-weight: 800 !important;
          letter-spacing: .4px !important;
          text-transform: uppercase !important;
        }

        .kpi-value {
          margin: 4px 0 0 !important;
          color: var(--text-primary) !important;
          font-size: 12px !important;
          line-height: 1.15 !important;
          font-weight: 800 !important;
          word-break: break-word !important;
        }

        .kpi-sub {
          margin: 3px 0 0 !important;
          color: var(--text-secondary) !important;
          font-size: 8px !important;
          line-height: 1.15 !important;
          font-weight: 600 !important;
        }

        .metric-ribbon {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 12px !important;
          margin-top: 8px !important;
          padding: 10px 12px !important;
          border: 1px solid var(--border-color) !important;
          border-radius: 8px !important;
          background: var(--muted-bg) !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .metric-ribbon span {
          color: var(--text-secondary) !important;
          font-size: 9px !important;
          font-weight: 700 !important;
        }

        .metric-ribbon strong {
          float: right;
          color: var(--text-primary) !important;
          font-size: 10px !important;
        }

        .metric-track,
        .collection-track,
        .product-track {
          height: 3px !important;
          margin-top: 5px !important;
          background: var(--border-color) !important;
          border-radius: 99px !important;
          overflow: hidden !important;
        }

        .metric-track i,
        .collection-track i,
        .product-track i {
          display: block;
          height: 100%;
          border-radius: 99px;
        }

        .metric-track i { background: var(--accent-indigo) !important; }

        .visual-card {
          width: 100% !important;
          height: auto !important;
          max-height: none !important;
          padding: 12px 16px !important;
          margin-bottom: 12px !important;
          border: 1px solid var(--border-color) !important;
          border-radius: 12px !important;
          background: var(--card-bg) !important;
          overflow: visible !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .chart-container-wrapper,
        .recharts-responsive-container {
          width: 100% !important;
          height: 240px !important;
          max-height: 240px !important;
          min-height: 240px !important;
          margin: 0 auto !important;
          position: relative !important;
        }

        .recharts-wrapper,
        .recharts-surface,
        .visual-card canvas,
        .visual-card svg {
          overflow: visible !important;
        }

        .chart-title-row {
          display: flex !important;
          justify-content: space-between !important;
          align-items: flex-start !important;
          gap: 8px !important;
          margin-bottom: 6px !important;
        }

        .chart-title-row h3 {
          margin: 0 !important;
          color: #1e293b !important;
          font-size: 11px !important;
          line-height: 1.2 !important;
          font-weight: 800 !important;
          letter-spacing: .4px !important;
          text-transform: uppercase !important;
        }

        .chart-title-row p {
          margin: 2px 0 0 !important;
          color: var(--text-secondary) !important;
          font-size: 8.5px !important;
        }

        .chart-badge {
          padding: 3px 8px !important;
          border-radius: 999px !important;
          font-size: 8.5px !important;
          line-height: 1.2 !important;
          font-weight: 800 !important;
          white-space: nowrap !important;
        }

        .chart-badge.green { color: #047857 !important; background: #d1fae5 !important; }
        .chart-badge.indigo { color: #4338ca !important; background: #e0e7ff !important; }

        .empty-chart,
        .empty-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 45px;
          padding: 8px !important;
          color: var(--text-muted) !important;
          font-size: 9.5px !important;
          text-align: center !important;
        }

        .collection-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)) !important;
          gap: 8px !important;
          width: 100% !important;
          margin-bottom: 10px !important;
          page-break-inside: auto !important;
          break-inside: auto !important;
        }

        .collection-card {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          min-width: 0 !important;
          padding: 8px 10px !important;
          border: 1px solid var(--border-color) !important;
          border-radius: 8px !important;
          background: var(--card-bg) !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .collection-icon {
          width: 26px !important;
          height: 26px !important;
          border-radius: 6px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex: 0 0 auto !important;
          color: #ffffff !important;
          font-size: 10px !important;
          font-weight: 800 !important;
          background: #64748b !important;
        }

        .collection-icon.cash { background: var(--accent-emerald) !important; }
        .collection-icon.paybill { background: #6366f1 !important; }
        .collection-icon.send { background: var(--accent-amber) !important; }
        .collection-icon.credit { background: #8b5cf6 !important; }

        .collection-info { 
          flex: 1 !important; 
          min-width: 0 !important; 
        }

        .collection-info span {
          display: block;
          color: var(--text-secondary) !important;
          font-size: 8px !important;
          font-weight: 700 !important;
        }

        .collection-info strong {
          display: block;
          margin-top: 2px !important;
          color: var(--text-primary) !important;
          font-size: 10px !important;
          line-height: 1.15 !important;
          font-weight: 800 !important;
          word-break: break-word !important;
        }

        .table-card {
          width: 100% !important;
          margin-bottom: 10px !important;
          border: 1px solid var(--border-color) !important;
          border-radius: 8px !important;
          background: var(--card-bg) !important;
          overflow: visible !important;
          page-break-inside: auto !important;
          break-inside: auto !important;
        }

        .mini-card-title {
          padding: 8px 10px !important;
          border-bottom: 1px solid var(--border-color) !important;
          background: var(--muted-bg) !important;
          color: #334155 !important;
          font-size: 9px !important;
          line-height: 1.2 !important;
          font-weight: 800 !important;
          letter-spacing: .5px !important;
          text-transform: uppercase !important;
        }

        .report-table {
          width: 100% !important;
          border-collapse: collapse !important;
          table-layout: fixed !important;
        }

        .report-table th,
        .report-table td {
          padding: 6px 8px !important;
          border-bottom: 1px solid #f1f5f9 !important;
          color: #334155 !important;
          font-size: 9px !important;
          line-height: 1.25 !important;
          vertical-align: middle !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
        }

        .report-table th {
          background: #f1f5f9 !important;
          color: #475569 !important;
          font-size: 8px !important;
          font-weight: 800 !important;
          letter-spacing: .3px !important;
          text-transform: uppercase !important;
        }

        .report-table tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .report-table tr:last-child td { 
          border-bottom: 0 !important; 
        }

        .product-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 8px !important;
          width: 100% !important;
          margin-bottom: 10px !important;
          page-break-inside: auto !important;
          break-inside: auto !important;
        }

        .product-panel {
          min-width: 0 !important;
          padding: 10px !important;
          border: 1px solid var(--border-color) !important;
          border-radius: 8px !important;
          background: var(--card-bg) !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .panel-title {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          margin-bottom: 6px !important;
        }

        .panel-title h3 {
          margin: 0 !important;
          color: #1e293b !important;
          font-size: 10px !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
        }

        .panel-title p {
          margin: 2px 0 0 !important;
          color: var(--text-secondary) !important;
          font-size: 8px !important;
        }

        .status-dot {
          width: 7px !important;
          height: 7px !important;
          border-radius: 50% !important;
          background: var(--accent-emerald) !important;
        }

        .status-dot.warning { background: var(--accent-amber) !important; }

        .product-row {
          display: flex !important;
          gap: 6px !important;
          padding: 5px 0 !important;
          border-top: 1px solid #f1f5f9 !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .product-rank {
          width: 20px !important;
          height: 20px !important;
          border-radius: 5px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex: 0 0 auto !important;
          background: #d1fae5 !important;
          color: #047857 !important;
          font-size: 8.5px !important;
          font-weight: 800 !important;
        }

        .warning-rank { 
          background: #fef3c7 !important; 
          color: #b45309 !important; 
        }

        .product-main { 
          flex: 1 !important; 
          min-width: 0 !important; 
        }

        .product-main strong {
          display: block !important;
          color: var(--text-primary) !important;
          font-size: 9.5px !important;
          line-height: 1.25 !important;
          white-space: normal !important;
          overflow: visible !important;
          text-overflow: clip !important;
          word-break: break-word !important;
        }

        .product-main span {
          display: block !important;
          margin-top: 2px !important;
          color: var(--text-secondary) !important;
          font-size: 8px !important;
        }

        .doc-tag {
          display: inline-block !important;
          padding: 2px 5px !important;
          border-radius: 4px !important;
          font-size: 7.5px !important;
          line-height: 1.2 !important;
          font-weight: 800 !important;
          white-space: nowrap !important;
        }

        .doc-tag.sale { background: #d1fae5 !important; color: #047857 !important; }
        .doc-tag.expense { background: #ffe4e6 !important; color: #be123c !important; }
        .doc-tag.warning { background: #fef3c7 !important; color: #b45309 !important; }

        .insight-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 8px !important;
          width: 100% !important;
          margin-bottom: 10px !important;
          page-break-inside: auto !important;
          break-inside: auto !important;
        }

        .insight-card {
          display: flex !important;
          min-width: 0 !important;
          gap: 8px !important;
          padding: 10px !important;
          border: 1px solid #e0e0ff !important;
          border-radius: 8px !important;
          background: var(--muted-bg) !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .insight-number {
          width: 22px !important;
          height: 22px !important;
          border-radius: 5px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex: 0 0 auto !important;
          background: var(--accent-indigo) !important;
          color: #ffffff !important;
          font-size: 8.5px !important;
          font-weight: 800 !important;
        }

        .insight-card h3 {
          margin: 0 !important;
          color: #1e1b4b !important;
          font-size: 10px !important;
          line-height: 1.2 !important;
          font-weight: 800 !important;
        }

        .insight-card p {
          margin: 3px 0 0 !important;
          color: #3730a3 !important;
          font-size: 8px !important;
          line-height: 1.35 !important;
          word-break: break-word !important;
        }

        .report-footer {
          display: flex !important;
          justify-content: space-between !important;
          gap: 8px !important;
          margin-top: 8px !important;
          padding-top: 8px !important;
          border-top: 1px solid var(--border-color) !important;
          color: var(--text-muted) !important;
          font-size: 7.5px !important;
          line-height: 1.2 !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: .4px !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .pdf-export-mode {
          font-size: 9px !important;
          line-height: 1.4 !important;
          color: #0f172a !important;
          width: 710px !important;
          max-width: 710px !important;
          margin: 0 auto !important;
          padding: 4px 4px 14px !important;
          background: #ffffff !important;
          overflow: visible !important;
        }

        .pdf-export-mode .report-eyebrow {
          font-size: 9px !important;
          letter-spacing: 1.5px !important;
        }

        .pdf-export-mode .report-hero h1 {
          font-size: 23px !important;
          line-height: 1.15 !important;
        }

        .pdf-export-mode .report-hero p {
          font-size: 11px !important;
        }

        .pdf-export-mode .report-period-pill {
          font-size: 8.5px !important;
          padding: 5px 10px !important;
        }

        .pdf-export-mode .report-hero-main {
          min-height: 100px !important;
          padding: 18px 20px 14px !important;
        }

        .pdf-export-mode .report-hero-strip {
          background: #475569 !important;
        }

        .pdf-export-mode .report-hero-strip span {
          font-size: 8px !important;
          padding: 9px 10px !important;
          background: #172033 !important;
        }

        .pdf-export-mode .report-hero-strip strong {
          font-size: 11px !important;
          font-variant-numeric: tabular-nums !important;
        }

        .pdf-export-mode .report-hero {
          margin-bottom: 12px !important;
          border-radius: 10px !important;
          border-top: 4px solid #6366f1 !important;
        }

        .pdf-export-mode .kpi-grid-container {
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          gap: 6px !important;
        }

        .pdf-export-mode .kpi-card {
          min-height: 78px !important;
          padding: 10px 6px 8px 10px !important;
          border-radius: 8px !important;
        }

        .pdf-export-mode .kpi-label {
          font-size: 8px !important;
          letter-spacing: 0.3px !important;
        }

        .pdf-export-mode .kpi-value {
          font-size: 11px !important;
          line-height: 1.2 !important;
          margin-top: 4px !important;
        }

        .pdf-export-mode .kpi-sub {
          font-size: 7.5px !important;
          margin-top: 3px !important;
        }

        .pdf-export-mode .section-kicker {
          font-size: 8px !important;
        }

        .pdf-export-mode .section-heading h2 {
          font-size: 15px !important;
          line-height: 1.2 !important;
        }

        .pdf-export-mode .section-note,
        .pdf-export-mode .section-total {
          font-size: 9px !important;
        }

        .pdf-export-mode .page-section {
          margin-bottom: 12px !important;
        }

        .pdf-export-mode .section-heading {
          margin-bottom: 7px !important;
          padding-bottom: 4px !important;
          border-bottom: 2px solid #dbe2ea !important;
        }

        .pdf-export-mode .visual-card {
          padding: 10px 12px !important;
          border: 1px solid #dbe2ea !important;
          border-radius: 99px !important;
          background: #ffffff !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
        }

        .pdf-export-mode .chart-title-row {
          padding-bottom: 6px !important;
          margin-bottom: 5px !important;
          border-bottom: 1px solid #eef2f7 !important;
        }

        .pdf-export-mode .chart-title-row h3 {
          font-size: 10px !important;
        }

        .pdf-export-mode .chart-title-row p {
          font-size: 8px !important;
        }

        .pdf-export-mode .chart-badge {
          font-size: 8px !important;
        }

        .pdf-export-mode .chart-container-wrapper,
        .pdf-export-mode .recharts-responsive-container {
          height: 220px !important;
          max-height: 220px !important;
          min-height: 220px !important;
        }

        .pdf-export-mode .collection-info span {
          font-size: 8px !important;
        }

        .pdf-export-mode .collection-info strong {
          font-size: 10px !important;
        }

        .pdf-export-mode .table-card {
          border: 1px solid #dbe2ea !important;
          border-radius: 8px !important;
          overflow: hidden !important;
          background: #ffffff !important;
          page-break-inside: auto !important;
          break-inside: auto !important;
        }

        .pdf-export-mode .mini-card-title {
          padding: 8px 10px !important;
          background: #f8fafc !important;
          color: #1e293b !important;
          font-size: 8.5px !important;
          font-weight: 800 !important;
          letter-spacing: 0.6px !important;
          border-bottom: 1px solid #dbe2ea !important;
        }

        .pdf-export-mode .report-table th {
          padding: 6px 7px !important;
          background: #eef2f7 !important;
          color: #334155 !important;
          font-size: 7.5px !important;
          font-weight: 800 !important;
          letter-spacing: 0.4px !important;
          text-transform: uppercase !important;
          border-bottom: 1px solid #d7dee8 !important;
        }

        .pdf-export-mode .report-table td {
          padding: 6px 7px !important;
          color: #334155 !important;
          font-size: 8.5px !important;
          line-height: 1.25 !important;
          border-bottom: 1px solid #edf1f5 !important;
        }

        .pdf-export-mode .report-table tbody tr:nth-child(even) td {
          background: #fafbfc !important;
        }

        .pdf-export-mode .report-table td.text-right {
          font-variant-numeric: tabular-nums !important;
        }

        .pdf-export-mode .report-table .font-mono {
          font-size: 8px !important;
          letter-spacing: 0.1px !important;
        }

        .pdf-export-mode .doc-tag {
          padding: 2px 5px !important;
          font-size: 7.5px !important;
          border-radius: 4px !important;
        }

        .pdf-export-mode tbody tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .pdf-export-mode .report-table {
          page-break-inside: auto !important;
          break-inside: auto !important;
        }

        .pdf-export-mode thead {
          display: table-header-group !important;
        }

        .pdf-export-mode .panel-title h3 {
          font-size: 10px !important;
        }

        .pdf-export-mode .panel-title p {
          font-size: 8px !important;
        }

        .pdf-export-mode .product-main strong {
          font-size: 9px !important;
        }

        .pdf-export-mode .product-main span {
          font-size: 8px !important;
        }

        .pdf-export-mode .insight-grid {
          gap: 8px !important;
        }

        .pdf-export-mode .insight-card {
          padding: 10px !important;
          border: 1px solid #dfe4ff !important;
          border-left: 3px solid #4f46e5 !important;
          border-radius: 8px !important;
          background: #f8faff !important;
        }

        .pdf-export-mode .insight-number {
          width: 22px !important;
          height: 22px !important;
          border-radius: 5px !important;
          font-size: 8px !important;
        }

        .pdf-export-mode .insight-card h3 {
          font-size: 9.5px !important;
          color: #1e1b4b !important;
        }

        .pdf-export-mode .insight-card p {
          margin-top: 3px !important;
          font-size: 8px !important;
          line-height: 1.4 !important;
          color: #4338ca !important;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 10mm 12mm 10mm;
          }

          html,
          body {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          header,
          nav,
          aside,
          footer,
          .no-print {
            display: none !important;
          }

          .printable-document {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
          }

          .page-section {
            margin-bottom: 12px !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          .visual-card {
            height: auto !important;
            max-height: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .chart-container-wrapper,
          .recharts-responsive-container {
            height: 240px !important;
            max-height: 240px !important;
            min-height: 240px !important;
          }

          .report-hero,
          .kpi-card,
          .collection-card,
          .product-panel,
          .product-row,
          .insight-card,
          .section-heading {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .collection-grid,
          .product-grid,
          .insight-grid {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          .table-card,
          table {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          thead { display: table-header-group !important; }

          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }

        @media (max-width: 760px) {
          .kpi-grid-container {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .collection-grid,
          .product-grid,
          .insight-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}