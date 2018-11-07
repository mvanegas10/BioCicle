import os
import re
import requests
import base64
import json
import csv
import math
from tqdm import tqdm
import gzip
import shutil
import pymongo
import string
import random
import sqlite3
from Bio.Blast import NCBIXML
import xml.etree.ElementTree as ET
from ete3 import NCBITaxa
from pathlib import Path
import components.log as log
from pymongo import MongoClient
import components.ncbi_blast.client as blast
from multiprocessing.pool import Pool
from functools import partial,reduce


PROJECT_DIR = os.path.dirname(os.path.dirname(__file__))
UNI_PROT_URL = "https://www.uniprot.org/uniprot/"
UPI_FOR_ACCESSION = "http://www.ebi.ac.uk/Tools/picr/rest/getUPIForAccession"
EBI_DATABASE = "EMBLWGS"
SRC_FOLDER = os.path.join(PROJECT_DIR, "src/")
TMP_FOLDER = os.path.join(SRC_FOLDER, "static/tmp/")
DB_FILE_URL = "https://ftp.ncbi.nih.gov/pub/taxonomy/accession2taxid/prot.accession2taxid.gz"
DB_GZ_FILE = os.path.join(PROJECT_DIR, "tmp/prot.accession2taxid.gz")
DB_TXT_FILE = os.path.join(PROJECT_DIR, "tmp/prot.accession2taxid")
SQLITE_DB = os.path.join(PROJECT_DIR, "tmp/accession2taxid.sqlite")
COMPONENTS_FOLDER = os.path.join(SRC_FOLDER, "components/")
TAXDUMP_FOLDER = os.path.join(COMPONENTS_FOLDER, "taxdmp/")
NODES_FILE = os.path.join(TAXDUMP_FOLDER, "nodes.dmp")
NAMES_FILE = os.path.join(TAXDUMP_FOLDER, "names.dmp")
NUCLEOTIDE_FILE = os.path.join(PROJECT_DIR, "tmp/nucl_gb.accession2taxid")
MINIMUM_RANKS = ["PHYLUM","CLASS","ORDER","FAMILY","GENUS","SPECIES"]


# Parses a XML file using BioPython NCBIXML
def parseXML(file):
    with open(file) as handler:
        return list(NCBIXML.parse(handler))


# Exception: File Exists
class FileExists(Exception):
    pass


# Saves base 64 file in provided path
def save_file(file, file_path):
    path = Path(file_path)

    if path.is_file():
        raise FileExists(file_path)

    else:
        with open(file_path, "wb") as file_writer:
            file_writer.write(base64.decodebytes(file.encode('ascii')))
        return file_path


# Generates a random string
def generate_random_string(limit):
    return "".join(random.choice(
            string.ascii_uppercase + string.digits) for _ in range(limit))


# Saves file using a random name. Returns file's path
def save_file_with_modifier(file, filename):
    tmp_filename = filename.split(".")
    format = tmp_filename[len(tmp_filename)-1]

    file_path = "{}{}.{}".format(
            TMP_FOLDER, generate_random_string(30), format)

    return save_file(file, file_path)


# Saves file with incoming name and modifier
def try_to_save_file(file, filename, **kargs):

    if "modifier" in kargs:
        filename = "{}-{}".format(kargs["modifier"], filename)

    file_path = "{}{}".format(TMP_FOLDER, filename)

    return save_file(file, file_path)  


# Filters XML for a given list of queries
def filter_xml(file_name, queries):
    file_path = "{}{}".format(TMP_FOLDER, file_name)
    print(file_path)
    with open(file_path) as f:
        root = ET.fromstring(f.read())
        output = root.find('BlastOutput_iterations')
        for iteration in output.findall('Iteration'):
            sequence_id = re.sub(
                r'[^\w]', ' ', iteration[2].text ).replace(' ','')
            if sequence_id not in queries:
                print(sequence_id)
                output.remove(iteration)

        xml_string = ET.tostring(root)
        print(xml_string)
        encoded = base64.encodestring(xml_string)
        print(encoded)
        return encoded


