#!flask/bin/python
from flask import Flask, jsonify
from flask_cors import CORS, cross_origin
import csv
import os

app = Flask(__name__)
CORS(app)

@app.route('/datos', methods=['GET'])
def get_registros():
	pwd = os.getcwd()
	files = []
	models = []
	for (dirpath, dirnames, filenames) in os.walk('%s/data/' % pwd):
		files.extend(filenames)
		break
	for file in files:
		doc = open('%s/data/%s' % (pwd,file))
		reader = csv.reader(doc, delimiter='\t')
		obj = []
		for row in reader:
			obj.append({"ID": row[0], "NAME": row[1], "ORGANISM": row[2], "SCORE": row[3], "TAXID": row[4], "KINGDOM": row[5], "PHYLUM": row[6], "CLASS": row[7], "ORDER": row[8], "FAMILY": row[9], "GENUS": row[10], "SPECIES": row[11]})
		models.append(obj)
	return jsonify(models)
if __name__ == '__main__':
	app.run(host='0.0.0.0',port=8080)
