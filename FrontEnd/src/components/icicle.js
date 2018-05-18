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

  constructor() {
    this.colorDict = {};
  }

  draw(parentNode, root, sequence, aggregatedValue, selectIcicle) {

    var parent = d3.select(parentNode).html('');
    this.width = parent.node().getBoundingClientRect().width * 0.9;
    this.height = this.width;

    this.svg = d3.select(parentNode).append("svg")
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

    this.selectIcicle = selectIcicle;

    this.aggregatedValue = aggregatedValue;

    this.update(root, sequence);

    return this.svg;

  }

  update(root, sequence) {

    // transition
    let t = d3.transition()
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
      .attr("class", (d) => { return (this.getScore(d, sequence) === 0)? "invisible": ""; })
      .attr("fill", (d) => { 

        if(this.colorDict.hasOwnProperty(d.data.name)) 
          return this.colorDict[d.data.name];

        else if(d.parent) {

          if(!d.parent.parent) {
            this.colorDict[d.data.name] = this.color(d.data.name);
            return this.colorDict[d.data.name];
          }

          else {
            let c = d3.rgb(this.colorDict[d.parent.data.name]);
            let children = d.parent.children.map((d) => d.data.name);
            let ini = children.length / 2;
            let colorRange = [];
            for (let i = 0; i < children.length; i++) {
              const color = `rgb(${c.r+(ini+i)*10},${c.g+(ini+i)*10},${c.b+(ini+i)*10})`
              colorRange.push(d3.color(color))
            }
            let colorScale = d3.scaleOrdinal()
              .domain(children)
              .range(colorRange);
            this.colorDict[d.data.name] = colorScale(d.data.name)
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
      .on("click", (d) => {
        if (!this.selectIcicle)
          return this.clicked(d)
        else
          return this.selectIcicle(Object.keys(d.data.SCORE)[0]);
      });
      
      
    if (!this.selectIcicle) {
      this.text = this.barsEnter.append("text")
        .attr("x", (d) => { return d.y0; })
        .attr("dx", ".35em")
        .attr("y", (d) => { return d.x0 + (d.x1 - d.x0)/2; })
        .attr("dy", ".35em")
        .attr("class", (d) => { return (this.getScore(d, sequence) === 0)? "invisible": ""; })
        .text((d) => {
          var score = this.getScore(d, sequence);
          return d.data.name + "(" + Math.round(
            score * 100) + "%)" 
        });
    }

  }

  getScore(d, sequence) {
    if (d.children) {
      var tmpScore = 0.0;
      for (let child of d.children) {
        tmpScore += this.getScore(child);
      }
      return tmpScore;
    }
    else 
      return d.value/this.aggregatedValue;
  }

  clicked(d) {

    this.x.domain([d.x0, d.x1]);
    this.y.domain([d.y0, this.height]).range([d.depth ? 20 : 0, this.height]);

    this.rect.transition()
      .duration(750)
      .attr("x", (d) => { return this.y(d.y0); })
      .attr("y", (d) => { return this.x(d.x0); })
      .attr("width", (d) => { return this.y(d.y1) - this.y(d.y0); })
      .attr("height", (d) => { return this.x(d.x1) - this.x(d.x0); });

    this.text.transition()
      .duration(750)
      .attr("x", (d) => { return this.y(d.y0); })
      .attr("y", (d) => { return this.x(d.x0 + (d.x1 - d.x0)/2); });

  }

}