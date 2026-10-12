/**
 * PropertyPro Management Portal - Invoice Actions
 */

document.addEventListener("DOMContentLoaded", function () {
    initInvoiceSearch();
    initNoticeTriggers();
});

/**
 * Filter invoice table rows dynamically as the user types
 */
function initInvoiceSearch() {
    const searchInput = document.getElementById("invoice-search-input");
    const tableBody = document.querySelector("#invoice-table tbody");

    if (!searchInput || !tableBody) return;

    searchInput.addEventListener("input", function (e) {
        const query = e.target.value.toLowerCase().trim();
        const rows = tableBody.querySelectorAll("tr");

        rows.forEach((row) => {
            const invoiceNum = row.cells[0]?.textContent.toLowerCase() || "";
            const tenantName = row.cells[1]?.textContent.toLowerCase() || "";

            if (invoiceNum.includes(query) || tenantName.includes(query)) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        });
    });
}

/**
 * Handle "Send Notice" button clicks with confirmation and feedback
 */
function initNoticeTriggers() {
    const noticeButtons = document.querySelectorAll(".btn-send-notice");

    noticeButtons.forEach((button) => {
        button.addEventListener("click", function (e) {
            e.preventDefault();
            const invoiceId = this.dataset.invoiceId;
            const tenantName = this.dataset.tenantName;

            if (confirm(`Are you sure you want to issue an overdue rent notice to ${tenantName} for Invoice #${invoiceId}?`)) {
                sendPaymentNotice(invoiceId, this);
            }
        });
    });
}

/**
 * Send request to trigger an automated payment reminder notice
 */
function sendPaymentNotice(invoiceId, buttonElem) {
    const originalText = buttonElem.textContent;
    buttonElem.textContent = "Sending...";
    buttonElem.style.pointerEvents = "none";

    // Obtain CSRF Token from meta tag or cookie
    const csrfToken = getCsrfToken();

    fetch(`/management/invoices/${invoiceId}/send-notice/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
        },
    })
        .then((response) => {
            if (response.ok) {
                alert("Payment notice dispatched successfully.");
                buttonElem.textContent = "Notice Sent";
                buttonElem.style.color = "#166534";
            } else {
                throw new Error("Failed to send notice.");
            }
        })
        .catch((error) => {
            console.error("Notice Dispatch Error:", error);
            alert("Could not send notice. Please try again.");
            buttonElem.textContent = originalText;
            buttonElem.style.pointerEvents = "auto";
        });
}

/**
 * Utility to retrieve Django CSRF Token from cookie
 */
function getCsrfToken() {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, 10) === "csrftoken=") {
                cookieValue = decodeURIComponent(cookie.substring(10));
                break;
            }
        }
    }
    return cookieValue;
}