from decimal import Decimal
from functools import wraps
from datetime import timedelta

from django.contrib import messages
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.decorators import login_required
from django.contrib.messages import get_messages
from django.db import transaction
from django.db.models import Sum, Prefetch
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse_lazy
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.generic import CreateView

from rest_framework import status
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from properties.models import (
    Tenant,
    Lease,
    RentInvoice,
    Payment,
    Unit,
    UnitType,
    VacationRequest,  # Assuming VacationRequest model exists in properties or your app
)
from .models import MaintenanceRequest
from .forms import TenantSelfRegistrationForm
from .serializers import (
    TenantProfileSerializer,
    TenantLeaseSerializer,
    TenantInvoiceSerializer,
    TenantPaymentSerializer,
)
from api.mpesa import MpesaService
from api.utils import normalize_phone_number

User = get_user_model()


# =========================================================
# HELPER & ACCESS DECORATOR
# =========================================================

def get_tenant(request):
    """Retrieve the Tenant instance associated with the active request user."""
    if not request.user or not request.user.is_authenticated:
        return None
    try:
        return (
            Tenant.objects
            .select_related("user", "company")
            .get(user=request.user)
        )
    except Tenant.DoesNotExist:
        return None


def tenant_required(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect("/tenant/login/")

        # Explicitly disallow superusers/staff from viewing tenant pages under admin session
        if request.user.is_superuser or request.user.is_staff:
            tenant = get_tenant(request)
            if not tenant:  # Unless they actually have a Tenant model linked
                logout(request)
                messages.error(request, "Admins must log into dedicated tenant accounts.")
                return redirect("/tenant/login/")

        tenant = get_tenant(request)
        user_role = str(getattr(request.user, "role", "")).upper()

        if not tenant and user_role != "TENANT":
            logout(request)
            messages.error(request, "This portal is restricted to tenant accounts only.")
            return redirect("/tenant/login/")

        return view_func(request, *args, **kwargs)
    return _wrapped_view


def load_units(request):
    property_id = request.GET.get('property_id')
    
    if not property_id:
        return JsonResponse({'units': [], 'unit_types': []})

    # Fetch vacant units for the selected property
    vacant_units = Unit.objects.filter(
        property_id=property_id, 
        status=Unit.Status.VACANT
    ).order_by('unit_number')

    units_data = []
    for unit in vacant_units:
        units_data.append({
            "id": unit.id,
            "unit_number": unit.unit_number,
            "unit_type": str(unit.unit_type) if unit.unit_type else "",
        })

    # Get distinct unit types existing across all units in this property
    property_units = Unit.objects.filter(property_id=property_id)
    
    # Extract unique (value, label) choices present in this property
    unit_types_data = []
    seen_types = set()
    
    for unit in property_units:
        val = unit.unit_type
        if val and val not in seen_types:
            seen_types.add(val)
            display_label = unit.get_unit_type_display() if hasattr(unit, 'get_unit_type_display') else str(val)
            unit_types_data.append({
                "id": val,
                "name": display_label
            })

    return JsonResponse({
        'units': units_data,
        'unit_types': unit_types_data
    })


# =========================================================
# AUTHENTICATION & REGISTRATION VIEWS
# =========================================================

def tenant_login_page(request):
    storage = get_messages(request)
    for _ in storage:
        pass  # Consumes and clears old session messages

    if request.user.is_authenticated:
        user = request.user
        user_role = str(getattr(user, "role", "")).upper()
        has_tenant_profile = hasattr(user, "tenant") or user_role == "TENANT"
        is_management_or_staff = user.is_staff or user.is_superuser or user_role in ["ADMIN", "MANAGER", "ACCOUNTANT"]

        if is_management_or_staff or not has_tenant_profile:
            logout(request)
            return redirect("tenant-login")

        return redirect("/tenant/dashboard/")

    if request.method == "POST":
        login_input = (
            request.POST.get("username")
            or request.POST.get("email")
            or request.POST.get("phone", "")
        ).strip()
        password = request.POST.get("password", "")

        if not login_input or not password:
            messages.error(request, "Invalid username or password.")
            return render(request, "tenants/login.html")

        user = authenticate(request, username=login_input, password=password)

        if user is None and "@" in login_input:
            try:
                user_obj = User.objects.get(email__iexact=login_input)
                user = authenticate(
                    request,
                    username=user_obj.get_username(),
                    password=password
                )
            except (User.DoesNotExist, User.MultipleObjectsReturned):
                user = None

        if user is None:
            try:
                tenant_obj = Tenant.objects.select_related("user").filter(phone=login_input).first()
                if tenant_obj and tenant_obj.user:
                    user = authenticate(
                        request,
                        username=tenant_obj.user.get_username(),
                        password=password
                    )
            except Exception:
                user = None

        if user is None or not user.is_active:
            messages.error(request, "Invalid username or password.")
            return render(request, "tenants/login.html")

        user_role = str(getattr(user, "role", "")).upper()
        has_tenant_profile = hasattr(user, "tenant") or user_role == "TENANT"
        is_management_or_staff = user.is_staff or user.is_superuser or user_role in ["ADMIN", "MANAGER", "ACCOUNTANT"]

        if is_management_or_staff or not has_tenant_profile:
            messages.error(request, "Invalid username or password.")
            return render(request, "tenants/login.html")

        login(request, user)
        request.session.set_expiry(0)

        return redirect("/tenant/dashboard/")

    return render(request, "tenants/login.html")


class TenantRegisterView(CreateView):
    form_class = TenantSelfRegistrationForm
    template_name = "tenants/register.html"

    def form_valid(self, form):
        with transaction.atomic():
            user = form.save()
            tenant = getattr(user, 'tenant_profile', None) or Tenant.objects.filter(user=user).first()
            unit = form.cleaned_data.get('unit') or form.cleaned_data.get('unit_obj')
            
            today = timezone.now().date()
            due_date = today + timedelta(days=5)
            
            lease = Lease.objects.create(
                tenant=tenant,
                unit=unit,
                start_date=today,
                monthly_rent=unit.rent_amount if hasattr(unit, 'rent_amount') else unit.price,
                status=Lease.Status.PENDING
            )

            if hasattr(Unit, 'Status'):
                unit.status = getattr(Unit.Status, 'RESERVED', unit.status)
                unit.save(update_fields=['status'])

            billing_month_str = today.strftime("%Y-%m-01")
            invoice = RentInvoice.objects.create(
                lease=lease,
                invoice_number=f"INV-{tenant.id}-{today.strftime('%Y%m%d')}",
                billing_month=billing_month_str,
                amount_due=lease.monthly_rent,
                amount_paid=Decimal("0.00"),
                due_date=due_date,
                status=RentInvoice.Status.PENDING,
            )

            login(self.request, user)
            self.request.session['registration_invoice_id'] = invoice.id

            messages.info(
                self.request, 
                "Account created! Please complete your first month's rent payment to activate your tenancy."
            )
            return redirect("tenant_payment_page")


# =========================================================
# INITIAL REGISTRATION PAYMENT CHECKOUT VIEW
# =========================================================

@tenant_required
@ensure_csrf_cookie
def tenant_registration_checkout_page(request):
    tenant = get_tenant(request)
    invoice_id = request.session.get('registration_invoice_id')
    
    invoice = None
    if invoice_id:
        invoice = (
            RentInvoice.objects
            .select_related("lease", "lease__unit", "lease__unit__property")
            .filter(id=invoice_id, lease__tenant=tenant)
            .first()
        )

    if not invoice:
        invoice = (
            RentInvoice.objects
            .select_related("lease", "lease__unit", "lease__unit__property")
            .filter(lease__tenant=tenant, status=RentInvoice.Status.PENDING)
            .order_by("-id")
            .first()
        )

    if not invoice:
        return redirect("/tenant/dashboard/")

    return render(
        request, 
        "tenants/registration_checkout.html", 
        {
            "tenant": tenant,
            "invoice": invoice,
            "amount_due": invoice.amount_due,
            "unit": invoice.lease.unit,
            "property": invoice.lease.unit.property if hasattr(invoice.lease.unit, 'property') else None,
        }
    )


# =========================================================
# TENANT PORTAL HTML VIEWS
# =========================================================

@tenant_required
def tenant_dashboard_page(request):
    return render(request, "tenants/dashboard.html")


@tenant_required
def tenant_lease_page(request):
    return render(request, "tenants/lease.html")


@tenant_required
@ensure_csrf_cookie
def tenant_request_vacate_page(request):
    """Renders the standalone page to request lease vacation."""
    tenant = get_tenant(request)
    active_lease = (
        Lease.objects
        .select_related("unit", "unit__property")
        .filter(tenant=tenant, status=Lease.Status.ACTIVE)
        .order_by("-start_date")
        .first()
    )

    return render(
        request,
        "tenants/request_vacate.html",
        {
            "tenant": tenant,
            "active_lease": active_lease,
        }
    )


@tenant_required
def tenant_request_vacate_submit(request):
    """Processes the submitted vacation request form."""
    if request.method != "POST":
        return redirect("tenant-request-vacate-page")

    tenant = get_tenant(request)
    active_lease = (
        Lease.objects
        .filter(tenant=tenant, status=Lease.Status.ACTIVE)
        .order_by("-start_date")
        .first()
    )

    if not active_lease:
        messages.error(request, "You do not have an active lease to vacate.")
        return redirect("/tenant/lease/")

    vacate_date = request.POST.get("vacate_date")
    reason = request.POST.get("reason", "").strip()

    if not vacate_date or not reason:
        messages.error(request, "Please fill in all required fields.")
        return redirect("tenant-request-vacate-page")

    # Save vacation notice request
    if 'VacationRequest' in globals():
        VacationRequest.objects.create(
            lease=active_lease,
            tenant=tenant,
            vacate_date=vacate_date,
            reason=reason,
            status="PENDING"
        )

    messages.success(request, "Your vacation request has been submitted successfully for management review.")
    return redirect("/tenant/lease/")


@tenant_required
@ensure_csrf_cookie
def tenant_payments_page(request):
    return render(request, "tenants/payments.html")


@tenant_required
@ensure_csrf_cookie
def tenant_payment_page(request):
    return render(request, "tenants/tenant_payment.html")


@tenant_required
def tenant_maintenance_page(request):
    tenant = get_tenant(request)
    maintenance_requests = (
        MaintenanceRequest.objects
        .select_related("tenant", "unit")
        .filter(tenant=tenant)
        .order_by("-reported_at")
    )

    return render(
        request,
        "tenants/maintenance.html",
        {"maintenance_requests": maintenance_requests}
    )


@tenant_required
@ensure_csrf_cookie
def tenant_report_maintenance_page(request):
    tenant = get_tenant(request)

    active_lease = (
        Lease.objects
        .select_related("unit", "unit__property")
        .filter(tenant=tenant, status=Lease.Status.ACTIVE)
        .order_by("-start_date")
        .first()
    )

    if request.method == "POST":
        title = request.POST.get("title", "").strip()
        category = request.POST.get("category", "").strip().upper()
        priority = request.POST.get("priority", "").strip().upper()
        description = request.POST.get("description", "").strip()
        access_notes = request.POST.get("access_notes", "").strip()

        if not title or not category or not priority or not description:
            return render(
                request,
                "tenants/report_maintenance.html",
                {
                    "tenant": tenant,
                    "active_lease": active_lease,
                    "error": "Please complete all required fields.",
                    "form_data": request.POST,
                }
            )

        if not active_lease:
            return render(
                request,
                "tenants/report_maintenance.html",
                {
                    "tenant": tenant,
                    "active_lease": None,
                    "error": "You do not currently have an active lease. Please contact management.",
                }
            )

        valid_categories = {choice[0] for choice in MaintenanceRequest.Category.choices}
        valid_priorities = {choice[0] for choice in MaintenanceRequest.Priority.choices}

        if category not in valid_categories:
            category = MaintenanceRequest.Category.OTHER

        if priority not in valid_priorities:
            priority = MaintenanceRequest.Priority.MEDIUM

        MaintenanceRequest.objects.create(
            tenant=tenant,
            lease=active_lease,
            unit=active_lease.unit,
            title=title,
            category=category,
            priority=priority,
            description=description,
            access_notes=access_notes,
            status=MaintenanceRequest.Status.PENDING,
        )

        messages.success(
            request,
            "Maintenance request submitted successfully. The management team has been notified."
        )
        return redirect("/tenant/maintenance/")

    return render(
        request,
        "tenants/maintenance_report.html",
        {
            "tenant": tenant,
            "active_lease": active_lease,
        }
    )


# =========================================================
# REST API ENDPOINTS
# =========================================================

class TenantDashboardAPIView(APIView):
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = get_tenant(request)

        if not tenant:
            return Response(
                {"error": "Tenant profile not found for the logged-in user."},
                status=status.HTTP_404_NOT_FOUND
            )

        active_lease = (
            Lease.objects
            .select_related("unit", "unit__property")
            .filter(tenant=tenant, status=Lease.Status.ACTIVE)
            .order_by("-start_date")
            .first()
        )

        invoices = (
            RentInvoice.objects
            .select_related("lease", "lease__unit", "lease__unit__property")
            .filter(lease__tenant=tenant)
            .order_by("-billing_month", "-id")
        )

        payments = Payment.objects.filter(tenant=tenant)

        total_billed = invoices.aggregate(total=Sum("amount_due"))["total"] or Decimal("0.00")
        total_billed = Decimal(str(total_billed))

        total_paid = (
            payments
            .filter(status=Payment.Status.COMPLETED)
            .aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        total_paid = Decimal(str(total_paid))

        outstanding = max(total_billed - total_paid, Decimal("0.00"))

        current_invoice = (
            invoices
            .exclude(status__in=[RentInvoice.Status.PAID, RentInvoice.Status.CANCELLED])
            .first()
        )

        current_invoice_data = None
        if current_invoice:
            invoice_amount_due = Decimal(str(current_invoice.amount_due or 0))
            invoice_amount_paid = Decimal(str(current_invoice.amount_paid or 0))
            invoice_balance = max(invoice_amount_due - invoice_amount_paid, Decimal("0.00"))

            current_invoice_data = {
                "id": current_invoice.id,
                "invoice_number": current_invoice.invoice_number,
                "billing_month": str(current_invoice.billing_month),
                "due_date": str(current_invoice.due_date),
                "amount_due": str(invoice_amount_due),
                "amount_paid": str(invoice_amount_paid),
                "balance": str(invoice_balance),
                "status": current_invoice.status,
                "property_name": getattr(getattr(getattr(current_invoice, "lease", None), "unit", None), "property", None).name if hasattr(current_invoice.lease.unit, "property") else "-",
                "unit_number": getattr(current_invoice.lease.unit, "unit_number", "-") if hasattr(current_invoice.lease, "unit") else "-",
            }

        tenant_data = {
            "id": tenant.id,
            "username": tenant.user.username,
            "full_name": tenant.user.get_full_name() or tenant.user.username,
            "first_name": tenant.user.first_name,
            "last_name": tenant.user.last_name,
            "phone": tenant.phone,
            "email": tenant.user.email,
        }

        active_lease_data = None
        if active_lease:
            unit = getattr(active_lease, "unit", None)
            prop = getattr(unit, "property", None) if unit else None

            active_lease_data = {
                "id": active_lease.id,
                "start_date": str(active_lease.start_date),
                "end_date": str(active_lease.end_date) if active_lease.end_date else None,
                "monthly_rent": str(active_lease.monthly_rent),
                "rent_amount": str(active_lease.monthly_rent),
                "status": active_lease.status,
                "unit_number": unit.unit_number if unit else "-",
                "unit_type": getattr(unit, "unit_type", "-"),
                "floor": getattr(unit, "floor", "-"),
                "property_name": prop.name if prop else "-",
                "property_address": prop.address if prop else "-",
                "city": prop.city if prop else "-",
            }

        return Response({
            "tenant": tenant_data,
            "active_lease": active_lease_data,
            "current_invoice": current_invoice_data,
            "summary": {
                "monthly_rent": str(active_lease.monthly_rent) if active_lease else "0.00",
                "total_billed": str(total_billed),
                "total_paid": str(total_paid),
                "outstanding": str(outstanding),
                "invoice_count": invoices.count(),
                "payment_count": payments.count(),
            },
        })


class TenantProfileAPIView(APIView):
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = get_tenant(request)
        if not tenant:
            return Response(
                {"error": "Tenant profile not found."},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response(TenantProfileSerializer(tenant).data)


class TenantLeaseAPIView(APIView):
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = get_tenant(request)
        if not tenant:
            return Response(
                {"error": "Tenant profile not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        lease = (
            Lease.objects
            .select_related("unit", "unit__property")
            .filter(tenant=tenant, status=Lease.Status.ACTIVE)
            .first()
        )

        if not lease:
            return Response({
                "message": "No active lease found.",
                "lease": None
            })

        return Response(TenantLeaseSerializer(lease).data)


class TenantInvoicesAPIView(APIView):
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = get_tenant(request)
        if not tenant:
            return Response(
                {"error": "Tenant profile not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        invoices = (
            RentInvoice.objects
            .select_related("lease", "lease__unit", "lease__unit__property")
            .prefetch_related(
                Prefetch(
                    "payments",
                    queryset=Payment.objects.filter(status=Payment.Status.COMPLETED)
                )
            )
            .filter(lease__tenant=tenant)
            .order_by("-billing_month")
        )

        return Response(TenantInvoiceSerializer(invoices, many=True).data)


class TenantPaymentsAPIView(APIView):
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = get_tenant(request)
        if not tenant:
            return Response(
                {"error": "Tenant profile not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        payments = (
            Payment.objects
            .select_related(
                "invoice",
                "invoice__lease",
                "invoice__lease__unit",
                "invoice__lease__unit__property",
            )
            .filter(tenant=tenant)
            .order_by("-created_at")
        )

        return Response(TenantPaymentSerializer(payments, many=True).data)

    def post(self, request):
        tenant = get_tenant(request)
        if not tenant:
            return Response(
                {"error": "Tenant profile not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        invoice_id = request.data.get("invoice_id")
        amount = request.data.get("amount")
        phone_number = request.data.get("phone_number")

        if not invoice_id:
            return Response({"error": "Invoice ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        if amount is None:
            return Response({"error": "Payment amount is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not phone_number:
            return Response({"error": "M-Pesa phone number is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invoice = (
                RentInvoice.objects
                .select_related(
                    "lease",
                    "lease__tenant",
                    "lease__unit",
                    "lease__unit__property",
                )
                .get(id=invoice_id)
            )
        except RentInvoice.DoesNotExist:
            return Response({"error": "Invoice not found."}, status=status.HTTP_404_NOT_FOUND)

        if invoice.lease.tenant_id != tenant.id:
            return Response({"error": "You are not authorized to pay this invoice."}, status=status.HTTP_403_FORBIDDEN)

        try:
            amount = Decimal(str(amount))
        except Exception:
            return Response({"error": "Invalid payment amount."}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({"error": "Payment amount must be greater than zero."}, status=status.HTTP_400_BAD_REQUEST)

        completed_total = (
            Payment.objects
            .filter(invoice=invoice, status=Payment.Status.COMPLETED)
            .aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        completed_total = Decimal(str(completed_total))

        outstanding_balance = max(
            Decimal(str(invoice.amount_due)) - completed_total,
            Decimal("0.00")
        )

        if outstanding_balance <= 0:
            return Response(
                {"error": "This invoice has already been fully paid.", "balance": "0.00"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if amount > outstanding_balance:
            return Response(
                {
                    "error": "Payment amount cannot exceed the outstanding balance.",
                    "payment_amount": str(amount),
                    "outstanding_balance": str(outstanding_balance),
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        pending_payment = Payment.objects.filter(
            invoice=invoice,
            status=Payment.Status.PENDING
        ).exists()

        if pending_payment:
            return Response(
                {"error": "A payment request is already pending for this invoice."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            phone_number = normalize_phone_number(phone_number)
        except ValueError as error:
            return Response({"error": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            payment = Payment.objects.create(
                invoice=invoice,
                tenant=tenant,
                amount=amount,
                method=Payment.Method.MPESA,
                status=Payment.Status.PENDING,
                phone_number=phone_number,
            )

        try:
            mpesa_response = MpesaService.stk_push(
                phone_number=phone_number,
                amount=amount,
                account_reference=invoice.invoice_number,
                transaction_desc=f"Rent payment {invoice.invoice_number}",
            )
        except Exception as error:
            payment.status = Payment.Status.FAILED
            update_fields = ["status", "updated_at"]
            if hasattr(payment, "notes"):
                payment.notes = str(error)
                update_fields.append("notes")
            payment.save(update_fields=update_fields)

            return Response(
                {"error": "Unable to initiate M-Pesa payment.", "details": str(error)},
                status=status.HTTP_502_BAD_GATEWAY
            )

        response_code = mpesa_response.get("ResponseCode")

        if str(response_code) != "0":
            payment.status = Payment.Status.FAILED
            update_fields = ["status", "updated_at"]
            error_message = mpesa_response.get("ResponseDescription", "M-Pesa payment request failed.")
            
            if hasattr(payment, "notes"):
                payment.notes = error_message
                update_fields.append("notes")
                
            payment.save(update_fields=update_fields)

            return Response(
                {"error": error_message, "details": mpesa_response},
                status=status.HTTP_400_BAD_REQUEST
            )

        checkout_request_id = mpesa_response.get("CheckoutRequestID")
        merchant_request_id = mpesa_response.get("MerchantRequestID")

        update_fields = ["updated_at"]
        if hasattr(payment, "mpesa_checkout_request_id") and checkout_request_id:
            payment.mpesa_checkout_request_id = checkout_request_id
            update_fields.append("mpesa_checkout_request_id")

        if hasattr(payment, "mpesa_merchant_request_id") and merchant_request_id:
            payment.mpesa_merchant_request_id = merchant_request_id
            update_fields.append("mpesa_merchant_request_id")

        payment.save(update_fields=update_fields)

        return Response(
            {
                "message": "M-Pesa STK push initiated successfully.",
                "payment_id": payment.id,
                "checkout_request_id": checkout_request_id,
                "merchant_request_id": merchant_request_id,
            },
            status=status.HTTP_200_OK
        )