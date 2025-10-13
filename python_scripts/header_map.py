
# Mapping from original headers to normalized keys we use internally.
# If your CSV headers differ slightly, the script will normalise column names before mapping.

HEADER_MAP = {

    'Timestamp' : 'submission_timestamp', # not used in parsing
    'Allow this dataset?' : 'allow', # essential
    'Consent to share' : 'consent_to_share', # not used
    'Permission of removal' : 'permission_of_removal',  # not used
    'Do you know whether your data contains any personal or sensitive information?' : 'contains_sensitive', # not used
    'Is the data in digital format?' : 'is_digital',
    'Share-ability' : 'shareability', # straight
    'Is the data already publicly available on the internet?' : 'publicly_available',
    'Please provide the links to the data' : 'dataset_links_from_questionnaire',
    'Are you aware of the protocols you might need to follow as part of data transfers?' : 'protocol_awareness', # not used
    'What should the dataset title be?' : 'dataset_title', # added
    'What are the keywords for the dataset?' : 'dataset_keywords_from_questionnaire', # added
    'What category does the dataset fit best into?' : 'dataset_categories_from_questionnaire', # added
    'What research field does the data fall into?' : 'research_fields', # added
    'Who are the main contact details for this dataset?' : 'contact_details', # added
    'What kind of data is present in the dataset?' : 'dataset_datatypes', # added
    'Abstract' : 'abstract', # added
    'In what country was the data collected?' : 'dataset_country', # added as location
    'Start of data collection' : 'data_collection_start', # added
    'End of data collection' : 'data_collection_end', # added
    'At what lifecycle stage is the data?' : 'dataset_lifecycle_stage',  # lifecycle
    'Long description' : 'long_description_from_questionnaire',  # added
    'Does this data have a copyright?' : 'copyright',
    'Are there any usage instructions?' : 'usage_instructions',
    'Do you need to acknowledge anything?' : 'acknowledgements'

}



# OUTDATED_HEADER_MAP = {
#     'Id': 'id',
#     'Start time': 'start_time',
#     'Completion time': 'completion_time',
#     'Email': 'email',
#     'Allow?': "allow?",
#     'Name': 'dataset_title',
#     'Keywords': 'keywords',
#     'What is the main topic?': 'main_topic',
#     'Short summary (one line)': 'short_summary',
#     'Abstract': 'abstract',
#     'Long form description, the datacard': 'description_md',
#     'Download links': 'links',
#     'Version': 'version',
#     'Word Count ': 'word_count',
#     'Is this dataset part of a bigger collection? If yes, write it here': 'part_of_collection',
#     'ISSN': 'issn',
#     'Was this work used elsewhere (conference, paper etc..)': 'used_elsewhere',
#     'Intended audience ': 'intended_audience',
#     'Author': 'authors',
#     'Contact Details': 'contact details',
#     'Organisation that generated this data': 'organisation',
#     'Text describing credit information': 'credit_info',
#     'Citation(s) to the original publications and webpages': 'citations',
#     'Contributor': 'contributor',
#     'Editor ': 'editor',
#     'Source of funding': 'funding_source',
#     'Language': 'language',
#     'Maintainer': 'maintainer',
#     'Publication': 'publication',
#     'Publisher': 'publisher',
#     'Sponsor ': 'sponsor',
#     'Does this work go by an alternate name?': 'alternate_name',
#     'Disambiguating description': 'disambiguating_description',
#     'What is measured in the dataset? And how?': 'measured',
#     'Where was the data recorded?': 'location',
#     'When was the data recorded?': 'recorded_when',
#     'Was the data shown at a particular event? Eg the conference': 'shown_at_event',
#     'Lifecycle Status (eg draft, incomplete, published)': 'lifecycle_status',
#     'What was the original format of the data? Microfiche, paper etc..': 'original_format',
#     'What is the file format?': 'file_format',
#     'accountablePerson ': 'accountable_person',
#     'acquireLicencePage ': 'acquireLicencePage',
#     'conditionsOfAccess ': 'conditionsOfAccess',
#     'copyrightHolder ': 'copyrightHolder',
#     'copyrightNotice ': 'copyrightNotice',
#     'copyrightYear': 'copyrightYear',
#     'isAccessibleForFree': 'isAccessibleForFree',
#     'isBasedOn ': 'isBasedOn',
#     'isFamilyFriendly ': 'isFamilyFriendly',
#     'licence ': 'licence',
#     'producer ': 'producer',
#     'provider ': 'provider',
#     'usageInfo ': 'usageInfo',
#     'Genre ': 'genre',
#     'Accessibility ': 'accessibility',
#     'expires ': 'expires',
# }
#
#
