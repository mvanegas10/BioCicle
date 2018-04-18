import * as d3 from 'd3';

const colorPalette = [
  '#797979',
  '#68687F',
  '#7C8993',
  '#A6BE98',
  '#C7B671',
  '#C17A6E',
  '#AB6C62',
  '#75604F',
  '#BFBEBD'
];

var colorDict = {};

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

  var width = 1200,
  height = 1200;

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

  root = d3.hierarchy(root)
    .sum(function(d) { return d.value; });

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
        if(colorDict[d.data.name]) return colorDict[d.data.name];
        else if(d.parent) {
          if(!d.parent.parent) {
            colorDict[d.data.name] = color(d.data.name);
            return colorDict[d.data.name];
          }
          else {
            var parentColor;
            var count = 0;
            var parent = d.parent;
            while (parent.parent) {
              count ++;
              parentColor = colorDict[parent.data.name];
              parent = parent.parent;
            }
            colorDict[d.data.name] = d3.rgb(parentColor).brighter(0.3 + (0.3 * count));
            return colorDict[d.data.name];
          }
        }
        else {
          colorDict[d.data.name] = color(d.data.name);
          return colorDict[d.data.name];
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
    .text(function (d) { return d.data.name + "(" + Math.round(d.data.SCORE * 100)/100 + "%)" });
  
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

export function changeThreshold(threshold) {
  console.log('Changing threshold ', threshold)
}