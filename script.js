const pills = [...document.querySelectorAll(".pill-nav .pill")];
const panels = [...document.querySelectorAll("[data-panel]")];
const pillNav = document.querySelector(".pill-nav");
const navToggle = document.querySelector(".nav-toggle");
const mqMobileNav = window.matchMedia("(max-width: 1100px)");

// Paste your Google Apps Script Web App URL here after deploying Code.gs
const GOOGLE_SCRIPT_URL = "";

// Optional: Google Drive / shared album link for guest photo uploads
const PHOTO_ALBUM_URL = "";

// Optional: contact email for vendor / share inquiries
const CONTACT_EMAIL = "";

const sceneRun = document.querySelector(".scene-run");
const scenePhoto = document.querySelector(".scene-run-photo");
const homePanel = document.getElementById("home");
const storyPanel = document.getElementById("story");

/* Narrow / phone breakpoints — layout only (no scroll-linked motion on any viewport). */
const mqSceneNarrow = window.matchMedia("(max-width: 1100px)");
const mqScenePhone = window.matchMedia("(max-width: 560px)");

function getScenePhotoFrame() {
  return scenePhoto?.closest(".scene-run-photo-frame") || null;
}

/* Hero photo lives inside #home as a static absolute fill — never fixed / sticky handoff. */
function syncScenePhotoMount() {
  const frame = getScenePhotoFrame();
  if (!frame || !homePanel) return;
  if (frame.parentElement !== homePanel) {
    homePanel.insertBefore(frame, homePanel.firstChild);
  }
}

/* One-shot park: clear inline pan/crop so CSS owns a static hero.
   Never call from scroll — only init / mq / orientation. */
function parkScenePhoto() {
  if (!scenePhoto || !sceneRun) return;
  syncScenePhotoMount();
  sceneRun.style.setProperty("--scene-pan", "0");
  sceneRun.style.removeProperty("--scene-photo-y");
  sceneRun.classList.remove("is-photo-anchored", "is-photo-ken-paused");
  scenePhoto.style.removeProperty("object-position");
  scenePhoto.style.removeProperty("transform");
  sceneRun.style.removeProperty("--mobile-hero-h");
  if (homePanel) homePanel.style.removeProperty("--mobile-hero-h");
}

/* Cover bgs: lock <img> to the section box in px once. Never on scroll —
   URL-bar height churn would recrop object-fit:cover (looks like zoom). */
const joinPanel = document.getElementById("join");
const joinBgImg = joinPanel?.querySelector(".join-media-photo img") || null;
const entouragePanel = document.getElementById("entourage");
const entourageBgImg =
  entouragePanel?.querySelector(".entourage-media-photo img") || null;

let lockedCoverPageH = 0;

function measureStableViewportH() {
  const layoutH = Math.round(document.documentElement.clientHeight || 0);
  const innerH = Math.round(window.innerHeight || 0);
  return Math.max(layoutH, innerH);
}

function lockMobileCoverPages() {
  if (!mqSceneNarrow.matches) {
    lockedCoverPageH = 0;
    document.documentElement.style.removeProperty("--page-home-h");
    document.documentElement.style.removeProperty("--page-invite-h");
    return;
  }
  if (lockedCoverPageH > 0) return;
  const h = measureStableViewportH();
  if (h < 1) return;
  lockedCoverPageH = h;
  const px = `${h}px`;
  document.documentElement.style.setProperty("--page-home-h", px);
  document.documentElement.style.setProperty("--page-invite-h", px);
}

function lockSectionBgSize(section, img) {
  if (!section || !img) return;
  if (!mqSceneNarrow.matches) {
    img.style.removeProperty("width");
    img.style.removeProperty("height");
    return;
  }
  const w = section.clientWidth;
  const h = section.clientHeight;
  if (w < 1 || h < 1) return;
  /* Beat mobile stylesheet !important so the crop stays px-stable. */
  img.style.setProperty("width", `${w}px`, "important");
  img.style.setProperty("height", `${h}px`, "important");
}

function lockCoverSectionBgs() {
  lockSectionBgSize(homePanel, scenePhoto);
  lockSectionBgSize(joinPanel, joinBgImg);
  lockSectionBgSize(entouragePanel, entourageBgImg);
}

function syncCoverLayouts({ relockPageH = false } = {}) {
  parkScenePhoto();
  if (relockPageH) lockedCoverPageH = 0;
  lockMobileCoverPages();
  if (homePanel) void homePanel.offsetHeight;
  lockCoverSectionBgs();
}

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;

  /* Native jump only — smooth scroll fights touch and feels like a jolt. */
  const scrollBehavior = "auto";

  if (id === "home") {
    window.scrollTo({ top: 0, behavior: scrollBehavior });
    setActivePill("home");
    requestAnimationFrame(() => updateBrandMorph(true));
    return;
  }

  target.scrollIntoView({
    behavior: scrollBehavior,
    block: "start",
  });
  requestAnimationFrame(() => updateBrandMorph(true));
}

function setActivePill(id) {
  pills.forEach((pill) => {
    pill.classList.toggle("is-active", pill.dataset.section === id);
  });
  document.body.classList.toggle("is-rsvp-view", id === "rsvp");
}

function syncMobileNavA11y(isOpen) {
  if (!pillNav) return;
  if (mqMobileNav.matches) {
    pillNav.setAttribute("aria-hidden", isOpen ? "false" : "true");
  } else {
    pillNav.removeAttribute("aria-hidden");
  }
}

function setMobileNavOpen(open, { restoreFocus = true } = {}) {
  if (!pillNav || !navToggle) return;
  const wasOpen = pillNav.classList.contains("is-open");
  const shouldOpen = Boolean(open) && mqMobileNav.matches;
  pillNav.classList.toggle("is-open", shouldOpen);
  document.body.classList.toggle("is-nav-open", shouldOpen);
  navToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  navToggle.setAttribute("aria-label", shouldOpen ? "Close menu" : "Open menu");
  syncMobileNavA11y(shouldOpen);

  if (shouldOpen) {
    const active = pillNav.querySelector(".pill.is-active") || pills[0];
    active?.focus?.();
  } else if (wasOpen && restoreFocus && mqMobileNav.matches) {
    navToggle.focus();
  }
}

function trapMobileNavFocus(event) {
  if (!pillNav?.classList.contains("is-open") || event.key !== "Tab") return;
  const focusable = [
    navToggle,
    ...pills.filter((pill) => !pill.hasAttribute("disabled")),
  ].filter(Boolean);
  if (focusable.length < 2) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

navToggle?.addEventListener("click", () => {
  const open = navToggle.getAttribute("aria-expanded") !== "true";
  setMobileNavOpen(open);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && pillNav?.classList.contains("is-open")) {
    event.preventDefault();
    setMobileNavOpen(false);
    return;
  }
  trapMobileNavFocus(event);
});

mqMobileNav.addEventListener("change", () => {
  if (!mqMobileNav.matches) {
    setMobileNavOpen(false, { restoreFocus: false });
  }
  syncMobileNavA11y(pillNav?.classList.contains("is-open"));
});

