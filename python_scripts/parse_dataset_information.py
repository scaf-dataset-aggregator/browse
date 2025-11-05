import html
import re

import markdown

from category_map import CATEGORY_MAP


# this file will make a little JSON for every row of the cleaned df.
# the JSON is used for
 # making an entry in the index
 # preparing the information to make the webpages

def is_empty_text(s: str) -> bool:
    """Return True if the string is empty or contains only whitespace."""
    return not s or s.strip() == ""



def make_html_bullet_list(items: list[str]) -> str:
    """
    Given a list of strings, returns a string with an HTML unordered list.
    Each item is wrapped in <li> tags.
    """



    if not items:
        return ""
    list_items = "\n".join(f"  <li>{item}</li>" for item in items if not is_empty_text(item))
    return f"<ul>\n{list_items}\n</ul>"



# precompiled regex to remove dangerous tags and their contents (case-insensitive)
_DANGEROUS_TAGS_RE=re.compile(r"(?is)</?(script|iframe|object|embed|style|form|svg)[^>]*>")

def remove_dangerous_tags(original_str: str) -> str:
    # takes a string that will be pasted into the HTML, and removes tags that are dangerous
    # the markdown should produce h3, table, thead, tr, th, tf, tbody, em, strong, a, img, old, li

    return _DANGEROUS_TAGS_RE.sub("", original_str)


#
# datatypes = ["Numeric", "Textual", "Images", "Spatial", "Audio", "Video", "Archive", "Markup"]
# def get_clean_datatypes_of_dataset(input_string):
#     return [datatype for datatype in datatypes if datatype in (input_string.lower())]


_non_alpha_trim = re.compile(r'^[^A-Za-z]+|[^A-Za-z]+$')
def get_cleaned_categories(input_string):
    terms = input_string.split(',')
    cleaned = [_non_alpha_trim.sub('', term.strip()) for term in terms]
    return [t for t in cleaned if t]

import re
from datetime import datetime




# Matches dd/mm/yyyy where dd=01–31, mm=01–12, yyyy=0000–9999
date_regex = re.compile(r"^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/\d{4}$")

def date_to_iso(date_str):
    try:
        # Validate format first
        if not date_regex.match(date_str):
            return ""
        # Convert to yyyy-mm-dd
        return datetime.strptime(date_str, "%d/%m/%Y").strftime("%Y-%m-%d")
    except ValueError:
        # Covers invalid calendar dates like 31/02/2024
        return ""


def convert_dates_to_schema_time_range(iso_start: str, iso_end: str) -> str:
    # Build the result string
    result_str = (iso_start if iso_start else "..") + "/" + (iso_end if iso_end else "..")
    return result_str

# Regex to match URLs, with optional protocol
url_pattern = re.compile(
    r'(?:(?:https?://)?(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?:/[^\s]*)?'
)

def convert_str_in_HTML_with_clickable_links(input: str):
    """
    Convert all URLs in a string into HTML <a> links.
    Accepts links with or without http(s)://.
    """

    def replace_link(match):
        url = match.group(0)
        href = url if url.startswith(('http://', 'https://')) else 'https://' + url
        return f'<a href="{href}" target="_blank">{url}</a>'

    return url_pattern.sub(replace_link, input)

