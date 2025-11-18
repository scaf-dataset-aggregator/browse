// --- FLAGS ---
const RENDER_MARKDOWN_CLIENT = false; // toggle true if using marked.js for markdown rendering
// -------------

let indexData = [];
let flexIndex = null;

async function loadIndex() {
  if (indexData.length) return indexData;
  const res = await fetch('../../website_metadata/database_index.json');
  indexData = await res.json();
  // Keep only entries where allowed_in_database is true
  indexData = indexData.filter(item => item.allowed_in_database);
  return indexData;
}


// --- Top-Level Helper Functions ---

let LOG_DEBUG = true;

const dbg = (msg) => {if (LOG_DEBUG) {console.log(msg);}}

/**
 * Normalizes a string: ensures it's a string, lowercased, and trimmed.
 */
const normalizeString = (str) => (str || '').trim().toLowerCase();

/**
 * Normalizes an array: ensures it's an array and all values are lowercased strings.
 */
const normalizeArray = (arr) => (arr || []).map(val => String(val).toLowerCase());

/**
 * Checks if a filter array has valid, non-empty values.
 * Replaces the old `thereAreFilterValues` helper.
 */
const isValidFilter = (filterValues) => {
  if (!Array.isArray(filterValues) || filterValues.length === 0) {
    return false;
  }
  // Check for cases like [""] or ["   "]
  if (filterValues.length === 1 && filterValues[0].trim() === "") {
    return false;
  }
  return true;
};

/**
 * Checks if at least one value from filterArr exists in itemArr.
 * Assumes both arrays are already normalized (lowercase).
 */
const arrayIntersects = (itemArr, filterArr) => {
  return filterArr.some(f => itemArr.includes(f));
};

/**
 * Safely parses a date string.
 */
const parseDate = (str) => {
  if (!str) return null;
  const date = new Date(str);
  return isNaN(date) ? null : date;
};




/**
 * 1. Applies all filters to the dataset iteratively,
 * progressively reducing the result set.
 */
function filterData(data, filters) {
  // Start with a copy of the full dataset
  let filteredResults = [...data];

  dbg("The filtered results are: ");
  dbg(JSON.stringify(filters));

  const dbg_lenFilteredResults = (stage) => {dbg("At filtering stage "+stage+" there are "+filteredResults.length+" items");}
  dbg_lenFilteredResults("before_filtering");

  // --- 1. Filter: Shareability ---
  const fPublic = filters.publiclyAvailable;
  if (fPublic !== "") {
    filteredResults = filteredResults.filter(item =>
      item.publicly_available === fPublic
    );
  }

  dbg_lenFilteredResults("after_public");

  const fMandatoryKeywords = (filters.mandatoryKeywords || '')
    .split(', ')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  if (isValidFilter(fMandatoryKeywords)) {
    filteredResults = filteredResults.filter(item => {
      const ikeywords = normalizeArray(item.keywords);
      return fMandatoryKeywords.every(item => ikeywords.includes(item));
    });
  }

  dbg_lenFilteredResults("after_keywords");


  // --- 2. Filter: Kinds of data ---
  const fDataTypes = normalizeArray(filters.dataType);
  if (isValidFilter(fDataTypes)) {
    filteredResults = filteredResults.filter(item => {
      const iDataTypes = normalizeArray(item.data_types);
      return arrayIntersects(iDataTypes, fDataTypes);
    });
  }

  dbg_lenFilteredResults("after_data_types");

  // --- 3. Filter: Category ---
  const fCategory = normalizeArray(filters.category);
  if (isValidFilter(fCategory)) {
    filteredResults = filteredResults.filter(item => {
      const iCategories = normalizeArray(item.categories_list);
      return arrayIntersects(iCategories, fCategory);
    });
  }

  dbg_lenFilteredResults("after_category");

  // --- 4. Filter: Research field ---
  const fResearchField = normalizeArray(filters.researchField);
  if (isValidFilter(fResearchField)) {
    filteredResults = filteredResults.filter(item => {
      const iResearchFields = normalizeArray(item.research_fields);
      return arrayIntersects(iResearchFields, fResearchField);
    });
  }

  dbg_lenFilteredResults("after_research_field");

  // --- 5. Filter: Location ---
  const fLocation = normalizeArray(filters.location);
  if (isValidFilter(fLocation)) {
    filteredResults = filteredResults.filter(item => {
      // Note: item.location is a string, not an array
      const iLocation = normalizeArray(item.location);
      return arrayIntersects(iLocation, fLocation);
    });
  }

  dbg_lenFilteredResults("after_location");

  // --- 6. Filter: File Extensions ---
  const fFileExtensions = (filters.fileExtensions || '')
    .split(', ')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  if (isValidFilter(fFileExtensions)) {
    filteredResults = filteredResults.filter(item => {
      const iFileExtensions = normalizeArray(item.file_extensions);
      return arrayIntersects(iFileExtensions, fFileExtensions);
    });
  }

  dbg_lenFilteredResults("after_fileExtensions");

  // --- 7. Filter: Collection start ---
  // We only filter if a valid filter object exists and its type is not "ignore"
  if (filters.collectionStart && filters.collectionStart.type !== "ignore") {
    filteredResults = filteredResults.filter(item =>
      checkDate(item.collection_start, filters.collectionStart)
    );
  }

  dbg_lenFilteredResults("after_collection_start");

  // --- 8. Filter: Collection end ---
  if (filters.collectionEnd && filters.collectionEnd.type !== "ignore") {
    filteredResults = filteredResults.filter(item =>
      checkDate(item.collection_end, filters.collectionEnd)
    );
  }

  dbg_lenFilteredResults("after_collection_end");

  // Return the final, cumulatively filtered array
  return filteredResults;
}

