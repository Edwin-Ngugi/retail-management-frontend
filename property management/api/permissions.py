from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):

    def has_permission(self, request, view):

        return (
            request.user.is_authenticated
            and request.user.role == 'ADMIN'
        )


class IsManagement(BasePermission):

    def has_permission(self, request, view):

        if not request.user.is_authenticated:
            return False

        return request.user.role in [
            'ADMIN',
            'PROPERTY_MANAGER',
        ]


class IsAccountant(BasePermission):

    def has_permission(self, request, view):

        print("========== IS ACCOUNTANT DEBUG ==========")
        print("USER:", request.user)
        print("AUTHENTICATED:", request.user.is_authenticated)

        if request.user.is_authenticated:
            print("USERNAME:", request.user.username)
            print("ROLE:", repr(request.user.role))
            print("ROLE TYPE:", type(request.user.role))

        allowed = (
            request.user.is_authenticated
            and request.user.role in [
                'ADMIN',
                'ACCOUNTANT',
            ]
        )

        print("PERMISSION RESULT:", allowed)
        print("=========================================")

        return allowed


class IsCaretaker(BasePermission):

    def has_permission(self, request, view):

        if not request.user.is_authenticated:
            return False

        return request.user.role in [
            'ADMIN',
            'PROPERTY_MANAGER',
            'CARETAKER',
        ]