syncMobileNavA11y(false);

pills.forEach((pill) => {
  pill.addEventListener("click", (event) => {
    event.preventDefault();
    setMobileNavOpen(false, { restoreFocus: false });
    scrollToSection(pill.dataset.section);
  });
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  if (link.classList.contains("pill")) return;
  link.addEventListener("click", (event) => {
    const id = link.getAttribute("href")?.slice(1);
    if (!id || !document.getElementById(id)) return;
    event.preventDefault();
    scrollToSection(id);
  });
});

/* HOME → INVITE shared-element morph (scroll-driven FLIP ghosts). */
const brandMorphPairs = [
  { id: "title", kind: "title" },
  { id: "seal", kind: "img" },
  { id: "meta", kind: "meta" },
  { id: "place", kind: "place" },
];

let brandMorphLayer = null;
let brandMorphGhosts = null;
let brandMorphState = "idle";
let brandMorphHomes = null;
let brandMorphFromRects = null;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function smootherstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function readRect(el) {
  const r = el.getBoundingClientRect();
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
  };
}

function rememberMorphHomes() {
  if (brandMorphHomes) return;
  brandMorphHomes = {};
  brandMorphPairs.forEach(({ id }) => {
    const from = document.querySelector(`[data-morph="${id}"]`);
    if (!from) return;
    brandMorphHomes[id] = { parent: from.parentElement, next: from.nextSibling };
  });
}

function restoreMorphHome(id) {
  const from = document.querySelector(`[data-morph="${id}"]`);
  const home = brandMorphHomes?.[id];
  if (!from || !home?.parent) return;
  if (from.parentElement === home.parent) return;
  if (home.next && home.next.parentNode === home.parent) {
    home.parent.insertBefore(from, home.next);
  } else {
    home.parent.appendChild(from);
  }
}

function settleMorphIntoSlots() {
  brandMorphPairs.forEach(({ id }) => {
    if (id === "place") return;
    const from = document.querySelector(`[data-morph="${id}"]`);
    const slot = document.querySelector(`[data-morph-target="${id}"]`);
    if (!from || !slot) return;
    if (from.parentElement !== slot) slot.appendChild(from);
    if (id === "title") slot.style.minHeight = "";
  });
}

function getInviteMorphProgress() {
  if (!homePanel || !storyPanel) return 0;
  if (document.body.classList.contains("is-sealed")) return 0;
  const vh = window.innerHeight || 1;
  const top = storyPanel.getBoundingClientRect().top;
  return Math.min(1, Math.max(0, 1 - top / vh));
}

function layoutPlaceArc() {
  const card = document.querySelector(".invite-card");
  const svg = document.querySelector(".invite-place-arc");
  const path = document.getElementById("invite-place-path");
  const textPath = document.getElementById("invite-place-textpath");
  if (!card || !svg || !path) return;
  const w = card.clientWidth;
  const h = card.clientHeight;
  if (w < 8 || h < 8) return;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  const inset = Math.max(22, w * 0.055);
  const rx = w / 2 - inset;
  const cx = w / 2;
  const cy = h - w / 2;
  const spread = Math.PI * 0.38;
  const a0 = Math.PI / 2 + spread;
  const a1 = Math.PI / 2 - spread;
  const x0 = cx + rx * Math.cos(a0);
  const y0 = cy + rx * Math.sin(a0);
  const x1 = cx + rx * Math.cos(a1);
  const y1 = cy + rx * Math.sin(a1);
  path.setAttribute("d", `M ${x0} ${y0} A ${rx} ${rx} 0 0 0 ${x1} ${y1}`);
  if (textPath) {
    const href = `${window.location.pathname}${window.location.search}#invite-place-path`;
    textPath.setAttribute("href", href);
    textPath.setAttributeNS("http://www.w3.org/1999/xlink", "href", href);
  }
}

function readPlaceDest() {
  const card = document.querySelector(".invite-card");
  if (!card) return null;
  const r = card.getBoundingClientRect();
  const band = Math.max(22, r.width * 0.07);
  return {
    left: r.left + r.width * 0.1,
    top: r.bottom - band - Math.max(18, r.width * 0.045),
    width: r.width * 0.8,
    height: band,
  };
}

function cloneTitleGhost(from) {
  const ghost = from.cloneNode(true);
  ghost.removeAttribute("data-morph");
  ghost.removeAttribute("aria-label");
  ghost.setAttribute("aria-hidden", "true");
  ghost.classList.add("brand-morph-ghost", "is-title");
  ghost.querySelectorAll("defs, mask, .hero-brush, animate").forEach((node) => {
    node.remove();
  });
  ghost.querySelectorAll(".hero-draw-path").forEach((path) => {
    path.removeAttribute("mask");
  });
  return ghost;
}

function ensureBrandMorphLayer() {
  if (brandMorphLayer) return brandMorphLayer;
  rememberMorphHomes();
  brandMorphLayer = document.createElement("div");
  brandMorphLayer.className = "brand-morph-layer";
  brandMorphLayer.setAttribute("aria-hidden", "true");
  document.body.appendChild(brandMorphLayer);

  brandMorphGhosts = {};
  brandMorphPairs.forEach(({ id, kind }) => {
    const from = document.querySelector(`[data-morph="${id}"]`);
    const to = document.querySelector(`[data-morph-target="${id}"]`);
    if (!from) return;
    if (kind !== "place" && !to) return;

    let ghost;
    if (kind === "title") {
      ghost = cloneTitleGhost(from);
    } else if (kind === "img") {
      ghost = from.cloneNode(true);
      ghost.removeAttribute("data-morph");
      ghost.removeAttribute("alt");
      ghost.className = "brand-morph-ghost is-img";
    } else if (kind === "meta") {
      ghost = from.cloneNode(true);
      ghost.removeAttribute("data-morph");
      ghost.className = "brand-morph-ghost is-meta";
      ghost.querySelectorAll("[data-morph]").forEach((el) => {
        el.removeAttribute("data-morph");
      });
      const place = ghost.querySelector(".hero-meta-place");
      if (place) place.style.display = "none";
    } else if (kind === "place") {
      ghost = from.cloneNode(true);
      ghost.removeAttribute("data-morph");
      ghost.className = "brand-morph-ghost is-place";
    } else {
      return;
    }

    brandMorphLayer.appendChild(ghost);
    brandMorphGhosts[id] = { id, ghost, kind, from, to };
  });

  return brandMorphLayer;
}

function captureMorphFromRects() {
  if (!brandMorphFromRects) brandMorphFromRects = {};
  brandMorphPairs.forEach(({ id }) => {
    const from = document.querySelector(`[data-morph="${id}"]`);
    if (!from) return;
    const rect = readRect(from);
    if (rect.width >= 1 && rect.height >= 1) {
      brandMorphFromRects[id] = rect;
    }
  });
}

