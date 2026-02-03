#!/usr/bin/env python3
"""
generate_webpages.py

Reads `database_information.csv` and generates:
 - a folder `database_webpages/` with a simple HTML page per row (identified by a zero-padded row index)
 - `database_index.json` used by the client search
 - updates the content of website_metadata/website_generation_metadata.json,
        which just contains the timestamp of the last edit

Usage:
 It is supposed to be executed by a GitHub action, but you can run it locally too.
 It just looks for that csv, and creates new files.
 You might need to install pandas and markdown.

The script is robust to slightly different header punctuation/casing
    by normalising column names.
"""

import json

import datetime

from parse_dataset_information import dataset_df_row_to_JSON
from paths import WEBPAGES_FOLDER, INDEX_PATH, TEMPLATE_FILE, get_webpage_path, GENERATION_METADATA_FILE
from read_csv_safely import get_database_information_df, check_database_allow_column_is_valid

try:
    import pandas as pd
    import markdown
except Exception as e:
    raise SystemExit("pandas and markdown are required. In theory, github actions should do that?")

# Output directory
WEBPAGES_FOLDER.mkdir(parents=True, exist_ok=True)

index_list = []


# safe fill_in_gaps function

def fill_in_gaps(template_str: str, variables_dict: dict) -> str:
    """
    This function takes a string such as "my name is {name}" and will fill in the
    items in the {}s as long as they are in variables_dict.

    This is used to make the webpages
    """
    result = template_str
    for key, value in variables_dict.items():
        # Replace all occurrences of {key} with its value converted to string
        if not isinstance(value, str):
            continue
        placeholder = "{" + key + "}"
        result = result.replace(placeholder, str(value))
    return result


def make_index_entry_from_dataset_variables(dataset_code: str, dataset_variables) -> dict:
    index_entry = {
        'id': dataset_code,
        'allowed_in_database': dataset_variables["allowed?"],
        'name': dataset_variables["dataset_title"],
        'keywords': dataset_variables["keywords"],
        'abstract': dataset_variables["abstract"],
        'publicly_available': dataset_variables["shareability"] == "Publicly shareable",
        'author_name': dataset_variables["author_name"],
        'author_contacts': dataset_variables["author_contacts"],
        'location': dataset_variables["location"],
        'collection_start': dataset_variables["collection_start"],
        'collection_end': dataset_variables["collection_end"],
        'categories_list': dataset_variables["categories_list"],
        'research_fields': dataset_variables["research_fields_list"],
        'data_types': dataset_variables["datatypes_list"],
        'file_extensions': dataset_variables["file_extensions_list"],
        'open_for_collaboration': dataset_variables["open_for_collaboration"]
    }
    return index_entry


# read template
with open(TEMPLATE_FILE, "r", encoding="utf-8") as file:
    template_string = file.read()

# reads the database_information.csv file safely (with checks, and renaming columns)
df = get_database_information_df()

is_dataframe_valid, error_message = check_database_allow_column_is_valid(df)
if not is_dataframe_valid:
    raise Exception(error_message)


# convert each row of the csv into two things:
#   a webpage
#   a little json which will be loaded by the website to search through datasets

for index, row in df.iterrows():
    dataset_code = f"{index + 1:05d}"  # 1-based, zero padded

    # first, we convert the row in a dictionary
    # but also it has many new attributes added, for our convenience
    dataset_variables = dataset_df_row_to_JSON(row, dataset_code)
    page_path = get_webpage_path(dataset_code)

    # if a webpage is not allowed, any old version is deleted
    if not dataset_variables["allowed?"]:
        print(f"Removing dataset {dataset_variables['dataset_title']} because it is not allowed.")

        try:
            if page_path.exists():
                print("WARNING: Found that the page existed in the past, so it will be deleted.")
                page_path.unlink()
                print(f"Deleted old page: {page_path}")
        except Exception as e:
            print(f"WARNING: could not delete {page_path}: {e}")

        continue  # avoid making the page and adding an entry to the index

    # fill template, create webpage
    html_content = fill_in_gaps(template_string, dataset_variables)

    # write file for webpage
    page_path.write_text(html_content, encoding='utf-8')
    print(f"Wrote the page content for dataset {dataset_code} ({dataset_variables['dataset_title']}) to {page_path}")

    # make the index entry
    index_entry = make_index_entry_from_dataset_variables(dataset_code, dataset_variables)

    index_list.append(index_entry)

# Write JSON index
INDEX_PATH.write_text(json.dumps(index_list, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"Generated {len(index_list)} pages in '{WEBPAGES_FOLDER}' and index at '{INDEX_PATH}'")

# Write the current timestamp on the website_generation_metadata.json
current_time_as_string = str(datetime.datetime.now())
metadata_json = dict()
metadata_json["last_updated"] = current_time_as_string
with open(GENERATION_METADATA_FILE, "w") as file:
    json.dump(obj=metadata_json, fp=file)
