import sys, socket
import datetime
from celery.beat import Scheduler, logger, SchedulingError
from celery import current_app
from celery.utils import uuid

from common.db import DbController
from common.db.celery_schedule import PeriodicTaskManager
from common.celery_management import Storage


debug, info, error, warning = (logger.debug, logger.info,
                               logger.error, logger.warning)


class MongoScheduler(Scheduler):

    UPDATE_INTERVAL = datetime.timedelta(seconds=5)

    def __init__(self, *args, **kwargs):
        self._storage = Storage()
        self._storage.release_glob()
        self.periodic_manager = PeriodicTaskManager(DbController.get_default_controller(current_app.conf['DB']))
        self._schedule = {}
        self._last_updated = None
        Scheduler.__init__(self, *args, **kwargs)
        self.max_interval = (kwargs.get('max_interval')
                or self.app.conf.CELERYBEAT_MAX_LOOP_INTERVAL or 5)

    def setup_schedule(self):
        self._schedule = self.get_from_database()
        self._last_updated = datetime.datetime.now()

    def requires_update(self):
        if not self._last_updated:
            return True
        return self._last_updated + self.UPDATE_INTERVAL < datetime.datetime.now()

    def get_from_database(self):
        self.sync()
        d = {}
        for doc in self.periodic_manager.schedules():
            d[doc['name']] = self.Entry(app=current_app._get_current_object(), **doc)
        return d

    @property
    def schedule(self):
        if self.requires_update():
            self.setup_schedule()
        return self._schedule

    def sync(self):
        for entry in self._schedule.values():
            self.periodic_manager.save(entry)

    def send_task(self, task, task_args, task_kwargs, *args, **kwargs):
        task_id = kwargs.setdefault('task_id', str(uuid()))
        if task_id == self._storage.obtain_lock(task, task_args, task_kwargs, task_id):
            return Scheduler.send_task(self, task, task_args, task_kwargs, *args, **kwargs)
        return self.app.AsyncResult(task_id)
