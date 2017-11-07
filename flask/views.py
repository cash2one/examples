# -*- coding: utf-8 -*-
from flask import request
from tzlocal import get_localzone
from itertools import izip, ifilter

from common.utils import get_current_datetime_tz, datetime_tz_from_timestamp
from datetime import datetime, timedelta

from dashboard.graphs import graphs
from dashboard.dashboard_common.mixins import PgMixin, JsonApiView
from dashboard.dashboard_common.decorators import route_api
from common.db.stats import (TrafficManager, TxStatusManager, DelayManager, SessionCountManager,
                             TemporalResolutions, HostilityCalc, get_resolution_from_period)


webapp_graph_ruleset = [
    ('<uuid:webapp_id>/', ['GET'])
]


class GraphDataViewBase(PgMixin, JsonApiView):
    DEFAULT_RESOLUTION = TemporalResolutions.minute

    def __init__(self):
        super(GraphDataViewBase, self).__init__()
        self.tx_manager = TxStatusManager(db_controller=self.pg_controller, resolution=TemporalResolutions.second)

    def get(self, **kwargs):
        params = map(request.args.get, ['dt_from', 'dt_to', 'resolution'])
        dt_from, dt_to, resolution = self._handle_params(*params)
        kwargs.update(dt_from=dt_from, dt_to=dt_to, resolution=resolution)
        data = self.get_stats(**kwargs)
        total_transactions = self.tx_manager.num_transactions(
            dt_from=dt_from, dt_to=dt_to, webapp_id=kwargs.get('webapp_id')
        )
        return {'value': {
            'series': data,
            'resolution': resolution,
            'total_transactions': total_transactions
        }}

    def get_stats(self, *args, **kwargs):
        raise NotImplementedError()

    def _handle_params(self, dt_from, dt_to, resolution):
        dt_to = get_current_datetime_tz() if dt_to is None else datetime_tz_from_timestamp(dt_to)
        if dt_from is not None:
            dt_from = datetime_tz_from_timestamp(dt_from)
        if resolution is not None:
            if resolution.isdigit():
                resolution = int(resolution)
            elif not resolution in TemporalResolutions.reverse_mapping:
                resolution = getattr(TemporalResolutions, resolution)
        if resolution is None and dt_from is None:
            resolution = self.DEFAULT_RESOLUTION
        if dt_from is None and resolution is not None:
            dt_from = dt_to - timedelta(hours=1)
        if dt_from is not None and resolution is None:
            resolution = get_resolution_from_period(dt_from, dt_to)
        return dt_from, dt_to, resolution


@route_api(
    blueprint=graphs,
    endpoint='bandwidth_graph',
    base_route='/graphs/bandwidth/',
    rule_set=webapp_graph_ruleset
)
class WebappTrafficGraphDataView(GraphDataViewBase):
    def __init__(self):
        super(WebappTrafficGraphDataView, self).__init__()
        self.traff_mgr = TrafficManager(db_controller=self.pg_controller, resolution=TemporalResolutions.second)

    def get_stats(self, webapp_id, dt_from, dt_to, resolution):
        return self.traff_mgr.get_traffic_stats(webapp_id, dt_from, dt_to, resolution)


@route_api(
    blueprint=graphs,
    endpoint='status_group_graph',
    base_route='/graphs/status_group/',
    rule_set=webapp_graph_ruleset
)
class TxStatusDataView(GraphDataViewBase):
    def __init__(self):
        super(TxStatusDataView, self).__init__()
        self.tx_mgr = TxStatusManager(db_controller=self.pg_controller, resolution=TemporalResolutions.second)

    def get_stats(self, webapp_id, dt_from, dt_to, resolution):
        return self.tx_manager.get_status_stats(webapp_id, dt_from, dt_to, resolution)


@route_api(
    blueprint=graphs,
    endpoint='response_graph',
    base_route='/graphs/response/',
    rule_set=webapp_graph_ruleset
)
class TxResponseDataView(GraphDataViewBase):
    def __init__(self):
        super(TxResponseDataView, self).__init__()
        self.tx_mgr = TxStatusManager(db_controller=self.pg_controller, resolution=TemporalResolutions.second)

    def get_stats(self, webapp_id, dt_from, dt_to, resolution):
        return self.tx_manager.get_decision_stats(webapp_id, dt_from, dt_to, resolution)


@route_api(
    blueprint=graphs,
    endpoint='delay_graph',
    base_route='/graphs/delay/',
    rule_set=webapp_graph_ruleset
)
class DelayDataView(GraphDataViewBase):
    def __init__(self):
        super(DelayDataView, self).__init__()
        self.delay_manager = DelayManager(db_controller=self.pg_controller, resolution=TemporalResolutions.second)

    def get_stats(self, webapp_id, dt_from, dt_to, resolution):
        return self.delay_manager.get_delay_stats(webapp_id, dt_from, dt_to, resolution)


@route_api(
    blueprint=graphs,
    endpoint='active_sessions_graph',
    base_route='/graphs/active-sessions/',
    rule_set=webapp_graph_ruleset
)
class SessionDataView(GraphDataViewBase):
    def __init__(self):
        super(SessionDataView, self).__init__()
        self.session_mgr = SessionCountManager(db_controller=self.pg_controller, resolution=TemporalResolutions.second)

    def get_stats(self, webapp_id, dt_from, dt_to, resolution):
        return self.session_mgr.get_session_stats(webapp_id, dt_from, dt_to, resolution)


@route_api(
    blueprint=graphs,
    endpoint='hostility_graph',
    base_route='/graphs/hostility/',
    rule_set=webapp_graph_ruleset
)
class HostilityDataView(GraphDataViewBase):
    def __init__(self):
        super(HostilityDataView, self).__init__()
        self.hostility_calc_manager = HostilityCalc(0.5, 0.5, db_controller=self.pg_controller)

    def get_stats(self, webapp_id, dt_from, dt_to, resolution):
        return self.hostility_calc_manager.get_hosility_stats(webapp_id, dt_from, dt_to, resolution)
