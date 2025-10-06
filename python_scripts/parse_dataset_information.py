from pathlib import Path

from python_scripts.paths import WEBPAGES_FOLDER
import markdown
import re
import html


# this file will make a little JSON for every row of the cleaned df.
# the JSON is used for
 # making an entry in the index
 # preparing the information to make the webpages



def dataset_df_row_to_JSON(row, dataset_code) -> dict:

    result_json = dict()
    result_json["dataset_code"] = str(dataset_code)
    result_json["dataset_title"] = html.escape(str(row.get("dataset_title", f"Dataset {dataset_code}")))

    keywords_raw = html.escape(str(row.get('keywords', '') or ''))
    keywords = [html.escape(str(k.strip())) for k in re.split(r'[;,|\n]+', keywords_raw) if k.strip()] if keywords_raw else []
    result_json["keywords"] = keywords

    result_json["abstract"] = html.escape(str(row.get("abstract", "Missing abstract")))
    result_json["allowed?"] = bool(row.get("allow?", "Missing").lower() in {"yes", "y", "allow", "allowed"})

    result_json["authors"] = [html.escape(str(author)) for author in row.get("authors", "Missing authors").split("\n")]
    result_json["organisation"] = html.escape(str(row.get("organisation", "Not provided")))
    result_json["links"] = [str(link) for link in row.get("links").split("\n")]


    description_md = str(row.get('description_md', '') or '')
    description_html = markdown.markdown(description_md, extensions=['fenced_code', 'tables'])
    result_json["description"] = description_html  # TODO: do I need to escape this?

    result_json["location"] = html.escape(str(row.get("location", "No location")))


    return result_json