function paintBrandGhost(entry, t) {
  const { id, ghost, kind, from, to } = entry;
  const fromRect = brandMorphFromRects?.[id] || (from ? readRect(from) : null);
  const toRect = kind === "place" ? readPlaceDest() : to ? readRect(to) : null;
  if (!fromRect || !toRect || fromRect.width < 1 || toRect.width < 1) {
    ghost.style.opacity = "0";
    return;
  }

  const left = lerp(fromRect.left, toRect.left, t);
  const top = lerp(fromRect.top, toRect.top, t);
  const width = lerp(fromRect.width, toRect.width, t);
  const height = lerp(fromRect.height, toRect.height, t);
  const inkR = Math.round(lerp(255, 42, t));
  const inkG = Math.round(lerp(255, 61, t));
  const inkB = Math.round(lerp(255, 85, t));
  const ink = `rgb(${inkR}, ${inkG}, ${inkB})`;
  const inkSoft = `rgba(${inkR}, ${inkG}, ${inkB}, ${lerp(0.88, 0.82, t)})`;

  if (kind === "img") {
    ghost.style.left = `${left}px`;
    ghost.style.top = `${top}px`;
    ghost.style.width = `${width}px`;
    ghost.style.height = `${height}px`;
    ghost.style.transform = "";
    ghost.style.opacity = "1";
    ghost.style.filter = `drop-shadow(0 4px 14px rgba(0, 0, 0, ${lerp(0.35, 0.12, t)}))`;
    return;
  }

  if (kind === "title") {
    const s = fromRect.width > 0 ? width / fromRect.width : 1;
    ghost.style.left = `${left}px`;
    ghost.style.top = `${top}px`;
    ghost.style.width = `${fromRect.width}px`;
    ghost.style.height = `${fromRect.height}px`;
    ghost.style.transform = `scale(${s})`;
    ghost.style.transformOrigin = "top left";
    ghost.style.opacity = "1";
    ghost.querySelectorAll(".hero-draw-path").forEach((path) => {
      path.style.fill = ink;
    });
    ghost.querySelectorAll(".hero-draw").forEach((draw) => {
      draw.style.filter =
        t < 0.7
          ? `drop-shadow(0 3px 22px rgba(0, 0, 0, ${lerp(0.38, 0, t / 0.7)}))`
          : "none";
    });
    return;
  }

  if (kind === "meta") {
    const sx = fromRect.width > 0 ? width / fromRect.width : 1;
    const sy = fromRect.height > 0 ? height / fromRect.height : 1;
    ghost.style.left = `${left}px`;
    ghost.style.top = `${top}px`;
    ghost.style.width = `${fromRect.width}px`;
    ghost.style.height = `${fromRect.height}px`;
    ghost.style.transform = `scale(${sx}, ${sy})`;
    ghost.style.transformOrigin = "top left";
    ghost.style.opacity = "1";
    ghost
      .querySelectorAll(".hero-meta-time, .hero-meta-year, .hero-date-side")
      .forEach((el) => {
        el.style.color = inkSoft;
        el.style.textShadow =
          t < 0.55 ? `0 2px 12px rgba(0, 0, 0, ${lerp(0.3, 0, t / 0.55)})` : "none";
      });
    const dayEl = ghost.querySelector(".hero-date-day");
    if (dayEl) {
      dayEl.style.color = ink;
      dayEl.style.textShadow =
        t < 0.55 ? `0 2px 12px rgba(0, 0, 0, ${lerp(0.3, 0, t / 0.55)})` : "none";
    }
    return;
  }

  if (kind === "place") {
    const fromStyle = getComputedStyle(from);
    const fs = lerp(parseFloat(fromStyle.fontSize) || 14, 12.5, t);
    ghost.style.left = `${left + width / 2}px`;
    ghost.style.top = `${top + height / 2}px`;
    ghost.style.width = "auto";
    ghost.style.height = "auto";
    ghost.style.transform = "translate(-50%, -50%)";
    ghost.style.fontSize = `${fs}px`;
    ghost.style.color = inkSoft;
    ghost.style.textShadow =
      t < 0.55 ? `0 2px 12px rgba(0, 0, 0, ${lerp(0.3, 0, t / 0.55)})` : "none";
    ghost.style.opacity = String(1 - smoothstep((t - 0.62) / 0.28));
  }
}

function syncTitleSlotSize() {
  const title = document.querySelector('[data-morph="title"]');
  const slot = document.querySelector('[data-morph-target="title"]');
  if (!title || !slot || slot.contains(title)) return;
  const tr = title.getBoundingClientRect();
  const sw = slot.getBoundingClientRect().width;
  if (tr.width < 1 || sw < 1) return;
  slot.style.minHeight = `${(tr.height * sw) / tr.width}px`;
}

function setArcVisible(on, opacity) {
  const arc = document.querySelector(".invite-place-arc");
  if (!arc) return;
  const value = opacity == null ? (on ? 1 : 0) : opacity;
  arc.style.opacity = String(value);
  arc.classList.toggle("is-on", Boolean(on) && value >= 0.97);
}

function setMorphIdle() {
  if (brandMorphState === "idle") {
    setArcVisible(false, 0);
    return;
  }
  brandMorphPairs.forEach(({ id }) => restoreMorphHome(id));
  sceneRun?.classList.remove(
    "is-brand-morphing",
    "is-brand-settled",
    "is-brand-handing-off"
  );
  sceneRun?.style.setProperty("--brand-source-opacity", "1");
  sceneRun?.style.setProperty("--brand-real-opacity", "0");
  sceneRun?.style.setProperty("--brand-ghost-opacity", "0");
  brandMorphState = "idle";
  brandMorphFromRects = null;
  if (brandMorphLayer) {
    brandMorphLayer.style.opacity = "0";
    brandMorphLayer.classList.remove("is-active");
  }
  setArcVisible(false, 0);
}

function setMorphSettled() {
  rememberMorphHomes();
  settleMorphIntoSlots();
  layoutPlaceArc();
  sceneRun?.classList.remove("is-brand-morphing", "is-brand-handing-off");
  sceneRun?.classList.add("is-brand-settled");
  sceneRun?.style.setProperty("--brand-source-opacity", "0");
  sceneRun?.style.setProperty("--brand-real-opacity", "1");
  sceneRun?.style.setProperty("--brand-ghost-opacity", "0");
  storyPanel?.classList.add("is-inview");
  brandMorphState = "settled";
  if (brandMorphLayer) {
    brandMorphLayer.style.setProperty("--brand-ghost-opacity", "0");
    brandMorphLayer.style.opacity = "0";
    brandMorphLayer.classList.remove("is-active");
  }
  setArcVisible(true, 1);
}

