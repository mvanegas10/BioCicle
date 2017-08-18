var CSVtoTree = function (path_separator, name, size, img){
	var retObj = this;
	var sep = path_separator=== undefined ? "/" : path_separator;

	retObj.maxLeafs = undefined;

	var dNodes;
	var root = {
		"label": "/",
		"path": "",
		"id": "",
		"value": 0,
		"children": []
	};
	dNodes = d3.map();
	dNodes.set('', root);

	function addChildren(parent, path, d) {
		var node = {
			"label": d!== undefined && name!== undefined ? d[name] : path[path.length-1],
			"path": path.join(path_separator),
			"value": 0
		};

		// node.id = path.join(path_separator).replace(/\//g, "_") + "_" + node.label;
		node.id = path.join(path_separator).replace(/\//g, "_");

		if (d!== undefined && size!==undefined)  node.value = d[size];
		if (d!== undefined && img!==undefined)  node.img = d[img];

		if (d!==undefined) {
			node.node = d;
		}

		if (parent.children === undefined) {
			parent.children = [];
		}
		parent.children.push(node);
		dNodes.set(path.join(path_separator), node);
		return node;
	}

	function getNodeOrCreate(path ) {
		if (dNodes.has(path.join(path_separator))) {
			return dNodes.get(path.join(path_separator));
		} else {
			var parent = getNodeOrCreate(path.slice(0, path.length - 1 ));
			var node = addChildren(parent, path );
			return node;
		}
	}

	function limitLeafs(node) {
		if (retObj.maxLeafs===undefined) {
			return;
		}

		var childrenLeafs, childrenNonLeaf;

		if (node.children) {
			node.children.forEach(function (c) { limitLeafs(c); });

			childrenLeafs = node.children.filter(function (d) { return !d.children; });
			childrenNonLeafs = node.children.filter(function (d) { return d.children; });

			node.children = childrenNonLeafs.concat(childrenLeafs.slice(0, retObj.maxLeafs));
		}

	}

    function accumulate(d) {
        if (d.children && d.children.length !== 0) {
            d.value = d.children.reduce(function(p, v) { return p + accumulate(v); }, 0);
        }
        return d.value;
    }


	retObj.getTreeWithHierarchy = function (csv, hierarchy) {
		function getPath(n) {
			return hierarchy.map(function (h) { return n[h]; });
		}
		csv.forEach(function (d) {
			var path = getPath(d);
			var parent = getNodeOrCreate(path.slice(0, path.length - 1 ));
			addChildren(parent,  path, d);
		});

		limitLeafs(root);
		return root;
	}; //retObj.getTreeWithHierarchy


	retObj.getTreeWithPath = function (csv, path) {
		if (path===undefined) {
			path = "path";
		}
		function getPath(n) {
			return n[path].split(path_separator);
		}

		csv.forEach(function (d) {
			var path = getPath(d);
			var parent = getNodeOrCreate(path.slice(0, path.length - 1 ));
			addChildren(parent,  path, d);
		});

		limitLeafs(root);
		accumulate(root);
		return root;
	}; //retObj.getTreeWithPath

	return retObj;
};

