from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AccountingDashboardAPIView,
    CompanyViewSet,
    GenerateInvoicesAPIView,
    LeaseViewSet,
    LoginAPIView,
    PaymentViewSet,
    PropertyViewSet,
    RentInvoiceViewSet,
    TenantViewSet,
    UnitViewSet,
    mpesa_callback,
)


# =========================================================
# API ROUTER
# =========================================================

router = DefaultRouter()

router.register(
    r'companies',
    CompanyViewSet,
    basename='company'
)

router.register(
    r'properties',
    PropertyViewSet,
    basename='property'
)

router.register(
    r'units',
    UnitViewSet,
    basename='unit'
)

router.register(
    r'tenants',
    TenantViewSet,
    basename='tenant'
)

router.register(
    r'leases',
    LeaseViewSet,
    basename='lease'
)

router.register(
    r'invoices',
    RentInvoiceViewSet,
    basename='invoice'
)

router.register(
    r'payments',
    PaymentViewSet,
    basename='payment'
)


# =========================================================
# URL PATTERNS
# =========================================================

urlpatterns = [

    # Login
    path(
        'login/',
        LoginAPIView.as_view(),
        name='api-login'
    ),

    # Accounting dashboard
    path(
        'accounting/dashboard/',
        AccountingDashboardAPIView.as_view(),
        name='accounting-dashboard'
    ),

    # Generate invoices
    path(
        'invoices/generate/',
        GenerateInvoicesAPIView.as_view(),
        name='generate-invoices'
    ),

    # M-Pesa Callback (Must sit BEFORE router.urls to avoid conflict with PaymentViewSet)
    path(
        'payments/mpesa/callback/',
        mpesa_callback,
        name='mpesa-callback'
    ),
    path(
    'tenant/',
    include('tenants.urls')
    ),

    # ViewSet routes
    path(
        '',
        include(router.urls)
    ),

]                          