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

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const sceneRun = document.querySelector(".scene-run");
const scenePhoto = document.querySelector(".scene-run-photo");
const homePanel = document.getElementById("home");
const storyPanel = document.getElementById("story");

/* Desktop (>1100): top half = page 1, bottom half = page 2 (0% → 50%).
   ≤1100 (hamburger): no shared Home→Invite pan — page-1 hero photo only. */
const mqSceneNarrow = window.matchMedia("(max-width: 1100px)");
const mqScenePhone = window.matchMedia("(max-width: 560px)");

function getScenePhotoYRange() {
  if (mqScenePhone.matches) return { start: 30, end: 30 };
  if (mqSceneNarrow.matches) return { start: 32, end: 32 };
  return { start: 0, end: 50 };
}

function getStoryScrollTop() {
  if (!storyPanel) return 0;
  return storyPanel.getBoundingClientRect().top + window.scrollY;
}

/* 0 = Invite just below the fold, 1 = Invite pinned at top — same scroll that pans the hero */
function getScenePanProgress() {
  if (!homePanel || !storyPanel || prefersReducedMotion) return 1;
  /* Mobile/tablet: no scroll-linked photo pan between Home and Invite */
  if (mqSceneNarrow.matches) return 0;
  const vh = window.innerHeight || 1;
  const top = storyPanel.getBoundingClientRect().top;
  const progress = 1 - top / vh;
  return Math.min(1, Math.max(0, progress));
}

function getScenePhotoFrame() {
  return scenePhoto?.closest(".scene-run-photo-frame") || null;
}

/* ≤1100: mount photo inside #home so it is absolute 100% of page 1 only.
   Desktop keeps it on .scene-run for sticky Home→Invite handoff. */
function syncScenePhotoMount() {
  const frame = getScenePhotoFrame();
  if (!frame || !sceneRun || !homePanel) return;

  if (mqSceneNarrow.matches) {
    if (frame.parentElement !== homePanel) {
      homePanel.insertBefore(frame, homePanel.firstChild);
    }
  } else if (frame.parentElement !== sceneRun) {
    sceneRun.insertBefore(frame, sceneRun.firstChild);
  }
}

/* One-shot mobile park: clear inline pan/crop so CSS owns a static hero.
   Never call from scroll — only init / mq / orientation. */
function parkMobileScenePhoto() {
  if (!scenePhoto || !sceneRun) return;
  syncScenePhotoMount();
  sceneRun.style.setProperty("--scene-pan", "0");
  sceneRun.style.removeProperty("--scene-photo-y");
  sceneRun.classList.remove("is-photo-anchored", "is-photo-ken-paused");
  scenePhoto.style.removeProperty("object-position");
  scenePhoto.style.removeProperty("transform");
  /* Lock layout height in px so URL-bar show/hide cannot reflow/“zoom” the cover crop. */
  const h = document.documentElement.clientHeight || window.innerHeight || 0;
  if (h > 0) {
    const heroH = `${h}px`;
    sceneRun.style.setProperty("--mobile-hero-h", heroH);
    if (homePanel) homePanel.style.setProperty("--mobile-hero-h", heroH);
  }
}

