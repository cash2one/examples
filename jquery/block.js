function PlayClass (action, activationUrl) {

    function btnAppearance (elem) {
        elem.data("action", this.action).attr("title", this.hrefTitle);
        elem.find('i').removeClass("icon-video-pause-red").removeClass("icon-video-play-green").addClass(this.btn);
        elem.parent().find("span.ts-rate-title").css("color", this.color(elem));
    }

    function ratePlay (elem) {
        var title = elem.data("ts");
        $("#slide-" + title).slider("value", this.val());
        this.btnAppearance(elem);
        this.disable(title)
    }

    function disable (title) {
        console.log(this.flag);
        $("#range-" + title).prop("disabled", this.flag);
        $("#slide-" + title).slider("option", "disabled", this.flag);
    }

    function sendPost (elem) {
        var pk = elem.data("pk");
        var ts = elem.data("ts");
        var r = this.getCallbackAndUrl(ts);
        $.post(r.url, {"block_pks": [pk], "active": this.post}, function () {
            r.callback(elem)
        })
    }

    function getCallbackAndUrl (ts) {
        if (ts === undefined){
            return {callback: this.playAll(this), url: this.activationUrl}
        }
        else{
            return {callback: this.playSingle(), url: this.activationUrl + ts + "/"}
        }
    }

    function playAll() {
        var playObj = this;
        return function (elem) {
            var pk = elem.data("pk");
            playObj.btnAppearance(elem);
            $(".local-play-" + pk).each(function () {
                playObj.btnAppearance($(this))
            })
        }
    }

    function playSingle() {
        var playObj = this;
        return function (elem) {
            var pk = elem.data("pk");
            playObj.btnAppearance(elem);
            playObj.last(pk)
        }
    }

    function globalPlay () {
        off();
        var val = this.val(100);
        var playObj = this;
        $(".play-block").each(function (i) {
            var ts = $(this).data("ts");
            playObj.btnAppearance(elem);
            playObj.disable(ts);
            $("#range-" + ts).val(val);
            $("#slide-" + ts).slider("value", val);
        });
        redrawPlot();
        on();
    }

    function last (pk) {
        if(countActive(pk) === this.post){
            var gp = $("#global-play-" + pk);
            this.btnAppearance(gp)
        }
    }

    function Play () { }
    Play.prototype.activationUrl = activationUrl;
    Play.prototype.btnAppearance = btnAppearance;
    Play.prototype.ratePlay = ratePlay;
    Play.prototype.disable = disable;
    Play.prototype.sendPost = sendPost;
    Play.prototype.globalPlay = globalPlay;
    Play.prototype.getCallbackAndUrl = getCallbackAndUrl;
    Play.prototype.last = last;
    Play.prototype.playSingle = playSingle;
    Play.prototype.playAll = playAll;

    function StartPlay () {
        this.hrefTitle = "запустить";
        this.action = "start";
        this.btn = "icon-video-play-green";
        this.color = function () {
            return "#C7C6C4";
        };
        this.post = 0;
        this.flag = true;
    }
    extend(StartPlay, Play);
    StartPlay.prototype.val = function () {return 0;};
    StartPlay.prototype.singlePlay = function(elem){
        if (countActive() === 1){
            off();
            var ts = elem.data("ts");
            $("#range-" + ts).val(0);
        }
        this.ratePlay(elem);
        if (countActive() === 0){
            on();
            redrawPlot();
        }
    };

    function StopPlay () {
        this.hrefTitle = "запустить";
        this.action = "start";
        this.btn = "icon-video-play-green";
        this.color = function (elem) {return "#C7C6C4";};
        this.post = 0;
        this.flag = true;
    }

    StopPlay.prototype.val = function () {return 0;};
    StopPlay.prototype.singlePlay = function (elem) {
        if  (countActive() === 1) {
            off();
            var ts = elem.data("ts");
            $("#range-" + ts).val(0);
        }
        this.ratePlay(elem);
        if  (countActive() === 0) {
            on();
            redrawPlot();
        }
    };
    extend(StopPlay, Play);
    return new {stop: StopPlay, start: StartPlay}[action];
}

//utils

function getBlocks(pk) {
    var selector = (pk === undefined) ? ".play-block" : ".local-play-" + pk;
    return $(selector);
}

function getActiveTs(pk) {
    return getBlocks(pk).filter(function () {
        return $(this).data("action") == "stop";
    });
}

function countActive(pk) {
    return getActiveTs(pk).length;
}
