from datetime import timedelta
from django.db import transaction, models
from django.utils import timezone
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse_lazy
from django.views.generic import TemplateView, ListView, DetailView, View
from django.contrib import messages
from django.contrib.auth import get_user_model, login, logout
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.contrib.auth.views import LoginView
from django.contrib.auth.decorators import user_passes_test
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie

# Relative import matching properties.models.py
from properties.models import Property, Unit, UnitType, PropertyCategory, Company
from .forms import PropertyForm

User = get_user_model()


# ==========================================
# AUTHENTICATION & PERMISSIONS
# ==========================================

class StaffRequiredMixin(UserPassesTestMixin):
    """Mixin to ensure only staff members can access admin portal views."""
    def test_func(self):
        return self.request.user.is_authenticated and (self.request.user.is_staff or self.request.user.is_superuser)

    def handle_no_permission(self):
        # Prevent repeating identical flash messages across redirects
        storage = messages.get_messages(self.request)
        msg_text = "You do not have admin permissions to access this area."
        
        if not any(msg_text in str(m) for m in storage):
            messages.error(self.request, msg_text)
            
        return redirect('admin-login')


@method_decorator(ensure_csrf_cookie, name='dispatch')
class AdminLoginView(LoginView):
    template_name = "portal_admin/login.html"
    redirect_authenticated_user = False  # Disable default auto-redirect to break loop

    def dispatch(self, request, *args, **kwargs):
        # Handle already logged-in users attempting to hit the login page
        if request.user.is_authenticated:
            if request.user.is_superuser:
                return redirect("admin_dashboard")
            else:
                # Logged-in non-superuser (e.g., Accountant, Manager, Tenant)
                logout(request)
                messages.error(request, "Access denied. Only superusers can access this portal.")
                return redirect("admin-login")
        return super().dispatch(request, *args, **kwargs)

    def form_valid(self, form):
        user = form.get_user()
        
        # Explicitly enforce superuser check on authentication
        if not user.is_superuser:
            messages.error(self.request, "Access denied. Only superusers can access this portal.")
            return redirect("admin-login")
        
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy("admin_dashboard")

from django.contrib.admin import AdminSite

class SecureAdminSite(AdminSite):
    def has_permission(self, request):
        user = request.user
        if not user.is_authenticated:
            return False
            
        user_role = str(getattr(user, "role", "")).upper()
        # Require SUPERUSER status OR explicit ADMIN role (excluding ACCOUNTANT)
        return user.is_active and (user.is_superuser or user_role == "ADMIN")

# Use SecureAdminSite instead of default admin site
admin_site = SecureAdminSite(name='secure_admin')
# ==========================================
# PROPERTY REGISTRATION & SYSTEM ASSET VIEWS
# ==========================================

class AdminAddPropertyView(LoginRequiredMixin, StaffRequiredMixin, View):
    template_name = "portal_admin/add_property.html"

    def get_context_data(self, form=None):
        return {
            "form": form or PropertyForm(),
            "unit_types": UnitType.choices,
        }

    def get(self, request, *args, **kwargs):
        return render(request, self.template_name, self.get_context_data())

    def post(self, request, *args, **kwargs):
        form = PropertyForm(request.POST, request.FILES)
        selected_types = request.POST.getlist("unit_type[]")

        if not selected_types:
            messages.error(request, "Please select at least one unit type.")
            return render(request, self.template_name, self.get_context_data(form=form))

        if form.is_valid():
            try:
                with transaction.atomic():
                    new_property = form.save(commit=False)
                    new_property.company = getattr(request.user, "company", None)
                    new_property.save()

                    unit_counts = request.POST.getlist("unit_count[]")
                    monthly_rents = request.POST.getlist("monthly_rent[]")
                    total_units = 0

                    for idx, u_type in enumerate(selected_types):
                        raw_count = unit_counts[idx] if idx < len(unit_counts) else None
                        raw_rent = monthly_rents[idx] if idx < len(monthly_rents) else None

                        if not raw_count or not raw_rent:
                            continue

                        count = int(raw_count)
                        rent = float(raw_rent)
                        prefix = u_type.split("_")[0][:3].upper()

                        units_to_create = [
                            Unit(
                                property=new_property,
                                unit_number=f"{prefix}-{i:03d}",
                                unit_type=u_type,
                                monthly_rent=rent,
                                status=Unit.Status.VACANT,
                            )
                            for i in range(1, count + 1)
                        ]

                        Unit.objects.bulk_create(units_to_create)
                        total_units += count

                    if total_units == 0:
                        raise ValueError("No valid unit counts or rent values were provided for the selected types.")

                    messages.success(
                        request,
                        f"Property '{new_property.name}' successfully registered with {total_units} units."
                    )
                    return redirect("admin_properties_list")

            except Exception as e:
                messages.error(request, f"Save failed: {str(e)}")

        return render(request, self.template_name, self.get_context_data(form=form))


class AdminPropertyListView(LoginRequiredMixin, StaffRequiredMixin, ListView):
    """Lists all registered property assets in the system."""
    model = Property
    template_name = "portal_admin/property_list.html"
    context_object_name = "properties"
    paginate_by = 15

    def get_queryset(self):
        queryset = Property.objects.select_related("company").annotate(
            total_units=models.Count("units")
        ).order_by("-created_at")

        search_query = self.request.GET.get("q", "").strip()
        if search_query:
            queryset = queryset.filter(
                models.Q(name__icontains=search_query) |
                models.Q(city__icontains=search_query) |
                models.Q(company__name__icontains=search_query)
            )
        return queryset


