// src/components/SaleAndPurchasesReport.jsx
import React, { useState, useEffect } from 'react';
import API from '../api';
import SalesView from './SalesView';
import PurchaseView from './PurchaseView';

const REPORT_MODULES = [
  {
    id: 'sales',
    title: 'Sales',
    subtitle: 'Revenue performance trends, product lines, and payment channel split.',
    endpoint: '/management-reports/sales/',
    component: SalesView,
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    )
  },
  {
    id: 'purchases',
    title: 'Purchases',
    subtitle: 'Supplier purchase orders, restock invoices, and accounts payable.',
    endpoint: '/management-reports/purchases/',
    component: PurchaseView,
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  }
];

export default function SaleAndPurchasesReport({ branchId, items = [], initialModule = null }) {
  const [selectedModule, setSelectedModule] = useState(() => {
    if (initialModule) {
      return REPORT_MODULES.find(m => m.id === initialModule) || null;
    }
    return null;
  });

  const queryParams = new URLSearchParams(window.location.search);
  const activeBranch = branchId || queryParams.get('branch') || queryParams.get('branch_id');

  useEffect(() => {
    if (initialModule) {
      const found = REPORT_MODULES.find(m => m.id === initialModule);
      if (found) setSelectedModule(found);
    }
  }, [initialModule]);

  if (selectedModule) {
    const Component = selectedModule.component;

    return (
      <div className="space-y-6 w-full flex-1 flex flex-col font-sans">
        {!initialModule && (
          <div className="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-md pb-2 border-b border-slate-200/80">
            <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedModule(null)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  ← Back to Management Reports
                </button>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">{selectedModule.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedModule.subtitle}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex-1 min-h-[calc(100vh-220px)] h-fit w-full">
          {Component ? (
            <Component branchId={activeBranch} items={items} />
          ) : (
            <div className="p-8 text-center text-slate-400 font-mono text-xs">
              No component registered for {selectedModule.title}.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col space-y-6 font-sans">
      <div className="bg-teal-800 text-white rounded-xl p-3.5 flex items-center gap-3 shadow-md">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 012 2h2a2 2 0 012-2z" />
        </svg>
        <h2 className="text-sm font-black tracking-widest uppercase">MANAGEMENT REPORTS</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {REPORT_MODULES.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedModule(item)}
            className="flex flex-col items-center justify-center p-10 rounded-3xl bg-teal-800 hover:bg-teal-900 text-white shadow-md hover:shadow-xl transition-all cursor-pointer min-h-[160px] group border border-teal-700/50"
          >
            <div className="p-3 rounded-2xl bg-teal-700/60 group-hover:scale-110 transition-transform mb-3">
              {item.icon}
            </div>
            <span className="text-xl font-black tracking-wide text-center">
              {item.title}
            </span>
            <span className="text-xs text-teal-200/80 mt-1 text-center font-medium">
              {item.subtitle}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}