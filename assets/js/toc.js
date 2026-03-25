document.addEventListener('DOMContentLoaded', function() {
  var tocList = document.getElementById('toc-list');
  if (!tocList) return;

  var content = document.querySelector('.post-content');
  if (!content) return;

  var headings = content.querySelectorAll('h2, h3, h4');
  if (headings.length === 0) return;

  headings.forEach(function(heading, index) {
    var id = heading.id || 'heading-' + index;
    heading.id = id;

    var li = document.createElement('li');
    li.className = 'toc-' + heading.tagName.toLowerCase();

    var a = document.createElement('a');
    a.href = '#' + id;
    a.textContent = heading.textContent;
    a.addEventListener('click', function(e) {
      e.preventDefault();
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    li.appendChild(a);
    tocList.appendChild(li);
  });

  var tocLinks = tocList.querySelectorAll('a');
  window.addEventListener('scroll', function() {
    var current = '';
    headings.forEach(function(heading) {
      if (window.scrollY >= heading.offsetTop - 100) {
        current = heading.id;
      }
    });

    tocLinks.forEach(function(link) {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  });
});
