/* ============================================================
   apps-survey.js — โมดูลเสริม "แบบประเมินความพึงพอใจระบบ APPS / PNR (Service Desk)"
   แยกจากระบบประเมินเจ้าหน้าที่ Onsite เดิม (ตาราง apps_surveys)
   เกณฑ์ 4 ระดับ: ดีเยี่ยม=4 · ดี=3 · ปานกลาง=2 · ควรปรับปรุง=1
   ร้อยละต่อหัวข้อ = ผลรวมคะแนน / (จำนวนผู้ตอบ × 4) × 100
   ทำงานร่วมกับ app.js โดยใช้ globals: $, esc, toast, sb, user, logAction,
   can, THAI_MONTHS, LOADING, dEsc, dRun, dPar, dHeading, dTable, dKpiCards,
   blobToB64, callFn, JSZip  (ไม่แก้ไข app.js เดิม — ครอบ render/showPublic)
   ============================================================ */
(function(){
'use strict';

/* ---------- ค่าคงที่ ---------- */
const SCALE = [
  {label:'ดีเยี่ยม',   value:4, color:'#2563eb'},
  {label:'ดี',        value:3, color:'#22c55e'},
  {label:'ปานกลาง',   value:2, color:'#f59e0b'},
  {label:'ควรปรับปรุง', value:1, color:'#ef4444'}
];
const SCALE_MAP = {}; SCALE.forEach(o=>SCALE_MAP[o.label]=o.value);

const SEC1 = [
  {key:'s1_1', no:1, title:'มีความรู้ความสามารถ', sub:'น่าเชื่อถือ / ครอบคลุม หรือ ครบถ้วน / ช่วยแก้ปัญหาได้ถูกต้อง'},
  {key:'s1_2', no:2, title:'การปฏิบัติตามนโยบาย กฎ ระเบียบ', sub:'การแต่งกาย / การรักษาวินัย / มารยาท'},
  {key:'s1_3', no:3, title:'คุณภาพการให้บริการ', sub:'รวดเร็ว / กระตือรือร้น / เต็มใจให้บริการ / มีความรับผิดชอบ / ตรงเวลา หรือทันเวลา'}
];
const SEC2 = [
  {key:'s2_1', no:1, title:'ระบบมีประสิทธิภาพ และสร้างความมั่นใจในการทำงาน'},
  {key:'s2_2', no:2, title:'ระบบมีประโยชน์สามารถช่วยสนับสนุนภารกิจของหน่วยงานได้'},
  {key:'s2_3', no:3, title:'ระบบใช้งานง่ายและมีฟังก์ชั่นที่รองรับตามวัตถุประสงค์ของหน่วยงาน'},
  {key:'s2_4', no:4, title:'คู่มือการใช้งานช่วยเพิ่มความเข้าใจในการใช้งานระบบให้กับเจ้าหน้าที่ได้'},
  {key:'s2_5', no:5, title:'ความสะดวกในการติดต่อขอความช่วยเหลือ'},
  {key:'s2_6', no:6, title:'การรับแจ้งปัญหาและการให้คำแนะนำข้อมูล / การอธิบาย'},
  {key:'s2_7', no:7, title:'การแจ้งข้อมูลข่าวสารการ Upgrade ระบบ (วิธีการ / ความชัดเจน / เข้าใจง่าย)'}
];
const ALLCRIT = SEC1.concat(SEC2);

const AGENCIES = [
  'เจ้าหน้าที่ตำรวจตรวจคนเข้าเมือง (IMMIGRATION)',
  'เจ้าหน้าที่ศุลกากร (CUSTOMS)',
  'เจ้าหน้าที่ตำรวจสันติบาล (SBB)',
  'เจ้าหน้าที่ปปส. (ONCB)'
];
const AIRPORTS = [
  'ท่าอากาศยานสุวรรณภูมิ (BKK)',
  'ท่าอากาศยานดอนเมือง (DMK)',
  'ท่าอากาศยานเชียงใหม่ (CNX)',
  'ท่าอากาศยานภูเก็ต (HKT)',
  'ท่าอากาศยานหาดใหญ่ (HDY)',
  'ท่าอากาศยานเชียงราย (CEI)',
  'ท่าอากาศยานสมุย (USM)',
  'ท่าอากาศยานอู่ตะเภา (UTP)'
];
const DURATIONS = ['1-6 เดือน','6 เดือน - 1 ปี','1-3 ปี','มากกว่า 3 ปี'];

/* ---------- สถานะ ---------- */
let rows = [];            // ข้อมูลทั้งหมดจาก apps_surveys
let loaded = false;
let period = 'all';       // 'all' หรือ 'YYYY-MM' (ตัวกรองแดชบอร์ด)
let filter = '';          // ค้นหาในรายการ

/* ---------- helper คะแนน ---------- */
const g$ = $;             // getElementById (global const จาก app.js)
const gesc = esc;         // escape html (global const จาก app.js)
function pctOf(sum,n){ return n ? (sum/(n*4)*100) : 0; }
function band(p){ return p>=80?'ดีเยี่ยม':p>=60?'ดี':p>=40?'ปานกลาง':p>0?'ควรปรับปรุง':'ยังไม่มีข้อมูล'; }
function bandColor(p){ return p>=80?'#2563eb':p>=60?'#22c55e':p>=40?'#f59e0b':'#ef4444'; }
function bandTone(p){ return p>=80?'excellent':p>=60?'good':p>=40?'fair':'critical'; }
function f2(x){ return (Number(x)||0).toFixed(2); }

function critStat(rs,key){
  const counts={4:0,3:0,2:0,1:0}; let sum=0,n=0;
  rs.forEach(r=>{const v=Number(r[key]); if(v>=1&&v<=4){counts[v]++; sum+=v; n++;}});
  return {counts,sum,n,pct:pctOf(sum,n)};
}
function summarize(rs){
  const n=rs.length;
  const sec1=SEC1.map(c=>Object.assign({crit:c},critStat(rs,c.key)));
  const sec2=SEC2.map(c=>Object.assign({crit:c},critStat(rs,c.key)));
  const durCounts={}; DURATIONS.forEach(d=>durCounts[d]=0);
  rs.forEach(r=>{ durCounts[r.duration]=(durCounts[r.duration]||0)+1; });
  const agencyCounts={}; rs.forEach(r=>agencyCounts[r.agency]=(agencyCounts[r.agency]||0)+1);
  const avgP=a=>a.length?a.reduce((x,y)=>x+y.pct,0)/a.length:0;
  const sug=rs.filter(r=>{const t=String(r.suggestion||'').trim(); return t && t!=='-' && t.toLowerCase()!=='ไม่มี';})
             .map(r=>({agency:r.agency, at:r.created_at, text:String(r.suggestion).trim()}));
  return {n,sec1,sec2,durCounts,agencyCounts,sec1Pct:avgP(sec1),sec2Pct:avgP(sec2),overallPct:avgP(sec1.concat(sec2)),sug};
}

/* ---------- โหลดข้อมูล ---------- */
async function ensure(force){
  if(!sb){ rows=[]; return; }
  if(loaded && !force) return;
  try{
    const {data,error}=await sb.from('apps_surveys').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    rows=data||[]; loaded=true;
  }catch(e){ toast('โหลดข้อมูล APPS ไม่สำเร็จ: '+((e&&e.message)||e),true); rows=rows||[]; }
}
function monthsAvailable(){
  const set={};
  rows.forEach(r=>{const d=new Date(r.created_at); if(!isNaN(d)){const k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); set[k]=(set[k]||0)+1;}});
  return Object.keys(set).sort().reverse();
}
function rowsInPeriod(){
  if(!period||period==='all') return rows;
  const a=period.split('-').map(Number);
  return rows.filter(r=>{const d=new Date(r.created_at); return d.getFullYear()===a[0] && (d.getMonth()+1)===a[1];});
}
function monthLabel(ym){ const a=String(ym).split('-').map(Number); return THAI_MONTHS[a[1]-1]+' '+(a[0]+543); }

/* ============================================================
   กราฟ (canvas)
   ============================================================ */
function mkCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
function canvasBytes(cv){
  const b64=cv.toDataURL('image/png').split(',')[1];
  const bin=atob(b64), arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return arr;
}
function niceMax(v){ v=Math.max(1,Math.ceil(v)); if(v<=5)return v; if(v<=10)return Math.ceil(v/2)*2; if(v<=20)return Math.ceil(v/5)*5; return Math.ceil(v/10)*10; }

// cats: [{label, bars:[{v,color}]}]  · valFmt(v)->string · legend:[{label,color}]
function drawColumns(cv, cats, yMax, valFmt, legend){
  const g=cv.getContext('2d');
  g.fillStyle='#ffffff'; g.fillRect(0,0,cv.width,cv.height);
  const padL=40, padR=18, padT=22, padB=legend?66:46;
  const plotW=cv.width-padL-padR, plotH=cv.height-padT-padB, baseY=padT+plotH;
  const steps=5;
  g.font='11px Tahoma';
  for(let i=0;i<=steps;i++){
    const y=baseY-plotH*i/steps;
    g.strokeStyle='#e6ecf5'; g.beginPath(); g.moveTo(padL,y); g.lineTo(cv.width-padR,y); g.stroke();
    g.fillStyle='#94a3b8'; g.textAlign='right'; g.fillText(String(Math.round(yMax*i/steps)), padL-6, y+4);
  }
  const groupW=plotW/cats.length;
  cats.forEach((cat,ci)=>{
    const bn=cat.bars.length, innerPad=groupW*0.14, usable=groupW-innerPad*2;
    const gx=padL+ci*groupW+innerPad;
    cat.bars.forEach((b,bi)=>{
      const bw = bn>1 ? usable/bn : usable*0.6;
      const x  = bn>1 ? gx+bi*(usable/bn) : gx+(usable-bw)/2;
      const bh = yMax ? plotH*(b.v/yMax) : 0;
      g.fillStyle=b.color; g.fillRect(x+(bn>1?1:0), baseY-bh, bn>1?bw-2:bw, bh);
      if(b.v>0 || bn===1){
        g.fillStyle='#0b2f6b'; g.font='bold 11px Tahoma'; g.textAlign='center';
        g.fillText(valFmt(b.v), x+(bn>1?bw/2:bw/2), baseY-bh-4);
      }
    });
    g.fillStyle='#334155'; g.font='11px Tahoma'; g.textAlign='center';
    String(cat.label).split('\n').forEach((ln,li)=> g.fillText(ln, padL+ci*groupW+groupW/2, baseY+16+li*13));
  });
  if(legend){
    let lx=padL, ly=cv.height-24; g.textAlign='left'; g.font='11px Tahoma';
    legend.forEach(le=>{ g.fillStyle=le.color; g.fillRect(lx,ly,12,12); g.fillStyle='#334155'; g.fillText(le.label,lx+16,ly+10); lx+=g.measureText(le.label).width+38; });
  }
  return cv;
}
function chartDuration(durCounts){
  const cats=DURATIONS.map(d=>({label:d.replace(' - ','-\n'), bars:[{v:durCounts[d]||0,color:'#2563eb'}]}));
  const mx=niceMax(Math.max(1,...DURATIONS.map(d=>durCounts[d]||0)));
  return drawColumns(mkCanvas(560,270), cats, mx, v=>String(v), null);
}
function chartCounts(statsArr){
  const cats=statsArr.map(s=>({label:String(s.crit.no), bars:SCALE.map(o=>({v:s.counts[o.value],color:o.color}))}));
  const mx=niceMax(Math.max(1,...statsArr.map(s=>Math.max(s.counts[4],s.counts[3],s.counts[2],s.counts[1]))));
  const w=Math.max(520, cats.length*96+120);
  return drawColumns(mkCanvas(w,300), cats, mx, v=>String(v), SCALE.map(o=>({label:o.label,color:o.color})));
}
function chartPct(statsArr){
  const cats=statsArr.map(s=>({label:String(s.crit.no), bars:[{v:s.pct,color:bandColor(s.pct)}]}));
  const w=Math.max(520, cats.length*80+120);
  return drawColumns(mkCanvas(w,290), cats, 100, v=>f2(v), null);
}

/* ============================================================
   หน้าสาธารณะ — แบบประเมิน APPS
   ============================================================ */
function selOpts(list,val){ return '<option value="">— เลือก —</option>'+list.map(x=>'<option value="'+gesc(x)+'"'+(x===val?' selected':'')+'>'+gesc(x)+'</option>').join(''); }
function segButtons(){
  return '<div class="pub-seg" style="grid-template-columns:repeat(4,1fr)">'+SCALE.map(o=>
    '<button type="button" data-val="'+o.value+'" style="--tone:'+o.color+'22" onclick="appsPick(this)">'+gesc(o.label)+'</button>').join('')+'</div>';
}
function critCard(c,color){
  return '<div class="pub-crit" data-crit="'+c.key+'" style="--c:'+color+'">'+
    '<div class="pub-crit-head"><div class="pub-no">'+c.no+'</div>'+
    '<div class="pub-crit-title">'+gesc(c.title)+(c.sub?'<small>'+gesc(c.sub)+'</small>':'')+'<span class="pub-req">*</span></div></div>'+
    segButtons()+'</div>';
}
function renderPublicForm(){
  const host=g$('appsFormHost'); if(!host) return;
  host.innerHTML =
    '<div id="appsForm">'+
      '<h2>แบบประเมินความพึงพอใจระบบ APPS / PNR</h2>'+
      '<p class="pub-hint">ระบบตรวจสอบและคัดกรองผู้โดยสารล่วงหน้า (APPS) และศูนย์บริการ (Service Desk) — กรุณาให้คะแนนให้ครบทุกหัวข้อ (ข้อเสนอแนะไม่บังคับ) ไม่ต้องเข้าสู่ระบบ</p>'+
      '<div class="form-grid">'+
        '<div class="field"><label class="label">เจ้าหน้าที่หน่วยงานใด?<span class="pub-req">*</span></label><select class="input" id="appsAgency">'+selOpts(AGENCIES)+'</select></div>'+
        '<div class="field"><label class="label">เจ้าหน้าที่ประจำท่าอากาศยาน?<span class="pub-req">*</span></label><select class="input" id="appsAirport">'+selOpts(AIRPORTS,AIRPORTS[0])+'</select></div>'+
      '</div>'+
      '<div class="field" style="margin-top:14px"><label class="label">ระยะเวลาการใช้งานระบบ APPS<span class="pub-req">*</span></label><select class="input" id="appsDuration">'+selOpts(DURATIONS)+'</select></div>'+
      '<h3 class="apps-sec">ส่วนที่ 1 : เจ้าหน้าที่ที่ให้การสนับสนุนการใช้งานระบบประจำท่าอากาศยาน</h3>'+
      '<div id="appsSec1" style="display:grid;gap:14px">'+SEC1.map(c=>critCard(c,'#2563eb')).join('')+'</div>'+
      '<h3 class="apps-sec">ส่วนที่ 2 : ความพึงพอใจในการใช้งานระบบ APPS และศูนย์บริการ (Service Desk)</h3>'+
      '<div id="appsSec2" style="display:grid;gap:14px">'+SEC2.map(c=>critCard(c,'#0ea5e9')).join('')+'</div>'+
      '<div class="field" style="margin-top:16px"><label class="label">ส่วนที่ 3 : ข้อเสนอแนะเพิ่มเติม</label><textarea id="appsSuggestion" placeholder="ข้อเสนอแนะ ปัญหาที่พบ หรือรายละเอียดเพิ่มเติม (ถ้ามี)"></textarea></div>'+
      '<button class="btn primary" id="appsSubmitBtn" style="width:100%;margin-top:18px;min-height:48px" onclick="appsSubmit()">ส่งแบบประเมิน</button>'+
    '</div>'+
    '<div id="appsThanks" class="pub-thanks hidden">'+
      '<div class="big">&#10003;</div><h2>บันทึกผลประเมินเรียบร้อย</h2>'+
      '<p class="pub-hint">ขอบคุณสำหรับการประเมินระบบ APPS ข้อมูลของท่านถูกบันทึกแล้ว</p>'+
      '<button class="btn primary" onclick="appsResetPublic()" style="min-height:46px">ประเมินรายการถัดไป</button>'+
    '</div>';
}
function pick(btn){
  const seg=btn.closest('.pub-seg'); if(!seg) return;
  seg.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const card=btn.closest('.pub-crit'); if(card) card.classList.remove('invalid');
}
async function submitPublic(){
  if(!sb) return toast('ยังไม่ได้ตั้งค่า Supabase',true);
  const agency=g$('appsAgency').value, airport=g$('appsAirport').value, duration=g$('appsDuration').value;
  const row={agency,airport,duration,suggestion:(g$('appsSuggestion').value||'').trim()||null};
  let firstBad=null;
  [['appsAgency',agency],['appsAirport',airport],['appsDuration',duration]].forEach(([id,v])=>{
    const el=g$(id); if(!v){ el.style.borderColor='var(--rose)'; if(!firstBad)firstBad=el; } else el.style.borderColor='';
  });
  document.querySelectorAll('#appsFormHost .pub-crit[data-crit]').forEach(card=>{
    const b=card.querySelector('.pub-seg button.active');
    card.classList.remove('invalid');
    if(!b){ card.classList.add('invalid'); if(!firstBad)firstBad=card; }
    else row[card.dataset.crit]=Number(b.dataset.val);
  });
  if(firstBad){ firstBad.scrollIntoView({behavior:'smooth',block:'center'}); toast('กรุณากรอก/ให้คะแนนให้ครบทุกหัวข้อ',true); return; }
  const btn=g$('appsSubmitBtn'); btn.disabled=true; const old=btn.textContent; btn.textContent='กำลังบันทึก...';
  try{
    const {error}=await sb.from('apps_surveys').insert(row);
    if(error) throw error;
    g$('appsForm').classList.add('hidden'); g$('appsThanks').classList.remove('hidden'); window.scrollTo(0,0);
    loaded=false; // ให้ดึงใหม่รอบหน้า
  }catch(e){ toast('บันทึกไม่สำเร็จ: '+((e&&e.message)||e),true); }
  finally{ btn.disabled=false; btn.textContent=old; }
}
function resetPublic(){
  renderPublicForm(); window.scrollTo(0,0);
}
// ปรับ banner ด้านบนให้ตรงกับแบบประเมินที่เลือก (แยกให้ชัด)
const ONSITE_TITLE='แบบประเมิน<span style="white-space:nowrap">เจ้าหน้าที่ Onsite Support</span><span class="pub-sub">สำหรับเจ้าหน้าที่ตรวจคนเข้าเมือง</span>';
const APPS_TITLE='แบบประเมินความพึงพอใจ<span style="white-space:nowrap">ระบบ APPS / PNR</span>';
function applyBanner(which){
  const apps = which==='apps';
  const imm=g$('pubLogoImm'); if(imm) imm.style.display=apps?'none':'';       // หน้า APPS: เหลือโลโก้ So-Sky อย่างเดียว
  const title=g$('pubHeroTitle'); if(title) title.innerHTML=apps?APPS_TITLE:ONSITE_TITLE;
}
// สลับแท็บแบบประเมินบนหน้าสาธารณะ
function pubSwitch(which){
  const onsite = which!=='apps';
  document.querySelectorAll('[data-pubtab]').forEach(b=>b.classList.toggle('active', b.dataset.pubtab===which));
  const pf=g$('pubForm'), pt=g$('pubThanks'), host=g$('appsFormHost');
  if(pf) pf.classList.toggle('hidden', !onsite);
  if(pt && !onsite) pt.classList.add('hidden');
  if(host){
    host.classList.toggle('hidden', onsite);
    if(!onsite && !host.querySelector('#appsForm')) renderPublicForm();
  }
  applyBanner(onsite?'onsite':'apps');
}

/* ============================================================
   มุมมองในแอป (หลังล็อกอิน)
   ============================================================ */
function kpi(label,val,sub,color){
  return '<div class="stat"><div class="stat-label">'+label+'</div><div class="stat-num" style="color:'+(color||'var(--navy)')+'">'+val+'</div><div class="mini">'+(sub||'')+'</div></div>';
}
function tag(p){ return '<span class="tag '+bandTone(p)+'">'+band(p)+'</span>'; }

function sectionTable(title,statsArr){
  let h='<div class="panel" style="margin-bottom:16px"><div class="panel-title" style="margin-bottom:12px">'+title+'</div>';
  h+='<div class="table-wrap"><table style="min-width:720px"><thead><tr>'+
     '<th style="width:44px">ข้อ</th><th>หัวข้อประเมิน</th>'+
     SCALE.map(o=>'<th class="nowrap" style="text-align:center">'+gesc(o.label)+'</th>').join('')+
     '<th class="nowrap" style="text-align:center">ร้อยละ</th><th class="nowrap">ระดับ</th></tr></thead><tbody>';
  statsArr.forEach(s=>{
    h+='<tr><td style="text-align:center;font-weight:700">'+s.crit.no+'</td><td>'+gesc(s.crit.title)+
       (s.crit.sub?'<div class="mini">'+gesc(s.crit.sub)+'</div>':'')+'</td>'+
       SCALE.map(o=>'<td style="text-align:center">'+s.counts[o.value]+'</td>').join('')+
       '<td style="text-align:center;font-weight:800;color:'+bandColor(s.pct)+'">'+f2(s.pct)+'</td>'+
       '<td>'+tag(s.pct)+'</td></tr>';
  });
  h+='</tbody></table></div></div>';
  return h;
}
function mountChart(id,cv){ const host=g$(id); if(host){ cv.style.maxWidth='100%'; cv.style.width='100%'; cv.style.border='1px solid var(--line)'; cv.style.borderRadius='10px'; host.innerHTML=''; host.appendChild(cv); } }

async function renderDashboard(){
  const c=g$('content'); c.innerHTML=LOADING;
  await ensure();
  const months=monthsAvailable();
  const rs=rowsInPeriod();
  const s=summarize(rs);
  const perLabel = period==='all' ? 'ทั้งหมด' : monthLabel(period);
  let h='';
  // toolbar ช่วงเวลา
  h+='<div class="toolbar"><label class="mini" style="font-weight:700;color:var(--navy)">ช่วงข้อมูล</label>'+
     '<select class="input" style="width:auto;min-width:180px" onchange="appsPeriodChange(this.value)">'+
     '<option value="all"'+(period==='all'?' selected':'')+'>ทั้งหมด</option>'+
     months.map(m=>'<option value="'+m+'"'+(period===m?' selected':'')+'>'+monthLabel(m)+'</option>').join('')+
     '</select><span class="mini">'+s.n+' รายการ</span>'+
     '<button class="btn" style="margin-left:auto" onclick="appsRefresh()">รีเฟรช</button>'+
     '<button class="btn" onclick="openAppsReport()">รายงาน DOCX</button></div>';
  // KPI
  h+='<div class="grid stats">'+
     kpi('ผู้ประเมิน',String(s.n),'ราย ('+perLabel+')','var(--navy)')+
     kpi('ส่วนที่ 1 (เจ้าหน้าที่)',f2(s.sec1Pct)+'%',band(s.sec1Pct),bandColor(s.sec1Pct))+
     kpi('ส่วนที่ 2 (ระบบ/Service Desk)',f2(s.sec2Pct)+'%',band(s.sec2Pct),bandColor(s.sec2Pct))+
     kpi('ภาพรวมทั้งหมด',f2(s.overallPct)+'%',band(s.overallPct),bandColor(s.overallPct))+
     '</div>';
  if(!s.n){ c.innerHTML=h+'<div class="panel"><div class="empty">ยังไม่มีข้อมูลการประเมินในช่วงนี้</div></div>'; return; }
  // ระยะเวลาการใช้งาน
  h+='<div class="panel" style="margin-bottom:16px"><div class="panel-title" style="margin-bottom:10px">ระยะเวลาการใช้งานระบบ APPS ของผู้ประเมิน</div>'+
     '<div id="appsChartDur" style="text-align:center"></div>'+
     '<div class="mini" style="margin-top:8px">'+DURATIONS.map(d=>gesc(d)+': <b>'+(s.durCounts[d]||0)+'</b> ราย').join(' · ')+'</div></div>';
  // ส่วนที่ 1
  h+='<div class="panel" style="margin-bottom:16px"><div class="panel-title">จำนวนตามความพึงพอใจ — ส่วนที่ 1</div><div id="appsChartS1c" style="text-align:center;margin-top:8px"></div></div>';
  h+=sectionTable('ร้อยละความพึงพอใจ — ส่วนที่ 1 : เจ้าหน้าที่ที่ให้การสนับสนุน',s.sec1);
  h+='<div class="panel" style="margin-bottom:16px"><div id="appsChartS1p" style="text-align:center"></div></div>';
  // ส่วนที่ 2
  h+='<div class="panel" style="margin-bottom:16px"><div class="panel-title">จำนวนตามความพึงพอใจ — ส่วนที่ 2</div><div id="appsChartS2c" style="text-align:center;margin-top:8px"></div></div>';
  h+=sectionTable('ร้อยละความพึงพอใจ — ส่วนที่ 2 : ระบบ APPS และศูนย์บริการ (Service Desk)',s.sec2);
  h+='<div class="panel" style="margin-bottom:16px"><div id="appsChartS2p" style="text-align:center"></div></div>';
  // ข้อเสนอแนะ
  h+='<div class="panel"><div class="panel-title" style="margin-bottom:10px">ส่วนที่ 3 : ข้อเสนอแนะเพิ่มเติม ('+s.sug.length+')</div>';
  if(s.sug.length) h+='<div class="insight">'+s.sug.map(x=>'<div class="insight-card"><b>'+gesc(x.agency)+'</b>'+gesc(x.text)+'</div>').join('')+'</div>';
  else h+='<div class="mini">— ไม่มี —</div>';
  h+='</div>';
  c.innerHTML=h;
  mountChart('appsChartDur',chartDuration(s.durCounts));
  mountChart('appsChartS1c',chartCounts(s.sec1));
  mountChart('appsChartS1p',chartPct(s.sec1));
  mountChart('appsChartS2c',chartCounts(s.sec2));
  mountChart('appsChartS2p',chartPct(s.sec2));
}

async function renderList(){
  const c=g$('content'); c.innerHTML=LOADING;
  await ensure();
  const q=(filter||'').trim().toLowerCase();
  const rs=rows.filter(r=>{ if(!q)return true; return [r.agency,r.airport,r.duration,r.suggestion].some(x=>String(x||'').toLowerCase().indexOf(q)>=0); });
  let h='<div class="toolbar"><input class="input search" value="'+gesc(filter)+'" oninput="appsListSearch(this.value)" placeholder="ค้นหา หน่วยงาน / ท่าอากาศยาน / ข้อเสนอแนะ">'+
        '<span class="mini">'+rs.length+' รายการ</span>'+
        '<button class="btn" style="margin-left:auto" onclick="appsRefresh()">รีเฟรช</button>'+
        '<button class="btn" onclick="appsImportCsv()">นำเข้า CSV</button>'+
        '<button class="btn" onclick="appsExportCsv()">ส่งออก CSV</button></div>';
  h+='<div class="table-wrap"><table style="min-width:1000px"><thead><tr>'+
     '<th class="nowrap">เวลา</th><th>หน่วยงาน</th><th>ท่าอากาศยาน</th><th class="nowrap">ระยะเวลาใช้งาน</th>'+
     '<th class="nowrap" style="text-align:center">ส่วนที่ 1</th><th class="nowrap" style="text-align:center">ส่วนที่ 2</th>'+
     '<th class="nowrap" style="text-align:center">รวม</th><th>ข้อเสนอแนะ</th><th></th></tr></thead><tbody>';
  if(!rs.length) h+='<tr><td colspan="9"><div class="empty">ไม่มีข้อมูล</div></td></tr>';
  rs.forEach(r=>{
    const s1=summarize([r]).sec1Pct, s2=summarize([r]).sec2Pct, all=summarize([r]).overallPct;
    h+='<tr><td class="nowrap mini">'+gesc(fmtTime(r.created_at))+'</td><td>'+gesc(r.agency)+'</td><td>'+gesc(r.airport)+'</td><td class="nowrap">'+gesc(r.duration)+'</td>'+
       '<td style="text-align:center;color:'+bandColor(s1)+';font-weight:700">'+f2(s1)+'</td>'+
       '<td style="text-align:center;color:'+bandColor(s2)+';font-weight:700">'+f2(s2)+'</td>'+
       '<td style="text-align:center;font-weight:800;color:'+bandColor(all)+'">'+f2(all)+'</td>'+
       '<td class="comment">'+gesc(r.suggestion||'')+'</td>'+
       '<td class="nowrap">'+(canDel()?'<button class="btn danger icon" title="ลบ" onclick="appsDeleteRow('+r.id+')">🗑</button>':'')+'</td></tr>';
  });
  h+='</tbody></table></div>';
  c.innerHTML=h;
}
function canDel(){ try{ return user && (user.isAdmin || can('delete_eval')); }catch(e){ return false; } }
function fmtTime(v){ try{ return new Date(v).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}); }catch(e){ return String(v||''); } }

