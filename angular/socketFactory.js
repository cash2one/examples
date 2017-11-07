app.factory('socket', function ($rootScope) {
    var socket;

    function safeApply (fn) {
        var phase = $rootScope.$$phase;
        if(phase == '$apply' || phase == '$digest') {
            fn();
        } else {
            $rootScope.$apply(fn);
        }
    }

    return {
        connect: function(namespace) {
            socket = io.connect(namespace);
        },
        on: function (eventName, callback) {
            socket.on(eventName, function() {
                var args = arguments;
                safeApply(function() {
                    callback.apply(socket, args);
                });
            });
        },
        emit: function (eventName, data, callback) {
            socket.emit(eventName, data, function() {
                var args = arguments;
                safeApply(function() {
                    if (callback) {
                        callback.apply(socket, args);
                    }
                });
            });
        },
        getRawSocketNamespace: function() {
            return socket;
        }
    };
});