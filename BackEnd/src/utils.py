import os
from random import randint

PROJECT_DIR = os.path.dirname(os.path.dirname(__file__))
TMP_FOLDER = os.path.join(PROJECT_DIR, "tmp")

def compare_sequence(sequence):
    return os.path.join(TMP_FOLDER, "ncbiblast-R20180221-115211-0096-36576354-p2m.out.txt")

def extract_comparisons_from_file(filename):
    comparisons = []
    with open(filename) as f:
        data = f.readlines()
        for row in data:
            if row[:6] == "lcl|SP":
                # comparisons.append({"ID": row[0], "NAME": row[1], "ORGANISM": row[2], "SCORE": row[3], "TAXID": row[4], "KINGDOM": row[5], "PHYLUM": row[6], "CLASS": row[7], "ORDER": row[8], "FAMILY": row[9], "GENUS": row[10], "SPECIES": row[11]})
                values = [value.strip() for value in row.split(" ")]
                comparisons.append({
                    "ID": str(randint(1, 100)), 
                    "NAME": str(randint(1, 100)), 
                    "ORGANISM": str(randint(1, 100)), 
                    "SCORE": str(randint(1, 100)), 
                    "TAXID": str(randint(1, 100)), 
                    "KINGDOM": str(randint(1, 100)), 
                    "PHYLUM": str(randint(1, 100)), 
                    "CLASS": str(randint(1, 100)), 
                    "ORDER": str(randint(1, 100)), 
                    "FAMILY": str(randint(1, 100)), 
                    "GENUS": str(randint(1, 100)), 
                    "SPECIES": str(randint(1, 100)), 
                    "SCORE": values[-2]
                })
    return comparisons


