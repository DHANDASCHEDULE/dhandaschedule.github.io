(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const storageKey = "dhanda-page-transition";
  const overlay = document.createElement("div");
  overlay.className = "page-transition";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = '<span class="page-transition__beam"></span><span class="page-transition__label"></span>';
  document.body.append(overlay);

  const label = overlay.querySelector(".page-transition__label");
  let entering = false;

  try {
    const savedLabel = sessionStorage.getItem(storageKey);
    if (savedLabel) {
      sessionStorage.removeItem(storageKey);
      label.textContent = savedLabel;
      overlay.classList.add("is-visible");
      entering = true;
      requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.remove("is-visible")));
    }
  } catch {
    // Keep navigation available when browser storage is unavailable.
  }

  window.addEventListener("pageshow", (event) => {
    if (event.persisted && entering) overlay.classList.remove("is-visible");
  });

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a[href]");
    if (!link || link.target || link.hasAttribute("download")) return;

    const destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;

    event.preventDefault();
    const pageName = link.dataset.transitionTitle || link.textContent.replace(/↗|↑|↓/g, "").trim() || "DHANDA";
    label.textContent = pageName.toUpperCase();
    try { sessionStorage.setItem(storageKey, pageName.toUpperCase()); } catch {}

    overlay.classList.add("is-visible");
    window.setTimeout(() => window.location.assign(destination.href), 520);
  });
})();