async function deleteRow(id){
  if(!canDel()) return toast('คุณไม่มีสิทธิ์ลบข้อมูล',true);
  if(!confirm('ยืนยันลบรายการนี้?')) return;
  try{
    const {error}=await sb.from('apps_surveys').delete().eq('id',id);
    if(error) throw error;
    if(typeof logAction==='function') logAction('delete','apps_survey',String(id));
    rows=rows.filter(r=>r.id!==id); toast('ลบแล้ว'); renderList();
  }catch(e){ toast('ลบไม่สำเร็จ: '+((e&&e.message)||e),true); }
}

/* ============================================================
   รายงาน DOCX + ตัวอย่าง HTML + อีเมล
   ============================================================ */
let reportCtx=null;
function openReport(){
  const m=g$('appsReportModal'); if(!m){ toast('ไม่พบหน้าต่างรายงาน',true); return; }
  const now=new Date(), p2=n=>String(n).padStart(2,'0');
  g$('appsRptMonth').value=now.getFullYear()+'-'+p2(now.getMonth()+1);
  const t=now.getFullYear()+'-'+p2(now.getMonth()+1)+'-'+p2(now.getDate());
  g$('appsRptFrom').value=t; g$('appsRptTo').value=t;
  let yo=''; for(let y=now.getFullYear()+1;y>=now.getFullYear()-6;y--) yo+='<option value="'+y+'"'+(y===now.getFullYear()?' selected':'')+'>'+(y+543)+' ('+y+')</option>';
  g$('appsRptYear').innerHTML=yo;
  g$('appsRptType').value='month'; updateReportFields();
  m.classList.add('open');
}
function closeReport(){ const m=g$('appsReportModal'); if(m)m.classList.remove('open'); }
function updateReportFields(){ const t=g$('appsRptType').value; g$('appsRpt_day').classList.toggle('hidden',t!=='day'); g$('appsRpt_month').classList.toggle('hidden',t!=='month'); g$('appsRpt_year').classList.toggle('hidden',t!=='year'); }
function thaiDate(d){ return d.getDate()+' '+THAI_MONTHS[d.getMonth()]+' '+(d.getFullYear()+543); }
function computePeriod(){
  const t=g$('appsRptType').value; let start,end,word,label,suffix;
  if(t==='day'){
    const f=g$('appsRptFrom').value, to=g$('appsRptTo').value; if(!f||!to){ toast('เลือกช่วงวันที่ก่อน',true); return null; }
    let sa=new Date(f+'T00:00:00'), eb=new Date(to+'T00:00:00'); if(eb<sa){const x=sa;sa=eb;eb=x;}
    start=sa; end=new Date(eb.getTime()+86400000);
    if(sa.getTime()===eb.getTime()){ word='ประจำวันที่'; label=thaiDate(sa); } else { word='ระหว่างวันที่'; label=thaiDate(sa)+' ถึง '+thaiDate(eb); }
    suffix='Daily_'+f+(f===to?'':('_to_'+to));
  }else if(t==='month'){
    const m=g$('appsRptMonth').value; if(!m){ toast('เลือกเดือนก่อน',true); return null; }
    const a=m.split('-').map(Number); start=new Date(a[0],a[1]-1,1); end=new Date(a[0],a[1],1);
    word='ประจำเดือน'; label=THAI_MONTHS[a[1]-1]+' '+(a[0]+543); suffix='Monthly_'+m;
  }else{
    const y=Number(g$('appsRptYear').value); start=new Date(y,0,1); end=new Date(y+1,0,1);
    word='ประจำปี'; label='พ.ศ. '+(y+543); suffix='Year_'+y;
  }
  return {start,end,word,label,suffix};
}
function periodRows(start,end){ return rows.filter(r=>{const d=new Date(r.created_at); return d>=start && d<end;}); }

