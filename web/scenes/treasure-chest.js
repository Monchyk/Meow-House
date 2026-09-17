(function () {
  'use strict';
  var canvas = document.getElementById('stage'), ctx = canvas.getContext('2d');
  var $ = function (id) { return document.getElementById(id); };
  var TAU = Math.PI * 2, PHI = (1 + Math.sqrt(5)) / 2;
  var verts = [[0,1,PHI],[0,1,-PHI],[0,-1,PHI],[0,-1,-PHI],[1,PHI,0],[1,-PHI,0],[-1,PHI,0],[-1,-PHI,0],[PHI,0,1],[PHI,0,-1],[-PHI,0,1],[-PHI,0,-1]];
  var edges = [];
  verts.forEach(function (a, i) { verts.forEach(function (b, j) {
    if (j > i && Math.abs(a.reduce(function (s,v,k) { return s + (v-b[k])**2; },0)-4)<0.01) edges.push([i,j]);
  }); });
  var p = { speed: 0.65, growth: 18, delay: 3, cage: 0.8, heart: 0.75, bpm: 48,
    spin: 0.12, zoom: 1, release: 9, glow: 0.6, hue: 0.15 };
  var time = 0, playing = true, last = performance.now(), contact = null, contactScale = 0;
  var duration = 80, dirty = true, dpr = Math.min(devicePixelRatio || 1, 1.5);
  var samples = [], phaseTime = NaN, phaseSin = 0, phaseCos = 1, wingMotion = 0;
  // The curve's spatial frequencies never change. Only its time phase changes.
  for (var sample = 0; sample <= 1152; sample++) {
    var tt = sample / 1152 * 48, b = sample / 1152 * TAU * 6;
    var e1 = Math.exp(-0.005 * tt), e2 = Math.exp(-0.011 * tt);
    var r = (Math.exp(Math.cos(b)) - 2 * Math.cos(4*b) + Math.sin(b/12)**5)*0.28;
    samples.push([Math.sin(2*tt)*e1, Math.cos(2*tt)*e1, Math.sin(3*tt+1.7)*e2,
      Math.sin(3*tt+0.6)*e1, Math.cos(3*tt+0.6)*e1, Math.sin(2*tt+1.1)*e2,
      r*Math.sin(b), -r*Math.cos(b)]);
  }
  function setPhase(t) {
    if (phaseTime === t) return;
    phaseTime=t; phaseSin=Math.sin(t*0.07); phaseCos=Math.cos(t*0.07); wingMotion=Math.sin(t*1.1);
  }
  var palettes = window.PALETTES ? window.PALETTES.all() : [];
  if (!ctx || !window.SYM || !palettes.length) { $('error').textContent = 'The scene engine did not load.'; return; }
  var clamp = function (v,a,b) { return Math.max(a,Math.min(b,v)); };
  var mix = function (a,b,t) { return a+(b-a)*t; };
  var ease = function (t) { t=clamp(t,0,1); return t*t*(3-2*t); };
  var rgba = function (c,a) { return 'rgba('+c.r+','+c.g+','+c.b+','+a+')'; };
  function pulse(t) {
    var phase = (t*p.bpm/60)%1;
    return Math.exp(-(((phase-0.18)/0.075)**2)) + 0.55*Math.exp(-(((phase-0.38)/0.09)**2));
  }
  function heartbeat(t) { return 1+p.heart*0.15*pulse(t); }
  function cageSize(t) { return mix(0.23,p.cage,ease((t-1)/p.growth)); }
  function innerSize(t) { return mix(0.09,p.cage*1.85,ease((t-1-p.delay)/(p.growth*1.85))); }
  function cagePoints(t) {
    var yaw=t*p.spin*0.34, pitch=0.62+Math.sin(t*p.spin*0.19)*0.12;
    var scale=0.27*cageSize(t);
    return verts.map(function(v) {
      var x=v[0]*Math.cos(yaw)-v[2]*Math.sin(yaw), z=v[0]*Math.sin(yaw)+v[2]*Math.cos(yaw);
      var y=v[1]*Math.cos(pitch)-z*Math.sin(pitch), zz=v[1]*Math.sin(pitch)+z*Math.cos(pitch);
      var perspective=1/(1+(zz+2)*0.045);
      return [x*scale*perspective,y*scale*perspective,zz];
    });
  }
  function curve(u,t,morph) {
    setPhase(t);
    var a=samples[Math.round(u*1152)];
    var x=0.5*(a[0]*phaseCos+a[1]*phaseSin+a[2]);
    var y=0.5*(a[3]*phaseCos-a[4]*phaseSin+a[5]);
    return [mix(x,a[6]*(1-0.06*wingMotion*morph),morph),mix(y,a[7],morph)];
  }
  function cross(a,b,c) { return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]); }
  function hull(points) {
    var sorted=points.slice().sort(function(a,b){return a[0]-b[0]||a[1]-b[1];}), lower=[],upper=[];
    sorted.forEach(function(v){while(lower.length>1&&cross(lower[lower.length-2],lower[lower.length-1],v)<=0)lower.pop(); lower.push(v);});
    sorted.reverse().forEach(function(v){while(upper.length>1&&cross(upper[upper.length-2],upper[upper.length-1],v)<=0)upper.pop(); upper.push(v);});
    lower.pop(); upper.pop(); return lower.concat(upper);
  }
  // Contact uses the visible outer silhouette, not the overlapping back edges.
  // Fixed samples make replay and seeking produce the same release moment.
  function findContact() {
    contact=null;
    for(var tick=0;tick<=2400;tick++) {
      var t=tick/30, border=hull(cagePoints(t)), scale=0.35*innerSize(t)*heartbeat(t);
      setPhase(t);
      var bounds=border.map(function(a,k){var b=border[(k+1)%border.length];return [b[0]-a[0],b[1]-a[1],a[0],a[1]];});
      for(var j=0;j<=384;j++) {
        var a=samples[j*3];
        var x=0.5*(a[0]*phaseCos+a[1]*phaseSin+a[2])*scale;
        var y=0.5*(a[3]*phaseCos-a[4]*phaseSin+a[5])*scale;
        for(var k=0;k<bounds.length;k++) {
          var edge=bounds[k];
          if(edge[0]*(y-edge[3])-edge[1]*(x-edge[2])<0) {
            contact=t; contactScale=innerSize(t); dirty=false; return;
          }
        }
      }
    }
    dirty=false;
  }
  function stateAt(t) {
    var after=contact===null?0:Math.max(0,t-contact), release=ease(after/p.release);
    return {after:after,release:release,morph:ease((after-0.4)/(p.release*1.2)),
      scale:contact===null||t<contact?innerSize(t):mix(contactScale,0.82,ease(after/(p.release*1.4)))};
  }
  function fit() {
    canvas.width=Math.round(innerWidth*dpr); canvas.height=Math.round(innerHeight*dpr);
    render();
  }
  function render() {
    if(dirty)findContact();
    var w=canvas.width,h=canvas.height,unit=Math.min(w,h)*p.zoom,cx=w/2,cy=h*0.46;
    var state=stateAt(time), beat=pulse(time), points=cagePoints(time);
    var pal=palettes[Number($('palette').value)||0].colors;
    var color=window.SYM.orderColor(0.86,pal);
    function ink(u) {return color.at(u*0.28+p.hue+state.morph*0.16,time*0.002);}
    ctx.globalCompositeOperation='source-over'; ctx.fillStyle='#04050a'; ctx.fillRect(0,0,w,h);
    var light=(0.045+beat*0.025+Math.exp(-state.after*0.7)*(state.after>0?0.12:0))*p.glow;
    var glow=ctx.createRadialGradient(cx,cy,0,cx,cy,unit*0.65);
    glow.addColorStop(0,rgba(ink(0.5),light)); glow.addColorStop(1,rgba(ink(0.5),0));
    ctx.fillStyle=glow; ctx.fillRect(0,0,w,h);
    ctx.save(); ctx.translate(cx,cy); ctx.scale(unit,unit);
    ctx.globalCompositeOperation='lighter'; ctx.lineCap='round'; ctx.lineJoin='round';
    if(state.release<1) edges.forEach(function(edge,i) {
      var a=points[edge[0]],b=points[edge[1]],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
      var travel=state.release*1.5, angle=state.release*(i%2?1:-1)*0.8;
      var dx=(b[0]-a[0])/2,dy=(b[1]-a[1])/2;
      var rx=dx*Math.cos(angle)-dy*Math.sin(angle),ry=dx*Math.sin(angle)+dy*Math.cos(angle);
      var x=mx*(1+travel),y=my*(1+travel);
      var depth=clamp((a[2]+b[2])/(4*PHI)+0.5,0,1), c=ink(i/edges.length);
      ctx.strokeStyle=rgba(c,(0.22+depth*0.42+beat*0.1)*(1-state.release));
      ctx.lineWidth=(0.8+depth*0.6)*dpr/unit;
      ctx.beginPath();ctx.moveTo(x-rx,y-ry);ctx.lineTo(x+rx,y+ry);ctx.stroke();
    });
    var size=0.35*state.scale*heartbeat(time), segments=12, sub=96;
    // Keep all 1152 samples, batching adjacent colours into twelve paths.
    // A translucent wide stroke supplies glow without per-stroke blur surfaces.
    for(var s=0;s<segments;s++) {
      var c=ink(s/segments);ctx.beginPath();
      for(var j=0;j<=sub;j++) {
        var v=curve((s+j/sub)/segments,time,state.morph);
        if(j===0)ctx.moveTo(v[0]*size,v[1]*size);else ctx.lineTo(v[0]*size,v[1]*size);
      }
      if(p.glow>0) {
        ctx.strokeStyle=rgba(c,p.glow*(0.07+beat*0.025));ctx.lineWidth=4*dpr/unit;ctx.stroke();
      }
      ctx.strokeStyle=rgba(c,0.78);ctx.lineWidth=1.15*dpr/unit;ctx.stroke();
    }
    ctx.restore();
    $('timeline').value=time; $('clock').textContent=time.toFixed(1)+' / '+duration+' s';
    $('play').textContent=playing?'Pause':'Play';
    $('stateLabel').textContent=state.morph>=1?'the butterfly · still beating':state.after>0?'the chest opens · the wings emerge':time<1+p.delay?'the chest begins to grow':time<1+p.growth?'two growths · one heartbeat':'the chest holds · the heart reaches';
  }
  document.querySelectorAll('[data-param]').forEach(function(el) {
    var key=el.dataset.param;el.value=p[key];el.nextElementSibling.value=p[key];
    el.addEventListener('input',function(){p[key]=Number(el.value);el.nextElementSibling.value=el.value;
      if(['growth','delay','cage','heart','bpm','spin'].includes(key))dirty=true;render();});
  });
  palettes.forEach(function(palette,i){var o=document.createElement('option');o.value=i;o.textContent=palette.id;$('palette').appendChild(o);});
  $('palette').value=String(Math.max(0,palettes.findIndex(function(palette){return palette.id==='Aurora';})));
  $('palette').addEventListener('change',render);
  $('play').addEventListener('click',function(){if(time>=duration)time=0;playing=!playing;render();});
  $('restart').addEventListener('click',function(){time=0;playing=true;render();});
  $('timeline').addEventListener('input',function(){time=Number(this.value);playing=false;render();});
  $('contact').addEventListener('click',function(){if(dirty)findContact();time=contact===null?0:Math.max(0,contact-0.5);playing=false;render();});
  $('reveal').addEventListener('click',function(){if(dirty)findContact();time=contact===null?duration:Math.min(duration,contact+p.release*1.3);playing=false;render();});
  window.addEventListener('keydown',function(e){if(/INPUT|SELECT|BUTTON/.test(e.target.tagName))return;
    if(e.code==='Space'){e.preventDefault();$('play').click();}
    if(e.key.toLowerCase()==='h'){$('lab').hidden=!$('lab').hidden;$('transport').hidden=$('lab').hidden;}
  });
  window.addEventListener('resize',fit);fit();
  function frame(now) {
    var dt=Math.min(0.05,(now-last)/1000);last=now;
    if(playing){time=Math.min(duration,time+dt*p.speed);if(time>=duration)playing=false;render();}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
