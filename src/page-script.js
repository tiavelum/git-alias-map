// The editor page's behaviour in the browser. editor.js embeds the source
// of pageScript() after the alias data (DATA) and the functions of
// aliases.js, which it uses as globals of the page.

/* global DATA, analyze, diff, exportBlock, renameAlias, removeAlias, flattenChains */

export function pageScript() {
  const NAT = new Set(DATA.n);
  const BASE = Object.fromEntries(DATA.a);
  const COMMENTS = DATA.c;
  const KEY = "git-alias-editor-draft";
  // Rows and card chrome have fixed heights, so a card can be made as tall
  // as its larger version and both views line up.
  const ROW = 24,
    CARD_CHROME = 48;
  const $ = (s) => document.querySelector(s);
  const h = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const S = {
    draft: { ...BASE },
    renamedFrom: {},
    view: "draft",
    sel: null,
    q: "",
    hist: [],
    notice: "",
    exportOpen: false,
    focusEd: false,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && saved.key === DATA.key) {
      S.draft = saved.draft;
      S.renamedFrom = saved.renamedFrom || {};
    }
  } catch {
    // Without storage the page starts from the file, as on a first visit.
  }
  function persist() {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          key: DATA.key,
          draft: S.draft,
          renamedFrom: S.renamedFrom,
        }),
      );
    } catch {
      // Without storage the draft lasts until the page closes.
    }
  }

  // Places every alias under the root its longest chain ends in, depth first.
  function layout(a) {
    const kids = {},
      roots = {};
    for (const n of a.names) {
      const p = a.primary[n],
        bucket = p.t === "alias" ? kids : roots;
      (bucket[p.x] = bucket[p.x] || []).push(n);
    }
    const placed = new Set(),
      groups = new Map();
    const walk = (n, d, list) => {
      if (placed.has(n)) return;
      placed.add(n);
      list.push({ n, d });
      for (const k of (kids[n] || []).sort()) walk(k, d + 1, list);
    };
    for (const r of Object.keys(roots)) {
      const list = [];
      for (const n of roots[r].sort()) walk(n, 0, list);
      groups.set(r, list);
    }
    return { groups, loose: a.names.filter((n) => !placed.has(n)).sort() };
  }

  const A0 = analyze(BASE, NAT);
  const L0 = layout(A0);
  const ROOT_ORDER = [...L0.groups.keys()].sort(
    (a, b) =>
      L0.groups.get(b).length - L0.groups.get(a).length || (a < b ? -1 : 1),
  );

  function mutate(fn, notice) {
    S.hist.push({ draft: S.draft, renamedFrom: S.renamedFrom });
    if (S.hist.length > 100) S.hist.shift();
    fn();
    S.notice = notice || "";
    persist();
    render();
  }

  function removedNames() {
    const renamedOld = new Set(Object.values(S.renamedFrom));
    return Object.keys(BASE)
      .filter((n) => !(n in S.draft) && !renamedOld.has(n))
      .sort();
  }
  function renamedTo(old) {
    return Object.keys(S.renamedFrom).find(
      (k) => S.renamedFrom[k] === old && k in S.draft,
    );
  }

  function tagsFor(n, a) {
    const t = [];
    if (S.view === "draft") {
      const old = S.renamedFrom[n];
      if (old && old in BASE && !(n in BASE))
        t.push(`<span class="tag t-ren">renamed from ${h(old)}</span>`);
      else if (!(n in BASE)) t.push('<span class="tag t-add">+ added</span>');
      else if (BASE[n] !== S.draft[n])
        t.push('<span class="tag t-ed">edited</span>');
    } else {
      const to = renamedTo(n);
      if (to) t.push(`<span class="tag t-ren">renamed to ${h(to)}</span>`);
      else if (!(n in S.draft))
        t.push('<span class="tag t-removed">− removed in draft</span>');
      else if (BASE[n] !== S.draft[n])
        t.push('<span class="tag t-ed">edited in draft</span>');
    }
    const label = {
      missing: "calls a missing name",
      cycle: "loop",
      shadow: "ignored by git",
      chain: "rename of a rename",
    };
    for (const k of new Set(
      a.warnings.filter((w) => w.n === n).map((w) => w.kind),
    ))
      t.push(
        `<span class="tag ${k === "chain" ? "t-hint" : "t-warn"}">${k === "chain" ? "" : "! "}${label[k]}</span>`,
      );
    return t.join("");
  }

  function rowHtml(a, ad, n, depth) {
    const editable = S.view === "draft";
    const map = editable ? S.draft : BASE,
      o = a.order[n],
      v = map[n];
    const other = editable ? A0 : ad,
      otherName = editable ? S.renamedFrom[n] || n : renamedTo(n) || n;
    const oo = other.order[otherName];
    const was =
      oo != null && oo !== o
        ? `<span class="was">${editable ? "was" : "draft"} ${oo}</span>`
        : "";
    const val = a.rename[n]
      ? '<span class="rn">rename</span>'
      : `<span class="vl" title="${h(v)}">${h(v.startsWith("!") ? "! shell" : v)}</span>`;
    const also = a.also[n].length
      ? `<span class="al">+ ${a.also[n].map(h).join(", ")}</span>`
      : "";
    const q = S.q.toLowerCase(),
      hit = !q || n.toLowerCase().includes(q) || v.toLowerCase().includes(q);
    let out = `<div class="row${editable ? " ed" : ""}${hit ? "" : " dim"}${S.sel === n ? " sel" : ""}" style="padding-left:${depth * 16 + 4}px" data-n="${h(n)}" ${editable ? 'tabindex="0" role="button"' : ""}>
      <span class="bd o${Math.min(o, 4)}" title="order ${o}">${o}</span><span class="nm">${h(n)}</span>${val}${also}${was}${tagsFor(n, a)}</div>`;
    if (editable && S.sel === n) out += editorHtml(a, n, depth);
    return out;
  }

  function editorHtml(a, n, depth) {
    const isNew = n === "__new__";
    const v = isNew ? "" : S.draft[n];
    const calls = isNew
      ? []
      : a.refs[n].map((r) => `${h(r.x)} <span class="muted">(${r.t})</span>`);
    const deps = isNew ? [] : a.dependents[n];
    const single =
      !isNew && !v.startsWith("!") && v.trim().split(/\s+/).length === 1;
    let delNote = "";
    if (!isNew && deps.length) {
      const shellDeps = deps.filter((d) => S.draft[d].startsWith("!"));
      delNote = single
        ? `Deleting points ${deps.length === 1 ? "its caller" : `its ${deps.length} callers`} at <code>${h(v.trim())}</code>.`
        : v.startsWith("!")
          ? `Deleting breaks ${deps.map(h).join(", ")}.`
          : `Deleting writes its value into ${
              deps
                .filter((d) => !S.draft[d].startsWith("!"))
                .map(h)
                .join(", ") || "no caller"
            }${shellDeps.length ? `, and breaks ${shellDeps.map(h).join(", ")}` : ""}.`;
    }
    return `<div class="editor" style="margin-left:${depth * 16 + 4}px">
      <div class="ef"><label for="e-name">Name</label><input id="e-name" value="${h(isNew ? "" : n)}" spellcheck="false" autocomplete="off"></div>
      <div class="ef"><label for="e-val">Value</label><textarea id="e-val" rows="${Math.min(6, Math.max(2, Math.ceil(v.length / 60)))}" spellcheck="false">${h(v)}</textarea></div>
      ${isNew ? "" : `<label class="chk"><input type="checkbox" id="e-upd" checked> When renaming, update the aliases that call it</label>`}
      ${isNew ? "" : `<p class="info">Calls: ${calls.join(", ") || "nothing"} · Called by: ${deps.length ? deps.map(h).join(", ") : "nobody"}</p>`}
      ${delNote ? `<p class="info">${delNote}</p>` : ""}
      <div class="btns"><button data-act="save">${isNew ? "Add" : "Save"}</button>
      ${isNew ? "" : '<button data-act="delete">Delete</button>'}
      ${!isNew && n in BASE && BASE[n] !== S.draft[n] ? '<button data-act="revert-one">Back to current value</button>' : ""}
      <button data-act="cancel">Cancel</button></div></div>`;
  }

  // Both views draw the same cards in the same order, each as tall as its
  // larger version, so switching between them moves nothing.
  function cardsHtml(a, ad) {
    const Ld = layout(ad);
    const keys = [...new Set([...L0.groups.keys(), ...Ld.groups.keys()])].sort(
      (x, y) => {
        const ix = ROOT_ORDER.indexOf(x),
          iy = ROOT_ORDER.indexOf(y);
        return (ix < 0 ? 1e9 : ix) - (iy < 0 ? 1e9 : iy) || (x < y ? -1 : 1);
      },
    );
    const L = S.view === "draft" ? Ld : L0;
    const card = (title, rowsHtml, count, maxRows, cls = "") =>
      `<div class="cd ${cls}" style="min-height:${CARD_CHROME + maxRows * ROW}px"><div class="rt">${h(title)}<span>${count} alias${count === 1 ? "" : "es"}</span></div>${rowsHtml}</div>`;
    let out = "";
    for (const k of keys) {
      const list = L.groups.get(k) || [];
      const maxRows = Math.max(
        (L0.groups.get(k) || []).length,
        (Ld.groups.get(k) || []).length,
      );
      out += card(
        k,
        list.map((x) => rowHtml(a, ad, x.n, x.d)).join("") ||
          '<div class="row empty">no aliases in this version</div>',
        list.length,
        maxRows,
        k.startsWith("missing: ") ? "bad" : "",
      );
    }
    const removed = removedNames();
    if (removed.length) {
      const rows = removed
        .map((n) =>
          S.view === "draft"
            ? `<div class="row"><span class="nm strike">${h(n)}</span><span class="vl" title="${h(BASE[n])}">${h(BASE[n])}</span><button class="mini" data-act="restore" data-x="${h(n)}">Restore</button></div>`
            : `<div class="row"><span class="nm">${h(n)}</span><span class="vl" title="${h(BASE[n])}">${h(BASE[n])}</span><span class="tag t-removed">− removed in draft</span></div>`,
        )
        .join("");
      out += `<div class="cd gone" style="min-height:${CARD_CHROME + removed.length * ROW}px"><div class="rt">Removed in the draft<span>${removed.length}</span></div>${rows}</div>`;
    }
    if (S.view === "draft" && Ld.loose.length)
      out += card(
        "Loops, no root",
        Ld.loose.map((n) => rowHtml(a, ad, n, 0)).join(""),
        Ld.loose.length,
        Ld.loose.length,
        "bad",
      );
    if (S.view === "draft" && S.sel === "__new__")
      out += `<div class="cd new"><div class="rt">New alias</div>${editorHtml(ad, "__new__", 0)}</div>`;
    return out;
  }

  function statsHtml(ad) {
    const draft = S.view !== "current";
    const [s, so] = draft ? [ad.stats, A0.stats] : [A0.stats, ad.stats];
    const ord = (st, k) =>
      k === 4
        ? Object.entries(st.byOrder)
            .filter(([o]) => +o >= 4)
            .reduce((t, [, c]) => t + c, 0)
        : st.byOrder[k] || 0;
    const items = [
      ["Aliases", (st) => st.total],
      ["Behaviours", (st) => st.behaviours],
      ["Pure renames", (st) => st.renames],
      ["Roots", (st) => st.roots],
      ['<span class="bd o1">1</span> order', (st) => ord(st, 1)],
      ['<span class="bd o2">2</span> order', (st) => ord(st, 2)],
      ['<span class="bd o3">3</span> order', (st) => ord(st, 3)],
      ['<span class="bd o4">4+</span> order', (st) => ord(st, 4)],
    ];
    return items
      .map(([k, f]) => {
        const v = f(s),
          vo = f(so),
          d = draft ? v - vo : vo - v;
        return `<div class="sc"><div class="k">${k}</div><div class="v">${v}</div><div class="k0">${draft ? "current" : "draft"} ${vo}${d ? ` <span class="dl">(${d > 0 ? "+" : "−"}${Math.abs(d)})</span>` : ""}</div></div>`;
      })
      .join("");
  }

  function problemsHtml(a) {
    if (S.view !== "draft") return "";
    const probs = a.warnings.filter((w) => w.kind !== "chain"),
      chains = a.warnings.filter((w) => w.kind === "chain");
    let out = "";
    if (probs.length)
      out += `<div class="panel bad"><b>${probs.length} problem${probs.length > 1 ? "s" : ""}</b><ul>${probs.map((w) => `<li><code>${h(w.n)}</code> ${h(w.text)}</li>`).join("")}</ul></div>`;
    if (chains.length)
      out += `<details class="panel hint"><summary><b>${chains.length} rename${chains.length > 1 ? "s" : ""} of a rename</b> · <button class="mini" data-act="flatten">Point all at their final target</button></summary><ul>${chains.map((w) => `<li><code>${h(w.n)}</code> ${h(w.text)}</li>`).join("")}</ul></details>`;
    return out;
  }

  function changesHtml() {
    const d = diff(BASE, S.draft, S.renamedFrom);
    if (!d.length)
      return '<p class="muted">No changes. Edit an alias in the draft view to start one.</p>';
    const label = {
      removed: "− removed",
      added: "+ added",
      changed: "edited",
      renamed: "renamed",
    };
    return `<div class="chg">${d
      .map(
        (
          c,
        ) => `<div class="ci"><span class="tag t-${c.kind}">${label[c.kind]}</span>
      <code class="cn">${c.kind === "renamed" ? `${h(c.old)} → ${h(c.n)}` : h(c.n)}</code>
      <div class="cv">${c.before != null ? `<div><span class="muted">current</span> <s>${h(c.before)}</s></div>` : ""}${c.after != null ? `<div><span class="muted">draft</span> ${h(c.after)}</div>` : ""}</div>
      <button class="mini" data-act="revert-change" data-x="${h(c.n)}" data-k="${c.kind}" data-o="${h(c.old || "")}">Revert</button></div>`,
      )
      .join("")}</div>`;
  }

  function changeList() {
    const d = diff(BASE, S.draft, S.renamedFrom);
    const lines = [
      `Changes to the [alias] section of ${DATA.file} (draft based on ${DATA.src}):`,
    ];
    for (const c of d) {
      if (c.kind === "removed")
        lines.push(`- remove ${c.n} (was: ${c.before})`);
      if (c.kind === "added") lines.push(`- add ${c.n} = ${c.after}`);
      if (c.kind === "changed")
        lines.push(`- change ${c.n}: ${c.before}  →  ${c.after}`);
      if (c.kind === "renamed")
        lines.push(
          `- rename ${c.old} → ${c.n}${c.before !== c.after ? ` and change it: ${c.before}  →  ${c.after}` : ""}`,
        );
    }
    if (!d.length) lines.push("- none");
    return lines.join("\n");
  }

  function statusText(nchg) {
    if (S.view === "current")
      return "Current file, read-only. The tags show what the draft changes.";
    if (S.view === "changes")
      return nchg
        ? `${nchg} change${nchg > 1 ? "s" : ""} against the current file.`
        : "No changes against the current file.";
    if (S.notice) return S.notice;
    return nchg
      ? `Draft: ${nchg} change${nchg > 1 ? "s" : ""} against the current file. Click an alias to edit it.`
      : "Draft: same as the current file. Click an alias to edit it.";
  }

  function render() {
    const ad = analyze(S.draft, NAT),
      a = S.view === "current" ? A0 : ad;
    const nchg = diff(BASE, S.draft, S.renamedFrom).length;
    document
      .querySelectorAll("[data-view]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", b.dataset.view === S.view),
      );
    $("#nchg").textContent = nchg ? ` (${nchg})` : "";
    $("#undo").disabled = !S.hist.length;
    $("#stats").innerHTML = statsHtml(ad);
    $("#status").innerHTML = statusText(nchg);
    $("#export").hidden = !S.exportOpen;
    if (S.exportOpen) {
      $("#ex-block").value = exportBlock(S.draft, COMMENTS);
      $("#ex-list").value = changeList();
    }
    $("#main").innerHTML =
      S.view === "changes"
        ? changesHtml()
        : `<div class="gr">${cardsHtml(a, ad)}</div>`;
    $("#below").innerHTML = problemsHtml(ad);
    if (S.view === "draft" && S.sel && S.focusEd) {
      S.focusEd = false;
      const el = S.sel === "__new__" ? $("#e-name") : $("#e-val");
      if (el) el.focus({ preventScroll: true });
    }
  }

  function save() {
    const n = S.sel,
      name = $("#e-name").value.trim(),
      val = $("#e-val").value.trim();
    const upd = $("#e-upd") ? $("#e-upd").checked : false;
    // An error is shown in place, so what was typed stays in the fields.
    const fail = (m) => {
      const ed = document.querySelector(".editor");
      let p = ed.querySelector(".err");
      if (!p) {
        p = document.createElement("p");
        p.className = "err";
        p.setAttribute("role", "alert");
        ed.querySelector(".btns").before(p);
      }
      p.textContent = m;
    };
    if (!name) return fail("Enter a name.");
    if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(name))
      return fail(
        "Use letters, digits and hyphens only, starting with a letter or digit.",
      );
    if (name !== n && name in S.draft) return fail(`${name} already exists.`);
    if (!val) return fail("Enter a value.");
    if (n === "__new__")
      return mutate(
        () => {
          S.draft = { ...S.draft, [name]: val };
          S.sel = null;
        },
        `Added <code>${h(name)}</code>.`,
      );
    mutate(
      () => {
        let m = { ...S.draft, [n]: val };
        if (name !== n) {
          m = renameAlias(m, n, name, upd);
          const orig = S.renamedFrom[n] || n,
            rf = { ...S.renamedFrom };
          delete rf[n];
          if (orig in BASE && orig !== name) rf[name] = orig;
          S.renamedFrom = rf;
        }
        S.draft = m;
        S.sel = null;
      },
      name !== n
        ? `Renamed <code>${h(n)}</code> to <code>${h(name)}</code>.`
        : `Saved <code>${h(n)}</code>.`,
    );
  }

  function del() {
    const n = S.sel;
    let broken = [];
    mutate(() => {
      const r = removeAlias(S.draft, n, true, NAT);
      S.draft = r.map;
      S.sel = null;
      broken = r.broken;
      const rf = { ...S.renamedFrom };
      delete rf[n];
      S.renamedFrom = rf;
    });
    S.notice =
      `Deleted <code>${h(n)}</code>.` +
      (broken.length
        ? ` Now broken: ${broken.map((x) => `<code>${h(x)}</code>`).join(", ")}.`
        : "");
    render();
  }

  function revertChange(n, kind, old) {
    mutate(
      () => {
        const m = { ...S.draft },
          rf = { ...S.renamedFrom };
        if (kind === "removed" || kind === "changed") m[n] = BASE[n];
        if (kind === "added") delete m[n];
        if (kind === "renamed") {
          delete m[n];
          m[old] = BASE[old];
          delete rf[n];
        }
        S.draft = m;
        S.renamedFrom = rf;
      },
      `Reverted <code>${h(kind === "renamed" ? old : n)}</code>.`,
    );
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("button, .row.ed");
    if (!b) return;
    if (b.dataset.view) {
      S.view = b.dataset.view;
      S.sel = null;
      S.notice = "";
      history.replaceState(null, "", "#" + S.view);
      return render();
    }
    const act = b.dataset.act;
    if (b.classList.contains("row")) {
      S.sel = S.sel === b.dataset.n ? null : b.dataset.n;
      S.notice = "";
      S.focusEd = true;
      return render();
    }
    if (act === "save") return save();
    if (act === "delete") return del();
    if (act === "cancel") {
      S.sel = null;
      return render();
    }
    if (act === "revert-one")
      return mutate(() => {
        S.draft = { ...S.draft, [S.sel]: BASE[S.sel] };
      }, "Back to the current value.");
    if (act === "restore")
      return mutate(
        () => {
          S.draft = { ...S.draft, [b.dataset.x]: BASE[b.dataset.x] };
        },
        `Restored <code>${h(b.dataset.x)}</code>.`,
      );
    if (act === "revert-change")
      return revertChange(b.dataset.x, b.dataset.k, b.dataset.o);
    if (act === "flatten")
      return mutate(() => {
        S.draft = flattenChains(S.draft);
      }, "Every rename of a rename now points at its final target.");
    if (act === "add") {
      S.view = "draft";
      S.sel = "__new__";
      S.focusEd = true;
      return render();
    }
    if (act === "undo") {
      const p = S.hist.pop();
      if (p) {
        S.draft = p.draft;
        S.renamedFrom = p.renamedFrom;
        S.sel = null;
        S.notice = "Undone.";
        persist();
      }
      return render();
    }
    if (act === "clear")
      return mutate(() => {
        S.draft = { ...BASE };
        S.renamedFrom = {};
        S.sel = null;
      }, "All changes cleared: the draft equals the current file. Undo brings them back.");
    if (act === "export") {
      S.exportOpen = !S.exportOpen;
      return render();
    }
    if (act === "copy") {
      const t = $(b.dataset.x).value;
      const done = (ok) => {
        b.textContent = ok ? "Copied" : "Select the text and copy it";
        setTimeout(() => (b.textContent = "Copy"), 1800);
      };
      try {
        navigator.clipboard.writeText(t).then(
          () => done(true),
          () => done(false),
        );
      } catch {
        done(false);
      }
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && S.sel) {
      S.sel = null;
      render();
    }
    if (e.key === "Enter" && e.target.id === "e-name") {
      e.preventDefault();
      save();
    }
    if (
      e.key === "Enter" &&
      (e.metaKey || e.ctrlKey) &&
      e.target.id === "e-val"
    ) {
      e.preventDefault();
      save();
    }
    if (
      (e.key === "Enter" || e.key === " ") &&
      e.target.classList &&
      e.target.classList.contains("row") &&
      e.target.dataset.n
    ) {
      e.preventDefault();
      e.target.click();
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "q") {
      S.q = e.target.value.trim();
      render();
    }
    if (e.target.id === "e-name" || e.target.id === "e-val") {
      const p = document.querySelector(".editor .err");
      if (p) p.remove();
    }
  });
  const hv = location.hash.slice(1);
  if (["draft", "current", "changes"].includes(hv)) S.view = hv;
  render();
}
