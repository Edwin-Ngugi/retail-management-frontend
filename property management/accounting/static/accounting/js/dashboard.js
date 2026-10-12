document.addEventListener("DOMContentLoaded", function () {

    loadAccountingDashboard();

});


async function loadAccountingDashboard() {

    try {

        const response = await fetch("/api/accounting/dashboard/", {
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        });


        if (!response.ok) {

            throw new Error(
                "Failed to load accounting dashboard"
            );

        }


        const data = await response.json();


        console.log("Accounting dashboard data:", data);


        // Total billed
        document.getElementById("total-billed").textContent =
            "KSh " + formatMoney(data.total_billed);


        // Total collected
        document.getElementById("total-collected").textContent =
            "KSh " + formatMoney(data.total_collected);


        // Outstanding
        document.getElementById("outstanding").textContent =
            "KSh " + formatMoney(data.outstanding);


        // Overdue
        document.getElementById("overdue-invoices").textContent =
            data.overdue_invoices;


        // Paid invoices
        document.getElementById("paid-invoices").textContent =
            data.paid_invoices;


        // Partial invoices
        document.getElementById("partial-invoices").textContent =
            data.partial_invoices;


        // Overdue invoice count
        document.getElementById("overdue-count").textContent =
            data.overdue_invoices;


    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

    }

}


function formatMoney(amount) {

    return Number(amount || 0).toLocaleString(
        "en-KE",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );

}
document.addEventListener("DOMContentLoaded", function () {

    loadAccountingDashboard();

});


async function loadAccountingDashboard() {

    try {

        const response = await fetch("/api/accounting/dashboard/", {
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Failed to load accounting dashboard");
        }

        const data = await response.json();

        console.log("Dashboard data:", data);


        // Summary cards

        document.getElementById("total-billed").textContent =
            "KSh " + formatAmount(data.total_billed);

        document.getElementById("total-collected").textContent =
            "KSh " + formatAmount(data.total_collected);

        document.getElementById("outstanding").textContent =
            "KSh " + formatAmount(data.outstanding);

        document.getElementById("overdue-invoices").textContent =
            data.overdue_invoices;


        // Invoice status

        document.getElementById("paid-invoices").textContent =
            data.paid_invoices;

        document.getElementById("partial-invoices").textContent =
            data.partial_invoices;

        document.getElementById("overdue-count").textContent =
            data.overdue_invoices;


    } catch (error) {

        console.error("Dashboard error:", error);

    }

}


function formatAmount(amount) {

    return Number(amount || 0).toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

}

