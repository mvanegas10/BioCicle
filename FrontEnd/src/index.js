import React from 'react';
import ReactDOM from 'react-dom';
import * as d3 from "d3";

var CONFIG = require('./config/config.json');

class Form extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sequence: "",
      countAttr: "NAME",
      countFunction: "splitWords",
    };

     this.handleAttrChange = this.handleAttrChange.bind(this);
     this.handleFuncChange = this.handleFuncChange.bind(this);
     this.handleSequenceChange = this.handleSequenceChange.bind(this);
     this.handleSequenceClick = this.handleSequenceClick.bind(this);
  }

  handleAttrChange(event) {
    this.setState({countAttr: event.target.value});
  }

  handleFuncChange(event) {
    this.setState({countFunction: event.target.value});
  }

  handleSequenceChange(event) {
    this.setState({sequence: event.target.value});
  }

  handleSequenceClick(event) {
    if(this.state.sequence) {
      var sequences = [];
      sequences.push(this.state.sequence);

      var url = `${CONFIG.BACKEND_URL}post_compare_sequence`;

      post(url, { sequences:sequences }).then((alignments) => {

        console.log(alignments)

        var first = alignments.shift();

        var tree = createTree(first);

        alignments.push(first);

        if(alignments) {

          console.log(tree);

          redrawIcicle(tree);

          d3.interval(function(){

            var next = alignments.shift();

            alignments.push(next);

            tree = createTree(next);

            console.log(tree);

            if(alignments.length > 0) return redrawIcicle(tree);

          }, 10000) 

        }
      
      }).catch((error) => {
      
        console.error(error);
      
      });
    }

  }

  render() {
    return (
      <div>
        <div className="form-count">
          <select value={this.state.countAttr} onChange={this.handleAttrChange}>
            <option value="name">Name</option>
            <option value="organism">Organism</option>
            <option value="family">Family</option>
            <option value="species">Species</option>
            <option value="order">Order</option>
            <option value="genus">Genus</option>
            <option value="class">Class</option>
          </select>
          <select value={this.state.countFunction} onChange={this.handleFuncChange}>
            <option value="splitWords">Split word</option>
            <option value="firstWord">First word</option>
            <option value="fullPhrase">Full name</option>
          </select>
        </div>
        <div className="form-sequence">
          <input type="text" value={this.state.sequence} onChange={this.handleSequenceChange}/>
        </div>
        <div className="form-sequence">
          <button onClick={this.handleSequenceClick}>Align Sequence</button>
        </div>
      </div>
    );
  }
}

class Body extends React.Component {
  render() {
    return (
      <div className="icicle">
      </div>
    );
  } 
}

class Vis extends React.Component {
  render() {
    return (
      <div className="vis">
        <div className="vis-form">
          <Form />
        </div>
        <div className="vis-body">
          <Body />
        </div>
      </div>
    );
  }
}

function redrawIcicle(root) {

  d3.select('.icicle').html('');

  var width = 1000,
  height = 1000;

  var x = d3.scaleLinear()
      .range([0, width]);

  var y = d3.scaleLinear()
      .range([0, height]);

  var color = d3.scaleOrdinal(d3.schemeCategory20c);

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
    .sort(function(a, b) { return b.value - a.value; });
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
      .attr("fill", function(d) { return color((d.children ? d : d.parent).data.key); })
      .on("click", clicked);
    
  var text = barsEnter.append("text")
    .attr("x", function(d) { return d.y0; })
      .attr("y", function(d) { return d.x0 + (d.x1 - d.x0)/2; })
        .attr("dy", ".35em")
    .text(function (d) { 
      return typeof(d.data.value) !== "object"? d.data.key + "(" + d.data.value + ")": d.data.key + ": " + Math.round(treeLength(d) * 100)/100 });
  
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

// ========================================

ReactDOM.render(
  <Vis />,
  document.getElementById('root')
);

function createTree(data) {
  var tree = {"Class":{}};
  data.forEach(function(d){
    if(!tree.Class[d.CLASS]) tree.Class[d.CLASS] = {};
    if(!tree.Class[d.CLASS][d.ORDER]) tree.Class[d.CLASS][d.ORDER] = {};
    if(!tree.Class[d.CLASS][d.ORDER][d.FAMILY]) tree.Class[d.CLASS][d.ORDER][d.FAMILY] = {};
    if(!tree.Class[d.CLASS][d.ORDER][d.FAMILY][d.GENUS]) tree.Class[d.CLASS][d.ORDER][d.FAMILY][d.GENUS] = {};
    if(!tree.Class[d.CLASS][d.ORDER][d.FAMILY][d.GENUS][d.SPECIES]) tree.Class[d.CLASS][d.ORDER][d.FAMILY][d.GENUS][d.SPECIES] = {};
    if(!tree.Class[d.CLASS][d.ORDER][d.FAMILY][d.GENUS][d.SPECIES][d.ORGANISM]) tree.Class[d.CLASS][d.ORDER][d.FAMILY][d.GENUS][d.SPECIES][d.ORGANISM] = {};
    if(!tree.Class[d.CLASS][d.ORDER][d.FAMILY][d.GENUS][d.SPECIES][d.ORGANISM][d.NAME]) tree.Class[d.CLASS][d.ORDER][d.FAMILY][d.GENUS][d.SPECIES][d.ORGANISM][d.NAME] = d.SCORE;
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

function post(url, data) {
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
