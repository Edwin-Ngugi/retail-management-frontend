"use strict";

console.log("payments.js initialized");

/* =========================================================
   GLOBAL STATE & CONFIGURATION
========================================================= */

const PAYMENTS_API_URL = "/api/payments/";
const INVOICES_API_URL = "/api/invoices/";

let allPayments = [];
let filteredPayments = [];
let allInvoices = [];

/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    initializePaymentsPage();
});

function initializePaymentsPage() {
    setupEventListeners();
    setupFormEvents();
    loadPayments();
}

/* =========================================================
   AUTHENTICATION & CSRF HELPERS
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

function handleAuthenticationError() {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");

    showTableError("Your session has expired. Please log in again.");

    setTimeout(() => {
        window.location.href = "/login/";
    }, 1500);
}

function getApiErrorMessage(data) {
    if (!data) return "An unknown server error occurred.";
    if (typeof data === "string") return data;
    if (data.error) return String(data.error);
    if (data.detail) return String(data.detail);

    const messages = [];
    Object.keys(data).forEach(key => {
        const value = data[key];
        if (Array.isArray(value)) {
            messages.push(`${key}: ${value.join(", ")}`);
        } else if (typeof value === "string") {
            messages.push(`${key}: ${value}`);
        } else {
            messages.push(`${key}: ${JSON.stringify(value)}`);
        }
    });

    return messages.length > 0 ? messages.join(" | ") : "An unknown server error occurred.";
}

/* =========================================================
   EVENT LISTENERS & MODAL BINDINGS
========================================================= */

function setupEventListeners() {
    const searchInput = document.getElementById("payment-search");
    const statusFilter = document.getElementById("payment-status-filter");
    const methodFilter = document.getElementById("payment-method-filter");

    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (statusFilter) statusFilter.addEventListener("change", applyFilters);
    if (methodFilter) methodFilter.addEventListener("change", applyFilters);

    // Add Payment Trigger
    const addBtn = document.getElementById("add-payment-button") || 
                   document.querySelector(".add-payment-button") || 
                   document.querySelector(".btn-primary");
                   
    if (addBtn) {
        addBtn.addEventListener("click", openPaymentModal);
    }

    // Close Modal Triggers
    const closeBtns = document.querySelectorAll(".close-modal, .btn-close, .modal-close, [data-dismiss='modal']");
    closeBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            closePaymentModal();
            closePaymentDetailsModal();
        });
    });

    // Backdrop clicks
    document.addEventListener("click", function (event) {
        const paymentModal = document.getElementById("payment-modal");
        const detailsModal = document.getElementById("payment-details-modal");

        if (paymentModal && event.target === paymentModal) closePaymentModal();
        if (detailsModal && event.target === detailsModal) closePaymentDetailsModal();
    });

    // Keyboard ESC shortcut
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closePaymentModal();
            closePaymentDetailsModal();
        }
    });
}

function setupFormEvents() {
    const invoiceSelect = document.getElementById("payment-invoice");
    const methodSelect = document.getElementById("payment-method");
    const form = document.getElementById("payment-form");

    if (invoiceSelect) invoiceSelect.addEventListener("change", updateInvoiceInformation);
    if (methodSelect) methodSelect.addEventListener("change", updatePaymentMethodUI);

    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            createPayment();
        });
    }
}

/* =========================================================
   FETCH & LOAD PAYMENTS
========================================================= */

async function loadPayments() {
    showTableLoading();

    try {
        const response = await fetch(PAYMENTS_API_URL, {
            method: "GET",
            headers: getAuthHeaders(),
            credentials: "same-origin"
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                handleAuthenticationError();
                return;
            }

            let errorMessage = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = getApiErrorMessage(errorData);
            } catch (e) {}

            throw new Error(errorMessage);
        }

        const data = await response.json();

        if (Array.isArray(data)) {
            allPayments = data;
        } else if (data && Array.isArray(data.results)) {
            allPayments = data.results;
        } else {
            allPayments = [];
        }

        filteredPayments = [...allPayments];

        updateSummaryCards();
        renderPayments();

    } catch (error) {
        console.error("Failed to load payments:", error);
        showTableError(error.message || "Unable to load payments. Please try again.");
    }
}

