import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SALES_SECTIONS = [
  { id: '01', title: 'Sales Overview', subtitle: 'KPIs, trends, targets and alerts' },
  { id: '02', title: 'Sales Analysis', subtitle: 'By product, customer, branch and salesperson' },
  { id: '03', title: 'Sales Register', subtitle: 'Posted invoices and credit notes' },
  { id: '04', title: 'Customer Receivables', subtitle: 'Outstanding balances and ageing' },
  { id: '05', title: 'Sales Collections', subtitle: 'Cash, bank, M-Pesa and credit settlement analysis' },
  { id: '06', title: 'Returns & Discounts', subtitle: 'Returns, discounts and cancellations' },
];

export default function SalesView({ branchId, startDate, endDate }) {
  const [activeTab, setActiveTab] = useState('01');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchSalesData(activeTab);
  }, [activeTab, branchId, startDate, endDate]);

  const fetchSalesData = async (tabId) => {
    setLoading(true);
    try {
      const endpoints = {
        '01': '/api/management-analytics/sales-overview/',
        '02': '/api/management-analytics/sales-analysis/',
        '03': '/api/management-analytics/sales-register/',
        '04': '/api/management-analytics/customer-receivables/',
        '05': '/api/management-analytics/sales-collections/',
        '06': '/api/management-analytics/sales-returns-discounts/',
      };
      const response = await axios.get(endpoints[tabId], {
        params: { branch_id: branchId, start_date: startDate, end_date: endDate }
      });
      setData(response.data);
    } catch (err) {
      console.error("Failed to load sales tab data", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Sales Management</h1>
      
      {/* 6 Sub-section Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {SALES_SECTIONS.map((sec) => (
          <button
            key={sec.id}
            onClick={() => setActiveTab(sec.id)}
            className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
              activeTab === sec.id
                ? 'bg-teal-900/40 border-teal-500 text-white shadow-lg shadow-teal-900/20'
                : 'bg-slate-800/80 border-slate-700 hover:border-slate-500 text-slate-300'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center font-bold text-white text-base shrink-0">
              {sec.id}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base text-white truncate">{sec.title}</h3>
              <p className="text-xs text-slate-400 truncate">{sec.subtitle}</p>
            </div>
            <div className="text-slate-500 font-bold">&rarr;</div>
          </button>
        ))}
      </div>

      {/* Dynamic Tab Content Display */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 min-h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">Loading module data...</div>
        ) : (
          <div>
            <h2 className="text-xl font-semibold mb-4 border-b border-slate-700 pb-2">
              {SALES_SECTIONS.find(s => s.id === activeTab)?.title}
            </h2>
            <pre className="text-xs bg-slate-950 p-4 rounded text-teal-400 overflow-x-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}