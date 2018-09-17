#!flask/bin/python
import json
import random
import copy
import utils as utils
import components.log as log
from flask import request, Flask, jsonify
from flask_cors import CORS, cross_origin

app = Flask(__name__, static_url_path="")
CORS(app)

@app.route("/")
def root():
    return app.send_static_file("index.html")


@app.route("/api/post_compare_sequence", methods=["POST"])
def post_compare_sequence():
    output = {}

    try:

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
                    target=merged_tree)

        counter = 0
        current_batch_stop = counter
        pieces_left = len(tmp_sequences) > 0

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
        hierarchy, aggregated_score = utils.form_hierarchy(merged_tree)
        output["merged_tree"] = hierarchy

        output["taxonomies_batch"] = processed_batch   

        log.datetime_log("{} hierarchies formed.".format(counter))

        return jsonify(output)

    except Exception as e:
        output["Error"] = str(e)
        log.datetime_log("Error: {}".format(e))
        return jsonify(output)


@app.route("/api/post_prune_single_tree", methods=["POST"])
def post_prune_single_tree():
    
    output = {}

    try:
        data = request.get_json()
        tree = json.loads(data['tree']);
        threshold = float(data['threshold'])

        pruned_tree = utils.prune_tree(threshold, tree)

        output['pruned_tree'] = pruned_tree

        return jsonify(output)

    except Exception as e:
        output["Error"] = str(e)
        log.datetime_log("Error: {}".format(e))
        return jsonify(output)


@app.route("/api/post_prune_trees", methods=["POST"])
def post_prune_trees():
    
    output = {}

    try:
        data = request.get_json()
        merged_tree = json.loads(data['mergedTree']);
        threshold = float(data['threshold'])

        sequences = list(merged_tree['SCORE'].keys())
        saved_sequences, rest = utils.get_unsaved_sequences(
                sequences)

        pruned_sequences = []

        for sequence in saved_sequences:
            pruned_sequence = {}
            pruned_sequence['sequence_id'] = sequence['sequence_id']
            pruned_sequence['hierarchy'] = utils.prune_tree(
                    threshold, sequence['hierarchy'])
            pruned_sequences.append(pruned_sequence)

        pruned_tree = utils.prune_tree(threshold, merged_tree)

        output['pruned_sequences'] = pruned_sequences
        output['pruned_tree'] = pruned_tree

        return jsonify(output)

    except Exception as e:
        output["Error"] = str(e)
        log.datetime_log("Error: {}".format(e))
        return jsonify(output)


@app.route("/api/upload_xml", methods=["POST"])
def upload_xml():
    
    output = {}

    try:
        data = request.get_json()

        if data["file"] is not None and data["filename"] is not None:

            merged_tree = {'name':'', 'children': {}, 'SCORE': []}
            file_path = utils.save_file_with_modifier(
                        data["file"], data["filename"])    
                        
            file_name = file_path.split("/")
            file_name = file_name[len(file_name)-1]

            blast_records = utils.parseXML(file_path)

            batch = [utils.extract_information_from_blast_record(record, merged_tree) for record in blast_records]
            batch = [register for register in batch if register]

            # Prepare output
            hierarchy, aggregated_score = utils.form_hierarchy(merged_tree)
            output["merged_tree"] = hierarchy

            output["taxonomies_batch"] = dict( ( element["sequence_id"], element ) for element in batch )
            
            output["file_name"] = file_name

            return jsonify(output)    

    except Exception as e:
        output["Error"] = str(e)
        log.datetime_log("Error: {}".format(e))
        return jsonify(output)


@app.route("/api/filter_xml", methods=["POST"])
def filter_xml():
    output = {}
    try:
        data = request.get_json()

        if data["filename"] is not None and data["queries"] is not None:
            encoded = utils.filter_xml(
                    data["filename"], data["queries"])

            output["file"] = encoded.decode('utf-8')
            return jsonify(output)

    except Exception as e:
        log.datetime_log("Error: {}".format(e))
        return jsonify(output)


@app.route("/api/upload_file", methods=["POST"])
def upload_file():
    
    output = {}

    try:
        data = request.get_json()

        if data["file"] is not None and data["filename"] is not None:

            taxonomy = []
            parsed_filename = data["filename"].split(".")[0]
            merged_tree = {'name':'', 'children': {}, 'SCORE': []}

            try:
                file_path = utils.try_to_save_file(
                        data["file"], data["filename"])

                log.datetime_log("Succeded saving file.")
    
                merged_tree, taxonomy = utils.process_batch(
                        [parsed_filename], [file_path], merged_tree)

            except utils.FileExists as e:
                taxonomy, tmp_sequences = utils.get_unsaved_sequences(
                    [parsed_filename])
                
                if len(taxonomy) == 0:
                    sequence_id = utils.get_sequence_id(data["filename"])
                    if sequence_id is not None:
                        log.datetime_log("File existed and sequence {} parsed succesfully.".format(sequence_id))
                        taxonomy, tmp_sequences = utils.get_unsaved_sequences(
                            [sequence_id])

                if len(taxonomy) > 0:
                    utils.get_hierarchy_from_dict(
                        taxonomy[0]['sequence_id'],
                        taxonomy[0]['comparisons'],
                        target=merged_tree)

                else:
                    log.datetime_log("File existed but sequence not parsed: trying to write a new file.")

                    file_path = utils.save_file_with_modifier(
                        data["file"], data["filename"])    
                        
                    file_name = file_path.split("/")
                    file_name = file_name[len(file_name)-1]
                    
                    log.datetime_log("File succesfully saved at {}.".format(file_path))
    
                    merged_tree, taxonomy = utils.process_batch(
                            [parsed_filename], [file_path], merged_tree)

            # Prepare output
            hierarchy, aggregated_score = utils.form_hierarchy(merged_tree)
            output["merged_tree"] = hierarchy['children'][0]

            output["taxonomies_batch"] = taxonomy   
            return jsonify(output)    

    except Exception as e:
        output["Error"] = str(e)
        log.datetime_log("Error: {}".format(e))
        return jsonify(output)

        
if __name__ == "__main__":
    app.run(host="0.0.0.0",port=8080,debug=True)
