from django import forms
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from properties.models import Tenant, Unit, Property, Lease

User = get_user_model()


class TenantSelfRegistrationForm(forms.ModelForm):

    # ==========================================================
    # USER INFORMATION
    # ==========================================================

    first_name = forms.CharField(
        max_length=50,
        required=True,
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "First Name",
            "autocomplete": "given-name",
        })
    )

    last_name = forms.CharField(
        max_length=50,
        required=True,
        widget=forms.TextInput(attrs={
            "class": "form-control",
            "placeholder": "Last Name",
            "autocomplete": "family-name",
        })
    )

    email = forms.EmailField(
        required=True,
        widget=forms.EmailInput(attrs={
            "class": "form-control",
            "placeholder": "Email Address",
            "autocomplete": "email",
        })
    )

    # ==========================================================
    # PROPERTY
    # ==========================================================

    property_obj = forms.ModelChoiceField(
        queryset=Property.objects.all(),
        required=True,
        empty_label="Select Property",
        widget=forms.Select(attrs={
            "class": "form-control",
        })
    )

    # ==========================================================
    # PASSWORD
    # ==========================================================

    password = forms.CharField(
        required=True,
        widget=forms.PasswordInput(attrs={
            "class": "form-control",
            "placeholder": "Password",
            "autocomplete": "new-password",
        })
    )

    confirm_password = forms.CharField(
        required=True,
        widget=forms.PasswordInput(attrs={
            "class": "form-control",
            "placeholder": "Confirm Password",
            "autocomplete": "new-password",
        })
    )

    class Meta:
        model = Tenant
        fields = [
            "national_id",
            "phone",
            "unit",
            "unit_type",
            "emergency_contact_name",
            "emergency_contact_phone",
        ]
        widgets = {
            "national_id": forms.TextInput(attrs={
                "class": "form-control",
                "placeholder": "National ID / Passport Number",
            }),
            "phone": forms.TextInput(attrs={
                "class": "form-control",
                "placeholder": "Phone Number",
                "autocomplete": "tel",
            }),
            "unit": forms.Select(attrs={
                "class": "form-control",
            }),
            "unit_type": forms.Select(attrs={
                "class": "form-control",
            }),
            "emergency_contact_name": forms.TextInput(attrs={
                "class": "form-control",
                "placeholder": "Emergency Contact Name",
            }),
            "emergency_contact_phone": forms.TextInput(attrs={
                "class": "form-control",
                "placeholder": "Emergency Contact Phone",
            }),
        }

    # ==========================================================
    # INITIALIZATION
    # ==========================================================

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Ensure unit select starts empty for AJAX / dynamic filtering
        self.fields["unit"].queryset = Unit.objects.none()
        self.fields["unit"].empty_label = "Select Unit"

        # If property was submitted via POST, populate vacant units
        property_id = self.data.get("property_obj")

        if property_id:
            try:
                self.fields["unit"].queryset = Unit.objects.filter(
                    property_id=property_id,
                    status=Unit.Status.VACANT
                ).order_by("unit_number")
            except (ValueError, TypeError):
                self.fields["unit"].queryset = Unit.objects.none()

    # ==========================================================
    # EMAIL VALIDATION
    # ==========================================================

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()

        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError(
                "A user with this email address already exists."
            )

        return email

    # ==========================================================
    # NATIONAL ID VALIDATION
    # ==========================================================

    def clean_national_id(self):
        national_id = self.cleaned_data["national_id"].strip()

        if Tenant.objects.filter(
            national_id__iexact=national_id
        ).exists():
            raise forms.ValidationError(
                "A tenant with this National ID already exists."
            )

        return national_id

    # ==========================================================
    # PROPERTY / UNIT / PASSWORD VALIDATION
    # ==========================================================

    def clean(self):
        cleaned_data = super().clean()

        password = cleaned_data.get("password")
        confirm_password = cleaned_data.get("confirm_password")
        property_obj = cleaned_data.get("property_obj")
        unit = cleaned_data.get("unit")

        # Password matching check
        if password and confirm_password and password != confirm_password:
            self.add_error("confirm_password", "Passwords do not match.")

        # Unit ownership check
        if property_obj and unit:
            if unit.property_id != property_obj.id:
                self.add_error(
                    "unit",
                    "The selected unit does not belong to the selected property."
                )

        # Vacancy check
        if unit and unit.status != Unit.Status.VACANT:
            self.add_error(
                "unit",
                "This unit is no longer vacant. Please select another unit."
            )

        return cleaned_data

    # ==========================================================
    # SAVE
    # ==========================================================

    @transaction.atomic
    def save(self, commit=True):
        email = self.cleaned_data["email"]
        property_obj = self.cleaned_data["property_obj"]
        unit = self.cleaned_data["unit"]

        # Optional: check if User model has custom fields like 'role' or 'company'
        user_kwargs = {
            "username": email,
            "email": email,
            "password": self.cleaned_data["password"],
            "first_name": self.cleaned_data["first_name"],
            "last_name": self.cleaned_data["last_name"],
        }
        if hasattr(User, "role"):
            user_kwargs["role"] = "TENANT"
        if hasattr(User, "company"):
            user_kwargs["company"] = property_obj.company

        user = User.objects.create_user(**user_kwargs)

        # Create Tenant Profile connected to Unit and UnitType
        tenant = Tenant.objects.create(
            user=user,
            company=property_obj.company,
            unit=unit,
            unit_type=self.cleaned_data.get("unit_type") or (unit.unit_type if unit else None),
            national_id=self.cleaned_data["national_id"],
            phone=self.cleaned_data["phone"],
            emergency_contact_name=self.cleaned_data.get("emergency_contact_name", ""),
            emergency_contact_phone=self.cleaned_data.get("emergency_contact_phone", ""),
        )

        # Update unit status
        if unit:
            unit.status = Unit.Status.OCCUPIED
            unit.save(update_fields=["status"])

            # Create initial Active/Pending Lease
            today = timezone.localdate()
            Lease.objects.create(
                tenant=tenant,
                unit=unit,
                start_date=today,
                end_date=today.replace(year=today.year + 1),
                monthly_rent=unit.monthly_rent,
                status=Lease.Status.ACTIVE,
            )

        # Returns user instance so `login(self.request, user)` in views works directly
        return user