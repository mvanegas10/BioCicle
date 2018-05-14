import React from 'react';
import ReactDOM from 'react-dom';
import ReactBootstrapSlider from 'react-bootstrap-slider';
import * as d3 from 'd3';
import { post, drawSparklines, filter } from './components/utils';
import { Icicle } from './components/icicle';
import { Dendogram } from './components/dendogram';
import { Grid, Row, Col, Modal, Button } from 'react-bootstrap';

const TIME_ITERATION = 500;


class Form extends React.Component {
  constructor(props) {
    super(props);

    this.iterateOverIcicles = this.iterateOverIcicles.bind(this);
    this.selectIcicle = this.selectIcicle.bind(this);
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
      rootDict: {},
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

  selectIcicle(sequence_id) {
    if(this.state.interval)
      this.state.interval.stop();

    this.setState({interval: undefined});

    this.state.icicle.draw(
        '.icicle', 
        this.state.rootDict[sequence_id].hierarchy, 
        sequence_id,
        this.state.rootDict[sequence_id].total);
  }

  iterateOverIcicles(treeDict, idList) {

    if(this.state.interval)
      this.state.interval.stop();

    var i = 0;

    var interval = d3.interval(() => {

      let root = treeDict[idList[i]].hierarchy;

      treeDict[idList[i]]['svg'] = this.state.icicle.draw(
          '.icicle', root, idList[i], treeDict[idList[i]].total);

      this.setState({currentRoot: idList[i]});

      i = (i === (idList.length - 1))? 0: i+1;

    }, TIME_ITERATION);

    this.setState({interval:interval});

    return treeDict;

  }

  handleDendogramClick(dendogram, d) {
    if (d.children) {
      let sequences = Object.keys(d.data.SCORE);

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
    console.log(' 2 *****') 
    let tmpSequences = Object.keys(this.state.rootDict);           
    console.log(this.state.rootDict[tmpSequences[0]].hierarchy._children[0].children[0].children[0].children.slice()[1].children)

    if(this.nothingToShow !== 'disabled') {

      this.setState({threshold: event.target.value});
      if(this.state.threshold) {


        var tmpDict = Object.assign({}, this.state.rootDict);
        let tmpSequences = Object.keys(tmpDict);

        tmpSequences.forEach((sequence) => {
          tmpDict[sequence].hierarchy.children = tmpDict[sequence].hierarchy._children.slice();
        });

        this.setState({rootDict: tmpDict});

        var tempTree = Object.assign({}, this.state.mergedTree);
        tempTree.children = tempTree._children;
        this.setState({mergedTree: tempTree});
        filter(
            this.state.threshold, 
            this.state.rootDict, 
            tmpSequences,
            this.state.mergedTree, 
            this.state.dendogram
        ).then((output) => {
          var tempHier = output.hierarchies;
          for(var sequence in this.state.rootDict) {
            if(!tempHier[sequence]) 
              tempHier[sequence] = {};
            tempHier[sequence].hierarchy._children = this.state.rootDict[sequence].hierarchy.children.slice();
          }
          this.setState({rootDict: tempHier});
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
      let sequences = this.state.sequence.split(',');
    
      if(sequences.length > 0) {

        let params = { sequences:sequences };
        this.setState({currentRoot: ''});

        this.setState({mergedTree: {}});

        this.setState({rootDict: []});        

        post('post_compare_sequence', params).then((output) => {

          this.setState({currentRoot: sequences[0]});

          let taxonomiesBatch = output['taxonomies_batch'];
          var mergedTree = output['merged_tree'];

          for (let i = 0; i < taxonomiesBatch.length; i++) {
            let sequence = taxonomiesBatch[i]['sequence_id'];
            let tree = taxonomiesBatch[i]['hierarchy'];
            
            var singleHierarchy = d3.hierarchy(tree)
              .sum(function(d) { 
                return d.value? d.value[Object.keys(d.value)[0]]: undefined;
              });

            let values = singleHierarchy.leaves().map((leave) => leave.value);

            let total = values.reduce((accum, val) => accum + val);

            singleHierarchy._children = singleHierarchy.children.slice();
            
            console.log(' 1 *****')            
            console.log(singleHierarchy._children[0].children[0].children[0].children.slice()[1].children)

            let tmpObject = {
              'sequence_id': sequence,
              'hierarchy': singleHierarchy,
              'max': taxonomiesBatch[i]['max'],
              'total': total
            };

            rootDict[sequence] = tmpObject;

          }
          
          mergedTree._children = mergedTree.children;

          let hierarchy = d3.hierarchy(mergedTree)
            .sum(function(d) { return d.children; });

          this.setState({mergedTree: mergedTree});

          this.state.dendogram.draw(hierarchy);

          let tmpSequences = Object.keys(rootDict);

          if(tmpSequences.length === 1)
            rootDict[tmpSequences[0]]['svg'] = this.state.icicle.draw(
                '.icicle', 
                rootDict[tmpSequences[0]].hierarchy, 
                tmpSequences[0],
                rootDict[tmpSequences[0]].total);

          else 
            rootDict = this.iterateOverIcicles(
                rootDict, tmpSequences);


          drawSparklines(rootDict, this.selectIcicle);

          this.setState({rootDict: rootDict});
          console.log(' 2 *****')            
          console.log(this.state.rootDict[tmpSequences[0]].hierarchy._children[0].children[0].children[0].children.slice()[1].children)

        })  
        .catch((error) => {
          if (error && typeof(error) === 'string' && !error.includes('HTTP'))
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
      <Col md={8}>
        <h4 className='section-title' >Sequence alignment</h4>
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
        <Col md={4}>
          <h4 className='section-title' >Score Threshold: {this.state.threshold} </h4>
          <Col md={11}>
          <ReactBootstrapSlider
            value={this.state.threshold} 
            slideStop={this.handleThresholdChange}
            disabled={this.nothingToShow}
            step={1}
            max={100}
            min={0} />
          </Col>  
          <Col md={1}></Col>
        </Col>
      </div>

    );

  }


  renderResume(){

    return (

      <div>
        <Col md={2}></Col>   
        <Col md={1}>
          <Button 
            className='img-frame'
            onClick={() => { this.iterateOverIcicles(
                this.state.rootDict,
                Object.keys(this.state.rootDict)
              )} }
            disabled={(this.state.interval === undefined)? false: true}
            >
            <img src={require('./assets/img/resume.png')} width={30} height={30}/>
          </Button>
          <Button 
            className='img-frame'
            onClick={() => { this.selectIcicle(this.state.currentRoot)} }
            disabled={(this.state.interval === undefined)? true: false}
            >
            <img src={require('./assets/img/pause.png')} width={30} height={30}/>
          </Button>
        </Col>   
        <Col md={2}></Col>

      </div>

    );

  }


  renderInfo() {
    
    return (
      
      <div>
        <Col md={1}></Col>
        <Col md={3}>
          <h4>Displaying {Object.keys(this.state.rootDict).length} sequences.     {'\n'} Current sequence: </h4>
        </Col>
        <Col md={3} className='to-left'> <h4> {this.state.currentRoot}</h4></Col> 
        {Object.keys(this.state.rootDict).length > 1 && this.renderResume() }
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
            <Col md={5} className='dendogram margin'></Col>
            <Col md={1} className='sparklines margin'></Col>
            <Col md={6} className='icicle margin'></Col>
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