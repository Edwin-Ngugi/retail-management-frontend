"use strict";

/* =========================================================
   PROPERTYPRO TENANTS MANAGEMENT JS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initTenantSearch();
    initActionButtons();
});

/**
 * Handles search input clearing and form submissions
 */
function initTenantSearch() {
    const searchForm = document.querySelector(".tenant-filter-form");
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
                clearBtn.style.cssText = "background:none; border:none; font-size:1.2rem; cursor:pointer; color:#64748b; padding:0 8px;";

                clearBtn.addEventListener("click", () => {
                    searchInput.value = "";
                    clearBtn.remove();
                    searchForm.submit();
                });

                // Insert clear button before the first select element
                const firstSelect = searchForm.querySelector('select');
                if (firstSelect) {
                    searchForm.insertBefore(clearBtn, firstSelect);
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
 * Handles button loading states on data table action links
 */
function initActionButtons() {
    const actionLinks = document.querySelectorAll(".table-actions a");

    actionLinks.forEach((button) => {
        button.addEventListener("click", () => {
            // Add a visual loading state to prevent double-clicks
            const originalText = button.innerHTML;
            button.style.pointerEvents = "none";
            button.style.opacity = "0.7";
            
            if (button.classList.contains("btn-action-warning")) {
                button.innerHTML = "Sending...";
            } else {
                button.innerHTML = "Loading...";
            }

            // Fallback to restore state if page doesn't unload immediately (e.g., opened in new tab)
            setTimeout(() => {
                button.style.pointerEvents = "auto";
                button.style.opacity = "1";
                button.innerHTML = originalText;
            }, 3000);
        });
    });
}