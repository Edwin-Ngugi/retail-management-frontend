"use strict";

console.log("invoices.js loaded");

/* =======================================================
   GLOBAL VARIABLES
======================================================= */

let allInvoices = [];

/* =======================================================
   PAGE INITIALIZATION
======================================================= */

document.addEventListener("DOMContentLoaded", function () {
    console.log("Invoices page loaded");

    loadInvoices();
    setupFilters();
    setupModalEvents();
});

/* =======================================================
   CSRF TOKEN
======================================================= */

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

/* =======================================================
   LOAD INVOICES FROM API
======================================================= */

async function loadInvoices() {
    const table = document.getElementById("invoice-table");

    if (!table) {
        console.error("invoice-table element not found.");
        return;
    }

    table.innerHTML = `
        <tr>
            <td colspan="11" class="empty-state">
                Loading invoices...
            </td>
        </tr>
    `;

    try {
        const response = await fetch("/api/invoices/", {
            method: "GET",
            headers: {
                "Accept": "application/json"
            },
            credentials: "same-origin"
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || data.error || `HTTP ${response.status}`);
        }

        allInvoices = Array.isArray(data)
            ? data
            : (data.results && Array.isArray(data.results) ? data.results : []);

        console.log("Invoices loaded:", allInvoices);

        renderInvoices(allInvoices);
        updateSummaryCards(allInvoices);

    } catch (error) {
        console.error("Error loading invoices:", error);

        table.innerHTML = `
            <tr>
                <td colspan="11" class="empty-state">
                    Unable to load invoices.
                </td>
            </tr>
        `;

        updateSummaryCards([]);
    }
}

/* =======================================================
   RENDER INVOICES
======================================================= */

