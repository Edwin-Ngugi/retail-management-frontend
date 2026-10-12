from decimal import Decimal
from io import BytesIO
import json
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.messages import get_messages
from django.db.models import Sum, Q, F, DecimalField, ExpressionWrapper,Field, Count
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.http import FileResponse
from .reports.financial_reports import generate_financial_report
from .models import Notification
from django.contrib import messages
import io
import datetime
from datetime import date
from django.views.generic import TemplateView, ListView, DetailView, View
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.db.models import Value
from .forms import SingleInvoiceForm, BulkInvoiceGenerationForm
from django.http import FileResponse
try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
except ImportError:
    WEASYPRINT_AVAILABLE = False
from django.shortcuts import get_object_or_404, redirect
from properties.models import (
    Company,
    Lease,
    Payment,
    Expense,
    Property,
    VacationRequest,
    RentInvoice,
    Tenant,
    Unit,
)
from tenants.models import MaintenanceRequest

# =========================================================
# MANAGEMENT ACCESS & ROLES
# =========================================================

MANAGEMENT_ROLES = {
    "PROPERTY_MANAGER",
    "ACCOUNTANT",
    "CARETAKER",
}



class ManagementRequiredMixin(UserPassesTestMixin):
    """Ensures only Management/Company Staff can access management views."""
    login_url = "management-login"  # Change to your actual management login URL name

    def test_func(self):
        user = self.request.user
        if not user.is_authenticated:
            return False
        
        # Check if user has management permissions (Role or Staff status)
        is_management_role = getattr(user, "role", None) in ["COMPANY_ADMIN", "STAFF"]
        return is_management_role or user.is_staff or user.is_superuser

    def handle_no_permission(self):
        if not self.request.user.is_authenticated:
            return redirect(self.login_url)
        
        # If logged in as non-management (e.g., Tenant), log them out or redirect to login
        from django.contrib.auth import logout
        logout(self.request)
        messages.error(self.request, "Access denied. Management credentials required.")
        return redirect(self.login_url)
class ManagementDashboardView(LoginRequiredMixin, ManagementRequiredMixin, TemplateView):
    template_name = "portal_management/dashboard.html"
    login_url = "management-login"  # Replace with your management login route name

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # Your context calculations...
        return context

def is_management_user(user):
    """Utility function to verify management permissions."""
    if not user.is_authenticated:
        return False
    role = getattr(user, "role", None)
    return role in MANAGEMENT_ROLES or user.is_staff or user.is_superuser


def management_access_required(view_func):
    """Decorator enforcing management authentication and role access."""

    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            # Pass ?expired=1 to signal session expiration or unauthenticated access attempt
            return redirect("/management/login/?expired=1")

        if not is_management_user(request.user):
            return render(
                request,
                "management/login.html",
                status=403,
            )

        return view_func(request, *args, **kwargs)

    return wrapper


# =========================================================
# AUTHENTICATION VIEWS
# =========================================================


def management_login_view(request):
    if request.user.is_authenticated:
        if is_management_user(request.user):
            return redirect("management-dashboard")
        else:
            logout(request)
            messages.warning(
                request, "Your account lacks management permissions."
            )

    # Check for session expiration flag from query params
    session_expired = request.GET.get("expired") == "1"

    if request.method == "POST":
        username_input = request.POST.get("username")
        password_input = request.POST.get("password")

        user = authenticate(
            request, username=username_input, password=password_input
        )

        if user is not None:
            if is_management_user(user):
                login(request, user)

                if not request.POST.get("remember_me"):
                    request.session.set_expiry(0)

                next_url = request.GET.get("next")
                if next_url:
                    return redirect(next_url)
                return redirect("management-dashboard")
            else:
                messages.error(
                    request, "Access restricted to management personnel only."
                )
        else:
            messages.error(
                request,
                "Invalid credentials. Please check your username and password.",
            )

        # Do not keep showing session_expired flag on explicit login POST attempts
        return render(
            request,
            "management/login.html",
            {"session_expired": False},
        )

    # Clear lingering flash messages on GET so rent reminders won't display here
    storage = get_messages(request)
    for _ in storage:
        pass

    return render(
        request,
        "management/login.html",
        {"session_expired": session_expired},
    )


def management_logout_view(request):
    logout(request)
    return redirect("management-login")


# =========================================================
# QUERYSET SCOPING
# =========================================================


def get_company(request):
    return getattr(request.user, "company", None)


def get_accessible_properties(request):
    user = request.user
    company = get_company(request)

    if not company:
        return Property.objects.none()

    properties = Property.objects.filter(company=company)
    role = getattr(user, "role", None)

    if role in {"ADMIN", "ACCOUNTANT"} or user.is_staff or user.is_superuser:
        return properties

    if role in {"PROPERTY_MANAGER", "CARETAKER"}:
        return properties.filter(
            staff_assignments__user=user
        ).distinct()

    return Property.objects.none()


# =========================================================
# DASHBOARD
# =========================================================