def dataset_df_row_to_JSON(row, dataset_code) -> dict:

    row_dict = row.to_dict()
    result_json = row_dict.copy()
    result_json["dataset_code"] = str(dataset_code)
    result_json["dataset_title"] = html.escape(str(row_dict.get("dataset_title", f"Dataset {dataset_code}")))

    keywords_raw = html.escape(str(row_dict.get('dataset_keywords_from_questionnaire', '') or ''))
    keywords = [html.escape(str(k.strip())).lower() for k in re.split(r'[;,|\n]+', keywords_raw) if k.strip()] if keywords_raw else []
    result_json["keywords_html"] = ", ".join(keywords)   # needs to be separate because we want them separate in the JSON index
    result_json["keywords"] = keywords
    result_json["keywords_schema"] = "["+",\n".join(f'"{keyword}"' for keyword in keywords)+"]"

    result_json["abstract"] = html.escape(str(row_dict.get("abstract", "Missing abstract")))
    result_json["allowed?"] = bool(row_dict.get("allow", "Missing").lower() in {"yes", "y", "allow", "allowed"})


    raw_links = row_dict.get("dataset_links_from_questionnaire").split("\n")
    html_links = [f'<a href="{link}">{link}</a>' for link in raw_links]
    result_json["links"] = make_html_bullet_list(html_links)

    result_json["first_link"] = raw_links[0] if len(raw_links) > 0 else "error"


    description_md = str(row_dict.get('long_description_from_questionnaire', '') or '')
    description_html = markdown.markdown(description_md, extensions=['fenced_code', 'tables'])
    result_json["description"] = description_html

    result_json["data_collection_methodology"] = convert_str_in_HTML_with_clickable_links(row_dict.get("data_collection_methodology"))

    result_json["location"] = html.escape(str(row_dict.get("dataset_country", "No location")))

    result_json["collection_start"] = date_to_iso(row_dict.get('data_collection_start'))
    result_json["collection_end"] = date_to_iso(row_dict.get('data_collection_end'))
    result_json["temporal_coverage_for_schema"] = convert_dates_to_schema_time_range(result_json["collection_start"], result_json["collection_end"])

    def format_date_for_human(date_str: str):
        # the non_iso_date
        if len(date_str) < 1:
            return "Unknown"
        else:
            return date_str




    result_json["collection_start_html"] = format_date_for_human(row_dict.get("data_collection_start"))
    result_json["collection_end_html"] = format_date_for_human(row_dict.get("data_collection_end"))

    result_json["shareability"] = row_dict.get("shareability")
    result_json["is_accessible_for_free"] = "true" if ("publicly shareable" == result_json["shareability"].lower()) else "false"


    categories_list_dirty = list(row_dict.get("dataset_categories_from_questionnaire", "").split(", "))
    categories_list_cleaned = [CATEGORY_MAP[category_name] for category_name in categories_list_dirty]
    categories_html = ", ".join(categories_list_cleaned)
    result_json["categories_list"] = categories_list_cleaned
    result_json["categories_html"] = categories_html

    research_fields_list = list(row_dict.get("research_fields", "").split(", "))
    research_fields_html = ", ".join(research_fields_list)

    result_json["research_fields_list"] = research_fields_list
    result_json["research_fields_html"] = research_fields_html

    result_json["author_name"] = row_dict.get('author_name', "Unknown Author")
    result_json["author_contacts"] = row_dict.get('author_contacts', "Missing author contacts")
    result_json["other_contributors"] = row_dict.get('other_contributors', "")


    dataset_categories_cleaned = row_dict.get("dataset_datatypes").split(", ")
    result_json["datatypes_list"] = dataset_categories_cleaned
    result_json["datatypes_html"] = ", ".join(dataset_categories_cleaned) # i know i know

    result_json["file_extensions"] = row_dict.get("file_extensions", "unknown")
    result_json["file_extensions_list"] = result_json["file_extensions"].split(", ")

    result_json["dataset_lifecycle_stage"] = row_dict.get("dataset_lifecycle_stage")




    result_json["copyright"] = row_dict.get("copyright")
    result_json["usage_instructions"] = row_dict.get("usage_instructions")
    result_json["acknowledgements"] = row_dict.get("acknowledgements")










    # remove dangerous tags anywhere
    for key in result_json:
        old_content = result_json[key]
        if isinstance(old_content, str):
            new_content = remove_dangerous_tags(old_content)
            result_json[key] = new_content

            if old_content != new_content:
                print("WARNING: the page contained dangerous HTML!!!")

    return result_json