import React from 'react';
import ReactDOM from 'react-dom';
import ReactBootstrapSlider from 'react-bootstrap-slider';
import * as d3 from 'd3';
import { post, drawSparklines, filter } from './components/utils';
import { Icicle } from './components/icicle';
import { Dendogram } from './components/dendogram';
import { Grid, Row, Col, Modal, Button } from 'react-bootstrap';


const TIME_ITERATION = 1000;


function reload() {
  window.location.reload();
}


function sortDescending(d) {
  if(d.children) {
    d.children = d.children.sort((a, b) => { 
      if (b.SCORE && b.SCORE){
        return Object.keys(b.SCORE).length - Object.keys(a.SCORE).length;
      }
      else
        return 0;
    });
    d.children = d.children.map((d) => {return sortDescending(d)});
  }
  return d;
}


class Form extends React.Component {
  constructor(props) {
    super(props);

    this.hideMsg = this.hideMsg.bind(this);
    this.iterateOverIcicles = this.iterateOverIcicles.bind(this);
    this.selectIcicle = this.selectIcicle.bind(this);
    this.handleIcicleAndDendogramRendering = this.handleIcicleAndDendogramRendering.bind(this);
    this.handleLevelColorChange = this.handleLevelColorChange.bind(this);
    this.handleFileUpload = this.handleFileUpload.bind(this);
    this.handleXMLUpload = this.handleXMLUpload.bind(this);
    this.handleDendogramClick = this.handleDendogramClick.bind(this);
    this.handleAttrChange = this.handleAttrChange.bind(this);
    this.handleFuncChange = this.handleFuncChange.bind(this);
    this.handleThresholdChange = this.handleThresholdChange.bind(this);
    this.handleThresholdClick = this.handleThresholdClick.bind(this);
    this.handleSequenceChange = this.handleSequenceChange.bind(this);
    this.handleSequenceClick = this.handleSequenceClick.bind(this);

    this.state = {
      msgInfo: {},
      levelColor: 4,
      error: '',
      sequence: '',
      countAttr: 'NAME',
      countFunction: 'splitWords',
      threshold: 0,
      currentRoot: '',
      filename: '',
      rootDict: {},
      mergedTree: {},
      filteredSequences: [],
      filteredRank: '',
      icicle: new Icicle(),
      dendogram: new Dendogram(900, this.handleDendogramClick),
      interval: undefined,
      nothingToShow: 'disabled'
    };

  }

  hideMsg() {
    this.setState({msgInfo:{}});
  }

  selectIcicle(sequence_id) {

    console.log('Selecting sequence ', sequence_id)
    if(this.state.interval)
      this.state.interval.stop();

    this.setState({interval: undefined});

    this.state.icicle.draw(
          'icicle', 
          this.state.rootDict[sequence_id].hierarchy, 
          sequence_id, 
          this.state.rootDict[sequence_id].total,
          this.state.levelColor
          );

    const msgInfo = {
      title: 'Selection',
      msg:`You selected sequence ${sequence_id}`
    }
    this.setState({msgInfo:msgInfo});
  }


  iterateOverIcicles(treeDict, idList) {

    if(this.state.interval)
      this.state.interval.stop();

    if (idList.length === 1) {
      this.state.icicle.draw(
          'icicle', 
          treeDict[idList[0]].hierarchy, 
          idList[0], 
          treeDict[idList[0]].total,
          this.state.levelColor);
    }

    else {

      var i = 0;

      var interval = d3.interval(() => {

        let root = treeDict[idList[i]].hierarchy;

        this.state.icicle.draw(
          'icicle', 
          root, 
          idList[i], 
          treeDict[idList[i]].total,
          this.state.levelColor);

        this.setState({currentRoot: idList[i]});

        i = (i === (idList.length - 1))? 0: i+1;

      }, TIME_ITERATION);

      this.setState({interval:interval});

    }

  }


