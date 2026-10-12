from django.contrib.auth.views import LogoutView
from django.urls import path

from .views import (
    # HTML Views
    tenant_login_page,
    TenantRegisterView,
    tenant_dashboard_page,
    tenant_lease_page,
    tenant_payments_page,
    tenant_payment_page,
    tenant_maintenance_page, 
    tenant_report_maintenance_page,
    # REST API Views
    TenantDashboardAPIView,
    TenantProfileAPIView,
    TenantLeaseAPIView,
    TenantInvoicesAPIView,
    TenantPaymentsAPIView,
    tenant_registration_checkout_page,
)

urlpatterns = [
    # =====================================================
    # AUTHENTICATION & REGISTRATION
    # =====================================================
    path(
        "login/",
        tenant_login_page,
        name="tenant-login",
    ),
    path(
        "register/",
        TenantRegisterView.as_view(),
        name="tenant-register",
    ),
    path("register/checkout/", 
        tenant_registration_checkout_page, 
        name="tenant_payment_page"
    ),
    path(
        "logout/",
        LogoutView.as_view(next_page="/tenant/login/"),
        name="tenant-logout",
    ),

    # =====================================================
    # TENANT PORTAL HTML PAGES
    # =====================================================
    path(
        "dashboard/",
        tenant_dashboard_page,
        name="tenant-dashboard-page",
    ),
    path(
        "lease/",
        tenant_lease_page,
        name="tenant-lease-page",
    ),
    path(
        "payments/",
        tenant_payments_page,
        name="tenant-payments-page",
    ),
    path(
        "payment/",
        tenant_payment_page,
        name="tenant-payment-page",
    ),
    path(
        "maintenance/",
        tenant_maintenance_page,
        name="tenant-maintenance-page",
    ),
    path(
        "maintenance/report/",
        tenant_report_maintenance_page,
        name="tenant-report-maintenance-page",
    ),

    # Reverse URL Compatibility Aliases (Prevents NoReverseMatch errors)
    path("dashboard/", tenant_dashboard_page, name="tenant_dashboard"),
    path("lease/", tenant_lease_page, name="tenant_lease"),
    path("payments/", tenant_payments_page, name="tenant_payments"),

    # =====================================================
    # REST API ENDPOINTS (For JS/AJAX Fetch Operations)
    # =====================================================
    path(
        "api/dashboard/",
        TenantDashboardAPIView.as_view(),
        name="tenant-api-dashboard",
    ),
    path(
        "api/profile/",
        TenantProfileAPIView.as_view(),
        name="tenant-api-profile",
    ),
    path(
        "api/lease/",
        TenantLeaseAPIView.as_view(),
        name="tenant-api-lease",
    ),
    path(
        "api/invoices/",
        TenantInvoicesAPIView.as_view(),
        name="tenant-api-invoices",
    ),
    path(
        "api/payments/",
        TenantPaymentsAPIView.as_view(),
        name="tenant-api-payments",
    ),
]