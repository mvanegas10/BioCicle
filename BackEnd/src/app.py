#!flask/bin/python
from flask import request, Flask, jsonify
from flask_cors import CORS, cross_origin
import json
import utils

app = Flask(__name__)
CORS(app)

@app.route('/post_compare_sequence', methods=['POST'])
def post_compare_sequence():

    data = request.form.to_dict(flat=False)

    if not "batch_size" in data:
        data["batch_size"] = 1

    data["sequences"] = json.loads(data["sequences"][0])

    counter = 0
    current_batch_stop = counter
    pieces_left = len(data["sequences"]) > 0
    comparisons_batch = []

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

        comparisons_batch.extend([utils.extract_comparisons_from_file(file) for file in file_batch])

        print("{} files processed.".format(counter))

    return jsonify(comparisons_batch)

if __name__ == '__main__':
    app.run(host='0.0.0.0',port=8080,debug=True)
