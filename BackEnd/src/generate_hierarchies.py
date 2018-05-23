import os
import components.log as log
import utils as utils
import pymongo
from pymongo import MongoClient
from multiprocessing.pool import Pool
from functools import partial

PROJECT_DIR = os.path.dirname(os.path.dirname(__file__))
INPUT_FILE = os.path.join(PROJECT_DIR, "tmp/input.txt")


def generate_and_update_hierarchies(row):
    sequence_id = row.strip(" \t\n\r").replace(",","")

    with MongoClient() as client:
        db = client.biovis
        db_models = db.models

        search = {
                "sequence_id": sequence_id
            }

        saved = db_models.find_one(search)

        if (saved is not None 
        and saved["comparisons"] is not None):

            tmp_tree, tmp_hierarchy = utils.get_hierarchy_from_dict(
            sequence_id, saved["comparisons"])

            update = {
                "hierarchy": tmp_hierarchy,
                "tree": tmp_tree
            }

            db_models.update_one(search, {"$set": update})
            log.datetime_log("Updated document {}".format(sequence_id))
    


def update_sequences(filename, processes):

    with open(filename) as file:
        data = file.readlines()
        
        with Pool(processes=processes) as pool: 
            pool.map(
                partial(generate_and_update_hierarchies),
                data)


if __name__ == "__main__":
    update_sequences(INPUT_FILE, processes=16) 