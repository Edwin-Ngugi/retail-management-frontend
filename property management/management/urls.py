from django.urls import path

from .views import (
    management_dashboard,
    management_properties,
    management_units,
    management_tenants,
    management_leases,
    management_payments,
    management_maintenance_list,
    management_login_view,
    management_logout_view,
    property_detail,
    management_send_reminder,
    property_financial_analysis_view,
    property_analysis_list_view,
    send_tenant_receipt_view,
    management_expense_create,
    property_financial_report,
    generate_financial_pdf,
    invoice_list_view,
    generate_single_invoice_view,
    generate_bulk_invoices_view,
    invoice_detail,
    management_update_maintenance_status,
    management_vacation_requests,
    process_vacation_request,

)

urlpatterns = [

    # =====================================================
    # AUTHENTICATION
    # =====================================================

    path(
        "login/",
        management_login_view,
        name="management-login",
    ),

    path(
        "logout/",
        management_logout_view,
        name="management-logout",
    ),

    # =====================================================
    # DASHBOARD
    # =====================================================

    path(
        "",
        management_dashboard,
        name="management-dashboard",
    ),

    path(
        "dashboard/",
        management_dashboard,
        name="management-dashboard-page",
    ),

    # =====================================================
    # PROPERTIES
    # =====================================================

    path(
        'properties/',
        management_properties,
        name='management-properties',
    ),
    path(
        'properties/<int:pk>/',
        property_detail,  
        name='property_detail',
    ),

    # =====================================================
    # UNITS
    # =====================================================

    path(
        "units/",
        management_units,
        name="management-units",
    ),

    # =====================================================
    # TENANTS
    # =====================================================

    path(
        "tenants/",
        management_tenants,
        name="management-tenants",
    ),
    path('tenants/<int:tenant_id>/send-reminder/', 
        management_send_reminder, 
        name='management-send-reminder'
    ),

    # =====================================================
    # LEASES
    # =====================================================

    path(
        "leases/",
        management_leases,
        name="management-leases",
    ),

    # =====================================================
    # INVOICES
    # =====================================================


    # =====================================================
    # PAYMENTS
    # =====================================================

    path(
        "payments/",
        management_payments,
        name="management-payments",
    ),

    # =====================================================
    # MAINTENANCE
    # =====================================================

    path("management/maintenance/", 
        management_maintenance_list, 
        name="management-maintenance"
    ),
    path("management/maintenance/<int:pk>/update/", 
        management_update_maintenance_status, 
        name="management-maintenance-update"
    ),

    
    path('analysis/', 
        property_analysis_list_view, 
        name='property-analysis-list'),
    
    
    path('analysis/<int:property_id>/', 
        property_financial_analysis_view, 
        name='property-analysis-detail'),
    
    path('invoices/<int:invoice_id>/send-receipt/', 
        send_tenant_receipt_view, 
        name='send-receipt'
    ),
    path('management/report/pdf/<int:property_id>/', generate_financial_pdf, name='property-financial-report-pdf'),
    path(
    "analysis/<int:property_id>/expenses/create/",
    management_expense_create,
    name="management-expense-create",
    ),

    path("analysis/<int:property_id>/expenses/create/", management_expense_create, name="management-expense-create-property"),
    path(
    "analysis/<int:property_id>/report/",
    property_financial_report,
    name="property-financial-report",
    ),

    path('invoices/<int:pk>/', 
        invoice_detail, 
        name='management-invoice-detail'
    ),

    path("invoices/", 
        invoice_list_view, 
        name="management-invoices-list",
    ),
    path("management/vacation-requests/", 
        management_vacation_requests, 
        name="management_vacation_requests"
    ),
    path("management/vacation-requests/<int:pk>/process/", 
        process_vacation_request, 
        name="process_vacation_request"
    ),
    path("invoices/create/", 
        generate_single_invoice_view, 
        name="management-create-invoice",
    ),
    path("invoices/generate-bulk/", 
        generate_bulk_invoices_view, 
        name="management-generate-bulk-invoices",
    ),    
]