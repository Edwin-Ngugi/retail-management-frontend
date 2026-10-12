"use strict";

/* =========================================================
   CONFIG & GLOBAL STATE
========================================================= */

const ENDPOINTS = {
    // Tenant APIs
    DASHBOARD: "/api/tenant/dashboard/",
    PAYMENTS: "/api/tenant/payments/",
    INVOICES: "/api/tenant/invoices/",

    // Tenant frontend page
    PAYMENT_PAGE: "/tenant/payment/"
};

let currentInvoiceData = null;


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    console.log(
        "=================================\n" +
        "PropertyPro Tenant Dashboard\n" +
        "================================="
    );

    initializeTenantDashboard();
    setupPayButtonListeners();
});


async function initializeTenantDashboard() {

    try {

        await Promise.all([
            loadTenantDashboard(),
            loadRecentPayments()
        ]);

    } catch (error) {

        console.error(
            "Tenant dashboard initialization failed:",
            error
        );
    }
}


/* =========================================================
   AUTHENTICATION & SECURITY
========================================================= */

function getCSRFToken() {

    const match = document.cookie.match(
        /csrftoken=([^;]+)/
    );

    return match
        ? decodeURIComponent(match[1])
        : null;
}


function getAuthHeaders() {

    const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token");

    const headers = {
        "Accept": "application/json"
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

    console.error(
        "Tenant authentication failed."
    );

    localStorage.removeItem("token");
    sessionStorage.removeItem("token");

    alert(
        "Your session has expired. Please log in again."
    );

    window.location.href =
        "/tenant/login/";
}


/* =========================================================
   API DATA FETCHING
========================================================= */

async function loadTenantDashboard() {

    console.log(
        "Loading tenant dashboard from:",
        ENDPOINTS.DASHBOARD
    );

    try {

        const response = await fetch(
            ENDPOINTS.DASHBOARD,
            {
                method: "GET",
                headers: getAuthHeaders(),
                credentials: "same-origin"
            }
        );

        if (!response.ok) {

            if (
                response.status === 401 ||
                response.status === 403
            ) {

                handleAuthenticationError();
                return;
            }

            throw new Error(
                `HTTP ${response.status}: ${await response.text()}`
            );
        }

        const data =
            await response.json();

        console.log(
            "Tenant dashboard data:",
            data
        );

        currentInvoiceData =
            data.current_invoice || null;

        displayTenantInformation(
            data.tenant
        );

        displayLeaseInformation(
            data.active_lease
        );

        displayInvoiceInformation(
            data.current_invoice
        );

        displaySummary(
            data.summary,
            data.active_lease
        );

    } catch (error) {

        console.error(
            "Failed to load tenant dashboard:",
            error
        );

        showDashboardError(
            "Unable to load your dashboard information."
        );
    }
}


async function loadRecentPayments() {

    const tbody =
        document.querySelector(
            "#payments-table tbody"
        );

    if (!tbody) {
        return;
    }

    try {

        const response = await fetch(
            ENDPOINTS.PAYMENTS,
            {
                method: "GET",
                headers: getAuthHeaders(),
                credentials: "same-origin"
            }
        );

        if (!response.ok) {

            if (
                response.status === 401 ||
                response.status === 403
            ) {

                handleAuthenticationError();
                return;
            }

            throw new Error(
                `HTTP ${response.status}: ${await response.text()}`
            );
        }

        const data =
            await response.json();

        const payments =
            Array.isArray(data)
                ? data
                : (data.results || []);

        renderRecentPayments(
            payments
        );

    } catch (error) {

        console.error(
            "Failed to load payments:",
            error
        );

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="empty-state error-state"
                    style="text-align:center; color:#e74c3c;"
                >
                    Unable to load payments.
                </td>
            </tr>
        `;
    }
}


/* =========================================================
   DOM DISPLAY RENDERING
========================================================= */

function displayTenantInformation(tenant) {

    if (!tenant) {

        console.warn(
            "No tenant information returned."
        );

        return;
    }

    const name =
        tenant.full_name ||
        tenant.username ||
        "-";

    setText(
        "tenant-name",
        name
    );

    setText(
        "topbar-username",
        tenant.username || "-"
    );

    const avatar =
        document.getElementById(
            "user-avatar"
        );

    if (
        avatar &&
        name !== "-"
    ) {

        avatar.textContent =
            name.charAt(0).toUpperCase();
    }
}


function displayLeaseInformation(lease) {

    if (!lease) {

        setText(
            "property-name",
            "No active lease"
        );

        [
            "property-address",
            "property-city",
            "unit-number",
            "unit-type",
            "unit-floor",
            "lease-start",
            "lease-end"
        ].forEach(
            id => setText(id, "-")
        );

        setText(
            "lease-rent",
            "KSh 0.00"
        );

        const leaseStatus =
            document.getElementById(
                "lease-status"
            );

        if (leaseStatus) {

            leaseStatus.textContent =
                "No Active Lease";

            leaseStatus.className =
                "status inactive";
        }

        return;
    }

    const unit =
        lease.unit || {};

    setText(
        "property-name",
        lease.property_name ||
        unit.property_name ||
        "-"
    );

    setText(
        "property-address",
        lease.property_address ||
        unit.property_address ||
        "-"
    );

    setText(
        "property-city",
        lease.city ||
        lease.property_city ||
        unit.property_city ||
        "-"
    );

    setText(
        "unit-number",
        lease.unit_number ||
        unit.unit_number ||
        "-"
    );

    setText(
        "unit-type",
        formatText(
            lease.unit_type ||
            unit.unit_type ||
            "-"
        )
    );

    setText(
        "unit-floor",
        lease.floor ||
        lease.unit_floor ||
        unit.floor ||
        unit.floor_number ||
        "-"
    );

    setText(
        "lease-start",
        formatDate(
            lease.start_date
        )
    );

    setText(
        "lease-end",
        formatDate(
            lease.end_date
        )
    );

    setText(
        "lease-rent",
        formatCurrency(
            lease.monthly_rent ||
            lease.rent_amount ||
            0
        )
    );

    const leaseStatus =
        document.getElementById(
            "lease-status"
        );

    if (leaseStatus) {

        const status =
            String(
                lease.status || "ACTIVE"
            ).toUpperCase();

        leaseStatus.textContent =
            formatStatus(status);

        leaseStatus.className =
            `status ${status.toLowerCase()}`;
    }
}


function displayInvoiceInformation(invoice) {

    const invoiceContent =
        document.getElementById(
            "invoice-content"
        );

    const noInvoice =
        document.getElementById(
            "no-invoice"
        );

    if (!invoice) {

        currentInvoiceData = null;

        if (invoiceContent) {
            invoiceContent.style.display =
                "none";
        }

        if (noInvoice) {
            noInvoice.style.display =
                "flex";
        }

        return;
    }

    currentInvoiceData =
        invoice;

    if (invoiceContent) {
        invoiceContent.style.display =
            "block";
    }

    if (noInvoice) {
        noInvoice.style.display =
            "none";
    }

    setText(
        "invoice-number",
        invoice.invoice_number || "-"
    );

    setText(
        "billing-month",
        formatMonth(
            invoice.billing_month
        )
    );

    setText(
        "invoice-amount",
        formatCurrency(
            invoice.amount_due
        )
    );

    setText(
        "invoice-paid",
        formatCurrency(
            invoice.amount_paid
        )
    );

    let balance =
        invoice.balance ??
        (
            Number(
                invoice.amount_due || 0
            ) -
            Number(
                invoice.amount_paid || 0
            )
        );

    balance =
        Math.max(
            Number(balance || 0),
            0
        );

    setText(
        "invoice-balance",
        formatCurrency(balance)
    );

    const statusElement =
        document.getElementById(
            "invoice-status"
        );

    if (statusElement) {

        const status =
            balance <= 0
                ? "PAID"
                : String(
                    invoice.status ||
                    "UNPAID"
                ).toUpperCase();

        statusElement.textContent =
            formatStatus(status);

        statusElement.className =
            `status ${status.toLowerCase()}`;
    }

    document
        .querySelectorAll(
            "#pay-invoice-btn, #btn-pay-now"
        )
        .forEach(button => {

            button.dataset.invoiceId =
                String(invoice.id);

            button.disabled =
                balance <= 0;

            button.textContent =
                balance <= 0
                    ? "Invoice Paid"
                    : "Pay Invoice";
        });
}


function displaySummary(
    summary = {},
    activeLease
) {

    const monthlyRent =
        activeLease
            ? (
                activeLease.monthly_rent ||
                activeLease.rent_amount ||
                0
            )
            : 0;

    setText(
        "monthly-rent",
        formatCurrency(
            summary.monthly_rent ??
            monthlyRent
        )
    );

    setText(
        "outstanding-balance",
        formatCurrency(
            summary.outstanding ?? 0
        )
    );

    setText(
        "total-paid",
        formatCurrency(
            summary.total_paid ?? 0
        )
    );

    setText(
        "invoice-count",
        summary.invoice_count ?? 0
    );
}


function renderRecentPayments(payments) {

    const tbody =
        document.querySelector(
            "#payments-table tbody"
        );

    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";

    if (
        !payments ||
        payments.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="empty-state"
                    style="text-align:center;"
                >
                    No payments found.
                </td>
            </tr>
        `;

        return;
    }

    payments
        .slice(0, 5)
        .forEach(payment => {

            const row =
                document.createElement("tr");

            const ref =
                payment.transaction_reference ||
                payment.checkout_request_id ||
                payment.mpesa_receipt_number ||
                payment.id ||
                "-";

            const status =
                String(
                    payment.status ||
                    "PENDING"
                ).toUpperCase();

            row.innerHTML = `
                <td>
                    <strong>
                        ${escapeHtml(
                            String(ref)
                        )}
                    </strong>
                </td>

                <td>
                    <strong>
                        ${formatCurrency(
                            payment.amount
                        )}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(
                        formatPaymentMethod(
                            payment.method
                        )
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        formatDateTime(
                            payment.payment_date ||
                            payment.created_at
                        )
                    )}
                </td>

                <td>
                    <span
                        class="status ${status.toLowerCase()}"
                    >
                        ${escapeHtml(
                            formatStatus(status)
                        )}
                    </span>
                </td>
            `;

            tbody.appendChild(row);
        });
}


/* =========================================================
   PAYMENT ACTION
========================================================= */

function openPaymentPage(invoiceId = null) {

    const idToUse =
        invoiceId ??
        currentInvoiceData?.id;

    if (
        !idToUse ||
        idToUse === "null" ||
        idToUse === "undefined"
    ) {

        alert(
            "There is no outstanding invoice available for payment."
        );

        return;
    }

    if (
        currentInvoiceData &&
        String(
            currentInvoiceData.id
        ) === String(idToUse)
    ) {

        const balance =
            currentInvoiceData.balance ??
            (
                Number(
                    currentInvoiceData.amount_due || 0
                ) -
                Number(
                    currentInvoiceData.amount_paid || 0
                )
            );

        if (balance <= 0) {

            alert(
                "This invoice has already been fully paid."
            );

            return;
        }
    }

    window.location.href =
        `${ENDPOINTS.PAYMENT_PAGE}?invoice_id=${encodeURIComponent(idToUse)}`;
}


function setupPayButtonListeners() {

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "#pay-invoice-btn, #btn-pay-now"
                );

            if (!button) {
                return;
            }

            event.preventDefault();

            const datasetId =
                button.dataset.invoiceId;

            const invoiceId =
                (
                    datasetId &&
                    datasetId !== "null" &&
                    datasetId !== "undefined"
                )
                    ? datasetId
                    : currentInvoiceData?.id;

            openPaymentPage(
                invoiceId
            );
        }
    );
}


