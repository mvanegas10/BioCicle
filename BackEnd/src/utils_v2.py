import os
import requests
import base64
import json
import pymongo
from pathlib import Path
import components.log as log
from pymongo import MongoClient
import components.ncbi_blast.client as blast
from multiprocessing.pool import Pool
from functools import partial,reduce

PROJECT_DIR = os.path.dirname(os.path.dirname(__file__))
UNI_PROT_URL = "https://www.uniprot.org/uniprot/"
SRC_FOLDER = os.path.join(PROJECT_DIR, "src/")
TMP_FOLDER = os.path.join(SRC_FOLDER, "static/tmp/")
COMPONENTS_FOLDER = os.path.join(SRC_FOLDER, "components/")
TAXDUMP_FOLDER = os.path.join(COMPONENTS_FOLDER, "taxdmp/")
NODES_FILE = os.path.join(TAXDUMP_FOLDER, "nodes.dmp")
NAMES_FILE = os.path.join(TAXDUMP_FOLDER, "names.dmp")
NUCLEOTIDE_FILE = os.path.join(PROJECT_DIR, "tmp/nucl_gb.accession2taxid")
MINIMUM_RANKS = ["PHYLUM","CLASS","ORDER","FAMILY","GENUS","SPECIES"]

class FileExists(Exception):
    pass


def get_unsaved_sequences(sequences):
    with MongoClient() as client:
        db = client.biovis
        db_models = db.models

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

                saved.pop("_id", None)
                nonsaved_list.remove(sequence)
                saved["max"] = saved["comparisons"][0]["SCORE"]
                saved_list.append(saved)

    return saved_list, nonsaved_list


def save_file(file, file_path):
    path = Path(file_path)

    if path.is_file():
        raise FileExists(file_path)

    else:
        with open(file_path, "wb") as file_writer:
            file_writer.write(base64.decodebytes(file.encode('ascii')))
        return file_path 
    

def compare_sequence(sequence, **kargs):
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
        'email': 'vanegas@rhrk.uni-kl.de', 
        # 'email': 'm.vanegas10@uniandes.edu.co', 
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

    if "options" in kargs:
        options = kargs["options"]
    folder = TMP_FOLDER
    if "TMP_FOLDER" in kargs:
        folder = kargs["CUSTOM_FOLDER"]

    path = os.path.join(folder, blast.get_comparison(options, folder))
    return path


def get_sequence_id(filename):
    path = "{}{}".format(TMP_FOLDER, filename)

    with open(path) as f:
        data = f.readlines()
        sequences = []
        row = data[23]
        if row[:6] == "Query=":
            sequence_id = row.split("|")[2].split(" ")[0]
            return "sp:{}".format(sequence_id)


def try_to_save_file(file, filename, **kargs):

    if "modifier" in kargs:
        filename = "{}-{}".format(kargs["modifier"], filename)

    file_path = "{}{}".format(TMP_FOLDER, filename)

    return save_file(file, file_path)


def process_batch(sequences, file_batch, tree):
    with MongoClient() as client:
        db = client.biovis
        db_models = db.models

        processed_batch = []

        for i,file in enumerate(file_batch):

            file_list = file.split("/")
            filename = file_list[len(file_list) - 1]

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
                "hierarchy": tmp_hierarchy,
                "max": comparisons[0]["SCORE"],
                "filename": filename
            }

            db_models.insert_one(processed_sequence.copy())

            print(processed_sequence["max"])

            processed_batch.extend([processed_sequence])        

    return tree, processed_batch


def extract_comparisons_from_file(filename):
    comparisons = []
    total = 0

    with open(filename) as f:
        data = f.readlines()
        sequences = []
        for row in data:
            if row[:4] == "lcl|":
                sequences.append({
                    "id":total, 
                    "values":[value.strip() for value in row.split(" ")]
                })
                total += 1


        log.datetime_log("Starting process for filename {}".format(filename))

        with Pool(processes=10) as pool: 
            comparisons = pool.map(
                    partial(get_relevant_data, total=total), sequences)

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
    with MongoClient() as client:
        db = client.biovis
        db_taxonomy = db.taxonomy 
           
        query = {
            "tax_id": taxid
        }

        node = db_taxonomy.find_one(query)

        if (node is not None 
        and "name" in node 
        and "rank" in node
        and "parent_tax_id" in node):
            return node["rank"].strip(" \t\n\r").upper(), node["name"], int(node["parent_tax_id"])
        else:
            return node["rank"].strip(" \t\n\r").upper(), "undefined", int(node["parent_tax_id"])


def get_taxid_from_sequence(sequence_id):

    if "uniprot" in kargs:
        query = "{}{}.txt".format(UNI_PROT_URL,sequence_id)
        response = requests.get(query).text
        lines = response.split("\n")

        for line in lines:
            line_id = line[:2]
            if line_id == "OX":
                string = line.split("=")
                string = string[len(string)-1].replace(";","").split(" ")
                return int(string[0].strip(" \t\n\r"))

    else:
        with open(NUCLEOTIDE_FILE, 'r') as nucleotides:
            for nucleotide in nucleotides:
                nucleotide_values = nucleotide.split("\t")
                print(nucleotide_values)
                if str(nucleotide_values[1]) == str(sequence_id):
                    print("{}{}".format("*"*30, nucleotide_values[2]))
                    return int(nucleotide_values[2].strip(" \t\n\r"))

def form_hierarchy(node):
    if not len(node['children']) == 0:
        children_list = []
        aggregated_score = {}
        for child, child_node in node['children'].items():
            parsed_child, child_score = form_hierarchy(child_node)
            children_list.append(parsed_child)
            
            for sequence in child_score.keys():
                if not sequence in aggregated_score.keys():
                    aggregated_score[sequence] = 0.0

                aggregated_score[sequence] += child_score[sequence]

        node['children'] = []
        node['children'].extend(children_list)
        node['SCORE'] = aggregated_score
        return node, aggregated_score

    else:
        node.pop('children', None)
        for sequence in node['SCORE'].keys():
            if not 'value' in node.keys():
                node['value'] = {}
            if not sequence in node['value'].keys():
                node['value'][sequence] = 0.0
            
            node['value'][sequence] = node['SCORE'][sequence]

        return node, node['SCORE']


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

            current_score = children[sequence[rank]]['SCORE'][sequence_id]
            if rank == 'SPECIES' and current_score < sequence['SCORE']:
                children[sequence[rank]]['SCORE'][sequence_id] = sequence['SCORE']
            
            children = children[sequence[rank]]['children']

    if not 'target' in kargs:
        hierarchy, aggregated_score = form_hierarchy(tree)
        return tree, hierarchy['children'][0]
    else:
        return tree


def prune_tree(threshold, node):

    pruned_node = node.copy()

    pruned_score = {}
    for key, sequence_value in node['SCORE'].items():
        if float(sequence_value) >= threshold:
            pruned_score[key] = sequence_value

    if len(pruned_score.keys()) > 0:
        pruned_node['SCORE'] = pruned_score
    
        if 'children' in node.keys() and len(node['children']) > 0:
            preserved_children = []
          
            for child in pruned_node['children']:
                pruned_child = prune_tree(threshold, child)
                
                if pruned_child is not None:
                    preserved_children.append(pruned_child)

            if len(preserved_children) > 0:
                pruned_node['children'] = preserved_children

            else:
                pruned_node['value'] = pruned_score
                pruned_node.pop('children', None)

        else:
            pruned_node.pop('children', None)
            pruned_node['value'] = pruned_score
    
    else:
        pruned_node = None

    return pruned_node