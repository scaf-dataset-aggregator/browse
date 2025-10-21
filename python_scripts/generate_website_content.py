#!/usr/bin/env python3
"""
generate_webpages.py

Reads `database_information.csv` and generates:
 - a folder `database_webpages/` with a simple HTML page per row (identified by a zero-padded row index)
 - `database_index.json` used by the client search

Usage:
 It is supposed to be executed by a github action, but you can run it locally too. It just looks for that csv, and creates new files.
 You might ned to install pandas and markdown.

The script is robust to slightly different header punctuation/casing by normalising column names.
"""

import json
import html
import re
from pathlib import Path

from parse_dataset_information import dataset_df_row_to_JSON
from paths import WEBPAGES_FOLDER, INDEX_PATH, TEMPLATE_FILE, get_webpage_path
from read_csv_safely import get_database_information_df

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
    result = template_str
    for key, value in variables_dict.items():
        # Replace all occurrences of {key} with its value converted to string
        placeholder = "{" + key + "}"
        result = result.replace(placeholder, str(value))
    return result

# read template
with open(TEMPLATE_FILE, "r", encoding="utf-8") as file:
    template_string = file.read()


df = get_database_information_df()

for index, row in df.iterrows():
    # first, we process whatever raw text the user entered
    dataset_code = f"{index + 1:05d}"  # 1-based, zero padded
    dataset_variables = dataset_df_row_to_JSON(row, dataset_code)
    page_path = get_webpage_path(dataset_code)

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


    index_entry = {
        'id': dataset_code,
        'allowed_in_database': dataset_variables["allowed?"],
        'name': dataset_variables["dataset_title"],
        'keywords': dataset_variables["keywords"],
        'abstract': dataset_variables["abstract"],
        'shareability': dataset_variables["shareability"],
        'author_name': dataset_variables["author_name"],
        'author_contacts': dataset_variables["author_contacts"],
        'location': dataset_variables["location"],
        'collection_start': dataset_variables["collection_start"],
        'collection_end': dataset_variables["collection_end"],
        'categories_list': dataset_variables["categories_list"],
        'research_fields': dataset_variables["research_fields_list"]


    }
    # Build entry for JSON index
    index_list.append(index_entry)

# Write JSON index
INDEX_PATH.write_text(json.dumps(index_list, ensure_ascii=False, indent=2), encoding='utf-8')

print(f"Generated {len(index_list)} pages in '{WEBPAGES_FOLDER}' and index at '{INDEX_PATH}'")
