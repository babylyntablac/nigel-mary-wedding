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
    return;
  }

  target.scrollIntoView({
    behavior: scrollBehavior,
    block: "start",
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

/* Brand morph / FLIP ghosts removed — no scroll-driven shared-element handoff. */
if (sceneRun) {
  sceneRun.classList.remove(
    "is-brand-morphing",
    "is-brand-settled",
    "is-brand-handing-off"
  );
  sceneRun.style.setProperty("--brand-ghost-opacity", "0");
  sceneRun.style.setProperty("--brand-real-opacity", "0");
}

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

/* Pill active state + More audio — no style morphs tied to scroll. */
if (panels.length) {
  const ratios = new Map();

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
  unlockMoreAudio();

  const envelopeEl = document.getElementById("envelope");
  const heroMono = document.querySelector(".hero-monogram");
  if (!envelopeEl) return;

  /* Instant open — no WAAPI flight, flap tween, or delayed fade. */
  document.body.classList.remove("is-sealed");
  envelopeEl.classList.remove("is-opening");
  envelopeEl.classList.add("is-open");
  envelopeEl.setAttribute("aria-hidden", "true");
  if (heroMono) heroMono.style.opacity = "";
}

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
