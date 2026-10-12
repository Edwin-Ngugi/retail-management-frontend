class PortalSessionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path_info
        
        # Include portal_admin alongside standard /admin/
        if path.startswith('/admin/') or path.startswith('/portal_admin/'):
            request.session_cookie_name = 'admin_sessionid'
        elif path.startswith('/accounting/'):
            request.session_cookie_name = 'accounting_sessionid'
        elif path.startswith('/management/'):
            request.session_cookie_name = 'management_sessionid'
        else:
            request.session_cookie_name = 'tenant_sessionid'

        return self.get_response(request)