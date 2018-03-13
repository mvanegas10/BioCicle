import os
import datetime
import requests
import ncbi_blast.client as blast
from multiprocessing.pool import Pool
from functools import partial

PROJECT_DIR = os.path.dirname(os.path.dirname(__file__))
TMP_FOLDER = os.path.join(PROJECT_DIR, "tmp/")
UNI_PROT_URL = "https://www.uniprot.org/uniprot/"
SRC_FOLDER = os.path.join(PROJECT_DIR, "src/")
TAXDUMP_FOLDER = os.path.join(SRC_FOLDER, "taxdmp/")
NODES_FILE = os.path.join(TAXDUMP_FOLDER, "nodes.dmp")
NAMES_FILE = os.path.join(TAXDUMP_FOLDER, "names.dmp")

def compare_sequence(sequence):
    options = {'program': 'blastp', 'database': 'uniprotkb_swissprot', 'stype': 'protein', 'matrix': None, 'exp': None, 'filter': None, 'alignments': None, 'scores': None, 'dropoff': None, 'match_score': None, 'gapopen': None, 'gapext': None, 'gapalign': None, 'seqrange': None, 'sequence': sequence, 'email': 'm.vanegas10@uniandes.edu.co', 'title': None, 'outfile': None, 'outformat': None, 'async': None, 'jobid': None, 'polljob': None, 'status': None, 'resultTypes': None, 'params': None, 'paramDetail': None, 'quiet': None, 'verbose': None, 'baseURL': 'http://www.ebi.ac.uk/Tools/services/rest/ncbiblast', 'debugLevel': 0}
    path = os.path.join(TMP_FOLDER, blast.get_comparison(options))
    return path

def extract_comparisons_from_file(filename):
    comparisons = []
    total = 0
    with open(filename) as f:
        data = f.readlines()
        sequences = []
        for row in data:
            if row[:6] == "lcl|SP":
                sequences.append([value.strip() for value in row.split(" ")])
                total += 1

        print(datetime.datetime.time(datetime.datetime.now()).strftime("%H:%M:%S"))
        with Pool(processes=10) as pool: 
            comparisons = pool.map(partial(get_relevant_data, total=total), sequences)
        print(datetime.datetime.time(datetime.datetime.now()).strftime("%H:%M:%S"))

    return comparisons

def get_relevant_data(values, total):
    count = 0
    taxid = get_taxid_from_sequence(values[2])

    organism_result = get_taxonomy_from_taxid(taxid)

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
    
    count += 1
    
    organism_result["SCORE"] = num
    print("{} out of {} classified sequences.".format(count, total))
    return organism_result

def get_taxonomy_from_taxid(taxid):
    taxonomy_dict = {}
    rank, tax_name, parent_taxid = get_rank_from_taxid(taxid)
    while parent_taxid != 1:
        if rank != "NO RANK":
            taxonomy_dict[rank] = tax_name
        rank, tax_name, parent_taxid = get_rank_from_taxid(parent_taxid)
    return taxonomy_dict        

def get_rank_from_taxid(taxid):
    with open(NODES_FILE, 'r') as nodes:
        for node in nodes:
            node_values = node.split("|")
            if int(node_values[0]) == int(taxid):
                rank = node_values[2].strip(" \t\n\r").upper()
                parent_taxid = int(node_values[1])
                break

    with open(NAMES_FILE, 'r') as names:
        for name in names:
            name_values = name.split("|")
            if int(name_values[0]) == int(taxid):
                tax_name = name_values[1].strip(" \t\n\r")
                break

    return rank, tax_name, parent_taxid

def get_taxid_from_sequence(sequence_id):
    query = "{}{}.txt".format(UNI_PROT_URL,sequence_id)
    response = requests.get(query).text
    lines = response.split("\n")

    for line in lines:
        line_id = line[:2]
        if line_id == "OX":
            string = line.split("=")
            string = string[len(string)-1].replace(";","").split(" ")
            return string[0].strip(" \t\n\r")
    
