# The Superfluid — implementation reference

How the continuous light flood is actually built, on both sides of the wire, in
enough detail to **port it into another C# project**.

Verified against source on 2026-07-23:
`Hue program` repo, branch `feature/transient-effects` —
`Hue program/Layers/SuperfluidFlowLayer.cs`, `Services/SceneRenderer.cs`,
`Services/SceneController.cs`, `Services/AnimationLoop.cs`,
`Interfaces/ILiveTunable.cs`, `Utilities/Vector3.cs`, `Utilities/ColorMath.cs`,
`Hue program UI/Services/{HueEngine,LayerRegistry}.cs`,
`Hue program Web/Program.cs`; and `Deep-House/web/{house.js,hue.js}`.

---

## The idea in one paragraph

Light spills from one point in the room — the screen — and floods outward to
every corner at once, then recedes. It is a **field sampled at lamp positions**,
not a sequence of lamps taking turns. Because it is a field with its own running
phase, you can change its colour, speed, softness and strength *while it flows*
without ever restarting it. That last property is the whole engineering point:
restarting is what made it look like flicker.

---

## Part 1 — The C# layer

### 1.1 The contracts you need first

Porting requires four small types. If your project already has a layered light
engine, map onto your equivalents; if not, these are the minimum.

```csharp
// Utilities/Vector3.cs — plain struct, no System.Numerics dependency.
public struct Vector3 {
    public double X, Y, Z;                       // (properties in the original)
    public static Vector3 FromArray(double[] p); // Position[] -> Vector3, pads missing axes with 0
    public static double Distance(Vector3 a, Vector3 b);   // Euclidean
}

// Core/Models/MappedLight.cs — a physical lamp with a position.
public class MappedLight {
    public Guid     Id { get; set; }
    public string   Name { get; set; }           // ← the origin heuristic reads this
    public double[] Position { get; set; }       // normalized [-1,1] per axis, from the Hue entertainment map
    public RGBColor CurrentColor { get; set; }
    public int      Brightness { get; set; }     // 0–100
    public bool     IsOn { get; set; }
}

// Core/Models/LightState.cs — what a layer writes per lamp per frame.
public class LightState {
    public RGBColor Color { get; set; }
    public int      Brightness { get; set; }     // 0–100
    public int      TransitionTimeMs { get; set; } = 200;
    public bool     IsOn { get; set; } = true;
    public double   Alpha { get; set; } = 1.0;   // 1.0 = replace; <1.0 = blend over lower priority
}

// Layers/SceneLayer.cs — the base class.
public abstract class SceneLayer {
    public int  Priority { get; set; }           // 0 = ambient base, 5 = effects, 10+ = alerts
    public bool IsActive { get; set; } = true;
    public Dictionary<MappedLight, LightState> States { get; } = new();
    public abstract void Update(double deltaTime, List<MappedLight> lights);
    public virtual  void OnActivate(List<MappedLight> lights) { }
    public virtual  void OnDeactivate() { }
}
```

Two helpers from `ColorMath`:

```csharp
public static double Clamp01(double v)   => v < 0 ? 0 : v > 1 ? 1 : v;
public static double SmoothStep(double t) { t = Clamp01(t); return t * t * (3 - 2 * t); }
```

`SmoothStep` is Perlin's cubic `3t² − 2t³`. It appears twice in the layer and both
uses matter — one softens the flood edge, one softens the entrance fade.

### 1.2 State and construction

```csharp
public class SuperfluidFlowLayer : SceneLayer, ILiveTunable
{
    private static readonly string[] OriginNameHints =
        { "tv", "screen", "scherm", "monitor", "display" };

    private RGBColor _color;          // flood colour, uniform across the field
    private double   _speed;          // tide cycle rate      (0.05 – 3.0)
    private double   _spread;         // flood-edge softness  (0.05 – 1.0)
    private double   _flowIntensity;  // overall brightness   (0.0  – 1.0)

    private const double AttackSeconds = 3.0;

    private double _elapsed;
    private Vector3 _origin;
    private readonly List<Vector3> _corners = new();
    private readonly Dictionary<MappedLight, (Vector3 Dir, double MaxDist)> _perLight = new();

    public SuperfluidFlowLayer(RGBColor? color = null, double speed = 0.35,
                               double spread = 0.35, double flowIntensity = 0.8)
    {
        _color         = color ?? new RGBColor("00BFFF");
        _speed         = Math.Clamp(speed, 0.05, 3.0);
        _spread        = Math.Clamp(spread, 0.05, 1.0);
        _flowIntensity = Math.Clamp(flowIntensity, 0.0, 1.0);
        Priority = 0;                 // ambient base
    }
```

