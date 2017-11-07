from flask.views import MethodView
from flask import jsonify, request, Flask

from dashboard.roles import analyst_permission, viewer_permission, admin_permission


class PermissionMethodView(MethodView):
    protected = ['DELETE', 'PATCH', 'POST', 'PUT']

    def dispatch_request(self, *args, **kwargs):
        permission = analyst_permission if request.method in self.protected else viewer_permission
        with permission.require(http_exception=403):
            return super(PermissionMethodView, self).dispatch_request(*args, **kwargs)



class JsonApiView(PermissionMethodView):

    def dispatch_request(self, *args, **kwargs):
        response = super(JsonApiView, self).dispatch_request(*args, **kwargs)
        if isinstance(response, Flask.response_class):
            return response
        rest = [200]
        if isinstance(response, tuple):
            response = list(response)
            response, rest = response[0], response[1:]
        body = response if isinstance(response, basestring) \
            else jsonify(response)
        return tuple([body] + rest)


class AdminEditMixin(object):
    def dispatch_request(self, *args, **kwargs):
        run = lambda: super(AdminEditMixin, self).dispatch_request(*args, **kwargs)
        if request.method == 'GET':
            return run()
        else:
            with admin_permission.require(http_exception=403):
                return run()

