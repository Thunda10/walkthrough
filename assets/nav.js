(function () {
  var h = document.querySelector(".site-nav");
  if (!h) return;
  var b = h.querySelector(".menu");
  var br = h.querySelector(".brand");
  var hb = h.querySelector(".home-btn");
  var nv = h.querySelector("nav");
  h.classList.add("js");

  function set(o) {
    h.classList.toggle("open", o);
    if (b) {
      b.setAttribute("aria-expanded", o);
      b.textContent = o ? "Close" : "Menu";
    }
  }

  if (b) {
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      set(!h.classList.contains("open"));
    });
  }
  h.querySelectorAll(".links a").forEach(function (a) {
    a.addEventListener("click", function () { set(false); });
  });
  document.addEventListener("click", function (e) {
    if (!h.contains(e.target)) set(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && h.classList.contains("open")) {
      set(false);
      if (b) b.focus();
    }
  });

  function fit() {
    if (!br || !hb || !nv) return;
    h.classList.remove("stacked");
    var bR = br.getBoundingClientRect();
    var hR = hb.getBoundingClientRect();
    var nR = nv.getBoundingClientRect();
    if (Math.abs(bR.top - hR.top) < 20 && (bR.right > hR.left - 8 || hR.right > nR.left - 8)) {
      h.classList.add("stacked");
    }
  }

  fit();
  window.addEventListener("resize", fit);
  if ("ResizeObserver" in window) {
    var ro = new ResizeObserver(fit);
    if (br) ro.observe(br);
    if (nv) ro.observe(nv);
  }
})();
