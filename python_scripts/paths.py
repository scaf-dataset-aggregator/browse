from pathlib import Path

CSV_PATH = Path('database_information.csv')
WEBPAGES_FOLDER = Path('website_contents', 'database_webpages')
INDEX_PATH = Path('website_metadata', 'database_index.json')
TEMPLATE_FILE = Path("website_contents", "database_webpages", "dataset_webpage_template.html")



def get_webpage_path(dataset_code: str) -> Path:
    page_filename = f"{dataset_code}.html"
    return WEBPAGES_FOLDER / page_filename
