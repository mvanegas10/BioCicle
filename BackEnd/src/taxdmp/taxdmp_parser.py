import os

PROJECT_DIR = os.path.dirname(os.path.dirname(__file__))
TAXDUMP_FOLDER = os.path.join(PROJECT_DIR, "taxdmp/")
NODES_FILE = os.path.join(TAXDUMP_FOLDER, "nodes.dmp")
NAMES_FILE = os.path.join(TAXDUMP_FOLDER, "names.dmp")
JOIN_FILE = os.path.join(TAXDUMP_FOLDER, "taxids_names.txt")

tax_ids = set()

def search_name_from_tax_id(tax_id):
    with open(NAMES_FILE, 'r') as names:
        for name in names:
            name_values = name.split("|")
            if int(name_values[0]) == int(tax_id):
                return name_values[1].strip(" \t\n\r")

def insert_into_file(taxonomy_info):
    with open(JOIN_FILE, 'ab') as join:
        text = ",".join([str(value) for value in taxonomy_info])
        text += "\n"
        print(text)
        join.write(text)

with open(NODES_FILE, 'r') as nodes:
    for node in nodes:
        node_values = node.split("|")
        taxonomy_info = []
        tax_id = int(node_values[0])
        taxonomy_info.append(tax_id)
        if not tax_id in tax_ids:
            tax_ids.add(int(node_values[0])) 
            taxonomy_info.append(search_name_from_tax_id(tax_id))
            taxonomy_info.append(node_values[2].strip(" \t\n\r").upper())
            taxonomy_info.append(int(node_values[1]))
            insert_into_file(taxonomy_info)
            print("1")
