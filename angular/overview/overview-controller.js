'use strict';
var app = angular.module(
    'dashboardApp',
    window.common_modules.concat([
        'ui.layout',
        'ngQuickDateTz',
        'dateRangePicker',
        'rickshawChart',
        'overviewUtils',
        'settings-api',
        'ngSanitize',
        'draggableModal'
    ])
);
app.config(function($httpProvider, $locationProvider) {
    $httpProvider.defaults.headers.common["X-Requested-With"] = 'XMLHttpRequest';
    $locationProvider.html5Mode(false);
    $locationProvider.hashPrefix('!');
});

app.controller('WebappOverviewCtrl', function ($scope, $timeout, $location, $filter, processRickshawData, DataApi, webappApi, graphMeta, autoUpdate, userSettingsApi, hostilityApi, modeApi, rulesCountersApi, $interval) {
    var translate = $filter('translate');

    $location.path('').hash(''); // reset location
    $scope.webapps = [];
    $scope.dateRange = {
        to: undefined,
        from: undefined
    };
    $scope.timezone = {
        zone: jstz.determine().name()
    };
    $scope.savedParameters = {};

    $scope.activateTab = function (tab) {
        var key;

        for (key in this.tabs) {
            if (this.tabs.hasOwnProperty(key)) {
                this.tabs[key] = false;
            }
        }
        if (this.tabs[tab] !== undefined) {
            this.tabs[tab] = true;
        }
    };

    $scope.userPromise = userSettingsApi.get().then(function (data) {
        $scope.userId = data.value.obj_id;
        $scope.userRole = data.value.role;
    });

    $scope.timezonePromise = userSettingsApi.getTimezone().then(function (data) {
        $scope.timezone.zone = data;
    });

    function getWebapp(webapps, obj_id) {
        var i;
        for (i = webapps.length; --i > -1;) {
            if (webapps[i].obj_id === obj_id) {
                return webapps[i];
            }
        }
        return null;
    }

    function updateWebapps() {
        webappApi.get().success(function (data) {
            var i, l, app, webapp,
                apps = data.value;

            for (i = 0, l = apps.length; i < l; i++) {
                app = apps[i];
                if (webapp = getWebapp($scope.webapps, app.obj_id)) {
                    webapp.display_name = app.display_name;
                }
                else {
                    $scope.webapps.push({"display_name": app.display_name, "obj_id": app.obj_id});
                }
            }

            for (i = $scope.webapps.length; --i > -1;) {
                if (!getWebapp(apps, $scope.webapps[i].obj_id)) {
                    $scope.webapps.splice(i, 1);
                }
            }

            updateHostility();
            updateModes();
            updateRulesCounters();
        });
    }

    function updateHostility() {
        hostilityApi.get().success(function (data) {
            var i, webapp,
                hostility = data.value;
            for (i = 0; i < $scope.webapps.length; i++) {
                webapp = $scope.webapps[i];
                webapp.$$hostility = hostility[webapp.obj_id];
                if (webapp.$$hostility < 0.33) {
                    webapp.$$hostilityText = 'overview.threat_low';
                } else if (webapp.$$hostility < 0.66) {
                    webapp.$$hostilityText = 'overview.threat_medium';
                } else {
                    webapp.$$hostilityText = 'overview.threat_high';
                }
            }
        });
    }

    function updateModes() {
        modeApi.get().success(function (data) {
            var i, webapp,
                modes = data.value;
            for (i = $scope.webapps.length; --i > -1;) {
                webapp = $scope.webapps[i];
                webapp.$$mode = modes[webapp.obj_id];
                switch (webapp.$$mode) {
                    case 'ACTIVE':
                        webapp.$$modeText = 'overview.status_protected';
                        break;
                    case 'PASSIVE':
                        webapp.$$modeText = 'overview.status_monitored';
                        break;
                    default:
                        break;
                }
            }
        });
    }

    function updateRulesCounters() {
        var i, w;
        for (i = $scope.webapps.length; --i > -1;) {
            w = $scope.webapps[i];
            (function (w) {
                rulesCountersApi.get(w.obj_id).success(function (data) {
                    w.$$activeRules = data.value.active_rules;
                });
            })(w);
        }
    }

    $scope.getWebappUrl = function (webapp) {
        return '/webapp/#!/' + webapp.obj_id;
    };

    $scope.getWebappRulesUrl = function (webapp) {
        var result = '/decision_rules/#!#',
            obj = {};
        obj.webapp = webapp.obj_id;
        result += encodeURI(angular.toJson(obj));
        return result;
    };

    $scope.getWebappTrashUrl = function(webapp) {
        return '/events/#!#' + encodeURI(angular.toJson({global: {form: {
            webappFilter: webapp.obj_id,
            eventTypeFilter: 'done',
            opened: false
        }}}));
    };

    $scope.getData = function () {
        var self, webapp_id,
            i, l, s, disabledSeries;
        self = this;
        webapp_id = self.webapp.obj_id;
        disabledSeries = [];
        if (self.disabledSeries) {
            disabledSeries = self.disabledSeries;
            self.disabledSeries = undefined;
        }
        else {
            for (i = 0, l = self.graph.series.length; i < l; i++) {
                s = self.graph.series[i];
                if (s.disabled) {
                    disabledSeries.push(s.name);
                }
            }
        }
        this.onBeforeRender();
        this.api.fetch(
            self.dateRange.from,
            self.dateRange.to
        ).success(
            function (data) {
                var i, l, s,
                    autoUpdateFlag;

                autoUpdateFlag = !self.dateRange.to;
                if (self.dateRange.from && moment().diff(self.dateRange.from, 'days') > 31) {
                    autoUpdateFlag = false;
                }
                self.autoUpdateOn = autoUpdateFlag;

                self.data.series = processRickshawData(data.value.series);
                for (i = 0, l = self.data.series.length; i < l; i++) {
                    s = self.data.series[i];
                    if (disabledSeries.indexOf(s.name) !== -1) {
                        s.disabled = true;
                    }
                }
                self.data.resolution = data.value.resolution;
                self.data.total_transactions = data.value.total_transactions;
                self.data.webapp_id = webapp_id;

                $scope.savedParameters[webapp_id] = $scope.savedParameters[webapp_id] || {};
                $scope.savedParameters[webapp_id][self.type] = angular.copy(self.dateRange);
                $scope.savedParameters[webapp_id][self.type].disabledSeries = disabledSeries;
            }
        ).error(
            function () {
                self.onAfterRender();
            }
        );
    };

    $scope.init = function () {
        var savedParameters,
            self = this;
        this.loading = true;
        this.data = { // empty data for initial draw
            series: [
                {
                    data: [
                        {
                            x: 0,
                            y: 0
                        }
                    ],
                    noLegend: true
                }
            ],
            /**
             * Not sure this is the good way, requires compilation ($compile) into DOM element for
             * interpolation to work
             */
            total_transactions:  '{{ \'graph.loading\' | translate }}...'
        };
        this.api = DataApi(this.type, this.webapp.obj_id);
        this.graphMeta = _.merge({}, graphMeta, this.graphMeta); // order matters
        if (self.savedParameters[self.webapp.obj_id] &&
            self.savedParameters[self.webapp.obj_id][self.type]) {
            savedParameters = self.savedParameters[self.webapp.obj_id][self.type];
            self.dateRange = {
                from: savedParameters.from,
                to: savedParameters.to
            };
            self.disabledSeries = savedParameters.disabledSeries;
        }
        else {
            self.dateRange = {
                from: undefined,
                to: undefined
            };
        }
        $scope.timezonePromise.then(function () {
            self.getData();
        });
        this.onBeforeRender = function () {
            self.loading = true;
        };
        this.onAfterRender = function () {
            self.loading = false;
        };
        this.$watch(
            'autoUpdateOn',
            autoUpdate(this.api, this.data, undefined, this.onBeforeRender)
        );
        this.onZoom = function (from, to) {
            self.dateRange.from = moment.tz(from, $scope.timezone.zone);
            self.dateRange.to = moment.tz(to, $scope.timezone.zone);
            self.setGraphInterval();
        };
    };

    $scope.saveParameters = function() {
        var i, l, s,
            webapp_id, disabledSeries;
        webapp_id = this.webapp.obj_id;
        disabledSeries = [];
        for (i = 0, l = this.graph.series.length; i < l; i++) {
            s = this.graph.series[i];
            if (s.disabled) {
                disabledSeries.push(s.name);
            }
        }
        this.savedParameters[webapp_id] = this.savedParameters[webapp_id] || {};
        this.savedParameters[webapp_id][this.type] = angular.copy(this.dateRange);
        this.savedParameters[webapp_id][this.type].disabledSeries = disabledSeries;
    };

    updateWebapps();
    $interval(function () {updateWebapps()}, 60000);

});
app.controller('WebappCtrl', ['$scope', '$rootScope', '$element', '$timeout', 'events', function ($scope, $rootScope, $element, $timeout, events) {
    $scope.tabs = {
        tabStatus: true,
        tabResponse: false,
        tabBandwidth: false,
        tabDelay: false,
        tabSession: false,
        tabHostility: false
    };
    $scope.eventFilter = {
        type: undefined,
        opened: true
    };
    $scope.events = [];

    events.init();

    $scope.getWebappEvents = function() {
        return events.eventPromise.then(function () {
            var i;
            $scope.events = [];

            for (i = 0; i < events.list.length; i++) {
                if (events.list[i].webapp_id === $scope.webapp.obj_id) {
                    $scope.events.push(events.list[i]);
                }
            }
        });
    };

    $scope.updateWebappEvents = function(list) {
        var updated = [],
            i, j;

        for (i = 0; i < list.length; i++) {
            if (list[i].webapp_id === $scope.webapp.obj_id) {
                for (j = 0; j < $scope.events.length; j++) {
                    if ($scope.events[j].obj_id === list[i].obj_id) {
                        $scope.events[j] = list[i];
                        updated.push(list[i]);
                        break;
                    }
                }
                if (j >= $scope.events.length) {
                    $scope.events.push(list[i]);
                    updated.push(list[i]);
                }
            }
        }

        return updated;
    };

    $timeout(function () {$element.find('.scroll-pane').jScrollPane({ autoReinitialise: true });}, 100);
    $rootScope.$on('graphResized', function (e, w, h) {
        var boxStatRightCont = $element.find('.boxStatRightCont'),
            height = h + 150;
        if ($(document).width() < 1250) {
            boxStatRightCont.css("height", height - 24 + "px");
        } else {
            boxStatRightCont.css("height", height - 30 + "px");
        }
    });
}]);
app.controller('DelayCtrl', ['$scope', function ($scope) {
    $scope.type = 'delay';
    $scope.graphMeta = {options: {renderer: 'line', interpolation: 'basis'}};
    $scope.init();
    $scope.$on('$destroy', function() {
        $scope.saveParameters();
    });
}]);
app.controller('ResponseCtrl', ['$scope', function ($scope) {
    $scope.type = 'response';
    $scope.init();
    $scope.$on('$destroy', function() {
        $scope.saveParameters();
    });
}]);
app.controller('BandwidthCtrl', ['$scope', function ($scope) {
    $scope.type = 'bandwidth';
    $scope.graphMeta = {options: {renderer: 'area'}};
    $scope.init();
    $scope.$on('$destroy', function() {
        $scope.saveParameters();
    });
}]);
app.controller('StatusCtrl', ['$scope', function ($scope) {
    $scope.type = 'status_group';
    $scope.init();
    $scope.$on('$destroy', function() {
        $scope.saveParameters();
    });
}]);
app.controller('SessionCtrl', ['$scope', function ($scope) {
    $scope.type = 'active-sessions';
    $scope.init();
    $scope.$on('$destroy', function() {
        $scope.saveParameters();
    });
}]);
app.controller('HostilityCtrl', ['$scope', function ($scope) {
    $scope.type = 'hostility';
    $scope.graphMeta = {options: {renderer: 'line', interpolation: 'basis'}};
    $scope.init();
    $scope.$on('$destroy', function() {
        $scope.saveParameters();
    });
}]);

