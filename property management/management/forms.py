from django import forms
from properties.models import RentInvoice, Lease, Property

class SingleInvoiceForm(forms.ModelForm):
    class Meta:
        model = RentInvoice
        # Removed 'description' to match your RentInvoice model fields
        fields = ["lease", "billing_month", "amount_due", "due_date", "status"]
        widgets = {
            "lease": forms.Select(attrs={"class": "form-select"}),
            "billing_month": forms.DateInput(attrs={"class": "form-control", "type": "date"}),
            "amount_due": forms.NumberInput(attrs={"class": "form-control", "step": "0.01"}),
            "due_date": forms.DateInput(attrs={"class": "form-control", "type": "date"}),
            "status": forms.Select(attrs={"class": "form-select"}),
        }

    def __init__(self, *args, **kwargs):
        user_properties = kwargs.pop("user_properties", None)
        super().__init__(*args, **kwargs)
        if user_properties is not None:
            self.fields["lease"].queryset = Lease.objects.filter(
                unit__property__in=user_properties,
                status=Lease.Status.ACTIVE
            ).select_related("unit", "tenant")


class BulkInvoiceGenerationForm(forms.Form):
    property = forms.ModelChoiceField(
        queryset=Property.objects.none(),
        widget=forms.Select(attrs={"class": "form-select"}),
        empty_label="Select Property"
    )
    billing_date = forms.DateField(
        widget=forms.DateInput(attrs={"class": "form-control", "type": "date"}),
        help_text="The start date of the billing cycle (e.g. 2026-09-01)"
    )
    due_date = forms.DateField(
        widget=forms.DateInput(attrs={"class": "form-control", "type": "date"}),
        help_text="Invoice payment deadline"
    )

    def __init__(self, *args, **kwargs):
        user_properties = kwargs.pop("user_properties", None)
        super().__init__(*args, **kwargs)
        if user_properties is not None:
            self.fields["property"].queryset = user_properties