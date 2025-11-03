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
  dbg("fPublic = "+fPublic);
  if (fPublic !== "") {
    filteredResults = filteredResults.filter(item =>
      item.publicly_available === fPublic
    );
  }

  dbg_lenFilteredResults("after_public");

  // --- 2. Filter: Kinds of data ---
  const fDataTypes = normalizeArray(filters.dataTypes);
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
      const iLocation = normalizeString(item.location);
      return arrayIntersects([iLocation], fLocation);
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
    const location = normalizeString(item.location);
    const author = normalizeString(item.author_name);
    const categories = normalizeArray(item.categories_list);

    // Apply search tokens scoring
    tokens.forEach(t => {
      if (name.includes(t)) score += 7;
      if (keywords.some(k => k.includes(t))) score += 5;
      if (abstract.includes(t)) score += 2;
      if (location.includes(t)) score += 3;
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


// async function doSearch(q, filters = {}) {
//   const data = await loadIndex();
//
//
//   // Clean and limit query
//   q = (q || '').trim().toLowerCase();
//   if (q.length > 100) q = q.slice(0, 100);
//
//   const tokens = q.split(/\s+/).filter(Boolean).slice(0, 32);
//
//   const scored = data.map(item => {
//     let score = 0;
//
//     // Ensure fields are strings or arrays
//     const name = (item.name || '').toLowerCase();
//     const keywords = (item.keywords || []).map(k => k.toLowerCase());
//     const abstract = (item.abstract || '').toLowerCase();
//     const location = (item.location || '').toLowerCase();
//     const author = (item.author_name || '').toLowerCase();
//     const categories = (item.categories_list || []).map(c => c.toLowerCase());
//     const publiclyAvailable = item.publicly_available;
//     const dataTypes = (item.data_types || []);
//     const fileExtensions = (item.file_extensions || []);
//     const researchFields = (item.research_fields || []);
//
//     // Apply search tokens scoring
//     tokens.forEach(t => {
//       if (name.includes(t)) score += 7;
//       if (keywords.some(k => k.includes(t))) score += 5;
//       if (abstract.includes(t)) score += 2;
//       if (location.includes(t)) score += 3;
//       if (author.includes(t)) score += 5;
//       if (categories.some(c => c.includes(t))) score += 1;
//     });
//
//     // --- Apply filters ---
//     let passesFilters = true;
//
//     // Helper for multi-select arrays
//
//     const thereAreFilterValues = (filterValues)  => {
//       // Must be an array
//       if (!Array.isArray(filterValues)) return false;
//
//       // Must not be empty
//       if (filterValues.length === 0) return false;
//
//       // Must not be [""] or ["   "]
//       if (filterValues.length === 1 && String(filterValues[0]).trim() === "") return false;
//
//       return true;
//     }
//     const atLeastOnePresent = (itemValues, filterValues) => {
//       return filterValues.some(f => itemValues.includes(f.toLowerCase()));
//     };
//
//     // Shareability
//     if ((filters.publiclyAvailable !== "") && (filters.publiclyAvailable !== publiclyAvailable)) {
//       console.log(item.name + " fail at shareability, " + filters.publiclyAvailable + ", " + publiclyAvailable);
//       passesFilters = false;
//     }
//
//     // Kinds of data
//     if (thereAreFilterValues(filters.dataTypes) && !atLeastOnePresent(dataTypes, filters.dataTypes)) {
//       console.log(item.name + "fail at kinds of data");
//       passesFilters = false;
//     }
//
//     // Category
//     if (thereAreFilterValues(filters.category) && !atLeastOnePresent(categories, filters.category)) {
//       console.log(item.name + "fail at category");
//       passesFilters = false;
//     }
//
//     // Research field
//     if (thereAreFilterValues(filters.researchField) && !atLeastOnePresent(researchFields, filters.researchField)) {
//       console.log(item.name + "fail at research field");
//       passesFilters = false;
//     }
//
//
//     // Location
//     if (thereAreFilterValues(filters.location) && !atLeastOnePresent([location.toLowerCase()], filters.location)) {
//       console.log(item.name + "fail at location");
//       passesFilters = false;
//     }
//
//     // File Extensions
//     requiredFilterExtensions = filters.fileExtensions.split(", ");
//     if (thereAreFilterValues(requiredFilterExtensions) && !atLeastOnePresent(fileExtensions, requiredFilterExtensions)) {
//       console.log(item.name + "fail at file extensions");
//       console.log(requiredFilterExtensions);
//       console.log(fileExtensions);
//       passesFilters = false;
//     }
//
//
//
//     // Collection start / end
//     const parseDate = str => {
//       if (!str) return null;
//       return new Date(str);
//     };
//
//     const checkDate = (itemDateStr, filterObj) => {
//       if (!filterObj || filterObj.type === "ignore") return true;
//       const itemDate = parseDate(itemDateStr);
//       if (!itemDate) return true;
//       const filterDate = new Date(filterObj.date);
//       if (isNaN(filterDate)) return true;
//       if (filterObj.type === "after") return itemDate >= filterDate;
//       if (filterObj.type === "before") return itemDate <= filterDate;
//       return true;
//     };
//
//     if (!checkDate(item.collection_start, filters.collectionStart)) {
//       console.log(item.name + "fail at start date");
//       passesFilters = false;
//     }
//     if (!checkDate(item.collection_end, filters.collectionEnd)) {
//       console.log(item.name + "fail at end date");
//       passesFilters = false;
//     }
//
//     return { score, item, passesFilters };
//   })
//   // keep only scored >=2 AND passing filters
//   .filter(x => x.score >= 2 && x.passesFilters)
//   .sort((a, b) => b.score - a.score)
//   .map(x => x.item);
//
//   return scored;
// }

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
    a.textContent = item.name || `Dataset ${item.id}`;
    title.appendChild(a);

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
    footer.innerHTML = item.location ? ('Location: ' + item.location) : '';

    card.appendChild(title);
    if (meta.textContent) card.appendChild(meta);
    if (abs.textContent || abs.innerHTML) card.appendChild(abs);
    if (footer.textContent) card.appendChild(footer);

    container.appendChild(card);
  });
}


