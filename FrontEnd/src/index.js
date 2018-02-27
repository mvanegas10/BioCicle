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
      var sequences = [];
      sequences.push(this.state.sequence);

      var url = `${CONFIG.BACKEND_URL}post_compare_sequence`;

      post(url, { sequences:sequences }).then((alignments) => {

        var first = alignments.shift();

        var tree = createTree(first);

        alignments.push(first);

        if(alignments) {

          redrawIcicle(tree);

          d3.interval(function(){

            var next = alignments.shift();

            alignments.push(next);

            tree = createTree(next);

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

// ========================================

ReactDOM.render(
  <Vis />,
  document.getElementById('root')
);