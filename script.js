const pills = [...document.querySelectorAll(".pill-nav .pill")];
const panels = [...document.querySelectorAll("[data-panel]")];

// Paste your Google Apps Script Web App URL here after deploying Code.gs
const GOOGLE_SCRIPT_URL = "";

// Optional: Google Drive / shared album link for guest photo uploads
const PHOTO_ALBUM_URL = "";

// Optional: contact email for vendor / share inquiries
const CONTACT_EMAIL = "";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const sceneRun = document.querySelector(".scene-run");
const scenePhoto = document.querySelector(".scene-run-photo");
const scenePanTrack = document.querySelector(".scene-pan-track");
const homePanel = document.getElementById("home");
const storyPanel = document.getElementById("story");

/* Top half of image = page 1, bottom half = page 2 */
const SCENE_PHOTO_Y_END = 50;

function getScenePanDistance() {
  if (!scenePanTrack) return window.innerHeight;
  return scenePanTrack.offsetHeight || window.innerHeight;
}

function getStoryScrollTop() {
  if (!storyPanel) return 0;
  return storyPanel.getBoundingClientRect().top + window.scrollY;
}

function getScenePanProgress() {
  if (!homePanel || prefersReducedMotion) return 1;
  const panDistance = getScenePanDistance();
  if (panDistance <= 0) return 1;
  const progress = window.scrollY / panDistance;
  return Math.min(1, Math.max(0, progress));
}

function updateScenePan() {
  if (!scenePhoto || !sceneRun || prefersReducedMotion) return;

  const progress = getScenePanProgress();
  const storyTop = getStoryScrollTop();
  const anchored = window.scrollY >= storyTop - 2;
  const pan = Math.min(1, progress);
  const photoY = progress * SCENE_PHOTO_Y_END;

  sceneRun.style.setProperty("--scene-pan", pan.toFixed(4));
  sceneRun.style.setProperty("--scene-photo-y", `${photoY.toFixed(2)}%`);

  sceneRun.classList.toggle("is-photo-anchored", anchored);
  scenePhoto.style.objectPosition = `center ${photoY.toFixed(2)}%`;
}

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;

  if (id === "story" && scenePhoto && !prefersReducedMotion) {
    sceneRun?.classList.add("is-photo-anchored");
    sceneRun?.style.setProperty("--scene-pan", "1");
    sceneRun?.style.setProperty("--scene-photo-y", `${SCENE_PHOTO_Y_END}%`);
    scenePhoto.style.objectPosition = `center ${SCENE_PHOTO_Y_END}%`;
  }

  if (id === "home" && scenePhoto && !prefersReducedMotion) {
    sceneRun?.classList.remove("is-photo-anchored");
    sceneRun?.style.setProperty("--scene-pan", "0");
    sceneRun?.style.setProperty("--scene-photo-y", "0%");
    scenePhoto.style.objectPosition = "center top";
  }

  target.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "start",
  });
}

function setActivePill(id) {
  pills.forEach((pill) => {
    pill.classList.toggle("is-active", pill.dataset.section === id);
  });
}

pills.forEach((pill) => {
  pill.addEventListener("click", (event) => {
    event.preventDefault();
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
const MORE_PREVIEW_URL = `${import.meta.env.BASE_URL}assets/slower-i-go-preview.m4a`;
const MORE_FADE_MS = 1200;
const MORE_TARGET_VOLUME = 0.65;

const morePanel = document.querySelector('[data-panel="more"]');
const moreAudio = new Audio(MORE_PREVIEW_URL);
moreAudio.preload = "auto";
moreAudio.loop = true;
moreAudio.volume = 0;

let moreAudioUnlocked = false;
let moreAudioWanted = false;
let moreFadeRaf = null;

function unlockMoreAudio() {
  if (moreAudioUnlocked) return;
  moreAudioUnlocked = true;
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
  fadeMoreAudio(Boolean(active));
}

/* 30% in / 30% out — each section fades independently */
if (panels.length) {
  const ratios = new Map();

  function updateInviteWash() {
    if (!storyPanel) return;
    const vh = window.innerHeight || 1;
    const top = storyPanel.getBoundingClientRect().top;
    // 0 when story is still below the fold, 1 when fully pinned in view
    const t = 1 - Math.min(1, Math.max(0, top / vh));
    const eased = t * t * (3 - 2 * t);
    storyPanel.style.setProperty("--invite-pattern", eased.toFixed(4));
    storyPanel.style.setProperty("--invite-wash", (eased * 0.92).toFixed(4));
  }

  let sceneTick = false;
  window.addEventListener(
    "scroll",
    () => {
      if (sceneTick) return;
      sceneTick = true;
      requestAnimationFrame(() => {
        sceneTick = false;
        updateScenePan();
        updateInviteWash();
      });
    },
    { passive: true }
  );
  updateScenePan();
  updateInviteWash();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const panel = entry.target;
        ratios.set(panel, entry.intersectionRatio);
        const nowInview = entry.intersectionRatio >= 0.3;
        const wasInview = panel.classList.contains("is-inview");
        panel.classList.toggle("is-inview", nowInview);

        if (panel === morePanel && wasInview !== nowInview) {
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

  if (prefersReducedMotion) {
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
  fetch(`${import.meta.env.BASE_URL}assets/gifts-qr.png`, { method: "HEAD" })
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

/* Photo album QR + upload button */
const shareQr = document.getElementById("share-qr");
const shareUpload = document.getElementById("share-upload");
const albumUrl =
  PHOTO_ALBUM_URL ||
  new URL("#more", window.location.href).href;

if (shareQr) {
  shareQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&color=4b1d24&bgcolor=e5ded0&data=${encodeURIComponent(albumUrl)}`;
}
if (shareUpload) {
  shareUpload.href = albumUrl;
  if (PHOTO_ALBUM_URL) {
    shareUpload.target = "_blank";
    shareUpload.rel = "noopener noreferrer";
  }
}

const shareContact = document.querySelector(".share-contact");
if (shareContact && CONTACT_EMAIL) {
  shareContact.href = `mailto:${CONTACT_EMAIL}`;
} else if (shareContact) {
  shareContact.href = "#rsvp";
}

if (form && statusEl) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusEl.classList.remove("is-error");

    if (!GOOGLE_SCRIPT_URL) {
      statusEl.classList.add("is-error");
      statusEl.textContent =
        "Add your Google Apps Script URL in script.js (GOOGLE_SCRIPT_URL) to save responses.";
      return;
    }

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
      statusEl.textContent = "Thank you — your RSVP was sent. We can’t wait to celebrate with you.";
    } catch (error) {
      statusEl.classList.add("is-error");
      statusEl.textContent = "Something went wrong. Please try again in a moment.";
    }
  });
}
