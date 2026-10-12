"use strict";

/* =========================================================
   PROPERTYPRO MANAGEMENT DASHBOARD
========================================================= */

document.addEventListener("DOMContentLoaded", initializeDashboard);

function initializeDashboard() {
    console.log("PropertyPro management dashboard loaded.");

    initializeRevenueChart();
    initializeSidebarNavigation();
}

/* =========================================================
   SIDEBAR NAVIGATION HANDLER
========================================================= */

function initializeSidebarNavigation() {
    // Select the properties sidebar button/link by ID or data attribute
    const propertiesBtn = document.getElementById("properties-sidebar-btn") || 
                          document.querySelector('[data-nav="properties"]');

    if (propertiesBtn) {
        propertiesBtn.addEventListener("click", function (event) {
            // If the element is a button or missing an href, navigate programmatically
            if (!this.getAttribute("href") || this.getAttribute("href") === "#") {
                event.preventDefault();
                window.location.href = "/management/properties/";
            }
        });
    }
}

/* =========================================================
   REVENUE CHART
========================================================= */

function initializeRevenueChart() {
    const canvas = document.getElementById("revenueChart");

    if (!canvas) {
        // Chart container is not present on this view
        return;
    }

    const labelsElement = document.getElementById("monthly-labels");
    const incomeElement = document.getElementById("monthly-income");

    if (!labelsElement || !incomeElement) {
        console.error("Dashboard chart data elements not found.");
        return;
    }

    let labels = [];
    let income = [];

    try {
        labels = JSON.parse(labelsElement.textContent);
        income = JSON.parse(incomeElement.textContent);
    } catch (error) {
        console.error("Unable to parse dashboard chart data:", error);
        return;
    }

    new Chart(canvas, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Rental Income",
                    data: income,
                    tension: 0.35,
                    fill: true,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: "index"
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return (
                                " KSh " +
                                Number(context.raw || 0).toLocaleString("en-KE", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })
                            );
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return (
                                "KSh " +
                                Number(value).toLocaleString("en-KE")
                            );
                        }
                    }
                }
            }
        }
    });
}