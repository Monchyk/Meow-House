/* Butterfly Wing Zoom — the alternate branch: enter one wing, not the heart. */
(function(root){
  "use strict";
  var TAU=Math.PI*2;
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function mix(a,b,t){return a+(b-a)*t;}
  function ease(t){t=clamp(t,0,1);return t*t*(3-2*t);}
  function rgba(c,a){return"rgba("+c.r+","+c.g+","+c.b+","+a+")";}
  function butterfly(u,life){
    var t=u*TAU*6,r=(Math.exp(Math.cos(t))-2*Math.cos(4*t)+Math.pow(Math.sin(t/12),5))*0.28;
    return[r*Math.sin(t)*(1-0.03*Math.sin(life*1.1)),-r*Math.cos(t)];
  }
  function WingZoomDirector(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext("2d");this.zoom=false;this.substrate=null;
    this.time=0;this.life=0;this.duration=38;this.playing=true;
    this.p={speed:1,hold:7,dive:25,magnification:22,wing:1,veins:0.72,glow:0.72,hue:0.12,cell:0.055};
    this.palettes=root.PALETTES?root.PALETTES.all():[];
    this.paletteIndex=Math.max(0,this.palettes.findIndex(function(x){return x.id==="Aurora";}));
  }
  WingZoomDirector.prototype.pop=function(a){this.life+=(a||0.3)*0.8;};
  WingZoomDirector.prototype.dispose=function(){};
  WingZoomDirector.prototype.getDuration=function(){return this.duration;};
  WingZoomDirector.prototype.getTime=function(){return this.time;};
  WingZoomDirector.prototype.seek=function(s){this.time=clamp(Number(s)||0,0,this.duration);};
  WingZoomDirector.prototype.isPlaying=function(){return this.playing;};
  WingZoomDirector.prototype.setPlaying=function(v){this.playing=!!v;if(this.playing&&this.time>=this.duration)this.time=0;};
  WingZoomDirector.prototype.getControls=function(){return[
    {key:"speed",label:"story speed",min:0.2,max:1.8,step:0.05},
    {key:"hold",label:"hold butterfly",min:0,max:14,step:0.5},
    {key:"dive",label:"wing dive",min:10,max:34,step:0.5},
    {key:"magnification",label:"wing zoom",min:4,max:40,step:1},
    {key:"wing",label:"wing side",min:-1,max:1,step:2},
    {key:"veins",label:"vein light",min:0,max:1,step:0.05},
    {key:"glow",label:"light",min:0,max:1,step:0.05},
    {key:"hue",label:"colour drift",min:0,max:1,step:0.01},
    {key:"cell",label:"wing cell",min:0.015,max:0.12,step:0.005}
  ];};
  WingZoomDirector.prototype.getControlValue=function(k){return this.p[k];};
  WingZoomDirector.prototype.setControl=function(k,v){
    var s=this.getControls().find(function(x){return x.key===k;});if(!s)return false;
    this.p[k]=clamp(Number(v),s.min,s.max);return true;
  };
  WingZoomDirector.prototype.serialize=function(){
    var params={};for(var k in this.p)if(Object.prototype.hasOwnProperty.call(this.p,k))params[k]=this.p[k];
    return{scene:"butterfly-wing-zoom",time:this.time,life:this.life,playing:this.playing,params:params,paletteIndex:this.paletteIndex};
  };
  WingZoomDirector.prototype.restore=function(s){
    if(!s)return false;var self=this;
    if(s.params)Object.keys(s.params).forEach(function(k){self.setControl(k,s.params[k]);});
    if(s.time!=null)this.seek(s.time);if(s.life!=null)this.life=Number(s.life)||0;
    if(s.playing!=null)this.playing=!!s.playing;return true;
  };
  WingZoomDirector.prototype.acceptHandoff=function(h){
    var s=h&&h.state;if(!s)return;
    if(s.life!=null)this.life=Number(s.life)||0;
    if(s.paletteIndex!=null)this.paletteIndex=clamp(Math.round(s.paletteIndex),0,this.palettes.length-1);
  };
  WingZoomDirector.prototype.draw=function(dt){
    if(!this.ctx||!root.SYM||!this.palettes.length)return;
    var party=root.PARTY,biz=party?clamp(party.business||0,0,1):0.2;
    var tune=party&&party.spiralTune?clamp((party.spiralTune()+1)/2,0,1):0.5;
    this.life+=Math.min(0.05,dt)*(0.3+biz*1.7);
    if(this.playing){this.time=Math.min(this.duration,this.time+Math.min(0.05,dt)*this.p.speed);if(this.time>=this.duration)this.playing=false;}
    var ctx=this.ctx,w=this.canvas.width,h=this.canvas.height,p=this.p;if(!w||!h)return;
    var move=ease((this.time-p.hold)/p.dive),side=p.wing<0?-1:1,target=[side*0.48,-0.17];
    var camera=[target[0]*move,target[1]*move],zoom=Math.exp(Math.log(p.magnification)*move);
    var breath=1+(0.02+biz*0.05)*Math.sin(this.life*(0.6+biz*0.5));
    var unit=Math.min(w,h)*0.28*zoom*breath,cx=w/2,cy=h/2;
    var ramp=root.SYM.orderColor(tune,this.palettes[this.paletteIndex].colors),self=this;
    function ink(u){return ramp.at(u+p.hue+self.life*(0.002+biz*0.006));}
    function screen(q){return[cx+(q[0]-camera[0])*unit,cy+(q[1]-camera[1])*unit];}
    ctx.globalCompositeOperation="source-over";ctx.fillStyle="#04050a";ctx.fillRect(0,0,w,h);
    var halo=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.min(w,h)*0.6);
    halo.addColorStop(0,rgba(ink(.5),p.glow*(.045+biz*.05)));halo.addColorStop(1,"rgba(4,5,10,0)");
    ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
    ctx.save();ctx.globalCompositeOperation="lighter";ctx.lineCap="round";
    for(var seg=0;seg<12;seg++){
      ctx.beginPath();
      for(var j=0;j<=96;j++){var u=(seg+j/96)/12,q=screen(butterfly(u,this.life));if(j===0)ctx.moveTo(q[0],q[1]);else ctx.lineTo(q[0],q[1]);}
      var c=ink(seg/12);ctx.strokeStyle=rgba(c,.76);ctx.lineWidth=1.2;ctx.stroke();
      if(p.glow){ctx.strokeStyle=rgba(c,p.glow*.055);ctx.lineWidth=5;ctx.stroke();}
    }
    var hinge=screen([side*.055,.02]);
    for(var v=0;v<34;v++){
      var u0=(v+.5)/34,pt=butterfly(u0,this.life);if(pt[0]*side<.08)continue;
      var tip=screen(pt);ctx.strokeStyle=rgba(ink(u0),p.veins*(.035+move*.22));ctx.lineWidth=mix(.55,1.2,move);
      ctx.beginPath();ctx.moveTo(hinge[0],hinge[1]);
      ctx.quadraticCurveTo(mix(hinge[0],tip[0],.55),tip[1]+Math.sin(v*2.4)*unit*.012,tip[0],tip[1]);ctx.stroke();
    }
    ctx.restore();
    var vp=screen(target),vr=p.cell*unit;
    var vg=ctx.createRadialGradient(vp[0],vp[1],0,vp[0],vp[1],vr*1.8);
    vg.addColorStop(0,"rgba(0,0,0,.88)");vg.addColorStop(.55,"rgba(2,2,7,.72)");vg.addColorStop(1,"rgba(4,5,10,0)");
    ctx.fillStyle=vg;ctx.beginPath();ctx.arc(vp[0],vp[1],vr*1.8,0,TAU);ctx.fill();
  };
  if(root.SCENES&&root.SCENES.register)root.SCENES.register(
    "butterfly-wing-zoom","Butterfly · wing zoom",function(canvas){return new WingZoomDirector(canvas);},{duration:40}
  );
})(typeof window!=="undefined"?window:globalThis);
