document.addEventListener('DOMContentLoaded', function() {
  var input = document.getElementById('search-input');
  var results = document.getElementById('search-results');
  if (!input || !results) return;

  var posts = [];
  var baseUrl = '';

  fetch(baseUrl + '/search.json')
    .then(function(r) { return r.json(); })
    .then(function(data) { posts = data; })
    .catch(function(err) { console.log('Search index load failed:', err); });

  input.addEventListener('input', function() {
    var query = this.value.toLowerCase().trim();
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
      a.innerHTML = '<div class="search-item-title">' + post.title + '</div>'
                  + '<div class="search-item-date">' + post.date + '</div>';
      results.appendChild(a);
    });

    results.classList.add('is-open');
  });

  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.remove('is-open');
    }
  });
});
