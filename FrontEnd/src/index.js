import React from 'react';
import ReactDOM from 'react-dom';
import * as d3 from 'd3';
import { post, filter } from './components/utils';
import { Icicle } from './components/icicle';
import { Dendogram } from './components/dendogram';


const TIME_ITERATION = 1000;

class Form extends React.Component {
  constructor(props) {
    super(props);

    this.iterateOverIcicles = this.iterateOverIcicles.bind(this);
    this.handleDendogramClick = this.handleDendogramClick.bind(this);
    this.handleAttrChange = this.handleAttrChange.bind(this);
    this.handleFuncChange = this.handleFuncChange.bind(this);
    this.handleThresholdChange = this.handleThresholdChange.bind(this);
    this.handleThresholdClick = this.handleThresholdClick.bind(this);
    this.handleSequenceChange = this.handleSequenceChange.bind(this);
    this.handleSequenceClick = this.handleSequenceClick.bind(this);

    this.state = {
      sequence: '',
      countAttr: 'NAME',
      countFunction: 'splitWords',
      threshold: 0,
      currentRoot: '',
      rootDict: [],
      mergedTree: {},
      icicle: new Icicle(1200, 1200),
      dendogram: new Dendogram(1200, 1200, this.handleDendogramClick),
      showingOriginal: true,
      interval: undefined
    };

  }

  iterateOverIcicles(treeDict, idList) {

    if(this.state.interval)
      this.state.interval.stop();

    var i = 0;

    var interval = d3.interval(() => {

      var root = treeDict[idList[i]];

      this.state.icicle.draw(root, idList[i]);

      this.setState({currentRoot: idList[i]});

      i = (i === (idList.length - 1))? 0: i+1;

    }, TIME_ITERATION);

    this.setState({interval:interval});

  }

  handleDendogramClick(dendogram, d) {
    if (d.children) {
      var sequences = Object.keys(d.data.SCORE);

      this.iterateOverIcicles(this.state.rootDict, sequences);

    }
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

      if(tmpSequences.length > 1) this.setState({showingOriginal: false});

      var tempTree = this.state.mergedTree;
      tempTree.children = tempTree._children;
      this.setState({mergedTree: tempTree});
      filter(
          this.state.threshold, 
          this.state.mergedTree, 
          this.state.dendogram
      ).then((output) => {

        this.iterateOverIcicles(output.hierarchies, output.prunedSequences);

      });
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

        this.setState({showingOriginal: true});
        this.setState({currentRoot: sequences[0]});

        var taxonomiesBatch = output['taxonomies_batch'];
        var mergedTree = output['merged_tree'];

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

        else 
          this.iterateOverIcicles(this.state.rootDict, tmpSequences);

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