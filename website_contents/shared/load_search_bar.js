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
      btn.textContent = value.trimStart() + ' ×';
      btn.dataset.value = value;
      btn.classList.add("selected-filter");

      btn.addEventListener('click', () => btn.remove());

      selectionDiv.appendChild(btn);
      select.value = ''; // Reset select
    });
  });
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

  filters["mandatoryKeywords"] = document.getElementById('mandatoryKeywords').value;

  // multi-select filters
  ["dataType", "category", "researchField", "location"].forEach(id => {
    filters[id] = getSelectedItemsForFilterField(id);
  });

  //shareability
  // remember that it's a comma-separated string
  availabilitySelection = getSelectedItemsForFilterField("availability");
  if (availabilitySelection === "Publicly available") {
    filters["publiclyAvailable"] = true;
  }
  else if (availabilitySelection === "Shareable on request") {
    filters["publiclyAvailable"] = false;
  }
  else {
    filters["publiclyAvailable"] = "";
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

  const q = input.value.trim();
  const filters = getFilterJSONFromGUI();



  // Build query string
  const params = new URLSearchParams({ q });
  Object.entries(filters).forEach(([key, val]) => {
    params.set(key, val);
  });

  // Normalise path check and redirect
  const resultsPath = `${websiteContentsPath}search_results/search_results.html`;
  window.location = `${resultsPath}?${params.toString()}`;
}

function initSearchLogic(websiteContentsPath = '') {
  const form = document.getElementById('search-form');
  form?.addEventListener('submit', redirectToSearchResultsPageWithURLParams);
}



function loadFilterOptionsForFilter(json_data, filter_name) {
  // Find the <select> element
  const selectElement = document.getElementById(filter_name);
  if (!selectElement) {
    console.error(`No element with id='${filter_name}' found.`);
    return;
  }

  // Clear any previous options
  selectElement.innerHTML = '';

  // Recursive helper to flatten the nested object
  function addOptionsToList(list, obj, depth = 0) {
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        const label = `${'&nbsp;&nbsp;'.repeat(depth)}${key}`;
        list.push(label);
        addOptionsToList(list, obj[key], depth + 1);
      }
    }
  }

  // Build a flat list of entries
  const menuEntries = [];
  addOptionsToList(menuEntries, json_data);

  // Add each entry to the <select>
  menuEntries.forEach(entry => {
    const option = document.createElement("option");
    option.innerHTML = entry; // render &nbsp; as indentation
    selectElement.appendChild(option);
  });
}

/**
 * Load all filters dynamically from a JSON file.
 * The JSON should look like:
 * {
 *   "category": [...],
 *   "location": [...],
 *   "accessibility": [...]
 * }
 */
async function loadFilterOptions(websiteContentsPath = '') {
  try {
    const response = await fetch(`${websiteContentsPath}../website_metadata/filter_options.json`);
    if (!response.ok) throw new Error("Could not load filter_options.json");
    const filterOptionsDict = await response.json();

    // Load each filter dynamically
    ["category", "location", "dataType", "researchField"].forEach(filterName => {
      if (filterOptionsDict[filterName]) {
        loadFilterOptionsForFilter(filterOptionsDict[filterName], filterName);
      } else {
        console.warn(`Filter '${filterName}' not found in JSON.`);
      }
    });
  } catch (error) {
    console.error("Error loading filter options:", error);
  }
}

function prepareSearchFunctionForFilter(filterName) {
  // Find the filter div and its <select> and <input>
  const filterDiv = document.querySelector(`.filter[data-filter="${filterName}"]`);
  if (!filterDiv) return;

  const select = filterDiv.querySelector("select");
  const input = filterDiv.querySelector("input[type='text']");
  if (!select || !input) return;

  // Store the original list of options
  const originalOptions = Array.from(select.options).map(opt => opt.cloneNode(true));

  function updateSelectOptions() {
    const searchTerm = input.value.toLowerCase().trim();

    // Clear the current options
    select.innerHTML = "";

    // Decide what to show
    const filtered = searchTerm
      ? originalOptions.filter(opt => opt.textContent.toLowerCase().includes(searchTerm))
      : originalOptions;

    // Append matching (or all) options
    filtered.forEach(opt => select.appendChild(opt.cloneNode(true)));
  }

  // Assign the filter function
  input.addEventListener("keyup", updateSelectOptions);
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
  await loadFilterOptions(websiteContentsPath);
  initSelectTags();
  initDateIgnoreToggle();

  ["category", "researchField", "location"].forEach(prepareSearchFunctionForFilter);


  initSearchLogic(websiteContentsPath);



  // Let the caller know the bar is ready
  return true;
}


