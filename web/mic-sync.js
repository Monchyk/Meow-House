/* mic-sync.js — room-mic beat/energy sync + live telemetry for the party engine.
 *
 * K., 2026-09-09 (live lights session): "I really just need to have this beat sync to
 * music... we can even just use a simple fucking rudimentary mic input right now. Very
 * sensitive." — and 2026-09-18: "I want a mic dashboard, with an audio meter and
 * everything, where I can see it come in and what it's doing, a whole parameterization."
 *
 * Runs on the DISPLAY machine (the one near the PA — the canonical room mic). It:
 *   • captures the mic, tracks a smoothed loudness envelope, drives PARTY.business,
 *   • splits the spectrum into bass/mid/high and runs a rudimentary beat detector on
 *     the bass band,
 *   • PUBLISHES telemetry (~20 Hz) over serve.py's /party relay so the standalone
 *     mic desk (mic.html) can show a live meter and see what it's doing,
 *   • LISTENS on the same relay for {type:"miccmd"} so every parameter — and arm/disarm
 *     itself — is tunable live from the phone with no URL editing.
 *
 * OPT-IN, never touches a normal show: it does nothing to the room until it is ARMED.
 * ?mic=1 in the URL auto-arms on load (old behaviour preserved); otherwise it sits
 * dormant with only its bus listener open until the mic desk arms it. When armed it
 * sets business every frame, overriding attract's own swell — so the music is the
 * driver, not the pendulum. Turn attract off for the cleanest sync.
 *
 * URL params still seed the defaults:
 *   ?mic=1                 arm on load
 *   ?gain=2.5              input sensitivity (multiplier)
 *   ?depth=0.55            how far business ripples above its floor (0..1)
 *   ?floor=0.06            resting business level between hits
 *   ?source=full|bass      what drives the envelope (full spectrum RMS, or bass only)
 *
 * A tiny bottom-left badge shows it's alive and the live level; it hides itself if the
 * engine isn't there so it can never deface a clean display.
 */
