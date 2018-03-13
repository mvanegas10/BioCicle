import React from 'react';
import ReactDOM from 'react-dom';
import * as d3 from 'd3';
import { createTree, post, redrawIcicle } from './components/utils';

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

      var sequences = this.state.sequence.split(",");

      var url = `${CONFIG.BACKEND_URL}post_compare_sequence`;
      // ----------------------------- Temporal ----------------------------- 
      // d3.json("tmp/sample_output.json", function(alignments) {
      // ---------------------------------------------------------------------
      post(url, { sequences:sequences }).then((alignments) => {

        var first = alignments.shift();

        var tree = createTree(first);
        
        console.log(tree)

        alignments.push(first);

        if(alignments) {

          redrawIcicle(tree);

          d3.interval(function(){

            var next = alignments.shift();

            alignments.push(next);

            tree = createTree(next);

            if(alignments.length > 0) return redrawIcicle(tree);

          }, 1000) 

        }
      })  
      .catch((error) => {
      
        console.error(error);
      
      });
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