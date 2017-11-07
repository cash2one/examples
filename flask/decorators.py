from functools import wraps
import uuid
from flask import request, g
from flask.ext.login import current_user
from gevent import Greenlet

from dashboard.roles import signal_identity_change



def public_view(f):
    f._public = True
    return f


def auth_socket(permission, exception_code=403):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            signal_identity_change(current_user)
            with permission.require(http_exception=exception_code):
                return f(*args, **kwargs)
        return decorated_function
    return decorator


def route_api(blueprint, endpoint, rule_set, base_route='', public=False):
    def inner(cls):
        view_func = cls.as_view(endpoint)
        if public:
            view_func = public_view(view_func)
        for route, methods in rule_set:
            blueprint.add_url_rule('%s%s' % (base_route, route), view_func=view_func, methods=methods)
        return cls
    return inner


def form_view(FormClass, json=False):
    def decorator(view):
        @wraps(view)
        def decorated(*args, **kwargs):
            data = request.get_json(force=True, silent=True) or {} if json else request.form
            if json:
                form = FormClass(data=data)
            else:
                form = FormClass(data)
            if form.validate():
                g.data = form.data
                return view(*args, **kwargs)
            return {'value': form.errors}, 400
        return decorated
    return decorator


def async(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        thr = Greenlet(f, *args, **kwargs)
        thr.start()
    return wrapper