function updateScenePan() {
  if (!scenePhoto || !sceneRun || prefersReducedMotion) return;

  /* ≤1100: never pan, scale, or rewrite object-position on scroll */
  if (mqSceneNarrow.matches) return;

  const progress = getScenePanProgress();
  const storyTop = getStoryScrollTop();
  /* Wider hysteresis + only anchor once Invite wash nearly covers the photo,
     so fixed→absolute doesn't fire while brand morph is still settling. */
  const wasAnchored = sceneRun.classList.contains("is-photo-anchored");
  const anchorEnter = storyTop + 12;
  const anchorLeave = storyTop - 28;
  const anchored = wasAnchored
    ? window.scrollY >= anchorLeave
    : window.scrollY >= anchorEnter && progress >= 0.97;
  const pan = Math.min(1, progress);
  const { start, end } = getScenePhotoYRange();
  const photoY = start + progress * (end - start);

  sceneRun.style.setProperty("--scene-pan", pan.toFixed(4));
  sceneRun.style.setProperty("--scene-photo-y", `${photoY.toFixed(2)}%`);

  sceneRun.classList.toggle("is-photo-anchored", anchored);
  /* Keep inline object-position continuous — never let the anchored CSS rule snap crop. */
  scenePhoto.style.objectPosition = `center ${photoY.toFixed(2)}%`;
}

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;

  /* Nav clicks may smooth-scroll on desktop; mobile stays instant (no motion feel). */
  const scrollBehavior =
    prefersReducedMotion || mqSceneNarrow.matches ? "auto" : "smooth";
  const { start: photoYStart, end: photoYEnd } = getScenePhotoYRange();
  const mobileScene = mqSceneNarrow.matches;

  if (id === "story" && scenePhoto && !prefersReducedMotion && !mobileScene) {
    sceneRun?.classList.add("is-photo-anchored");
    sceneRun?.style.setProperty("--scene-pan", "1");
    sceneRun?.style.setProperty("--scene-photo-y", `${photoYEnd}%`);
    scenePhoto.style.objectPosition = `center ${photoYEnd}%`;
  }

  /* Sticky #home already sits at top≈0 while Invite covers it, so
     scrollIntoView({ block: "start" }) no-ops. Jump to document top. */
  if (id === "home") {
    if (scenePhoto && !prefersReducedMotion) {
      if (mobileScene) {
        parkMobileScenePhoto();
      } else {
        sceneRun?.classList.remove("is-photo-anchored");
        sceneRun?.style.setProperty("--scene-pan", "0");
        sceneRun?.style.setProperty("--scene-photo-y", `${photoYStart}%`);
        scenePhoto.style.objectPosition = `center ${photoYStart}%`;
      }
    }

    window.scrollTo({ top: 0, behavior: scrollBehavior });
    setActivePill("home");
    requestAnimationFrame(() => {
      updateScenePan();
      updateBrandMorph();
    });
    return;
  }

  target.scrollIntoView({
    behavior: scrollBehavior,
    block: "start",
  });
  requestAnimationFrame(() => {
    updateScenePan();
    updateBrandMorph();
  });
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

/* More page — HTML5 preview of Slower I Go (local copy of iTunes ~30s preview) */
const MORE_PREVIEW_URL = `${import.meta.env?.BASE_URL ?? ""}assets/slower-i-go-preview.m4a`;
const MORE_FADE_MS = 1200;
const MORE_TARGET_VOLUME = 0.65;

const morePanel = document.querySelector('[data-panel="more"]');
const moreAudio = new Audio(MORE_PREVIEW_URL);
moreAudio.preload = "none";
moreAudio.loop = true;
moreAudio.volume = 0;

let moreAudioUnlocked = false;
let moreAudioWanted = false;
let moreFadeRaf = null;
/* True after user engages Spotify embed — blocks preview until leaving More */
let morePausedForSpotify = false;

function unlockMoreAudio() {
  if (moreAudioUnlocked) return;
  moreAudioUnlocked = true;
  if (moreAudio.preload !== "auto") {
    moreAudio.preload = "auto";
    moreAudio.load();
  }
  moreAudio.volume = 0;
  const playPromise = moreAudio.play();
  if (playPromise && typeof playPromise.then === "function") {
    playPromise
      .then(() => {
        moreAudio.pause();
        moreAudio.currentTime = 0;
        if (moreAudioWanted) fadeMoreAudio(true);
      })
      .catch(() => {
        moreAudioUnlocked = false;
      });
  }
}

function fadeMoreAudio(fadeIn) {
  if (moreFadeRaf) {
    cancelAnimationFrame(moreFadeRaf);
    moreFadeRaf = null;
  }

  moreAudioWanted = fadeIn;
  const from = moreAudio.volume;
  const to = fadeIn ? MORE_TARGET_VOLUME : 0;
  const start = performance.now();

  if (fadeIn) {
    if (!moreAudioUnlocked) return;
    const playPromise = moreAudio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }

  function tick(now) {
    const t = Math.min(1, (now - start) / MORE_FADE_MS);
    const eased = t * (2 - t);
    moreAudio.volume = from + (to - from) * eased;
    if (t < 1) {
      moreFadeRaf = requestAnimationFrame(tick);
      return;
    }
    moreFadeRaf = null;
    if (!fadeIn) {
      moreAudio.pause();
    }
  }

  moreFadeRaf = requestAnimationFrame(tick);
}

