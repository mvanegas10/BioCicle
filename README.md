# BioCicle
## A Tool for Summarizing and Comparing Taxonomic Reports for Biological Sequence Alignment Results

![BioCicleTeaser](https://mvanegas10.github.io/BioCicle/BioCicleTeaser.png "BioCicleTeaser")

This is a tool that supports taxonomic report analysis for single and multiple query displays. Our preeminent contributions are mostly in the visual design for taxonomic reports, the ease interaction and manipulation for taxonomic profiles analysis and the format support for input files.

### Implementation

We propose an open source prototype that connects directly with the NCBI API to compute the comparisons and visualize its results. The implementation consists in a Python-based BackEnd and a React Application as interface.

### Prerequisites

In order to deploy the application, you need to install the prerequisites listen in the BackEnd/requirements.txt and FrontEnd/package.json file. Do the following:
```bash
# Clone this repository
git clone https://github.com/mvanegas10/BioCicle.git

# Go into the repository
cd BioCicle

# Install dependencies
cd BackEnd
pip install -r requirements.txt

cd FrontEnd
npm install

# Run the app
cd BackEnd
python src/app.py

cd FrontEnd
npm start
```

## Built With

* Flask
* EBI NCBI API
* ReactJS

## Author
<!-- Contributors table START -->
| [![Meili Vanegas](https://avatars.githubusercontent.com/mvanegas10?s=100)<br /><sub>Meili Vanegas</sub>](https:///mvanegas10.github.io)<br /> |
| :---: |