function updateBrandMorph() {
  if (!sceneRun || !homePanel || !storyPanel) return;
  layoutPlaceArc();

  if (prefersReducedMotion()) {
    const progress = getInviteMorphProgress();
    if (progress >= 0.55) setMorphSettled();
    else setMorphIdle();
    return;
  }

  const progress = getInviteMorphProgress();
  const sourceFade = 1 - smootherstep((progress - 0.02) / 0.1);
  const ghostIn = smootherstep((progress - 0.08) / 0.12);
  const ghostOut = 1 - smootherstep((progress - 0.72) / 0.22);
  const ghostOpacity = ghostIn * ghostOut;
  const realOpacity = 1 - ghostOut;
  const travelT = smootherstep((progress - 0.2) / 0.52);

  sceneRun.style.setProperty("--brand-source-opacity", sourceFade.toFixed(3));
  sceneRun.style.setProperty("--brand-real-opacity", realOpacity.toFixed(3));
  sceneRun.style.setProperty("--brand-ghost-opacity", ghostOpacity.toFixed(3));

  if (progress <= 0.01) {
    setMorphIdle();
    syncTitleSlotSize();
    return;
  }

  if (progress >= 0.995 && realOpacity >= 0.98 && ghostOpacity <= 0.02) {
    setMorphSettled();
    return;
  }

  rememberMorphHomes();
  ensureBrandMorphLayer();
  if (progress >= 0.72) {
    if (!brandMorphFromRects) {
      brandMorphPairs.forEach(({ id }) => restoreMorphHome(id));
      captureMorphFromRects();
    }
    settleMorphIntoSlots();
    sceneRun.classList.add("is-brand-morphing", "is-brand-handing-off");
    sceneRun.classList.remove("is-brand-settled");
    brandMorphState = "morphing";
  } else {
    brandMorphPairs.forEach(({ id }) => restoreMorphHome(id));
    captureMorphFromRects();
    syncTitleSlotSize();
    sceneRun.classList.add("is-brand-morphing");
    sceneRun.classList.remove("is-brand-settled", "is-brand-handing-off");
    brandMorphState = "morphing";
  }
  if (brandMorphLayer) {
    brandMorphLayer.style.setProperty("--brand-ghost-opacity", ghostOpacity.toFixed(3));
    brandMorphLayer.classList.toggle("is-active", ghostOpacity > 0.02);
  }
  setArcVisible(false, smootherstep((progress - 0.48) / 0.3));

  Object.values(brandMorphGhosts || {}).forEach((entry) => {
    paintBrandGhost(entry, travelT);
  });
}

function tickBrandMorph() {
  let scheduled = false;
  const run = () => {
    scheduled = false;
    updateBrandMorph();
  };
  const request = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request, { passive: true });
  request();
}

tickBrandMorph();

/* Invite wash/pattern stay at final opacity — never rewritten per scroll frame. */
if (storyPanel) {
  storyPanel.style.setProperty("--invite-pattern", "1");
  storyPanel.style.setProperty("--invite-wash", "0.92");
}

syncCoverLayouts();

/* Phone: vertical scroll only — block pinch-zoom (shows tiled/looped layers). */
function preventPinchZoom(event) {
  if (event.touches && event.touches.length > 1) {
    event.preventDefault();
  }
}
document.addEventListener("touchmove", preventPinchZoom, { passive: false });
document.addEventListener("gesturestart", (event) => event.preventDefault());
document.addEventListener("gesturechange", (event) => event.preventDefault());
document.addEventListener("gestureend", (event) => event.preventDefault());
/* After layout / lazy images settle, re-lock photo boxes (never on scroll). */
if (typeof window.requestAnimationFrame === "function") {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => syncCoverLayouts());
  });
}
window.addEventListener("load", () => syncCoverLayouts(), { passive: true });
if (scenePhoto && !scenePhoto.complete) {
  scenePhoto.addEventListener("load", () => lockCoverSectionBgs(), {
    once: true,
    passive: true,
  });
}
joinPanel?.querySelectorAll(".join-shot img").forEach((shot) => {
  if (shot.complete) return;
  shot.addEventListener("load", lockCoverSectionBgs, {
    once: true,
    passive: true,
  });
});
if (entourageBgImg && !entourageBgImg.complete) {
  entourageBgImg.addEventListener("load", lockCoverSectionBgs, {
    once: true,
    passive: true,
  });
}

/* Width-only resize — ignore height churn from mobile URL-bar show/hide. */
let lastLayoutWidth = window.innerWidth;
window.addEventListener(
  "resize",
  () => {
    const w = window.innerWidth;
    if (Math.abs(w - lastLayoutWidth) < 1) return;
    lastLayoutWidth = w;
    syncCoverLayouts({ relockPageH: true });
  },
  { passive: true }
);
const onSceneMqChange = () => {
  syncCoverLayouts({ relockPageH: true });
};
if (typeof mqSceneNarrow.addEventListener === "function") {
  mqSceneNarrow.addEventListener("change", onSceneMqChange);
  mqScenePhone.addEventListener("change", onSceneMqChange);
} else if (typeof mqSceneNarrow.addListener === "function") {
  mqSceneNarrow.addListener(onSceneMqChange);
  mqScenePhone.addListener(onSceneMqChange);
}
window.addEventListener(
  "orientationchange",
  () => {
    window.setTimeout(() => {
      syncCoverLayouts({ relockPageH: true });
    }, 120);
  },
  { passive: true }
);

/* Pill active state — no style morphs tied to scroll. */
function panelLooksInview(entry) {
  if (!entry.isIntersecting) return false;
  const vh = entry.rootBounds?.height || window.innerHeight || 1;
  const visible = entry.intersectionRect?.height || 0;
  return entry.intersectionRatio >= 0.16 || visible >= vh * 0.38;
}

if (panels.length) {
  const ratios = new Map();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const panel = entry.target;
        ratios.set(panel, entry.intersectionRatio);
        const nowInview = panelLooksInview(entry);
        panel.classList.toggle("is-inview", nowInview);
      });

      let bestPanel = null;
      let bestRatio = -1;
      ratios.forEach((ratio, panel) => {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestPanel = panel;
        }
      });
      if (bestPanel?.dataset.panel) {
        setActivePill(bestPanel.dataset.panel);
      }
    },
    {
      threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
    }
  );

  panels.forEach((panel) => observer.observe(panel));
}

/* Invite floral-ark butterfly — static perch only (no flight / scroll accompaniment). */
(function initInviteButterfly() {
  const butterfly = document.querySelector("[data-invite-butterfly]");
  if (!butterfly) return;
  butterfly.classList.add("is-perched");
  butterfly.classList.remove("is-flying");
  butterfly.style.transform = "";
})();

/* Love Story kicker — static text only (no typewriter). */
(function initLoveStoryTypewriter() {
  const kicker = document.querySelector(".love-story-kicker[data-typewriter]");
  const textEl = kicker?.querySelector(".love-story-kicker-text");
  if (!kicker || !textEl) return;
  const fullText = (textEl.textContent || "Once upon a time").trim();
  textEl.textContent = fullText;
  kicker.classList.remove("is-typing", "is-cursor");
})();

let envelopeOpened = false;
let envelopeReady = false;

const ENVELOPE_ASSET_BASE = `${import.meta.env?.BASE_URL ?? ""}`;
const ENVELOPE_LOAD_TIMEOUT_MS = 14000;
const ENVELOPE_PHRASE_MS = 2000;
const ENVELOPE_READY_FLASH_MS = 1400;

