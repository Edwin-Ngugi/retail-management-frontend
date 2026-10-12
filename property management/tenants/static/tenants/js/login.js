document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("tenant-login-form");
    const loginButton = document.getElementById("login-button");
    const loginButtonText = document.getElementById("login-button-text");
    const loginSpinner = document.getElementById("login-spinner");
    const loginError = document.getElementById("login-error");

    if (!form) {
        console.error("Tenant login form not found.");
        return;
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        hideError();
        setLoading(true);

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;
        const csrfToken = getCSRFToken();

        if (!csrfToken) {
            showError("Security token missing. Please refresh the page and try again.");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch("/tenant/login/", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-CSRFToken": csrfToken,
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: new URLSearchParams({
                    username: username,
                    password: password,
                    csrfmiddlewaretoken: csrfToken
                })
            });

            // 1. Direct browser redirect handling (if Django view returns redirect)
            if (response.redirected) {
                window.location.href = response.url;
                return;
            }

            // 2. Check if fetch landed on the dashboard route directly
            if (response.url && response.url.includes("/tenant/dashboard/")) {
                window.location.href = "/tenant/dashboard/";
                return;
            }

            const html = await response.text();

            // 3. Extract rendered Django error messages or check key strings
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = html;
            const renderedError = tempDiv.querySelector("#login-error")?.textContent.trim();

            if (renderedError) {
                showError(renderedError);
            } else if (html.includes("Invalid username or password") || html.includes("Invalid login credentials")) {
                showError("Invalid username or password.");
            } else if (html.includes("only available to tenants") || html.includes("restricted to tenant accounts")) {
                showError("This portal is restricted to tenant accounts only.");
            } else if (response.ok) {
                // Successful auth fallback if response HTML doesn't contain error markup
                window.location.href = "/tenant/dashboard/";
                return;
            } else {
                showError("Unable to sign in. Please check your credentials.");
            }

            setLoading(false);

        } catch (error) {
            console.error("Tenant login error:", error);
            showError("Unable to connect to the server. Please try again.");
            setLoading(false);
        }
    });

    function getCSRFToken() {
        const csrfInput = document.querySelector("[name=csrfmiddlewaretoken]");
        if (csrfInput && csrfInput.value) {
            return csrfInput.value;
        }

        const cookies = document.cookie.split(";");
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith("csrftoken=")) {
                return decodeURIComponent(cookie.substring("csrftoken=".length));
            }
        }
        return null;
    }

    function showError(message) {
        if (!loginError) return;
        loginError.textContent = message;
        loginError.classList.add("show");
        loginError.style.display = "block";
    }

    function hideError() {
        if (!loginError) return;
        loginError.textContent = "";
        loginError.classList.remove("show");
        loginError.style.display = "none";
    }

    function setLoading(isLoading) {
        if (!loginButton) return;
        loginButton.disabled = isLoading;

        if (loginButtonText) {
            loginButtonText.textContent = isLoading ? "Signing in..." : "Sign In";
        }

        if (loginSpinner) {
            loginSpinner.classList.toggle("show", isLoading);
        }
    }
});