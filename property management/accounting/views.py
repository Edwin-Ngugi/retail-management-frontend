from functools import wraps
from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import authenticate, login
from django.contrib.auth.decorators import login_required
from django.views import View
from django.urls import reverse_lazy
from django.contrib.auth.views import (
    PasswordResetView,
    PasswordResetDoneView,
    PasswordResetConfirmView,
    PasswordResetCompleteView
)
from properties.models import RentInvoice


# -------------------------------------------------------------------
# Custom Decorator
# -------------------------------------------------------------------
def accountant_required(view_func):
    """Restrict access to authenticated ADMIN and ACCOUNTANT roles."""
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('accountant-login')

        user_role = getattr(request.user, 'role', None)

        if request.user.is_superuser or user_role in ['ADMIN', 'ACCOUNTANT']:
            return view_func(request, *args, **kwargs)

        # Log out unauthorized user so they don't get stuck in a redirect loop
        from django.contrib.auth import logout
        logout(request)
        
        messages.error(request, "Access denied. Insufficient privileges.")
        return redirect('accountant-login')

    return _wrapped_view


# -------------------------------------------------------------------
# Login View
# -------------------------------------------------------------------
class AccountantLoginView(View):
    template_name = "accounting/login.html"

    def get(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            user_role = getattr(request.user, 'role', None)
            if request.user.is_superuser or request.user.is_staff or user_role in ['ADMIN', 'ACCOUNTANT']:
                return redirect("accounting-dashboard")
        return render(request, self.template_name)

    def post(self, request, *args, **kwargs):
        username_val = request.POST.get("username", "").strip()
        password_val = request.POST.get("password", "")

        user = authenticate(request, username=username_val, password=password_val)

        if user is not None:
            user_role = getattr(user, 'role', None)
            if request.user.is_superuser or user.is_staff or user_role in ['ADMIN', 'ACCOUNTANT']:
                login(request, user)
                messages.success(request, f"Welcome back, {user.get_full_name() or user.username}.")
                return redirect("accounting-dashboard")
            else:
                messages.error(request, "Access restricted. Account lacks Accountant privileges.")
        else:
            messages.error(request, "Invalid username or password.")

        return render(request, self.template_name, {"username": username_val})


# -------------------------------------------------------------------
# Password Reset Views
# -------------------------------------------------------------------
class AdminPasswordResetView(PasswordResetView):
    template_name = "accounting/password_reset.html"
    email_template_name = "portal_admin/password_reset_email.html"
    subject_template_name = "portal_admin/password_reset_subject.txt"
    success_url = reverse_lazy("admin_password_reset_done")

class AdminPasswordResetDoneView(PasswordResetDoneView):
    template_name = "accounting/password_reset_done.html"

class AdminPasswordResetConfirmView(PasswordResetConfirmView):
    template_name = "portal_admin/password_reset_confirm.html"  # Fixed typo ('passwor' -> 'password')
    success_url = reverse_lazy("admin_password_reset_complete")

class AdminPasswordResetCompleteView(PasswordResetCompleteView):
    template_name = "portal_admin/password_reset_complete.html"


# -------------------------------------------------------------------
# Dashboard & Protected Views
# -------------------------------------------------------------------
@accountant_required
def dashboard(request):
    return render(request, 'accounting/dashboard.html')


@accountant_required
def invoice_list(request):
    invoices_qs = RentInvoice.objects.select_related(
        'lease',
        'lease__tenant',
        'lease__unit',
        'lease__unit__property',
    ).order_by('-due_date')

    return render(
        request,
        'accounting/invoices.html',
        {'invoices': invoices_qs}
    )


@accountant_required
def payment_list(request):
    return render(request, 'accounting/payments.html')

def accountant_logout(request):
    # Explicitly redirect to the desired login page URL
    return redirect('accountant-login')   