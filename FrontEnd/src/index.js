import React from 'react';
import ReactDOM from 'react-dom';
import ReactBootstrapSlider from 'react-bootstrap-slider';
import * as d3 from 'd3';
import { post, filter } from './components/utils';
import { Icicle } from './components/icicle';
import { Dendogram } from './components/dendogram';
import { Grid, Row, Col, Modal, Button, ButtonToolbar } from 'react-bootstrap';

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
      error: '',
      sequence: '',
      countAttr: 'NAME',
      countFunction: 'splitWords',
      threshold: 0,
      currentRoot: '',
      rootDict: [],
      mergedTree: {},
      icicle: new Icicle(),
      dendogram: new Dendogram(1500, this.handleDendogramClick),
      interval: undefined,
      nothingToShow: 'disabled'
    };

  } 

  reload() {
    window.location.reload();
  }

  iterateOverIcicles(treeDict, idList) {

    console.log('treeDict', treeDict)
    console.log('idList', idList)

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

  handleThresholdClick(event) {
    this.setState({threshold: event.target.value});
  }

  handleThresholdChange(event) {
    if(this.nothingToShow !== 'disabled') {

      this.setState({threshold: event.target.value});
      if(this.state.threshold) {

        var tmpDict = this.state.rootDict;
        var tmpSequences = Object.keys(tmpDict);

        tmpSequences.forEach((sequence) => {
          tmpDict[sequence].children = tmpDict[sequence]._children;
        });

        this.setState({rootDict: tmpDict});

        var tempTree = this.state.mergedTree;
        tempTree.children = tempTree._children;
        this.setState({mergedTree: tempTree});
        console.log(this.state.mergedTree)
        filter(
            this.state.threshold, 
            this.state.mergedTree, 
            this.state.dendogram
        ).then((output) => {
          var tempHier = output.hierarchies;
          for(var sequence in this.state.rootDict) {
            if(!tempHier[sequence]) 
              tempHier[sequence] = {};
            tempHier[sequence]._children = this.state.rootDict[sequence].children;
          }
          this.setState({rootDict: tempHier});
          console.log(this.state.rootDict)
          this.iterateOverIcicles(output.hierarchies, output.prunedSequences);

        });
      }

    }
  }

  handleSequenceChange(event) {
    this.setState({sequence: event.target.value});
  }

  handleSequenceClick(event) {
    if(this.state.sequence) {
      this.setState({threshold: 0});
      this.setState({nothingToShow: 'false'});

      var rootDict = {};
      var sequences = this.state.sequence.split(',');
    
      if(sequences.length > 0) {

        let params = { sequences:sequences };
        this.setState({currentRoot: ''});

        this.setState({mergedTree: {}});

        this.setState({rootDict: []});        

        post('post_compare_sequence', params).then((output) => {

          console.log(output)

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
          if (!error.includes('HTTP'))
            error = 'Your search did not produced any result.';

          this.setState({error: error});
          console.error(error);
        
        });
      }
      else {
        this.setState({error: 'You have to input a valid sequence.'});
      }      
    }
    else {
      this.setState({error: 'You have to input a sequence.'});
    }
  }


  renderSequence() {
    return (
      <Col md={6}>
        <p className='section-title' >Sequence alignment</p>
        <Col md={8}>
          <textarea 
            value={this.state.sequence} 
            rows='3'
            placeholder='Insert a sequence or sequence id. For example, try with sp:wap_rat.' 
            onChange={this.handleSequenceChange}
          ></textarea>
        </Col>
        <Col md={1}></Col>
        <Col md={3}>
          <button 
              className='btn btn-secondary' 
              onClick={this.handleSequenceClick}>
            Align Sequence
          </button>
        </Col>
      </Col>
    );
  } 




  renderScore() {

    return (

      <div>
        <Col md={6}>
          <p className='section-title' >Score Threshold: {this.state.threshold} </p>
          <Col md={8}>
          <ReactBootstrapSlider
            value={this.state.threshold} 
            slideStop={this.handleThresholdChange}
            disabled={this.nothingToShow}
            step={1}
            max={100}
            min={0} />
          </Col>  
          <Col md={1}></Col>
          <Col md={3}>
            <button 
                className='btn btn-secondary' 
                onClick={this.handleThresholdClick}
              >
              Change Threshold
            </button>
          </Col>
        </Col>
      </div>

    );

  }


  renderInfo() {
    
    return (
      
      <div>
        <Col md={6}>
          <p>Displaying {Object.keys(this.state.rootDict).length} compared sequences</p>
        </Col>            
        <Col md={6}>
          <p>Current sequence: {this.state.currentRoot}</p>
        </Col>  
      </div>

    );

  }


  renderAlert(){

    return (

      <div>

        <Modal
          show={true}
          onHide={this.reload}
        >
          <Modal.Header closeButton>
            <Modal.Title id="contained-modal-title-lg">
              Oh snap! You got an error!
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>{this.state.error}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button 
              className='btn btn-danger'
              onClick={this.reload}>Try again
            </Button>
          </Modal.Footer>
        </Modal>

      </div>

    );

  }


  render() { 

    return (
      <div>
        <Grid>
          <Row>
            {this.renderSequence()}
            {this.renderScore()}
          </Row>
        </Grid>
        <Row>
          {Object.keys(this.state.rootDict).length > 0 && this.renderInfo()}
        </Row>
        <Row>
          {this.state.error && this.renderAlert()}
        </Row>
      </div>
    );
  }
}

class Body extends React.Component {

  render() {

    return (
      <div>
        <Grid>
          <Row>
            <Col md={5} className='dendogram'></Col>
            <Col md={7} className='icicle'></Col>
          </Row>
        </Grid>
      </div>
    );

  } 

}

class Vis extends React.Component {

  render() {

    return (
      <div className='vis'>
        <div className='title'>
          <h2>BioCicle</h2>
        </div>
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
  <Vis/>,
  document.getElementById('root')
);