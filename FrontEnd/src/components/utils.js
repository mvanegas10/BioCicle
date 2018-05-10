import * as d3 from 'd3';
import { Icicle } from './icicle';

var CONFIG = require('../config/config.json');

function prune(node, threshold) {
  var leaves = node.leaves();
  for (let leave of leaves) {
    if (leave.value < threshold) {
      console.log('Leave ', leave.value);
      var parent = leave.parent;
      while (parent) {
        if (parent.value === leave.value) {
          let parentsParent = parent.parent;
          let index = parentsParent.children.indexOf(leave);
          if (index !== -1) parentsParent.children.splice(index, 1);
        }
        else {
          let index = parent.children.indexOf(leave);
          if (index !== -1) parent.children.splice(index, 1);
          parent.value -= leave.value;
        }
        parent = (leave.parent)? leave.parent: undefined;
      }
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
  console.log(parent)
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

    console.log(model)
  
    let icicle = new Icicle();

    icicle.draw(
        `#${model.sequence_id.replace(':','')}`, 
        model.hierarchy, 
        model.sequence_id,
        selectIcicle);
    
  }


}


export function filter(threshold, hierarchyNode, root, dendogram) {
  console.log('Changing threshold ', threshold);
  console.log('   Merged tree ', root);


  console.log(' Before', hierarchyNode);
  console.log(' After', prune(hierarchyNode['sp:WAP_RAT'], threshold));

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