import * as d3 from 'd3';

var CONFIG = require('../config/config.json');


export function post(path, data) {
  var url = `${CONFIG.BACKEND_URL}${path}`;
  console.log(`POSTING to ${url} with data ${JSON.stringify(data)}`);

  return fetch( url, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  }).then((response) => response.json());

}

export function changeThreshold(threshold, root, icicle) {
  // console.log('Changing threshold ', threshold);
  // var prunedTree = pruneTree(threshold, root.copy());
  // icicle.draw(prunedTree);

}

export function filter(threshold, root, dendogram) {
  console.log('Changing threshold ', threshold);
  console.log('   Merged tree ', root);

  var options = {
    mergedTree: JSON.stringify(root),
    threshold: threshold
  };

  post('post_prune_multiple_trees', options).then((output) => {
    var prunedTree = output.pruned_tree;
    console.log('   Pruned tree', prunedTree);

    prunedTree._children = prunedTree.children;

    var hierarchy = d3.hierarchy(prunedTree)
      .sum(function(d) { return d.children; });

    dendogram.draw(hierarchy);
  });

}