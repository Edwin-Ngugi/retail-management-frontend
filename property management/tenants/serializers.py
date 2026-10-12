from rest_framework import serializers

from properties.models import (
    Tenant,
    Lease,
    RentInvoice,
    Payment,
)


class TenantProfileSerializer(serializers.ModelSerializer):

    username = serializers.CharField(
        source="user.username",
        read_only=True
    )

    full_name = serializers.SerializerMethodField()

    email = serializers.EmailField(
        source="user.email",
        read_only=True
    )

    class Meta:
        model = Tenant

        fields = [
            "id",
            "username",
            "full_name",
            "email",
            "national_id",
            "phone",
            "emergency_contact_name",
            "emergency_contact_phone",
        ]

    def get_full_name(self, obj):

        return (
            obj.user.get_full_name()
            or obj.user.username
        )


class TenantLeaseSerializer(serializers.ModelSerializer):

    property_name = serializers.CharField(
        source="unit.property.name",
        read_only=True
    )

    property_address = serializers.CharField(
        source="unit.property.address",
        read_only=True
    )

    city = serializers.CharField(
        source="unit.property.city",
        read_only=True
    )

    unit_number = serializers.CharField(
        source="unit.unit_number",
        read_only=True
    )

    floor = serializers.CharField(
        source="unit.floor",
        read_only=True
    )

    unit_type = serializers.CharField(
        source="unit.unit_type",
        read_only=True
    )

    class Meta:
        model = Lease

        fields = [
            "id",
            "property_name",
            "property_address",
            "city",
            "unit_number",
            "floor",
            "unit_type",
            "start_date",
            "end_date",
            "monthly_rent",
            "status",
        ]


class TenantInvoiceSerializer(serializers.ModelSerializer):

    property_name = serializers.CharField(
        source="lease.unit.property.name",
        read_only=True
    )

    unit_number = serializers.CharField(
        source="lease.unit.unit_number",
        read_only=True
    )

    balance = serializers.ReadOnlyField()

    class Meta:
        model = RentInvoice

        fields = [
            "id",
            "invoice_number",
            "property_name",
            "unit_number",
            "billing_month",
            "due_date",
            "amount_due",
            "amount_paid",
            "balance",
            "status",
        ]


class TenantPaymentSerializer(serializers.ModelSerializer):

    invoice_number = serializers.CharField(
        source="invoice.invoice_number",
        read_only=True
    )

    class Meta:
        model = Payment

        fields = [
            "id",
            "invoice",
            "invoice_number",
            "amount",
            "method",
            "status",
            "transaction_reference",
            "phone_number",
            "payment_date",
            "created_at",
        ]