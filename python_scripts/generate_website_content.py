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

from python_scripts.parse_dataset_information import dataset_df_row_to_JSON
from python_scripts.paths import OUT_DIR, INDEX_PATH, TEMPLATE_FILE
from python_scripts.read_csv_safely import get_database_information_df

try:
    import pandas as pd
    import markdown
except Exception as e:
    raise SystemExit("pandas and markdown are required. In theory, github actions should do that?")

# Output directory
OUT_DIR.mkdir(parents=True, exist_ok=True)

index_list = []
# safe fill_in_gaps function

def fill_in_gaps(template_string, variables_dict):
    class DefaultDict(dict):
        def __missing__(self, key):
            return "unknown"
    safe_dict = DefaultDict(variables_dict)
    return template_string.format_map(safe_dict)

# read template
with open(TEMPLATE_FILE, "r", encoding="utf-8") as file:
    template_string = file.read()


df = get_database_information_df()

for index, row in df.iterrows():
    # first, we process whatever raw text the user entered
    dataset_code = f"{index + 1:05d}"  # 1-based, zero padded
    page_filename = f"{dataset_code}.html"
    page_path = OUT_DIR / page_filename
    dataset_variables = dataset_df_row_to_JSON(row, dataset_code, page_path)

    if not dataset_variables["allowed?"]:
        print(f"Skipping dataset {dataset_variables['dataset_title']} because it is not allowed.")
        continue  # avoid making the page and adding an entry to the index
        # todo: remove the page if it exists already.

    # fill template
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
        'location': dataset_variables["location"],

        'link': dataset_variables["dataset_webpage_path"]
    }
    # Build entry for JSON index
    index_list.append(index_entry)

# Write JSON index
INDEX_PATH.write_text(json.dumps(index_list, ensure_ascii=False, indent=2), encoding='utf-8')

print(f"Generated {len(index_list)} pages in '{OUT_DIR}' and index at '{INDEX_PATH}'")