function setMoreAudioActive(active) {
  if (active && morePausedForSpotify) return;
  if (active && moreAudio.preload !== "auto") {
    moreAudio.preload = "auto";
    moreAudio.load();
  }
  fadeMoreAudio(Boolean(active));
}

function pauseMorePreviewForSpotify() {
  if (morePausedForSpotify) return;
  morePausedForSpotify = true;
  fadeMoreAudio(false);
}

const spotifyEmbed = document.querySelector("[data-spotify-embed]");
if (spotifyEmbed) {
  const catcher = spotifyEmbed.querySelector(".playlist-spotify-catcher");
  const engageSpotify = () => {
    pauseMorePreviewForSpotify();
    spotifyEmbed.classList.add("is-spotify-engaged");
  };

  if (catcher) {
    /* Hide catcher on pointerdown so the following click can reach the iframe */
    catcher.addEventListener("pointerdown", engageSpotify);
  } else {
    spotifyEmbed.addEventListener("pointerdown", pauseMorePreviewForSpotify);
    spotifyEmbed.addEventListener("focusin", pauseMorePreviewForSpotify);
  }
}

/* HOME → INVITE shared-element morph (scroll-driven FLIP ghosts) */
const brandMorphPairs = [
  { id: "name-nigel", kind: "text" },
  { id: "seal", kind: "img" },
  { id: "name-mary", kind: "text" },
  { id: "amp", kind: "amp" },
  { id: "meta", kind: "meta" },
];

let brandMorphLayer = null;
let brandMorphGhosts = null;
let brandMorphState = "idle"; // idle | morphing | settled

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
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

function ensureBrandMorphLayer() {
  if (brandMorphLayer) return brandMorphLayer;
  brandMorphLayer = document.createElement("div");
  brandMorphLayer.className = "brand-morph-layer";
  brandMorphLayer.setAttribute("aria-hidden", "true");
  document.body.appendChild(brandMorphLayer);

  brandMorphGhosts = {};
  brandMorphPairs.forEach(({ id, kind }) => {
    const from = document.querySelector(`[data-morph="${id}"]`);
    const to = document.querySelector(`[data-morph-target="${id}"]`);
    if (!to && kind !== "amp") return;
    if (kind !== "amp" && !from) return;

    let ghost;
    if (kind === "img") {
      ghost = from.cloneNode(true);
      ghost.removeAttribute("data-morph");
      ghost.removeAttribute("alt");
      ghost.className = "brand-morph-ghost is-img";
    } else if (kind === "meta") {
      ghost = from.cloneNode(true);
      ghost.removeAttribute("data-morph");
      ghost.className = "brand-morph-ghost is-meta";
    } else if (kind === "amp") {
      ghost = document.createElement("span");
      ghost.className = "brand-morph-ghost is-amp";
      ghost.textContent = "&";
    } else {
      ghost = document.createElement("span");
      ghost.className = "brand-morph-ghost is-text";
      ghost.textContent = from.textContent.trim();
    }

    brandMorphLayer.appendChild(ghost);
    brandMorphGhosts[id] = { ghost, kind, from, to };
  });

  return brandMorphLayer;
}

/* Settle window: ghosts fade out while real Invite targets fade in (overlap, never both 0). */
const BRAND_CROSSFADE_START = 0.86;
const BRAND_SETTLE_END = 0.995;

function brandCrossfadeAmount(progress) {
  if (progress <= BRAND_CROSSFADE_START) return 0;
  if (progress >= BRAND_SETTLE_END) return 1;
  return smoothstep(
    (progress - BRAND_CROSSFADE_START) / (BRAND_SETTLE_END - BRAND_CROSSFADE_START)
  );
}

