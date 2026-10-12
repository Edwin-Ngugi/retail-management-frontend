from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Company(models.Model):
    name = models.CharField(max_length=200)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    address = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class PropertyCategory(models.TextChoices):
    RESIDENTIAL = "RESIDENTIAL", "Residential"
    COMMERCIAL = "COMMERCIAL", "Commercial"
    MIXED_USE = "MIXED_USE", "Mixed Use"
    INDUSTRIAL = "INDUSTRIAL", "Industrial"


class UnitType(models.TextChoices):
    BEDSITTER = "BEDSITTER", "Bedsitter"
    STUDIO = "STUDIO", "Studio"
    SINGLE_ROOM = "SINGLE_ROOM", "Single Room"
    ONE_BEDROOM = "ONE_BEDROOM", "1 Bedroom"
    TWO_BEDROOM = "TWO_BEDROOM", "2 Bedroom"
    THREE_BEDROOM = "THREE_BEDROOM", "3 Bedroom"
    COMMERCIAL_ROOM = "COMMERCIAL_ROOM", "Commercial Room"
    SHOP = "SHOP", "Shop"
    OFFICE = "OFFICE", "Office"
    WAREHOUSE = "WAREHOUSE", "Warehouse"
    OTHER = "OTHER", "Other"


class Property(models.Model):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="properties"
    )

    name = models.CharField(max_length=200)
    image = models.ImageField(upload_to="properties/", blank=True, null=True)
    address = models.TextField()
    city = models.CharField(max_length=100)

    category = models.CharField(
        max_length=30,
        choices=PropertyCategory.choices,
        default=PropertyCategory.RESIDENTIAL
    )

    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    def get_unit_types_summary(self):
        grouped = (
            self.units.values("unit_type")
            .annotate(count=models.Count("id"))
            .order_by("-count")
        )
        choices_dict = dict(UnitType.choices)
        return [
            {
                "unit_type": item["unit_type"],
                "label": choices_dict.get(item["unit_type"], item["unit_type"]),
                "count": item["count"]
            }
            for item in grouped
        ]

    @property
    def min_rent(self):
        return self.units.aggregate(min_val=models.Min("monthly_rent"))["min_val"] or Decimal("0.00")


class Unit(models.Model):

    class Status(models.TextChoices):
        VACANT = "VACANT", "Vacant"
        OCCUPIED = "OCCUPIED", "Occupied"
        MAINTENANCE = "MAINTENANCE", "Maintenance"
        RESERVED = "RESERVED", "Reserved"

    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="units"
    )

    unit_number = models.CharField(max_length=50)
    floor = models.CharField(max_length=50, blank=True)

    unit_type = models.CharField(
        max_length=30,
        choices=UnitType.choices,
        default=UnitType.ONE_BEDROOM
    )

    monthly_rent = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.VACANT
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("property", "unit_number")

    def __str__(self):
        return f"{self.property.name} - {self.unit_number}"


class PropertyOwner(models.Model):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="property_owners"
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owner_profile"
    )

    national_id = models.CharField(
        max_length=50,
        blank=True
    )

    address = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.user.get_full_name() or self.user.username


class PropertyOwnership(models.Model):
    owner = models.ForeignKey(
        PropertyOwner,
        on_delete=models.CASCADE,
        related_name="ownerships"
    )

    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="ownerships"
    )

    ownership_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=100
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("owner", "property")

    def __str__(self):
        return f"{self.owner} - {self.property} ({self.ownership_percentage}%)"


class PropertyStaffAssignment(models.Model):

    class AssignmentRole(models.TextChoices):
        PROPERTY_MANAGER = "PROPERTY_MANAGER", "Property Manager"
        CARETAKER = "CARETAKER", "Caretaker"

    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="staff_assignments"
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="property_assignments"
    )

    role = models.CharField(
        max_length=30,
        choices=AssignmentRole.choices
    )

    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("property", "user", "role")

    def __str__(self):
        return f"{self.user} - {self.property} - {self.role}"