/**
 * Checks if an item's date passes a date filter (e.g., "after" or "before").
 */
const checkDate = (itemDateStr, filterObj) => {
  if (!filterObj || filterObj.type === "ignore") return true;

  const itemDate = parseDate(itemDateStr);
  // If item has no valid date, it can't be filtered out
  if (!itemDate) return true;

  const filterDate = parseDate(filterObj.date);
  // If filter has no valid date, it can't filter
  if (!filterDate) return true;

  if (filterObj.type === "after") return itemDate >= filterDate;
  if (filterObj.type === "before") return itemDate <= filterDate;

  return true;
};

// --- Core Logic Functions ---

/**
 * Cleans and tokenizes the user's search query.
 */
function preprocessQuery(q) {
  const cleanedQuery = normalizeString(q).slice(0, 100);
  return cleanedQuery.split(/\s+/).filter(Boolean).slice(0, 32);
}

/**
 * 2. Scores the remaining items based on the search tokens.
 */
function scoreResults(filteredData, tokens) {
  if (tokens.length === 0) {
    // If no search query, assign a default score to all filtered items
    return filteredData.map(item => ({ item, score: 2 }));
  }

  return filteredData.map(item => {
    let score = 0;

    // --- Normalize item fields needed for scoring ---
    const name = normalizeString(item.name);
    const keywords = normalizeArray(item.keywords);
    const abstract = normalizeString(item.abstract);
    const location = normalizeArray(item.location);
    const author = normalizeString(item.author_name);
    const categories = normalizeArray(item.categories_list);

    // Apply search tokens scoring
    tokens.forEach(t => {
      if (name.includes(t)) score += 7;
      if (keywords.some(k => k.includes(t))) score += 5;
      if (abstract.includes(t)) score += 2;
      if (location.some(c => c.includes(t))) score += 3;
      if (author.includes(t)) score += 5;
      if (categories.some(c => c.includes(t))) score += 1;
    });

    return { item, score };
  });
}

/**
 * 3. Filters by minimum score, sorts, and returns final items.
 */
