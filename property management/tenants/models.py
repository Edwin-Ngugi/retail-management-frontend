from django.db import models


class MaintenanceRequest(models.Model):

    class Category(models.TextChoices):
        PLUMBING = "PLUMBING", "Plumbing"
        ELECTRICAL = "ELECTRICAL", "Electrical"
        APPLIANCE = "APPLIANCE", "Appliance"
        STRUCTURAL = "STRUCTURAL", "Structural"
        SECURITY = "SECURITY", "Security"
        OTHER = "OTHER", "Other"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        RESOLVED = "RESOLVED", "Resolved"
        CANCELLED = "CANCELLED", "Cancelled"

    tenant = models.ForeignKey(
        "properties.Tenant",
        on_delete=models.CASCADE,
        related_name="maintenance_requests",
    )

    unit = models.ForeignKey(
        "properties.Unit",
        on_delete=models.CASCADE,
        related_name="maintenance_requests",
    )

    title = models.CharField(
        max_length=150
    )

    description = models.TextField()

    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.OTHER,
    )

    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    reported_at = models.DateTimeField(
        auto_now_add=True
    )

    resolved_at = models.DateTimeField(
        null=True,
        blank=True
    )

    manager_notes = models.TextField(
        blank=True,
        null=True
    )

    class Meta:
        ordering = ["-reported_at"]

    def __str__(self):
        return f"{self.title} - {self.tenant}"

