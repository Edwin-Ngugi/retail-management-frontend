document.addEventListener("DOMContentLoaded", function () {
    console.log("Tenant Payment Page Loaded");

    // Corrected Endpoints matching your Django URL patterns
    const INVOICES_API = "/api/tenant/invoices/";
    const PAYMENTS_API = "/api/tenant/payments/";

    // --- CSRF & AUTH HELPERS ---
    function getCookie(name) {
        if (!document.cookie) return null;
        const cookies = document.cookie.split(";");
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + "=")) {
                return decodeURIComponent(cookie.substring(name.length + 1));
            }
        }
        return null;
    }

    function getCSRFToken() {
        const cookieToken = getCookie("csrftoken");
        if (cookieToken) return cookieToken;

        const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
        return csrfInput ? csrfInput.value : null;
    }

    function getAuthHeaders() {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const headers = { 
            "Accept": "application/json",
            "Content-Type": "application/json"
        };
        const csrfToken = getCSRFToken();

        if (csrfToken) headers["X-CSRFToken"] = csrfToken;
        if (token) headers["Authorization"] = `Token ${token}`;

        return headers;
    }

    // --- DOM ELEMENTS ---
    const paymentForm = document.getElementById("payment-form");
    const paymentButton = document.getElementById("make-payment-button");
    const buttonText = document.getElementById("button-text");
    const buttonSpinner = document.getElementById("button-spinner");
    const paymentError = document.getElementById("payment-error");
    const paymentSuccess = document.getElementById("payment-success");
    const processingCard = document.getElementById("payment-processing");
    const transactionReference = document.getElementById("transaction-reference");

    const invoiceNumber = document.getElementById("invoice-number");
    const propertyName = document.getElementById("property-name");
    const unitNumber = document.getElementById("unit-number");
    const billingMonth = document.getElementById("billing-month");
    const amountDue = document.getElementById("amount-due");
    const amountPaid = document.getElementById("amount-paid");
    const balanceElement = document.getElementById("balance");
    const paymentAmount = document.getElementById("payment-amount");
    const phoneNumber = document.getElementById("phone-number");

    if (!paymentForm || !paymentButton) {
        console.error("Required payment form elements missing from DOM.");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get("invoice_id");

    // --- UI HELPERS ---
    function showError(message) {
        if (paymentError) {
            paymentError.textContent = message;
            paymentError.hidden = false;
        }
        if (paymentSuccess) paymentSuccess.hidden = true;
        console.error("Payment Error:", message);
    }

    function showSuccess(message) {
        if (paymentSuccess) {
            paymentSuccess.textContent = message;
            paymentSuccess.hidden = false;
        }
        if (paymentError) paymentError.hidden = true;
        console.log("Payment Success:", message);
    }

    function formatMoney(value) {
        const number = Number(value || 0);
        return "KSh " + number.toLocaleString("en-KE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // --- M-PESA PHONE FORMATTER ---
    function normalizePhoneNumber(phone) {
        let cleaned = phone.replace(/\D/g, ""); // Strip non-numeric characters
        if (cleaned.startsWith("0")) {
            cleaned = "254" + cleaned.slice(1);
        } else if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
            cleaned = "254" + cleaned;
        }
        return cleaned;
    }

    function validatePhoneNumber(phone) {
        const normalized = normalizePhoneNumber(phone);
        return /^254[17]\d{8}$/.test(normalized);
    }

    async function getResponseData(response) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return await response.json();
        }
        const text = await response.text();
        return { detail: text || `Server returned HTTP ${response.status}.` };
    }

    function extractInvoices(data) {
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.results)) return data.results;
        if (data && Array.isArray(data.invoices)) return data.invoices;
        return [];
    }

    // --- LOAD INVOICE ---
    async function loadInvoice() {
        if (!invoiceId) {
            showError("No invoice was selected. Please select an invoice to pay.");
            return;
        }

        try {
            const response = await fetch(INVOICES_API, {
                method: "GET",
                credentials: "same-origin",
                headers: getAuthHeaders()
            });

            const data = await getResponseData(response);
            if (!response.ok) throw new Error(data.error || data.detail || `HTTP ${response.status}`);

            const invoices = extractInvoices(data);
            const invoice = invoices.find(item => String(item.id) === String(invoiceId));

            if (!invoice) {
                showError("The selected invoice was not found or access was denied.");
                return;
            }

            displayInvoice(invoice);
        } catch (error) {
            showError(error.message || "Unable to load invoice details.");
        }
    }

    function displayInvoice(invoice) {
        if (invoiceNumber) invoiceNumber.textContent = invoice.invoice_number || "-";
        if (propertyName) propertyName.textContent = invoice.property_name || "-";
        if (unitNumber) unitNumber.textContent = invoice.unit_number || "-";
        if (billingMonth) billingMonth.textContent = invoice.billing_month || "-";
        if (amountDue) amountDue.textContent = formatMoney(invoice.amount_due);
        if (amountPaid) amountPaid.textContent = formatMoney(invoice.amount_paid);

        let invoiceBalance = invoice.balance ?? (Number(invoice.amount_due || 0) - Number(invoice.amount_paid || 0));
        invoiceBalance = Math.max(Number(invoiceBalance), 0);

        if (balanceElement) balanceElement.textContent = formatMoney(invoiceBalance);

        if (paymentAmount) {
            paymentAmount.max = invoiceBalance;
            paymentAmount.value = invoiceBalance > 0 ? invoiceBalance.toFixed(2) : "";
            paymentAmount.dataset.balance = invoiceBalance;
        }

        if (invoiceBalance <= 0) {
            showError("This invoice has no outstanding balance.");
            paymentButton.disabled = true;
            if (buttonText) buttonText.textContent = "Invoice Fully Paid";
        }
    }

    // --- FORM SUBMISSION ---
    paymentForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (paymentError) paymentError.hidden = true;
        if (paymentSuccess) paymentSuccess.hidden = true;

        if (!invoiceId) {
            showError("No invoice was selected.");
            return;
        }

        const rawAmount = paymentAmount ? paymentAmount.value : 0;
        const amount = Number(rawAmount);
        const rawPhone = phoneNumber ? phoneNumber.value.trim() : "";
        const outstandingBalance = Number(paymentAmount?.dataset.balance || 0);

        if (!rawPhone || !validatePhoneNumber(rawPhone)) {
            showError("Please enter a valid Kenyan M-Pesa phone number (e.g., 0712345678).");
            if (phoneNumber) phoneNumber.focus();
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            showError("Please enter a valid payment amount.");
            if (paymentAmount) paymentAmount.focus();
            return;
        }

        if (outstandingBalance <= 0) {
            showError("This invoice has no outstanding balance.");
            return;
        }

        if (amount > outstandingBalance) {
            showError(`Payment cannot exceed outstanding balance of ${formatMoney(outstandingBalance)}.`);
            if (paymentAmount) paymentAmount.focus();
            return;
        }

        const formattedPhone = normalizePhoneNumber(rawPhone);

        paymentButton.disabled = true;
        if (buttonText) buttonText.textContent = "Sending Request...";
        if (buttonSpinner) buttonSpinner.hidden = false;

        try {
            const response = await fetch(PAYMENTS_API, {
                method: "POST",
                credentials: "same-origin",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    invoice_id: invoiceId,
                    amount: amount.toFixed(2),
                    phone_number: formattedPhone
                })
            });

            const data = await getResponseData(response);

            if (response.status === 403) {
                const detail = String(data.detail || data.error || "").toLowerCase();
                throw new Error(detail.includes("csrf") ? "CSRF verification failed. Please refresh." : "Unauthorized action.");
            }

            if (!response.ok) {
                throw new Error(data.error || data.detail || data.message || `Payment request failed. HTTP ${response.status}`);
            }

            showSuccess(data.message || "M-Pesa payment request sent. Check your phone to enter your PIN.");

            if (transactionReference) {
                transactionReference.textContent = data.checkout_request_id || data.payment_id || "-";
            }

            if (processingCard) {
                processingCard.hidden = false;
                processingCard.scrollIntoView({ behavior: "smooth", block: "center" });
            }

            paymentButton.disabled = true;
            if (buttonText) buttonText.textContent = "Payment Request Sent";

        } catch (error) {
            showError(error.message || "Unable to initiate M-Pesa payment.");
            paymentButton.disabled = false;
            if (buttonText) buttonText.textContent = "Make Payment";
        } finally {
            if (buttonSpinner) buttonSpinner.hidden = true;
        }
    });

    loadInvoice();
});