function sortAndFinalize(scoredData) {
  return scoredData
    .filter(x => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .map(x => x.item);
}

// --- Main Orchestrator Function ---

/**
 * Performs a search by filtering data first, then scoring the results.
 * @param {string} q The search query.
 * @param {object} filters An object of filters to apply.
 */
async function doSearch(q, filters = {}) {
  // 0. Load data
  // Note: loadIndex() is assumed to be defined elsewhere.
  const data = await loadIndex();

  // 1. Prepare search query
  const tokens = preprocessQuery(q);

  // 2. Apply all filters to get a reduced dataset
  const filteredData = filterData(data, filters);

  // 3. Score only the items that passed the filters
  const scoredData = scoreResults(filteredData, tokens);

  // 4. Apply score threshold, sort, and map to final results
  const finalResults = sortAndFinalize(scoredData);

  return finalResults;
}


function snippet(text, q, maxLen=250) {
  if (!text) return '';
  if (!q) return text.slice(0, maxLen) + (text.length>maxLen? '...':'');
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text.slice(0, maxLen) + (text.length>maxLen? '...':'');
  const start = Math.max(0, idx - 60);
  const s = text.slice(start, start + maxLen);
  return (start>0? '...':'') + s + (start + maxLen < text.length? '...':'');
}

function renderResults(items, container) {
  container.replaceChildren();
  if (!items || items.length === 0) {
    container.innerHTML = '<p>No results found.</p>';
    return;
  }

  items.forEach(item => {
    const card = document.createElement('article');
    card.className = 'search-card';

    const title = document.createElement('h2');
    const a = document.createElement('a')
    a.href = `../database_webpages/${item.id}.html`;
    a.innerHTML = item.name || `Dataset ${item.id}`;
    title.appendChild(a);

    // Create availability badge
    const badge = document.createElement('span');
    badge.className = 'inline_catbadge';
    if (item.publicly_available === true) {
      badge.textContent = "Publicly available";
      badge.dataset.badgeType = "public";
    } else {
      badge.textContent = "On request";
      badge.dataset.badgeType = "request";
    }

    // Insert badge after the title link
    title.appendChild(document.createTextNode(" "));
    title.appendChild(badge);

    const meta = document.createElement('p');
    meta.className = 'meta';
    if (item.keywords && item.keywords.length) {
      meta.innerHTML = 'Keywords: ' + item.keywords.join(', ');
    }

    const abs = document.createElement('div');
    abs.className = 'snippet';
    const rawSnippet = snippet(item.abstract || '', document.getElementById('query')?.value || '');
    if (RENDER_MARKDOWN_CLIENT && typeof marked !== 'undefined') {
      abs.innerHTML = marked.parse(rawSnippet);
    } else {
      abs.innerHTML = rawSnippet;
    }

    const footer = document.createElement('p');
    footer.className = 'result-footer';
    footer.innerHTML = item.location ? ('Location: ' + item.location[0]) : '';

    card.appendChild(title);
    if (meta.textContent) card.appendChild(meta);
    if (abs.textContent || abs.innerHTML) card.appendChild(abs);
    if (footer.textContent) card.appendChild(footer);

    container.appendChild(card);
  });
}


function getFiltersFromParams(params) {
  const publiclyAvailable = params.get("publiclyAvailable");
  const filters = {
    mandatoryKeywords: params.get("mandatoryKeywords"),
    publiclyAvailable: publiclyAvailable === "" ? "" : publiclyAvailable === "true",
    dataType: (params.get('dataType') || '').split(',').filter(Boolean),
    category: (params.get('category') || '').split(',').filter(Boolean),
    researchField: (params.get('researchField') || '').split(',').filter(Boolean),
    location: (params.get('location') || '').split(',').filter(Boolean),
    fileExtensions: (params.get('fileExtensions') || ''),
    collectionStart: JSON.parse(params.get('collectionStart') || '{"type":"ignore","date":""}'),
    collectionEnd: JSON.parse(params.get('collectionEnd') || '{"type":"ignore","date":""}')
  };
  return filters;
}

function findAndDisplayResults(searchQuery, filters) {
  const resultsDiv = document.getElementById('results');

  // Call search function with query and filters
  doSearch(searchQuery.toLowerCase(), filters).then(res => renderResults(res, resultsDiv));
}


// --- Helper: simulate clicking an option ---
function fakeClickOnOption(filterLabel, selectedOption) {
  // Find the select element (e.g., <select id="location">)
  const select = document.getElementById(filterLabel);
  if (!select) {
    console.warn(`No select found for ${filterLabel}`);
    return;
  }

  // Find the matching <option> by text (case-insensitive match)
  const option = Array.from(select.options).find(opt =>
    opt.textContent.trim().toLowerCase() === selectedOption.trim().toLowerCase()
  );

  if (!option) {
    console.warn(`Option "${selectedOption}" not found in ${filterLabel}`);
    return;
  }

  // Mark it as selected
  option.selected = true;

  // Manually dispatch a change event so event listeners (like initSelectTags) react
  const event = new Event('change', { bubbles: true });
  select.dispatchEvent(event);
}


// --- Main function: restore previous GUI state ---
function updateGUIToMatchPreviousState(searchQuery, filters) {

  // --- Update search query ---
  const input = document.getElementById('query');
  if (input && searchQuery) input.value = searchQuery;

  // --- Open the filters tab if any filters are active ---
  const hasActiveFilters = Object.keys(filters || {}).some(key => {
    const val = filters[key];
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === "object" && val !== null)
      return Object.values(val).some(v => v && v !== "ignore" && v !== "");
    return !!val;
  });

  if (hasActiveFilters) {
    const filterPanel = document.getElementsByTagName('details')[0];
    filterPanel.open = true;
  }

  // --- Must contain keywords
  if (filters.mandatoryKeywords !== "") {
    const mandatoryKeywordsInput = document.getElementById('mandatoryKeywords');
    mandatoryKeywordsInput.value = filters.mandatoryKeywords;
  }

  // --- Availability ---
  if (filters.hasOwnProperty("publiclyAvailable") && filters.publiclyAvailable !== "") {
    if (filters.publiclyAvailable === true) {
      fakeClickOnOption("availability", "Publicly available");
    } else if (filters.publiclyAvailable === false) {
      fakeClickOnOption("availability", "Shareable on request");
    }
  }

  // --- Main multi-select filters ---
  ["dataType", "category", "researchField", "location"].forEach(label => {
    if (filters[label] && Array.isArray(filters[label])) {
      filters[label].forEach(opt => fakeClickOnOption(label, opt));
    }
  });

  // --- File extensions ---
  if (filters.fileExtensions) {
    const input = document.getElementById("fileExtensions");
    if (input) input.value = filters.fileExtensions;
  }

  // --- Collection start/end ---
  ["collectionStart", "collectionEnd"].forEach(label => {
    const key = label.replace("-", "");
    const dateFilter = filters[key];

    // it should be After date and before date
    if (dateFilter && dateFilter.type !== "ignore") {
      const dateFilterLabel = dateFilter.type === "after" ? "After date": "Before date";
      fakeClickOnOption(label + "-type", dateFilterLabel);
      const dateInput = document.getElementById(label);
      if (dateInput) dateInput.value = dateFilter.date;
    }
  });
}