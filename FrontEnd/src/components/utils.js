import * as d3 from 'd3';
import { Icicle } from './icicle';

var CONFIG = require('../assets/config/config.json');


export function collapseNodes(node) {
  if (node.children) {
    node._children = node.children.slice();
    if (node.children.length > 10)
      node.children = null;

    else {
      let collapsedChildren = [];
      for (let child of node.children) {
        console.log(child)
        collapsedChildren.push(collapseNodes(child));
      }
      node.children = collapsedChildren;
    }
  }
  return node;
}


function prune(node) {

  const leaves = node.copy().leaves().slice();
  let currentNode = undefined;

  for (const leave of leaves) {
    currentNode = leave;

    while (currentNode.data.name !== node.data.name) {

      if (currentNode.depth !== 5 && (currentNode.children === undefined || currentNode.children.length === 0))
        currentNode.parent.children = remove(currentNode, currentNode.parent.children);
      
      currentNode = currentNode.parent;

    }   
    
  }
  return currentNode;
}


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

    let count = 0;
    let sequences = Object.keys(leave.data.value);

    for (let sequence_id of sequences) {
      let currentValue = (leave.data.value[sequence_id]/total[sequence_id]) * 100;
      if (currentValue > threshold) count ++;

    }
    if (count === 0) {

      leave.parent.children = remove(leave, leave.parent.children);
      leave.parent = undefined;
    
    }

  }
  return node;
}


export function post(path, data) {
  var url = `${CONFIG.BACKEND_URL}${path}`;
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
  let icicle = new Icicle();

  let parentNode = parent.selectAll('div')
    .data(models).enter()
    .append('div');

    // parentNode.append('p')
    //   .attr("x", (d) => { return 0; })
    //   .attr("y", (i, d) => { return (i+1) * width/2; })
    //   .text((d) => {return d.sequence_id;});

    parentNode.append('svg')
      .attr('width', width/20)
      .attr('height', width/20)
      .attr('class', 'sparkline')
      .attr('id', (d) => {return d.sequence_id.replace(':','');});

  for (let model of models) {
    icicle.draw(
        model.sequence_id.replace(':',''), 
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

    let totals = {};

    for (let sequence_id of idList) {
    
      totals[sequence_id] = hierarchyNode[sequence_id].total;

      var tmpOutput = {
        sequence_id: sequence_id,
        max: hierarchyNode[sequence_id].max
      };

      let tmpTotal = {};
      tmpTotal[sequence_id] = totals[sequence_id];

      var hierarchyCopy = hierarchyNode[sequence_id].hierarchy.copy();

      var prunedHierarchy = pruneLeaves(
          hierarchyCopy,
          threshold,
          tmpTotal);

      if (prunedHierarchy !== undefined) {

        prunedHierarchy._children = hierarchyNode[sequence_id].hierarchy.children.slice().map(a => Object.assign({}, a)); 

        tmpOutput.hierarchy = prunedHierarchy;
        
        let values = prunedHierarchy.leaves().map((leave) => leave.value);
        let total = (values && values.length > 0)? values.reduce((accum, val) => accum + val): 0;

        tmpOutput.total = total;

        output.hierarchies[sequence_id] = tmpOutput;
        output.prunedSequences.push(sequence_id);

      }
      
    }

    let rootHierarchy = d3.hierarchy(root)
        .sum(function(d) { return d.children; });

    let prunedMerge = prune(pruneLeaves(
      rootHierarchy,
      threshold,
      totals
    ));

    prunedMerge._children = root.children.slice().map(a => Object.assign({}, a));

    dendogram.draw(prunedMerge);

    resolve(output);        

  });

}