# Searches sequences in cache. Returns a list of saved sequences and a list
# of unsaved sequences  
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


# Compares sequence using the EBI/NCBI API. Returns the path of the resultant
# File
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


# Gets the sequence id from a BLAST resultant file
def get_sequence_id(filename):
    path = "{}{}".format(TMP_FOLDER, filename)

    with open(path) as f:
        data = f.readlines()
        sequences = []
        row = data[23]
        if row[:6] == "Query=":
            sequence_id = row.split("|")[2].split(" ")[0]
            return "sp:{}".format(sequence_id)


# Creates a sequence object and saves it in cache. Returns a merged tree
# for the entire sequences and a list of processed sequences
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

            processed_batch.extend([processed_sequence])        

    return tree, processed_batch


# Extracts relevant information out of a BLAST record
def extract_information_from_blast_record(record, merged_tree):
    tmp_object = {}
    sequence_id = re.sub( r'[^\w]', ' ', record.query ).replace(' ','')
    num_alignments = len(record.descriptions)
    details = [extract_alignment_detail(
            record.descriptions[i], record.alignments[i])
            for i in range(0, num_alignments)]
    #Ensure the DB accession2taxid and table prot exist before extracting taxonomy
    init_sqlite_db()

    alignments = [extract_taxonomy_from_aligment(description)
            for description in record.descriptions]
    alignments = [alig for alig in alignments if alig is not None]
    
    scores = [float(description.score) for description in record.descriptions]

    if len(scores) > 0:

        tmp_tree, tmp_hierarchy = get_hierarchy_from_dict( sequence_id, alignments )

        merged_tree = get_hierarchy_from_dict( sequence_id, alignments, target=merged_tree )

        maximum, total = max(scores), sum(scores)

        tmp_object["sequence_id"] = sequence_id
        tmp_object["hierarchy"] = tmp_hierarchy
        tmp_object["tree"] = tmp_tree
        tmp_object["max"] = maximum
        tmp_object["total"] = total
        tmp_object["comparisons"] = alignments
        tmp_object["description"] = details

    return tmp_object


# Extracts alignment's relevant information out of a BLAST result file.
def extract_comparisons_from_file(filename):
    comparisons = []
    total = 0

    with open(filename) as f:
        data = f.readlines()
        sequences = []
        for row in data:
            if row[:3] == "SP:" or row[:4] == "lcl|":
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


# Extract taxonomy and details from alignment
def extract_taxonomy_from_aligment(description):
    accession = description.title.split("|")[3]
    accession = accession[:len(accession)-2] if "." in accession else accession

    taxid = get_tax_id_from_accession_id(accession)
    
    if taxid is not None:
        taxonomy = get_taxonomy_from_taxid(taxid)
        taxonomy["SCORE"] = description.score

        return taxonomy


# Extract's alignment's details from a BLAST record object
def extract_alignment_detail(description, alignment):
    detail = {}
    detail["title"] = description.title
    detail["score"] = description.score
    detail["e"] = description.e
    detail["num_alignments"] = description.num_alignments
    detail["length"] = alignment.length
    return detail


# Extracts alignment's relevant information out of a given sequence id
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


# Checks if a taxonomy dictionary contains information of the minimum ranks.
# If not, populates the dictionary with "undefined" values
def check_minimum_ranks(taxonomy):
    for min_rank in MINIMUM_RANKS:
        if not min_rank in taxonomy.keys():
            possible_ranks = [rank for rank in taxonomy.keys()
                if min_rank in rank]

            if len(possible_ranks) > 0:
                taxonomy[min_rank] = taxonomy[possible_ranks[0]]

            else:
                taxonomy[min_rank] = "undefined"

    return taxonomy