function paintBrandGhost(entry, t, ghostOpacity, forceMeasure) {
  const { ghost, kind, from, to } = entry;
  if (!to) {
    ghost.style.opacity = "0";
    return;
  }

  // Amp has no page-1 source — invent a start between the hero names / monogram
  let fromRect;
  if (kind === "amp") {
    const sealFrom = document.querySelector('[data-morph="seal"]');
    const base = sealFrom ? readRect(sealFrom) : readRect(to);
    fromRect = {
      left: base.left + base.width * 0.35,
      top: base.top + base.height * 0.2,
      width: Math.max(8, base.width * 0.22),
      height: Math.max(10, base.height * 0.28),
    };
  } else if (!from) {
    ghost.style.opacity = "0";
    return;
  } else {
    fromRect = readRect(from);
  }

  /* Live #story rect so ghosts track Invite as it rises with the same pan progress */
  const toRect = readRect(to);
  if (toRect.width < 1 || toRect.height < 1) {
    ghost.style.opacity = "0";
    return;
  }

  const left = lerp(fromRect.left, toRect.left, t);
  const top = lerp(fromRect.top, toRect.top, t);
  const width = lerp(fromRect.width, toRect.width, t);
  const height = lerp(fromRect.height, toRect.height, t);
  const gOp = Math.max(0, Math.min(1, ghostOpacity));

  if (kind === "img") {
    ghost.style.left = `${left}px`;
    ghost.style.top = `${top}px`;
    ghost.style.width = `${width}px`;
    ghost.style.height = `${height}px`;
    ghost.style.transform = "";
    ghost.style.opacity = String(gOp);
    ghost.style.filter = `drop-shadow(0 4px 14px rgba(0, 0, 0, ${lerp(0.35, 0.12, t)}))`;
    return;
  }

  if (kind === "amp") {
    const toStyle = getComputedStyle(to);
    const cx = left + width / 2;
    const cy = top + height / 2;
    ghost.style.left = `${cx}px`;
    ghost.style.top = `${cy}px`;
    ghost.style.width = "auto";
    ghost.style.height = "auto";
    ghost.style.transform = "translate(-50%, -50%)";
    ghost.style.fontSize = toStyle.fontSize;
    ghost.style.color = toStyle.color;
    ghost.style.opacity = String(smoothstep((t - 0.28) / 0.55) * gOp);
    return;
  }

  if (kind === "text") {
    const fromStyle = getComputedStyle(from);
    const toStyle = getComputedStyle(to);
    const fs = lerp(parseFloat(fromStyle.fontSize), parseFloat(toStyle.fontSize), t);
    const ls = lerp(parseFloat(fromStyle.letterSpacing) || 0, parseFloat(toStyle.letterSpacing) || 0, t);
    const cx = left + width / 2;
    const cy = top + height / 2;
    ghost.style.left = `${cx}px`;
    ghost.style.top = `${cy}px`;
    ghost.style.width = "auto";
    ghost.style.height = "auto";
    ghost.style.transform = "translate(-50%, -50%)";
    ghost.style.fontSize = `${fs}px`;
    ghost.style.letterSpacing = `${ls}px`;

    const tw = toStyle.color.match(/rgba?\(([^)]+)\)/);
    let tr = 42;
    let tg = 61;
    let tb = 85;
    let ta = 0.78;
    if (tw) {
      const parts = tw[1].split(",").map((p) => parseFloat(p.trim()));
      tr = parts[0];
      tg = parts[1];
      tb = parts[2];
      ta = parts.length > 3 ? parts[3] : 1;
    }
    const r = Math.round(lerp(255, tr, t));
    const g = Math.round(lerp(255, tg, t));
    const b = Math.round(lerp(255, tb, t));
    const a = lerp(1, ta, t);
    ghost.style.color = `rgba(${r}, ${g}, ${b}, ${a})`;
    ghost.style.textShadow =
      t < 0.65
        ? `0 2px 14px rgba(0, 0, 0, ${lerp(0.35, 0, t / 0.65)})`
        : "none";
    ghost.style.opacity = String(gOp);
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
    ghost.style.opacity = String(gOp);

    const ink = lerp(255, 42, t);
    const inkG = lerp(255, 61, t);
    const inkB = lerp(255, 85, t);
    const soft = `rgba(${Math.round(ink)}, ${Math.round(inkG)}, ${Math.round(inkB)}, ${lerp(0.88, 0.82, t)})`;
    const day = `rgb(${Math.round(ink)}, ${Math.round(inkG)}, ${Math.round(inkB)})`;
    ghost.querySelectorAll(
      ".hero-meta-time, .hero-meta-year, .hero-meta-place, .hero-date-side"
    ).forEach((el) => {
      el.style.color = soft;
      el.style.textShadow =
        t < 0.55 ? `0 2px 12px rgba(0, 0, 0, ${lerp(0.3, 0, t / 0.55)})` : "none";
    });
    const dayEl = ghost.querySelector(".hero-date-day");
    if (dayEl) {
      dayEl.style.color = day;
      dayEl.style.textShadow =
        t < 0.55 ? `0 2px 12px rgba(0, 0, 0, ${lerp(0.3, 0, t / 0.55)})` : "none";
    }
  }
}

