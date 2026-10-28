// src/components/UserPermissions.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import API from '../api';
import './UserPermissions.css';

const MODULE_GROUPS = [
  {
    category: 'Dashboard',
    items: [
      { key: 'dashboard', label: 'Dashboard Overview', description: 'Main business trajectory & KPIs' },
    ],
  },
  {
    category: 'Sales',
    items: [
      { key: 'cash_sale', label: 'Cash Sale', description: 'Direct point-of-sale entries' },
      { key: 'credit_sale', label: 'Credit Sale', description: 'Invoicing credit sales' },
      { key: 'sales_invoices', label: 'Sales Invoices', description: 'Invoice audit ledger' },
      { key: 'sales_returns', label: 'Sales Returns', description: 'Customer item return processing' },
      { key: 'quotations', label: 'Quotations', description: 'Price quotations and estimates' },
    ],
  },
  {
    category: 'Procurement',
    items: [
      { key: 'cash_purchase', label: 'Cash Purchase', description: 'Direct cash restock entries' },
      { key: 'credit_purchase', label: 'Credit Purchase', description: 'Supplier credit restocks' },
      { key: 'goods_received', label: 'Goods Received (GRN)', description: 'Stock receiving logs' },
      { key: 'purchase_returns', label: 'Purchase Returns', description: 'Supplier returns management' },
    ],
  },
  {
    category: 'Inventory',
    items: [
      { key: 'item_register', label: 'Item Register', description: 'SKU catalog & cost pricings' },
      { key: 'stock_transfer', label: 'Stock Transfer', description: 'Branch stock movements' },
      { key: 'stock_adjustment', label: 'Stock Adjustment', description: 'Discrepancy adjustments' },
      { key: 'stock_count', label: 'Stock Count', description: 'Physical stock reconciliation' },
    ],
  },
  {
    category: 'Payments',
    items: [
      { key: 'supplier_payment', label: 'Supplier Payment', description: 'Supplier accounts payable' },
      { key: 'expenses', label: 'Operating Expenses', description: 'Business operational expenses' },
      { key: 'other_payments', label: 'Other Payments', description: 'Miscellaneous payment entries' },
      { key: 'payment_vouchers', label: 'Payment Vouchers', description: 'Voucher generation' },
    ],
  },
  {
    category: 'Receipts',
    items: [
      { key: 'customer_receipts', label: 'Customer Receipts', description: 'Customer payment entries' },
      { key: 'other_receipts', label: 'Other Receipts', description: 'Non-sales incoming funds' },
      { key: 'receipts_allocation', label: 'Receipts Allocation', description: 'Funds allocation ledger' },
    ],
  },
  {
    category: 'Customers',
    items: [
      { key: 'customer_register', label: 'Customer Register', description: 'Customer contact records' },
      { key: 'customer_statements', label: 'Customer Statements', description: 'Statement generation' },
      { key: 'outstanding_balances', label: 'Outstanding Balances', description: 'Customer debt ledgers' },
    ],
  },
  {
    category: 'Suppliers',
    items: [
      { key: 'supplier_register', label: 'Supplier Register', description: 'Supplier catalog' },
      { key: 'supplier_statements', label: 'Supplier Statements', description: 'Supplier balance statements' },
      { key: 'supplier_outstanding', label: 'Outstanding Balances', description: 'Accounts payable summary' },
    ],
  },
  {
    category: 'Reports',
    items: [
      { key: 'rep_sales', label: 'Sales Reports', description: 'Detailed sales analytics' },
      { key: 'rep_purchases', label: 'Purchase Reports', description: 'Procurement analytics' },
      { key: 'rep_inventory', label: 'Inventory Reports', description: 'Stock valuation reports' },
      { key: 'rep_debtors', label: 'Debtors Reports', description: 'Aging & balance reports' },
      { key: 'rep_financial', label: 'Financial Statements', description: 'Profit & Loss statements' },
    ],
  },
  {
    category: 'Administration',
    items: [
      { key: 'approvals', label: 'Approvals Dashboard', description: 'Review pending requests' },
      { key: 'user_permissions', label: 'User Permissions', description: 'Manage system roles & access' },
    ],
  },
];

const FLAT_MODULES = MODULE_GROUPS.flatMap((g) => g.items);

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Administrator' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'NORMAL_USER', label: 'Normal user' },
];

const makeDefaultPermissions = () =>
  Object.fromEntries(
    FLAT_MODULES.map(({ key }) => [
      key,
      { view: false, change: false },
    ])
  );

const normalizePermissions = (permissions = {}) => {
  const defaults = makeDefaultPermissions();

  FLAT_MODULES.forEach(({ key }) => {
    const supplied = permissions[key] || {};
    defaults[key] = {
      view: Boolean(supplied.view || supplied.change),
      change: Boolean(supplied.change),
    };
  });

  return defaults;
};

