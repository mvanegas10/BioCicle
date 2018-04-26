#!flask/bin/python
import json
import utils as utils
import components.log as log
from flask import request, Flask, jsonify
from flask_cors import CORS, cross_origin

app = Flask(__name__)
CORS(app)


@app.route("/post_compare_sequence", methods=["POST"])
def post_compare_sequence():

    merged_tree = {'name':'', 'children': {}, 'SCORE': []}

    data = request.get_json()

    if not "batch_size" in data:
        data["batch_size"] = 1

    data["sequences"] = [sequence.strip(" \t\n\r") for sequence in data["sequences"]]

    # Detect sequences processed before
    saved_sequences, tmp_sequences = utils.get_unsaved_sequences(
            data["sequences"])
    
    # Include previously saved sequences
    processed_batch = saved_sequences.copy()    

    for saved_sequence in processed_batch:
        utils.get_hierarchy_from_dict(
                saved_sequence['sequence_id'],
                saved_sequence['comparisons'],
                tree=merged_tree)

    counter = 0
    current_batch_stop = counter
    pieces_left = len(tmp_sequences) > 0
    output = {}

    while pieces_left:

        tmp_sequences = tmp_sequences[current_batch_stop:]

        num_sequences_left = len(tmp_sequences)

        if data["batch_size"] < num_sequences_left:
            current_batch_stop = data["batch_size"]

        else:
            current_batch_stop = num_sequences_left
            pieces_left = False

        # Compare unprocessed sequences
        file_batch = [utils.compare_sequence(sequence) for sequence in tmp_sequences]

        counter += data["batch_size"]
        log.datetime_log("{} sequences compared.".format(counter))

        # Generate tree for unprocessed sequences
        merged_tree, unsaved_batch = utils.process_batch(
                tmp_sequences, file_batch, merged_tree)

        processed_batch.extend(unsaved_batch)

    # Prepare output
    output["merged_tree"] = merged_tree['children'][0]

    output["taxonomies_batch"] = processed_batch   

    log.datetime_log("{} hierarchies formed.".format(counter))

    return jsonify(output)


@app.route("/post_prune_single_tree", methods=["POST"])
def post_prune_single_tree():

    data = request.get_json()
    tree = data["tree"]
    threshold = data["threshold"]

    pruned_tree = utils.prune_tree(threshold, tree)

    return jsonify(pruned_tree)


@app.route("/post_prune_multiple_trees", methods=["POST"])
def post_prune_multiple_trees():

    data = request.get_json()
    trees_batch = data["trees_batch"]
    threshold = data["threshold"]
    pruned_batch = []

    for tree in trees_batch:
        pruned_tree = utils.prune_tree(threshold, tree)
        pruned_batch.append(utils.prune_tree(threshold, tree))


    return jsonify(outcome)

if __name__ == "__main__":
    app.run(host="0.0.0.0",port=8080,debug=True)
