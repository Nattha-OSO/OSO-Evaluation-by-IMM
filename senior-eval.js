/* ============================================================
   senior-eval.js — แบบประเมินเจ้าหน้าที่ Onsite Support โดย Senior
     • หน้าสาธารณะ  ?form=senior  (+ แท็บในหน้าแบบประเมิน + QR)
     • เมนู senior_list  รายการประเมิน Senior (ค้นหา · ลบ · ส่งออก CSV)
     • window.seniorApi  ให้ summary-report.js ทำหน้า/รายงานสรุป (sum_senior)
   ตาราง: senior_evaluations, senior_names  (ดู schema-senior-eval.sql)
   เกณฑ์ระดับ 1-5 เหมือนแบบประเมิน Onsite เดิม (ใช้ scoreOptions / LABEL_MAP / scoreColor จาก app.js)
   ไม่แก้ตรรกะเดิม — ครอบ pubSwitch / showPublic / render / openQrModal / printQr  (ต้องโหลดหลัง apps-survey.js)
   ============================================================ */
(function(){
'use strict';

const SCRITERIA = [
  {key:'troubleshooting', no:1, shortTitle:'วิเคราะห์ปัญหา', title:'การวิเคราะห์และแก้ไขปัญหา (Troubleshooting Skill)', color:'#0ea5e9',
   desc:'ความสามารถในการเข้าใจปัญหาอย่างเป็นระบบ ตั้งแต่การรับข้อมูล การตั้งสมมติฐาน ไปจนถึงการหาสาเหตุที่แท้จริง (Root Cause)',
   points:['ซักถามข้อมูลเพิ่มเติมได้ตรงจุด','วิเคราะห์ปัญหาเป็นขั้นตอน ไม่ข้ามขั้น','แยกแยะอาการ (Symptom) กับสาเหตุ (Cause) ได้','เลือกแนวทางแก้ไขที่เหมาะสมกับสถานการณ์','มีการทดสอบหรือยืนยันผลหลังแก้ไข']},
  {key:'accuracy', no:2, shortTitle:'ความถูกต้องแก้ไข', title:'ความถูกต้องของการแก้ไขปัญหา', color:'#2563eb',
   desc:'ความแม่นยำของวิธีการแก้ไข และผลลัพธ์ที่ได้',
   points:['แก้ไขปัญหาได้ตรงจุด ไม่ใช่แค่แก้ปลายเหตุ','ไม่ก่อให้เกิดปัญหาใหม่ (No Side Effect)','ใช้มาตรฐานหรือ Best Practice ขององค์กร','ผลลัพธ์หลังแก้ไขสามารถใช้งานได้จริง','มีการตรวจสอบความถูกต้องก่อนส่งมอบงาน']},
  {key:'communication', no:3, shortTitle:'การสื่อสาร', title:'การสื่อสารกับเจ้าหน้าที่ผู้ใช้งาน', color:'#06b6d4',
   desc:'ความสามารถในการถ่ายทอดข้อมูลให้ผู้ใช้งานเข้าใจ และสร้างความมั่นใจ',
   points:['อธิบายปัญหาและวิธีแก้ไขเป็นภาษาที่เข้าใจง่าย','เลือกใช้คำพูดเหมาะสมกับระดับผู้ใช้งาน (Technical / Non-technical)','มีการอัปเดตสถานะงานอย่างสม่ำเสมอ','รับฟังและตอบคำถามผู้ใช้งานอย่างครบถ้วน','สื่อสารอย่างชัดเจน ไม่กำกวม']},
  {key:'service_mind', no:4, shortTitle:'มารยาทบริการ', title:'มารยาทและการให้บริการ (Service Mind)', color:'#14b8a6',
   desc:'ทัศนคติและพฤติกรรมในการให้บริการที่ดี',
   points:['สุภาพ เป็นมิตร และให้เกียรติผู้ใช้งาน','แสดงความตั้งใจช่วยเหลืออย่างเต็มที่','มีความอดทนต่อสถานการณ์กดดัน','ไม่แสดงอารมณ์เชิงลบหรือโต้เถียง','สร้างประสบการณ์ที่ดีให้ผู้ใช้งาน']},
  {key:'case_handling', no:5, shortTitle:'เปิด/ปิดเคส', title:'ความถูกต้องในการเปิด / ปิดเคส', color:'#8b5cf6',
   desc:'ความครบถ้วนของกระบวนการจัดการเคสตามมาตรฐาน',
   points:['บันทึกรายละเอียดเคสครบถ้วน (ปัญหา สาเหตุ วิธีแก้ไข)','ระบุหมวดหมู่/ประเภทเคสได้ถูกต้อง','อัปเดตสถานะเคสตามขั้นตอน','ปิดเคสเมื่อแก้ไขเสร็จและได้รับการยืนยันจากผู้ใช้งาน','มีหลักฐานหรือ Log ประกอบการปิดเคส']},
  {key:'housekeeping', no:6, shortTitle:'เอกสาร/ความสะอาด', title:'การจัดเก็บเอกสาร อุปกรณ์และการรักษาความสะอาด', color:'#f59e0b',
   desc:'ความสามารถในการจัดเก็บเอกสารและอุปกรณ์ที่เกี่ยวข้องกับงานให้เป็นระเบียบ ถูกต้อง และพร้อมใช้งาน รวมถึงการดูแลพื้นที่ปฏิบัติงานให้สะอาดและเหมาะสมต่อการใช้งาน',
   points:[]}
];
const TABLE='senior_evaluations';
let rows=[], recs=[], loaded=false, filter='';

/* ---------- ข้อมูล ---------- */
function toRec(r){
  const scores={}; SCRITERIA.forEach(c=>{ const v=Number(r[c.key]||0); scores[c.key]={value:v,label:LABEL_MAP[v]||''}; });
  const vals=SCRITERIA.map(c=>scores[c.key].value).filter(Number), avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
  return {rowNumber:r.id,id:r.id,timestampRaw:r.created_at,timestamp:fmtDateTime(r.created_at),evaluator:normName(r.senior),staff:normName(r.staff),scores,avg,band:scoreBand(avg),comment:r.comment||''};
}
async function ensure(force){
  if(!sb){ rows=[]; recs=[]; return; }
  if(loaded&&!force) return;
  try{
    let all=[], from=0;
    for(;;){   // PostgREST จำกัด 1000 แถวต่อครั้ง → โหลดเป็นหน้าๆ
      const {data,error}=await sb.from(TABLE).select('*').order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,from+999);
      if(error) throw error;
      all=all.concat(data||[]); if(!data||data.length<1000) break; from+=1000;
    }
    rows=all; recs=all.map(toRec); loaded=true;
  }catch(e){
    const m=String((e&&e.message)||e);
    toast(/relation|does not exist|schema cache/i.test(m)?'ยังไม่ได้สร้างตาราง senior_evaluations — รัน schema-senior-eval.sql ใน Supabase ก่อน':'โหลดข้อมูล Senior ไม่สำเร็จ: '+m,true);
    rows=rows||[]; recs=recs||[];
  }
}

/* ---------- หน้าสาธารณะ ---------- */
const sOpts=names=>'<option value="">— เลือกจากรายชื่อ —</option>'+(names||[]).map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('');
function critCard(c){
  return '<div class="pub-crit" data-scard="'+c.key+'" style="--c:'+c.color+'"><div class="pub-crit-head"><span class="pub-no">'+c.no+'</span><div class="pub-crit-title">'+esc(c.title)+'<span class="pub-req" title="จำเป็นต้องให้คะแนน">*</span><small>'+esc(c.desc)+'</small></div></div>'+
    (c.points.length?'<ul class="points">'+c.points.map(p=>'<li>'+esc(p)+'</li>').join('')+'</ul>':'')+
    '<div class="pub-seg">'+scoreOptions.map(o=>'<button type="button" style="--tone:'+scoreColor(o.value)+'" data-sk="'+c.key+'" data-value="'+o.value+'" onclick="seniorPick(this)">'+esc(o.label)+'</button>').join('')+'</div></div>';
}
function renderForm(){
  const host=$('seniorFormHost'); if(!host) return;
  host.innerHTML=
   '<div id="seniorForm">'+
     '<h2>แบบประเมินเจ้าหน้าที่ Onsite Support</h2>'+
     '<p class="pub-hint">สำหรับ Senior ผู้ควบคุมงาน — กรุณาให้คะแนนให้ครบทั้ง 6 หัวข้อ · ข้อเสนอแนะไม่บังคับ · ไม่ต้องเข้าสู่ระบบ</p>'+
     '<div class="pub-sec">ข้อมูลผู้ประเมิน</div>'+
     '<div class="form-grid">'+
       '<div class="field"><label class="label" for="senSenior">Senior ผู้ประเมิน<span class="pub-req">*</span></label><select class="input" id="senSenior">'+sOpts([])+'</select></div>'+
       '<div class="field"><label class="label" for="senStaff">เจ้าหน้าที่ Onsite Support ที่รับการประเมิน<span class="pub-req">*</span></label><select class="input" id="senStaff">'+sOpts([])+'</select></div>'+
     '</div>'+
     '<div class="pub-sec" style="margin-top:var(--sp5)">หัวข้อการประเมิน</div>'+
     '<div class="scale-legend"><b>เกณฑ์คะแนน</b>'+scoreOptions.slice().sort((a,b)=>a.value-b.value).map(o=>'<span><i style="background:'+scoreColor(o.value)+'"></i>'+o.value+' '+esc(o.label)+'</span>').join('')+'</div>'+
     '<div id="senCriteria" style="display:grid;gap:14px">'+SCRITERIA.map(critCard).join('')+'</div>'+
     '<div class="field" style="margin-top:16px"><label class="label" for="senComment">ข้อเสนอแนะเพิ่มเติม <span class="mini">(ไม่บังคับ)</span></label><textarea id="senComment" placeholder="จุดเด่น จุดที่ควรพัฒนา หรือรายละเอียดเพิ่มเติม (ถ้ามี)"></textarea></div>'+
     '<div class="progress-txt" style="margin-top:14px">ให้คะแนนแล้ว <b id="senProg">0 จาก 6</b> หัวข้อ</div>'+
     '<button class="btn primary" id="senSubmit" style="width:100%;margin-top:12px;min-height:48px" onclick="seniorSubmit()">ส่งแบบประเมิน</button>'+
   '</div>'+
   '<div id="seniorThanks" class="pub-thanks hidden"><div class="big">&#10003;</div><h2>บันทึกผลประเมินเรียบร้อย</h2><p class="pub-hint">ขอบคุณสำหรับการประเมิน ข้อมูลของท่านถูกบันทึกแล้ว</p><button class="btn primary" onclick="seniorReset()" style="min-height:46px">ประเมินรายการถัดไป</button></div>';
  loadDirs();
}
async function loadDirs(){
  if(!sb) return;
  try{
    const [s,sn]=await Promise.all([sb.from('staff').select('name').order('name'),sb.from('senior_names').select('name').order('name')]);
    const ss=$('senStaff'), se=$('senSenior');
    if(ss) ss.innerHTML=sOpts((s.data||[]).map(x=>normName(x.name)));
    if(se) se.innerHTML=sOpts((sn.data||[]).map(x=>normName(x.name)));
    if(sn.error&&se) se.innerHTML='<option value="">— ยังไม่ได้สร้างตาราง senior_names (รัน schema-senior-eval.sql) —</option>';
  }catch(e){}
}
function progress(){ const n=document.querySelectorAll('#senCriteria button.active').length, p=$('senProg'); if(p&&p.textContent!==n+' จาก 6') p.textContent=n+' จาก 6'; }
function pick(btn){
  const k=btn.dataset.sk; document.querySelectorAll('#senCriteria button[data-sk="'+k+'"]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); const card=btn.closest('.pub-crit'); if(card) card.classList.remove('invalid'); progress();
}
async function submit(){
  if(!sb) return toast('ยังไม่ได้ตั้งค่า Supabase',true);
  const senior=$('senSenior').value.trim(), staff=$('senStaff').value.trim();
  if(!senior) return toast('กรุณาเลือก Senior ผู้ประเมิน',true);
  if(!staff) return toast('กรุณาเลือกเจ้าหน้าที่ Onsite Support ที่รับการประเมิน',true);
  document.querySelectorAll('#senCriteria .pub-crit.invalid').forEach(el=>el.classList.remove('invalid'));
  const row={senior,staff,comment:($('senComment').value||'').trim()||null}; let first=null;
  SCRITERIA.forEach(c=>{ const b=document.querySelector('#senCriteria button[data-sk="'+c.key+'"].active'); row[c.key]=b?Number(b.dataset.value):null;
    if(!b){ const card=document.querySelector('[data-scard="'+c.key+'"]'); if(card){ card.classList.add('invalid'); if(!first) first=card; } } });
  if(first){ toast('กรุณาให้คะแนนให้ครบทั้ง 6 หัวข้อก่อนส่งแบบประเมิน',true); first.scrollIntoView({behavior:'smooth',block:'center'}); return; }
  const btn=$('senSubmit'); btn.disabled=true;
  try{
    const {error}=await sb.from(TABLE).insert(row); if(error) throw error;
    $('seniorForm').classList.add('hidden'); $('seniorThanks').classList.remove('hidden'); window.scrollTo(0,0); loaded=false;
  }catch(e){ toast('ส่งไม่สำเร็จ: '+((e&&e.message)||e),true); }
  finally{ btn.disabled=false; }
}
function reset(){ renderForm(); window.scrollTo(0,0); }

/* ---------- ครอบ pubSwitch / showPublic ---------- */
const SENIOR_TITLE='แบบประเมิน<span style="white-space:nowrap">เจ้าหน้าที่ Onsite Support</span><span class="pub-sub">สำหรับ Senior ผู้ควบคุมงาน</span>';
const _pubSwitch=window.pubSwitch;
window.pubSwitch=function(which){
  const host=$('seniorFormHost');
  if(which==='senior'){
    document.querySelectorAll('[data-pubtab]').forEach(b=>b.classList.toggle('active',b.dataset.pubtab==='senior'));
    ['pubForm','pubThanks','appsFormHost'].forEach(id=>{ const e=$(id); if(e) e.classList.add('hidden'); });
    if(host){ host.classList.remove('hidden'); if(!host.querySelector('#seniorForm')&&!host.querySelector('#seniorThanks')) renderForm(); }
    const t=$('pubHeroTitle'); if(t) t.innerHTML=SENIOR_TITLE; const imm=$('pubLogoImm'); if(imm) imm.style.display='';
    return;
  }
  if(host) host.classList.add('hidden');
  return _pubSwitch.apply(this,arguments);
};
let deepDone=false, locked=false;
const _showPublic=window.showPublic;
window.showPublic=function(){
  _showPublic.apply(this,arguments);
  const host=$('seniorFormHost'); if(host) host.classList.add('hidden');
  if(!deepDone){
    deepDone=true; let f='';
    try{ const p=new URLSearchParams(location.search); f=(p.get('form')||p.get('survey')||'').toLowerCase(); }catch(e){}
    if(f==='senior'||f==='seniors'){ locked=true; const bar=$('pubSwitchBar'); if(bar) bar.style.display='none'; }
  }
  if(locked) window.pubSwitch('senior');
};

/* ---------- QR / ลิงก์ ---------- */
const linkSenior=()=>location.origin+location.pathname+'?form=senior';
function qrImg(id){ const box=$(id); if(!box) return null; const img=box.querySelector('img'); if(img&&img.src) return img.src; const cv=box.querySelector('canvas'); return cv?cv.toDataURL('image/png'):null; }
const _openQr=window.openQrModal;
window.openQrModal=function(){
  _openQr.apply(this,arguments);
  const url=linkSenior(), u=$('qrUrlSenior'), el=$('qrSenior'); if(u) u.textContent=url;
  if(el){ el.innerHTML=''; if(typeof QRCode==='undefined') el.innerHTML='<div class="mini" style="color:#b91c1c">โหลดไลบรารี QR ไม่สำเร็จ (ตรวจอินเทอร์เน็ต)</div>';
    else { try{ new QRCode(el,{text:url,width:200,height:200,correctLevel:QRCode.CorrectLevel.M}); }catch(e){ el.innerHTML='<div class="mini">สร้าง QR ไม่สำเร็จ</div>'; } } }
};
window.seniorCopyQr=function(){
  const url=linkSenior(), done=()=>toast('คัดลอกลิงก์แล้ว');
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(done,()=>toast(url)); return; } }catch(e){}
  window.prompt('คัดลอกลิงก์นี้:',url);
};
window.seniorDownloadQr=function(){ const d=qrImg('qrSenior'); if(!d) return toast('ยังไม่มีรูป QR',true); const a=document.createElement('a'); a.href=d; a.download='QR_Senior_Eval.png'; a.click(); };
window.printQr=function(){
  const items=[['ประเมินเจ้าหน้าที่<br>Onsite Support','qrOnsite',location.origin+location.pathname+'?form=onsite'],['ประเมินความพึงพอใจ<br>ระบบ APPS','qrApps',location.origin+location.pathname+'?form=apps'],['Senior ประเมิน<br>เจ้าหน้าที่ Onsite Support','qrSenior',linkSenior()]];
  const w=window.open('','_blank'); if(!w) return toast('เบราว์เซอร์บล็อก popup',true);
  const card=(t,id,url)=>{ const im=qrImg(id); return '<div style="border:1px solid #ccc;border-radius:14px;padding:22px;text-align:center;width:300px"><div style="font-size:19px;font-weight:800;color:#0b2f6b;margin-bottom:14px;min-height:52px">'+t+'</div>'+(im?'<img src="'+im+'" style="width:230px;height:230px">':'<div>ไม่มี QR</div>')+'<div style="font-size:11px;color:#555;word-break:break-all;margin-top:10px">'+url+'</div><div style="font-size:13px;color:#334155;margin-top:8px">สแกนเพื่อเข้าแบบประเมิน</div></div>'; };
  w.document.write('<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>QR แบบประเมิน OSO</title><style>body{font-family:"Sarabun",Tahoma,sans-serif;margin:0;padding:28px;display:flex;gap:22px;flex-wrap:wrap;justify-content:center}@media print{.np{display:none}}</style></head><body>'+items.map(i=>card(i[0],i[1],i[2])).join('')+'<div class="np" style="width:100%;text-align:center"><button onclick="window.print()" style="padding:10px 22px;font-size:16px">พิมพ์</button></div></body></html>');
  w.document.close();
};

