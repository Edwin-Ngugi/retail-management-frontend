from django.urls import path
from django.contrib.auth.views import LogoutView
from django.conf import settings
from django.conf.urls.static import static




from django.contrib.auth import views as auth_views
from .views import (
    AdminDashboardView,
    AdminAddPropertyView,
    AdminPropertyListView,
    AdminPropertyDetailView,
    AdminUserListView,
    AdminAssignRoleView,
    AdminLoginView,
    delete_user,
    AdminLogoutView,
)

urlpatterns = [
    path("dashboard/", AdminDashboardView.as_view(), name="admin_dashboard"),
    path("properties/", AdminPropertyListView.as_view(), name="admin_properties_list"),
    path("properties/add/", AdminAddPropertyView.as_view(), name="admin_add_property"),
    path("properties/<int:pk>/", AdminPropertyDetailView.as_view(), name="admin_property_detail"),
    path('users/', AdminUserListView.as_view(), name='admin_user_list'),
    path('users/<int:pk>/assign-role/', AdminAssignRoleView.as_view(), name='admin_assign_role'),
    path('login/', AdminLoginView.as_view(), name='admin-login'),
    path('logout/', auth_views.LogoutView.as_view(next_page='admin-login'), name='admin-logout'),
    path('users/<int:pk>/delete/', delete_user, name='admin_delete_user'),
    path("portal_admin/logout/", AdminLogoutView.as_view(), name="admin_logout"),

]