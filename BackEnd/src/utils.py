import os
import datetime
import requests
import ncbi_blast.client as blast
from multiprocessing.pool import Pool
from functools import partial,reduce
import json


PROJECT_DIR = os.path.dirname(os.path.dirname(__file__))
TMP_FOLDER = os.path.join(PROJECT_DIR, "tmp/")
UNI_PROT_URL = "https://www.uniprot.org/uniprot/"
SRC_FOLDER = os.path.join(PROJECT_DIR, "src/")
TAXDUMP_FOLDER = os.path.join(SRC_FOLDER, "taxdmp/")
NODES_FILE = os.path.join(TAXDUMP_FOLDER, "nodes.dmp")
NAMES_FILE = os.path.join(TAXDUMP_FOLDER, "names.dmp")
MINIMUM_RANKS = ["PHYLUM","CLASS","ORDER","FAMILY","GENUS","SPECIES"]

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
                sequences.append({
                    "id":total, 
                    "values":[value.strip() for value in row.split(" ")]
                })
                total += 1

        print(datetime.datetime.time(datetime.datetime.now()).strftime("%H:%M:%S"))
        with Pool(processes=10) as pool: 
            comparisons = pool.map(partial(get_relevant_data, total=total), sequences)

        score_list = [sequence["SCORE"] for sequence in comparisons]
        total_score = reduce(lambda x,y: x+y, score_list) 

        for sequence in comparisons:
            sequence["SCORE"] = sequence["SCORE"]/total_score * 100

        print(datetime.datetime.time(datetime.datetime.now()).strftime("%H:%M:%S"))

    return comparisons

def get_relevant_data(values, total):
    count = values["id"]
    values = values["values"]
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
    print("Classified sequence with id.{} out of {} sequences.".format(count, total))
    return organism_result

def get_taxonomy_from_taxid(taxid):
    taxonomy_dict = {}
    rank, tax_name, parent_taxid = get_rank_from_taxid(taxid)
    while parent_taxid != 1:
        if rank != "NO RANK":
            taxonomy_dict[rank] = tax_name
        rank, tax_name, parent_taxid = get_rank_from_taxid(parent_taxid)

    # Check if it has the minimum rankings
    for min_rank in MINIMUM_RANKS:
        if not min_rank in taxonomy_dict.keys():
            possible_ranks = [rank for rank in taxonomy_dict.keys() if min_rank in rank]
            if len(possible_ranks) > 0:
                taxonomy_dict[min_rank] = taxonomy_dict[possible_ranks[0]]
            else:
                taxonomy_dict[min_rank] = "undefined"

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

def form_hierarchy(node):
    if not len(node['children']) == 0:
        children_list = []
        for child, child_node in node['children'].items():
            children_list.append(form_hierarchy(child_node))
        node['children'] = []
        node['children'].extend(children_list)
        return node

    else:
        node.pop('children', None)
        node['value'] = +node['SCORE']
        return node

def get_hierarchy_from_dict(comparisons):
    tree = {'name':'', 'children': {}, 'SCORE': 0.0}

    for i, sequence in enumerate(comparisons):
        children = tree['children']
        for rank in MINIMUM_RANKS:
            if not sequence[rank] in children.keys():
                children[sequence[rank]] = {'name':sequence[rank], 'children': {}, 'SCORE': 0.0}
            children[sequence[rank]]['SCORE'] += sequence['SCORE']
            children = children[sequence[rank]]['children']

    return form_hierarchy(tree)

def prune_tree(threshold, node):
    preserved_nodes = []

    if node['children'] is not None and len(node['children']) > 0:

        current_children = node['children'].copy()
      
        for child in current_children:

            if child['value'] > threshold:
                pruned_child = prune_tree(threshold, child)
                
                if pruned_child is not None:
                    preserved_nodes.append(pruned_child)

        node['children'] = preserved_nodes
        if len(preserved_nodes) > 0:
            return node
        elif node['value'] > threshold:
            node['children'] = None
            return node
    
    elif node['value'] > threshold:
        return node;