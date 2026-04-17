// Three-way theme picker: light / dark / blueberry.
// Persists the choice in localStorage under "yarrow.site.theme".
// An inline <script> in <head> already applied the stored (or OS-derived)
// theme before first paint to avoid flashing — this file wires up the
// segmented control and keeps everything in sync.

(function () {
  var KEY = "yarrow.site.theme";
  var VALID = { light: 1, dark: 1, blueberry: 1 };
  // Chrome/address-bar colors per theme — match the CSS --bg token.
  var CHROME = {
    light:     "#fdfcf3",
    dark:      "#141209",
    blueberry: "#182833",
  };
  var LABEL = {
    light:     "warm cream",
    dark:      "warm dusk",
    blueberry: "Blueberry + Yellow",
  };

  var root = document.documentElement;
  var buttons = document.querySelectorAll(".theme-opt");
  var caption = document.querySelector(".hero-shot .theme-label");
  var meta = document.getElementById("meta-theme-color");

  function current() {
    var attr = root.getAttribute("data-theme");
    if (attr && VALID[attr]) return attr;
    return "light";
  }

  function apply(mode) {
    if (!VALID[mode]) return;
    root.setAttribute("data-theme", mode);
    try { localStorage.setItem(KEY, mode); } catch (_) {}
    if (meta) meta.setAttribute("content", CHROME[mode]);
    if (caption) caption.textContent = LABEL[mode];
    buttons.forEach(function (b) {
      var active = b.getAttribute("data-theme-value") === mode;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-checked", active ? "true" : "false");
      b.setAttribute("tabindex", active ? "0" : "-1");
    });
  }

  buttons.forEach(function (b) {
    b.addEventListener("click", function () {
      apply(b.getAttribute("data-theme-value"));
    });
    // Arrow-key nav within the radiogroup.
    b.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      var order = Array.prototype.slice.call(buttons);
      var i = order.indexOf(b);
      var next = e.key === "ArrowRight"
        ? order[(i + 1) % order.length]
        : order[(i - 1 + order.length) % order.length];
      var val = next.getAttribute("data-theme-value");
      if (val) {
        apply(val);
        next.focus();
      }
    });
  });

  apply(current());
})();
