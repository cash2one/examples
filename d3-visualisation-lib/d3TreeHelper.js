d3TreeHelper = function() {

    var treeHelper = {};

    // Gets the maximum tree depth
    treeHelper.getTreeDepth = function(tree){
        var key, height,
            maxHeight = 0;
        if(!tree.hasOwnProperty('children')){
            return 1;
        }
        for (key in tree.children) if (tree.children.hasOwnProperty(key)) {
            height = 1 + treeHelper.getTreeDepth(tree.children[key]);
            if (maxHeight < height) {
                maxHeight = height;
            }
        }
        return maxHeight;
    };

    // Gets tree width
    treeHelper.getTreeWidth = function(d, kx) {
        var hierarchy = d3.layout.hierarchy().sort(null).value(null),
            nodes = hierarchy.call(this, d),
            root0 = nodes[0],
            root1 = wrapTree(root0);

        kx = kx || 270;

        d3_layout_hierarchyVisitAfter(root1, firstWalk), root1.parent.m = -root1.z;
        d3_layout_hierarchyVisitBefore(root1, secondWalk);


        var left = root0,
            right = root0;

        d3_layout_hierarchyVisitBefore(root0, function (node) {
            if (node.x < left.x) left = node;
            if (node.x > right.x) right = node;
        });

        var tx = separation(left, right) / 2 - left.x;

        return kx *  (right.x + separation(right, left) / 2 + tx);
    };

    function d3_layout_hierarchyVisitBefore(node, callback) {
        var nodes = [ node ];
        while ((node = nodes.pop()) != null) {
            callback(node);
            if ((children = node.children) && (n = children.length)) {
                var n, children;
                while (--n >= 0) nodes.push(children[n]);
            }
        }
    }

    function d3_layout_hierarchyVisitAfter(node, callback) {
        var nodes = [ node ], nodes2 = [];
        while ((node = nodes.pop()) != null) {
            nodes2.push(node);
            if ((children = node.children) && (n = children.length)) {
                var i = -1, n, children;
                while (++i < n) nodes.push(children[i]);
            }
        }
        while ((node = nodes2.pop()) != null) {
            callback(node);
        }
    }

    function d3_layout_treeLeft(v) {
        var children = v.children;
        return children.length ? children[0] : v.t;
    }

    function d3_layout_treeRight(v) {
        var children = v.children, n;
        return (n = children.length) ? children[n - 1] : v.t;
    }

    function d3_layout_treeMove(wm, wp, shift) {
        var change = shift / (wp.i - wm.i);
        wp.c -= change;
        wp.s += shift;
        wm.c += change;
        wp.z += shift;
        wp.m += shift;
    }

    function d3_layout_treeAncestor(vim, v, ancestor) {
        return vim.a.parent === v.parent ? vim.a : ancestor;
    }

    function d3_layout_treeShift(v) {
        var shift = 0, change = 0, children = v.children, i = children.length, w;
        while (--i >= 0) {
            w = children[i];
            w.z += shift;
            w.m += shift;
            shift += w.s + (change += w.c);
        }
    }

    function separation(a, b) {
      return a.parent == b.parent ? 1 : 1;
    }

    function apportion(v, w, ancestor) {
        if (w) {
            var vip = v,
                vop = v,
                vim = w,
                vom = vip.parent.children[0],
                sip = vip.m,
                sop = vop.m,
                sim = vim.m,
                som = vom.m,
                shift;
            while (vim = d3_layout_treeRight(vim), vip = d3_layout_treeLeft(vip), vim && vip) {
                vom = d3_layout_treeLeft(vom);
                vop = d3_layout_treeRight(vop);
                vop.a = v;
                shift = vim.z + sim - vip.z - sip + separation(vim._, vip._);
                if (shift > 0) {
                    d3_layout_treeMove(d3_layout_treeAncestor(vim, v, ancestor), v, shift);
                    sip += shift;
                    sop += shift;
                }
                sim += vim.m;
                sip += vip.m;
                som += vom.m;
                sop += vop.m;
            }
            if (vim && !d3_layout_treeRight(vop)) {
                vop.t = vim;
                vop.m += sim - sop;
            }
            if (vip && !d3_layout_treeLeft(vom)) {
                vom.t = vip;
                vom.m += sip - som;
                ancestor = v;
            }
        }
        return ancestor;
    }

    function firstWalk(v) {
        var children = v.children,
            siblings = v.parent.children,
            w = v.i ? siblings[v.i - 1] : null;
        if (children.length) {
            d3_layout_treeShift(v);
            var midpoint = (children[0].z + children[children.length - 1].z) / 2;
            if (w) {
                v.z = w.z + separation(v._, w._);
                v.m = v.z - midpoint;
            } else {
                v.z = midpoint;
            }
        } else if (w) {
            v.z = w.z + separation(v._, w._);
        }
        v.parent.A = apportion(v, w, v.parent.A || siblings[0]);
    }

    function secondWalk(v) {
        v._.x = v.z + v.parent.m;
        v.m += v.parent.m;
    }

    function wrapTree(root0) {
        var root1 = {A: null, children: [root0]},
            queue = [root1],
            node1;

        while ((node1 = queue.pop()) != null) {
            for (var children = node1.children, child, i = 0, n = children.length; i < n; ++i) {
                queue.push((children[i] = child = {
                    _: children[i], // source node
                    parent: node1,
                    children: (child = children[i].children) && child.slice() || [],
                    A: null, // default ancestor
                    a: null, // ancestor
                    z: 0, // prelim
                    m: 0, // mod
                    c: 0, // change
                    s: 0, // shift
                    t: null, // thread
                    i: i // number
                }).a = child);
            }
        }

        return root1.children[0];
    }

    return treeHelper;
};