function setBrandMorphVars(ghostOpacity, realOpacity) {
  sceneRun.style.setProperty("--brand-ghost-opacity", ghostOpacity.toFixed(4));
  sceneRun.style.setProperty("--brand-real-opacity", realOpacity.toFixed(4));
}

function updateBrandMorph(_forceMeasure = false) {
  if (!sceneRun) return;
  /* Invite is fully static: no Home→Invite brand morph / ghost slide on any viewport.
     Desktop shared photo pan still runs via updateScenePan (home side only). */
  if (
    brandMorphState !== "idle" ||
    sceneRun.classList.contains("is-brand-morphing") ||
    sceneRun.classList.contains("is-brand-settled") ||
    sceneRun.classList.contains("is-brand-handing-off")
  ) {
    sceneRun.classList.remove(
      "is-brand-morphing",
      "is-brand-settled",
      "is-brand-handing-off"
    );
    brandMorphState = "idle";
    setBrandMorphVars(0, 0);
    if (brandMorphLayer) brandMorphLayer.classList.remove("is-active");
  }
}

/* 30% in / 30% out — each section fades independently */
if (panels.length) {
  const ratios = new Map();

  function updateInviteWash() {
    if (!storyPanel) return;
    /* Binary settled look — no scroll-tweened opacity (felt like bg/items moving) */
    const vh = window.innerHeight || 1;
    const rect = storyPanel.getBoundingClientRect();
    const visible = rect.bottom > 0 && rect.top < vh;
    storyPanel.style.setProperty("--invite-pattern", visible ? "1" : "0");
    storyPanel.style.setProperty("--invite-wash", visible ? "0.92" : "0");
  }

  let sceneTick = false;
  const scheduleSceneTick = (forceMeasure = false) => {
    if (mqSceneNarrow.matches) return;
    if (sceneTick) return;
    sceneTick = true;
    requestAnimationFrame(() => {
      sceneTick = false;
      updateScenePan();
      updateInviteWash();
      updateBrandMorph(forceMeasure);
    });
  };
  window.addEventListener("scroll", () => scheduleSceneTick(false), {
    passive: true,
  });
  /* Ignore visualViewport / URL-bar resize churn on narrow — it reflows the cover crop. */
  window.addEventListener(
    "resize",
    () => {
      if (mqSceneNarrow.matches) return;
      scheduleSceneTick(true);
    },
    { passive: true }
  );
  const onSceneMqChange = () => {
    if (mqSceneNarrow.matches) {
      parkMobileScenePhoto();
      updateInviteWash();
      updateBrandMorph(false);
      return;
    }
    syncScenePhotoMount();
    sceneRun?.style.removeProperty("--mobile-hero-h");
    if (homePanel) homePanel.style.removeProperty("--mobile-hero-h");
    scheduleSceneTick(true);
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
      if (mqSceneNarrow.matches) {
        window.setTimeout(parkMobileScenePhoto, 50);
      }
    },
    { passive: true }
  );
  if (mqSceneNarrow.matches) parkMobileScenePhoto();
  else updateScenePan();
  updateInviteWash();
  updateBrandMorph(true);

  /* Pause Ken Burns while the park photo isn’t on screen (saves paint). Desktop only. */
  if (sceneRun && scenePhoto && !prefersReducedMotion && !mqSceneNarrow.matches) {
    const kenIo = new IntersectionObserver(
      ([entry]) => {
        sceneRun.classList.toggle(
          "is-photo-ken-paused",
          !(entry?.isIntersecting)
        );
      },
      { root: null, rootMargin: "8% 0px", threshold: 0 }
    );
    const kenTarget =
      sceneRun.querySelector(".scene-run-photo-frame") || scenePhoto;
    kenIo.observe(kenTarget);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const panel = entry.target;
        ratios.set(panel, entry.intersectionRatio);
        const nowInview = entry.intersectionRatio >= 0.3;
        const wasInview = panel.classList.contains("is-inview");
        panel.classList.toggle("is-inview", nowInview);

        if (panel === morePanel && wasInview !== nowInview) {
          if (!nowInview) {
            morePausedForSpotify = false;
            spotifyEmbed?.classList.remove("is-spotify-engaged");
          }
          setMoreAudioActive(nowInview);
        }
      });

      updateInviteWash();

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

