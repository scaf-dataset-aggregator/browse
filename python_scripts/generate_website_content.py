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

from python_scripts.paths import OUT_DIR, INDEX_PATH, TEMPLATE_FILE
from python_scripts.read_dataset_information import get_database_information_df

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
    code = f"{index + 1:05d}"  # 1-based, zero padded
    page_filename = f"{code}.html"
    page_path = OUT_DIR / page_filename

    # extract values
    name = str(row.get('name', '') or 'unknown')
    keywords_raw = str(row.get('keywords', '') or '')
    keywords = [k.strip() for k in re.split(r'[;,|\n]+', keywords_raw) if k.strip()] if keywords_raw else []
    abstract = str(row.get('abstract', '') or row.get('short_summary', '') or 'unknown')
    location = str(row.get('location', '') or 'unknown')
    accessibility = str(row.get('accessibility', '') or row.get('isAccessibleForFree', '') or 'unknown')
    allowed_in_database = str(row.get('allow?', '')) == "Allow"
    description_md = str(row.get('description_md', '') or '')
    download_links = str(row.get('download_links', '') or 'unknown')
    author = str(row.get('author', '') or 'unknown')
    organisation = str(row.get('organisation', '') or '')

    # markdown -> html
    description_html = markdown.markdown(description_md, extensions=['fenced_code', 'tables'])

    # prepare variables dict
    variables = {
        "dataset_title": html.escape(name) or f"Dataset {code}",
        "dataset_code": code,
        "dataset_author_organisation": html.escape(author) + ((' - ' + html.escape(organisation)) if organisation else ''),
        "dataset_keywords": ', '.join(html.escape(k) for k in keywords) if keywords else 'unknown',
        "dataset_location": html.escape(location),
        "dataset_accessibility": html.escape(accessibility),
        "dataset_abstract": html.escape(abstract),
        "dataset_description_html": description_html,
        "dataset_download_links": html.escape(download_links)
    }

    # fill template
    html_content = fill_in_gaps(template_string, variables)

    # write file
    page_path.write_text(html_content, encoding='utf-8')
    print(f"Wrote the page content for dataset {code} ({name}) to {page_path}")


    # Build entry for JSON index
    index_entry = {
        'id': code,
        'allowed_in_database': allowed_in_database,
        'name': name,
        'keywords': keywords,
        'abstract': abstract,
        'location': location,
        'accessibility': accessibility,
        'index': index,
        'link': f"{OUT_DIR.name}/{page_filename}",
    }
    index_list.append(index_entry)

# Write JSON index
INDEX_PATH.write_text(json.dumps(index_list, ensure_ascii=False, indent=2), encoding='utf-8')

print(f"Generated {len(index_list)} pages in '{OUT_DIR}' and index at '{INDEX_PATH}'")
