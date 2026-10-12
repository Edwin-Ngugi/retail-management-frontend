"use strict";

/* =========================================================
   PROPERTYPRO PROPERTIES MANAGEMENT JS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initPropertyCardActions();
    initSmoothScrollToUnits();
    initSearchForm();
    initCardAnimations();
});

/**
 * Handles search input clearing and form submissions
 */
function initSearchForm() {
    const searchForm = document.querySelector(".search-form");
    const searchInput = searchForm ? searchForm.querySelector('input[name="search"]') : null;

    if (!searchForm || !searchInput) return;

    const toggleClearButton = () => {
        let clearBtn = searchForm.querySelector(".clear-search-btn");

        if (searchInput.value.trim().length > 0) {
            if (!clearBtn) {
                clearBtn = document.createElement("button");
                clearBtn.type = "button";
                clearBtn.className = "clear-search-btn";
                clearBtn.innerHTML = "&times;";
                clearBtn.setAttribute("aria-label", "Clear search");

                clearBtn.addEventListener("click", () => {
                    searchInput.value = "";
                    clearBtn.remove();
                    searchForm.submit();
                });

                // Insert clear button right before the submit button for correct layout flow
                const submitBtn = searchForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    searchForm.insertBefore(clearBtn, submitBtn);
                } else {
                    searchForm.appendChild(clearBtn);
                }
            }
        } else if (clearBtn) {
            clearBtn.remove();
        }
    };

    toggleClearButton();
    searchInput.addEventListener("input", toggleClearButton);
}

/**
 * Optimizes card hover animations with hardware acceleration hints
 */
function initCardAnimations() {
    const propertyCards = document.querySelectorAll(".property-card");

    propertyCards.forEach((card) => {
        card.addEventListener("mouseenter", () => {
            card.style.willChange = "transform, box-shadow";
        });

        card.addEventListener("mouseleave", () => {
            card.style.willChange = "auto";
        });
    });
}

/**
 * Handles button loading state on property card action links
 */
function initPropertyCardActions() {
    const cardActions = document.querySelectorAll(".card-actions a");

    cardActions.forEach((button) => {
        button.addEventListener("click", () => {
            const targetUrl = button.getAttribute("href");

            if (targetUrl && !targetUrl.startsWith("#")) {
                button.classList.add("btn-loading");
                button.style.opacity = "0.7";
                button.style.pointerEvents = "none";
            }
        });
    });
}

/**
 * Smooth-scrolls to the units section when navigating via #units anchor
 */
function initSmoothScrollToUnits() {
    if (window.location.hash === "#units") {
        const unitsSection = document.getElementById("units");
        if (unitsSection) {
            unitsSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }
}