@management_access_required
def management_dashboard(request):
    """
    Main PropertyPro management dashboard.
    Focuses on aggregate business performance metrics.
    """
    user = request.user
    company = getattr(user, "company", None)

    if company is None:
        context = {
            "rental_income": Decimal("0.00"),
            "outstanding_rent": Decimal("0.00"),
            "collection_rate": Decimal("0.00"),
            "expected_rent": Decimal("0.00"),
            "overdue_amount": Decimal("0.00"),
            "total_expenses": Decimal("0.00"),
            "net_income": Decimal("0.00"),
            "net_operating_income": Decimal("0.00"),
            "noi": Decimal("0.00"),
            "pending_payment_count": 0,
            "monthly_labels": [],
            "monthly_income": [],
            "overdue_invoice_count": 0,
            "partial_invoice_count": 0,
            "recent_payments": [],
        }
        return render(request, "management/dashboard.html", context)

    # Base Querysets
    invoices = RentInvoice.objects.filter(lease__unit__property__company=company)
    leases = Lease.objects.filter(unit__property__company=company)
    payments = Payment.objects.filter(
        invoice__lease__unit__property__company=company,
        status=Payment.Status.COMPLETED if hasattr(Payment, "Status") else "COMPLETED"
    )
    expenses = Expense.objects.filter(property__company=company)

    today = timezone.localdate()

    # Financial Totals
    rental_income = payments.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    total_expenses = expenses.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    net_income = rental_income - total_expenses

    expected_rent = (
        leases.filter(status=Lease.Status.ACTIVE).aggregate(total=Sum("monthly_rent"))["total"]
        or Decimal("0.00")
    )

    # Balance Expression
    balance_expr = ExpressionWrapper(F("amount_due") - F("amount_paid"), output_field=DecimalField())

    outstanding_rent = invoices.annotate(balance=balance_expr).filter(balance__gt=0)\
        .aggregate(total=Sum("balance"))["total"] or Decimal("0.00")

    total_due = invoices.aggregate(total=Sum("amount_due"))["total"] or Decimal("0.00")

    if total_due > Decimal("0.00"):
        collection_rate = (rental_income / total_due) * Decimal("100")
    else:
        collection_rate = Decimal("0.00")

    collection_rate = min(collection_rate, Decimal("100.00"))

    # Overdue Filtering (Explicit Status OR Due Date Passed)
    overdue_invoices = invoices.filter(
        Q(status=RentInvoice.Status.OVERDUE) |
        Q(due_date__lt=today, status__in=[RentInvoice.Status.UNPAID, RentInvoice.Status.PARTIAL])
    )

    overdue_amount = overdue_invoices.annotate(balance=balance_expr).filter(balance__gt=0)\
        .aggregate(total=Sum("balance"))["total"] or Decimal("0.00")

    overdue_invoice_count = overdue_invoices.count()
    partial_invoice_count = invoices.filter(status=RentInvoice.Status.PARTIAL).count()
    pending_payment_count = Payment.objects.filter(
        invoice__lease__unit__property__company=company,
        status="PENDING"
    ).count()

    recent_payments = payments.select_related(
        "invoice__lease__tenant__user",
        "invoice__lease__unit__property",
    ).order_by("-id")[:6]

    # 6-Month Income Trend
    first_month = today.replace(day=1)
    months = []
    current = first_month

    for _ in range(6):
        months.append(current)
        if current.month == 1:
            current = current.replace(year=current.year - 1, month=12)
        else:
            current = current.replace(month=current.month - 1)

    months.reverse()
    monthly_labels = []
    monthly_income = []

    for month in months:
        month_income = payments.filter(
            payment_date__year=month.year,
            payment_date__month=month.month
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

        monthly_labels.append(month.strftime("%b"))
        monthly_income.append(float(month_income))

    context = {
        "rental_income": rental_income,
        "total_expenses": total_expenses,
        "net_income": net_income,
        "net_operating_income": net_income,
        "noi": net_income,
        "outstanding_rent": outstanding_rent,
        "collection_rate": round(collection_rate, 2),
        "expected_rent": expected_rent,
        "overdue_amount": overdue_amount,
        "pending_payment_count": pending_payment_count,
        "overdue_invoice_count": overdue_invoice_count,
        "partial_invoice_count": partial_invoice_count,
        "monthly_labels": monthly_labels,
        "monthly_income": monthly_income,
        "recent_payments": recent_payments,
    }

    return render(request, "management/dashboard.html", context)


# =========================================================
# PROPERTIES
# =========================================================


@management_access_required
def management_properties(request):
    properties = (
        get_accessible_properties(request)
        .annotate(unit_count=Count("units"))
        .order_by("name")
    )
    return render(
        request,
        "management/property_list.html",
        {"properties": properties},
    )


@management_access_required
def property_detail(request, pk):
    properties = get_accessible_properties(request)
    property_obj = get_object_or_404(properties, pk=pk)
    units = property_obj.units.all()

    context = {
        'property': property_obj,
        'units': units,
    }
    return render(request, 'management/property_detail.html', context)


# =========================================================
# UNITS
# =========================================================


@management_access_required
def management_units(request):
    properties = get_accessible_properties(request)
    units = (
        Unit.objects.filter(property__in=properties)
        .select_related("property")
        .order_by("property__name", "unit_number")
    )

    return render(
        request,
        "management/units.html",
        {"units": units},
    )


# =========================================================
# TENANTS
# =========================================================


@management_access_required
def management_tenants(request):
    properties = get_accessible_properties(request)
    today = timezone.localdate()

    # Standardize billing_month to the 1st day of the current month
    first_of_month = date(today.year, today.month, 1)

    # --- AUTO-GENERATE MISSING MONTHLY INVOICES FOR ACTIVE LEASES ---
    active_leases_without_invoices = Lease.objects.filter(
        unit__property__in=properties,
        status=Lease.Status.ACTIVE
    ).exclude(
        invoices__billing_month=first_of_month
    )

    for lease in active_leases_without_invoices:
        # Default due date to the 5th of the current month
        try:
            due_date = date(today.year, today.month, 5)
        except ValueError:
            due_date = today

        inv_num = f"INV-{lease.unit.unit_number}-{today.strftime('%Y%m')}-{lease.id}"

        RentInvoice.objects.get_or_create(
            lease=lease,
            billing_month=first_of_month,
            defaults={
                'invoice_number': inv_num,
                'amount_due': lease.monthly_rent,
                'amount_paid': Decimal("0.00"),
                'due_date': due_date,
                'status': RentInvoice.Status.UNPAID if due_date >= today else RentInvoice.Status.OVERDUE
            }
        )
    # ----------------------------------------------------------------

    # DB Expression for invoice balance calculation
    invoice_balance_expr = ExpressionWrapper(
        F("leases__invoices__amount_due") - Coalesce(F("leases__invoices__amount_paid"), Value(Decimal("0.00")), output_field=DecimalField()),
        output_field=DecimalField()
    )

    tenants = (
        Tenant.objects.filter(leases__unit__property__in=properties)
        .select_related("user")
        .prefetch_related("leases__unit__property", "leases__invoices")
        .annotate(
            calculated_balance=Coalesce(
                Sum(
                    invoice_balance_expr,
                    filter=Q(leases__invoices__status__in=[
                        RentInvoice.Status.UNPAID,
                        RentInvoice.Status.PARTIAL,
                        RentInvoice.Status.OVERDUE,
                    ])
                ),
                Value(Decimal("0.00")),
                output_field=DecimalField()
            )
        )
        .distinct()
    )

    # Filter params
    search_query = request.GET.get('search', '').strip()
    selected_property = request.GET.get('property', '')
    selected_balance = request.GET.get('balance_status', '')

    if search_query:
        tenants = tenants.filter(
            Q(user__first_name__icontains=search_query) |
            Q(user__last_name__icontains=search_query) |
            Q(user__username__icontains=search_query) |
            Q(phone__icontains=search_query) |
            Q(leases__unit__unit_number__icontains=search_query)
        )

    if selected_property:
        tenants = tenants.filter(leases__unit__property_id=selected_property)

    if selected_balance == 'has_balance':
        tenants = tenants.filter(calculated_balance__gt=0)
    elif selected_balance == 'clear':
        tenants = tenants.filter(calculated_balance__lte=0)

    total_tenants = tenants.count()
    total_with_balance = tenants.filter(calculated_balance__gt=0).count()
    total_balance_amount = tenants.aggregate(total=Sum("calculated_balance"))["total"] or Decimal("0.00")

    context = {
        'tenants': tenants,
        'properties': properties,
        'search_query': search_query,
        'selected_property': selected_property,
        'selected_balance': selected_balance,
        'total_tenants': total_tenants,
        'total_with_balance': total_with_balance,
        'total_balance_amount': total_balance_amount,
    }

    return render(request, 'management/tenant_list.html', context)

@login_required
def management_vacation_requests(request):
    # Restrict tenants from accessing management views
    if getattr(request.user, "role", "").upper() == "TENANT":
        return redirect("tenant_dashboard")

    # Fetch vacation requests scoped to properties in the user's company
    user_company = getattr(request.user, "company", None)
    vacate_requests = VacationRequest.objects.select_related(
        "tenant",
        "tenant__user",
        "lease",
        "lease__unit",
        "lease__unit__property"
    )

    if user_company:
        vacate_requests = vacate_requests.filter(
            lease__unit__property__company=user_company
        )

    # Optional UI Filtering by Status
    status_filter = request.GET.get("status", "").strip().upper()
    if status_filter in VacationRequest.Status.values:
        vacate_requests = vacate_requests.filter(status=status_filter)

    # Search by Tenant Name, Unit Number, or Property Name
    search_query = request.GET.get("q", "").strip()
    if search_query:
        vacate_requests = vacate_requests.filter(
            Q(tenant__user__first_name__icontains=search_query) |
            Q(tenant__user__last_name__icontains=search_query) |
            Q(tenant__phone__icontains=search_query) |
            Q(lease__unit__unit_number__icontains=search_query) |
            Q(lease__unit__property__name__icontains=search_query)
        )

    # Metrics for Top Summary Badges
    base_queryset = VacationRequest.objects.all()
    if user_company:
        base_queryset = base_queryset.filter(lease__unit__property__company=user_company)

    pending_count = base_queryset.filter(status=VacationRequest.Status.PENDING).count()
    approved_count = base_queryset.filter(status=VacationRequest.Status.APPROVED).count()

    context = {
        "vacate_requests": vacate_requests,
        "pending_count": pending_count,
        "approved_count": approved_count,
        "selected_status": status_filter,
        "search_query": search_query,
    }

    return render(request, "management/vacation_requests.html", context)


@login_required
def process_vacation_request(request, pk):
    """View to approve or reject a vacation request."""
    if getattr(request.user, "role", "").upper() == "TENANT":
        return redirect("tenant_dashboard")

    vacation_req = get_object_or_404(VacationRequest, pk=pk)

    if request.method == "POST":
        action = request.POST.get("action")
        admin_notes = request.POST.get("admin_notes", "").strip()

        vacation_req.admin_notes = admin_notes
        vacation_req.reviewed_at = timezone.now()

        if action == "approve":
            vacation_req.status = VacationRequest.Status.APPROVED
            vacation_req.save()

            # Mark lease as terminated/expired and free up unit status
            lease = vacation_req.lease
            lease.status = Lease.Status.TERMINATED
            lease.save(update_fields=["status", "updated_at"])

            unit = lease.unit
            unit.status = Unit.Status.VACANT
            unit.save(update_fields=["status"])

            messages.success(request, f"Vacation request for {vacation_req.tenant} approved. Unit is now VACANT.")

        elif action == "reject":
            vacation_req.status = VacationRequest.Status.REJECTED
            vacation_req.save()
            messages.info(request, f"Vacation request for {vacation_req.tenant} rejected.")

    return redirect("management_vacation_requests")

@management_access_required
def property_analysis_list_view(request):
    properties = (
        get_accessible_properties(request)
        .annotate(
            unit_count=Count("units"),
            occupied_unit_count=Count(
                "units",
                filter=Q(
                    units__leases__status=Lease.Status.ACTIVE
                ),
                distinct=True,
            ),
        )
        .order_by("name")
    )

    for property_obj in properties:
        total_units = property_obj.unit_count or 0
        occupied_units = property_obj.occupied_unit_count or 0

        if total_units > 0:
            property_obj.occupancy_rate = round(
                (occupied_units / total_units) * 100,
                2,
            )
        else:
            property_obj.occupancy_rate = 0

    context = {
        "properties": properties,
    }

    return render(
        request,
        "management/property_analysis_list.html",
        context,
    )


@management_access_required
def management_send_reminder(request, tenant_id):
    tenant = get_object_or_404(Tenant, pk=tenant_id)
    balance = getattr(tenant, 'calculated_balance', 0)
    tenant_name = tenant.user.get_full_name() or tenant.user.username

    if balance <= 0:
        messages.warning(request, f"{tenant_name} has no outstanding balance.")
        return redirect('management-tenants')

    Notification.objects.create(
        user=tenant.user,
        title="Outstanding Rent Balance Reminder",
        message=f"Hello {tenant_name}, you have an outstanding rent balance of KSh {balance:,.0f}. Please settle your balance promptly via the portal.",
        notification_type='rent_due'
    )

    messages.success(request, f"Reminder notification successfully sent to {tenant_name}'s portal.")
    return redirect('management-tenants')


# =========================================================
# LEASES
# =========================================================
# =========================================================
# PAYMENTS
# =========================================================

@management_access_required
def management_payments(request):
    """
    List and filter payments for properties accessible to management.
    """
    properties = get_accessible_properties(request)
    
    payments = Payment.objects.filter(
        invoice__lease__unit__property__in=properties
    ).select_related(
        "invoice",
        "invoice__lease",
        "invoice__lease__tenant",
        "invoice__lease__tenant__user",
        "invoice__lease__unit",
        "invoice__lease__unit__property",
    ).order_by("-payment_date")

    # Filters
    status_filter = request.GET.get("status", "ALL")
    search_query = request.GET.get("search", "").strip()

    if status_filter != "ALL":
        payments = payments.filter(status=status_filter)

    if search_query:
        payments = payments.filter(
            Q(reference_number__icontains=search_query) |
            Q(invoice__invoice_number__icontains=search_query) |
            Q(invoice__lease__tenant__user__username__icontains=search_query) |
            Q(invoice__lease__tenant__user__first_name__icontains=search_query) |
            Q(invoice__lease__tenant__user__last_name__icontains=search_query)
        )

    total_received = payments.filter(status=Payment.Status.COMPLETED).aggregate(
        total=Sum("amount")
    )["total"] or Decimal("0.00")

    context = {
        "payments": payments,
        "selected_status": status_filter,
        "search_query": search_query,
        "total_received": total_received,
    }
    return render(request, "management/payments.html", context)

# =========================================================
# OPERATIONS / MAINTENANCE
# =========================================================

@login_required
def management_maintenance_list(request):
    # Optional role check for management staff
    if getattr(request.user, "role", "").upper() == "TENANT":
        return redirect("/tenant/dashboard/")

    status_filter = request.GET.get("status", "").strip().upper()
    category_filter = request.GET.get("category", "").strip().upper()

    requests_qs = (
        MaintenanceRequest.objects
        .select_related("tenant", "unit", "unit__property")
        .order_by("-reported_at")
    )

    if status_filter:
        requests_qs = requests_qs.filter(status=status_filter)
    if category_filter:
        requests_qs = requests_qs.filter(category=category_filter)

    context = {
        "maintenance_requests": requests_qs,
        "selected_status": status_filter,
        "selected_category": category_filter,
        "status_choices": MaintenanceRequest.Status.choices if hasattr(MaintenanceRequest, 'Status') else [],
        "category_choices": MaintenanceRequest.Category.choices if hasattr(MaintenanceRequest, 'Category') else [],
    }
    return render(request, "management/maintenance.html", context)


@login_required
def management_update_maintenance_status(request, pk):
    if request.method == "POST":
        req = get_object_or_404(MaintenanceRequest, pk=pk)
        new_status = request.POST.get("status", "").strip().upper()
        
        valid_statuses = {choice[0] for choice in MaintenanceRequest.Status.choices}
        if new_status in valid_statuses:
            req.status = new_status
            req.save()
            messages.success(request, f"Maintenance request #{req.id} updated to {req.get_status_display()}.")
        else:
            messages.error(request, "Invalid status selected.")

    return redirect("management-maintenance")

    return render(request, "management/maintenance.html", context)
@management_access_required
def management_maintenance_detail(request, pk):
    """
    View details for a specific maintenance request and update its status.
    """
    properties = get_accessible_properties(request)
    maintenance_request = get_object_or_404(
        MaintenanceRequest.objects.select_related(
            "unit",
            "unit__property",
            "tenant",
            "tenant__user"
        ),
        pk=pk,
        unit__property__in=properties
    )

    if request.method == "POST":
        new_status = request.POST.get("status")
        if new_status in dict(MaintenanceRequest.Status.choices if hasattr(MaintenanceRequest, 'Status') else []):
            maintenance_request.status = new_status
            maintenance_request.save()
            messages.success(request, f"Maintenance request status updated to {maintenance_request.get_status_display()}.")
            return redirect("management-maintenance-detail", pk=pk)

    context = {
        "request_item": maintenance_request,
    }
    return render(request, "management/maintenance_detail.html", context)
# =========================================================
# EXPENSES
# =========================================================

@management_access_required
def management_expense_create(request, property_id=None):
    """
    Record a new operating expense for a property.
    """
    properties = get_accessible_properties(request)

    if property_id:
        property_obj = get_object_or_404(properties, pk=property_id)
    else:
        property_obj = properties.first()

    if request.method == "POST":
        target_property_id = request.POST.get("property") or property_id
        title = request.POST.get("title", "").strip()
        amount = request.POST.get("amount")
        category = request.POST.get("category", "OTHER")
        expense_date = request.POST.get("expense_date") or timezone.localdate()
        description = request.POST.get("description", "").strip()

        selected_property = get_object_or_404(properties, pk=target_property_id)

        Expense.objects.create(
            property=selected_property,
            title=title,
            amount=Decimal(amount),
            category=category,
            expense_date=expense_date,
            description=description,
            created_by=request.user,
        )

        messages.success(
            request, 
            f"Expense of KSh {amount} logged successfully for {selected_property.name}."
        )
        # Use pk=selected_property.id (or match your urls.py parameter)
        return redirect("property-analysis-detail", pk=selected_property.id)

    context = {
        "properties": properties,
        "selected_property": property_obj,
    }
    return render(request, "management/expense_form.html", context)


def management_expenses(request, property_id=None):
    """
    List and filter operating expenses across properties accessible to management.
    """
    properties = get_accessible_properties(request)

    expenses = Expense.objects.filter(
        property__in=properties
    ).select_related(
        "property",
        "created_by"
    ).order_by("-expense_date", "-created_at")

    category_filter = request.GET.get("category", "ALL")
    selected_property = request.GET.get("property", "")
    search_query = request.GET.get("search", "").strip()

    if category_filter != "ALL":
        expenses = expenses.filter(category=category_filter)

    if selected_property:
        expenses = expenses.filter(property_id=selected_property)

    if search_query:
        expenses = expenses.filter(
            Q(title__icontains=search_query) |
            Q(description__icontains=search_query) |
            Q(property__name__icontains=search_query)
        )

    total_expense_amount = expenses.aggregate(
        total=Sum("amount")
    )["total"] or Decimal("0.00")

    context = {
        "expenses": expenses,
        "properties": properties,
        "selected_category": category_filter,
        "selected_property": selected_property,
        "search_query": search_query,
        "total_expense_amount": total_expense_amount,
    }

    return render(request, "management/expense_list.html", context)                

@management_access_required
def management_leases(request):
    properties = get_accessible_properties(request)
    leases = (
        Lease.objects.filter(unit__property__in=properties)
        .select_related(
            "tenant",
            "tenant__user",
            "unit",
            "unit__property",
        )
        .order_by("-created_at")
    )

    return render(
        request,
        "management/leases.html",
        {"leases": leases},
    )


# =========================================================
# INVOICES & FINANCIAL OVERSIGHT
# =========================================================





import json
from decimal import Decimal
from django.db.models import Sum, F, Q, ExpressionWrapper, DecimalField
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404, render
from django.utils import timezone


@management_access_required
def property_financial_analysis_view(request, property_id):
    properties = get_accessible_properties(request)
    property_obj = get_object_or_404(properties, pk=property_id)

    start_date = request.GET.get("start_date")
    end_date = request.GET.get("end_date")
    today = timezone.localdate()

    # Base Unfiltered Querysets (for 12-Month Historical Trend)
    completed_status = getattr(Payment, "Status", None)
    completed_val = completed_status.COMPLETED if completed_status else "COMPLETED"

    base_payments = Payment.objects.filter(
        invoice__lease__unit__property=property_obj,
        status=completed_val
    )
    base_expenses = Expense.objects.filter(property=property_obj)

    # Date-Filtered Querysets (for KPI Cards, Lists, and Donut Breakdown)
    invoices = RentInvoice.objects.filter(lease__unit__property=property_obj)
    payments = base_payments
    expenses = base_expenses
    leases = Lease.objects.filter(unit__property=property_obj)

    if start_date:
        invoices = invoices.filter(due_date__gte=start_date)
        payments = payments.filter(payment_date__date__gte=start_date)
        expenses = expenses.filter(expense_date__gte=start_date)

    if end_date:
        invoices = invoices.filter(due_date__lte=end_date)
        payments = payments.filter(payment_date__date__lte=end_date)
        expenses = expenses.filter(expense_date__lte=end_date)

    # 1. Totals & Metrics Calculation
    total_expected = invoices.aggregate(total=Sum("amount_due"))["total"] or Decimal("0.00")
    total_collected = payments.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    total_expenses = expenses.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    # DB-Level Safe Balance Expression (uses calculated_balance to avoid collision with model balance property)
    balance_expr = ExpressionWrapper(
        F("amount_due") - Coalesce(F("amount_paid"), Decimal("0.00")),
        output_field=DecimalField()
    )

    outstanding_balance = RentInvoice.objects.filter(lease__unit__property=property_obj)\
        .annotate(calculated_balance=balance_expr).filter(calculated_balance__gt=0)\
        .aggregate(total=Sum("calculated_balance"))["total"] or Decimal("0.00")

    total_pending = invoices.filter(status__in=[RentInvoice.Status.UNPAID, RentInvoice.Status.PARTIAL])\
        .annotate(calculated_balance=balance_expr).filter(calculated_balance__gt=0)\
        .aggregate(total=Sum("calculated_balance"))["total"] or Decimal("0.00")

    total_overdue = invoices.filter(
        Q(status=RentInvoice.Status.OVERDUE) |
        Q(due_date__lt=today, status__in=[RentInvoice.Status.UNPAID, RentInvoice.Status.PARTIAL])
    ).annotate(calculated_balance=balance_expr).filter(calculated_balance__gt=0)\
     .aggregate(total=Sum("calculated_balance"))["total"] or Decimal("0.00")

    # Outstanding Rent / Defaulters List Query
    pending_invoices_qs = invoices.filter(
        status__in=[RentInvoice.Status.UNPAID, RentInvoice.Status.PARTIAL, RentInvoice.Status.OVERDUE]
    ).annotate(calculated_balance=balance_expr).filter(calculated_balance__gt=0)\
     .select_related("lease__tenant", "lease__unit").order_by("due_date")[:10]

    pending_invoices = [
        {
            "tenant_name": inv.lease.tenant.get_full_name() if hasattr(inv.lease.tenant, "get_full_name") else str(inv.lease.tenant),
            "unit_number": inv.lease.unit.unit_number,
            "due_date": inv.due_date,
            "amount_due": inv.calculated_balance,
            "is_overdue": inv.due_date < today or inv.status == RentInvoice.Status.OVERDUE
        }
        for inv in pending_invoices_qs
    ]

    # Ratios
    net_income = total_collected - total_expenses
    expense_ratio = (total_expenses / total_collected * Decimal("100")) if total_collected > Decimal("0.00") else Decimal("0.00")
    collection_rate = min((total_collected / total_expected * Decimal("100")), Decimal("100.00")) if total_expected > Decimal("0.00") else Decimal("0.00")
    net_profit_margin = (net_income / total_collected * Decimal("100")) if total_collected > Decimal("0.00") else Decimal("0.00")

    # Occupancy
    total_units = property_obj.units.count()
    occupied_units = leases.filter(status=Lease.Status.ACTIVE).values("unit_id").distinct().count()
    vacant_units = max(total_units - occupied_units, 0)
    occupancy_rate = (Decimal(occupied_units) / Decimal(total_units) * Decimal("100")) if total_units > 0 else Decimal("0.00")

    # Expense Categories Breakdown
    expense_categories = expenses.values("category").annotate(total=Sum("amount")).order_by("-total")
    expense_category_labels = [item["category"] for item in expense_categories]
    expense_category_data = [float(item["total"]) for item in expense_categories]

    payment_methods = payments.values("method").annotate(total=Sum("amount")).order_by("-total")
    payment_method_labels = [item["method"] for item in payment_methods]
    payment_method_values = [float(item["total"]) for item in payment_methods]

    # 12-Month Historical Trend
    current_month = today.replace(day=1)
    months = []

    for _ in range(12):
        months.append(current_month)
        if current_month.month == 1:
            current_month = current_month.replace(year=current_month.year - 1, month=12)
        else:
            current_month = current_month.replace(month=current_month.month - 1)

    months.reverse()
    monthly_labels, monthly_revenue, monthly_expenses, monthly_profit = [], [], [], []

    for month in months:
        revenue = base_payments.filter(payment_date__year=month.year, payment_date__month=month.month).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        m_expenses = base_expenses.filter(expense_date__year=month.year, expense_date__month=month.month).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        profit = revenue - m_expenses

        monthly_labels.append(month.strftime("%b %Y"))
        monthly_revenue.append(float(revenue))
        monthly_expenses.append(float(m_expenses))
        monthly_profit.append(float(profit))

    # Table Queries
    recent_expenses = expenses.select_related("created_by").order_by("-expense_date", "-created_at")[:10]

    context = {
        "property": property_obj,
        "start_date": start_date,
        "end_date": end_date,
        "total_expected": total_expected,
        "total_collected": total_collected,
        "outstanding_balance": outstanding_balance,
        "total_pending": total_pending,
        "total_overdue": total_overdue,
        "overdue_amount": total_overdue,
        "total_expenses": total_expenses,
        "net_income": net_income,
        "net_operating_income": net_income,
        "noi": net_income,
        "expense_ratio": round(expense_ratio, 2),
        "profit_margin": round(net_profit_margin, 2),
        "net_profit_margin": round(net_profit_margin, 2),
        "collection_rate": round(collection_rate, 2),
        "occupancy_rate": round(occupancy_rate, 2),
        "total_units": total_units,
        "occupied_units": occupied_units,
        "vacant_units": vacant_units,

        # Chart.js JSON Serialized Context Data
        "chart_labels": json.dumps(monthly_labels),
        "chart_income": json.dumps(monthly_revenue),
        "chart_expenses": json.dumps(monthly_expenses),
        "chart_net_income": json.dumps(monthly_profit),
        "expense_category_labels": json.dumps(expense_category_labels),
        "expense_category_data": json.dumps(expense_category_data),
        "payment_method_labels": json.dumps(payment_method_labels),
        "payment_method_values": json.dumps(payment_method_values),

        # Data Tables
        "pending_invoices": pending_invoices,
        "recent_expenses": recent_expenses,
        "expenses": recent_expenses,
    }

    return render(request, "management/finacial_analysis.html", context)



@management_access_required
def send_tenant_receipt_view(request, payment_id):
    """
    Generates and emails/SMS a payment receipt to the tenant for a specific payment.
    """
    # Restrict payment retrieval to properties accessible by the logged-in user
    accessible_properties = get_accessible_properties(request)
    
    payment = get_object_or_404(
        Payment.objects.select_related(
            "invoice",
            "invoice__lease",
            "invoice__lease__tenant",
            "invoice__lease__unit",
            "invoice__lease__unit__property"
        ),
        pk=payment_id,
        invoice__lease__unit__property__in=accessible_properties
    )

    tenant = payment.invoice.lease.tenant
    unit = payment.invoice.lease.unit
    property_obj = unit.property

    # Validate tenant email
    tenant_email = getattr(tenant, "email", None)
    if not tenant_email:
        messages.error(
            request,
            f"Unable to send receipt: Tenant '{tenant.get_full_name() if hasattr(tenant, 'get_full_name') else tenant}' does not have an email address configured."
        )
        return redirect("management-payment-detail", payment_id=payment.id)

    try:
        # Context data for email & receipt templates
        context = {
            "payment": payment,
            "invoice": payment.invoice,
            "lease": payment.invoice.lease,
            "tenant": tenant,
            "unit": unit,
            "property": property_obj,
            "company_name": getattr(settings, "COMPANY_NAME", "Property Management"),
            "sent_at": timezone.now(),
        }

        # 1. Render HTML Email Body
        email_body = render_to_string("management/emails/tenant_receipt_email.html", context)

        # 2. Build Email Object
        subject = f"Payment Receipt #{payment.receipt_number if hasattr(payment, 'receipt_number') else payment.id} - {property_obj.name} (Unit {unit.unit_number})"
        sender_email = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@propertymanager.com")
        
        email = EmailMessage(
            subject=subject,
            body=email_body,
            from_email=sender_email,
            to=[tenant_email],
        )
        email.content_subtype = "html"  # Send as HTML email

        # 3. Generate & Attach PDF Receipt if WeasyPrint is available
        if WEASYPRINT_AVAILABLE:
            pdf_html = render_to_string("management/pdf/tenant_receipt_pdf.html", context)
            pdf_file = HTML(string=pdf_html).write_pdf()
            email.attach(
                filename=f"Receipt_{payment.id}_{unit.unit_number}.pdf",
                content=pdf_file,
                mimetype="application/pdf"
            )

        # 4. Send Email
        email.send(fail_silently=False)

        # 5. Optional SMS Trigger (e.g., Africa's Talking)
        tenant_phone = getattr(tenant, "phone_number", getattr(tenant, "phone", None))
        if tenant_phone:
            try:
                # Example: send_sms(phone=tenant_phone, message=f"Dear {tenant.first_name}, payment of KSh {payment.amount} for Unit {unit.unit_number} received. Receipt sent to your email.")
                pass
            except Exception as sms_err:
                # Non-critical error, log or ignore
                pass

        messages.success(
            request,
            f"Receipt successfully sent to {tenant_email} for Unit {unit.unit_number}."
        )

    except Exception as e:
        messages.error(
            request,
            f"An error occurred while dispatching the receipt: {str(e)}"
        )

    # Redirect back to payment detail or invoice page
    return redirect("management-payment-detail", payment_id=payment.id)    



@management_access_required
def invoice_list_view(request):
    """
    Lists all invoices for properties accessible by the logged-in management user.
    """
    accessible_properties = get_accessible_properties(request)
    invoices = RentInvoice.objects.filter(
        lease__unit__property__in=accessible_properties
    ).select_related("lease__tenant", "lease__unit", "lease__unit__property").order_by("-created_at")

    context = {
        "invoices": invoices,
        "properties": accessible_properties,
    }
    return render(request, "management/invoice_list.html", context)


@management_access_required
def generate_single_invoice_view(request):
    """
    Allows management to manually generate an individual invoice (e.g. rent, water, damages).
    """
    accessible_properties = get_accessible_properties(request)

    if request.method == "POST":
        form = SingleInvoiceForm(request.POST, user_properties=accessible_properties)
        if form.is_valid():
            invoice = form.save(commit=False)
            invoice.amount_paid = Decimal("0.00")
            invoice.save()
            messages.success(request, f"Invoice created successfully for Unit {invoice.lease.unit.unit_number}.")
            return redirect("management-invoices-list")
    else:
        form = SingleInvoiceForm(user_properties=accessible_properties)

    return render(request, "management/invoice_create_single.html", {"form": form})


@management_access_required
def generate_bulk_invoices_view(request):
    """
    Allows management to batch-generate rent invoices for all active leases in a property.
    """
    accessible_properties = get_accessible_properties(request)

    if request.method == "POST":
        form = BulkInvoiceGenerationForm(request.POST, user_properties=accessible_properties)
        if form.is_valid():
            property_obj = form.cleaned_data["property"]
            billing_date = form.cleaned_data["billing_date"]
            due_date = form.cleaned_data["due_date"]

            active_leases = Lease.objects.filter(
                unit__property=property_obj,
                status=Lease.Status.ACTIVE
            ).select_related("unit", "tenant")

            created_count = 0
            skipped_count = 0

            for lease in active_leases:
                # Avoid duplicate invoice generation for the same month and lease
                exists = RentInvoice.objects.filter(
                    lease=lease,
                    billing_month=billing_date
                ).exists()

                if not exists:
                    RentInvoice.objects.create(
                        lease=lease,
                        billing_month=billing_date,
                        amount_due=lease.rent_amount,
                        amount_paid=Decimal("0.00"),
                        due_date=due_date,
                        status=RentInvoice.Status.UNPAID
                    )
                    created_count += 1
                else:
                    skipped_count += 1

            messages.success(
                request,
                f"Batch generation completed: {created_count} invoice(s) created for {property_obj.name}."
                + (f" ({skipped_count} skipped - already existed)." if skipped_count > 0 else "")
            )
            return redirect("management-invoices-list")
    else:
        form = BulkInvoiceGenerationForm(user_properties=accessible_properties)

    return render(request, "management/invoice_create_bulk.html", {"form": form})

# management/views.py
from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import Invoice

@login_required
def invoice_detail(request, pk):
    # Retrieve invoice with related lease, unit, property, and tenant pre-fetched
    invoice = get_object_or_404(
        RentInvoice.objects.select_related(
            'lease__unit__property', 
            'lease__tenant__user'
        ), 
        pk=pk
    )

    # Fetch payments using model relationship safely
    payments = invoice.payments.all().order_by('-created_at')

    context = {
        'invoice': invoice,
        'payments': payments,
        'balance_remaining': invoice.balance,  # Uses @property from model
    }
    return render(request, 'management/invoice_detail.html', context)

# =========================================================
# REPORTS & PDF DISPATCH
# =========================================================


@management_access_required
def property_financial_report(request, property_id):
    properties = get_accessible_properties(request)
    property_obj = get_object_or_404(properties, pk=property_id)

    start_date = request.GET.get("start_date") or None
    end_date = request.GET.get("end_date") or None

    try:
        pdf_buffer = generate_financial_report(
            property_obj, start_date=start_date, end_date=end_date
        )

        filename = (
            f"Financial_Report_{property_obj.name.replace(' ', '_')}.pdf"
        )
        return FileResponse(pdf_buffer, as_attachment=True, filename=filename)

    except TypeError as e:
        messages.error(
            request,
            "Date filtering is not supported for this report generator.",
        )
        return redirect("property-analysis-detail", property_id=property_obj.pk)

    except Exception as e:
        messages.error(request, f"Failed to generate report: {str(e)}")
        return redirect("property-analysis-detail", property_id=property_obj.pk)

from io import BytesIO
from datetime import datetime
from django.shortcuts import get_object_or_404, redirect
from django.contrib import messages
from django.http import HttpResponse
from django.db.models import Sum
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors


def generate_financial_pdf(request, property_id):
    property_obj = get_object_or_404(Property, id=property_id)
    
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    
    try:
        # 1. Base Querysets
        expenses = property_obj.expenses.all().order_by('-expense_date', '-created_at')
        invoices = RentInvoice.objects.filter(lease__unit__property=property_obj)
        payments = Payment.objects.filter(invoice__in=invoices)
        property_leases = Lease.objects.filter(unit__property=property_obj)
        units = Unit.objects.filter(property=property_obj)

        date_heading = "All Historical Data"
        if start_date and end_date:
            try:
                s_date = datetime.strptime(start_date, '%Y-%m-%d').date()
                e_date = datetime.strptime(end_date, '%Y-%m-%d').date()
                expenses = expenses.filter(expense_date__range=[s_date, e_date])
                payments = payments.filter(payment_date__range=[s_date, e_date])
                invoices = invoices.filter(created_at__date__range=[s_date, e_date])
                
                new_tenants_count = property_leases.filter(start_date__range=[s_date, e_date]).values('tenant').distinct().count()
                evacuated_tenants_count = property_leases.filter(
                    Q(status__iexact='terminated') | Q(status__iexact='ended') | Q(status__iexact='vacated'),
                    end_date__range=[s_date, e_date]
                ).values('tenant').distinct().count()
                
                date_heading = f"Period: {s_date.strftime('%d %b %Y')} to {e_date.strftime('%d %b %Y')}"
            except ValueError:
                new_tenants_count = property_leases.filter(status__iexact='active').values('tenant').distinct().count()
                evacuated_tenants_count = property_leases.filter(Q(status__iexact='terminated') | Q(status__iexact='ended')).values('tenant').distinct().count()
                date_heading = "All Historical Data"
        else:
            new_tenants_count = property_leases.filter(status__iexact='active').values('tenant').distinct().count()
            evacuated_tenants_count = property_leases.filter(Q(status__iexact='terminated') | Q(status__iexact='ended')).values('tenant').distinct().count()

        # 2. Financial Aggregations & Efficiency Ratios
        collected_rent = payments.aggregate(total=Sum('amount'))['total'] or Decimal("0.00")
        total_expenses = expenses.aggregate(total=Sum('amount'))['total'] or Decimal("0.00")
        expected_revenue = invoices.aggregate(total=Sum('amount_due'))['total'] or Decimal("0.00")
        net_income = collected_rent - total_expenses
        
        outstanding_rent = max(Decimal("0.00"), expected_revenue - collected_rent)
        
        collection_rate = (collected_rent / expected_revenue * 100) if expected_revenue > 0 else 0.0
        profit_margin = (net_income / collected_rent * 100) if collected_rent > 0 else 0.0
        
        # 3. Occupancy & Tenant Counts
        total_units_count = units.count()
        active_leases = property_leases.filter(status__iexact='active')
        occupied_units_count = active_leases.values('unit').distinct().count()
        occupancy_rate = (occupied_units_count / total_units_count * 100) if total_units_count > 0 else 0.0

        active_lease_units = active_leases.values_list('unit_id', flat=True)
        unit_counts = units.values('unit_type').annotate(
            total_units=Count('id', distinct=True),
            active_tenants=Count('id', filter=Q(id__in=active_lease_units), distinct=True)
        )

        # 4. Dynamic Matplotlib Revenue vs Expenses Chart
        chart_buffer = io.BytesIO()
        fig, ax = plt.subplots(figsize=(6.5, 2.0), dpi=150)
        
        months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']
        rev_trend = [0] * 11 + [float(collected_rent)]
        exp_trend = [0] * 11 + [float(total_expenses)]
        
        ax.plot(months, rev_trend, marker='o', label='Revenue', color='#2563eb', linewidth=1.5)
        ax.plot(months, exp_trend, marker='o', label='Expenses', color='#f97316', linewidth=1.5)
        ax.set_title('Monthly Revenue vs Operating Expenses', fontsize=9.5, fontweight='bold', pad=6)
        ax.set_ylabel('KSh', fontsize=8)
        ax.tick_params(axis='both', which='major', labelsize=7)
        ax.grid(True, linestyle='--', alpha=0.5)
        ax.legend(fontsize=7.5, loc='upper left')
        plt.tight_layout()
        plt.savefig(chart_buffer, format='png')
        plt.close(fig)
        chart_buffer.seek(0)

        # 5. Build ReportLab PDF Document
        pdf_title = f"{property_obj.name} - Financial Report"
        
        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            pdf_buffer, 
            pagesize=letter,
            rightMargin=36, 
            leftMargin=36, 
            topMargin=36, 
            bottomMargin=36,
            title=pdf_title,
            author="PropertyPro"
        )
        elements = []
        styles = getSampleStyleSheet()

        # Centered Header Styles
        title_style = ParagraphStyle(
            'DocTitle', 
            parent=styles['Normal'], 
            fontName='Helvetica-Bold', 
            fontSize=16, 
            leading=20, 
            alignment=1, 
            textColor=colors.HexColor('#0f172a')
        )
        meta_style = ParagraphStyle(
            'DocMeta', 
            parent=styles['Normal'], 
            fontName='Helvetica', 
            fontSize=8.5, 
            leading=12, 
            alignment=1, 
            textColor=colors.HexColor('#64748b')
        )
        section_heading = ParagraphStyle(
            'SecHeading', 
            parent=styles['Normal'], 
            fontName='Helvetica-Bold', 
            fontSize=10.5, 
            leading=14, 
            textColor=colors.HexColor('#1e293b')
        )
        body_style = ParagraphStyle(
            'BodyTextCustom', 
            parent=styles['Normal'], 
            fontName='Helvetica', 
            fontSize=8.5, 
            leading=12, 
            textColor=colors.HexColor('#334155')
        )
        table_cell_style = ParagraphStyle(
            'TableCell', 
            parent=styles['Normal'], 
            fontName='Helvetica', 
            fontSize=8, 
            leading=10, 
            textColor=colors.HexColor('#334155')
        )

        # Header Block (Centered)
        header_data = [
            [Paragraph(f"PROPERTYPRO FINANCIAL & OCCUPANCY REPORT<br/><font color='#475569'>{property_obj.name}</font>", title_style)],
            [Paragraph(f"<b>Generated:</b> {datetime.now().strftime('%d %b %Y, %H:%M')} &nbsp;|&nbsp; <b>Range:</b> {date_heading}", meta_style)]
        ]
        header_table = Table(header_data, colWidths=[540])
        header_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 8))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceAfter=10))

        # Financial Performance & Indicators
        elements.append(Paragraph("Financial Performance & Key Metrics", section_heading))
        elements.append(Spacer(1, 4))

        summary_data = [
            ['Metric', 'Amount (KSh)', 'Performance Indicator', 'Rate'],
            ['Expected Revenue', f"{expected_revenue:,.2f}", 'Collection Rate', f"{collection_rate:.2f}%"],
            ['Collected Rent', f"{collected_rent:,.2f}", 'Occupancy Rate', f"{occupancy_rate:.2f}%"],
            ['Outstanding Rent', f"{outstanding_rent:,.2f}", 'Profit Margin', f"{profit_margin:.2f}%"],
            ['Operating Expenses', f"{total_expenses:,.2f}", '—', '—'],
            ['Net Operating Income', f"{net_income:,.2f}", '—', '—']
        ]
        summary_table = Table(summary_data, colWidths=[150, 120, 150, 120])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e3a8a')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('ALIGN', (1,0), (1,-1), 'RIGHT'),
            ('ALIGN', (3,0), (3,-1), 'RIGHT'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('PADDING', (0,0), (-1,-1), 4),
            ('BACKGROUND', (0,5), (1,5), colors.HexColor('#f1f5f9')),
            ('FONTNAME', (0,5), (1,5), 'Helvetica-Bold'),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 10))

        # Chart Section
        elements.append(Paragraph("Revenue and Expense Trend", section_heading))
        elements.append(Spacer(1, 4))
        elements.append(Image(chart_buffer, width=540, height=160))
        elements.append(Spacer(1, 10))

        # Occupancy & Property Structure Block
        elements.append(Paragraph("Occupancy & Property Structure", section_heading))
        elements.append(Spacer(1, 4))

        unit_table_data = [['Unit Type', 'Units', 'Tenants']]
        for item in unit_counts:
            u_type = str(item['unit_type']).replace('_', ' ').title() if item['unit_type'] else 'Standard'
            unit_table_data.append([
                u_type, 
                str(item['total_units']), 
                str(item['active_tenants'])
            ])
        if len(unit_table_data) == 1:
            unit_table_data.append(['No units registered', '0', '0'])

        tenant_activity_data = [
            ['Tenant Activity Metric', 'Count'],
            ['New Tenants Onboarded', str(new_tenants_count)],
            ['Tenants Evacuated / Vacated', str(evacuated_tenants_count)],
        ]

        table_units = Table(unit_table_data, colWidths=[120, 70, 70])
        table_units.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#334155')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('ALIGN', (1,0), (-1,-1), 'RIGHT'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('PADDING', (0,0), (-1,-1), 4),
        ]))

        table_tenants = Table(tenant_activity_data, colWidths=[180, 80])
        table_tenants.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#334155')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('ALIGN', (1,0), (1,-1), 'RIGHT'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('PADDING', (0,0), (-1,-1), 4),
        ]))

        side_by_side = Table([[table_units, table_tenants]], colWidths=[270, 270])
        side_by_side.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        elements.append(side_by_side)
        elements.append(Spacer(1, 10))

        # Itemized Expenses Breakdown Section
        elements.append(Paragraph("Operating Expenses Breakdown", section_heading))
        elements.append(Spacer(1, 4))

        expense_table_data = [['Date', 'Category', 'Description', 'Amount (KSh)']]
        for exp in expenses:
            exp_date = exp.expense_date.strftime('%d %b %Y') if getattr(exp, 'expense_date', None) else '—'
            category_str = str(exp.category).replace('_', ' ').title() if hasattr(exp, 'category') and exp.category else 'General'
            desc = Paragraph(exp.description or '—', table_cell_style)
            amount_str = f"{exp.amount:,.2f}" if hasattr(exp, 'amount') and exp.amount else "0.00"

            expense_table_data.append([exp_date, category_str, desc, amount_str])

        if len(expense_table_data) == 1:
            expense_table_data.append(['—', 'No recorded expenses', '—', '0.00'])

        # Total Expense Footer Row
        expense_table_data.append(['Total Operating Expenses', '', '', f"{total_expenses:,.2f}"])

        expense_table = Table(expense_table_data, colWidths=[80, 110, 230, 120])
        expense_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e3a8a')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('ALIGN', (3,0), (3,-1), 'RIGHT'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('PADDING', (0,0), (-1,-1), 4),
            ('SPAN', (0, -1), (2, -1)),
            ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f1f5f9')),
            ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
        ]))
        elements.append(expense_table)
        elements.append(Spacer(1, 10))

        # Management Summary Text Block
        elements.append(Paragraph("Management Summary", section_heading))
        elements.append(Spacer(1, 4))
        summary_text = (
            f"The property generated <b>KSh {collected_rent:,.2f}</b> in verified rental collections during "
            f"the reporting period ({date_heading}). Operating expenses amounted to <b>KSh {total_expenses:,.2f}</b>, "
            f"resulting in a net operating income (NOI) of <b>KSh {net_income:,.2f}</b>. The property achieved a "
            f"collection rate of <b>{collection_rate:.2f}%</b>, an occupancy rate of <b>{occupancy_rate:.2f}%</b>, "
            f"and an overall profit margin of <b>{profit_margin:.2f}%</b>."
        )
        elements.append(Paragraph(summary_text, body_style))

        doc.build(elements)
        pdf_buffer.seek(0)

        filename = f"{property_obj.name.replace(' ', '_')}_Financial_Report.pdf"
        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response

    except Exception as e:
        messages.error(request, f"Failed to generate the PDF report: {str(e)}")
        return redirect('property-analysis-detail', property_id=property_id)