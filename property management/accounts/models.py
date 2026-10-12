from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):

    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        PROPERTY_MANAGER = 'PROPERTY_MANAGER', 'Property Manager'
        ACCOUNTANT = 'ACCOUNTANT', 'Accountant'
        CARETAKER = 'CARETAKER', 'Caretaker'
        TENANT = 'TENANT', 'Tenant'
        OWNER = 'OWNER', 'Property Owner'

    company = models.ForeignKey(
        'properties.Company',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )

    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.TENANT
    )

    phone = models.CharField(
        max_length=20,
        blank=True
    )

    def __str__(self):
        return self.username