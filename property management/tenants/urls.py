from django.urls import path

from .views import (
    tenant_login_page,
    TenantDashboardAPIView,
    TenantProfileAPIView,
    TenantLeaseAPIView,
    TenantInvoicesAPIView,
    TenantPaymentsAPIView,
    load_units,
    tenant_request_vacate_page,
    tenant_request_vacate_submit,
)

urlpatterns = [

    # =====================================================
    # TENANT AUTHENTICATION
    # =====================================================

    path(
        "login/",
        tenant_login_page,
        name="tenant-login",
    ),

    # =====================================================
    # TENANT DASHBOARD API
    # =====================================================

    path(
        "dashboard/",
        TenantDashboardAPIView.as_view(),
        name="tenant-dashboard-api",
    ),

    # =====================================================
    # TENANT PROFILE API
    # =====================================================

    path(
        "profile/",
        TenantProfileAPIView.as_view(),
        name="tenant-profile-api",
    ),

    # =====================================================
    # TENANT LEASE API
    # =====================================================

    path(
        "lease/",
        TenantLeaseAPIView.as_view(),
        name="tenant-lease-api",
    ),

    # =====================================================
    # TENANT INVOICES API
    # =====================================================

    path(
        "invoices/",
        TenantInvoicesAPIView.as_view(),
        name="tenant-invoices-api",
    ),

    path('ajax/load-units/', load_units, name='ajax_load_units'),

    # =====================================================
    # TENANT PAYMENTS API
    #
    # GET  = payment history
    # POST = initiate M-Pesa payment
    # =====================================================

    path(
        "payments/",
        TenantPaymentsAPIView.as_view(),
        name="tenant-payments-api",
    ),
    path('tenant/lease/request-vacate/', 
        tenant_request_vacate_page, 
        name='tenant-request-vacate-page'
    ),
    path('tenant/lease/request-vacate/submit/', 
        tenant_request_vacate_submit, 
        name='tenant-request-vacate-submit'
    ),
]