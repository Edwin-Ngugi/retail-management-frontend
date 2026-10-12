from django.contrib import admin

from .models import MaintenanceRequest


@admin.register(MaintenanceRequest)
class MaintenanceRequestAdmin(admin.ModelAdmin):

    list_display = (
        "title",
        "tenant",
        "unit",
        "category",
        "priority",
        "status",
        "reported_at",
        "resolved_at",
    )

    list_filter = (
        "status",
        "priority",
        "category",
        "reported_at",
    )

    search_fields = (
        "title",
        "description",
        "tenant__user__username",
        "tenant__user__first_name",
        "tenant__user__last_name",
        "tenant__phone",
        "unit__unit_number",
    )

    readonly_fields = (
        "reported_at",
    )

    ordering = (
        "-reported_at",
 )

