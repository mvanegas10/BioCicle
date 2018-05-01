import React from 'react';
import ReactDOM from 'react-dom';
import * as d3 from 'd3';
import { post, changeThreshold, filter } from './components/utils';
import { Icicle } from './components/icicle';
import { Dendogram } from './components/dendogram';


class Form extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sequence: '',
      countAttr: 'NAME',
      countFunction: 'splitWords',
      threshold: 0,
      currentRoot: '',
      rootDict: [],
      mergedTree: {},
      icicle: new Icicle(1200, 1200),
      dendogram: new Dendogram(1200, 1200),
      showingOriginal: true
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

      var tmpDict = this.state.rootDict;
      var tmpSequences = Object.keys(tmpDict);

      tmpSequences.forEach((sequence) => {
        tmpDict[sequence].children = tmpDict[sequence]._children;
      });

      this.setState({rootDict: tmpDict});

      if(tmpSequences.length > 1) {
        var tempTree = this.state.mergedTree;
        tempTree.children = tempTree._children;
        this.setState({mergedTree: tempTree});
        this.setState({showingOriginal: false});
        filter(
            this.state.threshold, 
            this.state.mergedTree, 
            this.state.dendogram,
            this.state.icicle);
      }

      else{
        changeThreshold(
            this.state.threshold, 
            this.state.rootDict[this.state.currentRoot], 
            this.state.icicle);
      }
      
    }
  }

  handleSequenceChange(event) {
    this.setState({sequence: event.target.value});
  }

  handleSequenceClick(event) {
    if(this.state.sequence) {

      var rootDict = {};
      var sequences = this.state.sequence.split(',');

      post('post_compare_sequence', { sequences:sequences }).then((output) => {

        var taxonomiesBatch = output['taxonomies_batch'];
        var mergedTree = output['merged_tree'];

        console.log(mergedTree)

        for (var i = 0; i < taxonomiesBatch.length; i++) {
          var sequence = taxonomiesBatch[i]['sequence_id'];
          var tree = taxonomiesBatch[i]['hierarchy'];
          
          var singleHierarchy = d3.hierarchy(tree)
            .sum(function(d) { 
              return d.value? d.value[Object.keys(d.value)[0]]: undefined;
            });

          singleHierarchy._children = singleHierarchy.children;

          rootDict[sequence] = singleHierarchy;

        }
        
        mergedTree._children = mergedTree.children;

        var hierarchy = d3.hierarchy(mergedTree)
          .sum(function(d) { return d.children; });

        this.setState({mergedTree: mergedTree});

        this.state.dendogram.draw(hierarchy);

        this.setState({rootDict: rootDict});

        var tmpSequences = Object.keys(rootDict);
        if(tmpSequences.length === 1)

          this.state.icicle.draw(rootDict[tmpSequences[0]], tmpSequences[0]);

        else {

          var i = 0;

          var interval = d3.interval(() => {

            if (!this.state.showingOriginal) {
              interval.stop();
              return;
            }

            var root = this.state.rootDict[tmpSequences[i]];

            this.state.icicle.draw(root, tmpSequences[i]);

            this.setState({currentRoot: tmpSequences[i]});

            i = (i === (tmpSequences.length - 1))? 0: i+1;

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

        <div className='form-sequence'>
          <textarea 
              value={this.state.sequence} 
              cols='60' 
              rows='7' 
              placeholder='Insert a sequence or sequence id. For example, try with sp:wap_rat.' 
              onChange={this.handleSequenceChange}
          ></textarea>
        </div>

        <div className='form-sequence'>
          <button 
              className='btn btn-secondary' 
              onClick={this.handleSequenceClick}>
            Align Sequence
          </button>
        </div>

        <div className='form-sequence'>
          <input 
              value={this.state.threshold} 
              onChange={this.handleThresholdChange}
          />
          <button 
              className='' 
              onClick={this.handleThresholdClick}
            >
            Change Threshold
          </button>
        </div>
        <div>
          <p value={this.state.currentRoot}></p>
        </div>
      </div>
    );
  }
}

class Body extends React.Component {
  render() {
    return (
      <div className='body'>
        <div className='dendogram'></div>
        <div className='sequence_id'>
        </div>
        <div className='icicle'></div>
      </div>
    );
  } 
}

class Vis extends React.Component {
  render() {
    return (
      <div className='vis'>
        <div className='vis-form'>
          <Form />
        </div>
        <div className='vis-body'>
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