(function () {
  "use strict";
  var qs = new URLSearchParams(location.search);

  // ── live parameters (URL seeds the defaults; the mic desk overrides at runtime) ──
  var P = {
    gain:     clampNum(parseFloat(qs.get("gain")),  2.5, 0.1, 20),
    depth:    clampNum(parseFloat(qs.get("depth")), 0.55, 0,  1),
    floor:    clampNum(parseFloat(qs.get("floor")), 0.06, 0,  1),
    attack:   0.6,    // env rises fast toward a louder sample (per-frame lerp)
    release:  0.06,   // and falls slowly — that asymmetry reads as a "pump"
    source:   (qs.get("source") === "bass") ? "bass" : "full",
    beatSens: 0.35,   // how far bass must exceed its baseline to count as a beat
    beatPunch: 0.35   // how hard a detected beat kicks business, scaled by depth
  };

  function clampNum(v, d, lo, hi) {
    if (!(typeof v === "number") || isNaN(v)) v = d;
    return v < lo ? lo : v > hi ? hi : v;
  }

  // ── badge ────────────────────────────────────────────────────────────────
  var badge = document.createElement("div");
  badge.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:9999;font:12px system-ui;" +
    "color:#8fa;background:rgba(0,0,0,.55);padding:3px 7px;border-radius:6px;pointer-events:none;";
  badge.textContent = "mic: idle";
  document.body.appendChild(badge);

  // ── audio state ────────────────────────────────────────────────────────────
  var armed = false, starting = false;
  var micError = "";               // last failure reason, surfaced to the desk
  var devices = [];                // [{id,label}] audio inputs (labels need permission)
  var curDeviceId = qs.get("dev") || "";  // "" = system default
  var ac = null, an = null, stream = null;
  var freq = null;                 // getByteFrequencyData buffer
  var wave = null;                 // getByteTimeDomainData buffer
  var env = P.floor;               // smoothed envelope (the business driver)
  var bassEma = 0;                 // running baseline for beat detection
  var beat = 0;                    // decaying beat pulse 0..1
  var lastBeatAt = 0;
  var beatTimes = [];              // recent beat timestamps → BPM estimate
  var bpm = 0;
  var bands = [0, 0, 0];           // bass / mid / high, 0..1
  var rms = 0, biz = P.floor;
  var binLo = null;                // per-band bin ranges, computed once analyser exists

  function computeBins() {
    // fftSize bins span 0..sampleRate/2. Split by physical frequency, not bin count.
    var nyquist = ac.sampleRate / 2, bins = an.frequencyBinCount;
    function bin(hz) { return Math.max(0, Math.min(bins - 1, Math.round(hz / nyquist * bins))); }
    binLo = {
      bass: [bin(20),   bin(160)],
      mid:  [bin(160),  bin(2000)],
      high: [bin(2000), bin(8000)]
    };
  }
  function bandAvg(range) {
    var s = 0, n = 0;
    for (var i = range[0]; i <= range[1]; i++) { s += freq[i]; n++; }
    return n ? (s / n) / 255 : 0;   // 0..1
  }

  function enumerate() {
    // Labels are only populated once permission has been granted (i.e. after the first
    // successful getUserMedia), so we (re)enumerate on every arm.
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then(function (list) {
      devices = list.filter(function (d) { return d.kind === "audioinput"; })
                    .map(function (d, i) { return { id: d.deviceId, label: d.label || ("microphone " + (i + 1)) }; });
      publish();
    }).catch(function () {});
  }

  // BPM from inter-beat intervals: fold each gap into the musical 60–180 range (so a
  // missed or doubled beat doesn't halve/double the reading), then take the median of
  // the recent set and ease toward it — a stable clock rather than a jittery per-beat guess.
  function estimateBpm(gapMs) {
    var b = 60000 / gapMs;
    while (b > 180) b /= 2;
    while (b < 60)  b *= 2;
    beatTimes.push(b);
    if (beatTimes.length > 8) beatTimes.shift();
    var sorted = beatTimes.slice().sort(function (x, y) { return x - y; });
    var med = sorted[sorted.length >> 1];
    bpm = bpm ? bpm + (med - bpm) * 0.4 : med;
  }

  function startAudio(deviceId) {
    if (starting) return;
    if (deviceId != null) curDeviceId = deviceId;
    if (armed) stopAudio();          // switching device: tear down first
    starting = true; micError = "";
    badge.textContent = "mic: starting…";
    publish();

    // getUserMedia only exists in a SECURE CONTEXT: https, or http://localhost. Opened
    // as http://<lan-ip>:port on the display machine, navigator.mediaDevices is undefined
    // and the mic would "just not register" — say so instead of throwing into the void.
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      starting = false;
      micError = window.isSecureContext === false
        ? "insecure context — open the display page as http://localhost:PORT (not the LAN IP) or use https"
        : "this browser exposes no microphone API";
      badge.textContent = "mic: " + micError;
      publish();
      return;
    }

    var audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    if (curDeviceId) audio.deviceId = { exact: curDeviceId };
    navigator.mediaDevices.getUserMedia({ audio: audio }).then(function (s) {
      stream = s;
      // Remember which device actually opened, so the desk's dropdown reflects reality.
      var tr = s.getAudioTracks()[0];
      if (tr && tr.getSettings && tr.getSettings().deviceId) curDeviceId = tr.getSettings().deviceId;
      var Ctx = window.AudioContext || window.webkitAudioContext;
      ac = new Ctx();
      var src = ac.createMediaStreamSource(stream);
      an = ac.createAnalyser();
      an.fftSize = 1024;              // ~23 ms window — tight enough for a low-latency kick
      an.smoothingTimeConstant = 0.1; // minimal smoothing so a beat spikes immediately
      src.connect(an);
      freq = new Uint8Array(an.frequencyBinCount);
      wave = new Uint8Array(an.fftSize);
      computeBins();
      armed = true; starting = false; micError = "";
      badge.textContent = "mic ● live";
      enumerate();                   // labels are available now
    }).catch(function (e) {
      // A saved/selected device that's since been unplugged throws OverconstrainedError.
      // Don't wedge on it — fall back to the system default so arming always works.
      if (e && (e.name === "OverconstrainedError" || e.name === "NotFoundError") && curDeviceId) {
        curDeviceId = ""; starting = false;
        startAudio("");
        return;
      }
      starting = false; armed = false;
      micError = (e && e.name || "error") + (e && e.message ? " — " + e.message : "");
      badge.textContent = "mic: " + (e && e.name || "denied");
      publish();   // let the desk know the arm failed and why
    });
  }

  function stopAudio() {
    armed = false;
    if (stream) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} stream = null; }
    if (ac) { try { ac.close(); } catch (e) {} ac = null; }
    an = null; freq = null; wave = null; binLo = null;
    env = P.floor; beat = 0; bassEma = 0; bands = [0, 0, 0]; rms = 0;
    beatTimes = []; bpm = 0; lastBeatAt = 0;
    badge.textContent = "mic: idle";
    publish();
  }

  // ── the analysis frame ─────────────────────────────────────────────────────
  function frame() {
    if (armed && an) {
      an.getByteTimeDomainData(wave);
      an.getByteFrequencyData(freq);

      // full-spectrum loudness (RMS of the centred waveform → 0..~1)
      var sum = 0;
      for (var i = 0; i < wave.length; i++) { var d = (wave[i] - 128) / 128; sum += d * d; }
      rms = Math.sqrt(sum / wave.length);

      bands = [bandAvg(binLo.bass), bandAvg(binLo.mid), bandAvg(binLo.high)];

      // beat detection on the bass band: a slow baseline, a fast spike over it
      bassEma += (bands[0] - bassEma) * 0.08;
      var now = performance.now();
      if (bands[0] > bassEma * (1 + P.beatSens) && bands[0] > 0.04 && now - lastBeatAt > 120) {
        beat = 1;
        if (lastBeatAt) estimateBpm(now - lastBeatAt);
        lastBeatAt = now;
      }
      beat *= 0.78;   // decay the pulse each frame (snappier than before → cleaner clock)
      if (now - lastBeatAt > 2000) bpm = 0;   // lost the beat → drop the reading

      // envelope on the chosen source, fast attack / slow release
      var raw = (P.source === "bass") ? bands[0] : rms;
      var lvl = clampNum(raw * P.gain, 0, 0, 1);
      var k = (lvl > env) ? P.attack : P.release;
      env += (lvl - env) * k;

      biz = clampNum(P.floor + P.depth * env + P.depth * P.beatPunch * beat, 0, 0, 1);
      if (window.PARTY && typeof window.PARTY.apply === "function") {
        window.PARTY.apply({ cmd: "business", value: biz });
      }
      badge.textContent = "mic ● " + (env * 100 | 0) + (beat > 0.5 ? " ♪" : "");
    }
    maybePublish();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ── bus: telemetry out + commands in (serve.py /party relay) ───────────────
     The same generic pub/sub the dashboard uses. We define our own message types
     (mic / miccmd) — the relay fans any JSON, and every other surface filters us out
     by from/type, so this never disturbs the state channel. */
  function pub(obj) {
    try { fetch("/party/pub", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) }); } catch (e) {}
  }
  function publish() {
    pub({ from: "mic", type: "mic",
      armed: armed, starting: starting, error: micError,
      devices: devices, deviceId: curDeviceId,
      level: env, rms: rms, bands: bands, beat: beat, bpm: bpm, business: biz,
      params: {
        gain: P.gain, depth: P.depth, floor: P.floor, attack: P.attack,
        release: P.release, source: P.source, beatSens: P.beatSens, beatPunch: P.beatPunch
      } });
  }
  var lastPub = 0;
  function maybePublish() {
    var now = performance.now();
    if (now - lastPub < 50) return;    // ~20 Hz
    lastPub = now;
    publish();
  }

  // Live commands from the mic desk. Same reconnect discipline as party-main.js:
  // EventSource stops retrying after an HTTP error, so a serve.py restart would leave
  // us deaf while still publishing — reconnect ourselves.
  function applyCmd(m) {
    if (m.cmd === "arm")      { startAudio(); return; }
    if (m.cmd === "disarm")   { stopAudio();  return; }
    if (m.cmd === "device")   { startAudio(m.value || ""); return; }  // pick / switch mic
    if (m.cmd === "enumerate"){ enumerate();  return; }
    if (m.cmd === "hello")    { enumerate(); publish(); return; }   // desk just connected
    if (m.cmd === "set" && m.key != null && m.key in P) {
      if (m.key === "source") P.source = (m.value === "bass") ? "bass" : "full";
      else P[m.key] = clampNum(parseFloat(m.value), P[m.key], 0, 20);
      publish();
    }
  }
  var sub = null;
  function connect(delay) {
    try {
      sub = new EventSource("/party/sub");
      sub.onmessage = function (ev) {
        var m; try { m = JSON.parse(ev.data); } catch (_) { return; }
        if (!m || m.type !== "miccmd") return;
        applyCmd(m);
      };
      sub.onopen = function () { delay = 1000; publish(); };
      sub.onerror = function () {
        try { sub.close(); } catch (e) {}
        setTimeout(function () { connect(Math.min((delay || 1000) * 2, 10000)); }, delay || 1000);
      };
    } catch (e) {
      setTimeout(function () { connect(Math.min((delay || 1000) * 2, 10000)); }, delay || 1000);
    }
  }
  connect(1000);

  // Auto-arm when the URL asks for it (preserves the original ?mic=1 behaviour).
  if (qs.get("mic") === "1") startAudio();
})();