/* =========================================================
   SUMMARY CARDS
========================================================= */

function updateSummaryCards() {
    const totalCount = allPayments.length;

    const completedPayments = allPayments.filter(
        p => ["COMPLETED", "SUCCESS", "PAID"].includes(String(p.status).toUpperCase())
    );

    const pendingPayments = allPayments.filter(
        p => String(p.status).toUpperCase() === "PENDING"
    );

    const totalCollected = completedPayments.reduce(
        (total, p) => total + parseFloat(p.amount || 0),
        0
    );

    setElementText("total-payments-count", totalCount);
    setElementText("completed-payments-count", completedPayments.length);
    setElementText("pending-payments-count", pendingPayments.length);
    setElementText("total-payments-amount", formatCurrency(totalCollected));
}

/* =========================================================
   FILTER & RENDER PAYMENTS
========================================================= */

function applyFilters() {
    const searchInput = document.getElementById("payment-search");
    const statusFilter = document.getElementById("payment-status-filter");
    const methodFilter = document.getElementById("payment-method-filter");

    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const selectedStatus = statusFilter ? statusFilter.value.toUpperCase() : "";
    const selectedMethod = methodFilter ? methodFilter.value.toUpperCase() : "";

    filteredPayments = allPayments.filter(payment => {
        const reference = String(getPaymentReference(payment)).toLowerCase();
        const invoice = String(payment.invoice_number || payment.invoice || "").toLowerCase();
        const tenant = String(payment.tenant_name || payment.tenant || "").toLowerCase();
        const phone = String(payment.phone_number || "").toLowerCase();

        const matchesSearch = !searchTerm ||
            reference.includes(searchTerm) ||
            invoice.includes(searchTerm) ||
            tenant.includes(searchTerm) ||
            phone.includes(searchTerm);

        const matchesStatus = !selectedStatus || String(payment.status).toUpperCase() === selectedStatus;
        const matchesMethod = !selectedMethod || String(payment.method).toUpperCase() === selectedMethod;

        return matchesSearch && matchesStatus && matchesMethod;
    });

    renderPayments();
}

