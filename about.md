---
layout: default
title: About
permalink: /about/
---

<div class="about-page">

  <section class="about-intro about-intro--banner">
    <div class="about-banner">
      <img src="{{ '/assets/images/profileImage/dev_transparent.png' | relative_url }}" alt="Profile">
    </div>
    <div class="about-bio about-bio--center">
      <h1 class="about-name">김민수 <span>· Minsu Kim</span></h1>
      <p class="about-role">
        UE 클라이언트 개발자 — <span class="about-dday" id="career-dday" data-start="2022-03-01">계산 중…</span>
      </p>
      <p class="about-tagline">재밌는걸 멋있게 오래 할 수 있는걸 좋아합니다.</p>
    </div>
  </section>

  <script>
  (function () {
    var el = document.getElementById('career-dday');
    if (!el) return;
    var start = new Date(el.dataset.start || '2022-03-01');
    var now = new Date();
    var years = now.getFullYear() - start.getFullYear();
    var months = now.getMonth() - start.getMonth();
    if (now.getDate() < start.getDate()) months--;
    if (months < 0) { years--; months += 12; }
    var totalMonths = years * 12 + months + 1; // "차" — 진입한 N번째 달
    var y = Math.floor(totalMonths / 12);
    var m = totalMonths % 12;
    el.textContent = y > 0
      ? (m > 0 ? y + '년 ' + m + '개월차' : y + '년차')
      : m + '개월차';
  })();
  </script>

  <section class="about-section">
    <h2 class="about-heading"><span class="about-heading-icon" aria-hidden="true">💼</span>career</h2>
    <ol class="about-timeline">
      <li class="about-timeline-item">
        <time class="about-timeline-date">2025.04 — 현재</time>
        <div class="about-timeline-body">
          <strong>더크로싱랩</strong>
          <span> · 개발실 주임</span>
          <p>UE 클라이언트 개발 및 모바일 프로젝트 담당 관리</p>
        </div>
      </li>
      <li class="about-timeline-item">
        <time class="about-timeline-date">2022.03 — 2025.03</time>
        <div class="about-timeline-body">
          <strong>비빔블</strong>
          <span> · 개발팀 대리</span>
          <p>UE 클라이언트 개발 및 백엔드 운영</p>
        </div>
      </li>
    </ol>
  </section>

  <section class="about-section">
    <h2 class="about-heading"><span class="about-heading-icon" aria-hidden="true">🎮</span>projects</h2>
    <div class="about-projects">

      <article class="about-project">
        <div class="about-project-titlebar">
          <span class="about-project-titlebar-text">blueprint_analyzer.exe</span>
        </div>
        <a class="about-project-link" href="https://fab.com/s/926b85b74bed" target="_blank" rel="noopener">
          <div class="about-project-media">
            <img src="{{ '/assets/images/logo/ba.png' | relative_url }}" alt="Blueprint Analyzer">
          </div>
        </a>
        <div class="about-project-info">
          <h3 class="about-project-title">Blueprint Analyzer</h3>
          <p class="about-project-desc">엔진 툴 플러그인</p>
          <div class="about-project-tags">
            <span class="about-project-tag">UE5.5</span>
            <span class="about-project-tag">UE5.6</span>
            <span class="about-project-tag">UE5.7</span>
            <span class="about-project-tag">C++</span>
          </div>
        </div>
      </article>

      <article class="about-project">
        <div class="about-project-titlebar">
          <span class="about-project-titlebar-text">editor_cursor_skin.exe</span>
        </div>
        <a class="about-project-link" href="https://fab.com/s/dbe5befc72f6" target="_blank" rel="noopener">
          <div class="about-project-media about-project-media--link">
            <span class="about-project-cta">VIEW ON FAB →</span>
          </div>
        </a>
        <div class="about-project-info">
          <h3 class="about-project-title">Editor Cursor Skin</h3>
          <p class="about-project-desc">에디터 마우스 커서를 이미지·GIF로 교체하는 엔진 툴 플러그인</p>
          <div class="about-project-tags">
            <span class="about-project-tag">UE5.3–5.7</span>
            <span class="about-project-tag">C++</span>
            <span class="about-project-tag">Editor-Only</span>
          </div>
        </div>
      </article>

      <article class="about-project">
        <div class="about-project-titlebar">
          <span class="about-project-titlebar-text">bicus.mov</span>
        </div>
        <div class="about-project-media">
          <iframe src="https://www.youtube.com/embed/91c-M1SKpxI" title="bicus" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
        <div class="about-project-info">
          <h3 class="about-project-title">bicus</h3>
          <p class="about-project-desc">소셜 플랫폼</p>
          <div class="about-project-tags">
            <span class="about-project-tag">UE5.3</span>
            <span class="about-project-tag">C++</span>
            <span class="about-project-tag">Python</span>
            <span class="about-project-tag">AWS</span>
            <span class="about-project-tag">Firebase</span>
          </div>
        </div>
      </article>

      <article class="about-project">
        <div class="about-project-titlebar">
          <span class="about-project-titlebar-text">superplat.mov</span>
        </div>
        <div class="about-project-media">
          <iframe src="https://www.youtube.com/embed/kh7fVeNrZEc" title="SuperPlat" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
        <div class="about-project-info">
          <h3 class="about-project-title">SuperPlat</h3>
          <p class="about-project-desc">소셜 액션 RPG</p>
          <div class="about-project-tags">
            <span class="about-project-tag">UE5.5</span>
            <span class="about-project-tag">C++</span>
            <span class="about-project-tag">MediaPipe</span>
            <span class="about-project-tag">IOCP</span>
          </div>
        </div>
      </article>

      <article class="about-project">
        <div class="about-project-titlebar">
          <span class="about-project-titlebar-text">virtudio.mov</span>
        </div>
        <div class="about-project-media">
          <iframe src="https://www.youtube.com/embed/zUTdrtFuqv4?start=44" title="Virtudio" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
        <div class="about-project-info">
          <h3 class="about-project-title">Virtudio</h3>
          <p class="about-project-desc">버추얼 휴먼 스트리밍 플랫폼</p>
          <div class="about-project-tags">
            <span class="about-project-tag">UE5.3</span>
            <span class="about-project-tag">C++</span>
            <span class="about-project-tag">Python</span>
            <span class="about-project-tag">AWS</span>
            <span class="about-project-tag">Firebase</span>
          </div>
        </div>
      </article>

      <article class="about-project">
        <div class="about-project-titlebar">
          <span class="about-project-titlebar-text">hello_future.mov</span>
        </div>
        <div class="about-project-media">
          <iframe src="https://www.youtube.com/embed/oJJnuIpTIOU" title="Hello Future" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
        <div class="about-project-info">
          <h3 class="about-project-title">Hello Future</h3>
          <p class="about-project-desc">경제 학습 플랫폼 — 메타버스 경진대회 수상작</p>
          <div class="about-project-tags">
            <span class="about-project-tag">UE4.26</span>
            <span class="about-project-tag">C++</span>
          </div>
        </div>
      </article>

    </div>
  </section>

</div>
