from rest_framework import serializers

from properties.models import (
    Company,
    Property,
    Unit,
)


class CompanySerializer(serializers.ModelSerializer):

    class Meta:
        model = Company
        fields = [
            'id',
            'name',
            'email',
            'phone',
            'address',
            'created_at',
            'updated_at',
        ]


class PropertySerializer(serializers.ModelSerializer):

    company_name = serializers.CharField(
        source='company.name',
        read_only=True
    )

    class Meta:
        model = Property

        fields = [
            'id',
            'company',
            'company_name',
            'name',
            'address',
            'city',
            'property_type',
            'description',
            'created_at',
            'updated_at',
        ]


class UnitSerializer(serializers.ModelSerializer):

    property_name = serializers.CharField(
        source='property.name',
        read_only=True
    )

    class Meta:
        model = Unit

        fields = [
            'id',
            'property',
            'property_name',
            'unit_number',
            'floor',
            'unit_type',
            'monthly_rent',
            'status',
            'created_at',
        ]

from properties.models import (
    Company,
    Property,
    Unit,
    Tenant,
    Lease,
)

class TenantSerializer(serializers.ModelSerializer):

    username = serializers.CharField(
        source='user.username',
        read_only=True
    )

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Tenant

        fields = [
            'id',
            'user',
            'username',
            'full_name',
            'company',
            'national_id',
            'phone',
            'emergency_contact_name',
            'emergency_contact_phone',
            'created_at',
            'updated_at',
        ]

        read_only_fields = [
            'created_at',
            'updated_at',
        ]

    def get_full_name(self, obj):

        return (
            obj.user.get_full_name()
            or obj.user.username
        )


class LeaseSerializer(serializers.ModelSerializer):

    tenant_name = serializers.SerializerMethodField()

    property_name = serializers.CharField(
        source='unit.property.name',
        read_only=True
    )

    unit_number = serializers.CharField(
        source='unit.unit_number',
        read_only=True
    )

    class Meta:
        model = Lease

        fields = [
            'id',
            'tenant',
            'tenant_name',
            'unit',
            'unit_number',
            'property_name',
            'start_date',
            'end_date',
            'monthly_rent',
            'security_deposit',
            'status',
            'created_at',
            'updated_at',
        ]

        read_only_fields = [
            'created_at',
            'updated_at',
        ]

    def get_tenant_name(self, obj):

        return (
            obj.tenant.user.get_full_name()
            or obj.tenant.user.username
        )

    def validate(self, data):

        tenant = data.get('tenant')
        unit = data.get('unit')
        status = data.get(
            'status',
            Lease.Status.PENDING
        )

        if tenant and unit:

            if tenant.company_id != unit.property.company_id:

                raise serializers.ValidationError(
                    'Tenant and unit must belong to the same company.'
                )

        if status == Lease.Status.ACTIVE:

            existing_unit_lease = Lease.objects.filter(
                unit=unit,
                status=Lease.Status.ACTIVE
            )

            if self.instance:
                existing_unit_lease = existing_unit_lease.exclude(
                    pk=self.instance.pk
                )

            if existing_unit_lease.exists():

                raise serializers.ValidationError(
                    'This unit already has an active lease.'
                )

            existing_tenant_lease = Lease.objects.filter(
                tenant=tenant,
                status=Lease.Status.ACTIVE
            )

            if self.instance:
                existing_tenant_lease = existing_tenant_lease.exclude(
                    pk=self.instance.pk
                )

            if existing_tenant_lease.exists():

                raise serializers.ValidationError(
                    'This tenant already has an active lease.'
                )

        return data

from properties.models import (
    Company,
    Property,
    Unit,
    Tenant,
    Lease,
    RentInvoice,
    Payment,
)

class RentInvoiceSerializer(serializers.ModelSerializer):

    tenant_name = serializers.SerializerMethodField()
    property_name = serializers.CharField(
        source='lease.unit.property.name',
        read_only=True
    )
    unit_number = serializers.CharField(
        source='lease.unit.unit_number',
        read_only=True
    )
    balance = serializers.ReadOnlyField()

    class Meta:
        model = RentInvoice

        fields = [
            'id',
            'invoice_number',
            'lease',
            'tenant_name',
            'property_name',
            'unit_number',
            'billing_month',
            'due_date',
            'amount_due',
            'amount_paid',
            'balance',
            'status',
            'created_at',
            'updated_at',
        ]

        read_only_fields = [
            'amount_paid',
            'status',
            'created_at',
            'updated_at',
        ]

    def get_tenant_name(self, obj):

        return (
            obj.lease.tenant.user.get_full_name()
            or obj.lease.tenant.user.username
        )

class PaymentSerializer(serializers.ModelSerializer):

    tenant = serializers.PrimaryKeyRelatedField(
        read_only=True
    )

    invoice_number = serializers.CharField(
        source='invoice.invoice_number',
        read_only=True
    )

    tenant_name = serializers.SerializerMethodField()

    balance = serializers.SerializerMethodField()

    class Meta:
        model = Payment

        fields = [
            'id',
            'invoice',
            'invoice_number',
            'tenant',
            'tenant_name',
            'amount',
            'method',
            'status',
            'transaction_reference',
            'phone_number',
            'payment_date',
            'notes',
            'balance',
            'created_at',
            'updated_at',
        ]

        read_only_fields = [
            'id',
            'tenant',
            'invoice_number',
            'tenant_name',
            'balance',
            'status',
            'payment_date',
            'created_at',
            'updated_at',
        ]

    def get_tenant_name(self, obj):
        return (
            obj.tenant.user.get_full_name()
            or obj.tenant.user.username
        )

    def get_balance(self, obj):
        return obj.invoice.balance

    def validate(self, data):

        invoice = data.get('invoice')
        amount = data.get('amount')

        if not invoice:
            raise serializers.ValidationError({
                'invoice': 'Invoice is required.'
            })

        if not amount or amount <= 0:
            raise serializers.ValidationError({
                'amount': 'Payment amount must be greater than zero.'
            })

        remaining_balance = invoice.balance

        if remaining_balance <= 0:
            raise serializers.ValidationError({
                'invoice': 'This invoice has no outstanding balance.'
            })

        if amount > remaining_balance:
            raise serializers.ValidationError({
                'amount': (
                    f'Payment cannot exceed the remaining '
                    f'balance of KSh {remaining_balance:.2f}.'
                )
            })

        return data                