class Tenant(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tenant_profile"
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="tenants"
    )

    unit = models.ForeignKey(
        Unit,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tenants"
    )

    unit_type = models.CharField(
        max_length=50,
        choices=UnitType.choices,
        blank=True,
        null=True
    )

    national_id = models.CharField(
        max_length=50,
        unique=True
    )

    phone = models.CharField(
        max_length=20
    )

    emergency_contact_name = models.CharField(
        max_length=100,
        blank=True
    )

    emergency_contact_phone = models.CharField(
        max_length=20,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        unit_str = self.unit.unit_number if self.unit else "N/A"
        return f"{self.user.get_full_name() or self.user.username} - Unit {unit_str}"


class Lease(models.Model):

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        EXPIRED = "EXPIRED", "Expired"
        TERMINATED = "TERMINATED", "Terminated"
        PENDING = "PENDING", "Pending"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="leases"
    )

    unit = models.ForeignKey(
        Unit,
        on_delete=models.CASCADE,
        related_name="leases"
    )

    start_date = models.DateField()
    end_date = models.DateField()

    monthly_rent = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    security_deposit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if self.end_date and self.start_date and self.end_date <= self.start_date:
            raise ValidationError("Lease end date must be after the start date.")

        if self.tenant_id and self.unit_id:
            if self.tenant.company_id != self.unit.property.company_id:
                raise ValidationError("Tenant and unit must belong to the same company.")

        if self.status == self.Status.ACTIVE:
            existing = Lease.objects.filter(
                unit=self.unit,
                status=self.Status.ACTIVE
            ).exclude(pk=self.pk)

            if existing.exists():
                raise ValidationError("This unit already has an active lease.")

            tenant_active_lease = Lease.objects.filter(
                tenant=self.tenant,
                status=self.Status.ACTIVE
            ).exclude(pk=self.pk)

            if tenant_active_lease.exists():
                raise ValidationError("This tenant already has an active lease.")

    def __str__(self):
        return f"{self.tenant} - {self.unit.property.name} {self.unit.unit_number}"


class VacationRequest(models.Model):

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending Review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"

    lease = models.ForeignKey(
        Lease,
        on_delete=models.CASCADE,
        related_name="vacation_requests"
    )

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="vacation_requests"
    )

    vacate_date = models.DateField()
    reason = models.TextField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    admin_notes = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def clean(self):
        if self.vacate_date and self.vacate_date < timezone.localdate():
            raise ValidationError("The proposed vacate date cannot be in the past.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Vacation Request ({self.status}) - {self.tenant} for {self.vacate_date}"


class RentInvoice(models.Model):

    class Status(models.TextChoices):
        UNPAID = "UNPAID", "Unpaid"
        PARTIAL = "PARTIAL", "Partially Paid"
        PAID = "PAID", "Paid"
        OVERDUE = "OVERDUE", "Overdue"
        CANCELLED = "CANCELLED", "Cancelled"

    lease = models.ForeignKey(
        Lease,
        on_delete=models.CASCADE,
        related_name="invoices"
    )

    invoice_number = models.CharField(
        max_length=50,
        unique=True
    )

    billing_month = models.DateField(
        help_text="Use the first day of the billing month."
    )

    due_date = models.DateField()

    amount_due = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    amount_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.UNPAID
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-billing_month"]
        constraints = [
            models.UniqueConstraint(
                fields=["lease", "billing_month"],
                name="unique_invoice_per_lease_month"
            )
        ]

    @property
    def tenant(self):
        return self.lease.tenant

    @property
    def unit(self):
        return self.lease.unit

    @property
    def property_obj(self):
        return self.lease.unit.property

    @property
    def company(self):
        return self.lease.unit.property.company

    @property
    def amount(self):
        return self.amount_due

    @property
    def balance(self):
        balance = self.amount_due - self.amount_paid
        return max(balance, Decimal("0.00"))

    @property
    def is_fully_paid(self):
        return self.amount_paid >= self.amount_due

    @property
    def is_partially_paid(self):
        return 0 < self.amount_paid < self.amount_due

    @property
    def is_overdue(self):
        if self.status in {self.Status.PAID, self.Status.CANCELLED}:
            return False

        return self.due_date < timezone.localdate() and self.balance > 0

    def update_status(self):
        if self.status == self.Status.CANCELLED:
            return

        if self.amount_paid >= self.amount_due:
            self.status = self.Status.PAID
        elif self.amount_paid > 0:
            self.status = self.Status.PARTIAL
        elif self.due_date < timezone.localdate():
            self.status = self.Status.OVERDUE
        else:
            self.status = self.Status.UNPAID

        self.save(
            update_fields=[
                "amount_paid",
                "status",
                "updated_at",
            ]
        )

    @property
    def transaction_code(self):
        payment = self.payments.filter(
            status__in=[Payment.Status.COMPLETED, Payment.Status.PARTIAL]
        ).last()

        if payment:
            return (
                payment.mpesa_receipt_number 
                or payment.transaction_reference 
                or f"PAY-{payment.id}"
            )
        return "NO-TRANSACTION"    

    def save(self, *args, **kwargs):
        if self.amount_due < 0:
            raise ValidationError("Invoice amount cannot be negative.")

        if self.amount_paid < 0:
            raise ValidationError("Amount paid cannot be negative.")

        if self.amount_paid > self.amount_due:
            raise ValidationError("Amount paid cannot exceed the invoice amount.")

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.invoice_number} - {self.lease.tenant}"


