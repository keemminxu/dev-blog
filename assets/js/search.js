document.addEventListener('DOMContentLoaded', function() {
  var input = document.getElementById('search-input');
  var results = document.getElementById('search-results');
  if (!input || !results) return;

  var posts = [];

  fetch('/search.json')
    .then(function(r) { return r.json(); })
    .then(function(data) { posts = data; })
    .catch(function(err) { console.log('Search index load failed:', err); });

  var debounceTimer;
  input.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    var self = this;
    debounceTimer = setTimeout(function() {
      var query = self.value.toLowerCase().trim();
      results.innerHTML = '';

      if (query.length < 2) {
        results.classList.remove('is-open');
        return;
      }

      var matches = posts.filter(function(post) {
        return post.title.toLowerCase().includes(query)
          || (post.title_en && post.title_en.toLowerCase().includes(query))
          || post.tags.some(function(t) { return t.toLowerCase().includes(query); })
          || post.excerpt.toLowerCase().includes(query);
      }).slice(0, 5);

      if (matches.length === 0) {
        results.classList.remove('is-open');
        return;
      }

      matches.forEach(function(post) {
        var a = document.createElement('a');
        a.className = 'search-item';
        a.href = post.url;
        var titleDiv = document.createElement('div');
        titleDiv.className = 'search-item-title';
        titleDiv.textContent = post.title;
        var dateDiv = document.createElement('div');
        dateDiv.className = 'search-item-date';
        dateDiv.textContent = post.date;
        a.appendChild(titleDiv);
        a.appendChild(dateDiv);
        results.appendChild(a);
      });

      results.classList.add('is-open');
    }, 150);
  });

  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.remove('is-open');
    }
  });
});
