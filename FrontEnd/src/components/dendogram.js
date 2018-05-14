import * as d3 from 'd3';

export class Dendogram {

  constructor(height, click) {
    this.margin = {top: 20, right: 90, bottom: 30, left: 90};
    this.height = height - this.margin.top - this.margin.bottom;
    this.click = click;
  }

  draw(root) {
    var parent = d3.select('.dendogram').html('');

    if (root !== undefined && root.children !== undefined && root.children.length > 0) {

      var width = parent.node().getBoundingClientRect().width;
      this.width = width - this.margin.left - this.margin.right;
      
      this.root = root;

      this.svg = d3.select(".dendogram").append("svg")
          .attr("width", this.width + this.margin.right + this.margin.left)
          .attr("height", this.height + this.margin.top + this.margin.bottom)
        .append("g")
          .attr("transform", "translate(" + 
              this.margin.left + "," + this.margin.top + ")");


      // declares a tree layout and assigns the size
      this.treemap = d3.tree().size([this.height, this.width]);

      // Assigns parent, children, height, depth
      this.root.x0 = this.height / 2;
      this.root.y0 = 0;

      // Collapse after the second level
      // this.root.children.forEach((d) => {this.collapse(d)});

      this.update(this.root);

    }

  }

  update(source) {

    console.log(source);

    var i = 0,
        duration = 750;

    // Assigns the x and y position for the nodes
    var treeData = this.treemap(this.root);

    // Compute the new tree layout.
    var nodes = treeData.descendants(),
        links = treeData.descendants().slice(1);

    // Normalize for fixed-depth.
    nodes.forEach((d) => { d.y = d.depth * 80});

    // ****************** Nodes section ***************************

    // Update the nodes...
    var node = this.svg.selectAll('g.node')
        .data(nodes, (d) => {return d.id || (d.id = ++i); });

    // Enter any new modes at the parent's previous position.
    var nodeEnter = node.enter().append('g')
        .attr('class', 'node')
        .attr("transform", (d) => {
          return "translate(" + source.y0 + "," + source.x0 + ")";
      })
      .on('click', (d) => {this.click(this, d, nodeEnter);});

    // Add Circle for the nodes
    nodeEnter.append('circle')
        .attr('class', 'node')
        .attr('r', 1e-8)
        .style("fill", (d) => {
            return d._children ? "lightsteelblue" : "#fff";
        });

    // Add labels for the nodes
    nodeEnter.append('text')
        .attr("dy", ".35em")
        .attr("x", (d) => {
            return d.children || d._children ? -13 : 13;
        })
        .attr("text-anchor", (d) => {
            return d.children || d._children ? "end" : "start";
        })
        .text((d) => { return d.data.name; });

    // UPDATE

    var nodeUpdate = nodeEnter.merge(node);

    // Transition to the proper position for the node
    nodeUpdate.transition()
      .duration(duration)
      .attr("transform", (d) => { 
          return "translate(" + d.y + "," + d.x + ")";
       });

    // Update the node attributes and style
    nodeUpdate.select('circle.node')
      .attr('r', 5)
      .style("fill", (d) => {
          return d._children ? "lightsteelblue" : "#fff";
      })
      .attr('cursor', 'pointer');


    // Remove any exiting nodes
    var nodeExit = node.exit().transition()
        .duration(duration)
        .attr("transform", (d) => {
            return "translate(" + source.y + "," + source.x + ")";
        })
        .remove();

    // On exit reduce the node circles size to 0
    nodeExit.select('circle')
      .attr('r', 1e-6);

    // On exit reduce the opacity of text labels
    nodeExit.select('text')
      .style('fill-opacity', 1e-6);

    // Update the links...
    var link = this.svg.selectAll('path.link')
        .data(links, (d) => { return d.id; });

    // Enter any new links at the parent's previous position.
    var linkEnter = link.enter().insert('path', "g")
        .attr("class", "link")
        .attr('d', (d) => {
          var o = {x: source.x0, y: source.y0}
          return this.diagonal(o, o)
        });

    // UPDATE
    var linkUpdate = linkEnter.merge(link);

    // Transition back to the parent element position
    linkUpdate.transition()
        .duration(duration)
        .attr('d', (d) => { return this.diagonal(d, d.parent) });

    // Remove any exiting links
    link.exit().transition()
        .duration(duration)
        .attr('d', (d) => {
          var o = {x: source.x, y: source.y}
          return this.diagonal(o, o)
        })
        .remove();

    // Store the old positions for transition.
    nodes.forEach((d) => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  // Collapse the node and all it's children
  collapse(d) {
    if(d.children) {
      d._children = d.children
      d._children.forEach((d) => {this.collapse(d)})
      d.children = null
    }
  }

  // Creates a curved (diagonal) path from parent to the child nodes
  diagonal(s, d) {
    var path = `M ${s.y} ${s.x}
            C ${(s.y + d.y) / 2} ${s.x},
              ${(s.y + d.y) / 2} ${d.x},
              ${d.y} ${d.x}`

    return path
  }

}