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

async function doSearch(q, filters = {}) {
  const data = await loadIndex();

  alert("filters are "+JSON.stringify(filters));

  // Clean and limit query
  q = (q || '').trim().toLowerCase();
  if (!q) return data.slice(0, 50);
  if (q.length > 100) q = q.slice(0, 100);

  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 32);

  const scored = data.map(item => {
    let score = 0;

    // Ensure fields are strings or arrays
    const name = (item.name || '').toLowerCase();
    const keywords = (item.keywords || []).map(k => k.toLowerCase());
    const abstract = (item.abstract || '').toLowerCase();
    const location = (item.location || '').toLowerCase();
    const author = (item.author_name || '').toLowerCase();
    const categories = (item.categories_list || []).map(c => c.toLowerCase());
    const publiclyAvailable = item.publicly_available;
    const dataTypes = (item.data_types || []);
    const fileExtensions = (item.file_extensions || []);
    const researchFields = (item.research_fields || []);

    //alert("The fields are "+JSON.stringify(item));

    // Apply search tokens scoring
    tokens.forEach(t => {
      if (name.includes(t)) score += 7;
      if (keywords.some(k => k.includes(t))) score += 5;
      if (abstract.includes(t)) score += 2;
      if (location.includes(t)) score += 3;
      if (author.includes(t)) score += 5;
      if (categories.some(c => c.includes(t))) score += 1;
    });

    // --- Apply filters ---
    let passesFilters = true;

    // Helper for multi-select arrays
    const atLeastOnePresent = (itemValues, filterValues) => {
      if (!filterValues || !filterValues.length) return true;
      return filterValues.some(f => itemValues.includes(f.toLowerCase()));
    };

    // Shareability
    if ((filters.publiclyAvailable !== "") && (filters.publiclyAvailable !== publiclyAvailable)) {
      console.log(item.name + " fail at shareability, " + filters.publiclyAvailable + ", " + publiclyAvailable);
      passesFilters = false;
    }

    // Kinds of data
    if (!atLeastOnePresent(dataTypes, filters.dataTypes)) {
      console.log(item.name + "fail at kinds of data");
      passesFilters = false;
    }

    // Category
    if (!atLeastOnePresent(categories, filters.category)) {
      console.log(item.name + "fail at category");
      passesFilters = false;
    }

    // Research field
    if (!atLeastOnePresent(researchFields, filters.researchField)) {
      console.log(item.name + "fail at research field");
      passesFilters = false;
    }


    // Location
    //console.log("location = "+location + ", filters.location ="+filters.location);
    //console.log("passes: " + (![location]) + ", " + (!filters.location.length));
    if (!atLeastOnePresent([location.toLowerCase()], filters.location)) {
      console.log(item.name + "fail at location");
      passesFilters = false;
    }

    // File Extensions
    //alert("1 " + JSON.stringify(filters));
    requiredFilterExtensions = filters.fileExtensions.split(", ");
    // alert("2 " + requiredFilterExtensions);
    if (!atLeastOnePresent(requiredFilterExtensions, filters.fileExtensions)) {
      console.log(item.name + "fail at file extensions");
      passesFilters = false;
    }



    // Collection start / end
    const parseDate = str => {
      if (!str) return null;
      return new Date(str);
    };

    const checkDate = (itemDateStr, filterObj) => {
      if (!filterObj || filterObj.type === "ignore") return true;
      const itemDate = parseDate(itemDateStr);
      if (!itemDate) return true;
      const filterDate = new Date(filterObj.date);
      if (isNaN(filterDate)) return true;
      if (filterObj.type === "after") return itemDate >= filterDate;
      if (filterObj.type === "before") return itemDate <= filterDate;
      return true;
    };

    if (!checkDate(item.collection_start, filters.collectionStart)) {
      console.log(item.name + "fail at start date");
      passesFilters = false;
    }
    if (!checkDate(item.collection_end, filters.collectionEnd)) {
      console.log(item.name + "fail at end date");
      passesFilters = false;
    }

    // alert("For "+item.name + ", score = "+score +", passed = "+passesFilters);
    return { score, item, passesFilters };
  })
  // keep only scored >=2 AND passing filters
  .filter(x => x.score >= 2 && x.passesFilters)
  .sort((a, b) => b.score - a.score)
  .map(x => x.item);

  return scored;
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

  //alert("The params are "+JSON.stringify(params));

  // Parse filters from URL
  const filters = {
    publiclyAvailable: (params.get('availability') || ''),
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


