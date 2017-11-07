var rickshawChartModule = angular.module('rickshawChart', ['dashboardUtils']);
rickshawChartModule.directive('rickshawChart', function($compile, $rootScope, graphColors, seriesTransformer, LegendHover, Legend, rickshawZoom, RickshawTz) {
    return {
        scope: {
            options: '=',
            features: '=',
            data: '=',
            timezone: '=',
            onZoom: '&',
            onAfterRender: '&',
            graph: '='
        },
        templateUrl: 'graph.html',
        restrict: 'E',
        replace: true,
        link: function postLink(scope, elem, attrs) {
            draw();
            var watch = scope.$watch('data.series', function (newVal, oldVal) {
                if (!angular.equals(newVal, oldVal) && newVal && newVal.length) {
                    if (seriesTransformer.needsTransformation(scope.options)) {
                        seriesTransformer.transform(newVal)
                    }
                    draw();
                }
            }, 1);

            scope.$on('$destroy', function () {
                watch();
            });

            function draw() {
                setColor();
                var elems = new HtmlElems,
                    graph = new Rickshaw.Graph(_.merge({},
                        scope.options,
                        {
                            series: scope.data.series,
                            element: elems.graph[0]
                        }
                    )),
                    gWidth,
                    gHeight,
                    p1 = elems.base.parent().parent().parent().parent(),
                    p2 = p1.parent(),
                    loadingElement = elems.graph.parent().next();

                scope.graph = graph;
                
                function resize() {
                    gWidth = p1.width() - 64;
                    gHeight = gWidth * (7/16);
                    p2.height(gHeight + 162);
                    graph.configure({ width: gWidth, height: gHeight });
                    graph.render();
                    elems.graph[0].style.width = gWidth + 'px';
                    elems.graph[0].style.height = gHeight + 'px';
                    loadingElement[0].style.width = (gWidth + 40) + 'px';
                    loadingElement[0].style.height = (gHeight + 74) + 'px';
                    elems.legend[0].style.top = gHeight + 30 + 'px';
                    elems.legend[0].style.width = gWidth + 'px';
                    $rootScope.$emit('graphResized', gWidth, gHeight);
                }


                if (scope.features) {
                    setHover();
                    setXAxis();
                    setYAxis();
                    setLabel();
                }

                resize();
                window.addEventListener('resize', resize);

                scope.onAfterRender();

                var RangeSelector = new Rickshaw.Graph.RangeSelector({
                    graph: graph,
                    onZoom: function (e) {
                        scope.onZoom({from: new Date(e.position.xMin*1000), to: new Date(e.position.xMax*1000)});
                    }
                });

                function setHover () {
                    var Hover,
                        zone = scope.timezone.zone;
                    if (scope.features.hover) {
                        Hover = LegendHover.getClass();
                        return new Hover(
                            config(
                                {
                                    onHide: function () {
                                        var element;
                                        element = document.querySelector('.graphInfoBox');
                                        if (element) element.classList.remove('active');
                                        element = document.querySelector('.graphPoint');
                                        if (element) element.classList.remove('active');
                                    },
                                    xFormatter: function (x) { return moment.tz(x * 1000, zone).format('lll'); },
                                    yFormatter: function (y) { return y === null ? 0 : y.toFixed(2); }
                                }
                            )
                        );
                    }
                }

                function setLabel () {
                    var LegendClass = Legend.getClass(
                            {
                                afterElement: function () {
                                    var a = $compile('<a></a>')(scope),
                                        s = $compile('<span></span>')(scope),
                                        data = graph.series[0].data,
                                        from = (moment(data[0].x * 1000)),
                                        to = (moment(data[data.length - 1].x * 1000)),
                                        obj;
                                    obj = {
                                        'tx-log': {
                                            date_time_from: from,
                                            date_time_to: to
                                        }
                                    };
                                    a.attr('href', '/webapp/#!/' + scope.data.webapp_id + '/tx-log#' + encodeURI(angular.toJson(obj)));
                                    a.addClass('tx-btn');
                                    a.addClass('tx-btnGreen');
                                    a.append($compile("<span>{{ 'graph.transactions' | translate }}: </span>")(scope));
                                    s.append($compile("<span>" + scope.data.total_transactions + "</span>")(scope));
                                    a.append(s);
                                    return a[0];
                                }
                            }
                        ),
                        legend;
                    if (scope.features.legend) {
                        legend = new LegendClass({
                                                graph: graph,
                                                element: elems.legend[0]
                                            });
                        if (scope.features.legend.toggle) {
                            new Rickshaw.Graph.Behavior.Series.Toggle(config({legend: legend}));
                        }
                        if (scope.features.legend.highlight) {
                            new Rickshaw.Graph.Behavior.Series.Highlight(config({legend: legend}));
                        }
                    }
                }

                function setXAxis () {
                    setAxis(
                        'x', 'Time',
                        {timeUnit: (new Rickshaw.Fixtures.Time.Tz(scope.timezone.zone)).unit(scope.features.xAxis.timeUnit),
                         timeFixture: new Rickshaw.Fixtures.Time.Tz(scope.timezone.zone)}
                    );
                }

                function setYAxis () {
                    setAxis(
                        'y', 'Y',
                        {
                            tickFormat: Rickshaw.Fixtures.Number[scope.features.yAxis.tickFormat],
                            element: elems.yAxis[0]
                        }
                    );
                }

                function setAxis(letter, rickshawProp, extra) {
                    var axis,
                        name = letter + 'Axis',
                        features = scope.features[name];
                    if (features) {
                        axis = new Rickshaw.Graph.Axis[rickshawProp](
                            config(features, extra)
                        );
                        axis.render();
                    }
                }

                function HtmlElems() {
                    this.base = angular.element(elem);
                    this.base.empty();
                    this.graph = $compile('<div class="chart"></div>')(scope);
                    this.xAxis = $compile('<div class="x-axis"></div>')(scope);
                    this.yAxis = $compile('<div class="y-axis"></div>')(scope);
                    this.legend = $compile('<div class="graphInfo"></div>')(scope);
                    this.base.append(this.graph);
                    this.base.append(this.xAxis);
                    this.base.append(this.yAxis);
                    this.base.append(this.legend);
                }

                function setColor () {
                    var palette = new Rickshaw.Color.Palette({scheme: 'colorwheel'});
                    scope.data.series.forEach(function (data) {
                        data.color = graphColors[data.name] || palette.color()
                    });
                }

                function config () {
                    var base = _({graph: graph});
                    return base.merge.apply(base, arguments).value()
                }
            }
        }
    };
});
rickshawChartModule.directive('zoomArrows', function () {
    return {
        templateUrl: 'zoom-arrows.html',
        restrict: 'E',
        replace: true,
        link: function (scope, elem, attrs) {

        }
    }
});
rickshawChartModule.value('graphMeta', {
    options : {
        renderer: 'bar',
        width: 700,
        height: 166
    },
    features : {
        yAxis: {
            orientation: 'left',
            tickFormat: 'formatKMBT'
        },
        xAxis: {
            orientation: 'bottom'
        },
        hover: {
        },
        legend: {
            toggle: true,
            highlight: true
        }
    }
});
rickshawChartModule.value('graphColors', {
    '2xx': '#73c03a',
    '4xx': '#F3C11B',
    '5xx': '#cb513a',
    'PASS': '#73c03a',
    'MODIFY': '#F3C11B',
    'BLOCK': '#cb513a',
    'Active sessions': '#6874a3',
    'In (bytes)' : '#6874a3',
    'Out (bytes)' : '#0067f4',
    'App delay': '#6874a3',
    'Processing delay' : '#0067f4'
});
rickshawChartModule.factory('seriesTransformer', function () {
    return {
        transform:function (series) {
            series.forEach(function (seriesElem) {
                var stepX = seriesElem.data[1].x - seriesElem.data[0].x,
                    notZeroValued = _.reject(seriesElem.data, {y: null});
                if (notZeroValued.length) {
                    notZeroValued.unshift({
                        y: notZeroValued[0].y,
                        x: seriesElem.data[0].x - stepX
                    });
                    notZeroValued.push({
                        y: _.last(notZeroValued).y,
                        x: _.last(seriesElem.data).x + stepX
                    }); // add edge elements for horizontal line
                    seriesElem.data = _.foldl(notZeroValued, function (newDataList, elem) {
                        if (!newDataList.length) return [elem];
                        var last = _.last(newDataList),
                            deltaX = elem.x - last.x,
                            deltaY = elem.y - last.y,
                            numSteps = deltaX / stepX,
                            stepY = deltaY / numSteps,
                            missedSteps = _.range(1, numSteps).map(function (i) {return {
                                y: last.y + stepY * i,
                                x: last.x + stepX * i
                            }});
                        return newDataList.concat(missedSteps).concat([elem])
                    }, []).slice(1, -1);
                }
            })
        },
        needsTransformation: function (options) {
            return options.renderer == 'line'
        }
    }
});
rickshawChartModule.factory('LegendHover', function ($filter, classNamesTranslator) {
    return {
        getClass: function () {
            return Rickshaw.Class.create(Rickshaw.Graph.HoverDetail, {
                formatter: function (series, a, b, c, d, e) {
                    var index, date, ul, content,
                        self = this,
                        translate = $filter('translate');
                    index = e.series.data.indexOf(e.value);
                    date = document.createElement('strong');
                    date.appendChild(document.createTextNode(this.xFormatter(a)));
                    ul = document.createElement('ul');
                    this.graph.series.forEach(function (series) {
                        var li, name,
                            localized_stat_name = translate(classNamesTranslator([series.name], 'graph_data.', true)[0].text);
                        li = document.createElement('li');
                        name = document.createElement('strong');
                        name.style.color = series.color;
                        name.appendChild(document.createTextNode(localized_stat_name + ':'));
                        li.appendChild(name);
                        li.appendChild(document.createTextNode(' ' + self.yFormatter(series.data[index].y)));
                        ul.appendChild(li);
                    });
                    content = document.createElement('div');
                    content.appendChild(date);
                    content.appendChild(ul);
                    return content.innerHTML;
                },
                render: function (args) {
                    function findPos(obj) {
                        var curleft, curtop;
                        curleft = curtop = 0;
                        if (obj && obj.offsetParent) {
                            do {
                                curleft += obj.offsetLeft;
                                curtop += obj.offsetTop;
                            } while (obj = obj.offsetParent);
                        }
                        return [curleft, curtop];
                    }

                    var dot, left, top, actualY, series, item, formattedYValue, formattedXValue, point, points;

                    points = args.points;
                    point = points.filter(function (p) { return p.active }).shift();

                    if (point.value.y === null) return;

                    formattedXValue = point.formattedXValue;
                    formattedYValue = point.formattedYValue;

                    this.element.innerHTML = '';

//                    var xLabel = document.createElement('div');

//                    xLabel.className = 'x_label';
//                    xLabel.innerHTML = formattedXValue;
//                    this.element.appendChild(xLabel);

                    item = document.querySelector('.graphInfoBox') || document.createElement('div');

//                    item.className = 'item';

                    // invert the scale if this series displays using a scale
                    series = point.series;
                    actualY = series.scale ? series.scale.invert(point.value.y) : point.value.y;

                    item.innerHTML = this.formatter(series, point.value.x, actualY, formattedXValue, formattedYValue, point);
                    top = this.graph.y(point.value.y0 + point.value.y) + findPos(this.graph.element)[1];
                    left = findPos(this.element)[0];
                    item.style.top = top + 'px';
                    item.style.left = left + 'px';

                    if (!item.parentNode) {
                        document.body.appendChild(item);
                    }

                    dot = document.querySelector('.graphInfoBoxDot') || document.createElement('div');

                    dot.className = 'graphPoint dot graphInfoBoxDot';
                    dot.style.top = item.style.top;
                    dot.style.left = item.style.left;
                    dot.style.borderColor = series.color;

                    if (!dot.parentNode) {
                        document.body.appendChild(dot);
                    }

                    if (point.active) {
                        item.classList.add('active');
                        item.classList.add('graphInfoBox');
                        item.classList.add('graphInfoBoxCont');
                        dot.classList.add('active');
                    }

                    // Assume left alignment until the element has been displayed and
                    // bounding box calculations are possible.
//                    var alignables = [/*xLabel, */item];
//                    alignables.forEach(function (el) {
//                        el.classList.add('left');
//                    });

                    this.show();

                    // If left-alignment results in any error, try right-alignment.
//                    var leftAlignError = this._calcLayoutError(alignables);
//                    if (leftAlignError > 0) {
//                        alignables.forEach(function (el) {
//                            el.classList.remove('left');
//                            el.classList.add('right');
//                        });

                        // If right-alignment is worse than left alignment, switch back.
//                        var rightAlignError = this._calcLayoutError(alignables);
//                        if (rightAlignError > leftAlignError) {
//                            alignables.forEach(function (el) {
//                                el.classList.remove('right');
//                                el.classList.add('left');
//                            });
//                        }
//                    }

                    if (typeof this.onRender == 'function') {
                        this.onRender(args);
                    }
                }
            });
        }
    }
});
rickshawChartModule.factory('Legend', function () {
    return {
        getClass: function (options) {
            return Rickshaw.Class.create(Rickshaw.Graph.Legend, {
                initialize: function (args) {
                    this.element = args.element;
                    this.graph = args.graph;
                    this.naturalOrder = args.naturalOrder;

//                    this.element.classList.add(this.className);

                    this.list = document.createElement('ul');
                    this.list.classList.add('graphParam');
                    this.element.appendChild(this.list);

                    this.render();

                    // we could bind this.render.bind(this) here
                    // but triggering the re-render would lose the added
                    // behavior of the series toggle
                    this.graph.onUpdate(function () {});
                },
                render: function () {
                    var self = this;

                    while (this.list.firstChild) {
                        this.list.removeChild(this.list.firstChild);
                    }
                    this.lines = [];

                    var series = this.graph.series
                        .map(function (s) { return s });

                    if (!this.naturalOrder) {
                        series = series.reverse();
                    }

                    series.forEach(function (s) {
                        self.addLine(s);
                    });

                    if (options.afterElement){
                        this.element.appendChild(options.afterElement());
                    }
                },
                addLine: function (series) {
                    var line = document.createElement('li');
                    line.className = 'line';
                    if (series.disabled) {
                        line.className += ' disabled';
                    }
                    if (series.className) {
                        d3.select(line).classed(series.className, true);
                    }

//                    var label = document.createElement('span');
//                    label.className = 'label';
//                    label.innerHTML = series.name;
                    var label = document.createTextNode(series.localized_name);

                    line.appendChild(label);

                    var swatch = document.createElement('span');
                    swatch.className = 'paramColor';
                    swatch.style.backgroundColor = series.color;

                    line.appendChild(swatch);

                    this.list.appendChild(line);

                    line.series = series;

                    if (series.noLegend) {
                        line.style.display = 'none';
                    }

                    var _line = { element: line, series: series };
                    if (this.shelving) {
                        this.shelving.addAnchor(_line);
                        this.shelving.updateBehaviour();
                    }
                    if (this.highlighter) {
                        this.highlighter.addHighlightEvents(_line);
                    }
                    this.lines.push(_line);
                    return line;
                }
            });
        }
    }
});
rickshawChartModule.factory('rickshawZoom', function (Enum) {
    var extrmums = Enum('Min', 'Max');

    function offset(e, axis) {
        axis = axis.toUpperCase();
        return e['offset' + axis] !== undefined ? e['offset' + axis] : e['layer' + axis]
    }

    function isEmpty(val) {return val === undefined || val === ''}

    Rickshaw.namespace('Rickshaw.Graph.RangeSelector');
    Rickshaw.Graph.RangeSelector = Rickshaw.Class.create({
        initialize: function (args) {
            this.graph = args.graph;
            this.onZoom = args.onZoom;
            this.start = args.start;
            this.end = args.end;
            this.position = {};
            this.selectionBox = document.createElement('div');
            this.selectionControl = false;
            this.parent = this.graph.element.getElementsByTagName('svg')[0];
            this.tDomain = _(this.graph.stackedData).flatten().map('x').value();
            this.build(this.start, this.end);
        },
        build: function (start, end) {
            var self = this,
                graph = this.graph,
                position = this.position,
                selectionBox = this.selectionBox,
                selectionControl = this.selectionControl,
                parent = this.parent;
            selectionBox.setAttribute('class', 'rickshaw_range_selector');
            graph.element.appendChild(selectionBox);

            setExtremum(start, extrmums.Min);
            setExtremum(end, extrmums.Max);
            setGraphEvents();

            function setGraphEvents () {
                parent.oncontextmenu = function (e) { e.preventDefault(); };
                graph.element.addEventListener('mousedown', startDrawing, true);
                graph.element.addEventListener('mouseup', finishDrawing, false);
                graph.element.addEventListener('mouseleave', function (e) {
                    self.clearSelection();
                    finishDrawing(e)
                }, false);

                graph.onUpdate(function () {
                    self.update(position.xMin, position.xMax);
                });
            }

            function setExtremum (val, direction) {
                var ex = 'x' + extrmums.invert[direction];
                position[ex] = isEmpty(val) ? graph.dataDomain()[direction]: val;
                graph.window[ex] = position[ex];
            }

            function selectionDraw(startPointX) {
                if (selectionControl) {
                    parent.style.pointerEvents = 'none';
                }
                graph.element.style.cursor = 'crosshair';
                graph.element.addEventListener('mousemove', function (e) {
                    if (selectionControl) {
                        position.x = offset(e, 'x');
                        position.deltaX = Math.round(Math.max(position.x, startPointX) - Math.min(position.x, startPointX));
                        position.minX = Math.min(position.x, startPointX);
                        position.maxX = position.minX + position.deltaX;
                        selectionBox.style.transition = 'none';
                        selectionBox.style.opacity = '1';
                        selectionBox.style.width = position.deltaX + 'px';
                        selectionBox.style.background = 'red';
                        selectionBox.style.height = '10px';
                        selectionBox.style.marginLeft = position.minX + 'px';
                    }
                }, false);
            }

            function startDrawing(e) {
                e.stopPropagation();
                e.preventDefault();
                switch (e.button) {
                    case 0:
                    case 1: /* left */
                        var offsetX = offset(e, 'x'),
                            startPointX = offsetX;
                        selectionBox.style.marginLeft = offsetX + 'px';
                        selectionControl = true;
                        return selectionDraw(startPointX);
                    case 2:
                    case 3: /* right */
                        e.preventDefault();
                        var start = graph.dataDomain()[0],
                            end = graph.dataDomain()[1];
                        return self.zoomTo(start, end);
                    default:
                        return
                }
            }

            function finishDrawing(e) {
                if (!selectionControl || position.deltaX < 10) {
                    selectionControl = false;
                    self.clearSelection();
                    return false;
                }
                selectionControl = false;
                var start = graph.x.invert(position.minX),
                    end = graph.x.invert(position.maxX);
                self.zoomTo(start, end);
            }
        },
        clearSelection: function () {
            var selectionBox = this.selectionBox,
                parent = this.parent,
                graph = this.graph;
            selectionBox.style.transition = 'opacity 0.2s ease-out';
            selectionBox.style.opacity = 0;
            setTimeout(function () {
                selectionBox.style.width = 0;
                selectionBox.style.height = 0;
                selectionBox.style.top = 0;
                selectionBox.style.marginLeft = 0;
            }, 200);
            parent.style.pointerEvents = 'auto';
            graph.element.style.cursor = 'auto';
        },
        update: function (start, end) {
            var graph = this.graph,
                position = this.position,
                tDomain = this.tDomain;
            var getNearest = function (timestamp) {
                var nearest = null;
                var bestDistanceFound = Number.MAX_VALUE;
                for (var i = 0; i < tDomain.length; i += 1) {
                    if (tDomain[i] === timestamp) {
                        return tDomain[i];
                    } else {
                        var d = Math.abs(timestamp - tDomain[i]);
                        if (d < bestDistanceFound) {
                            bestDistanceFound = d;
                            nearest = tDomain[i];
                        }
                    }
                }
                return nearest;
            };
            var starting = getNearest(start);
            var ending = getNearest(end);
            if (starting === ending) {
                return;
            } else {
                graph.window.xMin = starting;
                graph.window.xMax = ending;
                if (graph.window.xMin === null) {
                    position.xMin = graph.dataDomain()[0];
                }
                if (graph.window.xMax === null) {
                    position.xMax = graph.dataDomain()[1];
                }
                position.xMin = graph.window.xMin;
                position.xMax = graph.window.xMax;
            }
            return position;
        },
        zoomTo: function (start, end) {
            var graph = this.graph,
                position = this.position,
                e = {
                    type: 'zoomToCall'
                };
            if (isNaN(start) || isNaN(end)) {return;}
            position.xMin = start;
            position.xMax = end;
            e.position = position;
            this.onZoom(e);
            graph.update(start, end);
            this.clearSelection();
            graph.update(start, end);
        }
    });

    return Rickshaw.Graph.RangeSelector;
});
rickshawChartModule.factory('RickshawTz', function() {

    Rickshaw.namespace('Rickshaw.Fixtures.Time.Tz');

    Rickshaw.Fixtures.Time.Tz = function(zone) {

        var self = this;

        this.months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        this.units = [
            {
                name: 'decade',
                seconds: 86400 * 365.25 * 10,
                formatter: function(d) { return (parseInt(moment.utc(d).tz(zone).year() / 10, 10) * 10) }
            }, {
                name: 'year',
                seconds: 86400 * 365.25,
                formatter: function(d) { return moment.utc(d).tz(zone).year() }
            }, {
                name: 'month',
                seconds: 86400 * 30.5,
                formatter: function(d) { return self.months[moment.utc(d).tz(zone).month()] }
            }, {
                name: 'week',
                seconds: 86400 * 7,
                formatter: function(d) { return moment.utc(d).tz(zone).format('MMM D') }
            }, {
                name: 'day',
                seconds: 86400,
                formatter: function(d) { return moment.utc(d).tz(zone).format('D') }
            }, {
                name: '6 hour',
                seconds: 3600 * 6,
                formatter: function(d) { return self.formatTime(d) }
            }, {
                name: 'hour',
                seconds: 3600,
                formatter: function(d) { return self.formatTime(d) }
            }, {
                name: '15 minute',
                seconds: 60 * 15,
                formatter: function(d) { return self.formatTime(d) }
            }, {
                name: 'minute',
                seconds: 60,
                formatter: function(d) { return moment.utc(d).tz(zone).minute() }
            }, {
                name: '15 second',
                seconds: 15,
                formatter: function(d) { return moment.utc(d).tz(zone).second() + 's' }
            }, {
                name: 'second',
                seconds: 1,
                formatter: function(d) { return moment.utc(d).tz(zone).second() + 's' }
            }, {
                name: 'decisecond',
                seconds: 1/10,
                formatter: function(d) { return moment.utc(d).tz(zone).milliseconds() + 'ms' }
            }, {
                name: 'centisecond',
                seconds: 1/100,
                formatter: function(d) { return moment.utc(d).tz(zone).milliseconds() + 'ms' }
            }
        ];

        this.unit = function(unitName) {
            return this.units.filter( function(unit) { return unitName == unit.name } ).shift();
        };

        this.formatTime = function(d) {
            return moment.utc(d).tz(zone).format('HH:mm');
        };

        this.ceil = function(time, unit) {

            var date, floor, year;

            if (unit.name == 'month') {

                date = moment.tz(time * 1000, zone);

                floor = moment.tz(date, zone).set({'date': 1, 'hour': 0, 'minute': 0, 'second': 0, 'millisecond': 0}).valueOf() / 1000;
                if (floor == time) return time;

                year = date.year();
                var month = date.month();

                if (month == 11) {
                    month = 0;
                    year = year + 1;
                } else {
                    month += 1;
                }

                return moment.tz(zone).set({'year': year, 'month': month, 'date': 1, 'hour': 0, 'minute': 0, 'second': 0, 'millisecond': 0}).valueOf() / 1000;
            }

            if (unit.name == 'year') {

                date = moment.tz(time * 1000, zone);

                floor = moment.tz(date, zone).set({'month': 0, 'date': 1, 'hour': 0, 'minute': 0, 'second': 0, 'millisecond': 0}).valueOf() / 1000;
                if (floor == time) return time;

                year = date.year() + 1;

                return moment.tz(zone).set({'year': year, 'month': 0, 'date': 1, 'hour': 0, 'minute': 0, 'second': 0, 'millisecond': 0}).valueOf() / 1000;
            }

            return Math.ceil(time / unit.seconds) * unit.seconds;
        };
    };

    return Rickshaw.Fixtures.Time.Tz;
});