/* ---------- รายการประเมิน Senior (หลังล็อกอิน) ---------- */
const canDel=()=>{ try{ return user&&(user.isAdmin||can('delete_eval')); }catch(e){ return false; } };
const pill=(c,v)=>'<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap;color:#fff;background:'+scoreColor2(v)+'">'+esc(LABEL_MAP[v]||'-')+'</span>';
function scoreColor2(v){ return v>=5?'#2563eb':v>=4?'#16a34a':v>=3?'#d97706':v>=2?'#ea580c':'#dc2626'; }
async function renderList(){
  const c=$('content'); c.innerHTML=LOADING; await ensure();
  if(view!=='senior_list') return;
  const q=filter.toLowerCase(), list=recs.filter(r=>!q||(r.staff+' '+r.evaluator+' '+r.comment).toLowerCase().includes(q));
  let h='<div class="toolbar"><input class="input search" value="'+esc(filter)+'" oninput="seniorSearch(this.value)" placeholder="ค้นหาชื่อเจ้าหน้าที่ / Senior / ข้อเสนอแนะ"><span class="mini">'+list.length+' / '+recs.length+' รายการ</span>'+
    '<button class="btn" style="margin-left:auto" onclick="seniorRefresh()">รีเฟรช</button><button class="btn" onclick="seniorExportCsv()">ส่งออก CSV</button><button class="btn primary" onclick="showView(\'sum_senior\',document.querySelector(\'[data-view=sum_senior]\'))">สรุปผล / รายงาน DOCX</button></div>';
  if(!list.length){ c.innerHTML=h+'<div class="panel"><div class="empty">'+(recs.length?'ไม่พบรายการที่ค้นหา':'ยังไม่มีผลประเมินจาก Senior')+'</div></div>'; return; }
  h+='<div class="table-wrap"><table style="min-width:1100px"><thead><tr><th>วันเวลา</th><th>Senior</th><th>เจ้าหน้าที่</th>'+SCRITERIA.map(k=>'<th style="text-align:center" title="'+esc(k.title)+'">'+k.no+'. '+esc(k.shortTitle)+'</th>').join('')+'<th style="text-align:center">เฉลี่ย</th><th>ข้อเสนอแนะ</th><th></th></tr></thead><tbody>'+
    list.map(r=>'<tr><td class="nowrap">'+esc(r.timestamp)+'</td><td>'+esc(r.evaluator)+'</td><td><b>'+esc(r.staff)+'</b></td>'+SCRITERIA.map(k=>'<td style="text-align:center">'+pill(k,r.scores[k.key].value)+'</td>').join('')+
      '<td style="text-align:center;font-weight:800">'+(r.avg?r.avg.toFixed(2):'-')+'<div class="mini">'+esc(r.band)+'</div></td><td style="max-width:320px"><div style="max-height:5.4em;overflow:auto;font-size:13px;white-space:pre-wrap">'+esc(r.comment)+'</div></td>'+
      '<td>'+(canDel()?'<button class="btn sm" onclick="seniorDelete('+r.id+')">ลบ</button>':'')+'</td></tr>').join('')+'</tbody></table></div>';
  c.innerHTML=h;
}
async function del(id){
  if(!canDel()) return toast('คุณไม่มีสิทธิ์ลบ',true);
  if(!confirm('ลบผลประเมินรายการนี้?')) return;
  const {error}=await sb.from(TABLE).delete().eq('id',id); if(error) return toast('ลบไม่สำเร็จ: '+error.message,true);
  if(typeof logAction==='function') logAction('delete',TABLE,'id='+id); toast('ลบแล้ว'); loaded=false; renderList();
}
function csvCell(v){ v=String(v==null?'':v); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }
function exportCsv(){
  if(typeof can==='function'&&!can('view_reports')&&!(user&&user.isAdmin)) return toast('คุณไม่มีสิทธิ์ส่งออก',true);
  const head=['วันเวลา','Senior ผู้ประเมิน','เจ้าหน้าที่ Onsite Support'].concat(SCRITERIA.map(k=>k.no+'. '+k.title),['คะแนนเฉลี่ย','ระดับ','ข้อเสนอแนะ']);
  const lines=[head.map(csvCell).join(',')].concat(recs.map(r=>[r.timestamp,r.evaluator,r.staff].concat(SCRITERIA.map(k=>r.scores[k.key].label),[r.avg.toFixed(2),r.band,r.comment]).map(csvCell).join(',')));
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'})); a.download='OSO_Senior_Evaluation.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}

const VIEWS={ senior_list:{title:'รายการประเมิน Senior',fn:renderList} };
const _render=window.render;
window.render=function(){
  const v=view;
  if(VIEWS[v]){ const pt=$('pageTitle'); if(pt) pt.textContent=VIEWS[v].title; VIEWS[v].fn(); return; }
  return _render.apply(this,arguments);
};

window.seniorPick=pick; window.seniorSubmit=submit; window.seniorReset=reset; window.seniorDelete=del; window.seniorExportCsv=exportCsv;
window.seniorSearch=function(v){ filter=v; renderList(); };
window.seniorRefresh=async function(){ await ensure(true); renderList(); toast('อัปเดตข้อมูลแล้ว'); };
window.seniorApi={ ensure:async function(f){ await ensure(f); }, records:function(){ return recs; }, CRITERIA:SCRITERIA };
})();
