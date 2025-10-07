import re

import pandas as pd

from header_map import HEADER_MAP
from paths import CSV_PATH


# this file is to read the csv and make it bomb proof. The only thing you should import is get_database_information_df

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


def remove_punctuation_and_make_lowercase(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower()) if isinstance(s, str) else s


def get_database_information_df():
    # returns the df, where the column names are those found in the values in HEADER_MAP


    # Make sure CSV exists
    if not CSV_PATH.exists():
        raise SystemExit(
            f"CSV not found at {CSV_PATH.resolve()} - place database_information.csv in top-level directory!")

    # Build normalised header lookup
    NORMALISED_HEADER_LOOKUP = {remove_punctuation_and_make_lowercase(k): v for k, v in HEADER_MAP.items()}

    df = read_csv_safely(CSV_PATH)

    # replace column names
    new_cols = {}
    for col in df.columns:
        key = remove_punctuation_and_make_lowercase(col)
        if key in NORMALISED_HEADER_LOOKUP:
            new_cols[col] = NORMALISED_HEADER_LOOKUP[key]
        else:
            print(
                f"In reading the document, the column {col} was not recognised. That's not an error, just letting you know!")

    df = df.rename(columns=new_cols)

    return df








