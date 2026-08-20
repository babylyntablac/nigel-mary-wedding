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
const homePanel = document.getElementById("home");
const storyPanel = document.getElementById("story");

/* Desktop: top half = page 1, bottom half = page 2 (0% → 50%).
   Mobile: faces sit ~30–40% down the portrait; keep object-position
   there. (CSS also zeros --scene-photo-lift so the tall frame cannot
   push heads above the fold.) */
const mqSceneNarrow = window.matchMedia("(max-width: 820px)");
const mqScenePhone = window.matchMedia("(max-width: 560px)");

function getScenePhotoYRange() {
  if (mqScenePhone.matches) return { start: 30, end: 42 };
  if (mqSceneNarrow.matches) return { start: 28, end: 44 };
  return { start: 0, end: 50 };
}

function getStoryScrollTop() {
  if (!storyPanel) return 0;
  return storyPanel.getBoundingClientRect().top + window.scrollY;
}

/* 0 = Invite just below the fold, 1 = Invite pinned at top — same scroll that pans the hero */
function getScenePanProgress() {
  if (!homePanel || !storyPanel || prefersReducedMotion) return 1;
  const vh = window.innerHeight || 1;
  const top = storyPanel.getBoundingClientRect().top;
  const progress = 1 - top / vh;
  return Math.min(1, Math.max(0, progress));
}

