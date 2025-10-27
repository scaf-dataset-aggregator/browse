async function loadSearchBar(pathPrefix) {
  const response = await fetch(`${pathPrefix}shared/search_bar.html`);
  const html = await response.text();
  document.getElementById('search-bar-placeholder').innerHTML = html;

  // Fix the form's action path
  const form = document.getElementById('search-form');
  if (form) {
    form.action = `${pathPrefix}search_results/search_results.html`;
  }

  // Now that the form exists, initialise search logic
  initSearchLogic();
}