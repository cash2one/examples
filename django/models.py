from django.contrib.auth.models import User
from django.db import models

from oauth2client.django_orm import CredentialsField

from south.modelsinspector import introspector


class SouthCredentialsField(CredentialsField):

    def south_field_triple(self):
        "Returns a suitable description of this field for South."
        field_class = self.__class__.__module__ + "." + self.__class__.__name__
        args, kwargs = introspector(self)
        return (field_class, args, kwargs)


class Credential(models.Model):
    id = models.ForeignKey(User, primary_key=True)
    credential = SouthCredentialsField()
