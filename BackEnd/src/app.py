#!flask/bin/python
from flask import request, Flask, jsonify
from flask_cors import CORS, cross_origin
import pymongo
from pymongo import MongoClient
import json
import utils

app = Flask(__name__)
CORS(app)
client = MongoClient()
db = client.biovis
db_models = db.models

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
        saved_sequences = []

        for i, sequence in enumerate(tmp_sequences):
            saved = db_models.find_one({"sequence_id": sequence})
            saved.pop('_id', None)
            if saved is not None and saved["comparisons"] is not None and saved["hierarchy"] is not None:
                tmp_sequences.pop(i)
                saved_sequences.append(saved)

        file_batch = [utils.compare_sequence(sequence) for sequence in tmp_sequences]

        counter += data["batch_size"]
        
        print("{} comparisons made.".format(counter))

        for i,file in enumerate(file_batch):
            comparisons = utils.extract_comparisons_from_file(file)
            
            hierarchy = utils.get_hierarchy_from_dict(comparisons)['children'][0]
            comparison = {
                "sequence_id": tmp_sequences[i],
                "comparisons": comparisons[0],
                "hierarchy": hierarchy
            }
            db_models.insert_one(comparison.copy())
            
            comparisons_batch.extend([comparison])
            comparisons_group = comparisons_group + comparisons
        
        comparisons_batch.extend(saved_sequences)
        saved_comparisons = [comparison["comparisons"] for comparison in saved_sequences]
        comparisons_group = comparisons_group + saved_comparisons

        outcome["taxonomies_batch"] = comparisons_batch

        outcome["merged_tree"] = utils.get_hierarchy_from_dict(comparisons_group)['children'][0]

        print("{} files processed.".format(counter))

        # ----------------------------- Temporal ----------------------------- 
        with open('/home/meili/Documents/BioCicle/BackEnd/tmp/sample_output.json', 'w') as outfile:
            json.dump(comparisons_batch, outfile)     
        # ---------------------------------------------------------------------

    return jsonify(outcome)

@app.route('/post_prune_single_tree', methods=['POST'])
def post_prune_single_tree():

    data = request.get_json()
    tree = data["tree"]
    threshold = data["threshold"]

    pruned_tree = utils.prune_tree(threshold, tree)

    return jsonify(pruned_tree)

@app.route('/post_prune_multiple_trees', methods=['POST'])
def post_prune_multiple_trees():

    data = request.get_json()
    trees_batch = data["trees_batch"]
    threshold = data["threshold"]
    pruned_batch = []

    for tree in trees_batch:
        pruned_tree = utils.prune_tree(threshold, tree)
        pruned_batch.append(utils.prune_tree(threshold, tree))


    return jsonify(outcome)

if __name__ == '__main__':
    app.run(host='0.0.0.0',port=8080,debug=True)
