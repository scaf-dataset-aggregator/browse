#!/usr/bin/env python3
"""
generate_webpages.py

Reads `database_information.csv` and generates:
 - a folder `database_webpages/` with a simple HTML page per row (identified by a zero-padded row index)
 - `database_index.json` used by the client search

Usage:
 pip install pandas markdown
 python generate_webpages.py

The script is robust to slightly different header punctuation/casing by normalising column names.
"""

import os
import re
import json
from pathlib import Path

try:
    import pandas as pd
except Exception as e:
    raise SystemExit("pandas is required. Install with: pip install pandas")

# Markdown conversion for descriptions (optional)
try:
    import markdown
    MD_AVAILABLE = True
except Exception:
    MD_AVAILABLE = False

CSV_PATH = Path('database_information.csv')
OUT_DIR = Path('website_contents', 'database_webpages')
INDEX_PATH = Path('website_metadata', 'database_index.json')

# Mapping from original headers (as provided) to normalized keys we use internally.
# If your CSV headers differ slightly, the script will normalise column names before mapping.
HEADER_MAP = {
    'Id': 'id',
    'Start time': 'start_time',
    'Completion time': 'completion_time',
    'Email': 'email',
    'Allow?': "allow?",
    'Name': 'name',
    'Keywords': 'keywords',
    'What is the main topic?': 'main_topic',
    'Short summary (one line)': 'short_summary',
    'Abstract': 'abstract',
    'Long form description, the datacard': 'description_md',
    'Download links': 'download_links',
    'Version': 'version',
    'Word Count ': 'word_count',
    'Is this dataset part of a bigger collection? If yes, write it here': 'part_of_collection',
    'ISSN': 'issn',
    'Was this work used elsewhere (conference, paper etc..)': 'used_elsewhere',
    'Intended audience ': 'intended_audience',
    'Author': 'author',
    'Organisation that generated this data': 'organisation',
    'Text describing credit information': 'credit_info',
    'Citation(s) to the original publications and webpages': 'citations',
    'Contributor': 'contributor',
    'Editor ': 'editor',
    'Source of funding': 'funding_source',
    'Language': 'language',
    'Maintainer': 'maintainer',
    'Publication': 'publication',
    'Publisher': 'publisher',
    'Sponsor ': 'sponsor',
    'Does this work go by an alternate name?': 'alternate_name',
    'Disambiguating description': 'disambiguating_description',
    'What is measured in the dataset? And how?': 'measured',
    'Where was the data recorded?': 'location',
    'When was the data recorded?': 'recorded_when',
    'Was the data shown at a particular event? Eg the conference': 'shown_at_event',
    'Lifecycle Status (eg draft, incomplete, published)': 'lifecycle_status',
    'What was the original format of the data? Microfiche, paper etc..': 'original_format',
    'What is the file format?': 'file_format',
    'accountablePerson ': 'accountable_person',
    'acquireLicencePage ': 'acquireLicencePage',
    'conditionsOfAccess ': 'conditionsOfAccess',
    'copyrightHolder ': 'copyrightHolder',
    'copyrightNotice ': 'copyrightNotice',
    'copyrightYear': 'copyrightYear',
    'isAccessibleForFree': 'isAccessibleForFree',
    'isBasedOn ': 'isBasedOn',
    'isFamilyFriendly ': 'isFamilyFriendly',
    'licence ': 'licence',
    'producer ': 'producer',
    'provider ': 'provider',
    'usageInfo ': 'usageInfo',
    'Genre ': 'genre',
    'Accessibility ': 'accessibility',
    'expires ': 'expires',
}

# Normalise helper: strip punctuation and spaces, lowercase
def normalise(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower()) if isinstance(s, str) else s

# Build normalised header lookup
NORMALISED_LOOKUP = {normalise(k): v for k, v in HEADER_MAP.items()}

# Make sure CSV exists
if not CSV_PATH.exists():
    raise SystemExit(f"CSV not found at {CSV_PATH.resolve()} - place database_information.csv in top-level directory!")


def read_csv_safely(csv_path):
    try:
        df = pd.read_csv(csv_path, sep=',', encoding='utf-8-sig', dtype=str)
    except Exception:
        df = pd.read_csv(csv_path, encoding='utf-8', dtype=str)

    # remove the BOM character
    df.columns = df.columns.str.strip().str.replace("\ufeff", "")

    # The dataframe is likely to contain many empty rows. Remove those where the id is not a number
    # note that we use capitalised Id because we've not converted the column names yet
    df = df[~df["Id"].isna()]

    # Ensure string values and fill NaN with empty strings
    df = df.astype(object).where(pd.notnull(df), '')

    return df

df = read_csv_safely(CSV_PATH)

# The dataframe is likely to contain many empty rows. Remove those where the id is not a number
# note that we use capitalised Id because we've not converted the column names yet
df = df[~df["Id"].isna()]

# Ensure string values and fill NaN with empty strings
df = df.astype(object).where(pd.notnull(df), '')

# Normalise column names and rename according to our map where possible
new_cols = {}
for col in df.columns:
    key = normalise(col)
    if key in NORMALISED_LOOKUP:
        new_cols[col] = NORMALISED_LOOKUP[key]
    else:
        # fallback: use a cleaned version of the original column as a key
        new_cols[col] = re.sub(r"[^0-9a-z_]", "_", col.strip().lower())

df = df.rename(columns=new_cols)

# Output directory
OUT_DIR.mkdir(parents=True, exist_ok=True)

index_list = []

import html
import re
from pathlib import Path

# Optionally: import markdown if you have it
try:
    import markdown
    MD_AVAILABLE = True
except ImportError:
    MD_AVAILABLE = False

TEMPLATE_FILE = Path("website_contents", "database_webpages", "dataset_webpage_template.html")
OUT_DIR = Path("website_contents", "database_webpages")

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
    if MD_AVAILABLE and description_md.strip():
        description_html = markdown.markdown(description_md, extensions=['fenced_code', 'tables'])
    else:
        esc = html.escape(description_md)
        newline = "\n"
        paragraphs = ''.join(f"<p>{p.replace(newline, '<br/>')}</p>" for p in esc.split('\n\n') if p.strip())
        description_html = paragraphs or '<p>unknown</p>'

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
