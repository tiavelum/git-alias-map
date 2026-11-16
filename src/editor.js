// Renders the editor page as one HTML file: the alias data, the functions
// of aliases.js and the page script are embedded, so the file opens in any
// browser without a server or a network.

import { GIT_CALL, BROWSER_FUNCTIONS } from "./aliases.js";
import { pageScript } from "./page-script.js";

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const CSS = `
:root{--bg:#faf9f5;--card:#fff;--line:#e3e0d6;--line2:#cfcbbf;--text:#1f1e1b;--muted:#6b6960;--accent:#1f5fa8;--accbg:#e6f0fb;
--o1b:#d3efe4;--o1t:#0b4f3e;--o2b:#e4e0fb;--o2t:#3c3489;--o3b:#fae4bd;--o3t:#633806;--o4b:#f6d5e2;--o4t:#72243e;
--addb:#e2f1d3;--addt:#2d5a0c;--warnb:#fbe3e3;--warnt:#8c2222;--hintb:#f3f1ea;--hintt:#5f5e5a;--renb:#efe3fa;--rent:#5b2b8a;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:var(--text);background:var(--bg)}
@media (prefers-color-scheme:dark){:root{--bg:#1d1c1a;--card:#262522;--line:#3a3935;--line2:#4d4b46;--text:#ecebe6;--muted:#a3a198;--accent:#8ab8ef;--accbg:#1c3550;
--o1b:#0d3f33;--o1t:#a4e3cd;--o2b:#2f2a68;--o2t:#cdc8f6;--o3b:#5a3608;--o3t:#fad48f;--o4b:#5e1f38;--o4t:#f4bfd3;
--addb:#24400c;--addt:#c5e59e;--warnb:#5a1a1a;--warnt:#f6b9b9;--hintb:#33322e;--hintt:#c9c7bd;--renb:#3d2258;--rent:#dcc2f5}}
*{box-sizing:border-box}html{scrollbar-gutter:stable}body{margin:0;padding:20px;max-width:1180px;margin-inline:auto;line-height:1.5}
h1{font-size:20px;font-weight:600;margin:0}.src{color:var(--muted);font-size:13px;margin:2px 0 14px}
code,.nm,.vl,textarea,input#e-name{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
button{font:inherit;font-size:13px;padding:5px 11px;border-radius:7px;border:1px solid var(--line2);background:var(--card);color:var(--text);cursor:pointer}
button:hover{border-color:var(--muted)}button:disabled{opacity:.5;cursor:default}button[aria-pressed=true]{background:var(--accbg);border-color:var(--accent);color:var(--accent);font-weight:600}
button.mini{font-size:12px;padding:1px 8px;margin-left:auto}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}.bar .sp{flex:1}
#q{font:inherit;font-size:13px;padding:5px 10px;border-radius:7px;border:1px solid var(--line2);background:var(--card);color:var(--text);min-width:200px}
.st{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px;margin:0 0 12px}
.sc{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 10px}.sc .k{font-size:12px;color:var(--muted)}.sc .v{font-size:22px;font-weight:600}
.sc .k0{font-size:11px;color:var(--muted)}.dl{font-size:13px;font-weight:500;color:var(--accent)}
.panel{border-radius:10px;padding:8px 12px;margin:0 0 10px;font-size:13px;border:1px solid var(--line)}.panel ul{margin:4px 0 0;padding-left:18px}
.panel.bad{background:var(--warnb);color:var(--warnt);border-color:transparent}.panel.hint{background:var(--hintb);color:var(--hintt)}
.gr{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:10px;align-items:start}
.cd{border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:var(--card)}.cd.bad{border-color:var(--warnt)}.cd.new{border-color:var(--accent)}.cd.gone{border-style:dashed}
.rt{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:14px;font-weight:600;display:flex;justify-content:space-between;align-items:center;height:26px;border-bottom:1px solid var(--line);margin-bottom:4px}
.rt span{font-family:inherit;font-weight:400;font-size:12px;color:var(--muted)}
.status{height:34px;line-height:34px;padding:0 12px;margin:0 0 10px;border-radius:10px;background:var(--accbg);color:var(--accent);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#below{margin-top:12px}.row.empty{color:var(--muted);font-style:italic;font-size:12px}
.row{display:flex;align-items:center;gap:6px;font-size:13px;height:24px;border-radius:6px;padding-right:4px;min-width:0;flex-wrap:nowrap;overflow:hidden}.row>*{flex-shrink:0}.row>.vl{flex-shrink:1;min-width:30px}
.row.ed{cursor:pointer}.row.ed:hover{background:var(--hintb)}.row.sel{background:var(--accbg)}.row.dim{opacity:.35}.row:focus-visible{outline:2px solid var(--accent)}
.bd{font-size:11px;min-width:18px;text-align:center;border-radius:4px;padding:0 4px;font-weight:600;display:inline-block;line-height:1.6}
.o1{background:var(--o1b);color:var(--o1t)}.o2{background:var(--o2b);color:var(--o2t)}.o3{background:var(--o3b);color:var(--o3t)}.o4{background:var(--o4b);color:var(--o4t)}
.vl{font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}.rn{font-size:11.5px;color:var(--muted);font-style:italic}
.al,.was{font-size:11.5px;color:var(--muted)}.was{font-style:italic}.strike{text-decoration:line-through;color:var(--muted)}
.tag{font-size:11px;border-radius:4px;padding:0 5px;white-space:nowrap}.t-add,.t-added{background:var(--addb);color:var(--addt)}.t-ed,.t-changed{background:var(--accbg);color:var(--accent)}
.t-ren,.t-renamed{background:var(--renb);color:var(--rent)}.t-warn,.t-removed{background:var(--warnb);color:var(--warnt)}.t-hint{background:var(--hintb);color:var(--hintt);border:1px dashed var(--line2)}
.editor{border:1px solid var(--accent);border-radius:10px;padding:10px;margin:4px 0 8px;background:var(--bg);font-size:13px}
.ef{display:flex;flex-direction:column;gap:2px;margin-bottom:8px}.ef label{font-size:12px;color:var(--muted)}
.ef input,.ef textarea{font-size:13px;padding:6px 8px;border-radius:6px;border:1px solid var(--line2);background:var(--card);color:var(--text);width:100%;resize:vertical}
.chk{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted);margin-bottom:6px}.info{margin:4px 0;color:var(--muted);font-size:12px}
.err{color:var(--warnt);font-size:13px;margin:4px 0}.btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.muted{color:var(--muted)}
.chg{display:flex;flex-direction:column;gap:6px}.ci{display:flex;gap:10px;align-items:baseline;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:13px}
.ci .cn{min-width:150px;font-weight:600}.ci .cv{flex:1;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;word-break:break-all}.ci .cv s{text-decoration-color:var(--muted);color:var(--muted)}
#export{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:12px}#export textarea{width:100%;font-size:12px;border-radius:6px;border:1px solid var(--line2);background:var(--bg);color:var(--text);padding:8px}
#export h2{font-size:14px;margin:4px 0;display:flex;justify-content:space-between;align-items:center}#export p{font-size:12px;color:var(--muted);margin:2px 0 6px}
.legend{font-size:12px;color:var(--muted);display:flex;flex-wrap:wrap;gap:10px;margin:0 0 10px;align-items:center}
`;

