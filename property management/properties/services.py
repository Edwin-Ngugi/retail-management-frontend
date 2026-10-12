from datetime import date
from calendar import monthrange

from django.db import transaction

from .models import Lease, RentInvoice


def generate_monthly_invoices(year, month):

    billing_month = date(year, month, 1)

    # Last day of the month
    last_day = monthrange(year, month)[1]

    due_date = date(
        year,
        month,
        min(5, last_day)
    )

    active_leases = Lease.objects.filter(
        status=Lease.Status.ACTIVE
    ).select_related(
        'tenant',
        'unit',
        'unit__property',
    )

    created_invoices = []

    with transaction.atomic():

        for lease in active_leases:

            # Make sure the lease is active
            # during the requested billing month.
            if lease.start_date > billing_month:
                continue

            if lease.end_date < billing_month:
                continue

            invoice_number = (
                f'INV-{year}-{month:02d}-'
                f'{lease.id:06d}'
            )

            invoice, created = RentInvoice.objects.get_or_create(

                lease=lease,

                billing_month=billing_month,

                defaults={
                    'invoice_number': invoice_number,
                    'due_date': due_date,
                    'amount_due': lease.monthly_rent,
                    'amount_paid': 0,
                    'status': RentInvoice.Status.UNPAID,
                }
            )

            if created:
                created_invoices.append(invoice)

    return created_invoices

from django.utils import timezone


def update_overdue_invoices():

    today = timezone.localdate()

    invoices = RentInvoice.objects.filter(
        due_date__lt=today,
        status__in=[
            RentInvoice.Status.UNPAID,
            RentInvoice.Status.PARTIAL,
        ]
    )

    updated = invoices.update(
        status=RentInvoice.Status.OVERDUE
    )

    return updated    