/* Invite floral-ark butterfly — flap + waypoint flight between perch blooms */
(function initInviteButterfly() {
  const butterfly = document.querySelector("[data-invite-butterfly]");
  const ark = document.querySelector(".invite-ark");
  if (!butterfly || !ark || !storyPanel) return;

  /* Percent positions across the floral ark (left bloom → apex → right) */
  const PERCHES = [
    { x: 11, y: 58, r: -22 },
    { x: 28, y: 24, r: 14 },
    { x: 49, y: 9, r: -8 },
    { x: 74, y: 26, r: 18 },
    { x: 90, y: 52, r: -16 },
  ];

  const EASE_FLIGHT = "cubic-bezier(0.77, 0, 0.175, 1)";
  let perchIndex = 2;
  let active = false;
  let flightAnim = null;
  let loopToken = 0;

  function motionOff() {
    /* Invite layers stay static while scrolling — no flight on any viewport */
    return true;
  }

  function perchTransform(perch) {
    const w = ark.offsetWidth || 1;
    const h = ark.offsetHeight || 1;
    const x = (perch.x / 100) * w;
    const y = (perch.y / 100) * h;
    return `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${perch.r}deg)`;
  }

  function arcTransform(from, to) {
    const w = ark.offsetWidth || 1;
    const h = ark.offsetHeight || 1;
    const mx = ((from.x + to.x) / 2 / 100) * w;
    const my = ((Math.min(from.y, to.y) - 14) / 100) * h;
    const mr = (from.r + to.r) / 2;
    return `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%) rotate(${mr}deg) scale(1.04)`;
  }

  function setPose(perch) {
    butterfly.style.transform = perchTransform(perch);
  }

  function setFlying(isFlying) {
    butterfly.classList.toggle("is-flying", isFlying);
    butterfly.classList.toggle("is-perched", !isFlying);
  }

  function wait(ms, token) {
    return new Promise((resolve) => {
      window.setTimeout(() => resolve(token === loopToken), ms);
    });
  }

  async function flyTo(next, token) {
    const from = PERCHES[perchIndex];
    const duration = 2400 + Math.random() * 700;
    setFlying(true);

    if (flightAnim) {
      flightAnim.cancel();
      flightAnim = null;
    }

    flightAnim = butterfly.animate(
      [
        { transform: perchTransform(from), offset: 0 },
        { transform: arcTransform(from, next), offset: 0.48 },
        { transform: perchTransform(next), offset: 1 },
      ],
      {
        duration,
        easing: EASE_FLIGHT,
        fill: "forwards",
      }
    );

    try {
      await flightAnim.finished;
      if (typeof flightAnim.commitStyles === "function") {
        flightAnim.commitStyles();
      }
      flightAnim.cancel();
    } catch {
      /* cancelled on pause / resize */
    }

    if (token !== loopToken) return false;
    flightAnim = null;
    perchIndex = PERCHES.indexOf(next);
    setPose(next);
    setFlying(false);
    return true;
  }

  async function loop(token) {
    setPose(PERCHES[perchIndex]);
    setFlying(false);

    while (active && token === loopToken) {
      const rest = 2200 + Math.random() * 1800;
      const still = await wait(rest, token);
      if (!still || !active) break;

      let nextIndex = Math.floor(Math.random() * PERCHES.length);
      if (nextIndex === perchIndex) {
        nextIndex = (perchIndex + 1 + Math.floor(Math.random() * (PERCHES.length - 1))) % PERCHES.length;
      }
      const ok = await flyTo(PERCHES[nextIndex], token);
      if (!ok) break;
    }
  }

  function start() {
    if (motionOff() || active) return;
    active = true;
    loopToken += 1;
    loop(loopToken);
  }

  function stop() {
    active = false;
    loopToken += 1;
    if (flightAnim) {
      flightAnim.cancel();
      flightAnim = null;
    }
    setFlying(false);
    setPose(PERCHES[perchIndex]);
  }

  function parkStatic() {
    stop();
    butterfly.classList.add("is-perched");
    butterfly.classList.remove("is-flying");
    perchIndex = 2;
    butterfly.style.transform = "";
  }

  const syncVisibility = () => {
    if (motionOff()) {
      parkStatic();
      return;
    }
    if (storyPanel.classList.contains("is-inview")) start();
    else stop();
  };

  const visibilityObserver = new MutationObserver(syncVisibility);
  visibilityObserver.observe(storyPanel, {
    attributes: true,
    attributeFilter: ["class"],
  });

  window.addEventListener(
    "resize",
    () => {
      if (motionOff()) {
        parkStatic();
        return;
      }
      if (!active) setPose(PERCHES[perchIndex]);
      else if (!flightAnim) setPose(PERCHES[perchIndex]);
    },
    { passive: true }
  );

  if (typeof mqSceneNarrow.addEventListener === "function") {
    mqSceneNarrow.addEventListener("change", syncVisibility);
  }

  syncVisibility();
})();

