var app = angular.module('overviewUtils', ['dashboardUtils']);
app.factory('mergeSeries', function (processSeries) {
    return function (oldData, newData) {
        oldData.forEach(function (oldSeries) {
            var newSeries = processSeries(newData[oldSeries.name]);
            delete oldSeries.data.pop();
            delete oldSeries.data.pop();
            delete oldSeries.data.shift(); // delete first and 2 last entries
            oldSeries.data = oldSeries.data.concat(newSeries);
        });
        return oldData.slice();
    }
});
app.factory('processRickshawData', function ($filter, classNamesTranslator, processSeries) {
    var translate = $filter('translate');
    return function (data) {
        return _.map(data, function (val, stat_name) {
            var localized_stat_name = translate(classNamesTranslator([stat_name], 'graph_data.', true)[0].text);
            return {
                name: stat_name,
                localized_name: localized_stat_name,
                data: processSeries(val)
            }
        });
    }
});
app.factory('processSeries', function () {
    return function (series) {
        return series.map(function (cur) { return {x: cur[0], y: cur[1]} })
    }
});
app.factory('DataApi', function ($http, toPyTimestamp) {
    return function (graphType, appId) {
        var url = '/graphs/' + graphType + '/' + appId + '/';
        return {
            fetch: function (tmFrom, tmTo, resolution) {
                return $http(
                    {
                        method: 'GET',
                        url: url,
                        params: {
                            dt_from: toPyTimestamp(tmFrom),
                            dt_to: toPyTimestamp(tmTo),
                            resolution: resolution
                        }
                    }
                )
            }
        }
    }
});
app.factory('toPyTimestamp', function () {
    return function (tm) {
        if (angular.isDate(tm)) {
            return tm && Math.round(+tm / 1000);
        } else {
            return tm && Math.round(tm.valueOf() / 1000);
        }
    };
});
app.factory('autoUpdate', function ($timeout, mergeSeries, latestInSeries, deltaFromResolution) {
    return function (api, scopeData, timeout, beforeRender) {
        var autoUpdate;

        function initUpdate() {
            autoUpdate = update();
        }

        function update() {
            return $timeout(function() {
                var latest, delta, from, to, p;
                if (scopeData.resolution !== undefined) {
                    latest = latestInSeries(scopeData.series);
                    delta = deltaFromResolution(scopeData.resolution);
                    from = latest - delta;
                    to = latest + delta;
                    p = api.fetch(from, to, scopeData.resolution);
                    p.success(function(data) {
                        if (beforeRender) {
                            beforeRender();
                        }
                        scopeData.series = mergeSeries(scopeData.series, data.value.series);
                        initUpdate();
                    });
                    p.error(initUpdate);
                }
            }, timeout || deltaFromResolution(scopeData.resolution));
        }

        return function (newVal, oldVal) {
            if (newVal != oldVal) {
                if (newVal) {
                    autoUpdate = update();
                } else {
                    $timeout.cancel(autoUpdate);
                }
                return autoUpdate;
            }
        }
    }
});
app.factory('latestInSeries', function () {
    return function (series) {
        return _.max(
            series.map(function (series) {
                return _.last(series.data).x * 1000; // to js timestamp in millis
            })
        );
    };
});
app.factory('deltaFromResolution', function (Enum) {
    var resols = Enum('second', 'minute', 'hour', 'day', 'week'),
        resolutionToDelta = {};
    resolutionToDelta[resols.second] = 1000;
    resolutionToDelta[resols.minute] = resolutionToDelta[resols.second] * 60;
    resolutionToDelta[resols.hour  ] = resolutionToDelta[resols.minute] * 60;
    resolutionToDelta[resols.day   ] = resolutionToDelta[resols.hour  ] * 24;
    resolutionToDelta[resols.week  ] = resolutionToDelta[resols.day   ] * 7;
    return function (resolution) {
        return resolutionToDelta[resolution];
    }
});
app.factory('hostilityApi', function ($http) {
    var HOSTILITY_URL = '/webapps/hostility_list/';
    return {
        get: function () {
            return $http(
                {
                    method: "GET",
                    url: HOSTILITY_URL
                }
            );
        }
    }
});
app.factory('modeApi', function ($http) {
    var MODE_URL = '/webapps/mode_list/';
    return {
        get: function () {
            return $http(
                {
                    method: "GET",
                    url: MODE_URL
                }
            );
        }
    }
});
app.factory('rulesCountersApi', function ($http) {
    var RULES_COUNT_URL_BASE = '/decision_rule/counters/';
    return {
        get: function (webapp_id) {
            return $http(
                {
                    method: 'GET',
                    url: RULES_COUNT_URL_BASE + webapp_id + '/'
                }
            )
        }
    }
});