class AdminPropertyDetailView(LoginRequiredMixin, StaffRequiredMixin, DetailView):
    model = Property
    template_name = "portal_admin/property_detail.html"
    context_object_name = "property"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        prop = self.get_object()
        
        context["unit_summary"] = prop.get_unit_types_summary()
        context["units"] = prop.units.all().order_by("unit_number")
        context["total_units"] = prop.units.count()
        context["vacant_units"] = prop.units.filter(status=Unit.Status.VACANT).count()
        context["occupied_units"] = prop.units.filter(status=Unit.Status.OCCUPIED).count()

        # Potential revenue from ALL units:
        context["total_potential_rent"] = prop.units.aggregate(
            total=models.Sum("monthly_rent")
        )["total"] or 0.0

        # Actual revenue from OCCUPIED units only:
        context["est_occupied_rent"] = prop.units.filter(
            status=Unit.Status.OCCUPIED
        ).aggregate(
            total=models.Sum("monthly_rent")
        )["total"] or 0.0

        return context


# ==========================================
# DASHBOARD & USER MANAGEMENT VIEWS
# ==========================================

class AdminDashboardView(LoginRequiredMixin, StaffRequiredMixin, TemplateView):
    """Main administrative control panel for high-level governance and system logs."""
    template_name = "portal_admin/dashboard.html"
    login_url = "admin-login"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # System Administration & Portfolio High-Level Metrics
        total_properties = Property.objects.count()
        total_users = User.objects.count()
        active_managers_count = User.objects.filter(is_staff=True).count()

        total_units = Unit.objects.count()
        occupied_units = Unit.objects.filter(status=Unit.Status.OCCUPIED).count()
        occupancy_rate = round((occupied_units / total_units * 100), 1) if total_units > 0 else 0.0

        # Construct System Audit & Activity Timeline Feed
        activities = []

        # 1. Recent Property Additions
        recent_props = Property.objects.select_related("company").order_by("-created_at")[:5]
        for prop in recent_props:
            activities.append({
                "timestamp": prop.created_at,
                "type": "Property Created",
                "description": f"Property '{prop.name}' registered under {prop.company.name if prop.company else 'N/A'}.",
                "link": reverse_lazy("admin_property_detail", kwargs={"pk": prop.pk}),
            })

        # 2. Recent User Signups / Registrations
        recent_users = User.objects.order_by("-date_joined")[:5]
        for usr in recent_users:
            activities.append({
                "timestamp": usr.date_joined,
                "type": "User Registered",
                "description": f"New user @{usr.username} joined the portal.",
                "link": reverse_lazy("admin_user_list"),
            })

        # Sort combined system audit timeline by newest first and limit to top 8 entries
        activities = sorted(activities, key=lambda x: x["timestamp"], reverse=True)[:8]

        context.update({
            "total_properties": total_properties,
            "total_users": total_users,
            "active_managers_count": active_managers_count,
            "total_units": total_units,
            "occupied_units": occupied_units,
            "occupancy_rate": occupancy_rate,
            "recent_activities": activities,
        })
        return context


class AdminLogoutView(View):
    """Handles logout strictly for the admin portal."""
    def dispatch(self, request, *args, **kwargs):
        logout(request)
        messages.success(request, "You have been logged out successfully.")
        return redirect("admin-login")        


class AdminUserListView(LoginRequiredMixin, StaffRequiredMixin, ListView):
    """Lists system users with search filtering and role summary counts."""
    model = User
    template_name = "portal_admin/user_list.html"
    context_object_name = "users"
    paginate_by = 15

    def get_queryset(self):
        queryset = User.objects.all().order_by("-date_joined")
        search_query = self.request.GET.get("q", "").strip()
        if search_query:
            queryset = queryset.filter(
                models.Q(username__icontains=search_query) |
                models.Q(email__icontains=search_query) |
                models.Q(first_name__icontains=search_query) |
                models.Q(last_name__icontains=search_query)
            )
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["total_users"] = User.objects.count()
        context["staff_count"] = User.objects.filter(is_staff=True).count()
        context["superuser_count"] = User.objects.filter(is_superuser=True).count()
        return context


class AdminAssignRoleView(LoginRequiredMixin, StaffRequiredMixin, View):
    """Handles updating a user's staff/superuser permissions inline."""
    def post(self, request, pk, *args, **kwargs):
        user_to_update = get_object_or_404(User, pk=pk)
        role = request.POST.get("role")

        if role == "superuser":
            user_to_update.is_staff = True
            user_to_update.is_superuser = True
        elif role == "staff":
            user_to_update.is_staff = True
            user_to_update.is_superuser = False
        else:
            # Regular User / Tenant
            user_to_update.is_staff = False
            user_to_update.is_superuser = False

        user_to_update.save()
        messages.success(request, f"Updated permissions for user '{user_to_update.username}'.")
        return redirect("admin_user_list")


@user_passes_test(lambda u: u.is_superuser)
def delete_user(request, pk):
    if request.method == "POST":
        user_to_delete = get_object_or_404(User, pk=pk)
        
        # Prevent self-deletion
        if user_to_delete == request.user:
            messages.error(request, "You cannot delete your own active administrator account.")
            return redirect('admin_user_list')
        
        username = user_to_delete.username
        user_to_delete.delete()
        messages.success(request, f"User '{username}' has been successfully removed from the system.")
        
    return redirect('admin_user_list')