function updateScenePan() {
  if (!scenePhoto || !sceneRun || prefersReducedMotion) return;

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

  const scrollBehavior = prefersReducedMotion ? "auto" : "smooth";
  const { start: photoYStart, end: photoYEnd } = getScenePhotoYRange();

  if (id === "story" && scenePhoto && !prefersReducedMotion) {
    sceneRun?.classList.add("is-photo-anchored");
    sceneRun?.style.setProperty("--scene-pan", "1");
    sceneRun?.style.setProperty("--scene-photo-y", `${photoYEnd}%`);
    scenePhoto.style.objectPosition = `center ${photoYEnd}%`;
  }

  /* Sticky #home already sits at top≈0 while Invite covers it, so
     scrollIntoView({ block: "start" }) no-ops. Jump to document top. */
  if (id === "home") {
    if (scenePhoto && !prefersReducedMotion) {
      sceneRun?.classList.remove("is-photo-anchored");
      sceneRun?.style.setProperty("--scene-pan", "0");
      sceneRun?.style.setProperty("--scene-photo-y", `${photoYStart}%`);
      scenePhoto.style.objectPosition = `center ${photoYStart}%`;
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

function updateBrandMorph(forceMeasure = false) {
  if (prefersReducedMotion || !sceneRun || !homePanel || !storyPanel) return;

  const progress = getScenePanProgress();
  const t = smoothstep(Math.min(1, progress / BRAND_SETTLE_END));
  const cross = brandCrossfadeAmount(progress);
  /* Overlap: real rises ahead of ghost fall so coverage stays ≥ ~1 through the blend */
  const realOpacity = Math.min(1, cross * 1.2);
  const ghostOpacity = Math.max(0, 1 - cross);

  if (progress <= 0.02) {
    if (brandMorphState !== "idle") {
      sceneRun.classList.remove(
        "is-brand-morphing",
        "is-brand-settled",
        "is-brand-handing-off"
      );
      homePanel.classList.add("is-inview");
      brandMorphState = "idle";
      setBrandMorphVars(0, 0);
      if (brandMorphLayer) brandMorphLayer.classList.remove("is-active");
    }
    return;
  }

  if (progress >= BRAND_SETTLE_END) {
    ensureBrandMorphLayer();
    /* Final paint at t=1 while layer still up — then settle (no empty frame). */
    if (brandMorphState !== "settled") {
      Object.values(brandMorphGhosts || {}).forEach((entry) => {
        paintBrandGhost(entry, 1, 0, forceMeasure);
      });
      sceneRun.classList.remove("is-brand-morphing", "is-brand-handing-off");
      sceneRun.classList.add("is-brand-settled");
      storyPanel.classList.add("is-inview");
      brandMorphState = "settled";
      setBrandMorphVars(0, 1);
      if (brandMorphLayer) brandMorphLayer.classList.remove("is-active");
    } else if (forceMeasure) {
      setBrandMorphVars(0, 1);
    }
    return;
  }

  ensureBrandMorphLayer();
  const handingOff = cross > 0.02;
  if (brandMorphState !== "morphing") {
    sceneRun.classList.add("is-brand-morphing");
    sceneRun.classList.remove("is-brand-settled");
    brandMorphState = "morphing";
  }
  sceneRun.classList.toggle("is-brand-handing-off", handingOff);
  if (handingOff) {
    /* Unlock real targets for the blend; keep Invite entrance delays from replaying. */
    storyPanel.classList.add("is-inview");
  }
  setBrandMorphVars(ghostOpacity, realOpacity);
  if (brandMorphLayer) brandMorphLayer.classList.add("is-active");

  Object.values(brandMorphGhosts || {}).forEach((entry) => {
    paintBrandGhost(entry, t, ghostOpacity, forceMeasure);
  });
}

/* 30% in / 30% out — each section fades independently */
if (panels.length) {
  const ratios = new Map();

  function updateInviteWash() {
    if (!storyPanel) return;
    const vh = window.innerHeight || 1;
    const rect = storyPanel.getBoundingClientRect();
    const top = rect.top;
    // 0 when story is still below the fold, 1 when fully pinned in view
    // Also treat "covering the viewport" (top <= 0 and bottom >= vh) as fully washed
    let t = 1 - Math.min(1, Math.max(0, top / vh));
    if (top <= 1 && rect.bottom >= vh - 1) t = 1;
    const eased = t * t * (3 - 2 * t);
    storyPanel.style.setProperty("--invite-pattern", eased.toFixed(4));
    storyPanel.style.setProperty("--invite-wash", (eased * 0.92).toFixed(4));
  }

  let sceneTick = false;
  const scheduleSceneTick = (forceMeasure = false) => {
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
  window.addEventListener("resize", () => scheduleSceneTick(true), {
    passive: true,
  });
  const onSceneMqChange = () => scheduleSceneTick(true);
  if (typeof mqSceneNarrow.addEventListener === "function") {
    mqSceneNarrow.addEventListener("change", onSceneMqChange);
    mqScenePhone.addEventListener("change", onSceneMqChange);
  } else if (typeof mqSceneNarrow.addListener === "function") {
    mqSceneNarrow.addListener(onSceneMqChange);
    mqScenePhone.addListener(onSceneMqChange);
  }
  updateScenePan();
  updateInviteWash();
  updateBrandMorph(true);

  /* Pause Ken Burns while the park photo isn’t on screen (saves paint). */
  if (sceneRun && scenePhoto && !prefersReducedMotion) {
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
    if (prefersReducedMotion || active) return;
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

  if (prefersReducedMotion) {
    butterfly.classList.add("is-perched");
    butterfly.classList.remove("is-flying");
    return;
  }

  const syncVisibility = () => {
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
      if (!active && !prefersReducedMotion) setPose(PERCHES[perchIndex]);
      else if (!flightAnim) setPose(PERCHES[perchIndex]);
    },
    { passive: true }
  );

  syncVisibility();
})();

/* Love Story — loop “Once upon a time” while the panel is in view */
(function initLoveStoryTypewriter() {
  const lovePanel = document.querySelector('[data-panel="love"]');
  const kicker = document.querySelector(".love-story-kicker[data-typewriter]");
  const textEl = kicker?.querySelector(".love-story-kicker-text");
  if (!lovePanel || !kicker || !textEl) return;

  const fullText = (textEl.textContent || "Once upon a time").trim();
  const TYPE_MS = 58;
  const DELETE_MS = 36;
  const HOLD_MS = 2600;
  const GAP_MS = 720;
  const START_DELAY_MS = 640;

  let active = false;
  let timer = null;

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
    if (active) return;
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

  if (prefersReducedMotion) {
    showFull();
    return;
  }

  textEl.textContent = "";
  kicker.classList.add("is-typing");

  const sync = () => {
    if (lovePanel.classList.contains("is-inview")) startLoop();
    else pauseLoop();
  };

  const visibilityObserver = new MutationObserver(sync);
  visibilityObserver.observe(lovePanel, {
    attributes: true,
    attributeFilter: ["class"],
  });

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

/* Join Us: live spacing + image size dials (sessionStorage) */
(function initJoinTuneControls() {
  const panel = document.getElementById("join");
  if (!panel) return;

  const GAP_KEY = "join-col-gap";
  const SHOT_KEY = "join-shot-width";
  const DEFAULTS = { gap: 1.5, shot: 17 };
  const LIMITS = {
    gap: { min: 1.5, max: 6, step: 0.25 },
    shot: { min: 10, max: 20, step: 0.5 },
  };

  const formatRem = (value) => {
    const rounded = Math.round(value * 100) / 100;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded)}rem`;
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const readStored = (key, fallback) => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw == null) return fallback;
      const num = parseFloat(raw);
      return Number.isFinite(num) ? num : fallback;
    } catch (_) {
      return fallback;
    }
  };

  const writeStored = (key, value) => {
    try {
      sessionStorage.setItem(key, String(value));
    } catch (_) {
      /* ignore quota / private mode */
    }
  };

  let gap = clamp(readStored(GAP_KEY, DEFAULTS.gap), LIMITS.gap.min, LIMITS.gap.max);
  let shot = clamp(readStored(SHOT_KEY, DEFAULTS.shot), LIMITS.shot.min, LIMITS.shot.max);

  const gapReadout = panel.querySelector('[data-join-readout="gap"]');
  const shotReadout = panel.querySelector('[data-join-readout="shot"]');

  const apply = () => {
    panel.style.setProperty("--join-col-gap", formatRem(gap));
    panel.style.setProperty("--join-shot-width", formatRem(shot));
    if (gapReadout) gapReadout.textContent = formatRem(gap);
    if (shotReadout) shotReadout.textContent = formatRem(shot);
  };

  apply();

  panel.querySelectorAll("[data-join-tune]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.getAttribute("data-join-tune");
      const dir = Number(btn.getAttribute("data-dir")) || 0;
      if (kind === "gap") {
        gap = clamp(gap + dir * LIMITS.gap.step, LIMITS.gap.min, LIMITS.gap.max);
        writeStored(GAP_KEY, gap);
      } else if (kind === "shot") {
        shot = clamp(shot + dir * LIMITS.shot.step, LIMITS.shot.min, LIMITS.shot.max);
        writeStored(SHOT_KEY, shot);
      } else {
        return;
      }
      apply();
    });
  });
})();

/* Join Us: full-bleed background cycle + overlay washes (sessionStorage) */
(function initJoinBackgroundControls() {
  const panel = document.getElementById("join");
  if (!panel) return;

  const BG_KEY = "join-bg-index";
  const OVERLAY_KEY = "join-overlay";
  const BG_COUNT = 6;
  /* Locked site defaults: UI 5/6 (index 4 → join-bg-4.jpg) + navy wash */
  const DEFAULT_BG = 4;
  const DEFAULT_OVERLAY = "4";
  const BG_SRCS = [
    null,
    "assets/join-bg-1.jpg",
    "assets/join-bg-2.jpg",
    "assets/join-bg-3.jpg",
    "assets/join-bg-4.jpg",
    "assets/join-bg-5.jpg",
  ];

  const img = panel.querySelector("[data-join-bg-img]");
  const readout = panel.querySelector("[data-join-bg-readout]");
  const dots = [...panel.querySelectorAll("[data-join-bg-goto]")];
  const swatches = [...panel.querySelectorAll("[data-join-overlay]")];

  const writeStored = (key, value) => {
    try {
      sessionStorage.setItem(key, String(value));
    } catch (_) {
      /* ignore quota / private mode */
    }
  };

  const readStored = (key, fallback) => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw == null ? fallback : raw;
    } catch (_) {
      return fallback;
    }
  };

  const preload = (src) => {
    if (!src) return;
    const probe = new Image();
    probe.decoding = "async";
    probe.src = src;
  };

  BG_SRCS.filter(Boolean).forEach(preload);

  const applyBg = (index) => {
    const i = ((Number(index) % BG_COUNT) + BG_COUNT) % BG_COUNT;
    const onPhoto = i > 0;
    const src = BG_SRCS[i];

    panel.dataset.bg = String(i);
    panel.classList.toggle("join-on-photo", onPhoto);

    if (img) {
      if (onPhoto && src) {
        if (img.getAttribute("src") !== src) img.setAttribute("src", src);
        img.removeAttribute("hidden");
      }
    }

    if (readout) readout.textContent = `${i + 1}/${BG_COUNT}`;

    dots.forEach((dot) => {
      const active = Number(dot.dataset.joinBgGoto) === i;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-selected", active ? "true" : "false");
    });

    writeStored(BG_KEY, i);
  };

  const applyOverlay = (value) => {
    const id = String(value);
    if (!/^[1-5]$/.test(id)) return;

    panel.dataset.overlay = id;

    swatches.forEach((btn) => {
      const active = btn.dataset.joinOverlay === id;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-checked", active ? "true" : "false");
    });

    writeStored(OVERLAY_KEY, id);
  };

  let savedBg = DEFAULT_BG;
  let savedOverlay = DEFAULT_OVERLAY;
  try {
    const rawBg = parseInt(readStored(BG_KEY, String(DEFAULT_BG)), 10);
    savedBg = Number.isFinite(rawBg) ? rawBg : DEFAULT_BG;
    savedOverlay = readStored(OVERLAY_KEY, DEFAULT_OVERLAY);
    if (!/^[1-5]$/.test(String(savedOverlay))) savedOverlay = DEFAULT_OVERLAY;
  } catch (_) {
    savedBg = DEFAULT_BG;
    savedOverlay = DEFAULT_OVERLAY;
  }

  applyBg(savedBg);
  applyOverlay(savedOverlay);

  panel.querySelectorAll("[data-join-bg]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = Number(btn.getAttribute("data-join-bg")) || 0;
      const current = Number(panel.dataset.bg) || 0;
      applyBg(current + dir);
    });
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      applyBg(Number(dot.dataset.joinBgGoto));
    });
  });

  swatches.forEach((btn) => {
    btn.addEventListener("click", () => applyOverlay(btn.dataset.joinOverlay));
  });
})();

/* Entourage: fixed bg clipped to section bounds + overlay/align controls */
(function initEntourageControls() {
  const panel = document.getElementById("entourage");
  if (!panel) return;

  const mediaFixed = panel.querySelector(".entourage-media-fixed");

  /* Always position:fixed (no layout toggle). Clip to the section’s
     intersection with the viewport so the pin never changes scrollHeight
     and cannot bleed onto Day / More. */
  const syncEntourageMediaClip = () => {
    if (!mediaFixed) return;

    const rect = panel.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = document.documentElement.clientWidth || window.innerWidth;

    if (rect.bottom <= 0 || rect.top >= vh || rect.right <= 0 || rect.left >= vw) {
      mediaFixed.style.clipPath = "inset(100% 0 0 0)";
      return;
    }

    const top = Math.max(0, rect.top);
    const right = Math.max(0, vw - rect.right);
    const bottom = Math.max(0, vh - rect.bottom);
    const left = Math.max(0, rect.left);
    mediaFixed.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
  };

  let clipRaf = 0;
  let clipListening = false;
  const scheduleMediaClip = () => {
    if (clipRaf) return;
    clipRaf = requestAnimationFrame(() => {
      clipRaf = 0;
      syncEntourageMediaClip();
    });
  };

  const setClipListening = (on) => {
    if (on === clipListening) return;
    clipListening = on;
    if (on) {
      window.addEventListener("scroll", scheduleMediaClip, { passive: true });
      window.addEventListener("resize", scheduleMediaClip);
      scheduleMediaClip();
    } else {
      window.removeEventListener("scroll", scheduleMediaClip);
      window.removeEventListener("resize", scheduleMediaClip);
      if (mediaFixed) mediaFixed.style.clipPath = "inset(100% 0 0 0)";
    }
  };

  const clipObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      setClipListening(visible);
    },
    { rootMargin: "20% 0px" }
  );
  clipObserver.observe(panel);
  window.addEventListener("hashchange", scheduleMediaClip);
  syncEntourageMediaClip();

  const swatches = [...panel.querySelectorAll(".entourage-swatch")];
  const alignButtons = [...panel.querySelectorAll(".entourage-align")];
  const OVERLAY_KEY = "entourage-overlay";
  const ALIGN_KEY = "entourage-align";
  const LIGHT_OVERLAYS = new Set(["1"]);
  const ALIGN_VALUES = new Set(["left", "center", "right"]);

  const applyOverlay = (value) => {
    const id = String(value);
    if (!/^[1-5]$/.test(id)) return;

    panel.dataset.overlay = id;
    panel.classList.toggle("entourage-overlay-light", LIGHT_OVERLAYS.has(id));

    swatches.forEach((btn) => {
      const active = btn.dataset.overlay === id;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-checked", active ? "true" : "false");
    });

    try {
      sessionStorage.setItem(OVERLAY_KEY, id);
    } catch (_) {
      /* ignore quota / private mode */
    }
  };

  const applyAlign = (value) => {
    const align = String(value);
    if (!ALIGN_VALUES.has(align)) return;

    panel.dataset.align = align;

    alignButtons.forEach((btn) => {
      const active = btn.dataset.align === align;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-checked", active ? "true" : "false");
    });

    try {
      sessionStorage.setItem(ALIGN_KEY, align);
    } catch (_) {
      /* ignore quota / private mode */
    }
  };

  let savedOverlay = "1";
  let savedAlign = "center";
  try {
    savedOverlay = sessionStorage.getItem(OVERLAY_KEY) || "1";
    savedAlign = sessionStorage.getItem(ALIGN_KEY) || "center";
  } catch (_) {
    savedOverlay = "1";
    savedAlign = "center";
  }

  if (swatches.length) {
    applyOverlay(savedOverlay);
    swatches.forEach((btn) => {
      btn.addEventListener("click", () => applyOverlay(btn.dataset.overlay));
    });
  }

  if (alignButtons.length) {
    applyAlign(savedAlign);
    alignButtons.forEach((btn) => {
      btn.addEventListener("click", () => applyAlign(btn.dataset.align));
    });
  }
})();

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
