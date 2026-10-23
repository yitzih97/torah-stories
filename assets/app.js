// Torah Stories: theme toggle, ⌘K search, copy link, print, table-of-contents highlight.
(() => {
  const $ = (s, el = document) => el.querySelector(s);

  // theme
  $("[data-theme-toggle]")?.addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch {}
  });

  // search
  const dlg = $("#search");
  const input = dlg?.querySelector("input");
  const results = dlg?.querySelector(".search-results");
  let index = null, active = 0;
  const norm = (s) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, " ");
  const render = (q) => {
    if (!index) return;
    const words = norm(q).split(/\s+/).filter(Boolean);
    const hits = (words.length ? index.filter((d) => words.every((w) => d._.includes(w))) : index.filter((d) => d.k === "Section")).slice(0, 12);
    active = 0;
    results.innerHTML = hits.length
      ? hits.map((d, i) => `<a href="${d.u}" role="option" aria-selected="${i === 0}"><span>${d.t.replace(/</g, "&lt;")}</span><small>${d.k} · ${d.c}</small></a>`).join("")
      : `<p class="empty">Nothing yet for “${q.replace(/</g, "&lt;")}”. New articles are added every week.</p>`;
  };
  const open = async () => {
    if (!dlg) return;
    dlg.showModal();
    input.value = "";
    if (!index) {
      try {
        index = (await (await fetch("/search.json")).json()).map((d) => ({ ...d, _: norm(`${d.t} ${d.s} ${d.c} ${d.k}`) }));
      } catch { index = []; }
    }
    render("");
    input.focus();
  };
  document.querySelectorAll("[data-search]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); open(); }));
  addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); dlg?.open ? dlg.close() : open(); }
    if (e.key === "/" && !/input|textarea/i.test(document.activeElement?.tagName)) { e.preventDefault(); open(); }
  });
  input?.addEventListener("input", () => render(input.value));
  input?.addEventListener("keydown", (e) => {
    const links = [...results.querySelectorAll("a")];
    if (!links.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
      links.forEach((l, i) => l.setAttribute("aria-selected", i === active));
      links[active].scrollIntoView({ block: "nearest" });
    }
    if (e.key === "Enter") { e.preventDefault(); location.href = links[active].href; }
  });
  dlg?.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  // article actions
  $("[data-print]")?.addEventListener("click", () => print());
  const copy = $("[data-copy]");
  copy?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href.split("#")[0]); copy.setAttribute("aria-label", "Link copied"); copy.style.color = "var(--clay)"; setTimeout(() => { copy.style.color = ""; copy.setAttribute("aria-label", "Copy link"); }, 1600); } catch {}
  });

  // highlight the section being read
  const tocLinks = [...document.querySelectorAll(".rail .toc a")];
  if (tocLinks.length && "IntersectionObserver" in window) {
    const byId = new Map(tocLinks.map((a) => [a.hash.slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { tocLinks.forEach((a) => a.classList.remove("active")); byId.get(e.target.id)?.classList.add("active"); }
    }, { rootMargin: "-20% 0px -70% 0px" });
    byId.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }
})();