const ENVELOPE_LOADING_PHRASES = [
  "Preparing your invitation…",
  "Folding the envelope…",
  "Pressing the wax seal…",
  "Gathering wedding details…",
  "Almost ready…",
];

function envelopeOpenHint() {
  return mqSceneNarrow.matches ? "Tap to open" : "Click to open";
}

function waitForWindowLoad() {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true });
  });
}

function waitForFontsReady() {
  if (!document.fonts?.ready) return Promise.resolve();
  return document.fonts.ready.catch(() => {});
}

function waitForStylesheets() {
  const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')];
  if (!sheets.length) return Promise.resolve();
  return Promise.all(
    sheets.map((link) => {
      if (link.sheet) return Promise.resolve();
      return new Promise((resolve) => {
        link.addEventListener("load", () => resolve(), { once: true });
        link.addEventListener("error", () => resolve(), { once: true });
      });
    })
  );
}

function decodeImageElement(img) {
  if (!img) return Promise.resolve();
  const settle = () => {
    if (typeof img.decode === "function") {
      return img.decode().catch(() => {});
    }
    return Promise.resolve();
  };
  if (img.complete && img.naturalWidth > 0) return settle();
  if (img.complete && img.naturalWidth === 0) return Promise.resolve();
  return new Promise((resolve) => {
    img.addEventListener(
      "load",
      () => {
        settle().then(resolve);
      },
      { once: true }
    );
    img.addEventListener("error", () => resolve(), { once: true });
  });
}

function preloadImageSrc(src) {
  if (!src) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (typeof img.decode === "function") {
        img.decode().then(resolve).catch(resolve);
      } else {
        resolve();
      }
    };
    img.onerror = () => resolve();
    img.src = src;
  });
}

function withTimeout(promise, ms) {
  return Promise.race([
    Promise.resolve(promise)
      .then(() => ({ timedOut: false }))
      .catch(() => ({ timedOut: false })),
    new Promise((resolve) => {
      window.setTimeout(() => resolve({ timedOut: true }), ms);
    }),
  ]);
}

function criticalEnvelopeAssets() {
  const base = ENVELOPE_ASSET_BASE;
  const scenePhotoEl = document.querySelector(".scene-run-photo");
  const arkEl = document.querySelector(".invite-ark-flora");
  const emblemEl = document.querySelector(".envelope-emblem");
  const sprigEl = document.querySelector(".envelope-sprig");
  const heroMonoEl = document.querySelector(".hero-monogram");

  /* Warm lazy assets so they are ready before the envelope opens. */
  if (arkEl && arkEl.loading === "lazy") {
    arkEl.loading = "eager";
  }

  const fromDom = [
    decodeImageElement(scenePhotoEl),
    decodeImageElement(arkEl),
    decodeImageElement(emblemEl),
    decodeImageElement(sprigEl),
    decodeImageElement(heroMonoEl),
  ];

  const fromSrc = [
    preloadImageSrc(`${base}assets/scene.jpg`),
    preloadImageSrc(`${base}assets/invite-toile-botanical.webp`),
    preloadImageSrc(`${base}assets/invite-floral-ark.webp`),
    preloadImageSrc(`${base}assets/envelope-paper.jpg`),
    preloadImageSrc(`${base}assets/monogram-cut.png`),
    preloadImageSrc(`${base}assets/envelope-sprig.webp`),
  ];

  return Promise.all([...fromDom, ...fromSrc]);
}

function waitForEnvelopeResources() {
  return withTimeout(
    Promise.all([
      waitForWindowLoad(),
      waitForFontsReady(),
      waitForStylesheets(),
      criticalEnvelopeAssets(),
    ]),
    ENVELOPE_LOAD_TIMEOUT_MS
  );
}

function openEnvelope() {
  if (!envelopeReady || envelopeOpened) return;
  envelopeOpened = true;

  const envelopeEl = document.getElementById("envelope");
  const heroMono = document.querySelector(".hero-monogram");
  if (!envelopeEl) return;

  const finish = () => {
    document.documentElement.classList.remove("is-envelope-exiting");
    document.body.classList.remove("is-sealed", "is-envelope-exiting");
    envelopeEl.classList.remove("is-opening", "is-fading");
    envelopeEl.classList.add("is-open");
    envelopeEl.setAttribute("aria-hidden", "true");
    if (heroMono) heroMono.style.opacity = "";
    playHeroBrushWrite();
    requestAnimationFrame(() => updateBrandMorph());
  };

  if (prefersReducedMotion()) {
    finish();
    return;
  }

  document.documentElement.classList.add("is-envelope-exiting");
  document.body.classList.add("is-envelope-exiting");
  document.body.classList.remove("is-sealed");
  envelopeEl.style.pointerEvents = "none";
  void envelopeEl.offsetWidth;
  envelopeEl.classList.add("is-fading");

  let settled = false;
  const done = () => {
    if (settled) return;
    settled = true;
    envelopeEl.removeEventListener("transitionend", onEnd);
    finish();
  };
  const onEnd = (event) => {
    if (event.target !== envelopeEl || event.propertyName !== "opacity") return;
    done();
  };
  envelopeEl.addEventListener("transitionend", onEnd);
  window.setTimeout(done, 900);
}

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function makeBrushPath(width, height, letters) {
  const left = width * 0.02;
  const span = width * 0.96;
  const step = span / letters;
  let d = `M ${left} ${height * 0.28}`;
  for (let i = 0; i < letters; i += 1) {
    const x0 = left + i * step;
    const x1 = x0 + step;
    const xc = (x0 + x1) / 2;
    const descender = i === 9;
    const top = height * (descender ? 0.2 : 0.16);
    const bot = height * (descender ? 0.92 : 0.82);
    const mid = height * 0.48;
    d += ` C ${x0 + step * 0.12} ${bot}, ${xc} ${bot}, ${xc} ${mid}`;
    d += ` C ${xc} ${top}, ${x1} ${top}, ${x1} ${mid}`;
  }
  return d;
}

function attachGoldWriteStroke(svg) {
  const fill = svg.querySelector(".hero-draw-path");
  if (!fill) return;
  const gold = fill.cloneNode(false);
  gold.setAttribute("class", "hero-draw-gold");
  gold.setAttribute("d", fill.getAttribute("d") || "");
  gold.removeAttribute("mask");
  gold.setAttribute("fill", "none");
  gold.setAttribute("pathLength", "1");
  gold.setAttribute("stroke-dasharray", "0.12 0.88");
  gold.setAttribute("stroke-dashoffset", "1");
  svg.appendChild(gold);
}

