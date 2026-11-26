(function () {
  var box = document.getElementById("heroPano");
  var canvas = document.getElementById("heroCanvas");
  var toggle = document.getElementById("heroToggle");
  if (!box || !canvas || !toggle) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduced.matches) return;

  var gl =
    canvas.getContext("webgl2", { alpha: false, antialias: true, powerPreference: "default" }) ||
    canvas.getContext("webgl", { alpha: false, antialias: true, powerPreference: "default" }) ||
    canvas.getContext("experimental-webgl", { alpha: false, antialias: true });
  if (!gl) return;

  var vs =
    "attribute vec2 p;varying vec2 uv;void main(){uv=p*0.5+0.5;gl_Position=vec4(p,0.0,1.0);}";
  var fs =
    "precision highp float;" +
    "varying vec2 uv;" +
    "uniform sampler2D pano;" +
    "uniform vec2 resolution;" +
    "uniform float yaw;" +
    "uniform float pitch;" +
    "uniform float fov;" +
    "const float PI = 3.141592653589793;" +
    "void main(){" +
      "float aspect = resolution.x / resolution.y;" +
      "float scale = tan(radians(fov) * 0.5);" +
      "vec2 q = (uv * 2.0 - 1.0) * vec2(aspect, 1.0) * scale;" +
      "vec3 d = normalize(vec3(q.x, q.y, -1.0));" +
      "float cp = cos(pitch), sp = sin(pitch);" +
      "float cy = cos(yaw), sy = sin(yaw);" +
      "d = vec3(d.x, cp * d.y - sp * d.z, sp * d.y + cp * d.z);" +
      "d = vec3(cy * d.x - sy * d.z, d.y, sy * d.x + cy * d.z);" +
      "float lon = atan(d.x, -d.z);" +
      "float lat = asin(clamp(d.y, -1.0, 1.0));" +
      "vec2 t = vec2(fract(0.5 + lon / (2.0 * PI)), clamp(0.5 - lat / PI, 0.001, 0.999));" +
      "gl_FragColor = texture2D(pano, t);" +
    "}";

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  var program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
  } catch (e) {
    return;
  }

  gl.useProgram(program);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  var posLoc = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  var uPano = gl.getUniformLocation(program, "pano");
  var uRes = gl.getUniformLocation(program, "resolution");
  var uYaw = gl.getUniformLocation(program, "yaw");
  var uPitch = gl.getUniformLocation(program, "pitch");
  var uFov = gl.getUniformLocation(program, "fov");

  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  var SPEED = (3 * Math.PI) / 180; // 3 degrees per second
  var HFOV = 90;
  var yaw = 0;
  var pitch = -0.05;
  var fov = 50;
  var ready = false;
  var paused = false;
  var inView = true;
  var rafId = 0;
  var lastTime = 0;

  function computeFov() {
    var aspect = canvas.width / Math.max(1, canvas.height);
    var vfov = (2 * Math.atan(Math.tan((HFOV * Math.PI) / 360) / aspect) * 180) / Math.PI;
    fov = Math.max(36, Math.min(75, vfov));
  }

  function resize() {
    var rect = box.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    computeFov();
    if (ready) draw();
  }

  function draw() {
    if (!canvas.width || !canvas.height) return;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uYaw, yaw);
    gl.uniform1f(uPitch, pitch);
    gl.uniform1f(uFov, fov);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(uPano, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    lastTime = 0;
  }

  function tick(now) {
    rafId = 0;
    if (!ready || paused || !inView || document.hidden || reduced.matches) return;
    if (lastTime) {
      var dt = Math.min(0.1, (now - lastTime) / 1000);
      yaw = (yaw + SPEED * dt) % (Math.PI * 2);
    }
    lastTime = now;
    draw();
    rafId = requestAnimationFrame(tick);
  }

  function syncRun() {
    if (ready && !paused && inView && !document.hidden && !reduced.matches) {
      if (!rafId) {
        lastTime = 0;
        rafId = requestAnimationFrame(tick);
      }
    } else {
      stopLoop();
    }
  }

  function updateToggle() {
    toggle.textContent = paused ? "Play" : "Pause";
    toggle.setAttribute("aria-pressed", paused ? "true" : "false");
    toggle.setAttribute("aria-label", paused ? "Play hero panorama" : "Pause hero panorama");
  }

  toggle.addEventListener("click", function () {
    paused = !paused;
    updateToggle();
    syncRun();
  });

  document.addEventListener("visibilitychange", syncRun);

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        inView = entries.some(function (e) { return e.isIntersecting; });
        syncRun();
      },
      { threshold: 0.01 }
    );
    io.observe(box);
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(box);
  } else {
    window.addEventListener("resize", resize);
  }

  var onReducedChange = function () {
    if (reduced.matches) {
      stopLoop();
      canvas.classList.remove("ready");
      toggle.hidden = true;
    } else if (ready) {
      canvas.classList.add("ready");
      toggle.hidden = false;
      draw();
      syncRun();
    }
  };
  if (reduced.addEventListener) reduced.addEventListener("change", onReducedChange);

  var src = box.getAttribute("data-pano");
  if (!src) return;
  var img = new Image();
  img.decoding = "async";
  img.onload = function () {
    if (reduced.matches) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    ready = true;
    resize();
    draw();
    canvas.classList.add("ready");
    toggle.hidden = false;
    updateToggle();
    syncRun();
  };
  img.src = src;
})();
