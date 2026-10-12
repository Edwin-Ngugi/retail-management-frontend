"use strict";

/* =========================================================
   PROPERTYPRO - TENANT REPORT MAINTENANCE JS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initializeMaintenanceForm();
});

/* =========================================================
   INITIALIZATION
========================================================= */

function initializeMaintenanceForm() {
    const form = document.getElementById("maintenance-form");

    if (!form) {
        console.warn("Maintenance form not found.");
        return;
    }

    setupFormValidation(form);
    setupCharacterCounter();
    setupFieldClearOnInput();
}

/* =========================================================
   FORM VALIDATION & SUBMISSION
========================================================= */

function setupFormValidation(form) {
    form.addEventListener("submit", (event) => {
        const titleInput = document.getElementById("title");
        const categorySelect = document.getElementById("category");
        const prioritySelect = document.getElementById("priority");
        const descriptionTextarea = document.getElementById("description");

        const title = titleInput?.value.trim();
        const category = categorySelect?.value;
        const priority = prioritySelect?.value;
        const description = descriptionTextarea?.value.trim();

        /* ---------------------------------------------
           VALIDATION CHECKS
        --------------------------------------------- */

        if (!title) {
            event.preventDefault();
            showFieldError(titleInput, "Please provide a title for the maintenance issue.");
            return;
        }

        if (!category) {
            event.preventDefault();
            showFieldError(categorySelect, "Please select a maintenance category.");
            return;
        }

        if (!priority) {
            event.preventDefault();
            showFieldError(prioritySelect, "Please select the priority level.");
            return;
        }

        if (!description) {
            event.preventDefault();
            showFieldError(descriptionTextarea, "Please describe the maintenance issue.");
            return;
        }

        if (description.length < 10) {
            event.preventDefault();
            showFieldError(descriptionTextarea, "Please provide a little more detail (at least 10 characters).");
            return;
        }

        /* ---------------------------------------------
           PREVENT DOUBLE SUBMISSION & UI LOADING
        --------------------------------------------- */

        const submitButton = form.querySelector('button[type="submit"]');

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.dataset.originalText = submitButton.textContent;
            submitButton.textContent = "Submitting Request...";
            submitButton.style.opacity = "0.75";
            submitButton.style.cursor = "not-allowed";
        }
    });
}

/* =========================================================
   INLINE ERROR HANDLING
========================================================= */

function showFieldError(inputElement, message) {
    removeExistingError();

    if (!inputElement) {
        alert(message);
        return;
    }

    // Highlight border on input
    inputElement.classList.add("input-error");
    inputElement.focus();

    // Create styled inline banner
    const errorBanner = document.createElement("div");
    errorBanner.className = "alert error-alert form-error-message";
    errorBanner.setAttribute("role", "alert");

    errorBanner.innerHTML = `
        <div class="alert-icon">⚠️</div>
        <div class="alert-body">
            <strong>Check your entry</strong>
            <p>${escapeHtml(message)}</p>
        </div>
    `;

    const form = document.getElementById("maintenance-form");
    if (form) {
        form.insertBefore(errorBanner, form.firstElementChild);
        errorBanner.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

function removeExistingError() {
    const existing = document.querySelector(".form-error-message");
    if (existing) {
        existing.remove();
    }

    document.querySelectorAll(".input-error").forEach((el) => {
        el.classList.remove("input-error");
    });
}

function setupFieldClearOnInput() {
    const inputs = document.querySelectorAll("#maintenance-form input, #maintenance-form select, #maintenance-form textarea");
    inputs.forEach((input) => {
        input.addEventListener("input", () => {
            if (input.classList.contains("input-error")) {
                input.classList.remove("input-error");
                removeExistingError();
            }
        });
    });
}

/* =========================================================
   CHARACTER COUNTER FOR TEXTAREA
========================================================= */

function setupCharacterCounter() {
    const description = document.getElementById("description");
    if (!description) return;

    // Default to max 1000 characters if maxlength isn't explicitly defined
    const maxLength = description.getAttribute("maxlength") || 1000;

    const counter = document.createElement("small");
    counter.className = "help-text character-counter";
    counter.style.textAlign = "right";
    counter.style.marginTop = "4px";

    counter.textContent = `0 / ${maxLength} characters`;
    description.parentElement.appendChild(counter);

    function updateCounter() {
        const currentLength = description.value.length;
        counter.textContent = `${currentLength} / ${maxLength} characters`;

        if (currentLength >= Number(maxLength) * 0.9) {
            counter.style.color = "#dc2626";
            counter.style.fontWeight = "600";
        } else {
            counter.style.color = "#6b7280";
            counter.style.fontWeight = "normal";
        }
    }

    description.addEventListener("input", updateCounter);
    updateCounter();
}

/* =========================================================
   UTILITIES
========================================================= */

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

/* Expose initialization function globally */
window.initializeMaintenanceForm = initializeMaintenanceForm;