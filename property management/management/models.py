from django.db import models
from django.conf import settings

class Property(models.Model):
    name = models.CharField(max_length=200)
    address = models.TextField()
    units = models.IntegerField(default=1)

class PropertyReport(models.Model):
    property = models.ForeignKey('management.Property', on_delete=models.CASCADE, related_name='reports')
    generated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    start_date = models.DateField()
    end_date = models.DateField()
    
    # Financial Metrics Snapshot
    total_expected_revenue = models.DecimalField(max_digits=12, decimal_places=2)
    total_collected_revenue = models.DecimalField(max_digits=12, decimal_places=2)
    total_pending_revenue = models.DecimalField(max_digits=12, decimal_places=2)
    occupancy_rate = models.DecimalField(max_digits=5, decimal_places=2)  # Percentage
    
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Report: {self.property.name} ({self.start_date} to {self.end_date})"    

class Lease(models.Model):
    tenant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='leases')
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='leases')
    unit_number = models.CharField(max_length=20)
    rent_amount = models.DecimalField(max_digits=10, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)

class Invoice(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('PAID', 'Paid'),
        ('OVERDUE', 'Overdue'),
    )
    invoice_number = models.CharField(max_length=50, unique=True)
    tenant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='invoices')
    lease = models.ForeignKey(Lease, on_delete=models.CASCADE, related_name='invoices')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    due_date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('rent_due', 'Rent Due Reminder'),
        ('payment_receipt', 'Payment Receipt'),
        ('general', 'General Notice'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=150)
    message = models.TextField()
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES, default='rent_due')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']