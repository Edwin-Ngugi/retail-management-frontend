"""
URL configuration for project project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path


from django.contrib import admin
from django.urls import include, path
from django.urls import include, path              


urlpatterns = [
    path('admin/', admin.site.urls),

    path(
        '',
        include('accounts.urls')
    ),

    path(
        'api/',
        include('api.urls')
    ),
    path(
    'accounting/',
    include('accounting.urls')
    ),
    path(
    "tenant/",
    include("tenants.page_urls")
    ),
    path(
        "api/tenant/",
        include("tenants.urls")
    ),
    path(
    "management/",
    include("management.urls")
    ),
    path('portal_admin/', include('portal_admin.urls')),

    
]

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


# Append media file handling to the main urlpatterns list
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
