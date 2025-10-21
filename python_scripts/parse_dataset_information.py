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

def dataset_df_row_to_JSON(row, dataset_code) -> dict:

    row_dict = row.to_dict()
    result_json = row_dict.copy()
    result_json["dataset_code"] = str(dataset_code)
    result_json["dataset_title"] = html.escape(str(row_dict.get("dataset_title", f"Dataset {dataset_code}")))

    keywords_raw = html.escape(str(row_dict.get('dataset_keywords_from_questionnaire', '') or ''))
    keywords = [html.escape(str(k.strip())).lower() for k in re.split(r'[;,|\n]+', keywords_raw) if k.strip()] if keywords_raw else []
    result_json["keywords_html"] = ", ".join(keywords)   # needs to be separate because we want them separate in the JSON index
    result_json["keywords"] = keywords

    result_json["abstract"] = html.escape(str(row_dict.get("abstract", "Missing abstract")))
    result_json["allowed?"] = bool(row_dict.get("allow", "Missing").lower() in {"yes", "y", "allow", "allowed"})


    raw_links = row_dict.get("dataset_links_from_questionnaire").split("\n")
    html_links = [f'<a href="{link}">{link}</a>' for link in raw_links]
    result_json["links"] = make_html_bullet_list(html_links)


    description_md = str(row_dict.get('long_description_from_questionnaire', '') or '')
    description_html = markdown.markdown(description_md, extensions=['fenced_code', 'tables'])
    result_json["description"] = description_html

    result_json["location"] = html.escape(str(row_dict.get("dataset_country", "No location")))

    result_json["collection_start"] = row_dict.get('data_collection_start') # TODO validate in some way?
    result_json["collection_end"] = row_dict.get('data_collection_end') # TODO validate in some way ?

    result_json["shareability"] = row_dict.get("shareability")


    categories_list_dirty = list(row_dict.get("dataset_categories_from_questionnaire", "").split(", "))
    categories_list_cleaned = [CATEGORY_MAP[category_name].lower() for category_name in categories_list_dirty]
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