Clamping happens in **both** the constructor and `ApplyLiveParams`, so no caller
can push the layer out of range through either door.

### 1.3 `OnActivate` — precompute the geometry once

Per-frame work is proportional to `lights × corners` (12 × 4 = 48 dot products at
50 fps — trivial). Everything that doesn't change per frame is hoisted here.

```csharp
public override void OnActivate(List<MappedLight> lights)
{
    _elapsed = 0;                     // ← the reset that ApplyLiveParams must never do
    _perLight.Clear();
    _corners.Clear();

    _origin = FindOrigin(lights);

    // Four FLOOR corners of the normalized [-1,1] room cube. Z is deliberately
    // ignored — most setups have no separately-mapped ceiling plane.
    _corners.Add(new Vector3(-1, -1, 0));
    _corners.Add(new Vector3(-1,  1, 0));
    _corners.Add(new Vector3( 1, -1, 0));
    _corners.Add(new Vector3( 1,  1, 0));

    foreach (var light in lights)
    {
        var pos = Vector3.FromArray(light.Position);
        double dist = Vector3.Distance(pos, _origin);
        Vector3 dir = dist < 0.001
            ? new Vector3(0, 0, 0)                       // the origin lamp itself
            : new Vector3((pos.X - _origin.X) / dist,    // unit vector origin → lamp
                          (pos.Y - _origin.Y) / dist,
                          (pos.Z - _origin.Z) / dist);
        _perLight[light] = (dir, dist);
    }
}
```

**Origin detection** — the single most common thing to get wrong when porting:

```csharp
private static Vector3 FindOrigin(List<MappedLight> lights)
{
    var named = lights.FirstOrDefault(l =>
        !string.IsNullOrEmpty(l.Name) &&
        OriginNameHints.Any(h => l.Name.Contains(h, StringComparison.OrdinalIgnoreCase)));

    if (named != null) return Vector3.FromArray(named.Position);

    if (lights.Count == 0) return new Vector3(0, 0, 0);
    return new Vector3(lights.Average(l => l.Position[0]),
                       lights.Average(l => l.Position[1]),
                       lights.Average(l => l.Position.Length > 2 ? l.Position[2] : 0));
}
```

Name-based, `FirstOrDefault`, falls back to the centroid. It never throws and
needs no config — but if no lamp is named `tv`/`screen`/`scherm`/`monitor`/`display`,
the flood silently starts from the middle of the room. **Check this first when it
looks wrong.** (Replacing this with an explicit `originLightId` is an open item in
`ROADMAP.md`.)

### 1.4 `Update` — the field, per frame

