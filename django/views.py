# -*- coding: utf-8 -*-
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseBadRequest, HttpResponse
from django.http import HttpResponseRedirect
from django.core.urlresolvers import reverse
from django.views.generic.base import View

from oauth2client import xsrfutil
from oauth2client.client import flow_from_clientsecrets
from oauth2client.django_orm import Storage

import os
import utils
import json

from adsense_api.models import Credential
from adsense_api.api_utils import Report


class FlowControlMixin(object):

    @staticmethod
    def get_callback_url():
        if settings.DEBUG:
            return "127.0.0.1:8000"
        if not utils.utils_alcyone.is_staging():
            return 'advertone.ru'
        return 'staging%s.advertone.ru' % ("2" if 'ad2' in os.path.dirname(__file__) else '')

    FLOW = flow_from_clientsecrets(
        settings.CLIENT_SECRETS,
        scope='https://www.googleapis.com/auth/adsense.readonly',
        redirect_uri='http://%s/adsense/oauth2callback/' % get_callback_url()
    )


class IndexView(View, FlowControlMixin):

    @login_required
    def get(self, *args, **kwargs):
        storage = Storage(Credential, 'id', self.request.user, 'credential')
        credential = storage.get()
        if credential is None or credential.invalid is True:
            self.FLOW.params['state'] = xsrfutil.generate_token(
                settings.SECRET_KEY, self.request.user)
            self.FLOW.params['approval_prompt'] = 'force'
            authorize_url = self.FLOW.step1_get_authorize_url()
            return HttpResponseRedirect(authorize_url)
        else:
            return HttpResponseRedirect(reverse("summon_adsense_stat", kwargs={'days_before': 1}))


class AuthReturnView(View, FlowControlMixin):

    def get(self, *args, **kwargs):
        if not xsrfutil.validate_token(
                settings.SECRET_KEY, self.request.GET['state'], self.request.user):
            return HttpResponseBadRequest()
        credential = self.FLOW.step2_exchange(self.request.GET)
        storage = Storage(Credential, 'id', self.request.user, 'credential')
        storage.put(credential)
        return HttpResponseRedirect(reverse("adsense"))



@login_required
def summon_adsense_stat(request, days_before):
    result = Report(days_before).get(request.user)
    return HttpResponse(json.dumps({'status': +result}), mimetype='text/javascript')
