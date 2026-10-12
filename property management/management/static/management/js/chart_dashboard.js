/**
 * PropertyPro Management Portal - Dashboard Analytics & Formatting
 */

document.addEventListener("DOMContentLoaded", function () {
    formatCurrencyFields();
    highlightOverdueRows();
});

/**
 * Automatically format plain numeric text into KSh formatted strings
 */
function formatCurrencyFields() {
    const currencyElems = document.querySelectorAll(".format-ksh");

    currencyElems.forEach((elem) => {
        const val = parseFloat(elem.textContent.replace(/[^0-9.-]+/g, ""));
        if (!isNaN(val)) {
            elem.textContent = new Intl.NumberFormat("en-KE", {
                style: "currency",
                currency: "KES",
                minimumFractionDigits: 2,
            }).format(val).replace("KES", "KSh");
        }
    });
}

/**
 * Apply visual highlighting to overdue rows in invoice list
 */
function highlightOverdueRows() {
    const statusBadges = document.querySelectorAll(".status-badge");

    statusBadges.forEach((badge) => {
        if (badge.textContent.trim().toUpperCase() === "OVERDUE") {
            const row = badge.closest("tr");
            if (row) {
                row.style.backgroundColor = "#fff5f5";
            }
        }
    });
}