# Creates the sqlite database from
# ftp://ftp.ncbi.nih.gov/pub/taxonomy/accession2taxid/prot.accession2taxid.gz
def init_sqlite_db():
    # From the file, initialize Database, if it doesn't exist
    if os.path.isfile(SQLITE_DB):
        return
    # Download text file from ftp server (check if it doesn't exist)
    if not os.path.isfile(DB_TXT_FILE):
        log.datetime_log("First execution. Downloading file with accession 2 taxid dictionary")
        r = requests.get(DB_FILE_URL, stream=True)
        total_size = int(r.headers.get('content-length', 0))
        block_size = 1024
        wrote = 0
        log.datetime_log("Writing .gz file. Please wait")
        with open(DB_GZ_FILE, "wb") as compressedFile:
            for data in tqdm(r.iter_content(block_size), total=math.ceil(total_size//block_size) , unit='KB', unit_scale=True):
                wrote = wrote + len(data)
                compressedFile.write(data)
        if total_size != 0 and wrote != total_size:
            log.datetime_log("ERROR, something went wrong")
        log.datetime_log("Decompressing into plain text file")
        with gzip.open(DB_GZ_FILE, 'rb') as f_in:
            with open(DB_TXT_FILE, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
    with sqlite3.connect(SQLITE_DB) as conn:
        c = conn.cursor()
        log.datetime_log("First execution. Creating database schema")
        # Create schema
        c.execute("CREATE TABLE IF NOT EXISTS prot (accession text, accession_version text, taxid int, gi int)")
        # Create index for quicker search
        log.datetime_log("Creating accession index for quicker search")
        c.execute("CREATE INDEX prot_accession ON prot (accession)")
        # import from existing file
        log.datetime_log("importing 21.8GB from " + DB_TXT_FILE + " into SQLite.\nThis may take a while.\nRows to insert: 588936237 iterations(it)")
        # count = 0
        with open(DB_TXT_FILE, 'r') as prot_table:
            # Skip header
            next(prot_table)
            for line in tqdm(prot_table):
                # count += 1
                splitted = line.split("\t")
                c.execute("INSERT INTO prot VALUES (?,?,?,?);", tuple(splitted))
                # if count % 10000000 == 0:
                #     log.datetime_log("completion: " + str(int(count / 10000000)) + " out of " + str(58) )
            
        
        conn.commit()




# Gets tax id from accession id (PROTEIN) using
# ftp://ftp.ncbi.nih.gov/pub/taxonomy/accession2taxid/prot.accession2taxid.gz
def get_tax_id_from_accession_id(accession_id):
    with sqlite3.connect(SQLITE_DB) as conn:
        c = conn.cursor()
        c.execute("SELECT taxid FROM prot WHERE accession=? LIMIT 1",(accession_id,))
        try:
            taxid = c.fetchone()[0]
            return int(taxid)
        except:
            return None


# Gets taxonomy from tax id. Returns a dictionary using the ETE library
def get_taxonomy_from_taxid(taxid):
    if taxid is not None:
        output = {}
        ncbi = NCBITaxa()

        lineage = ncbi.get_lineage(taxid)
        ranks = ncbi.get_rank(lineage)
        taxonomy = ncbi.get_taxid_translator(lineage)
        
        for rank in lineage:
            output[ranks[rank].upper()] = taxonomy[rank]

        output = check_minimum_ranks(output)
        
        return output


# Gets tax id from string sequence from a BLAST result
def get_taxid_from_sequence(sequence_id):

    query = "{}{}.txt".format(UNI_PROT_URL,sequence_id)
    response = requests.get(query).text
    lines = response.split("\n")

    for line in lines:
        line_id = line[:2]
        if line_id == "OX":
            string = line.split("=")
            string = string[len(string)-1].replace(";","").split(" ")
            return int(string[0].strip(" \t\n\r"))


# Changes children's object to lists from a tree object starting by the root
# node
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


# Forms a hierarchy object from a list of comparisons
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
        return tree, hierarchy
    else:
        return tree


# Prunes a tree by a score threshold
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
