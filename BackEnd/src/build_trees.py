import os
import requests
import base64
import json
import pymongo
from pathlib import Path
import components.log as log
from pymongo import MongoClient
from multiprocessing.pool import Pool
from functools import partial,reduce
from os import listdir
from os.path import isfile, join

PROJECT_DIR = os.path.dirname(os.path.dirname(__file__))
FOLDER = os.path.join(PROJECT_DIR, "src/static/tmp/")
TMP_FOLDER = os.path.join(PROJECT_DIR, "tmp/")
TAXIDS_FILE = os.path.join(TMP_FOLDER, "taxids.txt")
NUCLEOTIDE_FILE = os.path.join(TMP_FOLDER, "nucl_gb.accession2taxid")
MINIMUM_RANKS = ["PHYLUM","CLASS","ORDER","FAMILY","GENUS","SPECIES"]
NONE_RANK = {
    "PHYLUM":"undefined",
    "CLASS":"undefined",
    "ORDER":"undefined",
    "FAMILY":"undefined",
    "GENUS":"undefined",
    "SPECIES":"undefined"
    }

def process_files(folder, tree, **kargs):
    with MongoClient() as client:
        db = client.biovis
        db_models = db.models
        processed_batch = []

        files = [f for f in listdir(folder) if isfile(join(folder, f))]

        for i,file in enumerate(files):
            file_list = file.split("/")
            filename = file_list[len(file_list) - 1].split(".")[0]
            if "ncbi" in filename:
                file = os.path.join(folder, file)

                comparisons = extract_comparisons_from_file(file)
                
                tmp_tree, tmp_hierarchy = get_hierarchy_from_dict(
                        filename, comparisons)
                
                tree = get_hierarchy_from_dict(
                        filename, 
                        comparisons,
                        target=tree)

                processed_sequence = {
                    "sequence_id": filename,
                    "comparisons": comparisons,
                    "tree": tmp_tree,
                    "hierarchy": tmp_hierarchy,
                    "max": comparisons[0]["SCORE"],
                    "filename": filename
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
    taxonomy_dict = NONE_RANK
    try:
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
    except:
        log.datetime_log("Not able to find rank of taxid {}".format(taxid))
        return NONE_RANK


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
    with open(TAXIDS_FILE, 'r') as f:
        for line in f:
            taxnode = line.split("\t")
            if str(taxnode[1]) == str(sequence_id):
                return int(taxnode[2].strip(" \t\n\r"))

    with open(NUCLEOTIDE_FILE, 'r') as f:
        for line in f:
            if str(sequence_id) in line:
                taxnode = line.split("\t")
                if str(taxnode[1]) == str(sequence_id):
                    return int(taxnode[2].strip(" \t\n\r"))


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



if __name__ == "__main__":
    BATCH_SIZE = 10000   
    merged_tree = {'name':'', 'children': {}, 'SCORE': []}
    process_files(FOLDER, merged_tree, batch_size=BATCH_SIZE, processes=16)    