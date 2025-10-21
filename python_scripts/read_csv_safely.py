import re

import pandas as pd

from paths import CSV_PATH


# this file is to read the csv and make it bomb proof. The only thing you should import is get_database_information_df

def read_csv_safely(csv_path):
    def read_dataset_with_encoding(encoding):
        second_row = pd.read_csv(csv_path, nrows=2, sep=",", encoding=encoding, dtype=str).iloc[0]

        # Now read the full CSV, using the extracted values as column names
        df = pd.read_csv(csv_path, header=None, skiprows=2, encoding=encoding, dtype=str)
        df.columns = second_row
        return df

    try:
        df = read_dataset_with_encoding(encoding="utf-8-sig")  # excel-generated csv
    except Exception:
        df = read_dataset_with_encoding(encoding="utf-8")

    # remove the BOM character, just in case
    df.columns = df.columns.str.strip().str.replace("\ufeff", "")

    # The dataframe is likely to contain many empty rows. Remove those where the id is not a number
    # note that at this stage the column names have not been replaced yet.
    df = df[~df[df.columns[0]].isna()]

    # Ensure string values and fill NaN with empty strings
    df = df.astype(object).where(pd.notnull(df), '')

    return df


def remove_punctuation_and_make_lowercase(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower()) if isinstance(s, str) else s


def get_database_information_df():
    # Make sure CSV exists
    if not CSV_PATH.exists():
        raise SystemExit(
            f"CSV not found at {CSV_PATH.resolve()} - place database_information.csv in top-level directory!")

    df = read_csv_safely(CSV_PATH)

    return df








