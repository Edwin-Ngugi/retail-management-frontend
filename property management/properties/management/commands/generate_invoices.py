from django.core.management.base import BaseCommand
from django.utils import timezone

from properties.services import generate_monthly_invoices


class Command(BaseCommand):

    help = 'Generate monthly rent invoices'

    def add_arguments(self, parser):

        parser.add_argument(
            '--year',
            type=int,
        )

        parser.add_argument(
            '--month',
            type=int,
        )

    def handle(self, *args, **options):

        today = timezone.localdate()

        year = options['year'] or today.year
        month = options['month'] or today.month

        invoices = generate_monthly_invoices(
            year,
            month
        )

        self.stdout.write(
            self.style.SUCCESS(
                f'{len(invoices)} invoices generated '
                f'for {year}-{month:02d}.'
            )
        )