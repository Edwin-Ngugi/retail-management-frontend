"use strict";

/* =========================================================
   PROPERTYPRO TENANT MAINTENANCE
========================================================= */

const MAINTENANCE_ENDPOINTS = {
    LIST: "/tenant/api/maintenance/",
    CREATE: "/tenant/api/maintenance/create/"
};


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    console.log("=================================");
    console.log("PropertyPro Tenant Maintenance");
    console.log("=================================");

    loadMaintenanceRequests();
    setupMaintenanceForm();

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
   AUTH HEADERS
========================================================= */

function getAuthHeaders() {

    const headers = {
        "Accept": "application/json"
    };

    const csrfToken = getCSRFToken();

    if (csrfToken) {
        headers["X-CSRFToken"] = csrfToken;
    }

    const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token");

    if (token) {
        headers["Authorization"] = `Token ${token}`;
    }

    return headers;
}


/* =========================================================
   LOAD MAINTENANCE REQUESTS
========================================================= */

async function loadMaintenanceRequests() {

    const container =
        document.getElementById("maintenance-list");

    const loading =
        document.getElementById("maintenance-loading");

    const empty =
        document.getElementById("maintenance-empty");

    const error =
        document.getElementById("maintenance-error");

    if (!container) {
        return;
    }

    if (loading) {
        loading.style.display = "block";
    }

    if (empty) {
        empty.style.display = "none";
    }

    if (error) {
        error.style.display = "none";
    }

    try {

        const response = await fetch(
            MAINTENANCE_ENDPOINTS.LIST,
            {
                method: "GET",
                headers: getAuthHeaders(),
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

            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const data =
            await response.json();

        const requests =
            Array.isArray(data)
                ? data
                : (data.results || []);

        if (loading) {
            loading.style.display = "none";
        }

        if (!requests.length) {

            container.innerHTML = "";

            if (empty) {
                empty.style.display = "block";
            }

            return;
        }

        renderMaintenanceRequests(
            requests
        );

    } catch (err) {

        console.error(
            "Failed to load maintenance requests:",
            err
        );

        if (loading) {
            loading.style.display = "none";
        }

        if (error) {
            error.style.display = "block";
        }
    }
}


/* =========================================================
   RENDER REQUESTS
========================================================= */

function renderMaintenanceRequests(
    requests
) {

    const container =
        document.getElementById(
            "maintenance-list"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    requests.forEach(request => {

        const card =
            document.createElement("div");

        card.className =
            "request-card";

        const title =
            escapeHtml(
                request.title || "Maintenance Request"
            );

        const description =
            escapeHtml(
                request.description || "-"
            );

        const category =
            formatText(
                request.category || "OTHER"
            );

        const priority =
            String(
                request.priority || "MEDIUM"
            ).toUpperCase();

        const status =
            String(
                request.status || "PENDING"
            ).toUpperCase();

        const date =
            formatDateTime(
                request.reported_at
            );

        card.innerHTML = `

            <div class="request-header">

                <div class="request-title">
                    ${title}
                </div>

                <span class="badge status-${status.toLowerCase().replaceAll("_", "-")}">
                    ${escapeHtml(formatText(status))}
                </span>

            </div>

            <div class="request-description">
                ${description}
            </div>

            <div class="request-meta">

                <span class="badge">
                    ${escapeHtml(category)}
                </span>

                <span class="badge priority-${priority.toLowerCase()}">
                    ${escapeHtml(formatText(priority))}
                </span>

            </div>

            <div class="request-date">
                Reported: ${escapeHtml(date)}
            </div>

        `;

        container.appendChild(card);

    });
}


/* =========================================================
   FORM SETUP
========================================================= */

function setupMaintenanceForm() {

    const form =
        document.getElementById(
            "maintenance-form"
        );

    if (!form) {
        return;
    }

    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            await submitMaintenanceRequest(
                form
            );

        }
    );
}


/* =========================================================
   SUBMIT REQUEST
========================================================= */

async function submitMaintenanceRequest(
    form
) {

    const submitButton =
        form.querySelector(
            ".submit-button"
        );

    const success =
        document.getElementById(
            "maintenance-success"
        );

    const error =
        document.getElementById(
            "maintenance-form-error"
        );

    if (success) {
        success.style.display = "none";
    }

    if (error) {
        error.style.display = "none";
    }

    const formData =
        new FormData(form);

    const payload = {

        title:
            formData.get("title"),

        description:
            formData.get("description"),

        category:
            formData.get("category"),

        priority:
            formData.get("priority")

    };


    if (!payload.title ||
        !payload.description) {

        showFormError(
            "Please provide a title and description."
        );

        return;
    }


    if (submitButton) {

        submitButton.disabled = true;

        submitButton.textContent =
            "Submitting...";
    }


    try {

        const headers =
            getAuthHeaders();

        headers["Content-Type"] =
            "application/json";


        const response =
            await fetch(
                MAINTENANCE_ENDPOINTS.CREATE,
                {
                    method: "POST",
                    headers: headers,
                    credentials: "same-origin",
                    body: JSON.stringify(payload)
                }
            );


        if (response.status === 401 ||
            response.status === 403) {

            window.location.href =
                "/tenant/login/";

            return;
        }


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                data.detail ||
                "Unable to submit maintenance request."
            );
        }


        form.reset();


        showFormSuccess(
            "Maintenance request submitted successfully."
        );


        await loadMaintenanceRequests();


    } catch (err) {

        console.error(
            "Maintenance submission failed:",
            err
        );

        showFormError(
            err.message ||
            "Unable to submit maintenance request."
        );

    } finally {

        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
                "Report Maintenance Issue";
        }
    }
}


/* =========================================================
   ALERTS
========================================================= */

function showFormSuccess(message) {

    const element =
        document.getElementById(
            "maintenance-success"
        );

    if (!element) {
        return;
    }

    element.textContent = message;
    element.style.display = "block";

    setTimeout(() => {

        element.style.display = "none";

    }, 5000);
}


function showFormError(message) {

    const element =
        document.getElementById(
            "maintenance-form-error"
        );

    if (!element) {
        return;
    }

    element.textContent = message;
    element.style.display = "block";
}


/* =========================================================
   FORMATTERS
========================================================= */

function formatText(value) {

    return String(value || "")
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, char =>
            char.toUpperCase()
        );
}


function formatDateTime(value) {

    if (!value) {
        return "-";
    }

    const date =
        new Date(value);

    if (Number.isNaN(
        date.getTime()
    )) {
        return "-";
    }

    return date.toLocaleString(
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


/* =========================================================
   HTML ESCAPING
========================================================= */

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

window.loadMaintenanceRequests =
    loadMaintenanceRequests;