function renderInvoices(data) {
    const table = document.getElementById("invoice-table");

    if (!table) {
        console.error("invoice-table element not found.");
        return;
    }

    if (!data || data.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="11" class="empty-state">
                    No invoices found.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = data.map(function (invoice) {
        const amountDue = Number(invoice.amount_due || 0);
        const amountPaid = Number(invoice.amount_paid || 0);
        const balance = Math.max(amountDue - amountPaid, 0);

        const tenant = invoice.tenant_name || invoice.tenant || "-";
        const property = invoice.property_name || invoice.property || "-";
        const unit = invoice.unit_number || invoice.unit || "-";
        const status = invoice.status || "UNPAID";
        const invoiceNumber = invoice.invoice_number || "-";

        return `
            <tr>
                <td><strong>${escapeHTML(invoiceNumber)}</strong></td>
                <td>${escapeHTML(tenant)}</td>
                <td>${escapeHTML(property)}</td>
                <td>${escapeHTML(unit)}</td>
                <td>${formatBillingMonth(invoice.billing_month)}</td>
                <td>KSh ${formatMoney(amountDue)}</td>
                <td>KSh ${formatMoney(amountPaid)}</td>
                <td><strong class="outstanding-balance">KSh ${formatMoney(balance)}</strong></td>
                <td>${formatDate(invoice.due_date)}</td>
                <td>
                    <span class="status ${escapeHTML(status.toLowerCase())}">
                        ${escapeHTML(status)}
                    </span>
                </td>
                <td>
                    <button class="view-button" onclick="viewInvoice(${invoice.id})">
                        View
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

/* =======================================================
   SUMMARY CARDS
======================================================= */

function updateSummaryCards(invoices) {
    let totalInvoices = 0;
    let totalBilled = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;
    let overdueCount = 0;

    invoices.forEach(function (invoice) {
        const amountDue = Number(invoice.amount_due || 0);
        const amountPaid = Number(invoice.amount_paid || 0);
        const balance = Math.max(amountDue - amountPaid, 0);

        totalInvoices++;
        totalBilled += amountDue;
        totalPaid += amountPaid;
        totalOutstanding += balance;

        const status = String(invoice.status || "").toUpperCase();

        if (status === "PAID") {
            paidCount++;
        } else if (status === "PARTIAL") {
            partialCount++;
        } else if (status === "OVERDUE") {
            overdueCount++;
        } else {
            unpaidCount++;
        }
    });

    setCardValue("total-invoices-count", totalInvoices);
    setCardValue("total-invoices-amount", `KSh ${formatMoney(totalBilled)}`);
    setCardValue("total-paid-amount", `KSh ${formatMoney(totalPaid)}`);
    setCardValue("total-outstanding-amount", `KSh ${formatMoney(totalOutstanding)}`);
    setCardValue("paid-invoices-count", paidCount);
    setCardValue("partial-invoices-count", partialCount);
    setCardValue("unpaid-invoices-count", unpaidCount);
    setCardValue("overdue-invoices-count", overdueCount);
}

/* =======================================================
   SET CARD VALUE
======================================================= */

function setCardValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

/* =======================================================
   FILTERS
======================================================= */

function setupFilters() {
    const search = document.getElementById("invoice-search");
    const status = document.getElementById("invoice-status-filter");
    const property = document.getElementById("invoice-property-filter");

    if (search) search.addEventListener("input", applyFilters);
    if (status) status.addEventListener("change", applyFilters);
    if (property) property.addEventListener("change", applyFilters);
}

/* =======================================================
   APPLY FILTERS
======================================================= */

function applyFilters() {
    const search = document.getElementById("invoice-search")?.value.toLowerCase().trim() || "";
    const status = document.getElementById("invoice-status-filter")?.value || "";
    const property = document.getElementById("invoice-property-filter")?.value || "";

    const filtered = allInvoices.filter(function (invoice) {
        const invoiceNumber = String(invoice.invoice_number || "").toLowerCase();
        const tenant = String(invoice.tenant_name || invoice.tenant || "").toLowerCase();
        const propertyName = String(invoice.property_name || invoice.property || "").toLowerCase();
        const unit = String(invoice.unit_number || invoice.unit || "").toLowerCase();

        const matchesSearch =
            !search ||
            invoiceNumber.includes(search) ||
            tenant.includes(search) ||
            propertyName.includes(search) ||
            unit.includes(search);

        const matchesStatus =
            !status || String(invoice.status || "").toUpperCase() === status.toUpperCase();

        const matchesProperty =
            !property || String(invoice.property_name || invoice.property || "") === property;

        return matchesSearch && matchesStatus && matchesProperty;
    });

    renderInvoices(filtered);
    updateSummaryCards(filtered);
}

/* =======================================================
   OPEN INVOICE MODAL
======================================================= */

function openInvoiceModal() {
    const modal = document.getElementById("invoice-modal");

    if (!modal) {
        console.error("invoice-modal not found.");
        return;
    }

    clearInvoiceMessage();

    const form = document.getElementById("invoice-form");
    if (form) form.reset();

    modal.classList.add("show");
}

/* =======================================================
   CLOSE INVOICE MODAL
======================================================= */

function closeInvoiceModal() {
    const modal = document.getElementById("invoice-modal");
    if (!modal) return;

    modal.classList.remove("show");
    clearInvoiceMessage();
}

/* =======================================================
   CREATE INVOICE
======================================================= */

async function createInvoice() {
    const lease = document.getElementById("invoice-lease")?.value;
    const billingMonth = document.getElementById("invoice-billing-month")?.value;

    if (!lease) {
        showInvoiceMessage("Please select a lease.", "error");
        return;
    }

    if (!billingMonth) {
        showInvoiceMessage("Please select a billing month.", "error");
        return;
    }

    const button = document.getElementById("confirm-invoice-button");

    if (button) {
        button.disabled = true;
        button.textContent = "Creating...";
    }

    try {
        const response = await fetch("/api/invoices/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCSRFToken() || "",
                "Accept": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                lease: Number(lease),
                billing_month: billingMonth
            })
        });

        const data = await response.json();

        if (!response.ok) {
            let message = "Failed to create invoice.";

            if (data.detail) {
                message = data.detail;
            } else if (data.error) {
                message = data.error;
            } else if (typeof data === "object") {
                message = Object.values(data).flat().join(" ");
            }

            showInvoiceMessage(message, "error");
            return;
        }

        showInvoiceMessage("Invoice created successfully.", "success");
        await loadInvoices();

        setTimeout(function () {
            closeInvoiceModal();
        }, 1000);

    } catch (error) {
        console.error("Create invoice error:", error);
        showInvoiceMessage("Unable to connect to the server.", "error");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Create Invoice";
        }
    }
}

/* =======================================================
   VIEW INVOICE
======================================================= */

function viewInvoice(invoiceId) {
    const invoice = allInvoices.find(function (item) {
        return Number(item.id) === Number(invoiceId);
    });

    if (!invoice) {
        alert(`Invoice ID: ${invoiceId}`);
        return;
    }

    const amountDue = Number(invoice.amount_due || 0);
    const amountPaid = Number(invoice.amount_paid || 0);

    const balance =
        invoice.balance !== undefined && invoice.balance !== null
            ? Math.max(Number(invoice.balance), 0)
            : Math.max(amountDue - amountPaid, 0);

    const tenant = invoice.tenant_name || invoice.tenant || "-";
    const property = invoice.property_name || invoice.property || "-";
    const unit = invoice.unit_number || invoice.unit || "-";
    const status = invoice.status || "UNPAID";

    alert(
        `Invoice: ${invoice.invoice_number || "-"}\n` +
        `Tenant: ${tenant}\n` +
        `Property: ${property}\n` +
        `Unit: ${unit}\n` +
        `Billing Month: ${formatBillingMonth(invoice.billing_month)}\n` +
        `Amount Due: KSh ${formatMoney(amountDue)}\n` +
        `Amount Paid: KSh ${formatMoney(amountPaid)}\n` +
        `Outstanding Balance: KSh ${formatMoney(balance)}\n` +
        `Due Date: ${formatDate(invoice.due_date)}\n` +
        `Status: ${status}`
    );
}

/* =======================================================
   MESSAGE
======================================================= */

function showInvoiceMessage(text, type) {
    const message = document.getElementById("invoice-message");
    if (!message) return;

    message.textContent = text;
    message.className = "invoice-message show " + type;
}

/* =======================================================
   CLEAR MESSAGE
======================================================= */

function clearInvoiceMessage() {
    const message = document.getElementById("invoice-message");
    if (!message) return;

    message.textContent = "";
    message.className = "invoice-message";
}

/* =======================================================
   MODAL EVENTS
======================================================= */

function setupModalEvents() {
    document.addEventListener("click", function (event) {
        const modal = document.getElementById("invoice-modal");
        if (modal && event.target === modal) {
            closeInvoiceModal();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key !== "Escape") return;
        const modal = document.getElementById("invoice-modal");
        if (modal && modal.classList.contains("show")) {
            closeInvoiceModal();
        }
    });
}

/* =======================================================
   FORMAT MONEY
======================================================= */

function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/* =======================================================
   FORMAT BILLING MONTH
======================================================= */

function formatBillingMonth(value) {
    if (!value) return "-";

    if (/^\d{4}-\d{2}$/.test(value)) {
        const [year, month] = value.split("-");
        const date = new Date(Number(year), Number(month) - 1, 1);
        return date.toLocaleDateString("en-GB", {
            month: "short",
            year: "numeric"
        });
    }

    return formatDate(value);
}

/* =======================================================
   FORMAT DATE
======================================================= */

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);
    if (isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

/* =======================================================
   ESCAPE HTML
======================================================= */

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}