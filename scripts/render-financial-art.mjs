// Pre-renders independent, transparent PNG financial research illustrations.
// Used as ordinary <img> assets over real photographs; no chart is drawn by the browser.
// Schematic market structures only — not live prices, executions, or returns.
import fs from 'node:fs';
import path from 'node:path';
import {deflateSync} from 'node:zlib';

const W=1760,H=870;
const GOLD=[234,190,122],ICE=[126,200,226],WHITE=[225,239,246];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function chunk(name,data){
 const size=Buffer.alloc(4);size.writeUInt32BE(data.length);
 const type=Buffer.from(name,'ascii');
 let crc=0xffffffff;
 for(const b of Buffer.concat([type,data]))crc=crcTable[(crc^b)&255]^(crc>>>8);
 const tail=Buffer.alloc(4);tail.writeUInt32BE((crc^0xffffffff)>>>0);
 return Buffer.concat([size,type,data,tail]);
}
function render(theme){
 const rgba=new Uint8ClampedArray(W*H*4);
 function pixel(x,y,color,a){
  x=Math.round(x);y=Math.round(y);
  if(x<0||y<0||x>=W||y>=H||a<=0)return;
  const i=(y*W+x)*4, old=rgba[i+3]/255,s=clamp(a,0,255)/255,alpha=s+old*(1-s);
  if(alpha<.001)return;
  for(let c=0;c<3;c++)rgba[i+c]=(color[c]*s+rgba[i+c]*old*(1-s))/alpha;
  rgba[i+3]=Math.round(alpha*255);
 }
 function spot(cx,cy,r,color,opacity){
  const loX=Math.floor(cx-r),hiX=Math.ceil(cx+r);
  const loY=Math.floor(cy-r),hiY=Math.ceil(cy+r);
  for(let y=loY;y<=hiY;y++)for(let x=loX;x<=hiX;x++){
   const d=Math.hypot(x-cx,y-cy);if(d>r)returnPixel();
   function returnPixel(){} // intentionally no-op; prevent costly painting outside the radius
   if(d<=r)pixel(x,y,color,opacity*clamp(r-d,0,1));
  }
 }
 function strokeSegment(x1,y1,x2,y2,thickness,color,opacity){
  const steps=Math.ceil(Math.hypot(x2-x1,y2-y1)*1.16);
  for(let i=0;i<=steps;i++){const t=i/steps;spot(x1+(x2-x1)*t,y1+(y2-y1)*t,thickness/2,color,opacity)}
 }
 function stroke(points,thickness,color,opacity,glow=true){
  if(glow)for(let i=1;i<points.length;i++)strokeSegment(...points[i-1],...points[i],thickness+6,color,opacity*.035);
  for(let i=1;i<points.length;i++)strokeSegment(...points[i-1],...points[i],thickness,color,opacity);
 }
 function fillRect(x1,y1,x2,y2,color,opacity){
  x1=Math.round(x1);y1=Math.round(y1);x2=Math.round(x2);y2=Math.round(y2);
  for(let y=y1;y<y2;y++)for(let x=x1;x<x2;x++)pixel(x,y,color,opacity);
 }
 const offset=theme==='risk'?72:theme==='research'?24:0;
 const start=theme==='risk'?815:725,end=1720;
 // Visible but subdued quantitative reference lines. Entire LEFT half is transparent.
 for(let x=start;x<end;x+=100){
  for(let y=185;y<740;y+=11)fillRect(x,y,x+1,y+3,ICE,11);
 }
 for(let y=275;y<705;y+=92)
  for(let x=start;x<end;x+=14)fillRect(x,y,x+3,y+1,WHITE,12);
 // A coherent sample series, carefully smooth and non-live.
 const curve=[];
 for(let x=start;x<=end;x+=6){
  const t=(x-start)/(end-start);
  const rise=theme==='risk'?-6*t:theme==='research'?55*t:143*t;
  const y=600-rise+45*Math.sin(7.1*t+.7)+21*Math.sin(17.2*t+1.3)+offset;
  curve.push([x,y]);
 }
 // Candlesticks remain readable behind headings without being a pasted dashboard.
 const candleCol=theme==='risk'?ICE:GOLD;
 for(let x=start+25;x<end-15;x+=27){
  const t=(x-start)/(end-start);
  const drift=theme==='risk'?35:theme==='research'?68:136;
  const c=609-drift*t+44*Math.sin(7.1*t+.7)+18*Math.sin(17*t+1.3)+offset;
  const wobble=Math.sin(x*.091)*12+Math.cos(x*.041)*6;
  const open=c+wobble,close=c-wobble*.61;
  strokeSegment(x,c-27,x,c+27,1.3,WHITE,74);
  fillRect(x-3,Math.min(open,close),x+4,Math.max(open+2,close+2),candleCol,70);
 }
 stroke(curve,8,GOLD,20);
 stroke(curve,2.05,theme==='risk'?ICE:GOLD,theme==='risk'?112:134);
 const offsetCurve=curve.map(([x,y],i)=>[x,y+83+22*Math.cos(i*.028)]);
 stroke(offsetCurve,1.35,ICE,57,false);
 for(const i of [Math.floor(curve.length*.22),Math.floor(curve.length*.57),Math.floor(curve.length*.86)]){
  const [x,y]=curve[i];
  spot(x,y,13,GOLD,11);spot(x,y,5,WHITE,150);spot(x,y,2,GOLD,218);
  for(let ly=y-65;ly<y-17;ly+=7)fillRect(x,ly,x+1,ly+3,WHITE,43);
 }
 // Banded relative-liquidity field below the market line.
 for(let x=start+14;x<end;x+=18){
  const t=(x-start)/(end-start),h=19+50*(.5+.5*Math.sin(t*17))*(.52+.48*Math.sin(t*27+2)**2);
  const y=759;
  fillRect(x,y-h,x+3,y,ICE,theme==='research'?32:19);
 }
 // PNG encode: alpha is retained; these pixels contain NO mountain photo.
 const stride=W*4;
 const scan=Buffer.alloc((stride+1)*H);
 for(let y=0;y<H;y++){const off=y*(stride+1);scan[off]=0;scan.set(rgba.subarray(y*stride,(y+1)*stride),off+1)}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=6;
 const out=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(scan,{level:9})),chunk('IEND',Buffer.alloc(0))]);
 const dest=path.join(process.cwd(),'assets',theme==='research'?'market-analysis.png':theme==='risk'?'risk-volatility.png':'market-trends.png');
 fs.writeFileSync(dest,out);
 console.log('Generated transparent PNG',path.basename(dest),out.length,'bytes');
}
for(const kind of ['market','research','risk'])render(kind);