function showDashboardError(message) {

    console.error(message);
}


/* =========================================================
   FORMATTERS & HELPERS
========================================================= */

function setText(
    elementId,
    value
) {

    const el =
        document.getElementById(
            elementId
        );

    if (el) {
        el.textContent =
            value ?? "-";
    }
}


function formatCurrency(amount) {

    const num =
        parseFloat(
            amount || 0
        );

    if (Number.isNaN(num)) {
        return "KSh 0.00";
    }

    return (
        "KSh " +
        num.toLocaleString(
            "en-KE",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        )
    );
}


function parseLocalDate(dateValue) {

    if (!dateValue) {
        return null;
    }

    return (
        typeof dateValue === "string" &&
        dateValue.includes("T")
    )
        ? new Date(dateValue)
        : new Date(
            `${dateValue}T00:00:00`
        );
}


function formatDate(dateValue) {

    const date =
        parseLocalDate(dateValue);

    return (
        !date ||
        Number.isNaN(
            date.getTime()
        )
    )
        ? "-"
        : date.toLocaleDateString(
            "en-KE",
            {
                year: "numeric",
                month: "short",
                day: "numeric"
            }
        );
}


function formatDateTime(dateValue) {

    if (!dateValue) {
        return "-";
    }

    const date =
        new Date(dateValue);

    return Number.isNaN(
        date.getTime()
    )
        ? "-"
        : date.toLocaleString(
            "en-KE",
            {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );
}


function formatMonth(dateValue) {

    const date =
        parseLocalDate(dateValue);

    return (
        !date ||
        Number.isNaN(
            date.getTime()
        )
    )
        ? "-"
        : date.toLocaleDateString(
            "en-KE",
            {
                year: "numeric",
                month: "long"
            }
        );
}


function formatPaymentMethod(method) {

    if (!method) {
        return "-";
    }

    const map = {
        MPESA: "M-Pesa",
        BANK: "Bank Transfer",
        CASH: "Cash",
        OTHER: "Other"
    };

    return (
        map[
            String(method).toUpperCase()
        ] ||
        formatStatus(method)
    );
}


function formatStatus(status) {

    return String(status || "")
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(
            /\b\w/g,
            char => char.toUpperCase()
        );
}


function formatText(value) {

    return !value
        ? "-"
        : formatStatus(value);
}


function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;
}


/* =========================================================
   GLOBAL
========================================================= */

window.openPaymentPage =
    openPaymentPage;