app.controller('EventsFilterCtrl', function($scope, $rootScope) {
    var types = ['inc', 'rule', 'remind', 'system'];

    $scope.newEventsFlags = {};

    $scope.setEventType = function(type) {
        $scope.eventFilter.type = type;
    };

    $rootScope.$on('eventsUpdated', function() {
        var i;
        for (i = 0; i < types.length; i++) {
            $scope.newEventsFlags[types[i]] = $scope.newEvents(types[i]);
        }
        $scope.newEventsNum = $scope.newEventsCount();
    });

    $scope.newEvents = function(type) {
        var i, flag = false;

        switch (type) {
            case 'rule':
                for (i = 0; i < $scope.events.length; i++) {
                    if (($scope.events[i].$$type == 'rule') && ($scope.events[i].status === 'OPEN') && !$scope.events[i].$$read) {
                        flag = true;
                        break;
                    }
                }
                break;
        }
        return flag;
    };

    $scope.newEventsCount = function() {
        var i, count = 0;

        for (i = 0; i < $scope.events.length; i++) {
            if (!$scope.events[i].$$read && ($scope.events[i].status == 'OPEN')) {
                count++;
            }
        }
        return count;
    };
});

app.controller('EventsListCtrl', function($scope, $q, $timeout, $rootScope, $location, events, fetchAsync, serverTimeToMoment) {

    $q.all($scope.userPromise, $scope.timezonePromise).then(function() {
        $scope.getWebappEvents().then(function() {
            $scope.updateTimes();
            $scope.updateRead();
            $rootScope.$on('eventsListUpdate', $scope.updateEventsList);
        });
    });

    $scope.updateTimes = function(list) {
        var i, d, event, m;
        list = list || $scope.events;
        for (i = 0; i < list.length; i++) {
            event = list[i];
            m = serverTimeToMoment(event.update_time);
            d = moment.tz($scope.timezone.zone).diff(m, 'days', true);

            if (d < 1) {
                event.$$update_time = m.fromNow();
            } else if (d < 14) {
                event.$$update_time = m.calendar();
            } else {
                event.$$update_time = m.format('D.MM.YYYY');
            }
        }
        $timeout.cancel($scope.timesTimeout);
        $scope.timesTimeout = $timeout($scope.updateTimes, 60000);
    };

    $scope.updateRead = function(list) {
        var i, event;
        list = list || $scope.events;
        $rootScope.$emit('eventsUpdated');
    };

    $scope.updateEvent = function(event, newData) {
        $scope.events.splice($scope.events.indexOf(event), 1);
        $scope.events.push(newData);
        $scope.updateTimes();
        $scope.updateRead();
    };

    $scope.updateEventsList = function(evt, newData) {
        var updated;
        updated = $scope.updateWebappEvents(newData);

        if (updated.length > 0) {
            $scope.updateTimes(updated);
            $scope.updateRead(updated);
        }
    };

    $scope.ignore = function(event) {
        events.ignoreEvent(event, $scope.userId).then(function(newData) {
            $scope.updateEvent(event, newData);
        })
    };

    $scope.close = function(event) {
        events.closeEvent(event, $scope.userId).then(function(newData) {
            $scope.updateEvent(event, newData);
        })
    };

    function getEventUrl(event) {
        if (!event) {return;}
        var obj = {global: {event: event.obj_id}},
            str = '/events/#!#';
        str += encodeURI(angular.toJson(obj));
        return str;
    }

    $scope.getEventUrl = getEventUrl;

    $scope.showDetails = function(event, $event) {
        if ($event.ctrlKey || $event.metaKey || $event.button == 1) {
            return;
        }
        if (event.view_points.indexOf($scope.userId) < 0) {
            events.markEventRead(event, $scope.userId).then(function(newData) {
                $scope.updateEvent(event, newData);
                window.location = getEventUrl(event);
            })
        } else {
            window.location = getEventUrl(event);
        }
    };
});