```csharp
public override void Update(double deltaTime, List<MappedLight> lights)
{
    _elapsed += deltaTime;

    // TIDE: 0 (at the origin) → 1 (at the corners) → back. A breathing flood,
    // not a travelling ring — that difference is what reads as "superfluid"
    // rather than "wave effect again".
    double reach = (Math.Sin(_elapsed * _speed) + 1.0) * 0.5;

    // ENTRANCE: eased 0→1 over 3s after activation. Never snap the lamps on.
    double fadeIn = AttackSeconds <= 0
        ? 1.0
        : ColorMath.SmoothStep(ColorMath.Clamp01(_elapsed / AttackSeconds));

    foreach (var light in lights)
    {
        if (!_perLight.TryGetValue(light, out var pv)) continue;

        double best = 0;
        foreach (var corner in _corners)
        {
            double cornerDist = Vector3.Distance(_origin, corner);
            if (cornerDist < 0.001) continue;

            Vector3 cornerDir = new Vector3((corner.X - _origin.X) / cornerDist,
                                            (corner.Y - _origin.Y) / cornerDist,
                                            (corner.Z - _origin.Z) / cornerDist);

            // ALIGNMENT: dot product of two unit vectors = cos θ. Only lamps roughly
            // "between" the origin and this corner participate in this corner's flow.
            double align = pv.Dir.X * cornerDir.X + pv.Dir.Y * cornerDir.Y + pv.Dir.Z * cornerDir.Z;
            align = ColorMath.Clamp01((align + 1.0) * 0.5);   // −1..1 → 0..1, soft not binary

            // POSITION ALONG THE RAY: how far out this lamp sits, 0..1 toward the corner.
            double distT = cornerDist < 0.001 ? 0 : ColorMath.Clamp01(pv.MaxDist / cornerDist);

            // EDGE: 1 at the tide front, falling to 0 `_spread` away from it.
            double edge = 1.0 - ColorMath.Clamp01(Math.Abs(distT - reach) / _spread);

            double intensity = ColorMath.SmoothStep(edge) * align;
            if (intensity > best) best = intensity;      // MAX-blend across corners
        }

        int bri = (int)(best * _flowIntensity * fadeIn * 100);
        if (bri > 0) States[light] = new LightState(_color, Math.Max(1, bri), 300);
        else         States.Remove(light);
    }
}
```

Five things to preserve when you port this:

1. **`reach` is a sine, not a saw.** It rises *and* falls. A saw would restart at
   the origin each cycle — visually a repeating sweep, which is the thing this
   layer exists to not be.
2. **`align` is remapped `(x+1)/2`, not clamped at 0.** A hard clamp makes lamps
   behind the origin go fully dark and the field looks cut in half. The remap gives
   them a floor of ~0.5 and the flood stays continuous.
3. **`distT = MaxDist / cornerDist` is unnormalised distance ratio** — a lamp
   further from the origin than the corner is clamps to 1 and simply saturates.
   Fine in practice; be aware it isn't a true projection onto the corner ray.
4. **Corners combine with `max`, not `sum`.** Summing four overlapping flows
   blows past 1.0 and clips every lamp to full brightness. `max` keeps the field
   bounded without a normalisation pass.
5. **`Math.Max(1, bri)`** — never write brightness 0 as a state. Remove the entry
   instead, so the renderer leaves the lamp to a lower-priority layer rather than
   forcing it black.

`TransitionTimeMs: 300` is longer than the 200 ms default and longer than the
20 ms frame at 50 fps. The bridge interpolates *between* frames, adding a second
layer of smoothing on top of the maths.

### 1.5 `ILiveTunable` — the reason this works at all

```csharp
public interface ILiveTunable { void ApplyLiveParams(Dictionary<string, string> parameters); }
```

```csharp
public void ApplyLiveParams(Dictionary<string, string> p)
{
    if (p.TryGetValue("color", out var hex) && !string.IsNullOrWhiteSpace(hex))
        _color = new RGBColor(hex.TrimStart('#'));

    if (p.TryGetValue("speed", out var s) &&
        double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var speed))
        _speed = Math.Clamp(speed, 0.05, 3.0);

    // …same shape for spread and flowIntensity
}
```

Three non-obvious requirements:

- **`CultureInfo.InvariantCulture` on every parse.** On a `nl-NL` machine
  `double.Parse("0.35")` yields `35`. This is a real trap in NL/DE locales — the
  layer would silently run 100× too fast.
- **Every key is optional.** A partial patch (`{"color": "..."}`) leaves the other
  three untouched. The caller never has to resend the full set.
- **It does not touch `_elapsed`, `_perLight`, `_origin` or `_corners`.** That is
  the entire contract. Mutate parameters in place; touch nothing that carries phase.

### 1.6 Compositing and the loop

`SceneRenderer.Render()` walks layers in `Priority` order and merges `States`:

