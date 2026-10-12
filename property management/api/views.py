from datetime import date
from decimal import Decimal
import traceback

from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.decorators import (
    action,
    api_view,
    permission_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from properties.models import (
    Company,
    Lease,
    Payment,
    Property,
    RentInvoice,
    Tenant,
    Unit,
)

from .mpesa import MpesaService, normalize_phone_number
from .permissions import IsAccountant, IsManagement
from .serializers import (
    CompanySerializer,
    LeaseSerializer,
    PaymentSerializer,
    PropertySerializer,
    RentInvoiceSerializer,
    TenantSerializer,
    UnitSerializer,
)


# =========================================================
# LOGIN
# =========================================================

class LoginAPIView(APIView):

    permission_classes = []

    def post(self, request):

        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(
            username=username,
            password=password
        )

        if user is None:

            return Response(
                {
                    "error": "Invalid username or password."
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        token, created = Token.objects.get_or_create(
            user=user
        )

        return Response(
            {
                "token": token.key,

                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "role": user.role,
                    "company": user.company_id,
                }
            }
        )


# =========================================================
# COMPANY
# =========================================================

class CompanyViewSet(viewsets.ModelViewSet):

    serializer_class = CompanySerializer
    permission_classes = [IsManagement]

    def get_queryset(self):

        user = self.request.user

        if user.role == "ADMIN":
            return Company.objects.all()

        return Company.objects.filter(
            id=user.company_id
        )


# =========================================================
# PROPERTY
# =========================================================

class PropertyViewSet(viewsets.ModelViewSet):

    serializer_class = PropertySerializer
    permission_classes = [IsManagement]

    def get_queryset(self):

        user = self.request.user

        queryset = Property.objects.select_related(
            "company"
        )

        if user.role == "ADMIN":
            return queryset.all()

        return queryset.filter(
            company=user.company
        )


# =========================================================
# UNIT
# =========================================================

class UnitViewSet(viewsets.ModelViewSet):

    serializer_class = UnitSerializer
    permission_classes = [IsManagement]

    def get_queryset(self):

        user = self.request.user

        queryset = Unit.objects.select_related(
            "property"
        )

        if user.role == "ADMIN":
            return queryset.all()

        return queryset.filter(
            property__company=user.company
        )


# =========================================================
# TENANT
# =========================================================

class TenantViewSet(viewsets.ModelViewSet):

    serializer_class = TenantSerializer
    permission_classes = [IsManagement]

    def get_queryset(self):

        user = self.request.user

        queryset = Tenant.objects.select_related(
            "user",
            "company"
        )

        if user.role == "ADMIN":
            return queryset.all()

        return queryset.filter(
            company=user.company
        )


# =========================================================
# LEASE
# =========================================================

class LeaseViewSet(viewsets.ModelViewSet):

    serializer_class = LeaseSerializer
    permission_classes = [IsManagement]

    def get_queryset(self):

        user = self.request.user

        queryset = Lease.objects.select_related(
            "tenant__user",
            "unit__property",
        )

        if user.role == "ADMIN":
            return queryset.all()

        return queryset.filter(
            unit__property__company=user.company
        )


# =========================================================
# RENT INVOICE
# =========================================================

class RentInvoiceViewSet(viewsets.ModelViewSet):

    serializer_class = RentInvoiceSerializer
    permission_classes = [
        IsManagement | IsAccountant
    ]

    def get_queryset(self):

        user = self.request.user

        queryset = RentInvoice.objects.select_related(
            "lease__tenant__user",
            "lease__unit__property",
        )

        if user.role == "ADMIN":
            return queryset.all()

        return queryset.filter(
            lease__unit__property__company=user.company
        )


# =========================================================
# ACCOUNTING DASHBOARD
# =========================================================

class AccountingDashboardAPIView(APIView):

    permission_classes = [IsAccountant]

    def get(self, request):

        company = request.user.company

        invoices = RentInvoice.objects.filter(
            lease__unit__property__company=company
        )

        total_billed = invoices.aggregate(
            total=Sum("amount_due")
        )["total"] or Decimal("0.00")

        total_collected = invoices.aggregate(
            total=Sum("amount_paid")
        )["total"] or Decimal("0.00")

        outstanding = max(
            Decimal(total_billed) -
            Decimal(total_collected),
            Decimal("0.00")
        )

        paid_count = invoices.filter(
            status=RentInvoice.Status.PAID
        ).count()

        partial_count = invoices.filter(
            status=RentInvoice.Status.PARTIAL
        ).count()

        overdue_count = invoices.filter(
            status=RentInvoice.Status.OVERDUE
        ).count()

        unpaid_count = invoices.filter(
            status=RentInvoice.Status.UNPAID
        ).count()

        return Response(
            {
                "total_billed": total_billed,
                "total_collected": total_collected,
                "outstanding": outstanding,
                "paid_invoices": paid_count,
                "partial_invoices": partial_count,
                "overdue_invoices": overdue_count,
                "unpaid_invoices": unpaid_count,
            }
        )


# =========================================================
# GENERATE INVOICES
# =========================================================

class GenerateInvoicesAPIView(APIView):

    authentication_classes = [
        TokenAuthentication
    ]

    permission_classes = [
        IsAuthenticated
    ]

    def post(self, request):

        billing_month = request.data.get(
            "billing_month"
        )

        if not billing_month:

            return Response(
                {
                    "error": (
                        "billing_month is required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:

            year, month = map(
                int,
                billing_month.split("-")
            )

            billing_date = date(
                year,
                month,
                1
            )

        except (ValueError, TypeError):

            return Response(
                {
                    "error": (
                        "Invalid billing_month. "
                        "Use YYYY-MM format."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        leases = Lease.objects.filter(
            status=Lease.Status.ACTIVE,
            start_date__lte=billing_date,
            end_date__gte=billing_date,
            unit__property__company=request.user.company
        ).select_related(
            "tenant",
            "unit",
            "unit__property"
        )

        generated = []
        skipped = []

        with transaction.atomic():

            for lease in leases:

                existing_invoice = (
                    RentInvoice.objects.filter(
                        lease=lease,
                        billing_month=billing_date
                    ).first()
                )

                if existing_invoice:

                    skipped.append(
                        existing_invoice.invoice_number
                    )

                    continue

                invoice_number = (
                    generate_invoice_number()
                )

                due_date = date(
                    year,
                    month,
                    5
                )

                invoice = RentInvoice.objects.create(
                    lease=lease,
                    invoice_number=invoice_number,
                    billing_month=billing_date,
                    due_date=due_date,
                    amount_due=lease.monthly_rent,
                    amount_paid=Decimal("0.00"),
                    status=RentInvoice.Status.UNPAID
                )

                generated.append(
                    invoice.invoice_number
                )

        return Response(
            {
                "message": (
                    "Invoice generation completed."
                ),
                "billing_month": billing_date,
                "generated_count": len(generated),
                "skipped_count": len(skipped),
                "generated_invoices": generated,
                "skipped_invoices": skipped,
            },
            status=status.HTTP_201_CREATED
        )


# =========================================================
# GENERATE INVOICE NUMBER
# =========================================================

def generate_invoice_number():

    last_invoice = (
        RentInvoice.objects
        .order_by("-id")
        .first()
    )

    if last_invoice is None:

        next_number = 1

    else:

        next_number = (
            last_invoice.id + 1
        )

    return f"INV-{next_number:06d}"


# =========================================================
# M-PESA CALLBACK
# =========================================================

@api_view(["POST"])
@permission_classes([AllowAny])
def mpesa_callback(request):

    print("")
    print("==========================================")
    print("         M-PESA CALLBACK RECEIVED")
    print("==========================================")

    print(request.data)

    body = request.data.get(
        "Body",
        {}
    )

    callback_data = body.get(
        "stkCallback",
        {}
    )

    merchant_request_id = (
        callback_data.get(
            "MerchantRequestID"
        )
    )

    checkout_request_id = (
        callback_data.get(
            "CheckoutRequestID"
        )
    )

    result_code = (
        callback_data.get(
            "ResultCode"
        )
    )

    result_description = (
        callback_data.get(
            "ResultDesc",
            ""
        )
    )

    print(
        "MerchantRequestID:",
        merchant_request_id
    )

    print(
        "CheckoutRequestID:",
        checkout_request_id
    )

    print(
        "ResultCode:",
        result_code
    )

    print(
        "ResultDesc:",
        result_description
    )

    # =====================================================
    # VALIDATE CHECKOUT REQUEST ID
    # =====================================================

    if not checkout_request_id:

        print(
            "Missing CheckoutRequestID."
        )

        return Response(
            {
                "ResultCode": 0,
                "ResultDesc": "Accepted"
            },
            status=status.HTTP_200_OK
        )

    # =====================================================
    # FIND PAYMENT
    # =====================================================

    payment = (
        Payment.objects
        .select_related(
            "invoice",
            "tenant",
        )
        .filter(
            checkout_request_id=(
                checkout_request_id
            )
        )
        .first()
    )

    if not payment:

        print(
            "Payment not found for CheckoutRequestID:",
            checkout_request_id
        )

        return Response(
            {
                "ResultCode": 0,
                "ResultDesc": "Accepted"
            },
            status=status.HTTP_200_OK
        )

    print(
        "Matched Payment ID:",
        payment.id
    )

    print(
        "Payment Status:",
        payment.status
    )

    # =====================================================
    # PREVENT DUPLICATE CALLBACK
    # =====================================================

    if payment.status == (
        Payment.Status.COMPLETED
    ):

        print(
            "Payment already completed:",
            payment.id
        )

        return Response(
            {
                "ResultCode": 0,
                "ResultDesc": (
                    "Payment already processed"
                )
            },
            status=status.HTTP_200_OK
        )

    # =====================================================
    # CONVERT RESULT CODE
    # =====================================================

    try:

        result_code_int = int(
            result_code
        )

    except (
        TypeError,
        ValueError
    ):

        result_code_int = -1

    # =====================================================
    # FAILED / CANCELLED PAYMENT
    # =====================================================

    if result_code_int != 0:

        payment.status = (
            Payment.Status.FAILED
        )

        payment.save(
            update_fields=[
                "status",
                "updated_at"
            ]
        )

        print(
            "M-Pesa payment failed:",
            result_description
        )

        return Response(
            {
                "ResultCode": 0,
                "ResultDesc": (
                    "Callback processed"
                )
            },
            status=status.HTTP_200_OK
        )

    # =====================================================
    # GET CALLBACK METADATA
    # =====================================================

    callback_metadata = (
        callback_data.get(
            "CallbackMetadata",
            {}
        )
    )

    items = callback_metadata.get(
        "Item",
        []
    )

    metadata = {}

    for item in items:

        name = item.get("Name")

        if name:

            metadata[name] = (
                item.get("Value")
            )

    mpesa_receipt = (
        metadata.get(
            "MpesaReceiptNumber"
        )
    )

    transaction_date = (
        metadata.get(
            "TransactionDate"
        )
    )

    phone_number = (
        metadata.get(
            "PhoneNumber"
        )
    )

    callback_amount = (
        metadata.get(
            "Amount"
        )
    )

    print(
        "M-Pesa Receipt:",
        mpesa_receipt
    )

    print(
        "Transaction Date:",
        transaction_date
    )

    print(
        "Phone:",
        phone_number
    )

    print(
        "Amount:",
        callback_amount
    )

    # =====================================================
    # VALIDATE PAYMENT AMOUNT
    # =====================================================

    try:

        callback_amount_decimal = Decimal(
            str(callback_amount)
        )

    except (
        TypeError,
        ValueError
    ):

        print(
            "Invalid callback amount."
        )

        payment.status = (
            Payment.Status.FAILED
        )

        payment.save(
            update_fields=[
                "status",
                "updated_at"
            ]
        )

        return Response(
            {
                "ResultCode": 0,
                "ResultDesc": (
                    "Invalid payment amount"
                )
            },
            status=status.HTTP_200_OK
        )

    expected_amount = Decimal(
        payment.amount
    )

    if callback_amount_decimal != (
        expected_amount
    ):

        print(
            "PAYMENT AMOUNT MISMATCH"
        )

        print(
            "Expected:",
            expected_amount
        )

        print(
            "Received:",
            callback_amount_decimal
        )

        payment.status = (
            Payment.Status.FAILED
        )

        payment.save(
            update_fields=[
                "status",
                "updated_at"
            ]
        )

        return Response(
            {
                "ResultCode": 0,
                "ResultDesc": (
                    "Payment amount mismatch"
                )
            },
            status=status.HTTP_200_OK
        )

    # =====================================================
    # COMPLETE PAYMENT
    # =====================================================

    with transaction.atomic():

        payment = (
            Payment.objects
            .select_for_update()
            .select_related(
                "invoice",
                "tenant",
            )
            .get(
                pk=payment.pk
            )
        )

        # -------------------------------------------------
        # CHECK AGAINST DUPLICATE CALLBACK
        # -------------------------------------------------

        if payment.status == (
            Payment.Status.COMPLETED
        ):

            return Response(
                {
                    "ResultCode": 0,
                    "ResultDesc": (
                        "Payment already processed"
                    )
                },
                status=status.HTTP_200_OK
            )

        # -------------------------------------------------
        # LOCK INVOICE
        # -------------------------------------------------

        invoice = (
            RentInvoice.objects
            .select_for_update()
            .get(
                pk=payment.invoice_id
            )
        )

        # -------------------------------------------------
        # COMPLETE PAYMENT
        # -------------------------------------------------

        payment.status = (
            Payment.Status.COMPLETED
        )

        payment.payment_date = (
            timezone.now()
        )

        # IMPORTANT:
        # Keep the CheckoutRequestID in
        # checkout_request_id.
        #
        # Store the actual M-Pesa receipt
        # in transaction_reference.

        if mpesa_receipt:

            payment.transaction_reference = (
                str(mpesa_receipt)
            )

        if phone_number:

            payment.phone_number = str(
                phone_number
            )

        payment.save(
            update_fields=[
                "status",
                "payment_date",
                "transaction_reference",
                "phone_number",
                "updated_at"
            ]
        )

        # -------------------------------------------------
        # RECALCULATE TOTAL PAID
        # -------------------------------------------------

        total_paid = (
            invoice.payments
            .filter(
                status=Payment.Status.COMPLETED
            )
            .aggregate(
                total=Sum("amount")
            )["total"]
            or Decimal("0.00")
        )

        total_paid = Decimal(
            total_paid
        )

        invoice.amount_paid = (
            total_paid
        )

        # -------------------------------------------------
        # CALCULATE BALANCE
        # -------------------------------------------------

        balance = max(
            Decimal(invoice.amount_due)
            - total_paid,
            Decimal("0.00")
        )

        # -------------------------------------------------
        # UPDATE INVOICE STATUS
        # -------------------------------------------------

        if balance <= 0:

            invoice.status = (
                RentInvoice.Status.PAID
            )

        elif total_paid > 0:

            invoice.status = (
                RentInvoice.Status.PARTIAL
            )

        else:

            invoice.status = (
                RentInvoice.Status.UNPAID
            )

        invoice.save(
            update_fields=[
                "amount_paid",
                "status"
            ]
        )

    # =====================================================
    # SUCCESS LOG
    # =====================================================

    print("")
    print("==========================================")
    print("       M-PESA PAYMENT COMPLETED")
    print("==========================================")

    print(
        "Payment ID:",
        payment.id
    )

    print(
        "Checkout Request ID:",
        checkout_request_id
    )

    print(
        "Receipt:",
        mpesa_receipt
    )

    print(
        "Amount:",
        callback_amount_decimal
    )

    print(
        "Total Paid:",
        invoice.amount_paid
    )

    print(
        "Balance:",
        balance
    )

    print(
        "Invoice Status:",
        invoice.status
    )

    print("==========================================")
    print("")

    return Response(
        {
            "ResultCode": 0,
            "ResultDesc": (
                "Payment processed successfully"
            )
        },
        status=status.HTTP_200_OK
    )


# =========================================================
# PAYMENT VIEWSET
# =========================================================

class PaymentViewSet(
    viewsets.ModelViewSet
):

    serializer_class = PaymentSerializer
    permission_classes = [IsAccountant]

    def get_queryset(self):

        user = self.request.user

        queryset = (
            Payment.objects
            .select_related(
                "invoice",
                "invoice__lease",
                "invoice__lease__tenant",
                "invoice__lease__tenant__user",
                "invoice__lease__unit",
                "invoice__lease__unit__property",
                "tenant",
                "tenant__user",
            )
        )

        if user.role == "ADMIN":

            return queryset.all()

        return queryset.filter(
            invoice__lease__unit__property__company=(
                user.company
            )
        )

    # =====================================================
    # CREATE PAYMENT
    # =====================================================

    def perform_create(
        self,
        serializer
    ):

        invoice = (
            serializer.validated_data[
                "invoice"
            ]
        )

        tenant = (
            invoice.lease.tenant
        )

        serializer.save(
            tenant=tenant
        )

    # =====================================================
    # COMPLETE PAYMENT MANUALLY
    # =====================================================

    @action(
        detail=True,
        methods=["post"],
        url_path="complete"
    )
    def complete_payment(
        self,
        request,
        pk=None
    ):

        with transaction.atomic():

            payment = (
                Payment.objects
                .select_for_update()
                .select_related(
                    "invoice"
                )
                .get(
                    pk=pk
                )
            )

            # ---------------------------------------------
            # ALREADY COMPLETED
            # ---------------------------------------------

            if payment.status == (
                Payment.Status.COMPLETED
            ):

                return Response(
                    {
                        "message": (
                            "Payment is already "
                            "completed."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # ---------------------------------------------
            # FAILED / REVERSED
            # ---------------------------------------------

            if payment.status in [
                Payment.Status.FAILED,
                Payment.Status.REVERSED
            ]:

                return Response(
                    {
                        "error": (
                            f"Cannot complete a "
                            f"{payment.status.lower()} "
                            f"payment."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # ---------------------------------------------
            # LOCK INVOICE
            # ---------------------------------------------

            invoice = (
                RentInvoice.objects
                .select_for_update()
                .get(
                    pk=payment.invoice_id
                )
            )

            # ---------------------------------------------
            # CALCULATE CURRENT PAID AMOUNT
            # ---------------------------------------------

            total_paid = (
                invoice.payments
                .filter(
                    status=Payment.Status.COMPLETED
                )
                .exclude(
                    pk=payment.pk
                )
                .aggregate(
                    total=Sum("amount")
                )["total"]
                or Decimal("0.00")
            )

            total_paid = Decimal(
                total_paid
            )

            # ---------------------------------------------
            # CALCULATE OUTSTANDING BALANCE
            # ---------------------------------------------

            outstanding_balance = max(
                Decimal(invoice.amount_due)
                - total_paid,
                Decimal("0.00")
            )

            # ---------------------------------------------
            # PREVENT OVERPAYMENT
            # ---------------------------------------------

            if Decimal(
                payment.amount
            ) > outstanding_balance:

                return Response(
                    {
                        "error": (
                            "Payment cannot exceed "
                            "the remaining invoice "
                            "balance."
                        ),
                        "payment_amount": (
                            payment.amount
                        ),
                        "outstanding_balance": (
                            outstanding_balance
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # ---------------------------------------------
            # COMPLETE PAYMENT
            # ---------------------------------------------

            payment.status = (
                Payment.Status.COMPLETED
            )

            payment.payment_date = (
                timezone.now()
            )

            payment.save(
                update_fields=[
                    "status",
                    "payment_date",
                    "updated_at",
                ]
            )

            # ---------------------------------------------
            # RECALCULATE TOTAL
            # ---------------------------------------------

            total_paid = (
                invoice.payments
                .filter(
                    status=Payment.Status.COMPLETED
                )
                .aggregate(
                    total=Sum("amount")
                )["total"]
                or Decimal("0.00")
            )

            total_paid = Decimal(
                total_paid
            )

            invoice.amount_paid = (
                total_paid
            )

            # ---------------------------------------------
            # CALCULATE NEW BALANCE
            # ---------------------------------------------

            balance = max(
                Decimal(invoice.amount_due)
                - total_paid,
                Decimal("0.00")
            )

            # ---------------------------------------------
            # UPDATE STATUS
            # ---------------------------------------------

            if balance <= 0:

                invoice.status = (
                    RentInvoice.Status.PAID
                )

            elif total_paid > 0:

                invoice.status = (
                    RentInvoice.Status.PARTIAL
                )

            else:

                invoice.status = (
                    RentInvoice.Status.UNPAID
                )

            invoice.save(
                update_fields=[
                    "amount_paid",
                    "status",
                ]
            )

        return Response(
            {
                "message": (
                    "Payment completed successfully."
                ),

                "payment": PaymentSerializer(
                    payment,
                    context={
                        "request": request
                    }
                ).data,

                "invoice_status": (
                    invoice.status
                ),

                "amount_paid": (
                    invoice.amount_paid
                ),

                "balance": balance,
            },
            status=status.HTTP_200_OK
        )

    # =====================================================
    # M-PESA STK PUSH
    # =====================================================

    @action(
        detail=True,
        methods=["post"],
        url_path="mpesa"
    )
    def mpesa_payment(
        self,
        request,
        pk=None
    ):

        payment = self.get_object()

        # =================================================
        # CHECK PAYMENT STATUS
        # =================================================

        if payment.status == (
            Payment.Status.COMPLETED
        ):

            return Response(
                {
                    "error": (
                        "This payment is already "
                        "completed."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # =================================================
        # GET PHONE NUMBER
        # =================================================

        phone_number = (
            request.data.get(
                "phone_number"
            )
            or payment.phone_number
        )

        if not phone_number:

            return Response(
                {
                    "error": (
                        "Phone number is required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # =================================================
        # NORMALIZE PHONE NUMBER
        # =================================================

        try:

            phone_number = (
                normalize_phone_number(
                    phone_number
                )
            )

        except ValueError as error:

            return Response(
                {
                    "error": str(error)
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # =================================================
        # GET PAYMENT AMOUNT
        # =================================================

        try:

            amount = Decimal(
                payment.amount
            )

        except (
            TypeError,
            ValueError
        ):

            return Response(
                {
                    "error": (
                        "Invalid payment amount."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if amount <= 0:

            return Response(
                {
                    "error": (
                        "Payment amount must be "
                        "greater than zero."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # =================================================
        # GET INVOICE
        # =================================================

        invoice = payment.invoice

        # =================================================
        # CALCULATE REAL OUTSTANDING BALANCE
        # =================================================

        completed_total = (
            invoice.payments
            .filter(
                status=Payment.Status.COMPLETED
            )
            .exclude(
                pk=payment.pk
            )
            .aggregate(
                total=Sum("amount")
            )["total"]
            or Decimal("0.00")
        )

        completed_total = Decimal(
            completed_total
        )

        outstanding_balance = max(
            Decimal(invoice.amount_due)
            - completed_total,
            Decimal("0.00")
        )

        # =================================================
        # NO BALANCE
        # =================================================

        if outstanding_balance <= 0:

            return Response(
                {
                    "error": (
                        "This invoice has no "
                        "outstanding balance."
                    ),
                    "invoice": (
                        invoice.invoice_number
                    ),
                    "balance": 0
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # =================================================
        # PAYMENT TOO LARGE
        # =================================================

        if amount > outstanding_balance:

            return Response(
                {
                    "error": (
                        "Payment amount cannot be "
                        "greater than the "
                        "outstanding invoice balance."
                    ),

                    "payment_amount": amount,

                    "outstanding_balance": (
                        outstanding_balance
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # =================================================
        # SAVE PAYMENT BEFORE STK PUSH
        # =================================================

        payment.phone_number = (
            phone_number
        )

        payment.method = (
            Payment.Method.MPESA
        )

        payment.status = (
            Payment.Status.PENDING
        )

        # Clear old checkout ID before
        # creating a new STK request.

        payment.checkout_request_id = None

        payment.save(
            update_fields=[
                "phone_number",
                "method",
                "status",
                "checkout_request_id",
                "updated_at"
            ]
        )

        # =================================================
        # SEND STK PUSH
        # =================================================

        try:

            print("")
            print("==========================================")
            print("        STARTING M-PESA STK PUSH")
            print("==========================================")

            print(
                "Payment ID:",
                payment.id
            )

            print(
                "Invoice:",
                invoice.invoice_number
            )

            print(
                "Amount:",
                amount
            )

            print(
                "Phone:",
                phone_number
            )

            print("==========================================")

            mpesa_response = (
                MpesaService.stk_push(
                    phone_number=phone_number,
                    amount=amount,
                    account_reference=(
                        invoice.invoice_number
                    ),
                    transaction_desc=(
                        f"Rent payment "
                        f"{invoice.invoice_number}"
                    )
                )
            )

            print("")
            print(
                "========== M-PESA RESPONSE =========="
            )

            print(
                mpesa_response
            )

            print(
                "======================================"
            )

            print("")

        except Exception as error:

            print("")
            print("==========================================")
            print("         M-PESA STK PUSH ERROR")
            print("==========================================")

            print(
                "Error type:",
                type(error).__name__
            )

            print(
                "Error:",
                str(error)
            )

            print(
                "=========================================="
            )

            traceback.print_exc()

            payment.status = (
                Payment.Status.FAILED
            )

            payment.save(
                update_fields=[
                    "status",
                    "updated_at"
                ]
            )

            return Response(
                {
                    "error": (
                        "Unable to initiate "
                        "M-Pesa payment."
                    ),
                    "details": str(error)
                },
                status=status.HTTP_502_BAD_GATEWAY
            )

        # =================================================
        # CHECK DARAJA RESPONSE
        # =================================================

        response_code = (
            mpesa_response.get(
                "ResponseCode"
            )
        )

        if str(response_code) != "0":

            payment.status = (
                Payment.Status.FAILED
            )

            payment.save(
                update_fields=[
                    "status",
                    "updated_at"
                ]
            )

            return Response(
                {
                    "error": (
                        mpesa_response.get(
                            "ResponseDescription",
                            "M-Pesa request failed."
                        )
                    ),

                    "mpesa_response": (
                        mpesa_response
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # =================================================
        # GET REQUEST IDS
        # =================================================

        checkout_request_id = (
            mpesa_response.get(
                "CheckoutRequestID"
            )
        )

        merchant_request_id = (
            mpesa_response.get(
                "MerchantRequestID"
            )
        )

        # =================================================
        # CHECK CHECKOUT REQUEST ID
        # =================================================

        if not checkout_request_id:

            payment.status = (
                Payment.Status.FAILED
            )

            payment.save(
                update_fields=[
                    "status",
                    "updated_at"
                ]
            )

            return Response(
                {
                    "error": (
                        "M-Pesa did not return "
                        "a CheckoutRequestID."
                    ),

                    "mpesa_response": (
                        mpesa_response
                    )
                },
                status=status.HTTP_502_BAD_GATEWAY
            )

        # =================================================
        # STORE CHECKOUT REQUEST ID
        # =================================================

        payment.checkout_request_id = (
            checkout_request_id
        )

        payment.save(
            update_fields=[
                "checkout_request_id",
                "updated_at"
            ]
        )

        # =================================================
        # DEBUG CONFIRMATION
        # =================================================

        print("")
        print("==========================================")
        print("     CHECKOUT ID SAVED TO DATABASE")
        print("==========================================")

        print(
            "Payment ID:",
            payment.id
        )

        print(
            "CheckoutRequestID:",
            payment.checkout_request_id
        )

        print("==========================================")
        print("")

        # =================================================
        # SUCCESS RESPONSE
        # =================================================

        return Response(
            {
                "message": (
                    "M-Pesa payment request "
                    "sent successfully."
                ),

                "payment_id": payment.id,

                "invoice": (
                    invoice.invoice_number
                ),

                "amount": amount,

                "phone_number": phone_number,

                "merchant_request_id": (
                    merchant_request_id
                ),

                "checkout_request_id": (
                    checkout_request_id
                ),

                "customer_message": (
                    mpesa_response.get(
                        "CustomerMessage"
                    )
                ),

                "outstanding_balance": (
                    outstanding_balance
                ),
            },
            status=status.HTTP_200_OK
        )