function attachHeroBrushMask(svg, letters) {
  const fill = svg.querySelector(".hero-draw-path");
  if (!fill || !svg.viewBox?.baseVal) return null;
  const vb = svg.viewBox.baseVal;
  if (vb.width < 1 || vb.height < 1) return null;
  const ns = "http://www.w3.org/2000/svg";
  const id = `hero-brush-${letters}-${Math.random().toString(36).slice(2, 8)}`;
  const defs = document.createElementNS(ns, "defs");
  const mask = document.createElementNS(ns, "mask");
  mask.setAttribute("id", id);
  mask.setAttribute("maskUnits", "userSpaceOnUse");
  const cover = document.createElementNS(ns, "rect");
  cover.setAttribute("x", "0");
  cover.setAttribute("y", "0");
  cover.setAttribute("width", String(vb.width));
  cover.setAttribute("height", String(vb.height));
  cover.setAttribute("fill", "#000");
  const brush = document.createElementNS(ns, "path");
  brush.setAttribute("class", "hero-brush");
  brush.setAttribute("d", makeBrushPath(vb.width, vb.height, letters));
  brush.setAttribute("fill", "none");
  brush.setAttribute("stroke", "#fff");
  brush.setAttribute("stroke-linecap", "round");
  brush.setAttribute("stroke-linejoin", "round");
  brush.setAttribute(
    "stroke-width",
    String(Math.max(vb.height * 0.72, (vb.width / letters) * 1.15))
  );
  brush.setAttribute("pathLength", "1");
  brush.setAttribute("stroke-dasharray", "1");
  brush.setAttribute("stroke-dashoffset", "1");
  const smil = document.createElementNS(ns, "animate");
  smil.setAttribute("attributeName", "stroke-dashoffset");
  smil.setAttribute("from", "1");
  smil.setAttribute("to", "0");
  smil.setAttribute("fill", "freeze");
  smil.setAttribute("calcMode", "spline");
  smil.setAttribute("keySplines", "0.23 1 0.32 1");
  smil.setAttribute("keyTimes", "0;1");
  smil.setAttribute("begin", "indefinite");
  brush.appendChild(smil);
  mask.appendChild(cover);
  mask.appendChild(brush);
  defs.appendChild(mask);
  svg.insertBefore(defs, svg.firstChild);
  const maskUrl = `url("${window.location.pathname}${window.location.search}#${id}")`;
  fill.setAttribute("mask", maskUrl);
  return { brush, smil, fill, maskId: id, maskUrl };
}

function animateBrush(job, durationMs, onDone) {
  const { brush, smil, fill, maskUrl } = job;
  const finish = () => {
    brush.setAttribute("stroke-dashoffset", "0");
    if (onDone) onDone();
  };
  if (smil && typeof smil.beginElement === "function") {
    smil.setAttribute("dur", `${durationMs / 1000}s`);
    let ended = false;
    const onEnd = () => {
      if (ended) return;
      ended = true;
      smil.removeEventListener("endEvent", onEnd);
      finish();
    };
    smil.addEventListener("endEvent", onEnd);
    smil.beginElement();
    window.setTimeout(onEnd, durationMs + 80);
    return;
  }
  const easeOut = (t) => 1 - (1 - t) ** 3;
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / durationMs);
    brush.setAttribute("stroke-dashoffset", String(1 - easeOut(t)));
    fill.setAttribute("mask", maskUrl);
    if (t < 1) {
      window.requestAnimationFrame(tick);
    } else {
      finish();
    }
  };
  window.requestAnimationFrame(tick);
}

let heroCinematicsArmed = false;
const heroBrushJobs = [];

function armHeroCinematics() {
  if (heroCinematicsArmed || !sceneRun) return;
  heroCinematicsArmed = true;
  if (prefersReducedMotion()) {
    sceneRun.classList.add("is-hero-static");
    sceneRun.classList.remove("is-hero-alive", "is-hero-written");
    return;
  }
  sceneRun.classList.add("is-hero-alive");
  sceneRun.classList.remove("is-hero-static");
  const jobs = [
    { sel: ".hero-draw--soft", letters: 3, ms: 1100 },
    { sel: ".hero-draw--main", letters: 14, ms: 2600 },
  ];
  jobs.forEach((job) => {
    const svg = document.querySelector(job.sel);
    if (!svg) return;
    const brush = attachHeroBrushMask(svg, job.letters);
    if (brush) heroBrushJobs.push({ ...brush, ms: job.ms });
    attachGoldWriteStroke(svg);
  });
}

function playHeroBrushWrite() {
  if (!sceneRun || sceneRun.classList.contains("is-hero-static")) return;
  if (!heroBrushJobs.length) {
    sceneRun.classList.add("is-hero-written");
    return;
  }
  let remaining = heroBrushJobs.length;
  let settled = false;
  const done = () => {
    remaining -= 1;
    if (remaining > 0 || settled) return;
    settled = true;
    sceneRun.classList.add("is-hero-written");
  };
  heroBrushJobs.forEach((job) => {
    animateBrush(job, job.ms, done);
  });
}

armHeroCinematics();

(function initEnvelopeLoadGate() {
  const envelope = document.getElementById("envelope");
  if (!envelope) return;

  const seal = envelope.querySelector(".envelope-seal");
  const hint = document.getElementById("envelope-hint");
  let phraseIndex = 0;
  let phraseTimer = null;

  function setHint(text, mode) {
    if (!hint) return;
    hint.textContent = text;
    hint.classList.toggle("is-loading", mode === "loading");
    hint.classList.toggle("is-ready-flash", mode === "ready");
  }

  function stopPhrases() {
    if (phraseTimer) {
      window.clearInterval(phraseTimer);
      phraseTimer = null;
    }
  }

  function startPhrases() {
    if (!hint) return;
    setHint(ENVELOPE_LOADING_PHRASES[0], "loading");
    phraseTimer = window.setInterval(() => {
      phraseIndex = (phraseIndex + 1) % ENVELOPE_LOADING_PHRASES.length;
      setHint(ENVELOPE_LOADING_PHRASES[phraseIndex], "loading");
    }, ENVELOPE_PHRASE_MS);
  }

  function markEnvelopeReady({ timedOut = false } = {}) {
    if (envelopeReady) return;
    envelopeReady = true;
    stopPhrases();

    document.body.classList.remove("is-envelope-loading");
    envelope.classList.remove("is-loading");
    envelope.setAttribute("aria-busy", "false");

    if (seal) {
      seal.setAttribute("aria-disabled", "false");
      seal.setAttribute("aria-label", "Open the invitation");
      seal.removeAttribute("tabindex");
    }

    setHint(timedOut ? "Ready" : "Your invitation is ready", "ready");
    window.setTimeout(() => {
      setHint(envelopeOpenHint(), "open");
    }, ENVELOPE_READY_FLASH_MS);
  }

  startPhrases();

  envelope.addEventListener("click", (event) => {
    if (!envelopeReady) {
      event.preventDefault();
      return;
    }
    openEnvelope();
  });

  seal?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (!envelopeReady) {
      event.preventDefault();
      return;
    }
  });

  waitForEnvelopeResources().then(markEnvelopeReady);
})();

const form = document.getElementById("rsvp-form");
const statusEl = document.getElementById("rsvp-status");

/* Countdown → ceremony (Sept 19, 2026 · 4:00 PM PH) */
const WEDDING_AT = new Date("2026-09-19T16:00:00+08:00").getTime();
const countdownRoot = document.getElementById("rsvp-countdown");

function pad2(value) {
  return String(Math.max(0, value)).padStart(2, "0");
}

