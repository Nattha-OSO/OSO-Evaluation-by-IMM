/* ============================================================
   summary-report.js — เมนู "สรุปผลประเมิน" แยกตามแบบประเมิน
     • sum_onsite : สรุปผลประเมินเจ้าหน้าที่ Onsite Support (ตาราง evaluations)
     • sum_apps   : สรุปผลความพึงพอใจระบบ APPS / Service Desk (ตาราง apps_surveys)
   แต่ละเมนูมีหน้าสรุป (กราฟสมัยใหม่) + ปุ่มออกรายงานสรุป DOCX ที่ฝังกราฟชุดเดียวกัน
   ใช้ globals จาก app.js: $, esc, data, view, toast, user, can, logAction, refresh,
   criteria, scoreBand, rankPeople, summarizePerson, summarizeOverall, uniqueSort, stat,
   THAI_MONTHS, LOADING, dRun, dCellPar, JSZip  และ window.appsSummaryApi จาก apps-survey.js
   ไม่แก้ตรรกะเดิม — ครอบ render() แบบเดียวกับ apps-survey.js (ต้องโหลดไฟล์นี้หลัง apps-survey.js)
   ============================================================ */
(function(){
'use strict';

const NAVY = '#0b2f6b';
const FONT = 'Tahoma, "Noto Sans Thai", sans-serif';
const BAND5 = [
  {label:'ดีเยี่ยม',     color:'#2563eb'},
  {label:'ดี',          color:'#22c55e'},
  {label:'พอใช้',       color:'#f59e0b'},
  {label:'ต้องปรับปรุง', color:'#f97316'},
  {label:'ไม่ผ่าน',      color:'#ef4444'}
];
const MON_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
let BG = null;   // พื้นหลังกราฟ: null = โปร่งใส (หน้าจอ) · '#ffffff' ตอนสร้างรูปลง DOCX
const state = {onsite:'all', apps:'all'};   // ช่วงข้อมูลที่เลือกของแต่ละเมนู ('all' หรือ 'YYYY-MM')

/* ---------- เครื่องมือเวลา / ช่วงข้อมูล ---------- */
function ymOf(v){ const d=new Date(v); return isNaN(d)?'':d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function monthLabel(ym){ const a=String(ym).split('-').map(Number); return THAI_MONTHS[a[1]-1]+' '+(a[0]+543); }
function monthShort(ym){ const a=String(ym).split('-').map(Number); return MON_SHORT[a[1]-1]+' '+String((a[0]+543)%100).padStart(2,'0'); }
function inPeriod(rows,getDate,period){ return (!period||period==='all')?rows.slice():rows.filter(r=>ymOf(getDate(r))===period); }
function monthsOf(rows,getDate){ const s={}; rows.forEach(r=>{const k=ymOf(getDate(r)); if(k)s[k]=1;}); return Object.keys(s).sort().reverse(); }
function periodLabel(p){ return p==='all'?'ข้อมูลทั้งหมด':monthLabel(p); }
const f2 = x => (Number(x)||0).toFixed(2);
const f1 = x => (Number(x)||0).toFixed(1);

/* ============================================================
   กราฟ (canvas) — ความละเอียด 2x, มุมโค้ง, สีไล่ระดับ  ใช้ทั้งบนหน้าจอและฝังใน DOCX
   ============================================================ */
function mk(w,h){
  const sc=2, c=document.createElement('canvas'); c.width=w*sc; c.height=h*sc; c._w=w; c._h=h;
  const g=c.getContext('2d'); g.scale(sc,sc); if(BG){ g.fillStyle=BG; g.fillRect(0,0,w,h); }
  return {c,g,w,h};
}
function rr(g,x,y,w,h,r){ r=Math.max(0,Math.min(r,w/2,h/2)); g.beginPath(); g.moveTo(x+r,y); g.lineTo(x+w-r,y); g.arcTo(x+w,y,x+w,y+r,r); g.lineTo(x+w,y+h-r); g.arcTo(x+w,y+h,x+w-r,y+h,r); g.lineTo(x+r,y+h); g.arcTo(x,y+h,x,y+h-r,r); g.lineTo(x,y+r); g.arcTo(x,y,x+r,y,r); g.closePath(); }
function lighten(hex,t){ t=t==null?.45:t; const n=parseInt(hex.slice(1),16), r=n>>16&255, gg=n>>8&255, b=n&255; const m=v=>Math.round(v+(255-v)*t); return 'rgb('+m(r)+','+m(gg)+','+m(b)+')'; }
function fitText(g,text,maxW){ text=String(text==null?'':text); if(g.measureText(text).width<=maxW) return text; while(text.length>1&&g.measureText(text+'…').width>maxW) text=text.slice(0,-1); return text+'…'; }
// ตัดบรรทัดไทย: มีช่องว่างตัดตามคำ ไม่มีตัดตามอักขระ · จำกัดจำนวนบรรทัด
function wrapTH(g,text,maxW,maxLines){
  text=String(text==null?'':text).trim();
  // แตกคำที่ยาวเกินความกว้างเป็นอักขระ (ภาษาไทยไม่มีช่องว่างคั่นคำ) เพื่อไม่ให้ล้นไปทับแท่งกราฟ
  const toks=[]; text.split(/\s+/).forEach(w=>{ if(g.measureText(w).width<=maxW) toks.push(w); else { let cur=''; for(const ch of w){ if(cur&&g.measureText(cur+ch).width>maxW){ toks.push(cur); cur=ch; } else cur+=ch; } if(cur) toks.push(cur); } });
  const lines=[]; let cur='';
  toks.forEach(t=>{ const cand=cur?cur+' '+t:t; if(g.measureText(cand).width<=maxW||!cur) cur=cand; else { lines.push(cur); cur=t; } });
  if(cur) lines.push(cur);
  if(lines.length>maxLines){ const keep=lines.slice(0,maxLines-1); keep.push(fitText(g,lines.slice(maxLines-1).join(' '),maxW)); return keep; }
  return lines.map(l=>fitText(g,l,maxW));
}
function chartTitle(g,t,x,y){ if(!t) return; g.font='bold 14px '+FONT; g.fillStyle=NAVY; g.textAlign='left'; g.textBaseline='alphabetic'; g.fillText(t,x,y); }

// มาตรวัดครึ่งวงกลม: pct 0-100
function chGauge(pct,o){
  const w=260,h=220,{c,g}=mk(w,h); pct=Math.max(0,Math.min(100,Number(pct)||0));
  chartTitle(g,o.title,14,24);
  const cx=w/2, cy=156, R=92;
  g.lineWidth=24; g.lineCap='round';
  g.beginPath(); g.arc(cx,cy,R,Math.PI,2*Math.PI); g.strokeStyle='#e8eefb'; g.stroke();
  if(pct>0){
    const gr=g.createLinearGradient(cx-R,0,cx+R,0); gr.addColorStop(0,lighten(o.color,.5)); gr.addColorStop(1,o.color);
    g.beginPath(); g.arc(cx,cy,R,Math.PI,Math.PI+Math.PI*pct/100); g.strokeStyle=gr; g.stroke();
  }
  g.textAlign='center'; g.textBaseline='alphabetic';
  g.font='bold 30px '+FONT; g.fillStyle=NAVY; g.fillText(o.main,cx,cy-8);
  g.font='bold 13px '+FONT; g.fillStyle='#475569'; g.fillText(o.sub||'',cx,cy+16);
  g.font='11px '+FONT; g.fillStyle='#64748b'; g.textAlign='center'; g.fillText('0',cx-R,cy+28); g.fillText(o.maxTxt||'100',cx+R,cy+28);
  return c;
}
// โดนัท + คำอธิบายสี  items:[{label,value,color}]
function chDonut(items,o){
  const w=380,h=220,{c,g}=mk(w,h); chartTitle(g,o.title,14,24);
  const cx=100, cy=128, R=78, r=50, total=items.reduce((a,x)=>a+x.value,0);
  if(!total){
    g.lineWidth=R-r; g.strokeStyle='#e8eefb'; g.beginPath(); g.arc(cx,cy,(R+r)/2,0,2*Math.PI); g.stroke();
    g.fillStyle='#94a3b8'; g.font='12px '+FONT; g.textAlign='center'; g.fillText('ไม่มีข้อมูล',cx,cy+4);
  } else {
    let a0=-Math.PI/2; const gap=items.filter(x=>x.value>0).length>1?0.03:0;
    items.forEach(it=>{ if(!it.value) return; const a1=a0+2*Math.PI*it.value/total;
      g.beginPath(); g.arc(cx,cy,(R+r)/2,a0+gap,a1-gap); g.lineWidth=R-r; g.lineCap='butt'; g.strokeStyle=it.color; g.stroke(); a0=a1; });
    g.textAlign='center'; g.fillStyle=NAVY; g.font='bold 26px '+FONT; g.fillText(String(o.center!=null?o.center:total),cx,cy+4);
    g.fillStyle='#475569'; g.font='11px '+FONT; g.fillText(o.centerSub||'',cx,cy+22);
  }
  const pcs=pctSplit(items.map(x=>x.value));
  const lx=214, ly0=Math.max(52,128-items.length*12);
  items.forEach((it,i)=>{ const y=ly0+i*26; g.fillStyle=it.value?it.color:'#d5dbe8'; g.beginPath(); g.arc(lx,y,6,0,2*Math.PI); g.fill();
    g.textBaseline='middle'; g.textAlign='left'; g.font='12px '+FONT; g.fillStyle=it.value?'#334155':'#94a3b8'; g.fillText(fitText(g,it.label,100),lx+14,y);
    g.textAlign='right'; g.font='bold 12px '+FONT; g.fillStyle=it.value?NAVY:'#94a3b8'; g.fillText(it.value+(total?'  ('+pcs[i]+'%)':''),w-10,y); });
  return c;
}
// แท่งแนวนอนมุมโค้งไล่สี  items:[{label,value,color,text}]
function chHBars(items,o){
  o=o||{}; if(o.stack) return chHBarsStacked(items,o);
  const w=o.w||620, rowH=o.rowH||38, padT=o.title?36:10, h=padT+items.length*rowH+10, {c,g}=mk(w,h);
  chartTitle(g,o.title,14,24);
  const labW=o.labW||200, x0=14+labW, x1=w-14-62, bh=14, max=o.max||5;
  items.forEach((it,i)=>{ const cy=padT+i*rowH+rowH/2;
    g.textBaseline='middle'; g.textAlign='left'; g.font='12px '+FONT; g.fillStyle='#334155';
    const ln=wrapTH(g,it.label,labW-8,2); ln.forEach((t,li)=>g.fillText(t,14,cy+(li-(ln.length-1)/2)*14));
    rr(g,x0,cy-bh/2,x1-x0,bh,bh/2); g.fillStyle='#eaf0fb'; g.fill();
    const frac=Math.max(0,Math.min(1,(Number(it.value)||0)/max));
    if(frac>0){ const bw=Math.max(bh,(x1-x0)*frac), gr=g.createLinearGradient(x0,0,x0+bw,0); gr.addColorStop(0,lighten(it.color)); gr.addColorStop(1,it.color); rr(g,x0,cy-bh/2,bw,bh,bh/2); g.fillStyle=gr; g.fill(); }
    g.textAlign='right'; g.font='bold 13px '+FONT; g.fillStyle=NAVY; g.fillText(it.text!=null?it.text:String(it.value),w-14,cy); });
  return c;
}
// แท่งแนวนอนแบบ "ป้ายชื่อเต็มความกว้างอยู่เหนือแท่ง" — สำหรับหัวข้อยาว ไม่ตัดคำ ไม่ทับแท่ง
function chHBarsStacked(items,o){
  const w=o.w||620, padT=o.title?40:12, max=o.max||5, bh=14, x0=14, x1=w-14-62;
  const {c:probe,g:pg}=mk(w,10); pg.font='12px '+FONT;
  const lay=items.map(it=>wrapTH(pg,it.label,w-28,2));
  const h=padT+lay.reduce((a,l)=>a+l.length*15+bh+22,0)+6, {c,g}=mk(w,h);
  chartTitle(g,o.title,14,24);
  let y=padT;
  items.forEach((it,i)=>{
    g.textBaseline='alphabetic'; g.textAlign='left'; g.font='12px '+FONT; g.fillStyle='#334155';
    lay[i].forEach((ln,li)=>g.fillText(ln,x0,y+12+li*15));
    const by=y+lay[i].length*15+4;
    rr(g,x0,by,x1-x0,bh,bh/2); g.fillStyle='#eaf0fb'; g.fill();
    const frac=Math.max(0,Math.min(1,(Number(it.value)||0)/max));
    if(frac>0){ const bw=Math.max(bh,(x1-x0)*frac), gr=g.createLinearGradient(x0,0,x0+bw,0); gr.addColorStop(0,lighten(it.color)); gr.addColorStop(1,it.color); rr(g,x0,by,bw,bh,bh/2); g.fillStyle=gr; g.fill(); }
    g.textAlign='right'; g.textBaseline='middle'; g.font='bold 13px '+FONT; g.fillStyle=NAVY; g.fillText(it.text!=null?it.text:String(it.value),w-14,by+bh/2);
    y=by+bh+18; });
  return c;
}
// เส้นแนวโน้ม + พื้นที่ไล่สี  pts:[{label,value}]
function chTrend(pts,o){
  const w=620,h=250,{c,g}=mk(w,h); chartTitle(g,o.title,14,24);
  const padL=48,padR=28,padT=46,padB=44, pw=w-padL-padR, ph=h-padT-padB, yMin=o.yMin||0, yMax=o.yMax, col=o.color||'#2563eb';
  g.font='11px '+FONT; g.textBaseline='middle';
  const tk=o.ticks||4;
  for(let i=0;i<=tk;i++){ const y=padT+ph-ph*i/tk; g.strokeStyle='#e6ecf5'; g.lineWidth=1; g.beginPath(); g.moveTo(padL,y); g.lineTo(w-padR,y); g.stroke(); g.fillStyle='#94a3b8'; g.textAlign='right'; g.fillText((o.fmtY||String)(yMin+(yMax-yMin)*i/tk),padL-8,y); }
  const X=i=>padL+pw*(i+0.5)/pts.length, Y=v=>padT+ph-ph*Math.max(0,Math.min(1,(v-yMin)/(yMax-yMin)));
  if(pts.length>1){
    const ar=g.createLinearGradient(0,padT,0,padT+ph); ar.addColorStop(0,lighten(col,.55)); ar.addColorStop(1,'rgba(255,255,255,0)');
    g.beginPath(); g.moveTo(X(0),padT+ph); g.lineTo(X(0),Y(pts[0].value));
    for(let i=1;i<pts.length;i++){ const mx=(X(i-1)+X(i))/2; g.bezierCurveTo(mx,Y(pts[i-1].value),mx,Y(pts[i].value),X(i),Y(pts[i].value)); }
    g.lineTo(X(pts.length-1),padT+ph); g.closePath(); g.fillStyle=ar; g.globalAlpha=.55; g.fill(); g.globalAlpha=1;
    g.beginPath(); g.moveTo(X(0),Y(pts[0].value));
    for(let i=1;i<pts.length;i++){ const mx=(X(i-1)+X(i))/2; g.bezierCurveTo(mx,Y(pts[i-1].value),mx,Y(pts[i].value),X(i),Y(pts[i].value)); }
    g.lineWidth=3; g.lineJoin='round'; g.strokeStyle=col; g.stroke();
  }
  pts.forEach((p,i)=>{ const x=X(i), y=Y(p.value);
    g.beginPath(); g.arc(x,y,6,0,2*Math.PI); g.fillStyle='#fff'; g.fill(); g.lineWidth=3; g.strokeStyle=col; g.stroke();
    g.textAlign='center'; g.textBaseline='alphabetic'; g.font='bold 12px '+FONT; g.fillStyle=NAVY; g.fillText((o.fmtV||String)(p.value),x,y-12);
    g.font='11px '+FONT; g.fillStyle='#475569'; g.fillText(p.label,x,h-padB+22); });
  return c;
}
// แท่งซ้อน 100% ของ 4 ระดับความพึงพอใจ  items:[{label,counts:{4,3,2,1}}] · scale:[{label,value,color}]
function chStacked(items,scale,o){
  const w=620, padT=o.title?66:40, x0=14, x1=w-14, bh=18;
  const {g:pg}=mk(w,10); pg.font='12px '+FONT;
  const lay=items.map(it=>wrapTH(pg,it.label,w-28,2));
  const h=padT+lay.reduce((a,l)=>a+l.length*15+bh+16,0)+4, {c,g}=mk(w,h); chartTitle(g,o.title,14,24);
  let lx=14; g.font='11px '+FONT; g.textBaseline='middle';
  scale.forEach(s=>{ g.fillStyle=s.color; rr(g,lx,o.title?42:16,12,12,3); g.fill(); g.fillStyle='#475569'; g.textAlign='left'; g.fillText(s.label,lx+17,(o.title?42:16)+6); lx+=17+g.measureText(s.label).width+20; });
  let y=padT;
  items.forEach((it,i)=>{
    g.textBaseline='alphabetic'; g.textAlign='left'; g.font='12px '+FONT; g.fillStyle='#334155';
    lay[i].forEach((ln,li)=>g.fillText(ln,x0,y+12+li*15));
    const by=y+lay[i].length*15+4, tot=scale.reduce((a,s)=>a+(it.counts[s.value]||0),0);
    rr(g,x0,by,x1-x0,bh,9); g.fillStyle='#eaf0fb'; g.fill();
    if(tot){ g.save(); rr(g,x0,by,x1-x0,bh,9); g.clip(); let x=x0; const pc=pctSplit(scale.map(s=>it.counts[s.value]||0));
      scale.forEach((s,si)=>{ const n=it.counts[s.value]||0; if(!n) return; const sw=(x1-x0)*n/tot; g.fillStyle=s.color; g.fillRect(x,by,sw,bh);
        if(sw>30){ g.fillStyle=(s.color==='#f59e0b')?'#1f2937':'#fff'; g.font='bold 11px '+FONT; g.textAlign='center'; g.textBaseline='middle'; g.fillText(pc[si]+'%',x+sw/2,by+bh/2+.5); } x+=sw; });
      g.restore(); }
    y=by+bh+12; });
  return c;
}
// แบ่งร้อยละให้ผลรวมเท่ากับ 100 เสมอ (largest remainder)
function pctSplit(counts){ const t=counts.reduce((a,b)=>a+b,0); if(!t) return counts.map(()=>0); const raw=counts.map(n=>n/t*100), fl=raw.map(Math.floor); let left=100-fl.reduce((a,b)=>a+b,0);
  raw.map((v,i)=>[v-fl[i],i]).sort((a,b)=>b[0]-a[0]).forEach(([_,i])=>{ if(left>0){ fl[i]++; left--; } }); return fl; }
// วางกราฟสองใบเคียงกัน (ฝังใน DOCX เป็นรูปเดียว)
function sideBySide(a,b,gap){
  const w=a._w+gap+b._w, h=Math.max(a._h,b._h), {c,g}=mk(w,h);
  g.drawImage(a,0,0,a._w,a._h); g.drawImage(b,a._w+gap,0,b._w,b._h); return c;
}
function canvasBytes(cv){ const b64=cv.toDataURL('image/png').split(',')[1], bin=atob(b64), arr=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i); return arr; }
function mount(id,cv){ const host=$(id); if(!host) return; cv.style.width='100%'; cv.style.maxWidth=cv._w+'px'; cv.style.height='auto'; cv.style.display='block'; cv.style.margin='0 auto'; host.innerHTML=''; host.appendChild(cv); }

/* ============================================================
   คำนวณข้อมูลสรุป
   ============================================================ */
function toneColorAvg(v){ return v>=4.6?'#2563eb':v>=3.8?'#22c55e':v>=3?'#f59e0b':v>=2?'#f97316':'#ef4444'; }
function onsiteCompute(period){
  const all=(data&&data.records)||[];
  const recs=inPeriod(all,r=>r.timestampRaw,period);
  const people=rankPeople(uniqueSort(recs.map(r=>r.staff)).map(n=>summarizePerson(n,recs)),recs);
  const s=summarizeOverall(recs,people);
  const bandCounts=BAND5.map(b=>({label:b.label,color:b.color,value:recs.filter(r=>scoreBand(r.avg)===b.label).length}));
  const byM={}; all.forEach(r=>{const k=ymOf(r.timestampRaw); if(!k)return; (byM[k]=byM[k]||[]).push(r.avg);});
  const monthly=Object.keys(byM).sort().slice(-12).map(k=>({key:k,label:monthShort(k),value:byM[k].reduce((a,b)=>a+b,0)/byM[k].length,n:byM[k].length}));
  return {recs,people,s,bandCounts,monthly,months:monthsOf(all,r=>r.timestampRaw)};
}
function appsCompute(period){
  const api=window.appsSummaryApi, rows=api.rows();
  const rs=inPeriod(rows,r=>r.created_at,period), s=api.summarize(rs);
  const byM={}; rows.forEach(r=>{const k=ymOf(r.created_at); if(!k)return; (byM[k]=byM[k]||[]).push(r);});
  const monthly=Object.keys(byM).sort().slice(-12).map(k=>({key:k,label:monthShort(k),value:api.summarize(byM[k]).overallPct,n:byM[k].length}));
  const agencies=Object.keys(s.agencyCounts).map(k=>({label:k,value:s.agencyCounts[k]})).sort((a,b)=>b.value-a.value);
  return {rs,s,monthly,agencies,months:monthsOf(rows,r=>r.created_at)};
}

/* ---------- กราฟชุดของแต่ละแบบประเมิน (ใช้ร่วมกันระหว่างหน้าจอและ DOCX) ---------- */
function onsiteCharts(m){
  const s=m.s, avgBand=scoreBand(s.avgScore);
  const gauge=chGauge(s.avgScore/5*100,{title:'คะแนนเฉลี่ยรวม',main:f2(s.avgScore)+' / 5',sub:avgBand,color:toneColorAvg(s.avgScore),maxTxt:'5'});
  const donut=chDonut(m.bandCounts,{title:'สัดส่วนผลประเมินตามระดับ',center:s.total,centerSub:'รายการ'});
  const crit=chHBars(criteria.map(cr=>{const v=s.criteriaAvg[cr.key]||0; return {label:cr.no+'. '+cr.shortTitle,value:v,color:toneColorAvg(v),text:f2(v)};}),{title:'คะแนนเฉลี่ยรายหัวข้อ (เต็ม 5)',max:5,labW:170});
  const top=m.people.filter(p=>p.count).slice(0,5);
  const topBars=top.length?chHBars(top.map(p=>({label:p.name,value:p.avg,color:toneColorAvg(p.avg),text:f2(p.avg)+'  ('+p.count+')'})),{title:'เจ้าหน้าที่คะแนนสูงสุด 5 อันดับ (จำนวนครั้ง)',max:5,labW:170,rowH:34}):null;
  const shifts=Object.keys(s.evaluators||{}).map(k=>({label:k||'-',value:s.evaluators[k]})).sort((a,b)=>b.value-a.value).slice(0,8);
  const shiftBars=shifts.length?chHBars(shifts.map((x,i)=>({label:x.label,value:x.value,color:['#2563eb','#06b6d4','#14b8a6','#8b5cf6','#f59e0b','#ef4444','#64748b','#0ea5e9'][i%8],text:String(x.value)})),{title:'จำนวนรายการประเมินตามผลัด',max:Math.max(1,shifts[0].value),labW:170,rowH:34}):null;
  const trend=m.monthly.length>=2?chTrend(m.monthly.map(p=>({label:p.label,value:p.value})),{title:'แนวโน้มคะแนนเฉลี่ยรายเดือน (เต็ม 5)',yMin:1,yMax:5,ticks:4,fmtY:v=>f1(v),fmtV:v=>f2(v),color:'#2563eb'}):null;
  return {gauge,donut,crit,topBars,shiftBars,trend};
}
function appsCharts(m){
  const api=window.appsSummaryApi, s=m.s;
  const gauge=chGauge(s.overallPct,{title:'ความพึงพอใจภาพรวม',main:f1(s.overallPct)+'%',sub:api.band(s.overallPct),color:api.bandColor(s.overallPct)});
  const durColors=['#06b6d4','#2563eb','#8b5cf6','#14b8a6'];
  const dur=chDonut(api.DURATIONS.map((d,i)=>({label:d,value:s.durCounts[d]||0,color:durColors[i%4]})),{title:'ระยะเวลาการใช้งานระบบ APPS',center:s.n,centerSub:'ราย'});
  const mkPct=arr=>arr.map(x=>({label:x.crit.no+'. '+x.crit.title,value:x.pct,color:api.bandColor(x.pct),text:f1(x.pct)+'%'}));
  const s1p=chHBars(mkPct(s.sec1),{title:'ร้อยละความพึงพอใจ — ส่วนที่ 1 เจ้าหน้าที่ที่ให้การสนับสนุน',max:100,stack:true});
  const s2p=chHBars(mkPct(s.sec2),{title:'ร้อยละความพึงพอใจ — ส่วนที่ 2 ระบบ APPS และ Service Desk',max:100,stack:true});
  const mkSt=arr=>arr.map(x=>({label:x.crit.no+'. '+x.crit.title,counts:x.counts}));
  const s1d=chStacked(mkSt(s.sec1),api.SCALE,{title:'สัดส่วนระดับความพึงพอใจ — ส่วนที่ 1'});
  const s2d=chStacked(mkSt(s.sec2),api.SCALE,{title:'สัดส่วนระดับความพึงพอใจ — ส่วนที่ 2'});
  const ag=m.agencies.slice(0,8);
  const agBars=ag.length?chHBars(ag.map((x,i)=>({label:x.label,value:x.value,color:['#2563eb','#06b6d4','#14b8a6','#8b5cf6','#f59e0b','#ef4444','#64748b','#0ea5e9'][i%8],text:String(x.value)})),{title:'จำนวนผู้ประเมินตามหน่วยงาน',max:Math.max(1,ag[0].value),stack:true}):null;
  const trend=m.monthly.length>=2?chTrend(m.monthly.map(p=>({label:p.label,value:p.value})),{title:'แนวโน้มความพึงพอใจภาพรวมรายเดือน (%)',yMin:0,yMax:100,fmtY:v=>String(Math.round(v)),fmtV:v=>f1(v)+'%',color:'#14b8a6'}):null;
  return {gauge,dur,s1p,s2p,s1d,s2d,agBars,trend};
}

/* ---------- ข้อสังเกตอัตโนมัติ (ใช้ทั้งหน้าจอและ DOCX) ---------- */
function onsiteInsights(m){
  const s=m.s, out=[]; if(!s.total) return ['ยังไม่มีผลประเมินในช่วงที่เลือก'];
  out.push('ภาพรวมคะแนนเฉลี่ย '+f2(s.avgScore)+' จาก 5 ('+f1(s.avgScore/5*100)+'%) อยู่ในระดับ "'+scoreBand(s.avgScore)+'" จากผลประเมิน '+s.total+' รายการ ครอบคลุมเจ้าหน้าที่ '+s.evaluated+' คน');
  const cs=criteria.slice().sort((a,b)=>(s.criteriaAvg[b.key]||0)-(s.criteriaAvg[a.key]||0)), hi=cs[0], lo=cs[cs.length-1];
  out.push('หัวข้อคะแนนสูงสุดคือ "'+hi.shortTitle+'" ('+f2(s.criteriaAvg[hi.key])+') และต่ำสุดคือ "'+lo.shortTitle+'" ('+f2(s.criteriaAvg[lo.key])+')');
  const top=m.people.find(p=>p.count);
  if(top) out.push('เจ้าหน้าที่ที่ได้คะแนนเฉลี่ยสูงสุดคือ '+top.name+' ('+f2(top.avg)+' จาก '+top.count+' ครั้ง)');
  out.push((s.risks&&s.risks.length)?'มีเจ้าหน้าที่ '+s.risks.length+' คนที่คะแนนเฉลี่ยต่ำกว่า 3.50 ควรติดตามเป็นรายบุคคล ('+s.risks.map(p=>p.name).join(', ')+')':'ไม่พบเจ้าหน้าที่ที่คะแนนเฉลี่ยต่ำกว่าเกณฑ์ติดตาม (3.50)');
  if(m.monthly.length>=2){ const a=m.monthly[m.monthly.length-2], b=m.monthly[m.monthly.length-1], d=Math.round(b.value*100)/100-Math.round(a.value*100)/100; out.push('เทียบเดือนล่าสุด ('+b.label+') กับเดือนก่อนหน้า ('+a.label+') คะแนนเฉลี่ย'+(Math.abs(d)<0.005?'ใกล้เคียงเดิม':(d>0?'เพิ่มขึ้น ':'ลดลง ')+f2(Math.abs(d))+' คะแนน')); }
  return out;
}
function appsInsights(m){
  const api=window.appsSummaryApi, s=m.s, out=[]; if(!s.n) return ['ยังไม่มีผลประเมินในช่วงที่เลือก'];
  out.push('ความพึงพอใจภาพรวม '+f1(s.overallPct)+'% อยู่ในระดับ "'+api.band(s.overallPct)+'" จากผู้ประเมิน '+s.n+' ราย');
  out.push('ส่วนที่ 1 เจ้าหน้าที่ที่ให้การสนับสนุน '+f1(s.sec1Pct)+'% ('+api.band(s.sec1Pct)+') · ส่วนที่ 2 ระบบ APPS และ Service Desk '+f1(s.sec2Pct)+'% ('+api.band(s.sec2Pct)+')');
  const all=s.sec1.concat(s.sec2).filter(x=>x.n).sort((a,b)=>b.pct-a.pct);
  if(all.length){ const hi=all[0], lo=all[all.length-1]; out.push('หัวข้อที่พึงพอใจสูงสุด: "'+hi.crit.title+'" ('+f1(hi.pct)+'%) · ต่ำสุด: "'+lo.crit.title+'" ('+f1(lo.pct)+'%)'); }
  const low=all.filter(x=>x.pct<60).length; out.push(low?'มี '+low+' หัวข้อที่ต่ำกว่า 60% (ระดับ "ปานกลาง" หรือต่ำกว่า) ควรพิจารณาปรับปรุง':'ทุกหัวข้ออยู่ในระดับ "ดี" ขึ้นไป (60% ขึ้นไป)');
  out.push('มีข้อเสนอแนะเพิ่มเติม '+s.sug.length+' รายการ');
  if(m.monthly.length>=2){ const a=m.monthly[m.monthly.length-2], b=m.monthly[m.monthly.length-1], d=Math.round(b.value*10)/10-Math.round(a.value*10)/10; out.push('เทียบเดือนล่าสุด ('+b.label+') กับเดือนก่อนหน้า ('+a.label+') ความพึงพอใจ'+(Math.abs(d)<0.05?'ใกล้เคียงเดิม':(d>0?'เพิ่มขึ้น ':'ลดลง ')+f1(Math.abs(d))+' จุดร้อยละ')); }
  return out;
}

/* ============================================================
   หน้าจอสรุป
   ============================================================ */
function toolbarHtml(kind,months,count){
  return '<div class="toolbar"><label class="mini" style="font-weight:700;color:var(--navy)">ช่วงข้อมูล</label>'+
    '<select class="input" style="width:auto;min-width:180px" onchange="sumPeriodChange(\''+kind+'\',this.value)">'+
    '<option value="all"'+(state[kind]==='all'?' selected':'')+'>ทั้งหมด</option>'+
    months.map(k=>'<option value="'+k+'"'+(state[kind]===k?' selected':'')+'>'+monthLabel(k)+'</option>').join('')+'</select>'+
    '<span class="mini">'+count+' รายการ</span>'+
    '<button class="btn" style="margin-left:auto" onclick="sumRefresh(\''+kind+'\')">รีเฟรช</button>'+
    '<button class="btn primary" id="sumExportBtn_'+kind+'" onclick="sumExport(\''+kind+'\')">ออกรายงานสรุป DOCX</button></div>';
}
function insightPanel(items){
  return '<div class="panel" style="margin-bottom:16px"><div class="panel-title" style="margin-bottom:10px">สรุปประเด็นสำคัญ</div><ul style="margin:0;padding-left:20px;line-height:1.9">'+items.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></div>';
}
function chartPanel(id,span){ return '<div class="panel"'+(span?' style="grid-column:1/-1"':'')+'><div id="'+id+'"></div></div>'; }
const GRID='display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-bottom:16px';

function renderOnsite(){
  const c=$('content'), m=onsiteCompute(state.onsite), s=m.s;
  let h=toolbarHtml('onsite',m.months,s.total);
  h+='<div class="grid stats">'+
    stat('จำนวนประเมิน',String(s.total),'รายการ · '+periodLabel(state.onsite),'var(--navy)')+
    stat('เจ้าหน้าที่ที่ถูกประเมิน',String(s.evaluated),'คน','#0ea5e9')+
    stat('คะแนนเฉลี่ย',f2(s.avgScore),pctTxt(s.avgScore)+' · '+s.band,toneColorAvg(s.avgScore))+
    stat('ต้องติดตาม',String((s.risks||[]).length),'คนที่ต่ำกว่า 3.50',(s.risks||[]).length?'#ef4444':'#22c55e')+'</div>';
  if(!s.total){ c.innerHTML=h+'<div class="panel"><div class="empty">ยังไม่มีข้อมูลการประเมินในช่วงนี้</div></div>'; return; }
  h+=insightPanel(onsiteInsights(m));
  h+='<div style="'+GRID+'">'+chartPanel('sumOn_g')+chartPanel('sumOn_d')+'</div>';
  h+=chartPanel('sumOn_c')+'<div style="height:16px"></div>';
  h+=chartPanel('sumOn_t')+'<div style="height:16px"></div>'+chartPanel('sumOn_s')+'<div style="height:16px"></div>'+chartPanel('sumOn_tr');
  h+='<div style="height:16px"></div>'+sectionsHtml(onsiteSections(m));
  c.innerHTML=h;
  BG=null; const ch=onsiteCharts(m);
  mount('sumOn_g',ch.gauge); mount('sumOn_d',ch.donut); mount('sumOn_c',ch.crit);
  if(ch.topBars) mount('sumOn_t',ch.topBars); else $('sumOn_t').parentNode.remove();
  if(ch.shiftBars) mount('sumOn_s',ch.shiftBars); else $('sumOn_s').parentNode.remove();
  if(ch.trend) mount('sumOn_tr',ch.trend); else $('sumOn_tr').parentNode.remove();
}
async function renderApps(){
  const c=$('content'); c.innerHTML=LOADING;
  const api=window.appsSummaryApi; if(!api){ c.innerHTML='<div class="empty">โมดูล APPS ยังไม่พร้อมใช้งาน</div>'; return; }
  await api.ensure();
  if(view!=='sum_apps') return;   // ผู้ใช้สลับเมนูระหว่างรอโหลด
  const m=appsCompute(state.apps), s=m.s;
  let h=toolbarHtml('apps',m.months,s.n);
  h+='<div class="grid stats">'+
    stat('ผู้ประเมิน',String(s.n),'ราย · '+periodLabel(state.apps),'var(--navy)')+
    stat('ส่วนที่ 1 (เจ้าหน้าที่)',f1(s.sec1Pct)+'%',api.band(s.sec1Pct),api.bandColor(s.sec1Pct))+
    stat('ส่วนที่ 2 (ระบบ/Service Desk)',f1(s.sec2Pct)+'%',api.band(s.sec2Pct),api.bandColor(s.sec2Pct))+
    stat('ภาพรวมทั้งหมด',f1(s.overallPct)+'%',api.band(s.overallPct),api.bandColor(s.overallPct))+'</div>';
  if(!s.n){ c.innerHTML=h+'<div class="panel"><div class="empty">ยังไม่มีข้อมูลการประเมินในช่วงนี้</div></div>'; return; }
  h+=insightPanel(appsInsights(m));
  h+='<div style="'+GRID+'">'+chartPanel('sumAp_g')+chartPanel('sumAp_d')+'</div>';
  h+=chartPanel('sumAp_1p')+'<div style="height:16px"></div>'+chartPanel('sumAp_1d')+'<div style="height:16px"></div>';
  h+=chartPanel('sumAp_2p')+'<div style="height:16px"></div>'+chartPanel('sumAp_2d')+'<div style="height:16px"></div>';
  h+=chartPanel('sumAp_ag')+'<div style="height:16px"></div>'+chartPanel('sumAp_tr');
  h+='<div style="height:16px"></div>'+sectionsHtml(appsSections(m));
  c.innerHTML=h;
  BG=null; const ch=appsCharts(m);
  mount('sumAp_g',ch.gauge); mount('sumAp_d',ch.dur); mount('sumAp_1p',ch.s1p); mount('sumAp_1d',ch.s1d); mount('sumAp_2p',ch.s2p); mount('sumAp_2d',ch.s2d);
  if(ch.agBars) mount('sumAp_ag',ch.agBars); else $('sumAp_ag').parentNode.remove();
  if(ch.trend) mount('sumAp_tr',ch.trend); else $('sumAp_tr').parentNode.remove();
}

/* ============================================================
   DOCX
   ============================================================ */
const DW = 10106;                       // ความกว้างเนื้อหา (twips) = A4 11906 − ขอบซ้าย/ขวา 900+900 → ตารางทุกตารางกว้างเท่านี้พอดีขอบ
// ปรับความกว้างคอลัมน์ให้ผลรวม = total เป๊ะ (สัดส่วนเดิม) — กันตารางล้น/สั้นกว่าขอบกระดาษ
function fitW(widths,total){ total=total||DW; const sum=widths.reduce((a,b)=>a+b,0), out=widths.map(w=>Math.floor(w*total/sum)); out[out.length-1]+=total-out.reduce((a,b)=>a+b,0); return out; }
const TBL_JC='<w:jc w:val="center"/>';
const IMG_MAX = 673;                    // px = ความกว้างเนื้อหา 10106 twips (96 dpi) → รูปกว้างเท่าตาราง
function xr(text,o){ return dRun(text,o); }
function cellP(text,o){
  o=o||{};
  return '<w:p><w:pPr>'+(o.keep?'<w:keepNext/>':'')+'<w:spacing w:before="'+(o.before==null?30:o.before)+'" w:after="'+(o.after==null?30:o.after)+'"/>'+(o.align?'<w:jc w:val="'+o.align+'"/>':'')+'</w:pPr>'+xr(text,o)+'</w:p>';
}
function para(text,o){
  o=o||{};
  return '<w:p><w:pPr>'+(o.keep?'<w:keepNext/>':'')+(o.border?'<w:pBdr><w:left w:val="single" w:sz="'+(o.border.sz||36)+'" w:space="6" w:color="'+o.border.color+'"/></w:pBdr>':'')+(o.fill?'<w:shd w:val="clear" w:color="auto" w:fill="'+o.fill+'"/>':'')+'<w:spacing w:before="'+(o.before||0)+'" w:after="'+(o.after==null?60:o.after)+'" w:line="276" w:lineRule="auto"/>'+(o.indent?'<w:ind w:left="'+o.indent+'"/>':'')+(o.align?'<w:jc w:val="'+o.align+'"/>':'')+'</w:pPr>'+xr(text,o)+'</w:p>';
}
function heading(text,color){ return para(text,{sz:26,bold:true,color:'0b2f6b',keep:true,before:260,after:100,border:{color:color||'2563EB'}}); }
function subHeading(text){ return para(text,{sz:22,bold:true,color:'16438f',keep:true,before:120,after:50}); }
function spacer(){ return para('',{after:60}); }
function banner(title,sub,meta){
  const cell=(t,o)=>'<w:tc><w:tcPr><w:tcW w:w="'+DW+'" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="0B2F6B"/></w:tcPr>'+t+'</w:tc>';
  return '<w:tbl><w:tblPr><w:tblW w:w="'+DW+'" w:type="dxa"/>'+TBL_JC+'<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="'+DW+'"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>'+
    cell(cellP(title,{sz:36,bold:true,color:'FFFFFF',align:'center',before:200,after:40})+cellP(sub,{sz:22,color:'CFE0FF',align:'center',before:0,after:40})+cellP(meta,{sz:18,color:'9FB8E8',align:'center',before:0,after:200}))+'</w:tr></w:tbl>'+spacer();
}
function kpiRow(cards){
  const ws=fitW(cards.map(()=>1),DW), bd='<w:left w:val="single" w:sz="36" w:color="FFFFFF"/><w:right w:val="single" w:sz="36" w:color="FFFFFF"/>';
  const tc=(cd,ci)=>'<w:tc><w:tcPr><w:tcW w:w="'+ws[ci]+'" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="30" w:color="'+cd.color.replace('#','')+'"/>'+bd+'</w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="F2F7FF"/></w:tcPr>'+
    cellP(cd.label,{sz:18,color:'64748b',align:'center',keep:true,before:80})+cellP(cd.value,{sz:38,bold:true,color:cd.color.replace('#',''),align:'center',keep:true,before:0,after:0})+cellP(cd.sub,{sz:17,color:'64748b',align:'center',before:0,after:80})+'</w:tc>';
  return '<w:tbl><w:tblPr><w:tblW w:w="'+DW+'" w:type="dxa"/>'+TBL_JC+'<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>'+ws.map(w=>'<w:gridCol w:w="'+w+'"/>').join('')+'</w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>'+cards.map(tc).join('')+'</w:tr></w:tbl>'+spacer();
}
// ตารางสไตล์สมัยใหม่: หัวตารางสีน้ำเงิน, แถวสลับสี, แถวไม่ถูกตัดข้ามหน้า, ตารางเล็กอยู่หน้าเดียวกัน
function table(rows,widths,o){
  o=o||{}; widths=fitW(widths,DW); const center=o.center||[], keepAll=rows.length<=14;
  const bd='<w:tblBorders><w:top w:val="single" w:sz="4" w:color="D0D7E5"/><w:left w:val="single" w:sz="4" w:color="D0D7E5"/><w:bottom w:val="single" w:sz="4" w:color="D0D7E5"/><w:right w:val="single" w:sz="4" w:color="D0D7E5"/><w:insideH w:val="single" w:sz="4" w:color="E3E8F2"/><w:insideV w:val="single" w:sz="4" w:color="E3E8F2"/></w:tblBorders>';
  const trs=rows.map((cells,ri)=>{ const head=ri===0, last=ri===rows.length-1, fill=head?'0B2F6B':(ri%2===0?'F6F9FF':'FFFFFF');
    return '<w:tr><w:trPr><w:cantSplit/>'+(head?'<w:tblHeader/>':'')+'</w:trPr>'+cells.map((cell,ci)=>{
      const col=(!head&&o.colorCol===ci&&o.colorFn)?o.colorFn(ri,cell):(head?'FFFFFF':'1f2937');
      return '<w:tc><w:tcPr><w:tcW w:w="'+widths[ci]+'" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="'+fill+'"/><w:vAlign w:val="center"/></w:tcPr>'+cellP(cell,{sz:20,bold:head||(o.colorCol===ci),color:col,align:center.indexOf(ci)>=0?'center':null,keep:keepAll&&!last})+'</w:tc>'; }).join('')+'</w:tr>'; }).join('');
  return '<w:tbl><w:tblPr><w:tblW w:w="'+DW+'" w:type="dxa"/>'+TBL_JC+bd+'<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'+widths.map(w=>'<w:gridCol w:w="'+w+'"/>').join('')+'</w:tblGrid>'+trs+'</w:tbl>'+spacer();
}
function bullets(items){ return items.map(t=>para('•  '+t,{sz:21,fill:'F4F7FD',indent:240,after:30,border:{color:'2563EB',sz:24}})).join(''); }
function metaTable(pairs){ return table([['รายการ','รายละเอียด']].concat(pairs),[2600,7400]); }

function newMedia(){ const list=[]; return {list, add(cv,maxpx){ const id=list.length+1, m={rel:'rIdImg'+id,name:'chart'+id+'.png',bytes:canvasBytes(cv),id}; list.push(m); const w=maxpx||IMG_MAX, h=Math.round(cv._h*w/cv._w); /* ขยายเต็มความกว้างเนื้อหา (กราฟวาด 2x จึงยังคมชัด) */ return img(m,w,h); }}; }
function img(m,wpx,hpx){
  const cx=Math.round(wpx*9525), cy=Math.round(hpx*9525);
  return '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="120"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="'+m.id+'" name="'+m.name+'"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="'+m.id+'" name="'+m.name+'"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="'+m.rel+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}
async function assemble(body,media){
  if(typeof JSZip==='undefined'){ toast('โหลด JSZip ไม่สำเร็จ',true); return null; }
  const X='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const docXml=X+'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>';
  const ct=X+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const rels=X+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const drels=X+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+media.list.map(m=>'<Relationship Id="'+m.rel+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/'+m.name+'"/>').join('')+'</Relationships>';
  const zip=new JSZip(); zip.file('[Content_Types].xml',ct); zip.folder('_rels').file('.rels',rels);
  const w=zip.folder('word'); w.file('document.xml',docXml); w.folder('_rels').file('document.xml.rels',drels);
  const md=w.folder('media'); media.list.forEach(m=>md.file(m.name,m.bytes));
  return await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
function who(){ return (typeof user!=='undefined'&&user&&(user.displayName||user.email))||'-'; }

/* ============================================================
   ส่วนเนื้อหาเชิงรายงาน (ประเด็นที่ควรติดตาม · การกระจาย · ข้อเสนอแนะเชิงบริหาร · รายละเอียด · ข้อเสนอแนะทั้งหมด)
   สร้างครั้งเดียวเป็นโครงข้อมูล แล้วใช้ร่วมกันทั้งหน้าจอและ DOCX
   ============================================================ */
const BAND_HEX={'ดีเยี่ยม':'2563EB','ดี':'16A34A','พอใช้':'D97706','ปานกลาง':'D97706','ต้องปรับปรุง':'EA580C','ควรปรับปรุง':'EA580C','ไม่ผ่าน':'DC2626'};
const pcTxt=(n,t)=>t?f1(n/t*100)+'%':'-';
function onsiteSections(m){
  const s=m.s, weak=criteria.find(c=>c.key===s.lowestKey), best=s.top&&s.top[0], risk=(s.risks||[])[0];
  const follow={title:'ประเด็นที่ควรติดตาม',head:['ลำดับ','ชื่อเจ้าหน้าที่','คะแนนเฉลี่ย','ร้อยละ','ระดับ'],rows:(s.risks||[]).map((p,i)=>[String(i+1),p.name,f2(p.avg),pctTxt(p.avg),p.band]),widths:[800,4400,1600,1600,1700],center:[0,2,3,4],levelCol:4,empty:'ไม่พบเจ้าหน้าที่ที่มีคะแนนเฉลี่ยต่ำกว่าเกณฑ์ติดตาม (3.50) ในรอบรายงานนี้'};
  const ev=Object.entries(s.evaluators||{}).sort((a,b)=>b[1]-a[1]);
  const dists=[{title:'จำนวนรายการประเมินตามผลัด',head:['ลำดับ','ผลัดของเจ้าหน้าที่ ตม.','จำนวนรายการ','ร้อยละ'],rows:ev.map((x,i)=>[String(i+1),x[0]||'-',String(x[1]),pcTxt(x[1],s.total)]),widths:[800,5400,2000,1900],center:[0,2,3],empty:'ไม่มีข้อมูลผลัดในรอบรายงานนี้'}];
  const stars=m.people.filter(p=>p.count&&p.avg>=4.995).map(p=>p.name);
  const recs=[
    {text:s.total?'กำหนดให้แต่ละผลัดบันทึกผลการประเมินอย่างต่อเนื่องทุกเดือน เพื่อให้ข้อมูลเพียงพอต่อการติดตามแนวโน้มรายบุคคล':'เริ่มบันทึกผลการประเมินประจำเดือนให้ครบถ้วนก่อนใช้รายงานประกอบการตัดสินใจ'},
    {text:weak?'จัด coaching หรือ sharing session ในหัวข้อ "'+weak.shortTitle+'" เนื่องจากเป็นหัวข้อที่มีคะแนนเฉลี่ยต่ำสุดในรอบรายงาน ('+f2(s.criteriaAvg[weak.key]||0)+')':'ติดตามคะแนนรายหัวข้อหลังมีข้อมูลประเมินเพิ่มเติม'}
  ];
  if(stars.length>1) recs.push({text:'นำแนวปฏิบัติของเจ้าหน้าที่ที่ได้คะแนนเต็ม 5.00 มาใช้เป็นตัวอย่างหรือ buddy model เพื่อยกระดับมาตรฐานการให้บริการของทีม ได้แก่',subs:stars});
  else if(stars.length===1) recs.push({text:'นำแนวปฏิบัติของ '+stars[0]+' (คะแนนเต็ม 5.00) มาใช้เป็นตัวอย่างหรือ buddy model เพื่อยกระดับมาตรฐานการให้บริการของทีม'});
  else if(best) recs.push({text:'นำแนวปฏิบัติของ '+best.name+' มาใช้เป็นตัวอย่างหรือ buddy model เพื่อยกระดับมาตรฐานการให้บริการของทีม'});
  recs.push({text:risk?'จัดทำแผนติดตามรายบุคคลสำหรับ '+risk.name+' พร้อมกำหนดเป้าหมายการปรับปรุงในรอบถัดไป':'คงการติดตามตามรอบปกติ และเน้นรักษามาตรฐานบริการให้สม่ำเสมอ'});
  const detail={title:'รายละเอียดสรุปรายบุคคล',head:['ลำดับ','ชื่อเจ้าหน้าที่','จำนวนครั้ง','คะแนนเฉลี่ย','ร้อยละ','ระดับ'],rows:m.people.filter(p=>p.count).map((p,i)=>[String(i+1),p.name,String(p.count),f2(p.avg),pctTxt(p.avg),p.band]),widths:[800,3700,1300,1500,1400,1400],center:[0,2,3,4,5],levelCol:5,empty:'ไม่มีข้อมูลรายบุคคลในรอบรายงานนี้'};
  const comments={title:'ข้อเสนอแนะทั้งหมดในรอบรายงาน',items:m.recs.filter(r=>r.comment).map(r=>({who:r.staff,text:r.comment})),empty:'ไม่มีข้อเสนอแนะในรอบรายงานนี้'};
  return {follow,dists,recs,detail,comments};
}
function appsSections(m){
  const api=window.appsSummaryApi, s=m.s;
  const all=s.sec1.map(x=>Object.assign({sec:'ส่วนที่ 1'},x)).concat(s.sec2.map(x=>Object.assign({sec:'ส่วนที่ 2'},x))).filter(x=>x.n);
  const asc=all.slice().sort((a,b)=>a.pct-b.pct), low=asc.filter(x=>x.pct<60), lo=asc[0], hi=asc[asc.length-1];
  const follow={title:'ประเด็นที่ควรติดตาม',head:['ลำดับ','ส่วน','หัวข้อประเมิน','ร้อยละ','ระดับ'],rows:low.map((x,i)=>[String(i+1),x.sec+' ข้อ '+x.crit.no,x.crit.title,f1(x.pct),api.band(x.pct)]),widths:[700,1500,5300,1200,1400],center:[0,1,3,4],levelCol:4,empty:'ไม่พบหัวข้อที่ความพึงพอใจต่ำกว่า 60% ในรอบรายงานนี้'};
  const ag=m.agencies;
  const dists=[
    {title:'ระยะเวลาการใช้งานระบบ APPS ของผู้ประเมิน',head:['ลำดับ','ระยะเวลาการใช้งาน','จำนวน (ราย)','ร้อยละ'],rows:api.DURATIONS.map((d,i)=>[String(i+1),d,String(s.durCounts[d]||0),pcTxt(s.durCounts[d]||0,s.n)]),widths:[800,5400,2000,1900],center:[0,2,3],empty:'ไม่มีข้อมูล'},
    {title:'จำนวนผู้ประเมินตามหน่วยงาน',head:['ลำดับ','หน่วยงาน','จำนวน (ราย)','ร้อยละ'],rows:ag.map((x,i)=>[String(i+1),x.label||'-',String(x.value),pcTxt(x.value,s.n)]),widths:[800,5400,2000,1900],center:[0,2,3],empty:'ไม่มีข้อมูลหน่วยงานในรอบรายงานนี้'}];
  const agRows=ag.map(x=>{ const t=api.summarize(m.rs.filter(r=>r.agency===x.label)); return {name:x.label||'-',n:x.value,p1:t.sec1Pct,p2:t.sec2Pct,po:t.overallPct}; });
  const detail={title:'รายละเอียดสรุปรายหน่วยงาน',head:['ลำดับ','หน่วยงาน','ผู้ประเมิน','ส่วนที่ 1 (%)','ส่วนที่ 2 (%)','ภาพรวม (%)','ระดับ'],rows:agRows.map((r,i)=>[String(i+1),r.name,String(r.n),f1(r.p1),f1(r.p2),f1(r.po),api.band(r.po)]),widths:[700,3500,1000,1200,1200,1200,1200],center:[0,2,3,4,5,6],levelCol:6,empty:'ไม่มีข้อมูลรายหน่วยงานในรอบรายงานนี้'};
  const recs=[{text:'ส่งเสริมให้ผู้ใช้งานตอบแบบประเมินอย่างต่อเนื่องทุกเดือน (รอบนี้มีผู้ประเมิน '+s.n+' ราย) เพื่อให้ข้อมูลเพียงพอต่อการติดตามแนวโน้มและเปรียบเทียบรายหน่วยงาน'}];
  if(low.length){ recs.push({text:'จัดทำแผนปรับปรุงหัวข้อที่ความพึงพอใจต่ำกว่า 60% พร้อมแจ้งผลต่อผู้เกี่ยวข้อง โดยเรียงจากต่ำสุด ได้แก่',subs:low.map(x=>x.sec+' ข้อ '+x.crit.no+' '+x.crit.title+' ('+f1(x.pct)+'%)')}); }
  else if(lo) recs.push({text:'ทุกหัวข้ออยู่ในระดับ "ดี" ขึ้นไป ให้คงการติดตามตามรอบปกติ และเฝ้าระวังหัวข้อที่ต่ำที่สุดคือ "'+lo.crit.title+'" ('+f1(lo.pct)+'%)'});
  if(hi) recs.push({text:'รักษามาตรฐานและถอดบทเรียนจากหัวข้อ "'+hi.crit.title+'" ซึ่งมีความพึงพอใจสูงสุด ('+f1(hi.pct)+'%) เพื่อขยายผลไปยังหัวข้ออื่น'});
  const lowAg=agRows.filter(r=>r.po<60);
  if(lowAg.length) recs.push({text:'ติดตามหน่วยงานที่ความพึงพอใจภาพรวมต่ำกว่า 60% เป็นรายหน่วยงาน ได้แก่',subs:lowAg.map(r=>r.name+' ('+f1(r.po)+'%)')});
  recs.push({text:s.sug.length?'ทบทวนข้อเสนอแนะเพิ่มเติมจำนวน '+s.sug.length+' รายการ และมอบหมายผู้รับผิดชอบพร้อมกำหนดเวลาดำเนินการ':'รอบรายงานนี้ไม่มีข้อเสนอแนะเพิ่มเติม ควรส่งเสริมให้ผู้ใช้งานแสดงความคิดเห็นเพื่อการปรับปรุงระบบ'});
  const comments={title:'ข้อเสนอแนะเพิ่มเติม',items:s.sug.map(x=>({who:x.agency,text:x.text})),empty:'ไม่มีข้อเสนอแนะเพิ่มเติม'};
  return {follow,dists,recs,detail,comments};
}
/* ---- หน้าจอ ---- */
function htmlTable(t){
  if(!t.rows.length) return '<div class="mini">'+esc(t.empty)+'</div>';
  return '<div class="table-wrap"><table style="min-width:520px"><thead><tr>'+t.head.map((h,i)=>'<th'+(t.center.indexOf(i)>=0?' style="text-align:center"':'')+'>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
    t.rows.map(r=>'<tr>'+r.map((c,i)=>{ const lv=t.levelCol===i&&BAND_HEX[c]?';font-weight:800;color:#'+BAND_HEX[c]:''; return '<td style="'+(t.center.indexOf(i)>=0?'text-align:center':'')+lv+'">'+esc(c)+'</td>'; }).join('')+'</tr>').join('')+'</tbody></table></div>';
}
function panel(title,inner){ return '<div class="panel" style="margin-bottom:16px"><div class="panel-title" style="margin-bottom:12px">'+esc(title)+'</div>'+inner+'</div>'; }
function sectionsHtml(sec){
  let h=panel(sec.follow.title,htmlTable(sec.follow));
  sec.dists.forEach(d=>{ h+=panel(d.title,htmlTable(d)); });
  h+=panel('ข้อเสนอแนะเชิงบริหาร','<ol style="margin:0;padding-left:22px;line-height:1.9">'+sec.recs.map(r=>'<li>'+esc(r.text)+(r.subs?'<ul style="margin:2px 0 6px;padding-left:20px">'+r.subs.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+'</li>').join('')+'</ol>');
  h+=panel(sec.detail.title,htmlTable(sec.detail));
  h+=panel(sec.comments.title+' ('+sec.comments.items.length+')',sec.comments.items.length?'<div class="insight">'+sec.comments.items.map(x=>'<div class="insight-card"><b>'+esc(x.who)+'</b>'+esc(x.text)+'</div>').join('')+'</div>':'<div class="mini">'+esc(sec.comments.empty)+'</div>');
  return h;
}
/* ---- DOCX ---- */
function kvTable(pairs){
  const widths=fitW([2600,7400],DW), bd='<w:tblBorders><w:top w:val="single" w:sz="4" w:color="D0D7E5"/><w:left w:val="single" w:sz="4" w:color="D0D7E5"/><w:bottom w:val="single" w:sz="4" w:color="D0D7E5"/><w:right w:val="single" w:sz="4" w:color="D0D7E5"/><w:insideH w:val="single" w:sz="4" w:color="E3E8F2"/><w:insideV w:val="single" w:sz="4" w:color="E3E8F2"/></w:tblBorders>';
  return '<w:tbl><w:tblPr><w:tblW w:w="'+DW+'" w:type="dxa"/>'+TBL_JC+bd+'<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'+widths.map(w=>'<w:gridCol w:w="'+w+'"/>').join('')+'</w:tblGrid>'+
   pairs.map((p,ri)=>'<w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="'+widths[0]+'" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="EAF1FF"/><w:vAlign w:val="center"/></w:tcPr>'+cellP(p[0],{sz:20,bold:true,color:'0b2f6b',keep:ri<pairs.length-1})+'</w:tc><w:tc><w:tcPr><w:tcW w:w="'+widths[1]+'" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/><w:vAlign w:val="center"/></w:tcPr>'+cellP(p[1],{sz:20,keep:ri<pairs.length-1})+'</w:tc></w:tr>').join('')+'</w:tbl>'+spacer();
}
function docxTable(t){
  if(!t.rows.length) return para(t.empty,{color:'6a7d9b',fill:'F4F7FD',indent:120,after:80});
  return table([t.head].concat(t.rows),t.widths,{center:t.center,colorCol:t.levelCol==null?-1:t.levelCol,colorFn:(ri,c)=>BAND_HEX[c]||'1f2937'});
}
// ข้อเสนอแนะเชิงบริหาร: การ์ดมีเลขลำดับสีน้ำเงิน + ข้อความ (รายการย่อยอยู่ในการ์ดเดียวกัน)
function docxRecs(items){
  const widths=fitW([650,9350],DW);
  const rows=items.map((r,i)=>{
    const body=cellP(r.text,{sz:21,keep:!!r.subs,before:50,after:r.subs?20:50})+(r.subs||[]).map((x,k)=>cellP('•  '+x,{sz:20,color:'374151',before:0,after:k===r.subs.length-1?60:10})).join('');
    return '<w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="'+widths[0]+'" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="24" w:color="FFFFFF"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="2563EB"/><w:vAlign w:val="center"/></w:tcPr>'+cellP(String(i+1),{sz:30,bold:true,color:'FFFFFF',align:'center'})+'</w:tc><w:tc><w:tcPr><w:tcW w:w="'+widths[1]+'" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="24" w:color="FFFFFF"/></w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="F4F7FD"/><w:vAlign w:val="center"/></w:tcPr>'+body+'</w:tc></w:tr>'; }).join('');
  return '<w:tbl><w:tblPr><w:tblW w:w="'+DW+'" w:type="dxa"/>'+TBL_JC+'<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="140" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'+widths.map(w=>'<w:gridCol w:w="'+w+'"/>').join('')+'</w:tblGrid>'+rows+'</w:tbl>'+spacer();
}
function docxComments(c){
  if(!c.items.length) return para(c.empty,{color:'6a7d9b',fill:'F4F7FD',indent:120});
  return c.items.map(x=>para(x.who,{sz:18,bold:true,color:'0b2f6b',before:80,after:20,keep:true})+para(x.text,{fill:'F4F6F9',after:40,border:{color:'93C5FD',sz:18}})).join('');
}
function metaPairs(label,now,extra){ return [['รอบรายงาน',label],['วันที่จัดทำ',now.toLocaleString('th-TH')],['จัดทำโดย',who()]].concat(extra||[]); }

async function buildOnsiteDocx(period){
  BG='#ffffff'; const m=onsiteCompute(period), s=m.s, ch=onsiteCharts(m), sec=onsiteSections(m), md=newMedia(), label=periodLabel(period), now=new Date();
  const weak=criteria.slice().sort((a,b)=>(s.criteriaAvg[a.key]||0)-(s.criteriaAvg[b.key]||0))[0];
  let n=0; const H=(t,c)=>heading((++n)+'. '+t,c);
  let b='';
  b+=banner('รายงานสรุปผลการประเมินเจ้าหน้าที่ Onsite Support','สำหรับเจ้าหน้าที่ตรวจคนเข้าเมือง · '+label,'OSO Evaluation · สำนักงานตรวจคนเข้าเมือง');
  b+=kvTable(metaPairs(label,now,[['แหล่งข้อมูล','OSO Evaluation (Supabase)']]));
  b+=H('Dashboard Summary');
  b+=kpiRow([
    {label:'จำนวนประเมิน',value:String(s.total),sub:'รายการ',color:'#0b2f6b'},
    {label:'เจ้าหน้าที่ที่ถูกประเมิน',value:String(s.evaluated),sub:'คน',color:'#0ea5e9'},
    {label:'คะแนนเฉลี่ย',value:f2(s.avgScore),sub:pctTxt(s.avgScore)+' · '+s.band,color:toneColorAvg(s.avgScore)},
    {label:'หัวข้อที่ควรโฟกัส',value:weak?weak.shortTitle:'-',sub:weak?f2(s.criteriaAvg[weak.key]||0)+' · '+pctTxt(s.criteriaAvg[weak.key]||0):'',color:'#f59e0b'}]);
  b+=H('สรุปประเด็นสำคัญ','0EA5E9'); b+=bullets(onsiteInsights(m));
  if(s.total){
    b+=H('ภาพรวมผลการประเมิน','0EA5E9'); b+=md.add(sideBySide(ch.gauge,ch.donut,20),IMG_MAX);
    b+=H('กราฟและคะแนนเฉลี่ยรายหัวข้อ','14B8A6'); b+=md.add(ch.crit,IMG_MAX);
    b+=table([['ลำดับ','หัวข้อประเมิน','คะแนนเฉลี่ย','ร้อยละ','ระดับ']].concat(criteria.map(c=>{const a=s.criteriaAvg[c.key]||0; return [String(c.no),c.title,f2(a),pctTxt(a),scoreBand(a)];})),[800,4200,1500,1500,2000],{center:[0,2,3,4],colorCol:4,colorFn:(ri,c)=>BAND_HEX[c]||'1f2937'});
    if(ch.trend){ b+=H('แนวโน้มรายเดือน','8B5CF6'); b+=md.add(ch.trend,IMG_MAX); }
  }
  b+=H(sec.follow.title,'EF4444'); b+=docxTable(sec.follow);
  if(s.total){
    b+=H(sec.dists[0].title,'F59E0B'); if(ch.shiftBars) b+=md.add(ch.shiftBars,IMG_MAX); b+=docxTable(sec.dists[0]);
  }
  b+=H('ข้อเสนอแนะเชิงบริหาร','2563EB'); b+=docxRecs(sec.recs);
  b+=H(sec.detail.title,'14B8A6'); if(ch.topBars) b+=md.add(ch.topBars,IMG_MAX); b+=docxTable(sec.detail);
  b+=H(sec.comments.title,'EF4444'); b+=docxComments(sec.comments);
  b+=para('เกณฑ์ระดับคะแนน: ดีเยี่ยม ≥ 4.60 · ดี ≥ 3.80 · พอใช้ ≥ 3.00 · ต้องปรับปรุง ≥ 2.00 · ไม่ผ่าน < 2.00   |   แหล่งข้อมูล: OSO Evaluation (Supabase)',{sz:16,color:'94a3b8',before:200,align:'center'});
  return assemble(b,md);
}
async function buildAppsDocx(period){
  BG='#ffffff'; const api=window.appsSummaryApi, m=appsCompute(period), s=m.s, ch=appsCharts(m), sec=appsSections(m), md=newMedia(), label=periodLabel(period), now=new Date();
  let n=0; const H=(t,c)=>heading((++n)+'. '+t,c);
  let b='';
  b+=banner('รายงานสรุปความพึงพอใจต่อการให้บริการระบบ APPS','ระบบตรวจสอบและคัดกรองผู้โดยสารล่วงหน้า · Service Desk · '+label,'OSO Evaluation · สำนักงานตรวจคนเข้าเมือง');
  b+=kvTable(metaPairs(label,now,[['แหล่งข้อมูล','OSO Evaluation — APPS Survey (Supabase)'],['เกณฑ์ระดับ','ร้อยละ 80-100 = ดีเยี่ยม · 60-79 = ดี · 40-59 = ปานกลาง · 0-39 = ควรปรับปรุง']]));
  b+=H('Dashboard Summary');
  b+=kpiRow([
    {label:'ผู้ประเมิน',value:String(s.n),sub:'ราย',color:'#0b2f6b'},
    {label:'ส่วนที่ 1 เจ้าหน้าที่',value:f1(s.sec1Pct)+'%',sub:api.band(s.sec1Pct),color:api.bandColor(s.sec1Pct)},
    {label:'ส่วนที่ 2 ระบบ/Service Desk',value:f1(s.sec2Pct)+'%',sub:api.band(s.sec2Pct),color:api.bandColor(s.sec2Pct)},
    {label:'ภาพรวมทั้งหมด',value:f1(s.overallPct)+'%',sub:api.band(s.overallPct),color:api.bandColor(s.overallPct)}]);
  b+=H('สรุปประเด็นสำคัญ','0EA5E9'); b+=bullets(appsInsights(m));
  if(s.n){
    b+=H('ภาพรวมความพึงพอใจและระยะเวลาการใช้งาน','0EA5E9'); b+=md.add(sideBySide(ch.gauge,ch.dur,20),IMG_MAX); b+=docxTable(sec.dists[0]);
    if(ch.trend){ b+=H('แนวโน้มรายเดือน','8B5CF6'); b+=md.add(ch.trend,IMG_MAX); }
    const part=(title,pctC,dC,arr,color)=>{
      let x=H(title,color); x+=md.add(pctC,IMG_MAX); x+=md.add(dC,IMG_MAX);
      x+=table([['ข้อ','หัวข้อประเมิน'].concat(api.SCALE.map(o=>o.label)).concat(['ร้อยละ','ระดับ'])].concat(arr.map(a=>[String(a.crit.no),a.crit.title].concat(api.SCALE.map(o=>String(a.counts[o.value]))).concat([f1(a.pct),api.band(a.pct)]))),[500,3300,800,700,900,1000,900,1100],{center:[0,2,3,4,5,6,7],colorCol:7,colorFn:(ri,c)=>BAND_HEX[c]||'1f2937'});
      return x; };
    b+=part('ส่วนที่ 1 : เจ้าหน้าที่ที่ให้การสนับสนุนการใช้งานระบบประจำท่าอากาศยาน',ch.s1p,ch.s1d,s.sec1,'14B8A6');
    b+=part('ส่วนที่ 2 : ระบบ APPS และศูนย์บริการ (Service Desk)',ch.s2p,ch.s2d,s.sec2,'F59E0B');
  }
  b+=H(sec.follow.title,'EF4444'); b+=docxTable(sec.follow);
  if(s.n){ b+=H(sec.dists[1].title,'0EA5E9'); if(ch.agBars) b+=md.add(ch.agBars,IMG_MAX); b+=docxTable(sec.dists[1]); }
  b+=H('ข้อเสนอแนะเชิงบริหาร','2563EB'); b+=docxRecs(sec.recs);
  b+=H(sec.detail.title,'14B8A6'); b+=docxTable(sec.detail);
  b+=H(sec.comments.title,'EF4444'); b+=docxComments(sec.comments);
  b+=para('เกณฑ์: ร้อยละ 80-100 = ดีเยี่ยม · 60-79 = ดี · 40-59 = ปานกลาง · 0-39 = ควรปรับปรุง   |   แหล่งข้อมูล: OSO Evaluation — APPS Survey (Supabase)',{sz:16,color:'94a3b8',before:200,align:'center'});
  return assemble(b,md);
}

/* ============================================================
   ปุ่ม/เหตุการณ์ (global สำหรับ onclick)
   ============================================================ */
window.sumPeriodChange=function(kind,val){ state[kind]=val||'all'; (kind==='onsite'?renderOnsite:renderApps)(); };
window.sumRefresh=async function(kind){
  if(kind==='onsite'){ await refresh(); return; }
  try{ await window.appsSummaryApi.ensure(true); }catch(e){}
  renderApps(); toast('อัปเดตข้อมูลแล้ว');
};
window.sumExport=async function(kind){
  if(typeof can==='function'&&!can('view_reports')&&!(user&&user.isAdmin)){ toast('คุณไม่มีสิทธิ์ออกรายงาน',true); return; }
  const btn=$('sumExportBtn_'+kind); if(btn)btn.disabled=true;
  try{
    toast('กำลังสร้างรายงานสรุป DOCX...');
    if(kind==='onsite'){ if(typeof ensureFresh==='function') await ensureFresh(); } else await window.appsSummaryApi.ensure(true);
    const p=state[kind], blob=await (kind==='onsite'?buildOnsiteDocx(p):buildAppsDocx(p));
    if(!blob) return;
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='OSO_Summary_'+(kind==='onsite'?'Onsite':'APPS')+'_'+(p==='all'?'all':p)+'.docx'; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    toast('สร้างรายงานสรุป DOCX แล้ว');
    if(typeof logAction==='function') logAction('report','summary_'+kind,periodLabel(p));
  }catch(e){ toast('สร้างรายงานไม่สำเร็จ: '+((e&&e.message)||e),true); }
  finally{ if(btn)btn.disabled=false; }
};

/* ---------- เชื่อมกับ render() ---------- */
const SVIEWS={ sum_onsite:{title:'สรุปผลประเมิน — Onsite Support', fn:renderOnsite},
               sum_apps:  {title:'สรุปผลประเมิน — APPS (Service Desk)', fn:renderApps} };
const _render=window.render;
window.render=function(){
  const v=view;
  if(SVIEWS[v]){ const pt=$('pageTitle'); if(pt)pt.textContent=SVIEWS[v].title; SVIEWS[v].fn(); return; }
  return _render.apply(this,arguments);
};
// ให้ vm harness เรียกฟังก์ชันภายในได้
window.__sumTest={onsiteSections,appsSections,wrapTH,mk,onsiteCompute,appsCompute,onsiteCharts,appsCharts,onsiteInsights,appsInsights,buildOnsiteDocx,buildAppsDocx,state};
})();
