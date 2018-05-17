import os
import components.log as log
import utils as utils
from multiprocessing.pool import Pool
from functools import partial
from itertools import islice


def compare_sequence(sequence, TMP_FOLDER):
    options = {
        'program': 'blastn', 
        'database': 'em_rel', 
        'stype': 'dna', 
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

    return utils.compare_sequence(
        sequence, options=options, TMP_FOLDER=TMP_FOLDER)


def parse_sequences(TMP_FOLDER, filename, **kargs):

    batch_size = 1
    processes = 1
    if "batch_size" in kargs:
        batch_size = kargs["batch_size"]

    if "processes" in kargs:
        processes = kargs["processes"]

    with open(filename, "r") as f:
        output_paths = []
        for i, data in enumerate(
                iter(lambda: tuple(islice(f, batch_size)), ())):
            log.datetime_log("Started batch no. {} name parser".format(i))
            with Pool(processes=processes) as pool: 
                filtered_data = [row for row in data if not row[:1] == ">"]
                output_paths.extend(
                    pool.map(
                        partial(compare_sequence, TMP_FOLDER=TMP_FOLDER),
                        filtered_data))


if __name__ == "__main__":
    PROJECT_DIR = os.path.dirname(os.path.dirname(__file__))
    TMP_FOLDER = os.path.join(PROJECT_DIR, "tmp/")
    SEQUENCES_FILE = os.path.join(TMP_FOLDER, "rep_set.fna")
    BATCH_SIZE = 10000

    parse_sequences(
        TMP_FOLDER, 
        SEQUENCES_FILE, 
        batch_size=BATCH_SIZE, 
        processes=16)