// JSON is valid JavaScript; escaping "<" keeps "</script>" in a value from
// ending the script element early.
const embedJson = (data) => JSON.stringify(data).replace(/</g, "\\u003c");

// data: { aliases: [[name, value]], natives: [git command], comments:
// { name: [comment line] }, file: label of the file, src: label of its
// version, key: changes whenever the aliases change }.
export function editorPage(data) {
  const embedded = {
    a: data.aliases,
    n: data.natives,
    c: data.comments,
    file: data.file,
    src: data.src,
    key: data.key,
  };
  const functions = [
    `const GIT_CALL = ${GIT_CALL};`,
    ...BROWSER_FUNCTIONS.map((f) => f.toString()),
  ].join("\n\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Git alias editor</title>
<style>${CSS}</style>
</head>
<body>
<h1>Git alias editor</h1>
<p class="src">Compares the aliases of <code>${escapeHtml(data.file)}</code> at ${escapeHtml(data.src)} with a draft you change. The draft stays in this browser only; Export gives the result.</p>
<div class="bar" role="toolbar" aria-label="Views and actions">
  <button data-view="draft" aria-pressed="true">Draft</button>
  <button data-view="current" aria-pressed="false">Current file</button>
  <button data-view="changes" aria-pressed="false">Changes<span id="nchg"></span></button>
  <input id="q" type="search" placeholder="Filter by name or value" aria-label="Filter aliases">
  <span class="sp"></span>
  <button data-act="add">Add alias</button>
  <button data-act="undo" id="undo">Undo</button>
  <button data-act="clear">Clear all changes</button>
  <button data-act="export">Export</button>
</div>
<div id="export" hidden>
  <h2>[alias] section <button class="mini" data-act="copy" data-x="#ex-block">Copy</button></h2>
  <p>Replaces the whole [alias] section of the file, sorted by name, with the comments that stood above aliases still in it.</p>
  <textarea id="ex-block" rows="10" readonly spellcheck="false"></textarea>
  <h2>Change list <button class="mini" data-act="copy" data-x="#ex-list">Copy</button></h2>
  <p>Every change of the draft, one per line, to paste into an issue, a pull request or a chat.</p>
  <textarea id="ex-list" rows="6" readonly spellcheck="false"></textarea>
</div>
<div class="st" id="stats"></div>
<div class="status" id="status" role="status"></div>
<div class="legend">Order: <span class="bd o1">1</span> calls git <span class="bd o2">2</span> <span class="bd o3">3</span> <span class="bd o4">4+</span> alias hops ·
  <span class="tag t-add">+ added</span><span class="tag t-ed">edited</span><span class="tag t-ren">renamed</span><span class="tag t-warn">! problem</span><span class="tag t-hint">rename of a rename</span> · Click an alias in the draft to edit it.</div>
<div id="main"></div>
<div id="below"></div>
<script>const DATA = ${embedJson(embedded)};</script>
<script>${functions}</script>
<script>(${pageScript.toString()})();</script>
</body>
</html>
`;
}
