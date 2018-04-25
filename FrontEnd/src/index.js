import React from 'react';
import ReactDOM from 'react-dom';
import * as d3 from 'd3';
import { post, changeThreshold, filter } from './components/utils';
import { Icicle } from './components/icicle';
import { Dendogram } from './components/dendogram';


var CONFIG = require('./config/config.json');

class Form extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sequence: "",
      countAttr: "NAME",
      countFunction: "splitWords",
      threshold: 0,
      currentRoot: 0,
      rootList: [],
      mergedTree: [],
      icicle: new Icicle(1200, 1200),
      dendogram: new Dendogram(1200, 1200)
    };

    this.handleAttrChange = this.handleAttrChange.bind(this);
    this.handleFuncChange = this.handleFuncChange.bind(this);
    this.handleThresholdChange = this.handleThresholdChange.bind(this);
    this.handleThresholdClick = this.handleThresholdClick.bind(this);
    this.handleSequenceChange = this.handleSequenceChange.bind(this);
    this.handleSequenceClick = this.handleSequenceClick.bind(this);
  }

  handleAttrChange(event) {
    this.setState({countAttr: event.target.value});
  }

  handleFuncChange(event) {
    this.setState({countFunction: event.target.value});
  }

  handleThresholdChange(event) {
    this.setState({threshold: event.target.value});
  }

  handleThresholdClick(event) {
    if(this.state.threshold) {

      this.state.rootList.forEach((hierarchy) => {
        hierarchy.children = hierarchy._children;
      });

      if(this.state.rootList.length > 1) 
        changeThreshold(this.state.threshold, this.state.rootList[this.state.currentRoot], this.state.icicle);
      else{
        this.state.mergedTree.children = this.state.mergedTree._children;
        filter(this.state.threshold, this.state.mergedTree, this.state.dendogram);
      }
      
    }
  }

  handleSequenceChange(event) {
    this.setState({sequence: event.target.value});
  }

  handleSequenceClick(event) {
    if(this.state.sequence) {

      var rootList = [];
      var sequences = this.state.sequence.split(",");

      var url = `${CONFIG.BACKEND_URL}post_compare_sequence`;
      // ----------------------------- Temporal -------------------------------
      // d3.json("tmp/sample_output_multi.json", (data) => {
      // ----------------------------------------------------------------------
      post(url, { sequences:sequences }).then((output) => {


        var taxonomiesBatch = output["taxonomies_batch"];
        var mergedTree = output["merged_tree"];

        console.log(mergedTree)


        for (var i = 0; i < taxonomiesBatch.length; i++) {
          var tree = taxonomiesBatch[i]['hierarchy'];
          
          var hierarchy = d3.hierarchy(tree)
            .sum(function(d) { return d.value; });

          hierarchy._children = hierarchy.children;

          rootList.push(hierarchy);

        }

        var hierarchy = d3.hierarchy(mergedTree)
          .sum(function(d) { return d.children;; });

        hierarchy._children = hierarchy.children;

        this.setState({mergedTree: hierarchy});

        this.state.dendogram.draw(this.state.mergedTree)

        this.setState({rootList: rootList});

        if(rootList.length === 1) this.state.icicle.draw(rootList[0]);
        else {

          d3.interval(() => {

            var root = rootList.shift();
            rootList.push(root);

            if(rootList.length > 0) {
              return this.state.icicle.draw(root);
            }

            this.setState({currentRoot: rootList.length-1});

          }, 1000) 
        }

      })  
      // .catch((error) => {
      
      //   console.error(error);
      
      // });
    }

  }

  render() {
    return (
      <div>

        <div className="form-sequence">
          <p></p>
          <textarea 
              value={this.state.sequence} 
              cols="60" 
              rows="7" 
              placeholder="Insert a sequence or sequence id. For example, try with sp:wap_rat." 
              onChange={this.handleSequenceChange}
          ></textarea>
        </div>

        <div className="form-sequence">
          <button 
              className="btn btn-secondary" 
              onClick={this.handleSequenceClick}>
            Align Sequence
          </button>
        </div>

        <div className="form-sequence">
          <input 
              value={this.state.threshold} 
              onChange={this.handleThresholdChange}
          />
          <button 
              className="" 
              onClick={this.handleThresholdClick}
            >
            Change Threshold
          </button>
        </div>
      </div>
    );
  }
}

class Body extends React.Component {
  render() {
    return (
      <div className="body">
        <div className="dendogram"></div>
        <div className="icicle"></div>
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

// ========================================

ReactDOM.render(
  <Vis />,
  document.getElementById('root')
);