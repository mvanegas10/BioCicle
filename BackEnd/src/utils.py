import os
import requests
import ncbi_blast.client as blast
from random import randint

PROJECT_DIR = os.path.dirname(os.path.dirname(__file__))
TMP_FOLDER = os.path.join(PROJECT_DIR, "tmp")
UNI_PROT_URL = "https://www.uniprot.org/uniprot/"

taxonomy_ranks = [
    "DOMAIN",
    "KINGDOM",
    "PHYLUM",
    "CLASS",
    "ORDER",
    "FAMILY",
    "GENUS",
    "SPECIE",
    "ORGANISM",
    "NAME"
]

def compare_sequence(sequence):
    options = {'program': 'blastp', 'database': 'uniprotkb_swissprot', 'stype': 'protein', 'matrix': None, 'exp': None, 'filter': None, 'alignments': None, 'scores': None, 'dropoff': None, 'match_score': None, 'gapopen': None, 'gapext': None, 'gapalign': None, 'seqrange': None, 'sequence': 'sp:wap_rat', 'email': 'm.vanegas10@uniandes.edu.co', 'title': None, 'outfile': None, 'outformat': None, 'async': None, 'jobid': None, 'polljob': None, 'status': None, 'resultTypes': None, 'params': None, 'paramDetail': None, 'quiet': None, 'verbose': None, 'baseURL': 'http://www.ebi.ac.uk/Tools/services/rest/ncbiblast', 'debugLevel': 0}
    blast.get_comparison(options)

    return os.path.join(TMP_FOLDER, "ncbiblast-R20180221-115211-0096-36576354-p2m.out.txt")

def extract_comparisons_from_file(filename):
    comparisons = []
    with open(filename) as f:
        data = f.readlines()
        for row in data:
            if row[:6] == "lcl|SP":
                values = [value.strip() for value in row.split(" ")]
                taxonomy_list = get_taxonomy_from_sequence(values[2])

                organism_result = {}

                final_list = taxonomy_list if len(taxonomy_list) <= len(taxonomy_ranks) else taxonomy_ranks

                for i, rank in enumerate(final_list):
                    organism_result[rank] = taxonomy_list[i]

                i = len(values) - 1
                cont = 0
                score = 0
                while True:
                    try:
                        num = float(values[i])
                        cont += 1
                        if cont == 2:
                            score = num
                            break
                    except ValueError:
                        pass
                    i -= 1 
                
                organism_result["SCORE"] = num
                comparisons.append(organism_result)
    return comparisons

def get_taxonomy_from_sequence(sequence_id):
    query = "{}{}.txt".format(UNI_PROT_URL,sequence_id)
    response = requests.get(query).text
    lines = response.split("\n")

    taxonomy_list = []
    for line in lines:
        values = line.split(" ")
        if values[0] == "OC":
            taxonomy_list.extend([value.replace(";","").replace(".","") for value in values[3:]])
    return taxonomy_list
