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

async function doSearch(q) {
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

    tokens.forEach(t => {
      if (name.includes(t)) score += 7;
      if (keywords.some(k => k.includes(t))) score += 5;
      if (abstract.includes(t)) score += 2;
      if (location.includes(t)) score += 3;
      if (author.includes(t)) score += 5;
      if (categories.some(c => c.includes(t))) score += 1;
    });

    return { score, item };
  })
  .filter(x => x.score >= 2)
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


function initSearchLogic(pathPrefix = '') {
  const form = document.getElementById('search-form');
  const input = document.getElementById('query');
  const resultsDiv = document.getElementById('results');

  const params = new URLSearchParams(window.location.search);
  if (params.has('q')) {
    input.value = params.get('q');
    doSearch(params.get('q').toLowerCase()).then(res => renderResults(res, resultsDiv));
  }

  form?.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim().toLowerCase();

    // Normalise path check and redirect
    const currentPath = window.location.pathname;
    const resultsPath = `${pathPrefix}website_contents/search_results/search_results.html`;

    if (currentPath.endsWith('search_results.html')) {
      doSearch(q).then(res => renderResults(res, resultsDiv));
    } else {
      window.location = `${resultsPath}?q=${encodeURIComponent(q)}`;
    }
  });
}