from decimal import Decimal
from datetime import timedelta
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from properties.models import Lease, RentInvoice

@receiver(post_save, sender=Lease)
def auto_generate_initial_invoice(sender, instance, created, **kwargs):
    """
    Automatically creates the initial RentInvoice when a new Lease is created.
    """
    if created and instance.status == Lease.Status.ACTIVE:
        today = timezone.localdate()
        first_of_month = today.replace(day=1)
        
        # Prevent duplicate initial invoices for the same billing month
        existing_invoice = RentInvoice.objects.filter(
            lease=instance,
            billing_month=first_of_month
        ).exists()

        if not existing_invoice:
            inv_number = f"INV-{instance.tenant.id}-{today.strftime('%Y%m%d%H%M')}"
            
            RentInvoice.objects.create(
                lease=instance,
                invoice_number=inv_number,
                billing_month=first_of_month,
                amount_due=instance.monthly_rent,
                amount_paid=Decimal("0.00"),
                due_date=today + timedelta(days=5),
                status=RentInvoice.Status.UNPAID
            )