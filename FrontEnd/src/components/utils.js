import * as d3 from 'd3';
import { Icicle } from './icicle';

var CONFIG = require('../assets/config/config.json');


function remove(element, array) {

  const index = array.indexOf(element);
    
  if (index !== -1) {
      array.splice(index, 1);
  }

  return array;

}


function prune(node) {

  let ancestors = node.ancestors;

  for (let ancestor of ancestors) {

    let parent = ancestor.parent;
    if (ancestor.children.length > 1) {
      
      ancestor.children = remove(parent, ancestor.children);

    }

  }

}


function pruneLeaves(node, threshold) {

  var leaves = node.hierarchy.leaves();
  var preservedNodes = [];
  node.hierarchy.children = [];

  for (let leave of leaves) {
    let ancestors = [];
    
    let currentValue = leave.value/node.total * 100;
    if (currentValue < threshold) {

      prune(leave);
      


      let parent = leave.parent;
      parent.children = remove(leave, parent.children);
      ancestors = parent.ancestors();
    
    }
    else 
      ancestors = leave.ancestors();

    preservedNodes.push(ancestors[ancestors.length - 2]);

  }

  node.hierarchy.children = preservedNodes;
  return node.hierarchy;
}


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


export function drawSparklines(models, selectIcicle) {

  models = Object.values(models)

  let parent = d3.select('.sparklines').html('');
  let width = parent.node().getBoundingClientRect().width;

  let parentNode = parent.selectAll('div')
    .data(models).enter()
    .append('div');

    parentNode.append('p')
      .attr("x", (d) => { return 0; })
      .attr("y", (i, d) => { return (i+1) * width/2; })
      .text((d) => {return d.sequence_id;});

    parentNode.append('svg')
      .attr('width', width)
      .attr('height', width)
      .attr('class', 'sparkline')
      .attr('id', (d) => {return d.sequence_id.replace(':','');});

  for (let model of models) {

    let icicle = new Icicle();

    icicle.draw(
        `#${model.sequence_id.replace(':','')}`, 
        model.hierarchy, 
        model.sequence_id,
        model.total,
        selectIcicle);
    
  }


}


export function filter(threshold, hierarchyNode, idList, root, dendogram) {
  console.log('Changing threshold ', threshold);

  var output = {
    hierarchies: {},
    prunedSequences: [] 
  };

  return new Promise((resolve, reject) => {
    for (let sequence_id of idList) {

      let prunedHierarchy = prune(
          hierarchyNode[sequence_id],
          threshold);
      if (prunedHierarchy !== undefined) {

        hierarchyNode[sequence_id].hierarchy = prunedHierarchy;
        let values = prunedHierarchy.leaves().map((leave) => leave.value);
        let total = values.reduce((accum, val) => accum + val);
        hierarchyNode[sequence_id].total = total;

        output.hierarchies[sequence_id] = hierarchyNode[sequence_id];
        output.prunedSequences.push(sequence_id);

      }
      
    }

    resolve(output);

  });


  // return new Promise((resolve, reject) => {

  //   var options = {
  //     mergedTree: JSON.stringify(root),
  //     threshold: threshold
  //   };

  //   post('post_prune_trees', options).then((output) => {
  //     var prunedOutput = {};

  //     prunedOutput.prunedSequences = output.pruned_sequences;
  //     prunedOutput.prunedTree = output.pruned_tree;
  //     prunedOutput.hierarchies = {};

  //     console.log('   Pruned tree', prunedOutput.prunedSequences);

  //     prunedOutput.prunedTree._children = prunedOutput.prunedTree.children;

  //     var dendoHierarchy = d3.hierarchy(prunedOutput.prunedTree)
  //       .sum(function(d) { return d.children; });

  //     dendogram.draw(dendoHierarchy);

  //     prunedOutput.prunedSequences.forEach((sequence) => {
  //       var sequence_id = sequence['sequence_id']

  //       var icicleHierarchy = d3.hierarchy(sequence['hierarchy'])
  //         .sum(function(d) { 
  //           return d.value? d.value[sequence_id]: undefined;
  //         });
  //       prunedOutput.hierarchies[sequence_id] = icicleHierarchy;

  //     });

  //     prunedOutput.prunedSequences = prunedOutput.prunedSequences.map((sequence) => {return sequence['sequence_id']});

  //     resolve( prunedOutput ); 

  //   })
  //   .catch((error) => {

  //     console.error(error);

  //   });

  // });

}