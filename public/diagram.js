/**
 * AWS構成図レンダラー
 *
 * JSON仕様（nodes/groups/edges）からAWS公式スタイルのSVG構成図を生成する。
 * - アイコンは公式Architecture Icons（icons/配下に同梱）を<image>で参照
 * - グループ枠の色・線種は公式ツールキットの規定に準拠
 * - 座標はグリッド指定（1セル=colW x rowH）で、教材データ側の記述を簡単にする
 *
 * 仕様例：
 * {
 *   cols: 6, rows: 3,
 *   nodes: [{id:"users", icon:"resources/users", label:"ユーザー", col:0, row:1}],
 *   groups: [{type:"aws-cloud", from:[1,0], to:[5,2], label:"AWS Cloud"}],
 *   edges: [{from:"users", to:"cf", label:"HTTPS"}]
 * }
 */
(function () {
  "use strict";

  var COL_W = 170;
  var ROW_H = 150;
  var ICON = 56;
  var PAD = 26; // グループ枠のグリッドからの内側余白の基準
  var INSET_STEP = 14; // 入れ子1段ごとに枠を内側へ寄せる量

  // 公式グループスタイル（色は公式グループアイコンSVGから抽出した値）
  var GROUP_STYLES = {
    "aws-cloud":      { color: "#242F3E", dash: null, icon: "groups/AWS-Cloud_32.svg", fill: "none" },
    "region":         { color: "#00A4A6", dash: "6 3", icon: "groups/Region_32.svg", fill: "none" },
    "vpc":            { color: "#8C4FFF", dash: null, icon: "groups/Virtual-private-cloud-VPC_32.svg", fill: "none" },
    "az":             { color: "#0972D3", dash: "6 3", icon: null, fill: "none" },
    "public-subnet":  { color: "#7AA116", dash: null, icon: "groups/Public-subnet_32.svg", fill: "rgba(122,161,22,0.06)" },
    "private-subnet": { color: "#00A4A6", dash: null, icon: "groups/Private-subnet_32.svg", fill: "rgba(0,164,166,0.06)" },
    "auto-scaling":   { color: "#ED7100", dash: "6 3", icon: "groups/Auto-Scaling-group_32.svg", fill: "none" },
    "onpremise":      { color: "#7D8998", dash: null, icon: "groups/Corporate-data-center_32.svg", fill: "none" },
    "account":        { color: "#CD2264", dash: null, icon: "groups/AWS-Account_32.svg", fill: "none" },
    "generic":        { color: "#7D8998", dash: "4 3", icon: null, fill: "none" },
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ノード中心座標（グリッド→px）。ネスト深さに応じたオフセットは簡略化し、
  // グリッド自体に余白を織り込む設計とする
  function cx(col) { return 40 + col * COL_W + COL_W / 2; }
  function cy(row) { return 30 + row * ROW_H + ROW_H / 2; }

  function nodeSvg(n) {
    var x = cx(n.col) - ICON / 2;
    var y = cy(n.row) - ICON / 2 - 8;
    var lines = String(n.label || "").split("\n");
    var label = lines.map(function (line, i) {
      return '<tspan x="' + cx(n.col) + '" dy="' + (i === 0 ? 0 : 13) + '">' + esc(line) + "</tspan>";
    }).join("");
    return (
      '<image href="icons/' + esc(n.icon) + '.svg" x="' + x + '" y="' + y +
      '" width="' + ICON + '" height="' + ICON + '"/>' +
      '<text class="dg-label" x="' + cx(n.col) + '" y="' + (y + ICON + 16) +
      '" text-anchor="middle">' + label + "</text>"
    );
  }

  function groupSvg(g, depth) {
    var st = GROUP_STYLES[g.type] || GROUP_STYLES.generic;
    var inset = depth * INSET_STEP;
    var x = 40 + g.from[0] * COL_W + inset - PAD;
    var y = 30 + g.from[1] * ROW_H + inset - PAD + 14;
    var w = (g.to[0] - g.from[0] + 1) * COL_W - inset * 2 + PAD * 2 - 20;
    var h = (g.to[1] - g.from[1] + 1) * ROW_H - inset * 2 + PAD * 2 - 34;
    var head = "";
    var labelX = x + 8;
    var iconW = 0;
    if (st.icon) {
      head = '<image href="icons/' + st.icon + '" x="' + x + '" y="' + y + '" width="26" height="26"/>';
      labelX = x + 32;
      iconW = 32;
    }
    // ラベルが枠幅に収まるようフォントを段階的に縮小し、
    // それでも収まらない場合はtextLengthで字間を詰めて枠外へのはみ出しを防ぐ
    // （全角文字の幅はほぼフォントサイズと同じとみなして概算する）
    var label = String(g.label || "");
    var avail = w - iconW - 12;
    var font = 12;
    if (label.length * font > avail) font = 11;
    if (label.length * font > avail) font = 10;
    var fit = "";
    if (avail > 0 && label.length * font > avail) {
      fit = ' textLength="' + avail + '" lengthAdjust="spacingAndGlyphs"';
    }
    return (
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" fill="' + (st.fill || "none") + '" stroke="' + st.color + '" stroke-width="1.6"' +
      (st.dash ? ' stroke-dasharray="' + st.dash + '"' : "") + ' rx="2"/>' +
      head +
      '<text class="dg-group-label" x="' + labelX + '" y="' + (y + 18) +
      '" style="font-size:' + font + 'px" fill="' + st.color + '"' + fit + ">" +
      esc(label) + "</text>"
    );
  }

  function edgeSvg(e, nodeMap) {
    var a = nodeMap[e.from];
    var b = nodeMap[e.to];
    if (!a || !b) return "";
    var x1 = cx(a.col), y1 = cy(a.row) - 8;
    var x2 = cx(b.col), y2 = cy(b.row) - 8;
    // アイコンの縁から矢印を出す（中心間ベクトルを縮める）
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var off = ICON / 2 + 8;
    var sx = x1 + (dx / len) * off, sy = y1 + (dy / len) * off;
    var ex = x2 - (dx / len) * (off + 4), ey = y2 - (dy / len) * (off + 4);
    var mx = (sx + ex) / 2, my = (sy + ey) / 2;
    var dashed = e.dashed ? ' stroke-dasharray="5 4"' : "";
    var marker = e.noArrow ? "" : ' marker-end="url(#dg-arrow)"';
    // 縦向きのエッジはラベルを線の真上に置くと下段ノードのラベルと重なるため、
    // 線の右横に出す。横・斜めのエッジは中点の少し上に置く
    var vertical = Math.abs(dx) < 20;
    var label = "";
    if (e.label) {
      label = vertical
        ? '<text class="dg-edge-label" x="' + (mx + 10) + '" y="' + (my + 4) + '" text-anchor="start">' + esc(e.label) + "</text>"
        : '<text class="dg-edge-label" x="' + mx + '" y="' + (my - 6) + '" text-anchor="middle">' + esc(e.label) + "</text>";
    }
    return (
      '<line x1="' + sx + '" y1="' + sy + '" x2="' + ex + '" y2="' + ey +
      '" stroke="#545B64" stroke-width="1.4"' + dashed + marker + "/>" + label
    );
  }

  /**
   * 構成図SVGを生成する。
   * @param {Object} spec 図のJSON仕様（nodes/groups/edges）
   * @param {string} [title] パターン名。SVGの代替テキスト（aria-label）に使う
   */
  function render(spec, title) {
    var cols = spec.cols || (Math.max.apply(null, spec.nodes.map(function (n) { return n.col; })) + 1);
    var rows = spec.rows || (Math.max.apply(null, spec.nodes.map(function (n) { return n.row; })) + 1);
    var width = 80 + cols * COL_W;
    var height = 70 + rows * ROW_H;

    var nodeMap = {};
    spec.nodes.forEach(function (n) { nodeMap[n.id] = n; });

    var groups = (spec.groups || []).map(function (g, i) {
      return groupSvg(g, g.depth != null ? g.depth : 0);
    }).join("");
    var edges = (spec.edges || []).map(function (e) { return edgeSvg(e, nodeMap); }).join("");
    var nodes = spec.nodes.map(nodeSvg).join("");

    return (
      '<svg class="dg" viewBox="0 0 ' + width + " " + height + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      esc(title ? "構成図：" + title : "AWS構成図") + '">' +
      '<defs><marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" fill="#545B64"/></marker></defs>' +
      groups + edges + nodes +
      "</svg>"
    );
  }

  window.AwsDiagram = { render: render };
})();
