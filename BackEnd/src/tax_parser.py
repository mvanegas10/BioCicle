import os
import pymongo
from pymongo import MongoClient
from multiprocessing.pool import Pool
from functools import partial
import components.log as log
from itertools import islice


client = MongoClient()
db = client.biovis
db_taxonomy = db.taxonomy


def insert_taxes(chunk):
    client = MongoClient()
    db = client.biovis
    db_taxonomy = db.taxonomy
    db_taxonomy.insert_many(chunk)


def parse_tax(row):
    values_list = row.split("|")
    node = {
        "tax_id":           int(values_list[0].strip(" \t\n\r")),
        "parent_tax_id":    int(values_list[1].strip(" \t\n\r")),
        "rank":             values_list[2].strip(" \t\n\r")
    }
    return node


def read_in_chunks(file, batch_size):
    log.datetime_log("Started batch node parser")
    data = list(map(lambda x: parse_tax(x), islice(file, batch_size)))
    yield data


def parse_nodes_file(filename, **kargs):

    batch_size = 1
    processes = 1
    if "batch_size" in kargs:
        batch_size = kargs["batch_size"]

    if "processes" in kargs:
        processes = kargs["processes"]

    with open(filename, "r") as f:
        with Pool(processes=processes) as pool: 
            pool.map( insert_taxes, read_in_chunks(f, batch_size))


def update_one(new_values):
    query = {
        "tax_id": new_values.pop("tax_id")
    }

    update = {'$set': new_values}
    db_taxonomy.find_one_and_update(query, update)


def get_new_values(row):
    output = { 
        "tax_id": None
    }
    values_list = row.split("|")
    name_type = values_list[3].strip(" \t\n\r")
    if not name_type == "scientific name":
        return output
    else:
        output["tax_id"] = int(values_list[0].strip(" \t\n\r"))
        output["name"] = values_list[1].strip(" \t\n\r")
        return output


def parse_names_file(filename, **kargs):

    batch_size = 1
    processes = 1
    if "batch_size" in kargs:
        batch_size = kargs["batch_size"]

    if "processes" in kargs:
        processes = kargs["processes"]

    with open(filename, "r") as f:
        for i, data in enumerate(
                iter(lambda: tuple(islice(f, batch_size)), ())):
            log.datetime_log("Started batch no. {} name parser".format(i))
            with Pool(processes=processes) as pool: 
                filtered_data = [get_new_values(row) for row in data if "name" in get_new_values(row)]
                pool.map( update_one, filtered_data)


if __name__ == "__main__":
    PROJECT_DIR = os.path.dirname(os.path.dirname(__file__))
    NODES_FILE = os.path.join(PROJECT_DIR, "src/components/taxdmp/nodes.dmp")
    NAMES_FILE = os.path.join(PROJECT_DIR, "src/components/taxdmp/names.dmp")
    BATCH_SIZE = 10000

    # parse_nodes_file(NODES_FILE, batch_size=BATCH_SIZE, processes=16)
    parse_names_file(NAMES_FILE, batch_size=BATCH_SIZE, processes=16)
