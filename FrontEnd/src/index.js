import React from 'react';
import ReactDOM from 'react-dom';
import * as d3 from 'd3';
import { post, changeThreshold } from './components/utils';
import { Icicle } from './components/icicle';


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
      icicle: new Icicle(1200, 1200)
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
      
      console.log(this.state.rootList[this.state.currentRoot]);

      changeThreshold(this.state.threshold, this.state.rootList[this.state.currentRoot], this.state.icicle);
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
      // ----------------------------- Temporal -----------------------------       
      d3.json("tmp/sample_output.json", (alignments) => {
      // ---------------------------------------------------------------------
      // post(url, { sequences:sequences }).then((alignments) => {

        alignments.forEach( function(tree) {

          var hierarchy = d3.hierarchy(tree)
            .sum(function(d) { return d.value; });

          hierarchy._children = hierarchy.children;

          rootList.push(hierarchy);

        } );

        this.setState({rootList: rootList});

        if(rootList.length === 1) this.state.icicle.draw(rootList[0]);
        else {

          d3.interval(function(){

            var root = rootList.shift();

            rootList.push(root);

            this.setState({currentRoot: rootList.length-1});

            if(rootList.length > 0) return this.state.icicle.draw(root);

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
          <textarea value={this.state.sequence} cols="60" rows="7" placeholder="Insert a sequence or sequence id. For example, try with sp:wap_rat." onChange={this.handleSequenceChange}></textarea>
        </div>

        <div className="form-sequence">
          <button className="btn btn-secondary" onClick={this.handleSequenceClick}>Align Sequence</button>
        </div>

        <div className="form-sequence">
          <input value={this.state.threshold} onChange={this.handleThresholdChange}/>
          <button className="" onClick={this.handleThresholdClick}>Change Threshold</button>
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

// ========================================

ReactDOM.render(
  <Vis />,
  document.getElementById('root')
);