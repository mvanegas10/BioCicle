import * as d3 from 'd3';

const colorPalette = [
  '#5C5D71',
  '#6E7A83',
  '#93A987',
  '#B1A265',
  '#BF783F',
  '#AB6C62',
  '#75604F',
  '#BFBEBD'
];

var colorDict = {};

export function createTree(data) {
  var phylum = data[0].PHYLUM; 
  var tree = {};
  tree[phylum] = {};
  data.forEach(function(d){
    if(!tree[phylum][d.CLASS]) tree[phylum][d.CLASS] = {};
    if(!tree[phylum][d.CLASS][d.ORDER]) tree[phylum][d.CLASS][d.ORDER] = {};
    if(!tree[phylum][d.CLASS][d.ORDER][d.FAMILY]) tree[phylum][d.CLASS][d.ORDER][d.FAMILY] = {};
    if(!tree[phylum][d.CLASS][d.ORDER][d.FAMILY][d.GENUS]) tree[phylum][d.CLASS][d.ORDER][d.FAMILY][d.GENUS] = {};
    if(!tree[phylum][d.CLASS][d.ORDER][d.FAMILY][d.GENUS][d.SPECIES]) tree[phylum][d.CLASS][d.ORDER][d.FAMILY][d.GENUS][d.SPECIES] = d.SCORE;
    /*if(!tree[phylum][d.CLASS][d.ORDER][d.FAMILY][d.GENUS][d.SPECIES][d.ORGANISM]) tree[phylum][d.CLASS][d.ORDER][d.FAMILY][d.GENUS][d.SPECIES][d.ORGANISM] = {};
    if(!tree[phylum][d.CLASS][d.ORDER][d.FAMILY][d.GENUS][d.SPECIES][d.ORGANISM][d.NAME]) tree[phylum][d.CLASS][d.ORDER][d.FAMILY][d.GENUS][d.SPECIES][d.ORGANISM][d.NAME] = d.SCORE;*/
  });
  return tree;
}

function treeLength(parent) {
  var count = 0;
  if(!parent.children) {
    count += isNaN(+parent.data.value)? 0.0 : +parent.data.value;
  }
  else {
    parent.children.forEach(function(child) {
      count += treeLength(child);
    })
  }
  return count;
}

export function post(url, data) {
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

export function redrawIcicle(root) {

  d3.select('.icicle').html('');

  var width = 1000,
  height = 1000;

  var x = d3.scaleLinear()
      .range([0, width]);

  var y = d3.scaleLinear()
      .range([0, height]);

  var color = d3.scaleOrdinal(colorPalette);

  var partition = d3.partition()
      .size([width, height])
      .padding(0)
      .round(true);

  var svgIcicle = d3.select(".icicle").append("svg")
      .attr("width", width)
      .attr("height", height);

  root = d3.hierarchy(d3.entries(root)[0], function(d) {
      return d3.entries(d.value)
    })
    .sum(function(d) { return d.value })
    partition(root);

  var bar = svgIcicle.selectAll("g")
      .data(root.descendants());

  var barsEnter = bar.enter()
    .append("g");
  
  var rect = barsEnter.append("rect")
    .attr("x", function(d) { return d.y0; })
      .attr("y", function(d) { return d.x0; })
      .attr("width", function(d) { return d.y1 - d.y0; })
      .attr("height", function(d) { return d.x1 - d.x0; })
      .attr("fill", function(d) { 
        if(colorDict[d.data.key]) return colorDict[d.data.key];
        else if(d.parent) {
          if(!d.parent.parent) {
            colorDict[d.data.key] = color(d.data.key);
            return colorDict[d.data.key];
          }
          else {
            var parentColor;
            var count = 0;
            var parent = d.parent;
            while (parent.parent) {
              count ++;
              parentColor = colorDict[parent.data.key];
              parent = parent.parent;
            }
            colorDict[d.data.key] = d3.rgb(parentColor).brighter(0.32 + (0.32 * count));
            return colorDict[d.data.key];
          }
        }
        else {
          colorDict[d.data.key] = color(d.data.key);
          return colorDict[d.data.key];
        }
      })
      .style("stroke", "#FFF")
      .style("stroke-width", 2)
      .on("click", clicked);
    
  var text = barsEnter.append("text")
    .attr("x", function(d) { return d.y0; })
        .attr("dx", ".35em")
      .attr("y", function(d) { return d.x0 + (d.x1 - d.x0)/2; })
        .attr("dy", ".35em")
    .text(function (d) { 
      return typeof(d.data.value) !== "object"? d.data.key + "(" + d.data.value + ")": d.data.key + "(" + Math.round(treeLength(d) * 100)/100 + ")" });
  
  function clicked(d) {
      x.domain([d.x0, d.x1]);
      y.domain([d.y0, height]).range([d.depth ? 20 : 0, height]);

      rect.transition()
      .duration(750)
      .attr("x", function(d) { return y(d.y0); })
      .attr("y", function(d) { return x(d.x0); })
      .attr("width", function(d) { return y(d.y1) - y(d.y0); })
      .attr("height", function(d) { return x(d.x1) - x(d.x0); });

      text.transition()
      .duration(750)
      .attr("x", function(d) { return y(d.y0); })
      .attr("y", function(d) { return x(d.x0 + (d.x1 - d.x0)/2); });
  }
}