  handleIcicleAndDendogramRendering(output) {

    console.log(output)

    let taxonomiesBatch = output['taxonomies_batch'];
    var mergedTree = sortDescending(output['merged_tree']);


    for (var key in taxonomiesBatch) {
      
      const tree = taxonomiesBatch[key].hierarchy;
      
      let singleHierarchy = d3.hierarchy(tree)
        .sum(function(d) { 
          return d.value? d.value[Object.keys(d.value)[0]]: undefined;
        });

      taxonomiesBatch[key].hierarchy = singleHierarchy;
      taxonomiesBatch[key].hierarchy._children = singleHierarchy.children.slice();
      taxonomiesBatch[key]._total = taxonomiesBatch[key].total;
      
      this.setState({currentRoot: key});

    }
    
    this.setState({rootDict: taxonomiesBatch});   

    this.state.icicle.setInformationDict(this.state.rootDict);

    let hierarchy = d3.hierarchy(mergedTree)
      .sum(function(d) { return d.children; });

    console.log('Leaves ', hierarchy.leaves());

    mergedTree._children = mergedTree.children.slice();
    
    this.setState({mergedTree: mergedTree});

    this.state.dendogram.draw(hierarchy);

    let tmpSequences = Object.keys(this.state.rootDict);

    drawSparklines(
        this.state.rootDict, 
        tmpSequences,
        this.selectIcicle, 
        this.state.icicle.getColorDict());

    this.iterateOverIcicles(
        this.state.rootDict, tmpSequences);

    d3.select('#small-multiples').text(`RESULTANT MODELS`);
    d3.select('#overview').text('TAXONOMIC PROFILING'); 

  }


  handleLevelColorChange(event) {
    this.setState({levelColor: event.target.value});
    this.iterateOverIcicles(
        this.state.rootDict, Object.keys(this.state.rootDict));
  }


  handleXMLDownload(sequences) {

    if (sequences.length > 0) {

      console.log(sequences)

      const params = {
        filename: this.state.filename,
        queries: JSON.stringify(sequences)
      };

      post('filter_xml', params).then((output) => {
        const date = new Date();
        const filename =  `${this.state.filteredRank.split(' ').join('_')}-${date.toISOString().substring(0,10)}`;

        let buffer = new Buffer(output['file'], 'base64').toString("ascii");

        buffer = '<?xml version="1.0"?>\n' + buffer;

        const blob = new Blob([buffer], {type: 'text/xml'});
        const csvURL = window.URL.createObjectURL(blob);
        let tempLink = document.createElement('a');
        document.body.appendChild(tempLink);
        tempLink.href = csvURL;

        tempLink.setAttribute('download', `filtered-${filename}.xml`);
        tempLink.click();


      })
      .catch((error) => {

        this.setState({error: error});
        console.error(error);

      });   
      
    }

  }


  handleXMLUpload(selectorFiles: FileList) {

    const reader = new FileReader();
    reader.readAsDataURL(selectorFiles[0]);

    reader.onload = () => {

      const fileList = reader.result.split(',');

      const params = {
        file: fileList[1],
        filename: selectorFiles[0].name
      };
      post('upload_xml', params).then((output) => {

        this.setState({filename: output.file_name});

        this.handleIcicleAndDendogramRendering(output);

      })
      .catch((error) => {

        this.setState({error: error});
        console.error(error);

      });   

    };

  }


  handleFileUpload(selectorFiles: FileList) {

    const reader = new FileReader();
    reader.readAsDataURL(selectorFiles[0]);

    reader.onload = () => {

      const fileList = reader.result.split(',');

      const params = {
        file: fileList[1],
        filename: selectorFiles[0].name
      };
      post('upload_file', params).then((output) => {

        this.handleIcicleAndDendogramRendering(output);

      })
      .catch((error) => {

        this.setState({error: error});
        console.error(error);

      });   

    };

  }


