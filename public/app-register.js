/**
 * 教材データ登録用のグローバル関数。
 * 各content/caseNN.jsがregisterCase()を呼んでケースを登録する。
 */
window.AWS_CASES = [];
window.AWS_INTRO = null;
window.AWS_RESOURCES = null;

function registerCase(c) {
  window.AWS_CASES.push(c);
}

function registerIntro(intro) {
  window.AWS_INTRO = intro;
}

function registerResources(r) {
  window.AWS_RESOURCES = r;
}
