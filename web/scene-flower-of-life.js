/* Flower of Life — two lemniscates phase-lock and seed a breathing circle field. */
(function(root){
  "use strict";
  var TAU=Math.PI*2;
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function mix(a,b,t){return a+(b-a)*t;}
  function ease(t){t=clamp(t,0,1);return t*t*(3-2*t);}
  function rgba(c,a){return"rgba("+c.r+","+c.g+","+c.b+","+a+")";}
  function rotate(q,a){var c=Math.cos(a),s=Math.sin(a);return[q[0]*c-q[1]*s,q[0]*s+q[1]*c];}
  function lemniscate(u,phase){
    var t=u*TAU+phase,s=Math.sin(t),c=Math.cos(t),d=1+s*s;
    return[c/d,s*c/d];
  }
  var CELLS=[];
  for(var q=-2;q<=2;q++)for(var r=-2;r<=2;r++){
    var s=-q-r;if(Math.max(Math.abs(q),Math.abs(r),Math.abs(s))<=2)
      CELLS.push({q:q,r:r,ring:Math.max(Math.abs(q),Math.abs(r),Math.abs(s))});
  }
  CELLS.sort(function(a,b){return a.ring-b.ring;});

  function FlowerDirector(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext("2d");this.zoom=false;this.substrate=null;
    this.time=0;this.life=0;this.duration=38;this.playing=true;
    this.p={speed:1,hold:5,unfold:17,spin:0.16,breath:0.7,spread:0.94,
      line:0.72,echoes:4,glow:0.72,hue:0.18};
    this.palettes=root.PALETTES?root.PALETTES.all():[];
    this.paletteIndex=Math.max(0,this.palettes.findIndex(function(x){return x.id==="Aurora";}));
  }
  FlowerDirector.prototype.pop=function(a){this.life+=(a||0.3)*0.8;};
  FlowerDirector.prototype.dispose=function(){};
  FlowerDirector.prototype.acceptHandoff=function(h){
    var s=h&&h.state;if(!s)return;
    if(s.paletteIndex!=null)this.paletteIndex=clamp(Math.round(s.paletteIndex),0,this.palettes.length-1);
    if(s.life!=null)this.life=Number(s.life)||0;
  };
  FlowerDirector.prototype.getDuration=function(){return this.duration;};
  FlowerDirector.prototype.getTime=function(){return this.time;};
  FlowerDirector.prototype.seek=function(s){this.time=clamp(Number(s)||0,0,this.duration);};
  FlowerDirector.prototype.isPlaying=function(){return this.playing;};
  FlowerDirector.prototype.setPlaying=function(v){this.playing=!!v;if(this.playing&&this.time>=this.duration)this.time=0;};
  FlowerDirector.prototype.getControls=function(){return[
    {key:"speed",label:"story speed",min:0.2,max:1.8,step:0.05},
    {key:"hold",label:"hold infinity",min:0,max:12,step:0.5},
    {key:"unfold",label:"flower unfold",min:8,max:28,step:0.5},
    {key:"spin",label:"field rotation",min:0,max:0.7,step:0.01},
    {key:"breath",label:"living breath",min:0,max:1,step:0.05},
    {key:"spread",label:"circle spread",min:0.65,max:1.2,step:0.01},
    {key:"line",label:"line presence",min:0.1,max:1,step:0.05},
    {key:"echoes",label:"motion echoes",min:1,max:8,step:1},
    {key:"glow",label:"light",min:0,max:1,step:0.05},
    {key:"hue",label:"colour drift",min:0,max:1,step:0.01}
  ];};
  FlowerDirector.prototype.getControlValue=function(k){return this.p[k];};
  FlowerDirector.prototype.setControl=function(k,v){
    var spec=this.getControls().find(function(x){return x.key===k;});if(!spec)return false;
    this.p[k]=clamp(Number(v),spec.min,spec.max);return true;
  };
  FlowerDirector.prototype.serialize=function(){
    var params={};for(var k in this.p)if(Object.prototype.hasOwnProperty.call(this.p,k))params[k]=this.p[k];
    return{scene:"flower-of-life",time:this.time,life:this.life,playing:this.playing,params:params,paletteIndex:this.paletteIndex};
  };
  FlowerDirector.prototype.restore=function(s){
    if(!s||typeof s!=="object")return false;var self=this;
    if(s.params)Object.keys(s.params).forEach(function(k){self.setControl(k,s.params[k]);});
    if(s.time!=null)this.seek(s.time);if(s.life!=null)this.life=Number(s.life)||0;
    if(s.playing!=null)this.playing=!!s.playing;return true;
  };
  FlowerDirector.prototype.draw=function(dt){
    if(!this.ctx||!root.SYM||!this.palettes.length)return;
    var party=root.PARTY,biz=party?clamp(party.business||0,0,1):0.2;
    var tune=party&&party.spiralTune?clamp((party.spiralTune()+1)/2,0,1):0.5;
    this.life+=Math.min(0.05,dt)*(0.28+biz*1.65);
    if(this.playing){this.time=Math.min(this.duration,this.time+Math.min(0.05,dt)*this.p.speed);if(this.time>=this.duration)this.playing=false;}
    var ctx=this.ctx,w=this.canvas.width,h=this.canvas.height,p=this.p;if(!w||!h)return;
    var reveal=ease((this.time-p.hold)/p.unfold),lock=ease(reveal/0.48);
    var outro=ease((this.time-(this.duration-7))/7);
    var returnScale=mix(1,0.16,outro),returnAlpha=mix(1,0.18,outro);
    var breathe=1+p.breath*((0.025+biz*0.05)*Math.sin(this.life*(0.58+biz*0.4))+0.018*Math.sin(this.life*0.17));
    var unit=Math.min(w,h)*0.155*breathe,cx=w/2,cy=h/2;
    var rotation=this.life*p.spin*(0.2+biz*0.8)*(0.25+reveal*0.75);
    var ramp=root.SYM.orderColor(tune,this.palettes[this.paletteIndex].colors),self=this;
    function ink(u){return ramp.at(u+p.hue+self.life*(0.002+biz*0.005));}
    ctx.globalCompositeOperation="source-over";ctx.fillStyle="#04050a";ctx.fillRect(0,0,w,h);
    var halo=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.min(w,h)*0.58);
    halo.addColorStop(0,rgba(ink(0.5),p.glow*(0.045+biz*0.055)));halo.addColorStop(1,"rgba(4,5,10,0)");
    ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
    ctx.save();ctx.globalCompositeOperation="lighter";ctx.lineCap="round";

    /* Incoming infinity pair slows and aligns before circles take authority. */
    if(reveal<1){
      for(var twin=0;twin<2;twin++){
        var sign=twin?-1:1,angle=sign*this.life*(0.08+biz*0.4)*(1-lock);
        ctx.beginPath();
        for(var j=0;j<=320;j++){
          var pt=rotate(lemniscate(j/320,twin*Math.PI),angle),scale=unit*2.5;
          var x=cx+pt[0]*scale,y=cy+pt[1]*scale;
          if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
        ctx.strokeStyle=rgba(ink(0.2+twin*0.45),(1-reveal)*0.72*p.line);
        ctx.lineWidth=1.4;ctx.stroke();
      }
    }

    for(var e=Math.round(p.echoes)-1;e>=0;e--){
      var er=rotation-e*0.012*(1+biz*2),ea=e===0?0.66*p.line:0.075*p.glow/Math.max(1,e);
      /* Ring 0 = one circle. Ring 1 adds six (Seed of Life). Ring 2 adds
         twelve more: the canonical 19-circle Flower of Life. Centre distance
         equals circle radius, so every new centre lies on its neighbours. */
      for(var i=0;i<CELLS.length;i++){
        var cell=CELLS[i],birth=ease((reveal-(i/CELLS.length)*0.52)/0.48);if(birth<=0)continue;
        var x=(cell.q+cell.r*0.5)*p.spread,y=cell.r*Math.sqrt(3)*0.5*p.spread;
        var pos=rotate([x*returnScale,y*returnScale],er),radius=unit*mix(0.15,1,birth)*returnScale;
        ctx.strokeStyle=rgba(ink(i/CELLS.length+e*0.025),ea*birth*returnAlpha);
        ctx.lineWidth=(1.0+biz*0.75)*(e===0?1:0.7);
        ctx.beginPath();ctx.arc(cx+pos[0]*unit,cy+pos[1]*unit,radius,0,TAU);ctx.stroke();
      }
    }
    var pulse=Math.pow(Math.max(0,Math.sin(this.life*(1.1+biz))),8);
    ctx.fillStyle=rgba(ink(0.82),0.48+pulse*0.42);ctx.shadowColor=rgba(ink(0.82),1);ctx.shadowBlur=15+pulse*26;
    ctx.beginPath();ctx.arc(cx,cy,2.5+pulse*5+biz*2,0,TAU);ctx.fill();ctx.restore();
  };
  if(root.SCENES&&root.SCENES.register)root.SCENES.register(
    "flower-of-life","Flower of Life",function(canvas){return new FlowerDirector(canvas);},{duration:40,show:true}
  );
})(typeof window!=="undefined"?window:globalThis);