function renderPayments() {
    const tbody = document.querySelector("#payment-table tbody") || document.querySelector("table tbody");

    if (!tbody) {
        console.error("Payment table body element not found.");
        return;
    }

    if (!filteredPayments || filteredPayments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state" style="text-align: center; padding: 20px;">
                    No payments found.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = "";
    filteredPayments.forEach(payment => {
        tbody.appendChild(createPaymentRow(payment));
    });
}

function createPaymentRow(payment) {
    const row = document.createElement("tr");

    const reference = getPaymentReference(payment);
    const tenantName = payment.tenant_name || payment.tenant || "-";
    const invoiceNumber = payment.invoice_number || payment.invoice || "-";
    const amount = formatCurrency(payment.amount);
    const method = formatPaymentMethod(payment.method);
    const paymentDate = formatDateTime(payment.payment_date || payment.created_at);
    const status = payment.status || "PENDING";

    const isPending = String(status).toUpperCase() === "PENDING";

    row.innerHTML = `
        <td><strong>${escapeHtml(String(reference))}</strong></td>
        <td>${escapeHtml(String(tenantName))}</td>
        <td>${escapeHtml(String(invoiceNumber))}</td>
        <td><strong>${amount}</strong></td>
        <td><span class="payment-method ${escapeHtml(String(payment.method || '').toLowerCase())}">${escapeHtml(method)}</span></td>
        <td>${escapeHtml(paymentDate)}</td>
        <td>${createStatusBadge(status)}</td>
        <td class="payment-actions">
            <button type="button" class="view-payment-button view-button" onclick="openPaymentDetailsModal(${payment.id})">
                View
            </button>
            ${
                isPending ? `
                    <button type="button" class="complete-button" onclick="completePayment(${payment.id})">
                        Complete
                    </button>
                ` : ""
            }
        </td>
    `;

    return row;
}

/* =========================================================
   ADD PAYMENT & STK PUSH LOGIC
========================================================= */

function openPaymentModal() {
    const modal = document.getElementById("payment-modal");
    if (!modal) return;

    clearPaymentMessage();
    resetPaymentForm();
    loadInvoicesForPayment();

    modal.classList.add("show", "active");
    document.body.classList.add("modal-open");
}

function closePaymentModal() {
    const modal = document.getElementById("payment-modal");
    if (!modal) return;

    modal.classList.remove("show", "active");
    document.body.classList.remove("modal-open");
    clearPaymentMessage();
}

async function loadInvoicesForPayment() {
    const select = document.getElementById("payment-invoice");
    if (!select) return;

    select.innerHTML = `<option value="">Loading invoices...</option>`;

    try {
        const response = await fetch(INVOICES_API_URL, {
            method: "GET",
            headers: getAuthHeaders(),
            credentials: "same-origin"
        });

        const data = await response.json();
        if (!response.ok) throw new Error(getApiErrorMessage(data));

        allInvoices = Array.isArray(data) ? data : (data.results || []);

        const unpaidInvoices = allInvoices.filter(inv => {
            const status = String(inv.status || "").toUpperCase();
            return status !== "PAID" && status !== "CANCELLED";
        });

        select.innerHTML = `<option value="">Select invoice</option>`;
        unpaidInvoices.forEach(invoice => {
            const option = document.createElement("option");
            option.value = invoice.id;

            const balance = invoice.balance !== undefined
                ? invoice.balance
                : (Number(invoice.amount_due || 0) - Number(invoice.amount_paid || 0));

            const tenant = invoice.tenant_name || invoice.tenant?.name || "Tenant";
            option.textContent = `${invoice.invoice_number} - ${tenant} - ${formatCurrency(balance)}`;
            select.appendChild(option);
        });

    } catch (error) {
        console.error("Could not load invoices:", error);
        select.innerHTML = `<option value="">Unable to load invoices</option>`;
    }
}

function updateInvoiceInformation() {
    const select = document.getElementById("payment-invoice");
    const tenantInput = document.getElementById("payment-tenant");
    const amountInput = document.getElementById("payment-amount");
    const phoneInput = document.getElementById("payment-phone");

    if (!select) return;

    const invoiceId = Number(select.value);
    if (!invoiceId) {
        if (tenantInput) tenantInput.value = "";
        if (amountInput) amountInput.value = "";
        if (phoneInput) phoneInput.value = "";
        return;
    }

    const invoice = allInvoices.find(item => Number(item.id) === invoiceId);
    if (!invoice) return;

    const tenant = invoice.tenant_name || invoice.tenant?.name || "";
    const balance = invoice.balance !== undefined
        ? Number(invoice.balance)
        : (Number(invoice.amount_due || 0) - Number(invoice.amount_paid || 0));

    if (tenantInput) tenantInput.value = tenant;
    if (amountInput) amountInput.value = balance > 0 ? balance.toFixed(2) : "";

    const phone = invoice.tenant_phone || invoice.phone_number || invoice.tenant?.phone_number || "";
    if (phoneInput && phone) phoneInput.value = phone;
}

function updatePaymentMethodUI() {
    const method = document.getElementById("payment-method")?.value;
    const phoneInput = document.getElementById("payment-phone");
    const referenceInput = document.getElementById("payment-reference");
    const button = document.getElementById("confirm-payment-button");

    if (method === "MPESA") {
        if (phoneInput) {
            phoneInput.required = true;
            phoneInput.placeholder = "e.g. 0712345678";
        }
        if (referenceInput) {
            referenceInput.placeholder = "Leave blank - M-Pesa receipt added automatically";
        }
        if (button) button.textContent = "Send M-Pesa Request";
    } else {
        if (phoneInput) phoneInput.required = false;
        if (referenceInput) referenceInput.placeholder = "e.g. QWE123456";
        if (button) button.textContent = "Record Payment";
    }
}

async function createPayment() {
    const invoice = document.getElementById("payment-invoice")?.value;
    const amount = document.getElementById("payment-amount")?.value;
    const method = document.getElementById("payment-method")?.value;
    const reference = document.getElementById("payment-reference")?.value.trim();
    const phone = document.getElementById("payment-phone")?.value.trim();
    const notes = document.getElementById("payment-notes")?.value.trim();
    const button = document.getElementById("confirm-payment-button");

    if (!invoice) return showPaymentMessage("Please select an invoice.", "error");
    if (!amount || Number(amount) <= 0) return showPaymentMessage("Please enter a valid amount.", "error");
    if (!method) return showPaymentMessage("Please select a payment method.", "error");
    if (method === "MPESA" && !phone) return showPaymentMessage("Phone number is required for M-Pesa.", "error");

    if (button) {
        button.disabled = true;
        button.textContent = method === "MPESA" ? "Starting M-Pesa..." : "Saving...";
    }

    try {
        const response = await fetch(PAYMENTS_API_URL, {
            method: "POST",
            headers: getAuthHeaders(),
            credentials: "same-origin",
            body: JSON.stringify({
                invoice: Number(invoice),
                amount: Number(amount),
                method: method,
                transaction_reference: reference || null,
                phone_number: phone || "",
                notes: notes || ""
            })
        });

        const data = await response.json();
        if (!response.ok) {
            showPaymentMessage(getApiErrorMessage(data), "error");
            return;
        }

        const payment = data.payment || data;
        const paymentId = payment.id || data.payment_id;

        if (method !== "MPESA") {
            showPaymentMessage("Payment recorded successfully.", "success");
            await loadPayments();
            setTimeout(closePaymentModal, 1200);
            return;
        }

        // Trigger M-Pesa STK Push
        showPaymentMessage("Payment created. Starting M-Pesa STK Push...", "success");
        if (button) button.textContent = "Sending M-Pesa Request...";

        const mpesaResponse = await fetch(`${PAYMENTS_API_URL}${paymentId}/mpesa/`, {
            method: "POST",
            headers: getAuthHeaders(),
            credentials: "same-origin",
            body: JSON.stringify({ phone_number: phone })
        });

        const mpesaData = await mpesaResponse.json();
        if (!mpesaResponse.ok) {
            showPaymentMessage(getApiErrorMessage(mpesaData), "error");
            await loadPayments();
            return;
        }

        showPaymentMessage("STK Push sent successfully. Enter M-Pesa PIN on phone.", "success");
        await loadPayments();
        setTimeout(closePaymentModal, 3000);

    } catch (error) {
        console.error("Payment error:", error);
        showPaymentMessage(error.message || "Unable to process payment request.", "error");
    } finally {
        if (button) {
            button.disabled = false;
            updatePaymentMethodUI();
        }
    }
}

/* =========================================================
   COMPLETE PAYMENT ACTION
========================================================= */

async function completePayment(paymentId) {
    if (!paymentId) return;

    const payment = allPayments.find(item => Number(item.id) === Number(paymentId));
    if (!payment) return alert("Payment not found.");

    if (String(payment.status).toUpperCase() === "COMPLETED") {
        return alert("This payment is already completed.");
    }

    const confirmed = confirm(
        `Confirm manually completing this payment?\n\n` +
        `Invoice: ${payment.invoice_number || payment.invoice}\n` +
        `Amount: ${formatCurrency(payment.amount)}\n` +
        `Method: ${payment.method}`
    );

    if (!confirmed) return;

    try {
        const response = await fetch(`${PAYMENTS_API_URL}${paymentId}/complete/`, {
            method: "POST",
            headers: getAuthHeaders(),
            credentials: "same-origin"
        });

        const data = await response.json();
        if (!response.ok) {
            return alert(getApiErrorMessage(data));
        }

        alert(data.message || "Payment completed successfully.");
        await loadPayments();

    } catch (error) {
        console.error("Complete payment error:", error);
        alert("Server error completing payment.");
    }
}

/* =========================================================
   DETAILS MODAL
========================================================= */

function openPaymentDetailsModal(paymentId) {
    const payment = allPayments.find(item => Number(item.id) === Number(paymentId));
    if (!payment) return;

    setText("details-payment-reference", getPaymentReference(payment));
    setText("details-payment-invoice", payment.invoice_number || payment.invoice || "-");
    setText("details-payment-tenant", payment.tenant_name || payment.tenant || "-");
    setText("details-payment-amount", formatCurrency(payment.amount));
    setText("details-payment-method", formatPaymentMethod(payment.method));
    setText("details-payment-date", formatDateTime(payment.payment_date || payment.created_at));
    setText("details-payment-phone", payment.phone_number || "-");
    setText("details-payment-notes", payment.notes || "-");

    const statusElement = document.getElementById("details-payment-status");
    if (statusElement) {
        const status = String(payment.status || "PENDING").toUpperCase();
        statusElement.textContent = formatStatusLabel(status);
        statusElement.className = `status ${status.toLowerCase()}`;
    }

    const completeBtn = document.getElementById("details-complete-button");
    if (completeBtn) {
        if (String(payment.status).toUpperCase() === "PENDING") {
            completeBtn.style.display = "inline-block";
            completeBtn.onclick = () => {
                closePaymentDetailsModal();
                completePayment(payment.id);
            };
        } else {
            completeBtn.style.display = "none";
        }
    }

    const modal = document.getElementById("payment-details-modal");
    if (modal) {
        modal.classList.add("show", "active");
        document.body.classList.add("modal-open");
    }
}

function closePaymentDetailsModal() {
    const modal = document.getElementById("payment-details-modal");
    if (modal) {
        modal.classList.remove("show", "active");
        document.body.classList.remove("modal-open");
    }
}

/* =========================================================
   UI HELPERS & FORMATTERS
========================================================= */

function getPaymentReference(payment) {
    return payment.transaction_reference ||
           payment.mpesa_receipt_number ||
           payment.mpesa_receipt ||
           payment.checkout_request_id ||
           payment.id ||
           "-";
}

function createStatusBadge(status) {
    const normalized = String(status || "PENDING").toUpperCase();
    return `<span class="status ${normalized.toLowerCase()}">${escapeHtml(formatStatusLabel(normalized))}</span>`;
}

function formatStatusLabel(status) {
    return String(status || "")
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, l => l.toUpperCase());
}

