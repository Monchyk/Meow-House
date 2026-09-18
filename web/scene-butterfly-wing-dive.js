/* Butterfly Infinity Heart: centre dive into two living lemniscates.
 * Story time controls the morph. Party business continuously drives its life. */
(function (root) {
  "use strict";
  var TAU = Math.PI * 2;
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function mix(a,b,t){return a+(b-a)*t;}
  function ease(t){t=clamp(t,0,1);return t*t*(3-2*t);}
  function rgba(c,a){return "rgba("+c.r+","+c.g+","+c.b+","+a+")";}
  function rotate(q,a){var c=Math.cos(a),s=Math.sin(a);return[q[0]*c-q[1]*s,q[0]*s+q[1]*c];}
  function butterfly(u,life,breath){
    var t=u*TAU*6;
    var r=(Math.exp(Math.cos(t))-2*Math.cos(4*t)+Math.pow(Math.sin(t/12),5))*0.28;
    return[r*Math.sin(t)*(1-0.04*Math.sin(life*1.1)*breath),-r*Math.cos(t)];
  }
  function lemniscate(u,phase,tension){
    var t=u*TAU*6+phase,s=Math.sin(t),c=Math.cos(t),d=1+s*s;
    return[c/d,s*c/d*mix(0.88,1.18,tension)];
  }

  function InfinityHeartDirector(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext("2d");
    this.zoom=false;this.substrate=null;this.time=0;this.life=0;
    this.duration=42;this.playing=true;
    this.p={speed:1,diveStart:7,diveLength:18,magnification:6,morphStart:0.38,
      spin:0.34,breath:0.72,overlap:0.18,echoes:7,glow:0.78,hue:0.12};
    this.palettes=root.PALETTES?root.PALETTES.all():[];
    this.paletteIndex=Math.max(0,this.palettes.findIndex(function(x){return x.id==="Aurora";}));
  }
  InfinityHeartDirector.prototype.pop=function(a){this.life+=(a||0.3)*0.8;};
  InfinityHeartDirector.prototype.dispose=function(){};
  InfinityHeartDirector.prototype.acceptHandoff=function(h){
    var s=h&&h.state;if(!s)return;
    if(s.paletteIndex!=null)this.paletteIndex=clamp(Math.round(s.paletteIndex),0,this.palettes.length-1);
    if(s.life!=null)this.life=Number(s.life)||0;
  };
  InfinityHeartDirector.prototype.getDuration=function(){return this.duration;};
  InfinityHeartDirector.prototype.getTime=function(){return this.time;};
  InfinityHeartDirector.prototype.seek=function(s){this.time=clamp(Number(s)||0,0,this.duration);};
  InfinityHeartDirector.prototype.isPlaying=function(){return this.playing;};
  InfinityHeartDirector.prototype.setPlaying=function(v){this.playing=!!v;if(this.playing&&this.time>=this.duration)this.time=0;};
  InfinityHeartDirector.prototype.getControls=function(){return[
    {key:"speed",label:"story speed",min:0.2,max:1.8,step:0.05},
    {key:"diveStart",label:"hold butterfly",min:0,max:14,step:0.5},
    {key:"diveLength",label:"centre dive",min:8,max:30,step:0.5},
    {key:"magnification",label:"centre zoom",min:2,max:12,step:0.5},
    {key:"morphStart",label:"infinity reveal",min:0.1,max:0.75,step:0.05},
    {key:"spin",label:"counter-spin",min:0,max:1,step:0.05},
    {key:"breath",label:"living breath",min:0,max:1,step:0.05},
    {key:"overlap",label:"overlap tension",min:0,max:0.5,step:0.01},
    {key:"echoes",label:"motion echoes",min:1,max:12,step:1},
    {key:"glow",label:"light",min:0,max:1,step:0.05},
    {key:"hue",label:"colour drift",min:0,max:1,step:0.01}
  ];};
  InfinityHeartDirector.prototype.getControlValue=function(k){return this.p[k];};
  InfinityHeartDirector.prototype.setControl=function(k,v){
    var s=this.getControls().find(function(x){return x.key===k;});if(!s)return false;
    this.p[k]=clamp(Number(v),s.min,s.max);return true;
  };
  InfinityHeartDirector.prototype.serialize=function(){
    var q={};for(var k in this.p)if(Object.prototype.hasOwnProperty.call(this.p,k))q[k]=this.p[k];
    return{scene:"butterfly-wing-dive",time:this.time,life:this.life,playing:this.playing,params:q,paletteIndex:this.paletteIndex};
  };
  InfinityHeartDirector.prototype.restore=function(s){
    if(!s||typeof s!=="object")return false;var self=this;
    if(s.params)Object.keys(s.params).forEach(function(k){self.setControl(k,s.params[k]);});
    if(s.paletteIndex!=null)this.paletteIndex=clamp(Math.round(s.paletteIndex),0,this.palettes.length-1);
    if(s.time!=null)this.seek(s.time);if(s.life!=null)this.life=Number(s.life)||0;
    if(s.playing!=null)this.playing=!!s.playing;return true;
  };

  InfinityHeartDirector.prototype.draw=function(dt){
    if(!this.ctx||!root.SYM||!this.palettes.length)return;
    var party=root.PARTY,biz=party?clamp(party.business||0,0,1):0.2;
    var tune=party&&party.spiralTune?clamp((party.spiralTune()+1)/2,0,1):0.5;
    this.life+=Math.min(0.05,dt)*(0.32+biz*1.85);
    if(this.playing){this.time=Math.min(this.duration,this.time+Math.min(0.05,dt)*this.p.speed);if(this.time>=this.duration)this.playing=false;}
    var ctx=this.ctx,w=this.canvas.width,h=this.canvas.height,p=this.p;if(!w||!h)return;
    var dpr=Math.min(root.devicePixelRatio||1,1.5);
    var dive=ease((this.time-p.diveStart)/p.diveLength);
    var morph=ease((dive-p.morphStart)/Math.max(0.05,1-p.morphStart));
    var spinIn=ease((morph-0.18)/0.82),settle=ease(this.time/3.5);
    var diveZoom=Math.exp(Math.log(Math.max(1,p.magnification))*ease(Math.min(1,dive/0.72)));
    var cameraZoom=mix(diveZoom,1.18+biz*0.16,morph);
    var breathing=1+p.breath*((0.025+biz*0.055)*Math.sin(this.life*(0.62+biz*0.32))+0.022*Math.sin(this.life*0.19+1.1));
    var unit=Math.min(w,h)*0.285*mix(0.84,1,settle)*cameraZoom*breathing,cx=w/2,cy=h/2;
    var pal=this.palettes[this.paletteIndex].colors,ramp=root.SYM.orderColor(tune,pal),self=this;
    function ink(u){return ramp.at(u+p.hue+self.life*(0.002+biz*0.006));}
    function screen(q){return[cx+q[0]*unit,cy+q[1]*unit];}

    ctx.globalCompositeOperation="source-over";ctx.fillStyle="#04050a";ctx.fillRect(0,0,w,h);
    var halo=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.min(w,h)*0.62);
    halo.addColorStop(0,rgba(ink(0.5),p.glow*(0.055+biz*0.055)*breathing));halo.addColorStop(1,"rgba(4,5,10,0)");
    ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
    ctx.save();ctx.globalCompositeOperation="lighter";ctx.lineCap="round";ctx.lineJoin="round";
    var echoes=Math.round(p.echoes),spinRate=p.spin*(0.08+biz*0.52),baseSpin=this.life*spinRate*spinIn;
    var separation=p.overlap*(0.35+biz*0.65)*Math.sin(this.life*0.43);
    var passes=morph<0.995?2:echoes;
    for(var e=passes-1;e>=0;e--){
      var lag=e*(0.018+biz*0.012),alpha=(e===0?0.82:0.11/Math.max(1,e))*p.glow,es=1-e*0.008;
      for(var twin=0;twin<2;twin++){
        var sign=twin?-1:1,angle=sign*(baseSpin-lag*(1+biz*2.2))+sign*separation;
        ctx.beginPath();
        for(var j=0;j<=576;j++){
          var u=j/576,from=butterfly(u,this.life-lag,1-morph*0.75);
          var inf=rotate(lemniscate(u,twin*Math.PI,tune),angle);inf[0]*=es;inf[1]*=es;
          var q=screen([mix(from[0],inf[0],morph),mix(from[1],inf[1],morph)]);
          if(j===0)ctx.moveTo(q[0],q[1]);else ctx.lineTo(q[0],q[1]);
        }
        var color=ink(0.18+twin*0.48+e*0.025);
        if(e===0&&p.glow>0){ctx.strokeStyle=rgba(color,p.glow*(0.055+biz*0.035));ctx.lineWidth=(5+biz*3)*dpr;ctx.stroke();}
        ctx.strokeStyle=rgba(color,alpha*(twin?0.82:1));ctx.lineWidth=(1.05+biz*0.75)*dpr;ctx.stroke();
      }
    }
    var pulse=Math.pow(Math.max(0,Math.sin(this.life*(1.25+biz))),8),n=(2.5+pulse*5+biz*2)*dpr;
    ctx.fillStyle=rgba(ink(0.78),0.55+pulse*0.38);ctx.shadowColor=rgba(ink(0.78),1);ctx.shadowBlur=16+pulse*28;
    ctx.beginPath();ctx.arc(cx,cy,n,0,TAU);ctx.fill();ctx.restore();
  };

  if(root.SCENES&&root.SCENES.register)root.SCENES.register(
    "butterfly-wing-dive","Butterfly · infinity heart",
    function(canvas){return new InfinityHeartDirector(canvas);},{duration:44,show:true}
  );
})(typeof window!=="undefined"?window:globalThis);
