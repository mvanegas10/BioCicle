import * as d3 from 'd3';

const COLOR_PALETTE = [
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

export class Icicle {

  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.colorDict = {};
  }

  draw(root) {

    d3.select('.icicle').html('');

    this.svg = d3.select(".icicle").append("svg")
      .attr("width", this.width)
      .attr("height", this.height);
    this.x = d3.scaleLinear()
      .range([0, this.width]);
    this.y = d3.scaleLinear()
      .range([0, this.height]);
    
    this.color = d3.scaleOrdinal(COLOR_PALETTE);

    this.partition = d3.partition()
      .size([this.width, this.height])
      .padding(0)
      .round(true);

    this.update(root);

  }

  update(root) {
    
    console.log(root.descendants())

    // transition
    var t = d3.transition()
      .duration(1000);

    //JOIN
    this.bars = this.svg.selectAll(".node")
      .data(this.partition(root).descendants());

    //EXIT
    this.bars.exit()
        .attr("class", "exit")
      .transition(t)
        .remove();

    //ENTER
    this.barsEnter = this.bars.enter()
      .append("g")
      .attr("class", "node");

    this.rect = this.barsEnter.append("rect")
      .attr("x", (d) => { return d.y0; })
      .attr("y", (d) => { return d.x0; })
      .attr("width", (d) => { return d.y1 - d.y0; })
      .attr("height", (d) => { return d.x1 - d.x0; })
      .attr("fill", (d) => { 
        if(this.colorDict.hasOwnProperty(d.data.name)) return this.colorDict[d.data.name];
        else if(d.parent) {
          if(!d.parent.parent) {
            this.colorDict[d.data.name] = this.color(d.data.name);
            return this.colorDict[d.data.name];
          }
          else {
            var parentColor;
            var count = 0;
            var parent = d.parent;
            while (parent.parent) {
              count ++;
              parentColor = this.colorDict[parent.data.name];
              parent = parent.parent;
            }
            this.colorDict[d.data.name] = d3.rgb(parentColor).brighter(0.3 + (0.3 * count));
            return this.colorDict[d.data.name];
          }
        }
        else {
          this.colorDict[d.data.name] = this.color(d.data.name);
          return this.colorDict[d.data.name];
        }
      })
      .style("stroke", "#FFF")
      .style("stroke-width", 2)
      .on("click", this.clicked);
      
    this.text = this.barsEnter.append("text")
      .attr("x", (d) => { return d.y0; })
      .attr("dx", ".35em")
      .attr("y", function(d) { return d.x0 + (d.x1 - d.x0)/2; })
      .attr("dy", ".35em")
      .text((d) => { return d.data.name + "(" + Math.round(d.data.SCORE * 100)/100 + "%)" });

  }

  clicked(d) {

    this.x.domain([d.x0, d.x1]);
    this.y.domain([d.y0, this.height]).range([d.depth ? 20 : 0, this.height]);

    this.rect.transition()
      .duration(750)
      .attr("x", function(d) { return this.y(d.y0); })
      .attr("y", function(d) { return this.x(d.x0); })
      .attr("width", function(d) { return this.y(d.y1) - this.y(d.y0); })
      .attr("height", function(d) { return this.x(d.x1) - this.x(d.x0); });

    this.text.transition()
      .duration(750)
      .attr("x", function(d) { return this.y(d.y0); })
      .attr("y", function(d) { return this.x(d.x0 + (d.x1 - d.x0)/2); });

  }

}