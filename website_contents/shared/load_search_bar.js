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

  filters.collectionStartType = document.getElementById('collectionStart-type')?.value || null;
  filters.collectionStart = document.getElementById('collectionStart')?.value || null;
  filters.collectionEndType = document.getElementById('collectionEnd-type')?.value || null;
  filters.collectionEnd = document.getElementById('collectionEnd')?.value || null;
  filters.fileExtensions = document.getElementById('fileExtensions')?.value.trim() || "";

  return filters;
}

function initDateIgnoreToggle() {
  const togglePairs = [
    { selectId: "collectionStart-type", inputId: "collectionStart" },
    { selectId: "collectionEnd-type", inputId: "collectionEnd" },
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


function getSelectedItemsForFilterField(filterID) {
  const selectionDiv = document.getElementById(`${filterID}-selection`);
  const selectedValues = [];

  if (selectionDiv) {
    // Each selected tag is typically a <button> or similar element
    selectionDiv.querySelectorAll("button").forEach(btn => {
      let text = btn.textContent.trim();
      // Remove the last 2 characters (" x")
      if (text.length > 2) text = text.slice(0, -2);
      selectedValues.push(text);
    });
  }

  // Store as comma-separated string (or empty string if none)
  return selectedValues.join(",");
}
function getFilterJSONFromGUI() {
  const filters = {};

  // multi-select filters
  ["dataType", "category", "researchField", "location"].forEach(id => {
    filters[id] = getSelectedItemsForFilterField(id);
  });

  //shareability
  // if there are 0 or 2, you can ignore it.
  availabilitySelection = getSelectedItemsForFilterField("availability").split(",");
  if ((availabilitySelection.length) !== 1) {
    filters["publiclyAvailable"] = "";
  }
  else {
    filters["publiclyAvailable"] = availabilitySelection[0] === "Publicly Available";
  }

  // file extensions
  filters["fileExtensions"] = document.getElementById("fileExtensions").value.trim();

  // collection start/end
  ["collectionStart", "collectionEnd"].forEach(id => {
    const type = document.getElementById(id + "-type").value;
    const date = document.getElementById(id).value;
    filters[id] = JSON.stringify({ type, date });
  });

  return filters;
}

function redirectToSearchResultsPageWithURLParams(e) {

  const input = document.getElementById('query');
  e.preventDefault();

  const q = input.value.trim().toLowerCase();
  const filters = getFilterJSONFromGUI();
  alert("The filters obtained from getFilterJSON are "+JSON.stringify(filters));

  // Build query string
  const params = new URLSearchParams({ q });
  Object.entries(filters).forEach(([key, val]) => {
    params.set(key, val);
  });

  //alert("From URL search params, the params are "+JSON.stringify(params));
  // Normalise path check and redirect
  const resultsPath = `${websiteContentsPath}search_results/search_results.html`;
  alert("Redirecting you to "+`${resultsPath}?${params.toString()}`);
  window.location = `${resultsPath}?${params.toString()}`;


  //const currentPath = window.location.pathname;
  // if (currentPath.endsWith('search_results.html')) {
  //   findAndDisplayResults();
  //   //doSearch(q).then(res => renderResults(res, resultsDiv));
  // } else {
  //   window.location = `${resultsPath}?${params.toString()}`;
  // }
}

function initSearchLogic(websiteContentsPath = '') {
  const form = document.getElementById('search-form');
  form?.addEventListener('submit', redirectToSearchResultsPageWithURLParams);
}


async function loadSearchBar(websiteContentsPath) {
  const response = await fetch(`${websiteContentsPath}shared/search_bar.html`);
  const html = await response.text();
  document.getElementById('search-bar-placeholder').innerHTML = html;

  // Fix the form's action path
  const form = document.getElementById('search-form');
  if (form) {
    form.action = `${websiteContentsPath}search_results/search_results.html`;
  }

  // Initialise behaviour now that form exists
  initSelectTags();
  initDateIgnoreToggle();
  initSearchLogic(websiteContentsPath);

  // Let the caller know the bar is ready
  return true;
}