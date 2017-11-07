(function() {
    "use strict";
    var app = angular.module('draggableModal', []);
    app.directive('draggableModalHandle', function($document) {
        "use strict";
        return function(scope, element) {
            var i, l, parents, initialPositioningInterval,
                draggableElement = null,
                windowElement = angular.element(window),
                dragHandle = element;

            parents = element.parents();
            for (i = 0, l = parents.length; i < l; i++) {
                if (parents[i].classList.contains('modal-dialog') ||
                    parents[i].classList.contains('ngdialog-content')) {
                    draggableElement = angular.element(parents[i]);
                    break;
                }
            }
            if (!draggableElement) {
                return null;
            }
            draggableElement.addClass('draggable-modal-window');

            function initialPosition() {
                var width = draggableElement.width();
                if (width == 0) {return;}
                draggableElement.css(
                    {
                        top: '30px',
                        left: ((windowElement.width() - width) / 2) + 'px'
                    }
                );
                clearInterval(initialPositioningInterval);
            }

            initialPositioningInterval = setInterval(initialPosition, 16);

            dragHandle.addClass('draggable-modal-window-handle');
            runDraggable();
            function runDraggable() {
                var dx, dy,
                    minX = 0, minY = 0, maxX, maxY;
                dragHandle.on('mousedown', function(event) {
                    var pos;
                    // event.preventDefault(); // TODO: fix behavior
                    pos = draggableElement.position();
                    dx = event.screenX - pos.left;
                    dy = event.screenY - pos.top;
                    maxX = windowElement.width() - draggableElement.width();
                    maxY = windowElement.height() - dragHandle.height();
                    $document.on('mousemove', mousemove);
                    $document.on('mouseup', mouseup);
                });

                function mousemove(event) {
                    var x, y;
                    x = Math.max(Math.min(event.screenX - dx, maxX), minX);
                    y = Math.max(Math.min(event.screenY - dy, maxY), minY);

                    draggableElement.css(
                        {
                            left: x + 'px',
                            top: y + 'px'
                        }
                    );
                }

                function mouseup() {
                    $document.unbind('mousemove', mousemove);
                    $document.unbind('mouseup', mouseup);
                }
            }
        }
    });
})();