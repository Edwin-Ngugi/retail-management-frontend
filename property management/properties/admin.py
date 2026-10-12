from django.contrib import admin
from .models import (
    Company,
    Property,
    Unit,
    PropertyOwner,
    PropertyOwnership,
    PropertyStaffAssignment,
    Tenant,
    Lease,
    RentInvoice,
    Payment,
)


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'phone', 'created_at')
    search_fields = ('name', 'email', 'phone')


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'company',
        'city',
        'category',
        'created_at',
    )
    list_filter = ('company', 'category', 'city')
    search_fields = ('name', 'city', 'address')


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = (
        'unit_number',
        'property',
        'unit_type',
        'monthly_rent',
        'status',
    )
    list_filter = ('status', 'unit_type', 'property__company')
    search_fields = (
        'unit_number',
        'property__name',
    )


@admin.register(PropertyOwner)
class PropertyOwnerAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'company',
        'national_id',
        'created_at',
    )
    search_fields = (
        'user__username',
        'user__first_name',
        'user__last_name',
        'user__email',
        'national_id',
    )


@admin.register(PropertyOwnership)
class PropertyOwnershipAdmin(admin.ModelAdmin):
    list_display = (
        'owner',
        'property',
        'ownership_percentage',
    )
    list_filter = ('property',)


@admin.register(PropertyStaffAssignment)
class PropertyStaffAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'property',
        'role',
        'assigned_at',
    )
    list_filter = ('role', 'property')
    search_fields = (
        'user__username',
        'user__first_name',
        'user__last_name',
        'property__name',
    )


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'company',
        'national_id',
        'phone',
        'created_at',
    )
    search_fields = (
        'user__username',
        'user__first_name',
        'user__last_name',
        'national_id',
        'phone',
    )
    list_filter = (
        'company',
    )


@admin.register(Lease)
class LeaseAdmin(admin.ModelAdmin):
    list_display = (
        'tenant',
        'unit',
        'start_date',
        'end_date',
        'monthly_rent',
        'status',
    )
    list_filter = (
        'status',
        'unit__property',
    )
    search_fields = (
        'tenant__user__username',
        'tenant__user__first_name',
        'tenant__user__last_name',
        'unit__unit_number',
        'unit__property__name',
    )


@admin.register(RentInvoice)
class RentInvoiceAdmin(admin.ModelAdmin):
    list_display = (
        'invoice_number',
        'get_tenant',
        'billing_month',
        'amount_due',
        'amount_paid',
        'status',
        'due_date',
    )
    list_filter = (
        'status',
        'billing_month',
        'due_date',
    )
    search_fields = (
        'invoice_number',
        'lease__tenant__user__username',
        'lease__tenant__user__first_name',
        'lease__tenant__user__last_name',
    )

    def get_tenant(self, obj):
        return (
            obj.lease.tenant.user.get_full_name()
            or obj.lease.tenant.user.username
        )

    get_tenant.short_description = 'Tenant'


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        'tenant',
        'invoice',
        'amount',
        'method',
        'status',
        'transaction_reference',
        'payment_date',
    )
    list_filter = (
        'method',
        'status',
        'payment_date',
    )
    search_fields = (
        'transaction_reference',
        'tenant__user__username',
        'tenant__user__first_name',
        'tenant__user__last_name',
    )
    readonly_fields = (
        'created_at',
        'updated_at',
    )