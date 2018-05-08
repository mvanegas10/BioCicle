import * as d3 from 'd3';

var CONFIG = require('../config/config.json');


export function post(path, data) {
  // var url = `${CONFIG.BACKEND_URL}${path}`;
  var url = `/${path}`;
  console.log(`POSTING to ${url} with data ${data}`);

  return fetch( url, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  })
  .then((response) => response.json())
  .catch(error => console.error('Error:', error))
  .then((response) => {
    
    return new Promise((resolve, reject) => {

      if (response.Error)
        reject(response.Error);
      else
        resolve(response);

    });  

  });

}


export function filter(threshold, root, dendogram) {
  console.log('Changing threshold ', threshold);
  console.log('   Merged tree ', root);


  return new Promise((resolve, reject) => {

    var options = {
      mergedTree: JSON.stringify(root),
      threshold: threshold
    };

    post('post_prune_trees', options).then((output) => {
      var prunedOutput = {};

      prunedOutput.prunedSequences = output.pruned_sequences;
      prunedOutput.prunedTree = output.pruned_tree;
      prunedOutput.hierarchies = {};

      console.log('   Pruned tree', prunedOutput.prunedSequences);

      prunedOutput.prunedTree._children = prunedOutput.prunedTree.children;

      var dendoHierarchy = d3.hierarchy(prunedOutput.prunedTree)
        .sum(function(d) { return d.children; });

      dendogram.draw(dendoHierarchy);

      prunedOutput.prunedSequences.forEach((sequence) => {
        var sequence_id = sequence['sequence_id']

        var icicleHierarchy = d3.hierarchy(sequence['hierarchy'])
          .sum(function(d) { 
            return d.value? d.value[sequence_id]: undefined;
          });
        prunedOutput.hierarchies[sequence_id] = icicleHierarchy;

      });

      prunedOutput.prunedSequences = prunedOutput.prunedSequences.map((sequence) => {return sequence['sequence_id']});

      resolve( prunedOutput ); 

    })
    .catch((error) => {

      console.error(error);

    });

  });

}