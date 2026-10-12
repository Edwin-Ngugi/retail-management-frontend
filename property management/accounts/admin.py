from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):

    fieldsets = UserAdmin.fieldsets + (
        (
            'Property Management Information',
            {
                'fields': (
                    'company',
                    'role',
                    'phone',
                )
            }
        ),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        (
            'Property Management Information',
            {
                'fields': (
                    'company',
                    'role',
                    'phone',
                )
            }
        ),
    )

    list_display = (
        'username',
        'email',
        'first_name',
        'last_name',
        'role',
        'company',
        'is_active',
    )

    list_filter = (
        'role',
        'company',
        'is_active',
    )

    search_fields = (
        'username',
        'first_name',
        'last_name',
        'email',
    ) 