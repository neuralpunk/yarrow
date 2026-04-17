// Click-to-enlarge lightbox using the FLIP technique.
// Measures the thumbnail (First), mounts the full-size image (Last),
// applies an inverse transform, then animates the transform to zero (Play).

(function () {
  "use strict";

  const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  const OPEN_MS = 420;
  const CLOSE_MS = 320;

  let overlay = null;
  let openImg = null;
  let sourceImg = null;
  let animating = false;

  function init() {
    const targets = document.querySelectorAll("img.zoomable, .hero-shot img");
    targets.forEach((img) => {
      img.style.cursor = "zoom-in";
      img.addEventListener("click", (e) => {
        e.preventDefault();
        open(img);
      });
    });
  }

  function open(img) {
    if (animating || overlay) return;
    animating = true;
    sourceImg = img;

    const startRect = img.getBoundingClientRect();

    overlay = document.createElement("div");
    overlay.className = "lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const closeBtn = document.createElement("button");
    closeBtn.className = "lightbox-close";
    closeBtn.setAttribute("aria-label", "Close");
    overlay.appendChild(closeBtn);

    openImg = document.createElement("img");
    openImg.src = img.currentSrc || img.src;
    openImg.alt = img.alt || "";
    openImg.className = "lightbox-img";
    overlay.appendChild(openImg);

    document.body.appendChild(overlay);
    document.documentElement.classList.add("lightbox-open");

    // Wait for layout to settle, then FLIP.
    requestAnimationFrame(() => {
      const endRect = openImg.getBoundingClientRect();
      if (!endRect.width || !endRect.height) {
        // Image not yet laid out — fall back to a plain fade.
        overlay.style.opacity = "0";
        requestAnimationFrame(() => {
          overlay.style.transition = `opacity ${OPEN_MS}ms ease-out`;
          overlay.style.opacity = "1";
        });
        setTimeout(() => { animating = false; }, OPEN_MS);
        return;
      }

      const scaleX = startRect.width / endRect.width;
      const scaleY = startRect.height / endRect.height;
      const dx =
        startRect.left + startRect.width / 2 -
        (endRect.left + endRect.width / 2);
      const dy =
        startRect.top + startRect.height / 2 -
        (endRect.top + endRect.height / 2);

      // Invert: place the big image over the thumbnail.
      openImg.style.transition = "none";
      openImg.style.transformOrigin = "center center";
      openImg.style.transform =
        `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
      overlay.style.opacity = "0";

      // Force a reflow so the browser registers the starting state.
      void openImg.offsetWidth;

      // Play.
      requestAnimationFrame(() => {
        openImg.style.transition = `transform ${OPEN_MS}ms ${EASE}`;
        openImg.style.transform = "translate(0, 0) scale(1, 1)";
        overlay.style.transition = `opacity ${Math.round(OPEN_MS * 0.7)}ms ease-out`;
        overlay.style.opacity = "1";
      });

      setTimeout(() => { animating = false; }, OPEN_MS);
    });

    // Interactions
    overlay.addEventListener("click", (e) => {
      // Don't close if user selects/drags text on the image itself (unlikely, but polite)
      if (e.target === openImg && getSelection()?.toString()) return;
      close();
    });
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      close();
    });
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
  }

  function close() {
    if (animating || !overlay || !openImg || !sourceImg) return;
    animating = true;

    const endRect = sourceImg.getBoundingClientRect();
    const startRect = openImg.getBoundingClientRect();

    const scaleX = endRect.width / startRect.width;
    const scaleY = endRect.height / startRect.height;
    const dx =
      endRect.left + endRect.width / 2 -
      (startRect.left + startRect.width / 2);
    const dy =
      endRect.top + endRect.height / 2 -
      (startRect.top + startRect.height / 2);

    openImg.style.transition = `transform ${CLOSE_MS}ms ${EASE}`;
    openImg.style.transform =
      `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
    overlay.style.transition = `opacity ${Math.round(CLOSE_MS * 0.85)}ms ease-out`;
    overlay.style.opacity = "0";

    const done = () => {
      overlay?.remove();
      overlay = null;
      openImg = null;
      sourceImg = null;
      animating = false;
      document.documentElement.classList.remove("lightbox-open");
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
    setTimeout(done, CLOSE_MS + 20);
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