export default function UserPermissions() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [role, setRole] = useState('NORMAL_USER');
  const [permissions, setPermissions] = useState(makeDefaultPermissions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await API.get('user-permissions/');
      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.results || [];

      setUsers(data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Could not load users. Check your administrator access and API URL.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return users;

    return users.filter((user) =>
      [
        user.username,
        user.full_name,
        user.email,
        user.role,
      ].some((value) => String(value || '').toLowerCase().includes(term))
    );
  }, [users, search]);

  const openUser = (user) => {
    setSelectedUser(user);
    setRole(user.role || 'NORMAL_USER');
    setPermissions(normalizePermissions(user.permissions));
    setError('');
    setNotice('');
  };

  const updatePermission = (moduleKey, action, checked) => {
    setPermissions((current) => {
      const next = {
        ...current,
        [moduleKey]: {
          ...current[moduleKey],
          [action]: checked,
        },
      };

      if (action === 'change' && checked) {
        next[moduleKey].view = true;
      }

      if (action === 'view' && !checked) {
        next[moduleKey].change = false;
      }

      return next;
    });
  };

  const toggleGroupPermissions = (groupItems, action, checked) => {
    setPermissions((current) => {
      const next = { ...current };
      groupItems.forEach(({ key }) => {
        next[key] = {
          ...next[key],
          [action]: checked,
        };
        if (action === 'change' && checked) {
          next[key].view = true;
        }
        if (action === 'view' && !checked) {
          next[key].change = false;
        }
      });
      return next;
    });
  };

  const savePermissions = async () => {
    if (!selectedUser) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await API.put(
        `user-permissions/${selectedUser.id}/`,
        { role, permissions }
      );

      const updated = {
        ...selectedUser,
        role: response.data.role,
        permissions: response.data.permissions,
        updated_at: response.data.updated_at,
      };

      setUsers((current) =>
        current.map((user) =>
          user.id === updated.id ? { ...user, ...updated } : user
        )
      );

      setSelectedUser(updated);
      setPermissions(normalizePermissions(updated.permissions));
      setNotice('Role and permissions saved successfully.');
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Could not save permissions. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const resetPermissions = () => {
    setPermissions(makeDefaultPermissions());
    setNotice('Unsaved permissions reset. Save to apply these changes.');
    setError('');
  };

  const countPermissions = (user) => {
    const values = Object.values(normalizePermissions(user.permissions));
    return {
      view: values.filter((item) => item.view).length,
      change: values.filter((item) => item.change).length,
    };
  };

  return (
    <section className="up-page">
      <header className="up-header">
        <div>
          <p className="up-eyebrow">SYSTEM ADMINISTRATION</p>
          <h1>User roles &amp; permissions</h1>
          <p className="up-subtitle">
            Control which business sub-menus each user can view or change.
          </p>
        </div>

        <button
          type="button"
          className="up-secondary-button"
          onClick={fetchUsers}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh users'}
        </button>
      </header>

      <div className="up-notice up-notice-info">
        <strong>Access control:</strong> View grants access to a sub-menu.
        Change grants editing rights and automatically enables View.
      </div>

      {error && <div className="up-alert up-alert-error">{error}</div>}
      {notice && <div className="up-alert up-alert-success">{notice}</div>}

      <div className="up-layout">
        <section className="up-card up-users-card">
          <div className="up-card-heading">
            <div>
              <h2>System users</h2>
              <p>{filteredUsers.length} user(s)</p>
            </div>
            <span className="up-count">{users.length}</span>
          </div>

          <div className="up-search-wrap">
            <input
              aria-label="Search users"
              type="search"
              placeholder="Search name, username or email…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {loading ? (
            <div className="up-empty">Loading users…</div>
          ) : filteredUsers.length === 0 ? (
            <div className="up-empty">No matching users found.</div>
          ) : (
            <div className="up-table-wrap">
              <table className="up-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Access</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const counts = countPermissions(user);
                    const protectedUser = user.is_superuser;

                    return (
                      <tr
                        key={user.id}
                        className={
                          selectedUser?.id === user.id ? 'up-selected-row' : ''
                        }
                      >
                        <td>
                          <div className="up-user-cell">
                            <span className="up-avatar">
                              {(user.full_name || user.username || '?')
                                .charAt(0)
                                .toUpperCase()}
                            </span>
                            <span>
                              <strong>{user.full_name || user.username}</strong>
                              <small>@{user.username}</small>
                              <small>{user.email || 'No email recorded'}</small>
                              {!user.is_active && (
                                <span className="up-status-inactive">Inactive</span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`up-role up-role-${String(user.role).toLowerCase()}`}>
                            {ROLE_OPTIONS.find((item) => item.value === user.role)?.label
                              || 'Normal user'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={
                              selectedUser?.id === user.id
                                ? 'up-configure-button active'
                                : 'up-configure-button'
                            }
                            onClick={() => openUser(user)}
                            disabled={protectedUser}
                          >
                            {protectedUser
                              ? 'Protected'
                              : selectedUser?.id === user.id
                                ? 'Selected'
                                : 'Configure access'}
                          </button>
                          <small className="up-access-summary">
                            {counts.view} viewed · {counts.change} editable
                          </small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="up-card up-editor-card">
          {!selectedUser ? (
            <div className="up-empty up-editor-empty">
              <span className="up-empty-icon">⚙</span>
              <h2>Configure user access</h2>
              <p>Select a user from the table to assign a role and sub-menu permissions.</p>
            </div>
          ) : (
            <>
              <div className="up-card-heading up-editor-heading">
                <div>
                  <p className="up-eyebrow">ACCESS CONFIGURATION</p>
                  <h2>{selectedUser.full_name || selectedUser.username}</h2>
                  <p>@{selectedUser.username}</p>
                </div>
                <button
                  type="button"
                  className="up-close-button"
                  onClick={() => setSelectedUser(null)}
                  aria-label="Close permission editor"
                >
                  ×
                </button>
              </div>

              <label className="up-field-label" htmlFor="up-role">
                User role
              </label>
              <select
                id="up-role"
                className="up-role-select"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                {ROLE_OPTIONS
                  .filter((option) => option.value !== 'ADMIN' || selectedUser.is_staff)
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </select>

              <div className="up-permission-heading">
                <div>
                  <h3>Sub-menu permissions</h3>
                  <p>Tick access permissions for each feature.</p>
                </div>
                <button
                  type="button"
                  className="up-text-button"
                  onClick={resetPermissions}
                >
                  Clear all
                </button>
              </div>

              <div className="up-permission-table-wrap">
                <table className="up-permission-table">
                  <thead>
                    <tr>
                      <th>Module / Sub-menu</th>
                      <th className="text-center">View</th>
                      <th className="text-center">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODULE_GROUPS.map((group) => {
                      const allGroupView = group.items.every((i) => permissions[i.key]?.view);
                      const allGroupChange = group.items.every((i) => permissions[i.key]?.change);

                      return (
                        <React.Fragment key={group.category}>
                          {/* Group Section Header */}
                          <tr className="bg-slate-100/90 font-bold text-slate-800 text-xs">
                            <td className="py-2 px-3 uppercase tracking-wider text-[10px] text-teal-900 bg-slate-100">
                              {group.category}
                            </td>
                            <td className="py-2 px-3 text-center bg-slate-100">
                              <input
                                type="checkbox"
                                title={`Toggle all View for ${group.category}`}
                                checked={allGroupView}
                                onChange={(e) =>
                                  toggleGroupPermissions(group.items, 'view', e.target.checked)
                                }
                              />
                            </td>
                            <td className="py-2 px-3 text-center bg-slate-100">
                              <input
                                type="checkbox"
                                title={`Toggle all Change for ${group.category}`}
                                checked={allGroupChange}
                                onChange={(e) =>
                                  toggleGroupPermissions(group.items, 'change', e.target.checked)
                                }
                              />
                            </td>
                          </tr>

                          {/* Individual Sub-menu Rows */}
                          {group.items.map((item) => (
                            <tr key={item.key}>
                              <td className="pl-6">
                                <strong>{item.label}</strong>
                                <small>{item.description}</small>
                              </td>
                              <td className="text-center">
                                <input
                                  type="checkbox"
                                  aria-label={`Allow viewing ${item.label}`}
                                  checked={Boolean(permissions[item.key]?.view)}
                                  onChange={(event) =>
                                    updatePermission(
                                      item.key,
                                      'view',
                                      event.target.checked
                                    )
                                  }
                                />
                              </td>
                              <td className="text-center">
                                <input
                                  type="checkbox"
                                  aria-label={`Allow changing ${item.label}`}
                                  checked={Boolean(permissions[item.key]?.change)}
                                  onChange={(event) =>
                                    updatePermission(
                                      item.key,
                                      'change',
                                      event.target.checked
                                    )
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="up-editor-footer">
                <span>
                  {Object.values(permissions).filter((item) => item.view).length}
                  {' '}sub-menus viewable · {' '}
                  {Object.values(permissions).filter((item) => item.change).length}
                  {' '}editable
                </span>
                <button
                  type="button"
                  className="up-save-button"
                  onClick={savePermissions}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save permissions'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}