function Dendogram() {
  var obj = this;
  var svg = d3v4.select("#dendogram").select("svg")
      .attr("width", 800)
      .attr("height", 800),
    width = +svg.attr("width"),
    height = +svg.attr("height"),
    g = svg.append("g").attr("transform", "translate(40,0)");

  var tree = d3v4.cluster()
      .size([height, width - 160]);

  // var stratify = d3v4.stratify()
  //     .parentId(function(d) { return d.id.substring(0, d.id.lastIndexOf(".")); });

  obj.draw = function (data) {

    // var root = stratify(data)
    //     .sort(function(a, b) { return (a.height - b.height) || a.id.localeCompare(b.id); });

    var root = d3v4.hierarchy(data)
        // .sort(function(a, b) { return (a.height - b.height) || a.id.localeCompare(b.id); });
        .sort(function(a, b) { return (a.value - b.value) || d3v4.ascending(a.data.value, b.data.value); });

    tree(root);

    var link = g.selectAll(".link")
        .data(root.descendants().slice(1))
      .enter().append("path")
        .attr("class", "link")
        .attr("d", function(d) {
          return "M" + d.y + "," + d.x
              + "C" + (d.parent.y + 100) + "," + d.x
              + " " + (d.parent.y + 100) + "," + d.parent.x
              + " " + d.parent.y + "," + d.parent.x;
        });
    link.exit().remove();


    var node = g.selectAll(".node")
        .data(root.descendants())
      .enter().append("g")
        .attr("class", function(d) { return "node" + (d.children ? " node--internal" : " node--leaf"); })
        .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; })

    node.append("circle")
        .attr("r", 2.5);

    node.append("text")
        .attr("dy", 3)
        .attr("x", function(d) { return d.children ? -8 : 8; })
        .style("text-anchor", function(d) { return d.children ? "end" : "start"; })
        .text(function(d) { return d.data.label; });

    node.exit().remove();
  };
  return obj;
}