// --- FLAGS ---
const USE_FLEXSEARCH = false; // toggle true if using FlexSearch (CDN included)
const RENDER_MARKDOWN_CLIENT = false; // toggle true if using marked.js for markdown rendering
// -------------

let indexData = [];
let flexIndex = null;

async function loadIndex() {
  if (indexData.length) return indexData;
  const res = await fetch('database_index.json');
  indexData = await res.json();
  // Keep only entries where allowed_in_database is true
  indexData = indexData.filter(item => item.allowed_in_database);
  return indexData;
}

async function doSearch(q) {
  const data = await loadIndex();
  q = (q || '').trim();
  if (!q) return data.slice(0, 50);

  if (USE_FLEXSEARCH && typeof FlexSearch !== 'undefined') {
    if (!flexIndex) {
      flexIndex = new FlexSearch.Index({ tokenize: 'forward', cache: true });
      data.forEach(item => {
        const text = [item.name, (item.keywords||[]).join(' '), item.abstract, item.location].join(' ');
        flexIndex.add(item.id, text);
      });
    }
    const ids = await flexIndex.search(q, 100);
    const hits = data.filter(d => ids.includes(d.id.toString()));
    return hits;
  }

  //if not using flex search
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = data.map(item => {
    let score = 0;
    const hay = (item.name || '') + ' ' + (item.keywords||[]).join(' ') + ' ' + (item.abstract||'') + ' ' + (item.location||'');
    const haylower = hay.toLowerCase();
    tokens.forEach(t => {
      if (haylower.includes(t)) score += 1;
    });
    if ((item.name || '').toLowerCase().includes(q.toLowerCase())) score += 2;
    return { score, item };
  }).filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.item);

  return scored.slice(0, 100);
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
  container.innerHTML = '';
  if (!items || items.length === 0) {
    container.innerHTML = '<p>No results found.</p>';
    return;
  }

  items.forEach(item => {
    const card = document.createElement('article');
    card.className = 'search-card';

    const title = document.createElement('h2');
    const a = document.createElement('a')
    a.href = item.link || (`database_webpages/${item.id}.html`);
    a.textContent = item.name || `Dataset ${item.id}`;
    title.appendChild(a);

    const meta = document.createElement('p');
    meta.className = 'meta';
    if (item.keywords && item.keywords.length) {
      meta.textContent = 'Keywords: ' + item.keywords.join(', ');
    }

    const abs = document.createElement('div');
    abs.className = 'snippet';
    const rawSnippet = snippet(item.abstract || '', document.getElementById('query')?.value || '');
    if (RENDER_MARKDOWN_CLIENT && typeof marked !== 'undefined') {
      abs.innerHTML = marked.parse(rawSnippet);
    } else {
      abs.textContent = rawSnippet;
    }

    const footer = document.createElement('p');
    footer.className = 'result-footer';
    footer.textContent = item.location ? ('Location: ' + item.location) : '';

    card.appendChild(title);
    if (meta.textContent) card.appendChild(meta);
    if (abs.textContent || abs.innerHTML) card.appendChild(abs);
    if (footer.textContent) card.appendChild(footer);

    container.appendChild(card);
  });
}

// DOM glue
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('search-form');
  const input = document.getElementById('query');
  const resultsDiv = document.getElementById('results');
  const filterBtn = document.getElementById('filter-btn');
  const filterPanel = document.getElementById('filter-panel');

  const params = new URLSearchParams(window.location.search);
  if (params.has('q')) {
    input.value = params.get('q');
    doSearch(params.get('q').toLowerCase()).then(res => renderResults(res, resultsDiv));
  }

  form?.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value;
    if (window.location.pathname.endsWith('results.html')) {
      doSearch(q.toLowerCase()).then(res => renderResults(res, resultsDiv));
    } else {
      window.location = `results.html?q=${encodeURIComponent(q)}`;
    }
  });

  filterBtn?.addEventListener('click', () => {
    filterPanel.classList.toggle('hidden');
  });
});
