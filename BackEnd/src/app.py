#!flask/bin/python
from flask import request, Flask, jsonify
from flask_cors import CORS, cross_origin
import json
import utils

app = Flask(__name__)
CORS(app)

@app.route('/post_compare_sequence', methods=['POST'])
def post_compare_sequence():

    data = request.get_json()

    if not "batch_size" in data:
        data["batch_size"] = 1

    counter = 0
    current_batch_stop = counter
    pieces_left = len(data["sequences"]) > 0
    outcome = {}
    comparisons_batch = []
    comparisons_group = []

    while pieces_left:

        data["sequences"] = data["sequences"][current_batch_stop:]

        num_sequences_left = len(data["sequences"])

        if data["batch_size"] < num_sequences_left:
            current_batch_stop = data["batch_size"]

        else:
            current_batch_stop = num_sequences_left
            pieces_left = False

        tmp_sequences = data["sequences"][ :current_batch_stop]
        
        file_batch = [utils.compare_sequence(sequence) for sequence in tmp_sequences]

        counter += data["batch_size"]
        
        print("{} comparisons made.".format(counter))

        for file in file_batch:
            comparisons = utils.extract_comparisons_from_file(file)
            comparisons_batch.extend([utils.get_hierarchy_from_dict(comparisons)['children'][0]])
            comparisons_group = comparisons_group + comparisons

        outcome["taxonomies_batch"] = comparisons_batch

        outcome["merged_tree"] = utils.get_hierarchy_from_dict(comparisons_group)

        print("{} files processed.".format(counter))

        # ----------------------------- Temporal ----------------------------- 
        with open('/home/meili/Documents/BioCicle/BackEnd/tmp/sample_output.json', 'w') as outfile:
            json.dump(comparisons_batch, outfile)     
        # ---------------------------------------------------------------------

    return jsonify(outcome)

if __name__ == '__main__':
    app.run(host='0.0.0.0',port=8080,debug=True)
