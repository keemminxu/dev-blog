document.addEventListener('DOMContentLoaded', function() {
  var container = document.getElementById('visitor-stats');
  if (!container) return;

  var API_KEY = container.dataset.apiKey;
  var WEBSITE_ID = container.dataset.websiteId;
  if (!API_KEY || !WEBSITE_ID) return;

  var API_BASE = 'https://api.umami.is/v1/websites/' + WEBSITE_ID + '/stats';

  function getKSTTodayStart() {
    var now = new Date();
    var kstOffset = 9 * 60 * 60 * 1000;
    var kstNow = new Date(now.getTime() + kstOffset);
    var startOfDay = new Date(Date.UTC(
      kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()
    ));
    return startOfDay.getTime() - kstOffset;
  }

  function fetchStats(startAt, endAt) {
    var url = API_BASE + '?startAt=' + startAt + '&endAt=' + endAt;
    return fetch(url, {
      headers: { 'x-umami-api-key': API_KEY }
    }).then(function(res) { return res.json(); });
  }

  function formatNumber(n) {
    if (n >= 10000) return (n / 1000).toFixed(0) + 'k';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  var now = Date.now();
  Promise.all([
    fetchStats(getKSTTodayStart(), now),
    fetchStats(new Date('2025-03-01').getTime(), now)
  ]).then(function(results) {
    var todayEl = document.getElementById('visitor-today');
    var totalEl = document.getElementById('visitor-total');
    if (todayEl) todayEl.textContent = formatNumber(results[0].visitors || 0);
    if (totalEl) totalEl.textContent = formatNumber(results[1].visitors || 0);
    container.classList.add('loaded');
  }).catch(function() {});
});
