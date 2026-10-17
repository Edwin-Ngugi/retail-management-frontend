// src/components/SalesView.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SALES_SECTIONS = [
  { id: '01', title: 'Sales Overview', subtitle: 'KPIs, trends, targets and alerts', endpoint: '/api/management-analytics/sales-overview/' },
  { id: '02', title: 'Sales Analysis', subtitle: 'By product, customer, branch and salesperson', endpoint: '/api/management-analytics/sales-analysis/' },
  { id: '03', title: 'Sales Register', subtitle: 'Posted invoices and credit notes', endpoint: '/api/management-analytics/sales-register/' },
  { id: '04', title: 'Customer Receivables', subtitle: 'Outstanding balances and ageing', endpoint: '/api/management-analytics/customer-receivables/' },
  { id: '05', title: 'Sales Collections', subtitle: 'Cash, bank, M-Pesa and credit settlement analysis', endpoint: '/api/management-analytics/sales-collections/' },
  { id: '06', title: 'Returns & Discounts', subtitle: 'Returns, discounts and cancellations', endpoint: '/api/management-analytics/sales-returns-discounts/' },
];

export default function SalesView({ branchId, startDate, endDate }) {
  const [selectedSection, setSelectedSection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (selectedSection) {
      fetchSectionData(selectedSection);
    }
  }, [selectedSection, branchId, startDate, endDate]);

  const fetchSectionData = async (section) => {
    setLoading(true);
    try {
      const response = await axios.get(section.endpoint, {
        params: { branch_id: branchId, start_date: startDate, end_date: endDate }
      });
      setData(response.data);
    } catch (err) {
      console.error("Failed to load module data:", err);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // VIEW 1: DEDICATED FULL-PAGE MODULE DETAIL
  // ---------------------------------------------------------------------------
  if (selectedSection) {
    return (
      <div className="space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setSelectedSection(null); setData(null); }}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              ← Back to Sales Modules
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                  Module {selectedSection.id}
                </span>
                <h2 className="text-lg font-bold text-slate-900">{selectedSection.title}</h2>
              </div>
              <p className="text-xs text-slate-500">{selectedSection.subtitle}</p>
            </div>
          </div>

          <button
            onClick={() => fetchSectionData(selectedSection)}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
          >
            Refresh Module Data
          </button>
        </div>

        {/* Dynamic Detail Content */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[500px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-3">
              <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-semibold text-slate-500">Fetching {selectedSection.title} records...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                {selectedSection.title} Operational Ledger
              </h3>
              
              {/* Output Response or Module Visualizer */}
              {data ? (
                <div className="bg-slate-950 rounded-xl p-4 overflow-x-auto border border-slate-800">
                  <pre className="text-xs font-mono text-teal-400">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">No record data found for this range.</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 2: 6-MODULE HUB NAVIGATION PAGE
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-2">
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Sales Modules</h2>
        <p className="text-xs text-slate-500">Select a management module to view full reports and analysis.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {SALES_SECTIONS.map((sec) => (
          <button
            key={sec.id}
            onClick={() => setSelectedSection(sec)}
            className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-200 hover:border-teal-500 hover:shadow-md transition-all text-left group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-teal-800 group-hover:bg-teal-600 flex items-center justify-center font-bold text-white text-lg shrink-0 transition-colors shadow-sm">
              {sec.id}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-teal-700 transition-colors truncate">
                {sec.title}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                {sec.subtitle}
              </p>
            </div>
            <div className="text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 font-bold text-lg transition-all shrink-0">
              &rarr;
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}