function initSelectTags() {
  document.querySelectorAll('.filter select').forEach(select => {
    const selectionDiv = document.getElementById(`${select.id}-selection`);
    if (!selectionDiv) return; // Skip if no container

    select.addEventListener('change', () => {
      const value = select.value;
      if (!value) return;

      // Avoid duplicates
      if ([...selectionDiv.querySelectorAll('button')].some(btn => btn.dataset.value === value)) {
        select.value = '';
        return;
      }

      // Create button inside existing div
      const btn = document.createElement('button');
      btn.textContent = value + ' ×';
      btn.dataset.value = value;
      btn.style.cssText = `
        margin: 0.2em;
        padding: 0.25em 0.5em;
        border-radius: 8px;
        border: 1px solid #005197;
        background: #e0f0ff;
        cursor: pointer;
        font-size: 0.9em;
      `;

      btn.addEventListener('click', () => btn.remove());

      selectionDiv.appendChild(btn);
      select.value = ''; // Reset select
    });
  });
}


function getFilters() {
  const filters = {};
  document.querySelectorAll('.filter').forEach(filterEl => {
    const name = filterEl.dataset.filter;
    const selected = Array.from(filterEl.querySelectorAll('.selected div'))
      .map(tag => tag.dataset.value);
    filters[name] = selected;
  });

  filters.collectionStartType = document.getElementById('collection-start-type')?.value || null;
  filters.collectionStart = document.getElementById('collection-start')?.value || null;
  filters.collectionEndType = document.getElementById('collection-end-type')?.value || null;
  filters.collectionEnd = document.getElementById('collection-end')?.value || null;
  filters.fileExtensions = document.getElementById('file-extensions')?.value.trim() || "";

  return filters;
}

function initDateIgnoreToggle() {
  const togglePairs = [
    { selectId: "collection-start-type", inputId: "collection-start" },
    { selectId: "collection-end-type", inputId: "collection-end" },
  ];

  togglePairs.forEach(pair => {
    const select = document.getElementById(pair.selectId);
    const input = document.getElementById(pair.inputId);

    function updateInputState() {
      if (select.value === "ignore") {
        input.disabled = true;
        input.style.backgroundColor = "#eee"; // greyed out
      } else {
        input.disabled = false;
        input.style.backgroundColor = ""; // reset
      }
    }

    select.addEventListener("change", updateInputState);
    updateInputState(); // initialize on page load
  });
}


async function loadSearchBar(pathPrefix) {
  const response = await fetch(`${pathPrefix}shared/search_bar.html`);
  const html = await response.text();
  document.getElementById('search-bar-placeholder').innerHTML = html;

  // Fix the form's action path
  const form = document.getElementById('search-form');
  if (form) {
    form.action = `${pathPrefix}search_results/search_results.html`;
  }

  // When the form exists, then we can fix the filters
  initSelectTags();

  initDateIgnoreToggle();

  // Now that the form exists, initialise search logic
  initSearchLogic();
}