/* Love Story — loop “Once upon a time” while the panel is in view */
(function initLoveStoryTypewriter() {
  const lovePanel = document.querySelector('[data-panel="love"]');
  const kicker = document.querySelector(".love-story-kicker[data-typewriter]");
  const textEl = kicker?.querySelector(".love-story-kicker-text");
  if (!lovePanel || !kicker || !textEl) return;

  const fullText = (textEl.textContent || "Once upon a time").trim();
  const TYPE_MS = 92;
  const DELETE_MS = 54;
  const HOLD_MS = 2800;
  const GAP_MS = 780;
  const START_DELAY_MS = 640;

  let active = false;
  let timer = null;

  function motionOff() {
    return prefersReducedMotion || mqSceneNarrow.matches;
  }

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function showFull() {
    clearTimer();
    textEl.textContent = fullText;
    kicker.classList.remove("is-typing", "is-cursor");
  }

  function schedule(fn, ms) {
    clearTimer();
    timer = setTimeout(fn, ms);
  }

  function typeForward(i = 0) {
    if (!active) return;
    kicker.classList.add("is-typing");
    kicker.classList.remove("is-cursor");

    if (i < fullText.length) {
      textEl.textContent = fullText.slice(0, i + 1);
      schedule(() => typeForward(i + 1), TYPE_MS);
      return;
    }

    kicker.classList.remove("is-typing");
    kicker.classList.add("is-cursor");
    schedule(deleteBack, HOLD_MS);
  }

  function deleteBack(i = fullText.length) {
    if (!active) return;
    kicker.classList.add("is-typing");
    kicker.classList.remove("is-cursor");

    if (i > 0) {
      textEl.textContent = fullText.slice(0, i - 1);
      schedule(() => deleteBack(i - 1), DELETE_MS);
      return;
    }

    textEl.textContent = "";
    schedule(() => typeForward(0), GAP_MS);
  }

  function startLoop() {
    if (active || motionOff()) return;
    active = true;
    textEl.textContent = "";
    kicker.classList.add("is-typing");
    kicker.classList.remove("is-cursor");
    schedule(() => typeForward(0), START_DELAY_MS);
  }

  function pauseLoop() {
    if (!active) return;
    active = false;
    clearTimer();
    textEl.textContent = "";
    kicker.classList.add("is-typing");
    kicker.classList.remove("is-cursor");
  }

  if (motionOff()) {
    showFull();
  } else {
    textEl.textContent = "";
    kicker.classList.add("is-typing");
  }

  const sync = () => {
    if (motionOff()) {
      active = false;
      showFull();
      return;
    }
    if (lovePanel.classList.contains("is-inview")) startLoop();
    else pauseLoop();
  };

  const visibilityObserver = new MutationObserver(sync);
  visibilityObserver.observe(lovePanel, {
    attributes: true,
    attributeFilter: ["class"],
  });

  if (typeof mqSceneNarrow.addEventListener === "function") {
    mqSceneNarrow.addEventListener("change", sync);
  }

  sync();
})();

