import os
import components.log as log


PROJECT_DIR = os.path.dirname(os.path.dirname(__file__))
PROCESSED_FILE = os.path.join(PROJECT_DIR, "tmp/processed.txt")
INPUT_FILE = os.path.join(PROJECT_DIR, "tmp/input.txt")
MAIN_FOLDER = os.path.join(PROJECT_DIR, "src/static/tmp/")


def remove_files(folder, processed_file):

    with open(processed_file, 'r') as existing_files:
        count_removed = 0
        with open(INPUT_FILE, 'w') as input_file:
            for line in existing_files:
                info_existing = line.split(":")
                existing_filename = info_existing[2].replace('"',"").replace("{","").replace("}","").strip(" \t\n\r")
                input_file.write("{},\n".format(existing_filename))
                existing_filename += ".out.txt"
                existing_path = os.path.join(folder, existing_filename)
                if os.path.isfile(existing_path):
                    count_removed += 1
                    os.remove(existing_path)

        log.datetime_log("Removed {} files out of {} saved models".format(
                existing_filename, len(existing_files.readlines())))

if __name__ == "__main__":
    remove_files(MAIN_FOLDER, PROCESSED_FILE)    