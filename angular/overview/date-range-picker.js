(function () {
    var app;
    app = angular.module('dateRangePicker', []);
    app.directive('periodChoice', function () {
        return {
            templateUrl: 'period-choice.html',
            restrict: 'E',
            replace: true,
            controller: function ($scope) {
                var now, diffHours, diffDays, diffMonth;
                $scope.period = undefined;
                $scope.incorrectDates = false;
                if (!$scope.dateRange) {
                    $scope.dateRange = {
                        from: undefined,
                        to: undefined
                    };
                    $scope.period = 'hour';
                }
                else {
                    if (!$scope.dateRange.to) {
                        now = moment.tz($scope.timezone.zone);
                        diffHours = now.diff($scope.dateRange.from, 'hours');
                        diffDays = now.diff($scope.dateRange.from, 'days');
                        diffMonth = now.diff($scope.dateRange.from, 'month');
                        if (diffMonth == 1) {
                            $scope.period = 'month';
                        }
                        else if (diffDays == 7) {
                            $scope.period = 'week';
                        }
                        else if (diffDays == 1) {
                            $scope.period = 'day';
                        }
                        else if (diffHours == 1 || !$scope.dateRange.from) {
                            $scope.period = 'hour';
                        }
                    }
                }
                $scope.setGraphInterval = function (intervalType) {
                    var from, to, fromIsMoment, toIsMoment,
                        now = moment(),
                        range = rangeFromIntervalType(intervalType);
                    from = $scope.dateRange.from = range[0];
                    to = $scope.dateRange.to = range[1];
                    fromIsMoment = moment.isMoment(from);
                    toIsMoment = moment.isMoment(to);
                    if (fromIsMoment && toIsMoment) {
                        $scope.incorrectDates = from.isAfter(to);
                    }
                    else if (fromIsMoment && !toIsMoment) {
                        $scope.incorrectDates = from.isAfter(now);
                    }
                    else if (!fromIsMoment && toIsMoment) {
                        $scope.incorrectDates = false;
                    }
                    else {
                        $scope.incorrectDates = false;
                    }
                    if (!$scope.incorrectDates) {
                        $scope.getData();
                        $scope.$broadcast('filterUpdated');
                    }
                };

                function rangeFromIntervalType(intervalType) {
                    $scope.period = intervalType;
                    var from = moment.tz($scope.timezone.zone);
                    switch (intervalType) {
                        case 'hour' :
                            from.hours(from.hours() - 1);
                            break;
                        case 'day'  :
                            from.date(from.date() - 1);
                            break;
                        case 'week' :
                            from.date(from.date() - 7);
                            break;
                        case 'month':
                            from.month(from.month() - 1);
                            break;
                        default:
                            return [$scope.dateRange.from, $scope.dateRange.to];
                    }
                    return [from];
                }

                $scope.dateFromFilter = function(d) {
                    if (!$scope.dateRange.to || (d < $scope.dateRange.to)) {
                        return true;
                    } else {
                        return 'The beginning of the period couldn\'t be later than the end of it';
                    }
                };

                $scope.dateToFilter = function(d) {
                    if (!$scope.dateRange.from || (d > $scope.dateRange.from) || d == null) {
                        return true;
                    } else {
                        return 'The end of the period couldn\'t be earlier than the beginning of it';
                    }
                };
            }
        }
    });
})();