```csharp
foreach (var layer in _layers.OrderBy(l => l.Priority)) {
    foreach (var (light, state) in layer.States) {
        if (state.Alpha >= 1.0 || !final.TryGetValue(light, out var under)) {
            final[light] = state; continue;          // replace — the pre-alpha behaviour
        }
        double a = Math.Clamp(state.Alpha, 0.0, 1.0);
        if (a <= 0.0) continue;                      // fully transparent: leave ambient alone
        final[light] = new LightState(
            new RGBColor(under.Color.R + (state.Color.R - under.Color.R) * a,
                         under.Color.G + (state.Color.G - under.Color.G) * a,
                         under.Color.B + (state.Color.B - under.Color.B) * a),
            (int)Math.Round(under.Brightness + (state.Brightness - under.Brightness) * a),
            state.TransitionTimeMs) { IsOn = state.IsOn || under.IsOn };
    }
}
// then a static GlobalBrightness multiplier is applied proportionally
```

The Superfluid always writes `Alpha = 1.0` (the default) at `Priority = 0`, so it
is the base everything else blends *onto*.

`AnimationLoop` is the driver — constructed with `targetFps: 50` in `HueEngine`,
i.e. 20 ms frames over DTLS:

```csharp
while (!ct.IsCancellationRequested) {
    double currentTime = stopwatch.Elapsed.TotalSeconds;
    double deltaTime   = currentTime - lastTime;
    foreach (var layer in _renderer.GetActiveLayers()) layer.Update(deltaTime, _lights);
    var finalStates = _renderer.Render();
    if (finalStates.Count > 0 && _output != null) {
        try { _output.ApplyStates(finalStates); }
        catch (OperationCanceledException) { throw; }
        catch { /* transient output error — keep looping */ }
    }
    lastTime = currentTime;
    await Task.Delay(_frameDelayMs, ct);
}
```

Note it uses a real wall-clock `deltaTime`, not a fixed step — the layer must be
frame-rate independent, which it is (`_elapsed += deltaTime`, everything derived
from `_elapsed`).

`SceneController.SetAmbient` swaps the base layer and exposes it for patching:

```csharp
public SceneLayer? Ambient => _ambient;
public void SetAmbient(SceneLayer layer) {
    if (_ambient != null) _renderer.RemoveLayer(_ambient);
    _renderer.AddLayer(layer, _lights);      // AddLayer calls OnActivate
    _ambient = layer;
}
```

### 1.7 Registration and the HTTP surface

```csharp
// Hue program UI/Services/LayerRegistry.cs:237
new() {
    TypeName = "Superfluid", DisplayName = "Superfluid Flow",
    Category = LayerCategory.Ambient,
    Parameters = new() {
        ParameterDescriptor.MakeColor ("color",         "Color",          "00BFFF"),
        ParameterDescriptor.MakeDouble("speed",         "Tide Speed",     0.05, 3.0, 0.05, 0.35),
        ParameterDescriptor.MakeDouble("spread",        "Flood Softness", 0.05, 1.0, 0.05, 0.35),
        ParameterDescriptor.MakeDouble("flowIntensity", "Flow Intensity", 0.0,  1.0, 0.05, 0.8),
    },
    Factory = l => new SuperfluidFlowLayer(
        color:         new RGBColor(l.Get("color")!.HexColor),
        speed:         l.Get("speed")!.DoubleValue,
        spread:        l.Get("spread")!.DoubleValue,
        flowIntensity: l.Get("flowIntensity")!.DoubleValue),
},
```

The engine's patch entry point — type-checked, so a param patch can never land on
the wrong ambient:

```csharp
// HueEngine.cs:214
public bool TryUpdateLiveParams(string ambientType, Dictionary<string, string> ambientParams)
{
    if (_currentScene?.Ambient is ILiveTunable tunable && _currentAmbientTypeName == ambientType)
    {
        tunable.ApplyLiveParams(ambientParams);
        return true;
    }
    return false;
}
```

And the endpoint, which degrades to a hard switch on its own:

```csharp
// Hue program Web/Program.cs:512
app.MapPost("/api/effects/params", (RunEffectRequest req, HueEngine e) =>
{
    if (req.AmbientType is null) return Results.BadRequest("AmbientType required.");
    if (e.TryUpdateLiveParams(req.AmbientType, req.AmbientParams ?? new()))
        return Results.Ok(new { softUpdate = true });

    var configured = BuildEffect(req.AmbientType, req.AmbientParams, /* … */);
    _ = e.PreviewAsync(configured, req.Bpm ?? LayerRegistry.CurrentGlobalBpm, CancellationToken.None);
    return Results.Ok(new { softUpdate = false });
});
```