// ---- ตัวอย่าง HTML (พิมพ์/บันทึก PDF ได้) ----
function reportStyles(){
  return '<style>.rpt{box-sizing:border-box;font-family:"TH Sarabun New","Sarabun",Tahoma,sans-serif;color:#1f2937;font-size:16px;line-height:1.55;background:#fff;padding:18px}.rpt *{box-sizing:border-box}.rpt h1{color:#1749c4;font-size:23px;text-align:center;margin:0 0 4px}.rpt .sub{text-align:center;color:#374151;margin:0 0 14px;font-size:14px}.rpt h2{color:#0b2f6b;font-size:18px;border-bottom:2px solid #e8f0fc;padding-bottom:4px;margin:20px 0 8px}.rpt h3{color:#16438f;font-size:15px;margin:14px 0 6px}.rpt table{border-collapse:collapse;width:100%;margin:6px 0;font-size:13px;table-layout:fixed}.rpt th,.rpt td{border:1px solid #d0d7e5;padding:5px 7px;text-align:center;vertical-align:middle;word-break:break-word}.rpt td.l{text-align:left}.rpt thead th{background:#e8f0fc;color:#0b2f6b}.rpt img{max-width:100%;display:block;margin:8px auto}.rpt ul{margin:6px 0;padding-left:20px}.rpt .legend span{display:inline-flex;align-items:center;gap:6px;margin-right:16px;font-size:13px}.rpt .sw{width:13px;height:13px;border-radius:3px;display:inline-block}.rpt .kpis{display:flex;gap:10px;margin:10px 0}.rpt .kpi{flex:1;border:1px solid #dce5f2;border-radius:8px;padding:8px;text-align:center;background:#f8fbff}.rpt .kpi .n{font-size:20px;font-weight:700;color:#0b2f6b}body{margin:0}@media print{.noprint{display:none}}</style>';
}
function reportInner(start,end,word,label){
  const rs=periodRows(start,end), s=summarize(rs);
  const durUrl=chartDuration(s.durCounts).toDataURL('image/png');
  const s1cUrl=chartCounts(s.sec1).toDataURL('image/png');
  const s2cUrl=chartCounts(s.sec2).toDataURL('image/png');
  const s1pUrl=chartPct(s.sec1).toDataURL('image/png');
  const s2pUrl=chartPct(s.sec2).toDataURL('image/png');
  const legend='<div class="legend" style="margin:6px 0 4px">'+SCALE.map(o=>'<span><i class="sw" style="background:'+o.color+'"></i>'+gesc(o.label)+'</span>').join('')+'</div>';
  const countTable=(arr)=>'<table><thead><tr><th style="width:40px">ข้อ</th><th>หัวข้อ</th>'+SCALE.map(o=>'<th>'+gesc(o.label)+'</th>').join('')+'</tr></thead><tbody>'+
    arr.map(s=>'<tr><td>'+s.crit.no+'</td><td class="l">'+gesc(s.crit.title)+'</td>'+SCALE.map(o=>'<td>'+s.counts[o.value]+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  const pctTable=(arr)=>'<table><thead><tr><th style="width:40px">ข้อ</th><th>หัวข้อ</th><th style="width:90px">ร้อยละ</th><th style="width:120px">ระดับ</th></tr></thead><tbody>'+
    arr.map(s=>'<tr><td>'+s.crit.no+'</td><td class="l">'+gesc(s.crit.title)+'</td><td style="font-weight:700;color:'+bandColor(s.pct)+'">'+f2(s.pct)+'</td><td>'+band(s.pct)+'</td></tr>').join('')+'</tbody></table>';
  let h='<h1>สรุปผลการประเมินความพึงพอใจต่อการให้บริการระบบตรวจสอบและคัดกรองผู้โดยสารล่วงหน้า (APPS)</h1>';
  h+='<p class="sub">ผ่านเจ้าหน้าที่ Onsite Support '+gesc(word)+' '+gesc(label)+'</p>';
  h+='<p>ผู้ประเมินจำนวน <b>'+s.n+'</b> ท่าน โดยมีระยะเวลาการใช้งานระบบ APPS ของผู้ประเมินดังนี้</p>';
  h+='<ul>'+DURATIONS.map(d=>'<li>'+gesc(d)+' จำนวน <b>'+(s.durCounts[d]||0)+'</b> ท่าน</li>').join('')+'</ul>';
  h+='<h3>หลักเกณฑ์คะแนน</h3><ul style="list-style:none;padding-left:0">'+
     '<li><i class="sw" style="background:#2563eb"></i> คะแนนร้อยละ 80-100 = ดีเยี่ยม</li>'+
     '<li><i class="sw" style="background:#22c55e"></i> คะแนนร้อยละ 60-79 = ดี</li>'+
     '<li><i class="sw" style="background:#f59e0b"></i> คะแนนร้อยละ 40-59 = ปานกลาง</li>'+
     '<li><i class="sw" style="background:#ef4444"></i> คะแนนร้อยละ 0-39 = ควรปรับปรุง</li></ul>';
  h+='<h2>1. ระยะเวลาการใช้งานระบบ APPS ของผู้ประเมิน</h2><img src="'+durUrl+'" style="max-width:520px">';
  h+='<h2>2. แสดงจำนวนตามความพึงพอใจ</h2>';
  h+='<h3>ส่วนที่ 1 : เจ้าหน้าที่ที่ให้การสนับสนุนการใช้งานระบบประจำท่าอากาศยาน</h3>'+legend+'<img src="'+s1cUrl+'">'+countTable(s.sec1);
  h+='<h3>ส่วนที่ 2 : ความพึงพอใจในการใช้งานระบบ APPS และศูนย์บริการ (Service Desk)</h3>'+legend+'<img src="'+s2cUrl+'">'+countTable(s.sec2);
  h+='<h2>3. แสดงร้อยละของความพึงพอใจ</h2>';
  h+='<h3>ส่วนที่ 1 : เจ้าหน้าที่ที่ให้การสนับสนุนการใช้งานระบบประจำท่าอากาศยาน</h3><img src="'+s1pUrl+'">'+pctTable(s.sec1);
  h+='<h3>ส่วนที่ 2 : ความพึงพอใจในการใช้งานระบบ APPS และศูนย์บริการ (Service Desk)</h3><img src="'+s2pUrl+'">'+pctTable(s.sec2);
  h+='<h2>ส่วนที่ 3 : ข้อเสนอแนะเพิ่มเติม</h2>';
  h+=s.sug.length?('<ul>'+s.sug.map(x=>'<li><b>'+gesc(x.agency)+'</b> — '+gesc(x.text)+'</li>').join('')+'</ul>'):'<p>- ไม่มี</p>';
  return h;
}
async function preview(){
  const p=computePeriod(); if(!p) return;
  await ensure();
  const w=window.open('','_blank'); if(!w) return toast('เบราว์เซอร์บล็อก popup',true);
  w.document.write('<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>ตัวอย่างรายงาน APPS</title>'+reportStyles()+'</head><body><div class="rpt" style="max-width:820px;margin:0 auto">'+reportInner(p.start,p.end,p.word,p.label)+'<div class="noprint" style="text-align:center;margin:22px 0"><button onclick="window.print()" style="padding:10px 22px;font-size:15px;background:#2563eb;color:#fff;border:0;border-radius:8px;cursor:pointer">🖨 พิมพ์ / บันทึกเป็น PDF</button></div></div></body></html>');
  w.document.close();
}

// ---- DOCX ----
function dImg(relId,wpx,hpx,id){
  const cx=Math.round(wpx*9525), cy=Math.round(hpx*9525);
  return '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="120"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="'+id+'" name="img'+id+'"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="'+id+'" name="img'+id+'.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="'+relId+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}
async function buildDocxBlob(start,end,word,label){
  if(typeof JSZip==='undefined'){ toast('โหลด JSZip ไม่สำเร็จ',true); return null; }
  const rs=periodRows(start,end), s=summarize(rs), now=new Date();
  const media=[]; // {rel,name,bytes,w,h,id}
  const addChart=(cv)=>{ const id=media.length+1; const rel='rIdImg'+id, name='chart'+id+'.png'; media.push({rel,name,bytes:canvasBytes(cv),w:cv.width,h:cv.height,id}); return media[media.length-1]; };
  const durC=addChart(chartDuration(s.durCounts));
  const s1cC=addChart(chartCounts(s.sec1)), s2cC=addChart(chartCounts(s.sec2));
  const s1pC=addChart(chartPct(s.sec1)),   s2pC=addChart(chartPct(s.sec2));
  const scaleW=(m,maxpx)=>{ const w=Math.min(m.w,maxpx); return {w,h:Math.round(m.h*w/m.w)}; };
  const img=(m,maxpx)=>{ const d=scaleW(m,maxpx||560); return dImg(m.rel,d.w,d.h,m.id); };

  let body='';
  body+=dPar('สรุปผลการประเมินความพึงพอใจต่อการให้บริการระบบตรวจสอบและคัดกรองผู้โดยสารล่วงหน้า (APPS)',{sz:30,bold:true,color:'111827',align:'center',after:40});
  body+=dPar('ผ่านเจ้าหน้าที่ Onsite Support '+word+' '+label,{sz:22,color:'374151',align:'center',after:160});
  body+=dPar('ผู้ประเมินจำนวน '+s.n+' ท่าน โดยมีระยะเวลาการใช้งานระบบ APPS ของผู้ประเมินดังนี้',{sz:22,after:40});
  DURATIONS.forEach(d=>{ body+=dPar('•  '+d+'   จำนวน '+(s.durCounts[d]||0)+' ท่าน',{sz:22,indent:360,after:20}); });
  body+=dHeading('หลักเกณฑ์คะแนน');
  body+=dPar('คะแนนร้อยละ 80-100 = ดีเยี่ยม   ·   60-79 = ดี   ·   40-59 = ปานกลาง   ·   0-39 = ควรปรับปรุง',{sz:22,fill:'F4F6F9',after:60});
  body+=dTable([['รอบรายงาน',label],['วันที่จัดทำ',now.toLocaleString('th-TH')],['จัดทำโดย',(user&&(user.displayName||user.email))||'-'],['แหล่งข้อมูล','OSO Evaluation — APPS Survey (Supabase)']],[2600,6400],'F2F7FF');

  body+=dHeading('1. ระยะเวลาการใช้งานระบบ APPS ของผู้ประเมิน');
  body+=img(durC,470);
  body+=dHeading('2. แสดงจำนวนตามความพึงพอใจ');
  body+=dPar('ส่วนที่ 1 : เจ้าหน้าที่ที่ให้การสนับสนุนการใช้งานระบบประจำท่าอากาศยาน',{sz:22,bold:true,color:'16438f',before:60,after:40});
  body+=img(s1cC,560);
  body+=countTableDocx(s.sec1);
  body+=dPar('ส่วนที่ 2 : ความพึงพอใจในการใช้งานระบบ APPS และศูนย์บริการ (Service Desk)',{sz:22,bold:true,color:'16438f',before:120,after:40});
  body+=img(s2cC,560);
  body+=countTableDocx(s.sec2);

  body+=dHeading('3. แสดงร้อยละของความพึงพอใจ');
  body+=dPar('ส่วนที่ 1 : เจ้าหน้าที่ที่ให้การสนับสนุนการใช้งานระบบประจำท่าอากาศยาน',{sz:22,bold:true,color:'16438f',before:60,after:40});
  body+=img(s1pC,540);
  body+=pctTableDocx(s.sec1);
  body+=dPar('ส่วนที่ 2 : ความพึงพอใจในการใช้งานระบบ APPS และศูนย์บริการ (Service Desk)',{sz:22,bold:true,color:'16438f',before:120,after:40});
  body+=img(s2pC,540);
  body+=pctTableDocx(s.sec2);

  body+=dHeading('ส่วนที่ 3 : ข้อเสนอแนะเพิ่มเติม');
  if(s.sug.length) s.sug.forEach(x=>{ body+=dPar(x.agency,{sz:18,bold:true,color:'0b2f6b',before:60,after:20}); body+=dPar(x.text,{sz:22,fill:'F4F6F9'}); });
  else body+=dPar('- ไม่มี',{sz:22,color:'6a7d9b'});

  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const drels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+media.map(m=>'<Relationship Id="'+m.rel+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/'+m.name+'"/>').join('')+'</Relationships>';
  const docXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr></w:body></w:document>';
  const zip=new JSZip();
  zip.file('[Content_Types].xml',ct);
  zip.folder('_rels').file('.rels',rels);
  const wordDir=zip.folder('word'); wordDir.file('document.xml',docXml); wordDir.folder('_rels').file('document.xml.rels',drels);
  const wm=wordDir.folder('media'); media.forEach(m=>wm.file(m.name,m.bytes));
  return await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
function countTableDocx(arr){
  const head=['ข้อ','หัวข้อประเมิน'].concat(SCALE.map(o=>o.label));
  const body=arr.map(s=>[String(s.crit.no),s.crit.title].concat(SCALE.map(o=>String(s.counts[o.value]))));
  return dTable([head].concat(body),[700,4300,1200,1200,1200,1200]);
}
function pctTableDocx(arr){
  const head=['ข้อ','หัวข้อประเมิน','ร้อยละ','ระดับ'];
  const body=arr.map(s=>[String(s.crit.no),s.crit.title,f2(s.pct),band(s.pct)]);
  return dTable([head].concat(body),[700,5300,1500,1500]);
}
async function makeReport(){
  const p=computePeriod(); if(!p) return;
  await ensure();
  closeReport(); toast('กำลังสร้าง DOCX...');
  const blob=await buildDocxBlob(p.start,p.end,p.word,p.label); if(!blob) return;
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='APPS_Survey_'+p.suffix+'.docx'; a.click();
  toast('สร้างรายงาน DOCX แล้ว');
  if(typeof logAction==='function') logAction('report','apps_survey',p.label);
}
async function emailReport(){
  const p=computePeriod(); if(!p) return;
  const list=(g$('appsRptEmail').value||'').normalize('NFKC').replace(/[^\x21-\x7E]/g,'').toLowerCase().split(/[,;]+/).map(s=>s.trim()).filter(Boolean);
  const re=/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
  if(!list.length||!list.every(e=>re.test(e))) return toast('อีเมลผู้รับไม่ถูกต้อง: '+(list.join(', ')||'(ว่าง)'),true);
  if(typeof callFn!=='function') return toast('ระบบส่งอีเมลไม่พร้อมใช้งาน',true);
  await ensure(); toast('กำลังสร้าง/ส่งรายงาน...');
  try{
    const blob=await buildDocxBlob(p.start,p.end,p.word,p.label); if(!blob) return toast('สร้าง DOCX ไม่สำเร็จ',true);
    const b64=await blobToB64(blob); if(!b64) return toast('แปลงไฟล์ไม่สำเร็จ',true);
    const s=summarize(periodRows(p.start,p.end));
    const signer=(user&&(user.displayName||user.email))||'';
    const subject='สรุปผลประเมินความพึงพอใจระบบ APPS '+p.word+' '+p.label;
    const msg='เรียน ผู้เกี่ยวข้อง\n\nสรุปผลการประเมินความพึงพอใจต่อการให้บริการระบบ APPS ผ่านเจ้าหน้าที่ Onsite Support '+p.word+' '+p.label+'\n'+
      '• จำนวนผู้ประเมิน: '+s.n+' ท่าน\n'+
      '• ส่วนที่ 1 (เจ้าหน้าที่สนับสนุน): '+f2(s.sec1Pct)+'% (ระดับ '+band(s.sec1Pct)+')\n'+
      '• ส่วนที่ 2 (ระบบ/Service Desk): '+f2(s.sec2Pct)+'% (ระดับ '+band(s.sec2Pct)+')\n'+
      '• ภาพรวม: '+f2(s.overallPct)+'% (ระดับ '+band(s.overallPct)+')\n'+
      '\nรายละเอียดทั้งหมดอยู่ในไฟล์ DOCX ที่แนบมาพร้อมอีเมลนี้\n\nขอแสดงความนับถือ\n'+signer;
    const r=await callFn('send-report',{to:list.join(','),subject:subject,attachments:[{content:b64,name:'APPS_Survey_'+p.suffix+'.docx'}],message:msg});
    if(r.error) return toast('ส่งไม่สำเร็จ: '+r.error,true);
    if(typeof logAction==='function') logAction('email','apps_survey',list.join(',')+' / '+p.label);
    toast('ส่งอีเมลแล้ว → '+list.join(', ')); closeReport();
  }catch(e){ toast('สร้าง/ส่งรายงานไม่สำเร็จ: '+((e&&e.message)||e),true); }
}
function runReport(action){ if(action==='preview')return preview(); if(action==='email')return emailReport(); return makeReport(); }

/* ============================================================
   CSV — ส่งออก / นำเข้า (รองรับไฟล์ Export จาก Google Forms)
   ============================================================ */
function csvCell(v){ v=String(v==null?'':v); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }
function exportCsv(){
  const head=['created_at','agency','airport','duration'].concat(SEC1.map(c=>c.key)).concat(SEC2.map(c=>c.key)).concat(['suggestion']);
  const lines=[head.join(',')];
  rows.forEach(r=>lines.push(head.map(k=>csvCell(r[k])).join(',')));
  const blob=new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='APPS_Survey_export.csv'; a.click();
  toast('ส่งออก CSV แล้ว ('+rows.length+' รายการ)');
}
// parser CSV มาตรฐาน (รองรับ quote/คอมมา/ขึ้นบรรทัดใน field)
function parseCsv(text){
  const out=[]; let row=[], cur='', q=false;
  text=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  for(let i=0;i<text.length;i++){ const ch=text[i];
    if(q){ if(ch==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; }
    else { if(ch==='"')q=true; else if(ch===','){row.push(cur);cur='';} else if(ch==='\n'){row.push(cur);out.push(row);row=[];cur='';} else cur+=ch; }
  }
  if(cur!==''||row.length){ row.push(cur); out.push(row); }
  return out.filter(r=>r.length && r.some(c=>String(c).trim()!==''));
}
function parseThaiDate(v){
  if(!v) return new Date();
  // Google Forms: M/D/YYYY H:MM:SS
  const m=String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if(m){ let y=Number(m[3]); if(y>2400)y-=543; return new Date(y,Number(m[1])-1,Number(m[2]),Number(m[4]),Number(m[5]),Number(m[6]||0)); }
  const d=new Date(v); return isNaN(d)?new Date():d;
}
function toScore(v){ const t=String(v||'').trim(); if(SCALE_MAP[t]!=null)return SCALE_MAP[t]; const n=Number(t); return (n>=1&&n<=4)?n:null; }
function importCsv(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.csv,text/csv';
  inp.onchange=async()=>{
    const file=inp.files&&inp.files[0]; if(!file) return;
    const text=await file.text();
    let grid=parseCsv(text); if(!grid.length) return toast('ไฟล์ว่างหรืออ่านไม่ได้',true);
    // ตรวจ header: ถ้าแถวแรกไม่ใช่คะแนน ให้ถือเป็น header แล้วข้าม
    const looksHeader=r=>{ const c=(r[0]||'').toLowerCase(); return c.indexOf('timestamp')>=0 || c.indexOf('เวลา')>=0 || c.indexOf('created')>=0; };
    if(looksHeader(grid[0])) grid=grid.slice(1);
    // แม็ปคอลัมน์ตามลำดับ Google Forms: [Timestamp, หน่วยงาน, ท่าอากาศยาน, ระยะเวลา, s1×3, s2×7, ข้อเสนอแนะ]
    const recs=[]; let bad=0;
    grid.forEach(r=>{
      const created=parseThaiDate(r[0]);
      const agency=(r[1]||'').trim(), airport=(r[2]||'').trim(), duration=(r[3]||'').trim();
      const scores=[]; let ok=true;
      for(let k=0;k<10;k++){ const sc=toScore(r[4+k]); if(sc==null){ok=false;break;} scores.push(sc); }
      if(!agency||!airport||!duration||!ok){ bad++; return; }
      const rec={created_at:created.toISOString(),agency,airport,duration,suggestion:(r[14]||'').trim()||null};
      SEC1.forEach((c,i)=>rec[c.key]=scores[i]); SEC2.forEach((c,i)=>rec[c.key]=scores[3+i]);
      recs.push(rec);
    });
    if(!recs.length) return toast('ไม่พบข้อมูลที่นำเข้าได้ (ข้าม '+bad+' แถว) — ตรวจลำดับคอลัมน์ให้ตรงกับ Google Forms',true);
    // dedup กับข้อมูลเดิม (เทียบทุกช่อง ไม่รวมเวลา เพราะเวลา import อาจต่างเสี้ยววินาที) — ใช้ key รวมเวลาแบบนาที
    const keyOf=x=>[new Date(x.created_at).toISOString().slice(0,16),x.agency.trim(),x.airport.trim(),x.duration.trim(),SEC1.concat(SEC2).map(c=>x[c.key]).join('/'),String(x.suggestion||'').trim()].join('||');
    const existing=new Set(rows.map(keyOf)); const seen=new Set();
    const fresh=recs.filter(x=>{ const k=keyOf(x); if(existing.has(k)||seen.has(k))return false; seen.add(k); return true; });
    if(!fresh.length) return toast('ทุกรายการซ้ำกับข้อมูลเดิม ('+recs.length+' แถว) ไม่มีการเพิ่ม',true);
    if(!confirm('นำเข้า '+fresh.length+' รายการ (ข้ามซ้ำ '+(recs.length-fresh.length)+', ข้ามไม่สมบูรณ์ '+bad+') ยืนยันหรือไม่?')) return;
    toast('กำลังนำเข้า...');
    let done=0,failNo=0;
    // แทรกทีละแถว ทนต่อ conflict unique index (23505)
    for(const rec of fresh){ try{ const {error}=await sb.from('apps_surveys').insert(rec); if(error){ if(String(error.code)==='23505'){/*ซ้ำ*/} else failNo++; } else done++; }catch(e){ failNo++; } }
    if(typeof logAction==='function') logAction('import','apps_survey',done+' rows');
    loaded=false; await ensure(true);
    toast('นำเข้าสำเร็จ '+done+' รายการ'+(failNo?(' · ผิดพลาด '+failNo):''));
    if(view==='apps_list') renderList(); else if(view==='apps_dashboard') renderDashboard();
  };
  inp.click();
}

/* ============================================================
   เชื่อมต่อกับ app.js — ครอบ render() และ showPublic()
   ============================================================ */
const VIEWS={ apps_dashboard:{title:'แดชบอร์ด APPS (Service Desk)', fn:renderDashboard},
              apps_list:     {title:'รายการประเมิน APPS',           fn:renderList} };
const _render=window.render;
window.render=function(){
  const v=view;
  if(VIEWS[v]){ const pt=g$('pageTitle'); if(pt)pt.textContent=VIEWS[v].title; VIEWS[v].fn(); return; }
  return _render.apply(this,arguments);
};
let deepApplied=false;
const _showPublic=window.showPublic;
window.showPublic=function(){
  _showPublic.apply(this,arguments);
  const host=g$('appsFormHost'); if(host) host.classList.add('hidden');
  const on=document.querySelector('[data-pubtab="onsite"]');
  if(on){ document.querySelectorAll('[data-pubtab]').forEach(b=>b.classList.remove('active')); on.classList.add('active'); }
  applyBanner('onsite');
  // ---- deep link จาก QR: ?form=apps / ?form=onsite → เข้าฟอร์มนั้นทันที + ซ่อนแท็บ กันสับสน (ทำครั้งเดียวตอนโหลด) ----
  if(!deepApplied){
    deepApplied=true;
    let f='';
    try{ const p=new URLSearchParams(location.search); f=(p.get('form')||p.get('survey')||'').toLowerCase(); }catch(e){}
    if(f==='apps'||f==='app'||f==='service'||f==='onsite'||f==='staff'){
      const bar=g$('pubSwitchBar'); if(bar) bar.style.display='none';   // ล็อกฟอร์มเดียว
      pubSwitch((f==='apps'||f==='app'||f==='service')?'apps':'onsite');
    }
  }
};

/* ============================================================
   QR Code — สร้างลิงก์แยกแต่ละแบบประเมิน (สแกนแล้วเข้าฟอร์มตรง)
   ============================================================ */
function baseUrl(){ return location.origin + location.pathname; }
function linkFor(which){ return baseUrl() + '?form=' + (which==='apps'?'apps':'onsite'); }
function renderQrInto(elId, url){
  const el=g$(elId); if(!el) return;
  el.innerHTML='';
  if(typeof QRCode==='undefined'){ el.innerHTML='<div class="mini" style="color:#b91c1c">โหลดไลบรารี QR ไม่สำเร็จ (ตรวจอินเทอร์เน็ต)</div>'; return; }
  try{ new QRCode(el, {text:url, width:200, height:200, correctLevel:QRCode.CorrectLevel.M}); }
  catch(e){ el.innerHTML='<div class="mini">สร้าง QR ไม่สำเร็จ</div>'; }
}
function openQr(){
  const m=g$('qrModal'); if(!m) return;
  const lo=linkFor('onsite'), la=linkFor('apps');
  g$('qrUrlOnsite').textContent=lo; g$('qrUrlApps').textContent=la;
  renderQrInto('qrOnsite',lo); renderQrInto('qrApps',la);
  m.classList.add('open');
}
function closeQr(){ const m=g$('qrModal'); if(m)m.classList.remove('open'); }
function qrDataUrl(which){
  const box=g$(which==='apps'?'qrApps':'qrOnsite'); if(!box) return null;
  const img=box.querySelector('img'); if(img&&img.src) return img.src;
  const cv=box.querySelector('canvas'); if(cv) return cv.toDataURL('image/png');
  return null;
}
function copyQrLink(which){
  const url=linkFor(which);
  const done=()=>toast('คัดลอกลิงก์แล้ว');
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(done,()=>toast(url)); return; } }catch(e){}
  window.prompt('คัดลอกลิงก์นี้:', url);
}
function downloadQrImg(which){
  const d=qrDataUrl(which); if(!d) return toast('ยังไม่มีรูป QR',true);
  const a=document.createElement('a'); a.href=d; a.download=(which==='apps'?'QR_APPS_Survey':'QR_Onsite_Eval')+'.png'; a.click();
}
function printQr(){
  const lo=linkFor('onsite'), la=linkFor('apps');
  const io=qrDataUrl('onsite'), ia=qrDataUrl('apps');
  const w=window.open('','_blank'); if(!w) return toast('เบราว์เซอร์บล็อก popup',true);
  const card=(title,img,url)=>'<div style="border:1px solid #ccc;border-radius:14px;padding:22px;text-align:center;width:320px"><div style="font-size:19px;font-weight:800;color:#0b2f6b;margin-bottom:14px;min-height:52px">'+title+'</div>'+(img?'<img src="'+img+'" style="width:240px;height:240px">':'<div>ไม่มี QR</div>')+'<div style="font-size:12px;color:#555;margin-top:12px;word-break:break-all">'+url+'</div><div style="margin-top:10px;font-size:14px">สแกนเพื่อทำแบบประเมิน</div></div>';
  w.document.write('<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>QR แบบประเมิน OSO</title><style>body{font-family:"Sarabun",Tahoma,sans-serif;margin:0;padding:28px;display:flex;gap:26px;flex-wrap:wrap;justify-content:center}@media print{.np{display:none}}</style></head><body>'+card('แบบประเมิน<br>เจ้าหน้าที่ Onsite Support',io,lo)+card('แบบประเมินความพึงพอใจ<br>ระบบ APPS',ia,la)+'<div class="np" style="width:100%;text-align:center;margin-top:18px"><button onclick="window.print()" style="padding:10px 22px;font-size:15px;background:#2563eb;color:#fff;border:0;border-radius:8px;cursor:pointer">🖨 พิมพ์</button></div></body></html>');
  w.document.close();
}

/* ---------- export handlers ให้ onclick เรียกได้ ---------- */
window.appsPick=pick;
window.appsSubmit=submitPublic;
window.appsResetPublic=resetPublic;
window.pubSwitch=pubSwitch;
window.appsPeriodChange=function(v){ period=v; renderDashboard(); };
window.appsRefresh=async function(){ await ensure(true); (view==='apps_list'?renderList:renderDashboard)(); toast('อัปเดตข้อมูลแล้ว'); };
window.appsListSearch=function(v){ filter=v; renderList(); };
window.appsDeleteRow=deleteRow;
window.openAppsReport=openReport;
window.closeAppsReport=closeReport;
window.appsUpdateReportFields=updateReportFields;
window.appsRunReport=runReport;
window.appsImportCsv=importCsv;
window.appsExportCsv=exportCsv;
window.appsRenderPublicForm=renderPublicForm;
window.openQrModal=openQr;
window.closeQrModal=closeQr;
window.copyQr=copyQrLink;
window.downloadQr=downloadQrImg;
window.printQr=printQr;

})();
