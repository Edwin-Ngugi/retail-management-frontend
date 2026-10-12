"use strict";

/* =========================================================
   CONFIGURATION
========================================================= */

const PAYMENTS_API_URL = "/api/tenant/payments/";

let allPayments = [];
let filteredPayments = [];

/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    loadTenantPayments();
    setupPaymentFilters();
    setupModalEvents();
    setupTableEvents();
});

/* =========================================================
   AUTHENTICATION & CSRF HEADERS
========================================================= */

function getCSRFToken() {
    const name = "csrftoken=";
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(name)) {
            return decodeURIComponent(cookie.substring(name.length));
        }
    }
    return null;
}

function getAuthHeaders() {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    };

    const csrfToken = getCSRFToken();
    if (csrfToken) {
        headers["X-CSRFToken"] = csrfToken;
    }

    if (token) {
        headers["Authorization"] = `Token ${token}`;
    }

    return headers;
}

/* =========================================================
   LOAD PAYMENTS
========================================================= */

async function loadTenantPayments() {
    showLoading();

    try {
        const response = await fetch(PAYMENTS_API_URL, {
            method: "GET",
            headers: getAuthHeaders(),
            credentials: "same-origin"
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem("token");
                sessionStorage.removeItem("token");
                showError("Your session has expired. Please log in again.");
                setTimeout(() => {
                    window.location.href = "/login/";
                }, 2000);
                return;
            }

            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        allPayments = Array.isArray(data) ? data : (data.results || []);
        filteredPayments = [...allPayments];

        updateSummary();
        renderPayments();

    } catch (error) {
        console.error("Failed to load tenant payments:", error);
        showError("Unable to load payments.");
    }
}

/* =========================================================
   SUMMARY
========================================================= */

function updateSummary() {
    const completed = allPayments.filter(
        payment => String(payment.status || "").toUpperCase() === "COMPLETED"
    );

    const pending = allPayments.filter(
        payment => String(payment.status || "").toUpperCase() === "PENDING"
    );

    const totalPaid = completed.reduce((total, payment) => {
        return total + Number(payment.amount || 0);
    }, 0);

    setText("total-paid", formatCurrency(totalPaid));
    setText("completed-count", completed.length);
    setText("pending-count", pending.length);
    setText("transaction-count", allPayments.length);
}

/* =========================================================
   FILTERS
========================================================= */

function setupPaymentFilters() {
    const search = document.getElementById("payment-search");
    const status = document.getElementById("status-filter");

    if (search) search.addEventListener("input", applyFilters);
    if (status) status.addEventListener("change", applyFilters);
}

function applyFilters() {
    const searchInput = document.getElementById("payment-search");
    const statusSelect = document.getElementById("status-filter");

    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const selectedStatus = statusSelect ? statusSelect.value.toUpperCase() : "";

    filteredPayments = allPayments.filter(payment => {
        const reference = String(
            payment.transaction_reference ||
            payment.mpesa_receipt_number ||
            payment.id ||
            ""
        ).toLowerCase();

        const invoice = String(
            payment.invoice_number ||
            payment.invoice ||
            ""
        ).toLowerCase();

        const matchesSearch = !searchTerm ||
            reference.includes(searchTerm) ||
            invoice.includes(searchTerm);

        const paymentStatus = String(payment.status || "").toUpperCase();
        const matchesStatus = !selectedStatus || paymentStatus === selectedStatus;

        return matchesSearch && matchesStatus;
    });

    renderPayments();
}

/* =========================================================
   RENDER PAYMENTS
========================================================= */

function renderPayments() {
    const tbody = document.querySelector("#payments-table tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!filteredPayments.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    No payments found.
                </td>
            </tr>
        `;
        return;
    }

    filteredPayments.forEach(payment => {
        const row = document.createElement("tr");

        const reference = payment.transaction_reference ||
                          payment.mpesa_receipt_number ||
                          payment.id ||
                          "-";

        const invoice = payment.invoice_number || payment.invoice || "-";
        const amount = formatCurrency(payment.amount);
        const method = formatPaymentMethod(payment.method);
        const date = formatDate(payment.payment_date || payment.created_at);

        row.innerHTML = `
            <td><strong>${escapeHtml(String(reference))}</strong></td>
            <td>${escapeHtml(String(invoice))}</td>
            <td><strong class="amount">${amount}</strong></td>
            <td>${escapeHtml(method)}</td>
            <td>${escapeHtml(date)}</td>
            <td>${createStatusBadge(payment.status)}</td>
            <td>
                <button class="view-button" data-action="view-payment" data-id="${payment.id}">
                    View
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

function setupTableEvents() {
    const tbody = document.querySelector("#payments-table tbody");
    if (!tbody) return;

    tbody.addEventListener("click", event => {
        const button = event.target.closest("button[data-action='view-payment']");
        if (button) {
            const paymentId = button.getAttribute("data-id");
            openPaymentModal(paymentId);
        }
    });
}

/* =========================================================
   STATUS
========================================================= */

function createStatusBadge(status) {
    const normalized = String(status || "PENDING").toUpperCase();
    return `
        <span class="status ${normalized.toLowerCase()}">
            ${formatStatus(normalized)}
        </span>
    `;
}

function formatStatus(status) {
    return String(status || "")
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

/* =========================================================
   PAYMENT METHOD
========================================================= */

function formatPaymentMethod(method) {
    switch (String(method || "").toUpperCase()) {
        case "MPESA": return "M-Pesa";
        case "CASH": return "Cash";
        case "BANK": return "Bank Transfer";
        case "OTHER": return "Other";
        default: return formatStatus(method || "-");
    }
}

/* =========================================================
   PAYMENT MODAL
========================================================= */

function openPaymentModal(paymentId) {
    const payment = allPayments.find(
        item => String(item.id) === String(paymentId)
    );

    if (!payment) return;

    const reference = payment.transaction_reference ||
                      payment.mpesa_receipt_number ||
                      payment.id ||
                      "-";

    const invoice = payment.invoice_number || payment.invoice || "-";

    setText("modal-reference", reference);
    setText("modal-invoice", invoice);
    setText("modal-amount", formatCurrency(payment.amount));
    setText("modal-method", formatPaymentMethod(payment.method));
    setText("modal-date", formatDate(payment.payment_date || payment.created_at));
    setText("modal-phone", payment.phone_number || "-");
    setText("modal-notes", payment.notes || "-");

    const statusElement = document.getElementById("modal-status");
    if (statusElement) {
        const normalized = String(payment.status || "PENDING").toUpperCase();
        statusElement.textContent = formatStatus(normalized);
        statusElement.className = `status ${normalized.toLowerCase()}`;
    }

    const modal = document.getElementById("payment-modal");
    if (modal) modal.classList.add("active");
    document.body.classList.add("modal-open");
}

function closePaymentModal() {
    const modal = document.getElementById("payment-modal");
    if (modal) modal.classList.remove("active");
    document.body.classList.remove("modal-open");
}

function setupModalEvents() {
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closePaymentModal();
    });

    document.addEventListener("click", event => {
        const modal = document.getElementById("payment-modal");
        if (event.target === modal) closePaymentModal();
    });
}

/* =========================================================
   HELPERS & FORMATTING
========================================================= */

function setText(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value ?? "-";
    }
}

function formatCurrency(amount) {
    const value = Number(amount || 0);
    if (Number.isNaN(value)) return "KSh 0.00";

    return `KSh ${value.toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("en-KE", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

/* =========================================================
   UI STATES
========================================================= */

function showLoading() {
    const tbody = document.querySelector("#payments-table tbody");
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    Loading payments...
                </td>
            </tr>
        `;
    }
}

function showError(message) {
    const tbody = document.querySelector("#payments-table tbody");
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state error-state">
                    ${escapeHtml(message)}
                </td>
            </tr>
        `;
    }
}

/* Global Expose */
window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;