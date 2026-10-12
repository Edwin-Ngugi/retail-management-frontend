from django.contrib.auth import authenticate, login, logout
from django.contrib import messages
from django.shortcuts import render, redirect

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from properties.models import Payment
from api.serializers import PaymentSerializer
from api.permissions import IsAccountant


def login_view(request):

    if request.user.is_authenticated:
        return redirect('dashboard')

    if request.method == 'POST':

        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(
            request,
            username=username,
            password=password
        )

        if user is not None:

            login(request, user)

            return redirect('dashboard')

        messages.error(
            request,
            'Invalid username or password.'
        )

    return render(
        request,
        'accounts/login.html'
    )


def logout_view(request):

    if request.method == 'POST':
        logout(request)

    return redirect('login')


def dashboard(request):

    if not request.user.is_authenticated:
        return redirect('login')

    return render(
        request,
        'accounts/dashboard.html'
    )


class PaymentViewSet(viewsets.ModelViewSet):

    serializer_class = PaymentSerializer

    permission_classes = [
        IsAuthenticated,
        IsAccountant,
    ]

    def get_queryset(self):

        user = self.request.user

        return Payment.objects.filter(
            invoice__lease__unit__property__company=user.company
        ).select_related(
            'invoice',
            'invoice__lease',
            'invoice__lease__tenant',
            'invoice__lease__unit',
            'invoice__lease__unit__property',
            'tenant',
        )

    def perform_create(self, serializer):

        serializer.save()