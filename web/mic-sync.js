/* mic-sync.js — rudimentary beat/energy sync from the room mic to the party engine.
 *
 * K., 2026-09-09 (live lights session): "I really just need to have this beat sync to
 * music... we can even just use a simple fucking rudimentary mic input right now. Very
 * sensitive. It doesn't have to ripple as far."
 *
 * OPT-IN, never touches a normal show: does nothing unless the URL carries ?mic=1. When
 * on, it asks for the mic, tracks a smoothed loudness envelope, and drives PARTY.business
 * from it — so the whole room (screen motion + lamp palette + tempo, all of which hang off
 * business) pulses with whatever is playing in the room.
 *
 * Deliberately rudimentary: RMS envelope, not a real beat tracker. A fast attack + slow
 * release reads as a pump on each hit. Sensitivity and ripple depth are URL-tunable so K.
 * can dial "very sensitive, shallow ripple" without editing code:
 *   ?mic=1                 defaults: sensitive, shallow
 *   ?mic=1&gain=2.5        more/less sensitive (input multiplier)
 *   ?mic=1&depth=0.35      how far business ripples above its floor (0..1)
 *   ?mic=1&floor=0.08      the resting business level between hits
 *
 * It sets business every frame, which overrides attract's own swell — so with mic on,
 * the music is the driver, not the pendulum. Turn attract off for the cleanest sync.
 * A tiny on-screen readout (bottom-left) shows it's alive and the live level; it hides
 * itself if the engine or mic isn't there so it can never deface a clean display.
 */
(function () {
  "use strict";
  var qs = new URLSearchParams(location.search);
  if (qs.get("mic") !== "1") return;                       // opt-in only

  var GAIN  = clampNum(parseFloat(qs.get("gain")),  2.5, 0.1, 20);
  var DEPTH = clampNum(parseFloat(qs.get("depth")), 0.55, 0,  1);
  var FLOOR = clampNum(parseFloat(qs.get("floor")), 0.06, 0,  1);
  var ATTACK = 0.6;    // env rises fast toward a louder sample (per-frame lerp)
  var RELEASE = 0.06;  // and falls slowly — that asymmetry is what reads as a "pump"

  function clampNum(v, d, lo, hi) {
    if (!(typeof v === "number") || isNaN(v)) v = d;
    return v < lo ? lo : v > hi ? hi : v;
  }

  var badge = document.createElement("div");
  badge.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:9999;font:12px system-ui;" +
    "color:#8fa;background:rgba(0,0,0,.55);padding:3px 7px;border-radius:6px;pointer-events:none;";
  badge.textContent = "mic: starting…";
  document.body.appendChild(badge);

  var env = FLOOR;

  navigator.mediaDevices.getUserMedia({ audio: {
    echoCancellation: false, noiseSuppression: false, autoGainControl: false
  } }).then(function (stream) {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    var ac = new Ctx();
    var src = ac.createMediaStreamSource(stream);
    var an = ac.createAnalyser();
    an.fftSize = 1024;
    an.smoothingTimeConstant = 0.3;
    src.connect(an);
    var buf = new Uint8Array(an.fftSize);
    badge.textContent = "mic: live";

    function frame() {
      an.getByteTimeDomainData(buf);
      // RMS of the centred waveform → 0..~1 loudness
      var sum = 0;
      for (var i = 0; i < buf.length; i++) { var d = (buf[i] - 128) / 128; sum += d * d; }
      var rms = Math.sqrt(sum / buf.length);
      var lvl = clampNum(rms * GAIN, 0, 0, 1);
      // fast attack, slow release
      var k = (lvl > env) ? ATTACK : RELEASE;
      env += (lvl - env) * k;

      if (window.PARTY && typeof window.PARTY.apply === "function") {
        var biz = clampNum(FLOOR + DEPTH * env, 0, 0, 1);
        window.PARTY.apply({ cmd: "business", value: biz });
      }
      badge.textContent = "mic ● " + (env * 100 | 0);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }).catch(function (e) {
    badge.textContent = "mic: denied (" + (e && e.name || "err") + ")";
    setTimeout(function () { badge.remove(); }, 4000);
  });
})();