class Payment(models.Model):

    class Method(models.TextChoices):
        MPESA = "MPESA", "M-Pesa"
        CASH = "CASH", "Cash"
        BANK = "BANK", "Bank Transfer"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"
        REVERSED = "REVERSED", "Reversed"

    invoice = models.ForeignKey(
        RentInvoice,
        on_delete=models.PROTECT,
        related_name="payments"
    )

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="payments"
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    method = models.CharField(
        max_length=20,
        choices=Method.choices
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    transaction_reference = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True
    )

    checkout_request_id = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True
    )

    merchant_request_id = models.CharField(
        max_length=100,
        blank=True
    )

    mpesa_receipt_number = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True
    )

    phone_number = models.CharField(
        max_length=20,
        blank=True
    )

    payment_date = models.DateTimeField(
        null=True,
        blank=True
    )

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if self.amount <= 0:
            raise ValidationError("Payment amount must be greater than zero.")

        if self.invoice_id and self.tenant_id:
            if self.invoice.lease.tenant_id != self.tenant_id:
                raise ValidationError("The selected tenant does not belong to this invoice.")

        if self.status != self.Status.COMPLETED:
            return

        existing_payments = Payment.objects.filter(
            invoice=self.invoice,
            status=self.Status.COMPLETED
        ).exclude(pk=self.pk)

        already_paid = (
            existing_payments.aggregate(
                total=models.Sum("amount")
            )["total"] or Decimal("0.00")
        )

        remaining_balance = self.invoice.amount_due - already_paid

        if self.amount > remaining_balance:
            raise ValidationError(
                f"Payment cannot exceed the remaining balance of KSh {remaining_balance}."
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
        self.update_invoice()

    def update_invoice(self):
        total_paid = (
            Payment.objects.filter(
                invoice=self.invoice,
                status=self.Status.COMPLETED
            ).aggregate(
                total=models.Sum("amount")
            )["total"] or Decimal("0.00")
        )

        self.invoice.amount_paid = total_paid
        self.invoice.update_status()

    def delete(self, *args, **kwargs):
        invoice = self.invoice
        super().delete(*args, **kwargs)
        
        total_paid = (
            Payment.objects.filter(
                invoice=invoice,
                status=Payment.Status.COMPLETED
            ).aggregate(
                total=models.Sum("amount")
            )["total"] or Decimal("0.00")
        )
        invoice.amount_paid = total_paid
        invoice.update_status()

    def __str__(self):
        return f"{self.invoice.invoice_number} - {self.amount} - {self.tenant} - {self.status}"


class Expense(models.Model):

    class Category(models.TextChoices):
        MAINTENANCE = "MAINTENANCE", "Maintenance"
        UTILITIES = "UTILITIES", "Utilities"
        SECURITY = "SECURITY", "Security"
        CLEANING = "CLEANING", "Cleaning"
        STAFF = "STAFF", "Staff"
        TAXES = "TAXES", "Taxes"
        INSURANCE = "INSURANCE", "Insurance"
        REPAIRS = "REPAIRS", "Repairs"
        MANAGEMENT = "MANAGEMENT", "Management"
        MARKETING = "MARKETING", "Marketing"
        LEGAL = "LEGAL", "Legal"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PAID = "PAID", "Paid"
        CANCELLED = "CANCELLED", "Cancelled"

    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="expenses"
    )

    title = models.CharField(
        max_length=200,
        blank=True
    )

    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        default=Category.OTHER
    )

    description = models.TextField(blank=True)

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    expense_date = models.DateField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    vendor = models.CharField(
        max_length=200,
        blank=True
    )

    reference_number = models.CharField(
        max_length=100,
        blank=True
    )

    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorded_property_expenses"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-expense_date", "-created_at"]

    def clean(self):
        if self.amount <= 0:
            raise ValidationError("Expense amount must be greater than zero.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        display_name = self.title if self.title else self.category
        return f"{self.property.name} - {display_name} - KSh {self.amount:,.2f}"