function tickCountdown() {
  if (!countdownRoot) return;

  const diff = Math.max(0, WEDDING_AT - Date.now());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  const map = { days, hours, minutes, seconds };
  Object.entries(map).forEach(([unit, value]) => {
    const el = countdownRoot.querySelector(`[data-unit="${unit}"]`);
    if (el) el.textContent = pad2(value);
  });
}

if (countdownRoot) {
  tickCountdown();
  setInterval(tickCountdown, 1000);
}

/* QR → RSVP form section on this site */
const qrImg = document.getElementById("rsvp-qr");
if (qrImg) {
  const formUrl = new URL("#rsvp", window.location.href).href;
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&color=4b1d24&bgcolor=e5ded0&data=${encodeURIComponent(formUrl)}`;
}

/* Childhood photos — show a note in place of any frame whose image is missing */
document.querySelectorAll("img[data-photo-fallback]").forEach((img) => {
  const markEmpty = () => {
    const frame = img.parentElement;
    if (!frame) return;
    frame.dataset.emptyNote = img.dataset.photoFallback;
    frame.classList.add("is-empty");
  };
  img.addEventListener("error", markEmpty);
  if (img.complete && img.naturalWidth === 0) markEmpty();
});

if (form && statusEl) {
  const MAX_EXTRA_GUESTS = 9;
  const COST_PER_EXTRA = 3000;
  const guestsTotalInput = document.getElementById("guests-total");
  const guestsAddBtn = document.getElementById("guests-add-btn");
  const guestsSummary = document.getElementById("guests-summary");
  const guestsExtraCount = document.getElementById("guests-extra-count");
  const guestsEstimate = document.getElementById("guests-estimate");
  const guestsMinus = document.getElementById("guests-minus");
  const guestsPlus = document.getElementById("guests-plus");
  const guestsNotice = document.getElementById("guests-notice");
  const guestsUnderstand = document.getElementById("guests-understand");
  const contactInput = form.querySelector('input[name="email"]');

  let confirmedExtras = 0;
  let draftExtras = 0;
  let modalLastFocus = null;

  const peso = (amount) =>
    `₱${amount.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

  function syncStepperUi(count) {
    if (guestsExtraCount) guestsExtraCount.textContent = String(count);
    if (guestsEstimate) {
      guestsEstimate.innerHTML = `Estimated contribution for extra guests: <strong>${peso(
        count * COST_PER_EXTRA
      )}</strong> <span class="guests-estimate-math">(${count} × ${peso(COST_PER_EXTRA)})</span>`;
    }
    if (guestsMinus) guestsMinus.disabled = count <= 0;
    if (guestsPlus) guestsPlus.disabled = count >= MAX_EXTRA_GUESTS;
  }

  function syncFormGuests() {
    if (guestsTotalInput) guestsTotalInput.value = String(1 + confirmedExtras);
    if (guestsAddBtn) {
      guestsAddBtn.textContent =
        confirmedExtras > 0 ? "Edit guests" : "+ Add a guest";
    }
    if (guestsSummary) {
      if (confirmedExtras > 0) {
        const label = confirmedExtras === 1 ? "1 extra guest" : `${confirmedExtras} extra guests`;
        guestsSummary.hidden = false;
        guestsSummary.innerHTML = `${label} · <strong>${peso(
          confirmedExtras * COST_PER_EXTRA
        )}</strong>`;
      } else {
        guestsSummary.hidden = true;
        guestsSummary.textContent = "";
      }
    }
  }

  function resetGuestsUi() {
    confirmedExtras = 0;
    draftExtras = 0;
    syncStepperUi(0);
    syncFormGuests();
  }

  function getFocusable(root) {
    return [
      ...root.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ),
    ].filter((el) => !el.hasAttribute("hidden") && el.getClientRects().length > 0);
  }

  function onGuestsNoticeKeydown(event) {
    if (!guestsNotice || guestsNotice.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeGuestsNotice({ apply: false });
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = getFocusable(guestsNotice);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openGuestsNotice() {
    if (!guestsNotice) return;
    modalLastFocus = document.activeElement;
    draftExtras = confirmedExtras > 0 ? confirmedExtras : 1;
    syncStepperUi(draftExtras);
    guestsNotice.hidden = false;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onGuestsNoticeKeydown);
    const focusables = getFocusable(guestsNotice);
    (guestsPlus || guestsUnderstand || focusables[0])?.focus();
  }

  function closeGuestsNotice({ apply = false } = {}) {
    if (!guestsNotice || guestsNotice.hidden) return;
    if (apply) {
      confirmedExtras = draftExtras;
      syncFormGuests();
    } else {
      draftExtras = confirmedExtras;
      syncStepperUi(draftExtras);
    }
    guestsNotice.hidden = true;
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onGuestsNoticeKeydown);
    (guestsAddBtn || modalLastFocus)?.focus?.();
  }

  guestsAddBtn?.addEventListener("click", () => {
    openGuestsNotice();
  });

  guestsUnderstand?.addEventListener("click", () => {
    closeGuestsNotice({ apply: true });
  });

  guestsNotice?.querySelectorAll("[data-guests-dismiss]").forEach((el) => {
    el.addEventListener("click", () => closeGuestsNotice({ apply: false }));
  });

  guestsMinus?.addEventListener("click", () => {
    if (draftExtras <= 0) return;
    draftExtras -= 1;
    syncStepperUi(draftExtras);
  });

  guestsPlus?.addEventListener("click", () => {
    if (draftExtras >= MAX_EXTRA_GUESTS) return;
    draftExtras += 1;
    syncStepperUi(draftExtras);
  });

  function isValidContact(value) {
    const raw = value.trim();
    if (!raw) return false;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(raw)) return true;
    const digits = raw.replace(/[\s\-().]/g, "");
    return /^(?:\+?63|0)9\d{9}$/.test(digits);
  }

  syncFormGuests();
  syncStepperUi(0);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusEl.classList.remove("is-error");

    if (contactInput && !isValidContact(contactInput.value)) {
      statusEl.classList.add("is-error");
      statusEl.textContent =
        "Please enter a valid email or Philippine mobile number (e.g. 09XXXXXXXXX).";
      contactInput.focus();
      return;
    }

    if (!GOOGLE_SCRIPT_URL) {
      statusEl.classList.add("is-error");
      statusEl.textContent =
        "Add your Google Apps Script URL in script.js (GOOGLE_SCRIPT_URL) to save responses.";
      return;
    }

    syncFormGuests();
    const data = Object.fromEntries(new FormData(form).entries());
    statusEl.textContent = "Sending your RSVP…";

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      form.reset();
      resetGuestsUi();
      statusEl.textContent = "Thank you — your RSVP was sent. We can’t wait to celebrate with you.";
    } catch (error) {
      statusEl.classList.add("is-error");
      statusEl.textContent = "Something went wrong. Please try again in a moment.";
    }
  });
}

