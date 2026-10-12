import React, { useState, useEffect } from 'react';
import API from '../api';
import { useBranch } from '../components/BranchContext';

export default function ExpenseManagement({ onExpenseAdded }) {
  const { selectedBranch } = useBranch();
  const [expenses, setExpenses] = useState([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: ''
  });
  const [statusMsg, setStatusMsg] = useState('');

  const fetchExpenses = () => {
    const params = selectedBranch ? { branch: selectedBranch } : {};
    API.get('expenses/', { params })
      .then(res => setExpenses(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedBranch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        ...(selectedBranch && { branch: selectedBranch })
      };
      await API.post('expenses/', payload);
      setStatusMsg('Expense recorded successfully!');
      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: ''
      });
      fetchExpenses();
      if (onExpenseAdded) onExpenseAdded();
    } catch (err) {
      setStatusMsg('Failed to record expense. Please try again.');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Form Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold mb-4 text-slate-800">Record Operational Expense</h2>
        {statusMsg && (
          <p className="mb-4 text-xs p-2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
            {statusMsg}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              style={{ colorScheme: 'light' }}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium [color-scheme:light]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
            <input
              type="text"
              placeholder="e.g. Electricity bill, Transport, Rent"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              style={{ colorScheme: 'light' }}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium [color-scheme:light]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Amount (KSh)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.amount}
              onChange={e => setFormData({ ...formData, amount: e.target.value })}
              style={{ colorScheme: 'light' }}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white !text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium [color-scheme:light]"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 transition"
          >
            Save Expense
          </button>
        </form>
      </div>

      {/* Expense History Table */}
      <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold mb-4 text-slate-800">Expense History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 text-xs text-slate-500 uppercase font-semibold">
                <th className="p-3">Date</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan="3" className="p-4 text-center text-slate-400 text-xs">No expenses recorded yet.</td>
                </tr>
              ) : (
                expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-600">{exp.date}</td>
                    <td className="p-3 text-slate-800">{exp.description}</td>
                    <td className="p-3 text-right font-semibold text-rose-600">KSh {exp.amount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}