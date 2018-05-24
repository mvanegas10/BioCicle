import * as d3 from 'd3';

// const COLOR_PALETTE = [
//   '#797979',
//   '#68687F',
//   '#7C8993',
//   '#A6BE98',
//   '#C7B671',
//   '#C17A6E',
//   '#AB6C62',
//   '#75604F',
//   '#BFBEBD'
// ];

const COLOR_PALETTE = ['#F3C300', '#875692', '#A1CAF1', '#8DB600', '#F38400', '#BE0032', '#C2B280', '#848482', '#008856', '#E68FAC', '#0067A5', '#F99379', '#604E97', '#F6A600', '#B3446C'];

const COLOR_3 = ['#DCD300', '#882D17', '#E25822', '#F2F3F4', "#AA4488", "#CC99BB", "#4477AA", "#77AADD", "#117777", "#44AAAA"];

const COLOR_2 = ["#77CCCC", "#117744", "#44AA77", "#88CCAA", "#AAAA44", "#DDDD77", "#AA7744", "#DDAA77", "#771122", "#AA4455", "#DD7788"];

const COLOR_1 = ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00','#cab2d6','#6a3d9a','#ffff99'];

const COLOR_0 = ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd','#ccebc5']


export class Icicle {

  constructor(colorDict) {
    this.colorDict = {};
    if (colorDict)
      this.colorDict = colorDict;
    
    this.color = [];
    this.color.push(d3.scaleOrdinal(COLOR_0));
    this.color.push(d3.scaleOrdinal(COLOR_1));
    this.color.push(d3.scaleOrdinal(COLOR_2));
    this.color.push(d3.scaleOrdinal(COLOR_3));
    this.color.push(d3.scaleOrdinal(COLOR_PALETTE));
  }

  getColorDict() {
    return this.colorDict;
  }

  draw(parentNode, root, sequence, aggregatedValue, levelColor, selectIcicle) {

    var parent = d3.select(`#${parentNode}`).html('');
    this.width = parent.node().getBoundingClientRect().width * 0.9;
    this.height = this.width;

    this.levelColor = levelColor;

    this.svg = d3.select(`#${parentNode}`).append("svg")
      .attr("width", this.width)
      .attr("height", this.height);
    this.x = d3.scaleLinear()
      .range([0, this.width]);
    this.y = d3.scaleLinear()
      .range([0, this.height]);
    

    this.partition = d3.partition()
      .size([this.width, this.height])
      .padding(0)
      .round(true);

    this.selectIcicle = selectIcicle;

    this.aggregatedValue = aggregatedValue;

    this.update(root, sequence);

    return this.colorDict;

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

        let assignedColor;

        const undefined_parent = (d.parent && d.parent.data.name === "undefined")? true: false;

        if (d.data.name.includes("uncultured")) assignedColor = "#eee";

        else if (d.data.name === "undefined") assignedColor = "#eee";

        else if(this.colorDict.hasOwnProperty(d.data.name)) 
          assignedColor = this.colorDict[d.data.name];

        else if(d.height === this.levelColor) {
          let newColor = (this.color[d.height](d.data.name))
          this.colorDict[d.data.name] = this.color[d.height](d.data.name);
          assignedColor = this.colorDict[d.data.name];
        }

        else if (undefined_parent) {
          let tmpParent = d;
          for (let i = d.height; i < 4; i++) {
            if (tmpParent.parent){ 
              tmpParent = tmpParent.parent;
              if (tmpParent.data.name !== "undefined") {
                let tmpColor = d3.rgb(this.colorDict[tmpParent.data.name]);
                assignedColor = tmpColor.brighter();
              }
            }
            else break;
          }
        }

        else if(d.parent) {

          let c = d3.rgb(this.colorDict[d.parent.data.name]);
          let children = d.parent.children.map((d) => d.data.name);
          let ini = children.length / 2;
          let colorRange = [];
          for (let i = 0; i < children.length; i++) {
            let change = parseInt(50/children.length);
            const color = `rgb(${c.r+(ini+i)*change},${c.g+(ini+i)*change},${c.b+(ini+i)*change})`
            colorRange.push(d3.color(color))
          }
          let colorScale = d3.scaleOrdinal()
            .domain(children)
            .range(colorRange);
          this.colorDict[d.data.name] = colorScale(d.data.name)
          assignedColor = this.colorDict[d.data.name];

        }

        else {
          this.colorDict[d.data.name] = '#CCCCCC';
          assignedColor = this.colorDict[d.data.name];
        }

        if (! assignedColor)
          return '#F2F3F4';
        else
          return assignedColor;
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
        })
        .on("mouseover", this.handleMouseOver)
        .on("mouseout", this.handleMouseOut);        
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


  handleMouseOver(d, i) { 
    d3.select(this)
      .attr('class', 'hovered-text');
  }

  handleMouseOut(d, i) {
    d3.select(this)
      .attr('class', '');

  }  

}