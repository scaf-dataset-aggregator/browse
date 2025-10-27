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
    const shareability = (item.shareability || '').toLowerCase();
    const kindsOfData = (item.kinds_of_data || []).map(s => s.toLowerCase());

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
    const arrayFilter = (itemValues, filterValues) => {
      if (!filterValues || !filterValues.length) return true;
      return filterValues.some(f => itemValues.includes(f.toLowerCase()));
    };

    // Shareability
    if (!arrayFilter(shareability, filters.shareability)) passesFilters = false;

    // Kinds of data
    if (!arrayFilter(kindsOfData, filters.kindsOfData)) passesFilters = false;

    // Category
    if (!arrayFilter(categories, filters.category)) passesFilters = false;

    // Research field
    if (!arrayFilter((item.research_field || []).map(r => r.toLowerCase()), filters.researchField)) passesFilters = false;

    // Location
    if (!arrayFilter([location], filters.location)) passesFilters = false;

    // File extensions
    if (filters.fileExtensions) {
      const allowedExts = filters.fileExtensions.split(',').map(f => f.trim().toLowerCase());
      const itemExts = (item.file_extensions || '').split(',').map(f => f.trim().toLowerCase());
      if (!allowedExts.some(ext => itemExts.includes(ext))) passesFilters = false;
    }

    // Collection start / end
    const parseDate = str => {
      if (!str) return null;
      const [d, m, y] = str.split('/').map(Number);
      return new Date(y, m - 1, d);
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

    if (!checkDate(item.collection_start, filters.collectionStart)) passesFilters = false;
    if (!checkDate(item.collection_end, filters.collectionEnd)) passesFilters = false;

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
  const form = document.getElementById('search-form');
  const input = document.getElementById('query');
  const resultsDiv = document.getElementById('results');

  const params = new URLSearchParams(window.location.search);
  const searchQuery = params.get('q') || '';

  input.value = searchQuery;

  // Parse filters from URL
  const filters = {
    shareability: (params.get('shareability') || '').split(',').filter(Boolean),
    kindsOfData: (params.get('kinds-of-data') || '').split(',').filter(Boolean),
    category: (params.get('category') || '').split(',').filter(Boolean),
    researchField: (params.get('research-field') || '').split(',').filter(Boolean),
    location: (params.get('location') || '').split(',').filter(Boolean),
    fileExtensions: params.get('file-extensions') || '',
    collectionStart: JSON.parse(params.get('collection-start') || '{"type":"ignore","date":""}'),
    collectionEnd: JSON.parse(params.get('collection-end') || '{"type":"ignore","date":""}')
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