function formatPaymentMethod(method) {
    if (!method) return "-";
    switch (String(method).toUpperCase()) {
        case "MPESA": return "M-Pesa";
        case "CASH": return "Cash";
        case "BANK": return "Bank Transfer";
        case "OTHER": return "Other";
        default: return formatStatusLabel(method);
    }
}

function formatCurrency(amount) {
    const numeric = parseFloat(amount || 0);
    if (Number.isNaN(numeric)) return "KSh 0.00";
    return `KSh ${numeric.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(dateValue) {
    if (!dateValue) return "-";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("en-KE", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function resetPaymentForm() {
    const form = document.getElementById("payment-form");
    if (form) form.reset();
    clearPaymentMessage();
}

function showPaymentMessage(message, type) {
    const container = document.getElementById("payment-message") || document.getElementById("payment-message-container");
    if (!container) return type === "error" ? alert(message) : null;

    container.textContent = message;
    container.className = `payment-message show ${type}`;
    container.style.display = "block";
}

function clearPaymentMessage() {
    const container = document.getElementById("payment-message") || document.getElementById("payment-message-container");
    if (!container) return;

    container.textContent = "";
    container.className = "payment-message";
    container.style.display = "none";
}

function showTableLoading() {
    const tbody = document.querySelector("#payment-table tbody") || document.querySelector("table tbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="text-align:center; padding:20px;">Loading payments...</td></tr>`;
}

function showTableError(message) {
    const tbody = document.querySelector("#payment-table tbody") || document.querySelector("table tbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="empty-state error-state" style="text-align:center; padding:20px; color:#e74c3c;">${escapeHtml(message)}</td></tr>`;
}

function setText(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = value ?? "-";
}

function setElementText(elementId, value) {
    setText(elementId, value);
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

/* =========================================================
   GLOBAL SCOPE EXPORTS
========================================================= */

window.openPaymentDetailsModal = openPaymentDetailsModal;
window.closePaymentDetailsModal = closePaymentDetailsModal;
window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.completePayment = completePayment;
window.refreshPayments = loadPayments;