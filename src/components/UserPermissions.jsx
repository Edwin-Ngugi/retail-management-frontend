import React, { useCallback, useEffect, useMemo, useState } from 'react';
import API from '../api';
import './UserPermissions.css';

const MODULES = [
  { key: 'dashboard', label: 'Dashboard', description: 'Business overview and KPIs' },
  { key: 'sales', label: 'Sales', description: 'Sales transactions and records' },
  { key: 'procurement', label: 'Procurement', description: 'Supplier purchases and restocking' },
  { key: 'inventory', label: 'Inventory', description: 'Items, stock and adjustments' },
  { key: 'payments', label: 'Payments', description: 'Business expenses and payments' },
  { key: 'receipts', label: 'Receipts', description: 'Customer receipts and allocations' },
  { key: 'customers', label: 'Customers', description: 'Customer records and debts' },
  { key: 'suppliers', label: 'Suppliers', description: 'Supplier statements and balances' },
  { key: 'reports', label: 'Reports', description: 'Financial and operational reports' },
  { key: 'cashbook', label: 'Cashbook', description: 'Cash inflows and outflows' },
  { key: 'balance_sheet', label: 'Balance sheet', description: 'Assets, liabilities and equity' },
  { key: 'branches', label: 'Branches', description: 'Branch configuration and access' },
  { key: 'approvals', label: 'Approvals', description: 'Review and approve pending actions' },
  { key: 'user_permissions', label: 'User permissions', description: 'Manage roles and user access' },
];

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Administrator' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'NORMAL_USER', label: 'Normal user' },
];

const makeDefaultPermissions = () =>
  Object.fromEntries(
    MODULES.map(({ key }) => [
      key,
      { view: false, change: false },
    ])
  );

const normalizePermissions = (permissions = {}) => {
  const defaults = makeDefaultPermissions();

  MODULES.forEach(({ key }) => {
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
            Control which business modules each user can view or change.
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
        <strong>Access control:</strong> View grants access to a module.
        Change grants editing rights and automatically enables View.
        Backend endpoints must also enforce these permissions.
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
                            title={
                              protectedUser
                                ? 'Superuser permissions are managed through Django administration.'
                                : 'Configure this user’s module permissions'
                            }
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
              <p>Select a user from the table to assign a role and permissions.</p>
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
                  <h3>Module permissions</h3>
                  <p>Tick the access this user should have.</p>
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
                      <th>Module</th>
                      <th>View</th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((module) => (
                      <tr key={module.key}>
                        <td>
                          <strong>{module.label}</strong>
                          <small>{module.description}</small>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Allow viewing ${module.label}`}
                            checked={Boolean(permissions[module.key]?.view)}
                            onChange={(event) =>
                              updatePermission(
                                module.key,
                                'view',
                                event.target.checked
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Allow changing ${module.label}`}
                            checked={Boolean(permissions[module.key]?.change)}
                            onChange={(event) =>
                              updatePermission(
                                module.key,
                                'change',
                                event.target.checked
                              )
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="up-editor-footer">
                <span>
                  {Object.values(permissions).filter((item) => item.view).length}
                  {' '}modules viewable · {' '}
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