function findAndDisplayResults() {
  const input = document.getElementById('query');
  const resultsDiv = document.getElementById('results');

  const params = new URLSearchParams(window.location.search);
  const searchQuery = params.get('q') || '';

  input.value = searchQuery;


  // Parse filters from URL
  const filters = {
    publiclyAvailable: (params.get('publiclyAvailable') || ''),
    dataTypes: (params.get('dataTypes') || '').split(',').filter(Boolean),
    category: (params.get('category') || '').split(',').filter(Boolean),
    researchField: (params.get('researchField') || '').split(',').filter(Boolean),
    location: (params.get('location') || '').split(',').filter(Boolean),
    fileExtensions: (params.get('fileExtensions') || ''),
    collectionStart: JSON.parse(params.get('collectionStart') || '{"type":"ignore","date":""}'),
    collectionEnd: JSON.parse(params.get('collectionEnd') || '{"type":"ignore","date":""}')
  };

  // Call search function with query and filters
  doSearch(searchQuery.toLowerCase(), filters).then(res => renderResults(res, resultsDiv));
}


// DOM glue
// document.addEventListener('DOMContentLoaded', () => {
//   const form = document.getElementById('search-form');
//   const input = document.getElementById('query');
//   const resultsDiv = document.getElementById('results');
//
//   const params = new URLSearchParams(window.location.search);
//   if (params.has('q')) {
//     input.value = params.get('q');
//     doSearch(params.get('q').toLowerCase()).then(res => renderResults(res, resultsDiv));
//   }
//
//   form?.addEventListener('submit', e => {
//     e.preventDefault();
//     const q = input.value;
//     if (window.location.pathname.endsWith('results.html')) {
//       doSearch(q.toLowerCase()).then(res => renderResults(res, resultsDiv));
//     } else {
//       window.location = `results.html?q=${encodeURIComponent(q)}`;
//     }
//   });
//
// });


