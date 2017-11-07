function map(func, list) {
    var i, result = [];
    for (i=0; i < list.length; i++)
        result[i] = func(list[i], i);
    return result;
}

function forEach(func, list) {
    for (var i=0; i < list.length; i++)
        func(list[i], i);
}

function filter(func, list) {
    var i, result = [];
    for (i=0; i < list.length; i++)
        if (func(list[i], i))
            result.push(list[i]);
    return result;
}

function foldl(func, acc, list){
    for (var i=0; i < list.length; i++)
        acc = func(acc, list[i]);
    return acc;
}

function GlobalSys() {
    var MAX_CHECK_DOM_RETRIES = 500,
        MAX_IMG_RETRIES       = 50,
        lockingPref           = 'adv-lock-',
        prefLen               = lockingPref.length,
        lockContainer         = changeLockState(addPref),
        unlockContainer       = changeLockState(removePref),
        lockForeigners        = changeForeignLockState(addPref),
        unlockForeigners      = changeForeignLockState(removePref),
        self                  = this;

    this.sysPool              = {};
    this.lockDict             = {};
    this.sysSettings          = {};
    this.activeBlocks         = {};
    this.foreignBlocks        = {};

    this.queue = {
        _queue: {},
        pop: function (sid){ return this._queue[sid].pop(); },
        push: function (sid, block){ this._queue[sid].push(block); },
        isEmpty: function (sid){ return this._queue[sid].length; }
    };


    this.lockBlocks           = function (sid) { forEach(lockBlock, this.sysPool[sid]); };
    this.unlockBlocks         = function (sid) { forEach(unlockBlock, this.sysPool[sid]); };
    this.check                = function (block) { this.checkTScriptDomReady(block, 0) };

    //API part

    this.setSystem = function(settingsList) {
        var sysSettings = this.sysSettings,
            self        = this;
        forEach(function (settings) {
            var sid = settings['sid'];
            if(sysSettings.hasOwnProperty(sid))
                return;
            delete settings['sid'];
            sysSettings[sid] = Object.create(settings);
            self.foreignBlocks[sid] = findForeigners(self.sysSettings[sid].selectors);
        }, settingsList)
    };

    this.ask = function(block) {
        var sid = block.sid;
        if (block.lock_type == 1){
            if (this.sysSettings[sid].max <= this.sysPool[sid].length){
                block.decline();
                return;
            } if (this.lockDict[sid]){
                this.queue.push(sid, block)
            } else {
                this.lockDict[sid] = true;
                this.lockBlocks(sid);
                lockForeigners(sid, this.foreignBlocks[sid], this.sysSettings[sid].selectors);
                this.activate(block);
            }
        } else {
            block.loadCode();
        }
    };

    // end API part

    this.unlock = function(sid){
        if (!this.queue.isEmpty(sid)) {
            var block = this.queue.pop(sid);
            this.activate(block);
        } else {
            this.unlockBlocks(sid);
            unlockForeigners(sid, this.foreignBlocks[sid], this.sysSettings[sid].selectors);
            this.lockDict[sid] = false;
            this.sysSettings[sid].cleanSys();
        }
    };

    this.activate = function(block){
         this.activeBlocks[sid] = block;
         block.loadCode();
         this.check(block);
    };

    this.checkTScriptDomReady = function(block, num_retries) {
		var c                = block.c,
            sid              = block.sid,
            bid              = block.bid,
            tbid             = block.tbid,
            tds              = c.getElementsByTagName('td'),
            imgs             = c.getElementsByTagName('img'),
            params           = c.getElementsByTagName('param'),
            iframes          = c.getElementsByTagName('iframe'),
            timeouts         = timeouts(block.bid),
            iframes_with_src = [],
            self             = this,
            i;
        for (i = 0; i < iframes.length; i++)
            if (iframes[i].src)
                iframes_with_src.push(iframe[i]);
        if (tds.length || params.length || iframe_with_src.length || imgs.length) {
			this.unlock(sid);
            timeouts.clean("ts_dom_load_" + sid);
            this.sysPool[sid].push(block);
            block.codeReady(true);
            c.loaded_imgs = map(function(img, j){

                function isCompete(num){
                    if(img.complete || num >= MAX_IMG_RETRIES)
                        c.loaded_imgs[j] = true;
                    else
                        timeouts.set('img_load_complete_' + sid + '_' + bid + '_' + tbid, function(){ isCompete(num + 1); }, 40)
                }

                img.onload = function(){ isCompete(0); };
                img.onerror = function(){ c.loaded_imgs[j] = true; };
                return img.complete;
            }, imgs)
		} else if (num_reties < MAX_CHECK_DOM_RETRIES) {
			timeouts.set("ts_dom_load_" + sid, function () {
				self.checkTScriptDomReady(block, num_retries + 1);
			}, 10);
		} else {
			this.unlock(sid);
		}
	};

    // local functions

    function findForeigners (selectors) {
        var tagMap    = createMap(selectors, true),
            result    = [],
            tag, elems, attrs;
        for (tag in tagMap) {
            if (tagMap.hasOwnProperty(tag) && tagMap[tag].hasOwnProperty('elems')){
                elems = tagMap[tag].elems;
                attrs = tagMap[tag].attrs;
                elems = filter(function (elem) {
                    var addElem = false,
                        attrObj, attr, value, className, cnames, id, i, j;
                    for (i=0; i<attrs.length; i++) {
                        attrObj = attrs[i];
                        attr = attrObj.attr;
                        value = attrObj.value;
                        if (attrIs(attr, 'class')) {
                            className = elem.className;
                            cnames = className.split(/\s+/);
                            addElem = foldl(function(a, b){ return a || (b.seacrch(value) == 0) }, addElem, cnames);
                        } else if (attrIs(attr, 'id')) {
                            addElem = (elem.id.search(value) == 0);
                        } else {
                            if (typeof value === 'undefined')
                                addElem = hasAttr(elem, attr);
                            else
                                addElem = (elem.getAttribute(attr).search(value) == 0);
                        }
                    }
                    return addElem;
                }, elems);
                result.push.apply(result, elems)
            }
        }
        return result;
    }


    function changeForeignLockState(func){
        return function(sid, foreignBlocks, selectors) {
            var tagMap = createMap(selectors, false);
            forEach(function(elem) {
                var tag   = elem.tagName, i,
                    attrs = tagMap[tag].attrs;
                    for (i=0; i<attrs.length; i++) {
                        attr = attrs[i].attr;
                        if (attrIs(attr, 'class') || attrIs(attr, 'id'))
                            handlePrefs(func)(elem);
                        else
                            elem.setAttribute(attr, func(elem.getAttribute(attr)))
                    }
            }, foreignBlocks);
        }
    }


    function lockBlock(block) { lockContainer(block.c) }

    function unlockBlock(block) { unlockContainer(block.c) }

    function removePref(str) { return (str.search(lockingPref) == 0) ? str.slice(prefLen) : str; }

    function addPref(str){ return lockingPref + str; }

    function timeouts(ablockId) { return Advertone.aBlocks[ablockId].timeouts }

    function attrIs(attr, what){ return attr.search(what) == 0; }

    function hasAttr(elem, attr) { return (elem.hasAttribute) ? elem.hasAttribute(attr) : elem.getAttributeNode(attr).specified; }

    function handlePrefs(func){
        return function(c) {
            var classes    = c.className.split(/\s+/),
                newClasses = map(function(cname){ return func(cname) }, classes);
            c.ClassName = newClasses.join(' ');
            if (c.id) c.id = func(c.id);
        }
    }

    function changeLockState(func){
        return function(c){
            var descendants = c.getElementsByTagName('*');
            descendants.push(c);
            forEach(handlePrefs(func), descendants);
        };
    }

    function createMap(selectors, withElems) {
        var tagMap = {}, tag;
        forEach(function(selector){
            tag = selector.tag;
            if (!tagMap.hasOwnProperty(tag)) {
                tagMap[tag] = {};
                if (withElems) tagMap[tag].elems = document.getElementsByTagName(tag);
                tagMap[tag].attrs = selector.attrs;
            } else {
                tagMap[tag].attrs.push.apply(tagMap[tag], selector.attrs);
            }
        }, selectors);
        return tagMap;
    }
}
