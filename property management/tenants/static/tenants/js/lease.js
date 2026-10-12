"use strict";

/* =========================================================
   PROPERTYPRO TENANT LEASE
========================================================= */

const LEASE_API_URL = "/api/tenant/lease/";


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    console.log("PropertyPro Tenant Lease");

    loadLease();

});


/* =========================================================
   CSRF
========================================================= */

function getCSRFToken() {

    const match = document.cookie.match(
        /csrftoken=([^;]+)/
    );

    return match
        ? decodeURIComponent(match[1])
        : null;
}


/* =========================================================
   HEADERS
========================================================= */

function getHeaders() {

    const headers = {
        "Accept": "application/json"
    };

    const csrfToken = getCSRFToken();

    if (csrfToken) {
        headers["X-CSRFToken"] = csrfToken;
    }

    return headers;
}


/* =========================================================
   LOAD LEASE
========================================================= */

async function loadLease() {

    showLoading();

    try {

        const response = await fetch(
            LEASE_API_URL,
            {
                method: "GET",
                headers: getHeaders(),
                credentials: "same-origin"
            }
        );


        if (response.status === 401 ||
            response.status === 403) {

            window.location.href =
                "/tenant/login/";

            return;
        }


        if (!response.ok) {

            const text =
                await response.text();

            throw new Error(
                `HTTP ${response.status}: ${text}`
            );
        }


        const data =
            await response.json();

        console.log(
            "Tenant lease:",
            data
        );


        /*
         * API returns:
         *
         * {
         *     ...
         * }
         *
         * OR:
         *
         * {
         *     message: "...",
         *     lease: null
         * }
         */

        const lease =
            data.lease !== undefined
                ? data.lease
                : data;


        if (!lease) {

            showNoLease();

            return;
        }


        displayLease(lease);

    }

    catch (error) {

        console.error(
            "Failed to load lease:",
            error
        );

        showError(
            "Unable to load your lease information."
        );
    }
}


/* =========================================================
   DISPLAY LEASE
========================================================= */

function displayLease(lease) {

    hideAllStates();

    const content =
        document.getElementById(
            "lease-content"
        );

    if (content) {
        content.style.display = "block";
    }


    setText(
        "property-name",
        lease.property_name || "-"
    );

    setText(
        "property-address",
        lease.property_address || "-"
    );

    setText(
        "property-city",
        lease.city ||
        lease.property_city ||
        "-"
    );


    setText(
        "unit-number",
        lease.unit_number || "-"
    );

    setText(
        "unit-type",
        formatText(
            lease.unit_type
        )
    );

    setText(
        "unit-floor",
        lease.floor ?? "-"
    );


    setText(
        "monthly-rent",
        formatCurrency(
            lease.monthly_rent ||
            lease.rent_amount ||
            0
        )
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


    const status =
        String(
            lease.status || "ACTIVE"
        ).toUpperCase();


    setText(
        "lease-status",
        formatStatus(status)
    );

    const badge =
        document.getElementById(
            "lease-status-badge"
        );

    if (badge) {

        badge.textContent =
            formatStatus(status);

        badge.className =
            `status-badge ${status.toLowerCase()}`;
    }
}


/* =========================================================
   STATES
========================================================= */

function showLoading() {

    hideAllStates();

    const element =
        document.getElementById(
            "lease-loading"
        );

    if (element) {
        element.style.display = "flex";
    }
}


function showNoLease() {

    hideAllStates();

    const element =
        document.getElementById(
            "no-lease"
        );

    if (element) {
        element.style.display = "flex";
    }
}


function showError(message) {

    hideAllStates();

    const element =
        document.getElementById(
            "lease-error"
        );

    const messageElement =
        document.getElementById(
            "lease-error-message"
        );

    if (messageElement) {
        messageElement.textContent =
            message;
    }

    if (element) {
        element.style.display = "flex";
    }
}


function hideAllStates() {

    [
        "lease-loading",
        "lease-error",
        "no-lease",
        "lease-content"
    ].forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {
            element.style.display = "none";
        }

    });
}


/* =========================================================
   HELPERS
========================================================= */

function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            value ?? "-";
    }
}


function formatCurrency(amount) {

    const number =
        parseFloat(amount || 0);

    if (Number.isNaN(number)) {
        return "KSh 0.00";
    }

    return (
        "KSh " +
        number.toLocaleString(
            "en-KE",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        )
    );
}


function formatDate(value) {

    if (!value) {
        return "-";
    }

    const date =
        new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleDateString(
        "en-KE",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}


function formatStatus(value) {

    return String(value || "")
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(
            /\b\w/g,
            char => char.toUpperCase()
        );
}


function formatText(value) {

    if (!value) {
        return "-";
    }

    return formatStatus(value);
}