let envelopeOpened = false;

function openEnvelope() {
  if (envelopeOpened) return;
  envelopeOpened = true;
  unlockMoreAudio();

  const envelopeEl = document.getElementById("envelope");
  const sealEmblem = envelopeEl?.querySelector(".envelope-emblem");
  const heroMono = document.querySelector(".hero-monogram");
  if (!envelopeEl || !sealEmblem || !heroMono) return;

  const finish = () => {
    document.body.classList.remove("is-sealed");
    envelopeEl.classList.add("is-open");
    envelopeEl.setAttribute("aria-hidden", "true");
    heroMono.style.opacity = "";
  };

  if (prefersReducedMotion || mqSceneNarrow.matches) {
    finish();
    return;
  }

  const from = sealEmblem.getBoundingClientRect();
  const to = heroMono.getBoundingClientRect();
  const flyer = sealEmblem.cloneNode(true);
  flyer.className = "envelope-flyer";
  flyer.style.position = "fixed";
  flyer.style.left = `${from.left}px`;
  flyer.style.top = `${from.top}px`;
  flyer.style.width = `${from.width}px`;
  flyer.style.height = `${from.height}px`;
  flyer.style.margin = "0";
  document.body.appendChild(flyer);
  sealEmblem.style.opacity = "0";
  envelopeEl.classList.add("is-opening");

  const dx = to.left - from.left;
  const dy = to.top - from.top;
  const scale = to.width / from.width;

  const flight = flyer.animate(
    [
      { transform: "translate(0, 0) scale(1)" },
      {
        transform: `translate(${dx * 0.48}px, ${dy * 0.42 - 36}px) scale(${1 + (scale - 1) * 0.48})`,
      },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
    ],
    {
      duration: 1100,
      easing: "cubic-bezier(0.77, 0, 0.175, 1)",
      fill: "forwards",
    }
  );

  window.setTimeout(() => envelopeEl.classList.add("is-open"), 380);

  flight.finished.finally(() => {
    flyer.remove();
    finish();
  });
}

const envelope = document.getElementById("envelope");
if (envelope) {
  envelope.addEventListener("click", openEnvelope);
}

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

/* Gifts QR — uses assets/gifts-qr.png when present, else a placeholder code */
const giftsQr = document.getElementById("gifts-qr");
if (giftsQr) {
  const fallback = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&color=4b1d24&bgcolor=e5ded0&data=${encodeURIComponent("Monetary gift for Nigel & Mary — thank you!")}`;
  giftsQr.addEventListener("error", () => {
    giftsQr.src = fallback;
  });
  // Probe missing local asset quickly
  fetch(`${import.meta.env?.BASE_URL ?? ""}assets/gifts-qr.png`, { method: "HEAD" })
    .then((res) => {
      if (!res.ok) giftsQr.src = fallback;
    })
    .catch(() => {
      giftsQr.src = fallback;
    });
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
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: mqMobileNav.matches ? "nearest" : "center",
      });
      if (incomplete && typeof incomplete.focus === "function") {
        window.setTimeout(
          () => incomplete.focus({ preventScroll: true }),
          prefersReducedMotion ? 0 : 320
        );
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