/* Mobile ≤1100: persistent bottom RSVP NOW — navigate, or help finish the form */
const mobileRsvpCta = document.querySelector(".mobile-rsvp-cta");
if (mobileRsvpCta) {
  const submitArea = form?.querySelector(".field--submit");

  function firstIncompleteField() {
    if (!form) return null;
    const nameInput = form.querySelector('input[name="name"]');
    const contact = form.querySelector('input[name="email"]');
    const attendance = form.querySelector('input[name="attendance"]:checked');
    if (nameInput && !nameInput.value.trim()) return nameInput;
    if (contact && !contact.value.trim()) return contact;
    if (!attendance) {
      return form.querySelector('input[name="attendance"]') || submitArea;
    }
    return null;
  }

  function submitAreaInView() {
    if (!form) return false;
    const target = submitArea || form;
    const rect = target.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    return rect.top < vh * 0.82 && rect.bottom > vh * 0.22;
  }

  mobileRsvpCta.addEventListener("click", (event) => {
    event.preventDefault();
    setMobileNavOpen(false, { restoreFocus: false });

    if (!document.body.classList.contains("is-rsvp-view")) {
      scrollToSection("rsvp");
      return;
    }

    if (!form) {
      scrollToSection("rsvp");
      return;
    }

    const incomplete = firstIncompleteField();
    if (incomplete || !submitAreaInView()) {
      const focusTarget = incomplete || submitArea || form;
      /* Mobile: avoid block:"center" latch feel; keep free native scroll positioning. */
      focusTarget.scrollIntoView({
        behavior: "auto",
        block: mqMobileNav.matches ? "nearest" : "center",
      });
      if (incomplete && typeof incomplete.focus === "function") {
        incomplete.focus({ preventScroll: true });
      }
      return;
    }

    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
  });
}

function initTitleGleams() {
  if (prefersReducedMotion()) return;
  document
    .querySelectorAll(
      ".section-title, .invite-title, .rsvp-title-vertical, .sponsors-script--lead"
    )
    .forEach((el) => {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return;
      el.dataset.gleam = text;
      el.classList.add("is-title-gleam");
    });
}

function initDayIconGleams() {
  if (prefersReducedMotion()) return;
  document.querySelectorAll(".day-beat-icon svg").forEach((svg, index) => {
    svg.style.setProperty("--icon-i", String(index));
    svg.querySelectorAll(".day-icon-stroke").forEach((path, pathIndex) => {
      path.style.setProperty("--path-i", String(pathIndex));
    });
  });
}

function initEntourageSparkles() {
  const panel = document.getElementById("entourage");
  const canvas = panel?.querySelector(".entourage-sparkle");
  if (!panel || !canvas || prefersReducedMotion()) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const colors = ["#d2b882", "#b89a62", "#e8d6a8", "#e5ded0", "#c4a574"];
  let particles = [];
  let running = false;
  let lastSpawn = 0;
  let width = 0;
  let height = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = panel.clientWidth;
    height = panel.clientHeight;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function localPoint(event) {
    const rect = panel.getBoundingClientRect();
    const point = event.touches?.[0] || event.changedTouches?.[0] || event;
    return {
      x: point.clientX - rect.left,
      y: point.clientY - rect.top,
    };
  }

  function spawn(x, y, count) {
    if (x < 0 || y < 0 || x > width || y > height) return;
    const n = Math.min(count, 80 - particles.length);
    for (let i = 0; i < n; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 16 + Math.random() * 62;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 28,
        life: 1,
        decay: 0.014 + Math.random() * 0.022,
        size: 1.05 + Math.random() * 2.5,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 8,
        color: colors[(Math.random() * colors.length) | 0],
        star: Math.random() > 0.42,
      });
    }
    if (!running) {
      running = true;
      requestAnimationFrame(tick);
    }
  }

  function drawSpark(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, p.life * p.life);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    if (p.star) {
      ctx.beginPath();
      ctx.moveTo(0, -p.size * 2.4);
      ctx.lineTo(p.size * 0.32, 0);
      ctx.lineTo(0, p.size * 2.4);
      ctx.lineTo(-p.size * 0.32, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-p.size * 2.4, 0);
      ctx.lineTo(0, p.size * 0.32);
      ctx.lineTo(p.size * 2.4, 0);
      ctx.lineTo(0, -p.size * 0.32);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  let lastTime = 0;
  function tick(now) {
    const dt = Math.min(0.05, lastTime ? (now - lastTime) / 1000 : 0.016);
    lastTime = now;
    ctx.clearRect(0, 0, width, height);
    particles = particles.filter((p) => {
      p.vy += 48 * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      p.life -= p.decay * (dt * 60);
      if (p.life <= 0) return false;
      drawSpark(p);
      return true;
    });
    if (particles.length) {
      requestAnimationFrame(tick);
    } else {
      running = false;
      lastTime = 0;
      ctx.clearRect(0, 0, width, height);
    }
  }

  function burst(event, count) {
    const point = localPoint(event);
    spawn(point.x, point.y, count);
  }

  panel.addEventListener(
    "touchstart",
    (event) => {
      lastSpawn = performance.now();
      burst(event, 22);
    },
    { passive: true }
  );
  panel.addEventListener(
    "touchmove",
    (event) => {
      const now = performance.now();
      if (now - lastSpawn < 32) return;
      lastSpawn = now;
      burst(event, 4);
    },
    { passive: true }
  );
  panel.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") return;
    burst(event, 14);
  });

  resize();
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(resize).observe(panel);
  } else {
    window.addEventListener("resize", resize, { passive: true });
  }
}

function initGalleryMotion() {
  if (prefersReducedMotion()) return;
  const items = [...document.querySelectorAll(".more-frame-motion")].flatMap((el) => {
    const frame = el.closest(".more-frame");
    if (!frame) return [];
    if (frame.classList.contains("more-frame--pan-left")) {
      return [{ el, mode: "pan-left", period: 10000 }];
    }
    if (frame.classList.contains("more-frame--zoom-out")) {
      return [{ el, mode: "zoom-out", period: 9000 }];
    }
    if (frame.classList.contains("more-frame--zoom-in")) {
      return [{ el, mode: "zoom-in", period: 9000 }];
    }
    return [];
  });
  if (!items.length) return;

  const pingpong = (ms, period) => {
    const cycle = period * 2;
    let u = (ms % cycle) / period;
    if (u > 1) u = 2 - u;
    return u * u * (3 - 2 * u);
  };

  const start = performance.now();
  const tick = (now) => {
    const elapsed = now - start;
    items.forEach(({ el, mode, period }) => {
      const u = pingpong(elapsed, period);
      let transform = "none";
      if (mode === "pan-left") {
        const x = 10 - 20 * u;
        transform = `translate3d(${x}%, 0, 0) scale(1.22)`;
      } else if (mode === "zoom-in") {
        const s = 1.08 + 0.24 * u;
        transform = `scale(${s})`;
      } else if (mode === "zoom-out") {
        const s = 1.32 - 0.24 * u;
        transform = `scale(${s})`;
      }
      el.style.setProperty("transform", transform, "important");
    });
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

initTitleGleams();
initDayIconGleams();
initEntourageSparkles();
initGalleryMotion();

