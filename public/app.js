/**
 * AWS Architecture Patterns フロントエンド
 *
 * サイドバーにカテゴリ別のケース一覧、メインにケース解説を表示する。
 * 構成図はdiagram.jsがJSON仕様からSVGを生成する。
 * 読了チェックはlocalStorageに保存する。
 * 複数タブ対策として、保存時は常にlocalStorageの最新値とマージする。
 */
(function () {
  "use strict";

  var STORAGE_KEY = "awsarchi.state.v1";
  var SITE_TITLE = "AWS Architecture Patterns";
  var cases = (window.AWS_CASES || []).slice().sort(function (a, b) { return a.id - b.id; });
  var caseById = {};
  cases.forEach(function (c) { caseById[c.id] = c; });

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return { done: parsed.done || {}, lastCase: parsed.lastCase || null };
        }
      }
    } catch (e) { /* 壊れた保存データは無視 */ }
    return { done: {}, lastCase: null };
  }
  var state = loadState();

  function persist(obj) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch (e) { /* 無視 */ }
  }

  /**
   * 通常保存。他タブが先に保存した読了チェックを消さないよう、
   * localStorageの最新値を再読込し、doneは「最新とメモリの和集合」、
   * lastCaseはメモリ側を採用して保存する。
   */
  function saveState() {
    var latest = loadState();
    var merged = {};
    Object.keys(latest.done).forEach(function (k) { merged[k] = true; });
    Object.keys(state.done).forEach(function (k) { merged[k] = true; });
    state.done = merged;
    persist({ done: merged, lastCase: state.lastCase });
  }

  /**
   * 読了チェックの変更専用の保存。
   * 和集合マージだとチェックを外す操作が他タブの値で復活してしまうため、
   * 最新値を読み込んだ上で該当idのみを確定的に更新し、メモリへ反映して保存する。
   */
  function setDone(id, checked) {
    var latest = loadState();
    var done = latest.done;
    // メモリ側にだけあるチェックも失わないようマージしてから該当idを確定する
    Object.keys(state.done).forEach(function (k) { done[k] = true; });
    if (checked) done[id] = true; else delete done[id];
    state.done = done;
    persist({ done: done, lastCase: state.lastCase });
  }

  var $ = function (id) { return document.getElementById(id); };
  var elToc = $("toc");
  var elView = $("case-view");
  var elWelcome = $("welcome");
  var elSearch = $("toc-search");
  var current = null;
  var introShown = false;
  var resourcesShown = false;

  // カテゴリ名 → 開閉状態。renderTocの全再構築後も開閉状態を引き継ぐ。
  // toggleイベントは非同期発火で検索中の自動オープンを誤記録するレースがあるため、
  // 再構築の直前に現在のDOMから同期的に取り込む方式にする
  var tocOpen = {};
  var tocForceOpen = null; // 次回描画で必ず開くカテゴリ（ケース遷移先の現在地表示用）
  var tocLastFiltered = false; // 前回描画が検索フィルタ中だったか

  // 検索インデックス（ケースid → 小文字化した検索対象テキスト）。
  // タイトル・カテゴリに加え、推奨・代替パターンのservices[].nameでも検索できるようにする
  var searchIndex = {};
  cases.forEach(function (c) {
    var parts = [c.title || "", c.category || ""];
    var patterns = [c.main].concat(c.alternatives || []);
    patterns.forEach(function (p) {
      if (p && p.services) {
        p.services.forEach(function (s) { if (s.name) parts.push(s.name); });
      }
    });
    searchIndex[c.id] = parts.join(" ").toLowerCase();
  });

  function doneCount() {
    return cases.filter(function (c) { return state.done[c.id]; }).length;
  }

  function renderProgress() {
    $("progress-label").textContent = doneCount() + " / " + cases.length;
    $("progress-fill").style.width = (cases.length ? (doneCount() / cases.length) * 100 : 0) + "%";
    var bar = $("progress-bar");
    if (bar) {
      bar.setAttribute("aria-valuemax", String(cases.length));
      bar.setAttribute("aria-valuenow", String(doneCount()));
    }
  }

  function setTitle(prefix) {
    document.title = prefix ? prefix + "｜" + SITE_TITLE : SITE_TITLE;
  }

  /** 遷移後にメイン見出しへフォーカスを移し、スクリーンリーダーに画面の変化を伝える */
  function focusHeading(container) {
    var heading = container.querySelector("h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      try { heading.focus({ preventScroll: true }); } catch (e) { heading.focus(); }
    }
  }

  function renderToc() {
    var query = elSearch ? elSearch.value.trim().toLowerCase() : "";
    var filtering = query !== "";
    var visible = filtering
      ? cases.filter(function (c) { return searchIndex[c.id].indexOf(query) !== -1; })
      : cases;

    // 前回が通常表示のときだけ、ユーザーの開閉状態を現在のDOMから引き継ぐ
    // （検索中の自動オープン状態を誤って記録しないため）
    if (!tocLastFiltered) {
      Array.prototype.forEach.call(elToc.querySelectorAll("details.toc-chapter"), function (d) {
        var s = d.querySelector("summary");
        if (s) tocOpen[s.textContent] = d.open;
      });
    }
    if (tocForceOpen) {
      tocOpen[tocForceOpen] = true;
      tocForceOpen = null;
    }
    tocLastFiltered = filtering;

    elToc.innerHTML = "";
    if (window.AWS_INTRO) {
      var a = document.createElement("a");
      a.href = "#intro";
      a.className = "toc-intro" + (introShown ? " active" : "");
      a.textContent = window.AWS_INTRO.tocTitle || "はじめに";
      elToc.appendChild(a);
    }
    var categories = [];
    visible.forEach(function (c) {
      if (categories.indexOf(c.category) === -1) categories.push(c.category);
    });
    if (filtering && visible.length === 0) {
      var empty = document.createElement("p");
      empty.className = "toc-empty";
      empty.textContent = "「" + (elSearch ? elSearch.value.trim() : "") + "」に一致するケースはありません";
      elToc.appendChild(empty);
    }
    categories.forEach(function (cat) {
      var details = document.createElement("details");
      details.className = "toc-chapter";
      if (filtering) {
        // 検索中は一致ケースを見せるため該当カテゴリを自動オープンする
        details.open = true;
      } else if (Object.prototype.hasOwnProperty.call(tocOpen, cat)) {
        details.open = tocOpen[cat];
      } else {
        details.open = !!(current && current.category === cat);
      }
      var summary = document.createElement("summary");
      summary.textContent = cat;
      details.appendChild(summary);
      var ul = document.createElement("ul");
      visible.filter(function (c) { return c.category === cat; }).forEach(function (c) {
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
    if (window.AWS_RESOURCES) {
      var r = document.createElement("a");
      r.href = "#resources";
      r.className = "toc-intro toc-resources" + (resourcesShown ? " active" : "");
      r.textContent = window.AWS_RESOURCES.tocTitle || "参考資料リスト";
      elToc.appendChild(r);
    }
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
    if (p.diagram) html += '<div class="diagram-wrap">' + AwsDiagram.render(p.diagram, p.name) + "</div>";
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
    if (p.cost) {
      html += '<h4>費用感の目安</h4><p class="pattern-cost">' + h(p.cost) + "</p>";
    }
    if (p.references) {
      html += "<h4>公式ドキュメント・参考資料</h4>" + refsHtml(p.references);
    }
    html += "</section>";
    return html;
  }

  /**
   * 本文中の「ケースN」（N=1〜50）を該当ケースへのリンクに置換する。
   * - 直後に数字が続くもの（ケース123等）は対象外
   * - 「ケース 12 / 50」のような半角スペース入りのブレッドクラムは対象外
   * - SVG（構成図）内部はアンカー挿入で壊れるため置換しない
   */
  function linkCaseRefs(html) {
    return html.split(/(<svg[\s\S]*?<\/svg>)/).map(function (part) {
      if (part.lastIndexOf("<svg", 0) === 0) return part;
      return part.replace(/ケース(50|[1-4][0-9]|[1-9])(?![0-9])/g, function (m, n) {
        return '<a href="#case-' + n + '">ケース' + n + "</a>";
      });
    }).join("");
  }

  function showCase(id) {
    var c = caseById[id];
    if (!c) return;
    var prevCategory = current ? current.category : null;
    current = c;
    introShown = false;
    resourcesShown = false;
    state.lastCase = id;
    saveState();
    // 別カテゴリへの遷移時は、移動先のカテゴリを開いて現在地を見せる
    // （同一カテゴリ内の再描画ではユーザーの開閉状態を尊重する）
    if (c.category !== prevCategory) tocForceOpen = c.category;
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

    // 端のケースでは行き止まりに見えないよう「はじめに」「参考資料リスト」へ誘導する
    var hasPrevCase = !!caseById[c.id - 1];
    var hasNextCase = !!caseById[c.id + 1];
    var prevLabel = hasPrevCase ? "前のケース" : "はじめに";
    var nextLabel = hasNextCase ? "次のケース" : "参考資料リストへ";
    var prevDisabled = !hasPrevCase && !window.AWS_INTRO;
    var nextDisabled = !hasNextCase && !window.AWS_RESOURCES;

    html += '<nav id="case-nav" aria-label="ケース移動">';
    html += '<button id="btn-prev"' + (prevDisabled ? " disabled" : "") + ">" + prevLabel + "</button>";
    html += '<label id="done-toggle"><input type="checkbox" id="chk-done"' +
      (state.done[c.id] ? " checked" : "") + "> 読んだ</label>";
    html += '<button id="btn-next" class="primary"' + (nextDisabled ? " disabled" : "") + ">" + nextLabel + "</button>";
    html += "</nav>";

    elView.innerHTML = linkCaseRefs(html);

    $("btn-prev").addEventListener("click", function () {
      if (hasPrevCase) location.hash = "#case-" + (c.id - 1);
      else if (window.AWS_INTRO) location.hash = "#intro";
    });
    $("btn-next").addEventListener("click", function () {
      if (hasNextCase) location.hash = "#case-" + (c.id + 1);
      else if (window.AWS_RESOURCES) location.hash = "#resources";
    });
    $("chk-done").addEventListener("change", function () {
      setDone(c.id, this.checked);
      renderToc(); renderProgress();
    });

    renderToc();
    renderProgress();
    setTitle("ケース" + c.id + " " + c.title);
    window.scrollTo(0, 0);
    $("main").scrollTop = 0;
    focusHeading(elView);
  }

  function showIntro() {
    var intro = window.AWS_INTRO;
    if (!intro) return;
    introShown = true;
    resourcesShown = false;
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
    setTitle(intro.tocTitle || "はじめに");
    window.scrollTo(0, 0);
    $("main").scrollTop = 0;
    focusHeading(elWelcome);
  }

  function showResources() {
    var res = window.AWS_RESOURCES;
    if (!res) return;
    resourcesShown = true;
    introShown = false;
    current = null;
    elView.hidden = true;
    elWelcome.hidden = false;
    elWelcome.innerHTML = "";
    var page = document.createElement("div");
    page.className = "intro-page";
    page.innerHTML = res.content;
    elWelcome.appendChild(page);
    renderToc();
    setTitle(res.tocTitle || "参考資料リスト");
    window.scrollTo(0, 0);
    $("main").scrollTop = 0;
    focusHeading(elWelcome);
  }

  window.addEventListener("hashchange", function () {
    var m = location.hash.match(/^#case-(\d+)$/);
    if (m) showCase(Number(m[1]));
    else if (location.hash === "#intro") showIntro();
    else if (location.hash === "#resources") showResources();
  });

  // 他タブでの読了チェック変更を取り込んで表示へ反映する
  window.addEventListener("storage", function (e) {
    if (e.key !== null && e.key !== STORAGE_KEY) return;
    state.done = loadState().done;
    renderToc();
    renderProgress();
    var chk = $("chk-done");
    if (chk && current) chk.checked = !!state.done[current.id];
  });

  if (elSearch) {
    elSearch.addEventListener("input", function () { renderToc(); });
  }

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
