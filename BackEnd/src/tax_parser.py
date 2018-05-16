import pymongo
from pymongo import MongoClient
from multiprocessing.pool import Pool
from functools import partial
import components.log as log


client = MongoClient()
db = client.biovis
db_models = db.models


def insert_tax(data):
    values_list = row.split("|")
    node = {
        "tax_id":           int(values_list[0].strip(" \t\n\r")),
        "parent_tax_id":    int(values_list[1].strip(" \t\n\r")),
        "rank":             values_list[2].strip(" \t\n\r")
    }

    db_models.insert_one(node)
    log.datetime_log("Inserted {} tax id".format())



def parse_nodes_file(file)
    with open(file) as f:

        log.datetime_log("Starting node parser")

        with Pool(processes=50) as pool: 
            comparisons = pool.map(
                    partial(data), sequences)

        log.datetime_log("Finished node parser")

        data = f.readlines()
        for row in data:
          


search = {
                "sequence_id": sequence
            }

        saved = db_models.find_one(search)            


if __name__ == "__main__":
    PROJECT_DIR = os.path.dirname(os.path.dirname(__file__))
    NODES_FILE = os.path.join(PROJECT_DIR, "nodes.dmp")
    NAMES_FILE = os.path.join(PROJECT_DIR, "names.dmp")

    parse_nodes_file(NODES_FILE)
    parse_nodes_file(NODES_FILE)