The client can therefore *always* call the soft endpoint. If nothing is running,
or the ambient type changed, the server builds and previews a fresh scene. The
response tells you which happened.

**The bug this whole path exists to fix:** `HueEngine.PreviewAsync` originally had
no soft route — every call cancelled the current effect and constructed a new
`SceneRenderer` / `SceneController` / layer, then started a fresh `AnimationLoop`.
`OnActivate` zeroed all phase state. `emitLights()` re-issuing a full run every
~1.1–6 s meant every tick was a hard reset, read as flicker. Architecture gap, not
a JS problem.

---

## Part 2 — The JS side

### 2.1 Transport (`web/hue.js`)

A thin `fetch` wrapper over the `serve.py` `/api` proxy, with an abort timeout and
an online flag. `502` specifically means the proxy is up but the C# app is down.

```js
runEffect(request)       { return this.req("/effects/run",    { method: "POST", body: request }); },
runEffectParams(request) { return this.req("/effects/params", { method: "POST", body: request }); },
pulse(effectType, params, seconds) {
  return this.req("/effects/pulse", { method: "POST",
    body: { EffectType: effectType, EffectParams: params || {}, DurationSeconds: seconds || 2.5 } });
},
```

### 2.2 The single scalar (`house.js` — `lightOrder`)

```js
lightOrder: function () {
  var st = state;
  var truth = clamp(0.5
    + st.symmetry * 0.35 + st.regulation * 0.35
    - st.entropy * 0.5 - st.sensoryLoad * 0.25 - st.rumination * 0.15, 0, 1);
  // The mask hides turmoil: a masked house LOOKS composed (pulled toward a
  // calm-but-not-serene 0.6) unless the mask slips and the inside leaks out.
  var slip = (st.entropy > 0.7) && (Math.sin(this._t * 11) > 0.86);
  return { order: slip ? truth : lerp(truth, 0.6, st.mask * 0.7), slip: slip, truth: truth };
},
```

### 2.3 Four dimensions, not one (`emitLights`)

The layer live-tunes exactly four params. Mapping all of them from `order` alone
collapsed 26 state variables into one amber↔blue slider and made every event look
identical. Each param now has its own source:

```js
var hue    = lerp(26, 220, order);                                   // amber ↔ blue spine
var sat    = clamp(0.55 + out.sat * 0.42, 0.3, 0.97);                // certainty deepens colour
var light  = clamp(0.40 + out.bright * 0.16 + dopamine * 0.34, 0.22, 0.92);  // ← reward channel
var hex    = hslHex(hue, sat, light);

var speed  = clamp(lerp(0.22, 1.35, out.a) - order * 0.12, 0.05, 3.0);      // arousal = urgency
var spread = clamp(lerp(0.20, 0.60, state.entropy), 0.05, 1.0);             // chaos = diffuse
var flow   = clamp(0.45 + (out.v + 1) / 2 * 0.35 + dopamine * 0.45, 0, 1);  // valence + reward
```

`color` is sent as hex but computed in **HSL**, and its *lightness* — pinned at
0.55 in the first version — is a free fourth dimension the layer gets for nothing.
That is where rewards land.

### 2.4 Rate limiting and the hard/soft decision

```js
this._lightAcc += dt;
if (this._lightAcc < 0.14) return;                 // ~7 Hz ceiling; the gate below decides

var live = dopamine > 0.04 || lo.slip;             // house is moving → sample fast
if (!live && this._sinceEmit < 0.5) return;        // idling → fall back to 2 Hz

var moved = this._lastOrder < 0 ||
            Math.abs(order - this._lastOrder) >= 0.05 ||
            Math.abs(light - (this._lastLight || 0)) >= 0.02 ||
            Math.abs(flow  - (this._lastFlow  || 0)) >= 0.03;
if (!lo.slip && !moved && this._sinceEmit < 6) return;   // 6s keepalive so the layer never lapses
```

Dopamine decays in ~2 s, so a 0.5 s throttle with a single 0.05 deadband could miss
a reward entirely — the biggest payoff in the piece producing no visible light.
Hence the multi-signal deadband.

