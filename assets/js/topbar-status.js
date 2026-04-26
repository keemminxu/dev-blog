// 상단바 status — 날짜 + 날씨 + 시간
// 날씨: Open-Meteo (무료, 키 없음, CORS 지원)
(function () {
  'use strict';

  var dateEl = document.getElementById('status-date');
  var timeEl = document.getElementById('status-time');
  var weatherEl = document.getElementById('status-weather');

  if (!dateEl && !timeEl && !weatherEl) return;

  var DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function fmtDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + DAYS[d.getDay()];
  }

  function fmtTime(d) {
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function tickClock() {
    var now = new Date();
    if (dateEl) dateEl.textContent = fmtDate(now);
    if (timeEl) timeEl.textContent = fmtTime(now);
  }

  // WMO weather code → text + simple ASCII/emoji
  function weatherLabel(code) {
    if (code === 0) return '☀ Clear';
    if (code === 1 || code === 2) return '🌤 Mostly Clear';
    if (code === 3) return '☁ Cloudy';
    if (code === 45 || code === 48) return '🌫 Fog';
    if (code >= 51 && code <= 57) return '🌦 Drizzle';
    if (code >= 61 && code <= 67) return '🌧 Rain';
    if (code >= 71 && code <= 77) return '❄ Snow';
    if (code >= 80 && code <= 82) return '🌧 Showers';
    if (code === 85 || code === 86) return '❄ Snow';
    if (code >= 95) return '⛈ Thunder';
    return '· · ·';
  }

  function fetchWeather() {
    if (!weatherEl) return;
    var url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=37.5665&longitude=126.9780'
      + '&current=temperature_2m,weather_code'
      + '&timezone=Asia%2FSeoul';
    fetch(url)
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
      .then(function (data) {
        var c = data && data.current;
        if (!c) throw new Error('no current');
        var t = Math.round(c.temperature_2m);
        weatherEl.textContent = weatherLabel(c.weather_code) + ' ' + t + '°C';
      })
      .catch(function () {
        weatherEl.textContent = '날씨 --';
      });
  }

  tickClock();
  fetchWeather();
  setInterval(tickClock, 1000);
  setInterval(fetchWeather, 10 * 60 * 1000);  // 10분마다 갱신
})();
