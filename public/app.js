/**
 * AWS Architecture Patterns フロントエンド
 *
 * サイドバーにカテゴリ別のケース一覧、メインにケース解説を表示する。
 * 構成図はdiagram.jsがJSON仕様からSVGを生成する。
 * 読了チェックはlocalStorageに保存する。
 */
(function () {
  "use strict";

  var STORAGE_KEY = "awsarchi.state.v1";
  var cases = (window.AWS_CASES || []).slice().sort(function (a, b) { return a.id - b.id; });
  var caseById = {};
  cases.forEach(function (c) { caseById[c.id] = c; });

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* 壊れた保存データは無視 */ }
    return { done: {}, lastCase: null };
  }
  var state = loadState();
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 無視 */ }
  }

  var $ = function (id) { return document.getElementById(id); };
  var elToc = $("toc");
  var elView = $("case-view");
  var elWelcome = $("welcome");
  var current = null;
  var introShown = false;

  function doneCount() {
    return cases.filter(function (c) { return state.done[c.id]; }).length;
  }

  function renderProgress() {
    $("progress-label").textContent = doneCount() + " / " + cases.length;
    $("progress-fill").style.width = (cases.length ? (doneCount() / cases.length) * 100 : 0) + "%";
  }

  function renderToc() {
    elToc.innerHTML = "";
    if (window.AWS_INTRO) {
      var a = document.createElement("a");
      a.href = "#intro";
      a.className = "toc-intro" + (introShown ? " active" : "");
      a.textContent = window.AWS_INTRO.tocTitle || "はじめに";
      elToc.appendChild(a);
    }
    var categories = [];
    cases.forEach(function (c) {
      if (categories.indexOf(c.category) === -1) categories.push(c.category);
    });
    categories.forEach(function (cat) {
      var details = document.createElement("details");
      details.className = "toc-chapter";
      if (current && current.category === cat) details.open = true;
      var summary = document.createElement("summary");
      summary.textContent = cat;
      details.appendChild(summary);
      var ul = document.createElement("ul");
      cases.filter(function (c) { return c.category === cat; }).forEach(function (c) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = "#case-" + c.id;
        a.textContent = c.id + ". " + c.title;
        a.className = "toc-step" +
          (state.done[c.id] ? " done" : "") +
          (current && current.id === c.id ? " active" : "");
        li.appendChild(a);
        ul.appendChild(li);
      });
      details.appendChild(ul);
      elToc.appendChild(details);
    });
  }

  function h(html) { return html || ""; }

  function listHtml(items, cls) {
    if (!items || !items.length) return "";
    return '<ul class="' + (cls || "") + '">' + items.map(function (i) {
      return "<li>" + i + "</li>";
    }).join("") + "</ul>";
  }

  function servicesHtml(services) {
    if (!services || !services.length) return "";
    return '<div class="svc-list">' + services.map(function (s) {
      return (
        '<div class="svc-item">' +
        '<img src="icons/' + s.icon + '.svg" alt="" width="40" height="40">' +
        '<div><div class="svc-name">' + s.name + "</div>" +
        '<div class="svc-role">' + s.role + "</div></div></div>"
      );
    }).join("") + "</div>";
  }

  function refsHtml(refs) {
    if (!refs || !refs.length) return "";
    return '<ul class="ref-list">' + refs.map(function (r) {
      var note = r.note ? ' <span class="ref-note">— ' + r.note + "</span>" : "";
      return '<li><a href="' + r.url + '" target="_blank" rel="noopener noreferrer">' +
        r.title + "</a>" + note + "</li>";
    }).join("") + "</ul>";
  }

  function patternHtml(p, isMain) {
    var html = "";
    html += '<section class="pattern' + (isMain ? " pattern-main" : "") + '">';
    html += "<h3>" + (isMain ? "推奨アーキテクチャ：" : "代替パターン：") + p.name + "</h3>";
    if (p.when) html += '<p class="pattern-when">こんなときはこちら：' + p.when + "</p>";
    if (p.diagram) html += '<div class="diagram-wrap">' + AwsDiagram.render(p.diagram) + "</div>";
    if (p.flow) {
      html += "<h4>図の流れ</h4>" + listHtml(p.flow, "flow-list");
    }
    if (p.services) {
      html += "<h4>使うサービス</h4>" + servicesHtml(p.services);
    }
    if (p.points) {
      html += "<h4>設計の工夫点</h4>" + listHtml(p.points, "points-list");
    }
    if (p.pros || p.cons) {
      html += '<div class="pros-cons">';
      html += '<div class="pros"><h4>メリット</h4>' + listHtml(p.pros) + "</div>";
      html += '<div class="cons"><h4>デメリット・注意点</h4>' + listHtml(p.cons) + "</div>";
      html += "</div>";
    }
    if (p.references) {
      html += "<h4>公式ドキュメント・参考資料</h4>" + refsHtml(p.references);
    }
    html += "</section>";
    return html;
  }

  function showCase(id) {
    var c = caseById[id];
    if (!c) return;
    current = c;
    introShown = false;
    state.lastCase = id;
    saveState();
    elWelcome.hidden = true;
    elView.hidden = false;

    var html = "";
    html += '<p id="case-breadcrumb">' + c.category + "｜ケース " + c.id + " / " + cases.length + "</p>";
    html += "<h2>" + c.title + "</h2>";
    html += '<section class="scenario"><h3>どんなサービス？</h3>' + h(c.scenario) + "</section>";
    if (c.requirements) {
      html += '<section><h3>前提・要件</h3>' + listHtml(c.requirements, "req-list") + "</section>";
    }
    html += patternHtml(c.main, true);
    (c.alternatives || []).forEach(function (alt) {
      html += patternHtml(alt, false);
    });
    if (c.cost) html += '<section class="cost"><h3>費用感の目安</h3>' + h(c.cost) + "</section>";
    if (c.summary) html += '<section class="case-summary"><h3>このケースのまとめ</h3>' + h(c.summary) + "</section>";

    html += '<nav id="case-nav">';
    html += '<button id="btn-prev">前のケース</button>';
    html += '<label id="done-toggle"><input type="checkbox" id="chk-done"' +
      (state.done[c.id] ? " checked" : "") + "> 読んだ</label>";
    html += '<button id="btn-next" class="primary">次のケース</button>';
    html += "</nav>";

    elView.innerHTML = html;

    $("btn-prev").addEventListener("click", function () {
      if (caseById[c.id - 1]) location.hash = "#case-" + (c.id - 1);
    });
    $("btn-next").addEventListener("click", function () {
      if (caseById[c.id + 1]) location.hash = "#case-" + (c.id + 1);
    });
    $("chk-done").addEventListener("change", function () {
      if (this.checked) state.done[c.id] = true; else delete state.done[c.id];
      saveState(); renderToc(); renderProgress();
    });

    renderToc();
    renderProgress();
    window.scrollTo(0, 0);
    $("main").scrollTop = 0;
  }

  function showIntro() {
    var intro = window.AWS_INTRO;
    if (!intro) return;
    introShown = true;
    current = null;
    elView.hidden = true;
    elWelcome.hidden = false;
    elWelcome.innerHTML = "";
    var page = document.createElement("div");
    page.className = "intro-page";
    page.innerHTML = intro.content;
    var btn = document.createElement("button");
    btn.className = "primary";
    btn.textContent = "ケース1から始める";
    btn.addEventListener("click", function () { location.hash = "#case-1"; });
    page.appendChild(btn);
    elWelcome.appendChild(page);
    renderToc();
    window.scrollTo(0, 0);
    $("main").scrollTop = 0;
  }

  window.addEventListener("hashchange", function () {
    var m = location.hash.match(/^#case-(\d+)$/);
    if (m) showCase(Number(m[1]));
    else if (location.hash === "#intro") showIntro();
  });

  if (cases.length === 0) {
    elWelcome.innerHTML = "<h2>教材データが見つかりません</h2>";
  } else {
    renderToc();
    renderProgress();
    var m = location.hash.match(/^#case-(\d+)$/);
    if (!m && window.AWS_INTRO && (location.hash === "#intro" || !state.lastCase)) {
      showIntro();
      location.hash = "#intro";
    } else {
      var initial = m ? Number(m[1]) : state.lastCase || cases[0].id;
      if (!caseById[initial]) initial = cases[0].id;
      showCase(initial);
      location.hash = "#case-" + initial;
    }
  }
})();
