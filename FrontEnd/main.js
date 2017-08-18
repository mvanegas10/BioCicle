var margin = {top: 20, right: 20, bottom: 80, left: 40},
width = 960 - margin.left - margin.right,
height = 500 - margin.top - margin.bottom;

var svg = d3.select("#chart").append("svg")
.attr("width", width + margin.left + margin.right)
.attr("height", height + margin.top + margin.bottom)
.append("g")
.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var fill = d3.scale.category20();
var size =d3.scale.pow().exponent(0.5)
// var size =d3.scale.linear()
.range([6, window.innerWidth<797? 35 : 45]);
// var fmt = main.co_locale.numberFormat("n");
var fmt = function (d) { return d; };

var allData;

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

function computeTree(data) {
	return new CSVtoTree("/", "NAME", "SCORE").getTreeWithHierarchy(data, ["SCORE", "NAME", "ORGANISM", "species", "genus","family", "order", "class"].reverse());
}

function createTree(data) {
	var tree = {"Class":{}};
	data.forEach(function(d){
		if(!tree.Class[d.class]) tree.Class[d.class] = {};
		if(!tree.Class[d.class][d.order]) tree.Class[d.class][d.order] = {};
		if(!tree.Class[d.class][d.order][d.family]) tree.Class[d.class][d.order][d.family] = {};
		if(!tree.Class[d.class][d.order][d.family][d.genus]) tree.Class[d.class][d.order][d.family][d.genus] = {};
		if(!tree.Class[d.class][d.order][d.family][d.genus][d.species]) tree.Class[d.class][d.order][d.family][d.genus][d.species] = {};
		if(!tree.Class[d.class][d.order][d.family][d.genus][d.species][d.ORGANISM]) tree.Class[d.class][d.order][d.family][d.genus][d.species][d.ORGANISM] = {};
		if(!tree.Class[d.class][d.order][d.family][d.genus][d.species][d.ORGANISM][d.NAME]) tree.Class[d.class][d.order][d.family][d.genus][d.species][d.ORGANISM][d.NAME] = d.SCORE;
	});
	return tree;
}

function redraw(data) {
	// var data;
	// try {
	// 	data = d3.tsv.parse(d3.select("#textEntry").property("value"));
	// } catch (e) {
	// 	alert("Error parsing the TSV, check the javascript console");
	// 	console.log(e);
	// 	return;
	// }

	data.forEach(function (d) {
		d.SCORE = +d.SCORE;
	});

	d3.select("#attribute")
	.on("change", function () { redraw(); });

	d3.select("#typeCount")
	.on("change", function () { redraw(); });

	var attribute = d3.select("#attribute").property("value");	
	var typeCount = d3.select("#typeCount").property("value");

	var dCounts = {};	

	function countAttr(score) {
		return function(attr) {
			if (!(attr in dCounts)) {
				dCounts[attr] = {
					text: attr,
					count: 0
				};
			}
			dCounts[attr].count +=score;
			dCounts[attr].count = Math.round(dCounts[attr].count * 100)/100;
		}
	}

	data.forEach(function (d) {
		if (typeCount === "splitWords") {
			d[attribute].split(" ").forEach(countAttr(d.SCORE));
		} else if (typeCount === "firstWord") {
			d.first = d[attribute].split(" ")[0];
			countAttr(d.SCORE)(d.first);
		} else if (typeCount === "fullPhrase") {
			countAttr(d.SCORE)(d[attribute]);
		}
	});	

	var dCountsArr = Object.values(dCounts)

	dCountsArr.sort(function(a, b) {
	    return b.count - a.count;
	});

	// redrawTable(dCountsArr,["text","count"]);
	redrawIcicle(createTree(data));
	// redrawWordCloud(data,dCounts);
	// redrawTree(data);
}

function redrawIcicle(root) {

	d3.select('#icicle').html('');

var width = 1750,
height = 1750;

var x = d3v4.scaleLinear()
    .range([0, width]);

var y = d3v4.scaleLinear()
    .range([0, height]);

var color = d3v4.scaleOrdinal(d3v4.schemeCategory20c);

var partition = d3v4.partition()
    .size([width, height])
    .padding(0)
    .round(true);

var svgIcicle = d3v4.select("#icicle").append("svg")
    .attr("width", width)
    .attr("height", height);

	root = d3v4.hierarchy(d3v4.entries(root)[0], function(d) {
	  return d3v4.entries(d.value)
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

function redrawTree(data) {
	var tree  = computeTree(data);
	new DrawTree().draw(tree);
	new Dendogram().draw(tree);
}

function redrawWordCloud(data,dCounts) {
	size.domain(d3.extent(d3.values(dCounts), function (d) { return d.count; }));

	d3.layout.cloud().size([width/2, height/2])
	.words(d3.values(dCounts), function (d) { return d.text; })
	.padding(1)
	// .rotate(function() { return ~~(Math.random() * 2) * 90; })
	.rotate(0)
	.font("Impact")
	.fontSize(function(d) { return size(d.count); })
	.on("end", drawWordCloud)
	.start();
}

function redrawTable (mData,columns) {
	document.getElementById("table").innerHTML = "";
	var table = d3.select('#table').append('table')
	var thead = table.append('thead')
	var	tbody = table.append('tbody');

	// append the header row
	thead.append('tr')
	.selectAll('th')
	.data(columns).enter()
	.append('th')
	.text(function (column) { 
		return column.toUpperCase(); });

	// create a row for each object in the data
	var rows = tbody.selectAll('tr')
	.data(mData)
	.enter()
	.append('tr');

	// create a cell in each row for each column
	var cells = rows.selectAll('td')
	.data(function (row) {
		return columns.map(function (column) {
			return {column: column, value: row[column]};
		});
	})
	.enter()
	.append('td')
	.text(function (d) { 
		return d.value; });
	// .style("font-size", function (d) { 
	// 	return d.size + "px"; });
}

function drawWordCloud(mData) {
	data = mData;
	// if (isPrimary) {
	//     wordList.update(data);
	// }
	var text = svg.selectAll("text")
	.data(data, function (d) { return d.text; });


	var textEnter = text.enter().append("text")
	.attr("class", "word");
			// .style("font-size", size.range()[0] + "px");

	text
	.attr("data-toggle", "tooltip")
	.attr("title", function(d) { return d.text + " con " + fmt(d.count) + " interacciones"; })
	.attr("text-anchor", "middle")
	.style("font-family", "Impact")
	// .on("click", onClickWord)
	.text(function(d) { return d.text; })
	// .each(function () {
	//     $(this).tooltip({"container": "body",
	//     "placement": "bottom"});
	// })
	.style("fill", function(d, i) { return fill(i); })
	// .style("font-size", function(d) { return size(d.count) + "px"; })
	// .attr("transform", function(d) {
	//     return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
	// })

	;

	text.transition().duration(1000)
	.attr("transform", function(d) {
		return "translate(" + [d.x + width/2, d.y + height/2] + ")rotate(" + d.rotate + ")";
	})
	.style("font-size", function(d) { return size(d.count) + "px"; });

	// text.each(function () {
	//         $(this).tooltip("destroy");
	//         $(this).tooltip({"container": "body",
	//         "placement": "bottom"}); });


	text.exit()
	.transition()
	.duration(500)
	.style("opacity", 0)
	.remove();

	// $(".word").tooltip();
}

function start() {
	$.get( "http://localhost:8080/datos", function( data ) {
		allData = data;
		var first = allData.pop();
		console.log(allData);
		if(allData) {
			redraw(first);
			d3v4.interval(function(){
				return redraw(allData.pop());
			}, 100)	
		}
	});	
}

start();