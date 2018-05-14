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


function pruneLeaves(node, threshold, total) {

  var leaves = node.leaves().slice();

  for (let leave of leaves) {

    let currentValue = (leave.value/total) * 100;
    if (currentValue < threshold) {
      leave.parent.children = remove(leave, leave.parent.children);
      leave.parent = undefined;
    }

  }
  return node;
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

      var tmpOutput = {
        sequence_id: sequence_id,
        max: hierarchyNode[sequence_id].max,
      };

      var hierarchyCopy = hierarchyNode[sequence_id].hierarchy.copy();

      var prunedHierarchy = pruneLeaves(
          hierarchyCopy,
          threshold,
          hierarchyNode[sequence_id].total);

      if (prunedHierarchy !== undefined) {

        console.log(prunedHierarchy);

        prunedHierarchy._children = hierarchyNode[sequence_id].hierarchy.children.slice().map(a => Object.assign({}, a)); 

        tmpOutput.hierarchy = prunedHierarchy;

        let values = prunedHierarchy.leaves().map((leave) => leave.value);
        let total = (values && values.length > 0)? values.reduce((accum, val) => accum + val): 0;

        tmpOutput.total = total;

        output.hierarchies[sequence_id] = tmpOutput;
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