  handleDendogramClick(dendogram, d) {
    this.setState({filteredRank: d.data.name});
    let sequences = Object.keys(d.data.SCORE);
    let originalSequences = Object.keys(this.state.rootDict);
    let msgInfo = {}; 
    if (sequences.length !== this.state.filteredSequences.length) {
      if (sequences.length === originalSequences.length)
        this.setState({filteredSequences: []});
      else
        this.setState({filteredSequences: sequences});
      
      console.log(`Filtering ${this.state.filteredSequences.length} out of ${originalSequences.length}`);
      
      this.iterateOverIcicles(this.state.rootDict, sequences);
      
      drawSparklines(
          this.state.rootDict, 
          sequences, 
          this.selectIcicle, 
          this.state.icicle.getColorDict());

      msgInfo.title = 'Filtering';
      msgInfo.msg = `You filtered the results, now displaying ${sequences.length} sequences out of ${Object.keys(this.state.rootDict).length}.`;

    }
    else {
      msgInfo.title = 'Try again';
      msgInfo.msg = `Your selection did not produce any filter over the results.`;      
    }

    this.setState({msgInfo:msgInfo});
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


        var tmpDict = Object.assign({}, this.state.rootDict);
        let tmpSequences = Object.keys(tmpDict);

        tmpSequences.forEach((sequence) => {
          tmpDict[sequence].hierarchy.children = tmpDict[sequence].hierarchy._children.slice();
          tmpDict[sequence].total = tmpDict[sequence]._total;
        });

        this.setState({rootDict: tmpDict});     

        var tempTree = Object.assign({}, this.state.mergedTree);
        tempTree.children = tempTree._children;
        this.setState({mergedTree: tempTree});

        filter(
            this.state.threshold, 
            Object.assign({}, this.state.rootDict), 
            tmpSequences.slice(),
            Object.assign({}, this.state.mergedTree), 
            this.state.dendogram
        ).then((output) => {
          let originalSeq = Object.keys(this.state.rootDict);
          if (output.prunedSequences.length !== this.state.filteredSequences.length) {
            let msgInfo = {}; 
            if (output.prunedSequences.length === originalSeq.length)
              this.setState({filteredSequences: []});
            else
              this.setState({filteredSequences: output.prunedSequences});
            console.log(`Filtering ${this.state.filteredSequences.length} out of ${originalSeq.length}`);

            msgInfo.title = 'Filtering';
            msgInfo.msg = `You filtered the results, now displaying ${output.prunedSequences.length} sequences out of ${originalSeq.length}.`;
          }       
          this.iterateOverIcicles(
              Object.assign({}, output.hierarchies), 
              output.prunedSequences.slice());

          drawSparklines(
              Object.assign({}, output.hierarchies), 
              output.prunedSequences, 
              this.selectIcicle, 
              this.state.icicle.getColorDict());            
        });
      }

    }
  }


  handleSequenceChange(event) {
    this.setState({sequence: event.target.value});
  }


  handleSequenceClick(event) {

    const sequenceString = this.state.sequence;
    if(sequenceString) {

      this.setState({threshold: 0});
      this.setState({nothingToShow: 'false'});

      let sequences = sequenceString.split(',');
    
      if(sequences.length > 0) {

        let params = { sequences:sequences };
        this.setState({currentRoot: ''});
        this.setState({mergedTree: {}});
        this.setState({rootDict: {}});        

        post('post_compare_sequence', params).then((output) => {

          this.handleIcicleAndDendogramRendering(output);

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


  renderDownloadButton() {
    return (
      <button className='btn btn-secondary' >
        <a className='no-style' download={this.state.currentRoot + ".txt"} target='_blank' href={'/tmp/' + this.state.rootDict[this.state.currentRoot].filename}>Download comparison file
        </a>
      </button>
    )
  }


  renderSequence() {
    return (
      <div>
        <Col md={4}>
          <h3 className='section-title' >Insert blast xml output file</h3>
        </Col>
        <Col md={4}>
          <input className='btn btn-secondary' type="file" onChange={ (e) => this.handleXMLUpload(e.target.files) }/>
          { this.state.filteredSequences.length > 0 && this.renderDownloadXMLButton()}
        </Col>
        <Col md={4}>
        </Col>
      </div>
    );
  } 


  renderScore() {

    return (

      <div>
        <Col md={4}>
          <h4 className='section-title' >Score Threshold: {this.state.threshold}% of the maximum score</h4>
          <Row>
            <Col md={11}>
              <ReactBootstrapSlider
                value={this.state.threshold} 
                slideStop={this.handleThresholdChange}
                disabled={this.nothingToShow}
                step={1}
                max={101}
                min={-1} />
            </Col>  
            <Col md={1}></Col>
          </Row>
          <Row>
            <Col md={4}></Col>
            <Col md={4}>
              {Object.keys(this.state.rootDict).length > 1 && this.renderResume() }
            </Col>
            <Col md={4}></Col>
          </Row>
        </Col>
      </div>

    );

  }


  renderDownloadXMLButton() {

    return (
      <button className='btn btn-secondary' onClick={() => { this.handleXMLDownload(this.state.filteredSequences)}}>
        Download Filtered Sequences
      </button>
    )

  }


  renderResume(){

    return (

      <div>
          <Button 
            className='img-frame'
            onClick={() => { this.iterateOverIcicles(
                this.state.rootDict,
                Object.keys(this.state.rootDict)
              )} }
            disabled={(this.state.interval === undefined)? false: true}
            >
            <img src={require('./assets/img/resume.png')} alt='' width={30} height={30}/>
          </Button>
          <Button 
            className='img-frame'
            onClick={() => { this.selectIcicle(this.state.currentRoot)} }
            disabled={(this.state.interval === undefined)? true: false}
            >
            <img src={require('./assets/img/pause.png')} alt='' width={30} height={30}/>
          </Button>

      </div>

    );

  }


  renderFilteredInfo() {
    
    return (
      
      <div>
        <Col md={1}></Col>
        <Col md={10} className='to-left'>
          <h4><b>Filtered:</b> Displaying {this.state.filteredSequences.length} out of {Object.keys(this.state.rootDict).length} sequences.     {'\n'} Current sequence: </h4>
          <h4> {this.state.currentRoot}</h4>
        </Col>
        <Col md={1}></Col>
      </div>

    );

  }


  renderInfo() {
    
    return (

      <div>
        <Col md={1}></Col>
        <Col md={10} className='to-left'>
          <h4>Displaying {Object.keys(this.state.rootDict).length} sequences.     {'\n'} Current sequence: </h4>
          <h4> {this.state.currentRoot}</h4>
        </Col>
        <Col md={1}></Col>
      </div>      
      
    );

  }


  renderMessageInfo(){

    return (

      <div>

        <Modal
          show={true}
          onHide={() => {this.hideMsg()}}
        >
          <Modal.Header closeButton>
            <Modal.Title id="contained-modal-title-lg">
              {this.state.msgInfo.title}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>{this.state.msgInfo.msg}</p>
          </Modal.Body>
          <Modal.Footer></Modal.Footer>
        </Modal>

      </div>

    );

  }


  renderAlert(){

    return (

      <div>

        <Modal
          show={true}
          onHide={reload}
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
              onClick={reload}>Try again
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
            {Object.keys(this.state.rootDict).length > 0 && this.renderScore()}
          </Row>
        </Grid>
        <Row className="info-container">
          {this.state.filteredSequences.length > 0 && this.renderFilteredInfo()}
          {(Object.keys(this.state.rootDict).length > 0 && this.state.filteredSequences.length === 0) && this.renderInfo()}
        </Row>
        <Row>
          {this.state.error && this.renderAlert()}
          {this.state.msgInfo.msg && this.renderMessageInfo()}
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
          <Row className='row-container'>
            <Col md={12} className='subtitle'>
              <h3 id='small-multiples'></h3>
            </Col>
            <Col md={12} className='sparklines'></Col>
          </Row>
          <Row className='row-container'>
            <Col md={12} className='subtitle'><h3 id='overview'></h3></Col>
            <Col md={5} className='dendogram'></Col>
            <Col md={7}>
              <Col md={12} id='icicle' className='icicle'></Col>
            </Col>
          </Row>
            <Row className='row-container'>
              <Col md={12} className='subtitle'><h3 id='description-title'></h3></Col>
              <Col md={12} id='description-icicle'></Col>
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
        <div className='title section'>
          <h2 onClick={() => reload()}>BioCicle <img src={require('./assets/img/reload.png')} alt='' width={20} height={20}/> </h2>
        </div>
        <div className='vis-form'>
          <Form />
        </div>
        <div className='vis-body'>
          <Body/>
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