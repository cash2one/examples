# -*- coding: utf-8 -*-
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

from adsense_api.api_utils import Report


class Command(BaseCommand):

    args = '<days_before_today: Int, user: pk or email>'

    def handle(self, *args, **options):
        if len(args) > 1:
            days_before, user = args[:2]
            users = User.objects.filter(**{'pk': int(user)} if user.isdigit() else {'email': user})
        else:
            days_before = args and args[0] or 1
            users = User.objects.filter(is_staff=True)
        report = Report(int(days_before))
        for user in users:
            report.get(user)

