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

export function filter(threshold, root, dendogram, icicle) {
  console.log('Changing threshold ', threshold);
  console.log('   Merged tree ', root);

  var options = {
    mergedTree: JSON.stringify(root),
    threshold: threshold
  };

  post('post_prune_multiple_trees', options).then((output) => {
    var prunedSequences = output.pruned_sequences;
    var prunedTree = output.pruned_tree;
    console.log('   Pruned tree', prunedSequences);

    prunedTree._children = prunedTree.children;

    var dendoHierarchy = d3.hierarchy(prunedTree)
      .sum(function(d) { return d.children; });

    dendogram.draw(dendoHierarchy);

    var hierarchies = {};

    prunedSequences.forEach((sequence) => {
      var sequence_id = sequence['sequence_id']

      var icicleHierarchy = d3.hierarchy(sequence['hierarchy'])
        .sum(function(d) { 
          return d.value? d.value[sequence_id]: undefined;
        });
      hierarchies[sequence_id] = icicleHierarchy;

    });

    var i = 0;

    console.log(hierarchies);
    
    d3.interval(() => {

      var sequence = prunedSequences[i]['sequence_id'];

      var root = hierarchies[sequence];

      icicle.draw(root, sequence);

      i = (i === (prunedSequences.length - 1))? 0: i+1;

    }, 1000) 
  });

}