import os
import requests
import json
import pymongo
import components.log as log
from pymongo import MongoClient
import components.ncbi_blast.client as blast
from multiprocessing.pool import Pool
from functools import partial,reduce

PROJECT_DIR = os.path.dirname(os.path.dirname(__file__))
TMP_FOLDER = os.path.join(PROJECT_DIR, "tmp/")
UNI_PROT_URL = "https://www.uniprot.org/uniprot/"
SRC_FOLDER = os.path.join(PROJECT_DIR, "src/")
COMPONENTS_FOLDER = os.path.join(SRC_FOLDER, "components/")
TAXDUMP_FOLDER = os.path.join(COMPONENTS_FOLDER, "taxdmp/")
NODES_FILE = os.path.join(TAXDUMP_FOLDER, "nodes.dmp")
NAMES_FILE = os.path.join(TAXDUMP_FOLDER, "names.dmp")
MINIMUM_RANKS = ["PHYLUM","CLASS","ORDER","FAMILY","GENUS","SPECIES"]

client = MongoClient()
db = client.biovis
db_models = db.models


def get_unsaved_sequences(sequences):
    saved_list = []
    nonsaved_list = sequences.copy()

    for sequence in sequences:

        search = {
                "sequence_id": sequence
            }

        saved = db_models.find_one(search)

        if (saved is not None 
        and saved["comparisons"] is not None 
        and saved["hierarchy"] is not None):

            saved.pop('_id', None)
            nonsaved_list.remove(sequence)
            saved_list.append(saved)

    return saved_list, nonsaved_list


def compare_sequence(sequence):
    options = {
        'program': 'blastp', 
        'database': 'uniprotkb_swissprot', 
        'stype': 'protein', 
        'matrix': None, 
        'exp': None, 
        'filter': None, 
        'alignments': None, 
        'scores': None, 
        'dropoff': None, 
        'match_score': None, 
        'gapopen': None, 
        'gapext': None, 
        'gapalign': None, 
        'seqrange': None, 
        'sequence': sequence, 
        'email': 'm.vanegas10@uniandes.edu.co', 
        'title': None, 
        'outfile': None, 
        'outformat': None, 
        'async': None, 
        'jobid': None, 
        'polljob': None, 
        'status': None, 
        'resultTypes': None, 
        'params': None, 
        'paramDetail': None, 
        'quiet': None, 
        'verbose': None, 
        'baseURL': 'http://www.ebi.ac.uk/Tools/services/rest/ncbiblast', 
        'debugLevel': 0
    }

    path = os.path.join(TMP_FOLDER, blast.get_comparison(options))
    return path


def process_batch(sequences, file_batch, tree):
    processed_batch = []

    for i,file in enumerate(file_batch):

        comparisons = extract_comparisons_from_file(file)
        
        tmp_tree, tmp_hierarchy = get_hierarchy_from_dict(
                sequences[i], comparisons)

        tree = get_hierarchy_from_dict(
                sequences[i], 
                comparisons,
                target=tree)

        processed_sequence = {
            "sequence_id": sequences[i],
            "comparisons": comparisons,
            "tree": tmp_tree,
            "hierarchy": tmp_hierarchy
        }

        db_models.insert_one(processed_sequence.copy())

        processed_batch.extend([processed_sequence])

    return tree, processed_batch


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

        log.datetime_log("Starting process for filename {}".format(filename))

        with Pool(processes=10) as pool: 
            comparisons = pool.map(
                    partial(get_relevant_data, total=total), sequences)

        score_list = [sequence["SCORE"] for sequence in comparisons]
        total_score = reduce(lambda x,y: x+y, score_list) 

        for sequence in comparisons:
            sequence["SCORE"] = sequence["SCORE"]/total_score * 100

        log.datetime_log("Finishing process for filename {}".format(filename))

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
    log.datetime_log(
            "Classified sequence with id.{} out of {} sequences.".format(
                count,total))

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
            possible_ranks = [rank for rank in taxonomy_dict.keys() 
                if min_rank in rank]

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
        for sequence in node['SCORE'].keys():
            if not 'value' in node.keys():
                node['value'] = {}
            if not sequence in node['value'].keys():
                node['value'][sequence] = 0.0
            
            node['value'][sequence] += node['SCORE'][sequence]

        return node


def get_hierarchy_from_dict(sequence_id, comparisons, **kargs):

    if not 'target' in kargs:
        tree = {'name':'', 'children': {}, 'SCORE': []}
    else:
        tree = kargs['target']

    for i, sequence in enumerate(comparisons):
        children = tree['children']
        for rank in MINIMUM_RANKS:
            if not sequence[rank] in children.keys():
                children[sequence[rank]] = {
                    'name':sequence[rank], 
                    'children': {}, 
                    'SCORE': {}
                }

            if not sequence_id in children[sequence[rank]]['SCORE'].keys():
                children[sequence[rank]]['SCORE'][sequence_id] = 0.0

            children[sequence[rank]]['SCORE'][sequence_id] += sequence['SCORE']
            children = children[sequence[rank]]['children']

    if not 'target' in kargs:
        return tree, form_hierarchy(tree)['children'][0]
    else:
        return tree


def prune_tree(threshold, node):
    print("Tree")
    print(node)
    preserved_nodes = []

    if 'children' in node.keys() and len(node['children']) > 0:

        current_children = node['children'].copy()
      
        for child in current_children:
            score_sequences = {}
            for key, sequence_value in child['SCORE'].items():
                if float(sequence_value) >= threshold:
                    score_sequences[key] = sequence_value

            if len(score_sequences.keys()) > 0:
                child['SCORE'] = score_sequences
                pruned_child = prune_tree(threshold, child)
                
                if pruned_child is not None:
                    preserved_nodes.append(pruned_child)

        if len(preserved_nodes) > 0:
            node['children'] = preserved_nodes
        else:
            node.pop('children', None)
            node['value'] = node ['SCORE']

        return node
        
    else:
        score_sequences = {}

        for key, sequence_value in node['SCORE'].items():
            if float(sequence_value) >= threshold:
                score_sequences[key] = sequence_value

        if len(score_sequences.keys()) > 0:
            node['value'] = score_sequences
            node['SCORE'] = score_sequences
            node.pop('children', None)
        
            return node
            
        else:
            return None