```js
var holding = this._lightHold > 0;                 // a moment's effect layer is in flight
var needsHardSwitch = !holding &&
  (this._lastOrder < 0 || lo.slip || wantSparkle !== this._sparkleOn);
if (!needsHardSwitch && this._lastOrder < 0) needsHardSwitch = true;  // nothing to patch yet

var ambientParams = { color: hex, speed: speed.toFixed(2),
                      spread: spread.toFixed(2), flowIntensity: flow.toFixed(2) };
try {
  if (needsHardSwitch)
    root.Hue.runEffect({ AmbientType: "Superfluid", AmbientParams: ambientParams, DurationSeconds: 8 });
  else
    root.Hue.runEffectParams({ AmbientType: "Superfluid", AmbientParams: ambientParams });
} catch (e) { /* offline — the house keeps thinking */ }
```

`holdLights(seconds)` is called by `moments.js` the instant a transient fires: for
that window `emitLights` may only soft-patch, because a rebuild would delete the
reward layer mid-flight.

All params are sent as **strings** (`toFixed(2)`) — matching
`Dictionary<string,string>` on the C# side, which is why `ApplyLiveParams` parses
rather than binds.

### 2.5 `lightReadout()`

Mirrors the mapping without touching the bridge — headless-testable in node, and
the debug overlay's source. Keep it in sync when you change `emitLights`; nothing
enforces that.

---

## Part 3 — Porting checklist

To lift this into another C# project:

1. **Do you have positioned lights?** The layer is meaningless without
   `Position[]` per lamp in a normalised space. Hue entertainment areas provide it;
   otherwise you must supply coordinates yourself. Real reference room here:
   12 lights, 520 × 430 × 240 cm.
2. **Copy in order:** `Vector3` → `ColorMath.{Clamp01,SmoothStep}` → `LightState` →
   `SceneLayer` → `SuperfluidFlowLayer`. Only the last one is interesting; the rest
   are 20-line dependencies.
3. **Decide your origin policy.** The name-hint heuristic is convenient and fragile.
   An explicit id is better if your host can supply one.
4. **Implement `ILiveTunable` (or your equivalent) from day one.** Retrofitting it
   after you've built the "just rebuild the scene" path is how the flicker bug got
   in. Rule: *modulate a running field, never switch.*
5. **Parse with `InvariantCulture`.** Non-negotiable on a Dutch/German machine.
6. **Drive it at ≥30 fps with a real wall-clock delta.** The layer is frame-rate
   independent; your loop should be too.
7. **Composite by priority with alpha.** `Priority = 0` for this layer. If your
   renderer only replaces, transient effects will hard-cut over the flood.
8. **Keep a 3 s attack.** Not decoration — direct response to "too harsh when the
   lights jump on". And ensure your live-patch path never resets its clock.

### Extension points the maths already supports

- **Moving / explicit origin** — `_origin` is read every frame in `Update`; only
  `OnActivate` sets it. Recomputing `_perLight` on change is the only cost.
- **Multiple origins** — the corner loop already max-blends N flows. A second
  origin is the same loop over a second `(origin, perLight)` pair.
- **Non-sinusoidal reach** — `reach` is one line. A wave equation, reflections off
  walls, or a BPM-locked phase all drop in there without touching anything else.
- **Screen ↔ room continuity** — mirroring the same field on canvas
  (`drawSuperfluidBloom`, planned in `ROADMAP.md`) means the flood leaves the
  screen and continues onto the walls with no seam.

---

**Branch requirement:** `SuperfluidFlowLayer` + `/api/effects/params` need
`emotion-hue` **or later**; `/api/effects/pulse`, alpha compositing, `EnvelopeLayer`
and `SustainLayer` exist on `feature/transient-effects` **or later**. On an older
branch the flood runs but every earned moment silently does nothing — the expensive
failure, because it looks correct. For the party, run `feature/party-installation`
specifically: it carries all of the above forward *and* adds `/api/energy`, the
business→brightness coupling. On `feature/transient-effects` itself the flood and
every earned moment work fine, but `/api/energy` 404s and that coupling silently
dies — a 404 there is the tell.

**Related:** `docs/LIGHTING.md` (the chain end to end), `docs/HUE-API.md`
(generated API truth), `ROADMAP.md` (shipped artifacts + open questions).
