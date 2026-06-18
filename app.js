/* ============================================================
   app.js - OSO Evaluation (GitHub Pages + Supabase)
   พอร์ตจากเวอร์ชัน Apps Script ให้ครบทุกฟีเจอร์ + รายงาน
   ============================================================ */

// ---------- ค่าคงที่ (ตรงกับ Code.gs) ----------
const CRITERIA = [
  {key:'speed',           no:1, shortTitle:'ความรวดเร็ว',   title:'ความรวดเร็วในการให้บริการ', color:'#0ea5e9', points:['ตอบรับและเข้าช่วยเหลือได้รวดเร็ว','ลดเวลารอคอยของเจ้าหน้าที่ ตม.','จัดลำดับความเร่งด่วนได้เหมาะสม','ติดตามงานจนเสร็จในเวลาที่เหมาะสม']},
  {key:'problem_solving', no:2, shortTitle:'แก้ไขปัญหา',     title:'ความสามารถในการแก้ไขปัญหา', color:'#2563eb', points:['วิเคราะห์สาเหตุของปัญหาได้ตรงจุด','เลือกวิธีแก้ไขเหมาะสมกับสถานการณ์','แก้ไขแล้วระบบหรืออุปกรณ์ใช้งานได้จริง','ประสานงานต่อเมื่อปัญหาเกินขอบเขต']},
  {key:'communication',   no:3, shortTitle:'สื่อสารและเข้าใจ', title:'การสื่อสารและความเข้าใจ', color:'#06b6d4', points:['อธิบายขั้นตอนด้วยภาษาที่เข้าใจง่าย','รับฟังปัญหาของเจ้าหน้าที่ ตม. อย่างครบถ้วน','แจ้งสถานะและข้อจำกัดชัดเจน','สื่อสารสุภาพ ไม่กำกวม']},
  {key:'service_mind',    no:4, shortTitle:'มารยาทบริการ',   title:'มารยาทและการให้บริการ', color:'#14b8a6', points:['สุภาพ เป็นมิตร และให้เกียรติผู้ใช้งาน','แสดงความตั้งใจช่วยเหลือ','อดทนต่อสถานการณ์กดดัน','สร้างประสบการณ์ที่ดีในการรับบริการ']},
  {key:'satisfaction',    no:5, shortTitle:'พึงพอใจโดยรวม',  title:'ความพึงพอใจโดยรวม', color:'#60a5fa', points:['ผลลัพธ์ตรงกับความต้องการ','เจ้าหน้าที่ ตม. มั่นใจในการใช้งานต่อ','บริการมีความสม่ำเสมอ','ภาพรวมการสนับสนุนเป็นที่น่าพึงพอใจ']}
];
const SCORE_OPTIONS = [
  {label:'ดีเยี่ยม',value:5},{label:'ดี',value:4},{label:'พอใช้',value:3},{label:'ต้องปรับปรุง',value:2},{label:'ไม่ผ่าน',value:1}
];
const SCORE_MAP = SCORE_OPTIONS.reduce((m,x)=>(m[x.label]=x.value,m),{});
const LABEL_MAP = SCORE_OPTIONS.reduce((m,x)=>(m[x.value]=x.label,m),{});
const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

// ---------- globals ----------
const APP_VERSION='27';
let criteria = CRITERIA, scoreOptions = SCORE_OPTIONS;
let user = null, data = {records:[],people:[],staffNames:[],shiftNames:[],summary:{}};
let view = 'dashboard', filter = '', selectedStaff = '', editRow = 0;
const LOADING = '<div class="loading"><div class="spinner"></div>กำลังโหลด...</div>';

// ---------- helpers ----------
const $ = id => document.getElementById(id);
const esc = s => String(s==null?'':s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const num = x => Number(x||0);
const pct = x => Math.max(0,Math.min(100,Math.round(num(x)/5*100)));
const fmt = x => num(x)?num(x).toFixed(2):'0.00';
const tone = v => v>=4.6?'excellent':v>=3.8?'good':v>=3?'fair':v>=2?'weak':'critical';
const scoreColor = v => v>=5?'#bef264':v>=4?'#99f6e4':v>=3?'#fcd34d':v>=2?'#fecdd3':'#fca5a5';
function js(s){return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/[\r\n]/g,' ');}
function scoreBand(score){if(!score)return 'ยังไม่มีข้อมูล';if(score>=4.6)return 'ดีเยี่ยม';if(score>=3.8)return 'ดี';if(score>=3.0)return 'พอใช้';if(score>=2.0)return 'ต้องปรับปรุง';return 'ไม่ผ่าน';}
function fmtDateTime(v){if(!v)return '';try{return new Date(v).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'});}catch(e){return String(v);}}
let tt;function toast(m,err){const e=$('toast');e.textContent=m;e.className='toast show'+(err?' err':'');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('show'),2800);}

// ---------- Supabase client ----------
let sb = null;
(function(){
  const cfg = window.APP_CONFIG||{};
  if(cfg.SUPABASE_URL && !String(cfg.SUPABASE_URL).startsWith('PASTE')){
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }
})();

// ---------- สลับหน้าจอ ----------
function hideAll(){['public','login','resetpw'].forEach(id=>$(id).classList.add('hidden'));$('app').classList.remove('ready');}
function showLogin(){hideAll();$('login').classList.remove('hidden');}
function gotoLogin(){showLogin();}
function boot(){$('public').classList.add('hidden');$('login').classList.add('hidden');$('app').classList.add('ready');refresh();checkAdmin();loadPerms();startRealtime();logAction('login','auth',user&&user.email);}
function showPublic(){hideAll();$('public').classList.remove('hidden');$('pubThanks').classList.add('hidden');$('pubForm').classList.remove('hidden');renderPublicForm();loadPublicDirectories();}

window.onload = async function(){
  renderPublicForm();
  if(!sb){showPublic();toast('ยังไม่ได้ตั้งค่า Supabase ใน config.js',true);return;}
  sb.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')showResetPw();});
  if(String(location.hash).indexOf('type=recovery')>=0){showResetPw();return;}
  try{const {data:s}=await sb.auth.getSession();if(s&&s.session){setUser(s.session.user);boot();}else showPublic();}
  catch(e){showPublic();}
};
function setUser(u){const r=(u&&u.app_metadata&&u.app_metadata.role)||'senior';user={email:u.email,role:r,isAdmin:r==='admin',displayName:u.email,username:u.email};}
// ถาม Edge Function ว่าเป็น admin ไหม (รองรับ bootstrap ผ่าน ADMIN_EMAILS) แล้วเปิด/ซ่อนเมนูจัดการผู้ใช้
async function checkAdmin(){
  user.isAdmin=(user.role==='admin');
  try{const {data,error}=await sb.functions.invoke('admin-users',{body:{action:'whoami'}});if(!error&&data&&data.isAdmin){user.isAdmin=true;user.role='admin';}}catch(e){}
  applyRoleUI();
}
// ===== ความสามารถกลางของระบบ (เพิ่มฟังก์ชันใหม่ที่นี่ → จะโผล่ในหน้าจัดการสิทธิ์อัตโนมัติ) =====
const CAPS=[
  {key:'view_reports',     label:'ดู/ออกรายงาน (DOCX, CSV, PDF)',              def:{senior:true, manager:true}},
  {key:'edit_eval',        label:'แก้ไขผลประเมิน',                             def:{senior:true, manager:true}},
  {key:'delete_eval',      label:'ลบผลประเมิน',                               def:{senior:true, manager:false}},
  {key:'manage_directory', label:'จัดการรายชื่อ (เพิ่ม/ลบ ผลัด·เจ้าหน้าที่)',     def:{senior:true, manager:true}},
  {key:'import_csv',       label:'นำเข้าข้อมูลเก่า (CSV)',                     def:{senior:true, manager:false}}
];
let perms={};
function can(cap){
  if(user&&user.isAdmin)return true;
  const r=(user&&user.role)||'senior';
  if(perms&&perms[r]&&perms[r][cap]!==undefined)return !!perms[r][cap];
  const c=CAPS.find(x=>x.key===cap);return c?!!c.def[r]:false;
}
async function loadPerms(notify){
  try{const {data}=await sb.from('app_settings').select('value').eq('key','permissions').maybeSingle();perms=(data&&data.value)||{};}catch(e){perms={};}
  applyRoleUI();
  // ถ้าอยู่ในหน้าที่สิทธิ์ถูกถอนไป ให้เด้งกลับแดชบอร์ด
  if(!user.isAdmin&&view==='directory'&&!can('manage_directory'))view='dashboard';
  if($('app').classList.contains('ready'))render();
  if(notify)toast('สิทธิ์การใช้งานได้รับการอัปเดต');
}
function applyRoleUI(){
  const show=(id,ok)=>{const n=$(id);if(n)n.classList.toggle('hidden',!ok);};
  show('navUsers',user.isAdmin); show('navPerms',user.isAdmin); show('navAudit',user.isAdmin);
  show('navDirectory',user.isAdmin||can('manage_directory'));
  show('btnReportTop',can('view_reports')); show('btnReportNav',can('view_reports')); show('btnCsvNav',can('view_reports'));
  if($('userRole'))$('userRole').textContent=user.role||'-';
}
// ===== บันทึกการใช้งานระบบ =====
async function logAction(action,entity,detail){try{if(sb&&user)await sb.from('audit_log').insert({action:action,entity:entity||null,detail:detail?String(detail).slice(0,500):null});}catch(e){}}

// ---------- จัดการรหัสผ่าน ----------
function showResetPw(){hideAll();$('resetpw').classList.remove('hidden');}
async function submitNewPassword(e){
  e.preventDefault();const p=$('newPass').value,p2=$('newPass2').value;
  if(p.length<6)return toast('รหัสผ่านอย่างน้อย 6 ตัวอักษร',true);
  if(p!==p2)return toast('รหัสผ่านยืนยันไม่ตรงกัน',true);
  $('newPassBtn').disabled=true;
  const {error}=await sb.auth.updateUser({password:p});
  $('newPassBtn').disabled=false;
  if(error)return toast('ตั้งรหัสไม่สำเร็จ: '+error.message,true);
  toast('ตั้งรหัสผ่านใหม่เรียบร้อย');
  try{history.replaceState(null,'',location.pathname);}catch(_){}
  const {data:s}=await sb.auth.getSession();
  if(s&&s.session){setUser(s.session.user);boot();}else showLogin();
}
async function forgotPassword(){
  if(!sb)return toast('ยังไม่ได้ตั้งค่า Supabase',true);
  const email=($('loginUser').value||'').trim()||prompt('กรอกอีเมลสำหรับรับลิงก์รีเซ็ตรหัสผ่าน');
  if(!email)return;
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  if(error)return toast('ส่งไม่สำเร็จ: '+error.message,true);
  toast('ส่งลิงก์รีเซ็ตไปที่อีเมลแล้ว กรุณาตรวจกล่องจดหมาย');
}
async function changePassword(){
  const p=prompt('ตั้งรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)');
  if(!p)return;if(p.length<6)return toast('รหัสผ่านอย่างน้อย 6 ตัวอักษร',true);
  const {error}=await sb.auth.updateUser({password:p});
  if(error)return toast('เปลี่ยนรหัสไม่สำเร็จ: '+error.message,true);
  logAction('password','auth','self');
  toast('เปลี่ยนรหัสผ่านเรียบร้อย');
}

// ---------- หน้าสาธารณะ ----------
function renderPublicForm(){
  $('pubCriteria').innerHTML = criteria.map(c=>'<div class="pub-crit" data-card="'+c.key+'" style="--c:'+c.color+'"><div class="pub-crit-head"><span class="pub-no">'+c.no+'</span><div class="pub-crit-title">'+esc(c.shortTitle)+'<span class="pub-req" title="จำเป็นต้องให้คะแนน">*</span><small>'+esc(c.title)+'</small></div></div><ul class="points">'+c.points.map(p=>'<li>'+esc(p)+'</li>').join('')+'</ul><div class="pub-seg">'+scoreOptions.map(o=>'<button type="button" style="--tone:'+scoreColor(o.value)+'" data-pub="'+c.key+'" data-value="'+o.value+'" onclick="pickPub(this)">'+esc(o.label)+'</button>').join('')+'</div></div>').join('');
}
function pickPub(btn){const k=btn.dataset.pub;document.querySelectorAll('button[data-pub="'+k+'"]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const card=btn.closest('.pub-crit');if(card)card.classList.remove('invalid');}
async function loadPublicDirectories(){
  if(!sb)return;
  try{
    const [s,sh]=await Promise.all([sb.from('staff').select('name').order('name'),sb.from('shifts').select('name').order('name')]);
    $('pubStaffList').innerHTML=(s.data||[]).map(x=>'<option value="'+esc(x.name)+'">').join('');
    $('pubEvaluatorList').innerHTML=(sh.data||[]).map(x=>'<option value="'+esc(x.name)+'">').join('');
  }catch(e){}
}
async function submitPublic(){
  if(!sb)return toast('ยังไม่ได้ตั้งค่า Supabase',true);
  const evaluator=$('pubEvaluator').value.trim(),staff=$('pubStaff').value.trim();
  if(!evaluator)return toast('กรุณาระบุผลัด/ชื่อเจ้าหน้าที่ ตม.',true);
  if(!staff)return toast('กรุณาระบุชื่อเจ้าหน้าที่ Onsite Support',true);
  document.querySelectorAll('.pub-crit.invalid').forEach(el=>el.classList.remove('invalid'));
  const row={evaluator,staff,comment:$('pubComment').value.trim()||null};let firstMissing=null;
  criteria.forEach(c=>{const b=document.querySelector('button[data-pub="'+c.key+'"].active');row[c.key]=b?Number(b.dataset.value):null;if(!b){const card=document.querySelector('[data-card="'+c.key+'"]');if(card){card.classList.add('invalid');if(!firstMissing)firstMissing=card;}}});
  if(firstMissing){toast('กรุณาให้คะแนนให้ครบทั้ง 5 หัวข้อก่อนส่งแบบประเมิน',true);firstMissing.scrollIntoView({behavior:'smooth',block:'center'});return;}
  $('pubSubmit').disabled=true;
  const {error}=await sb.from('evaluations').insert(row);
  $('pubSubmit').disabled=false;
  if(error)return toast('ส่งไม่สำเร็จ: '+error.message,true);
  sb.from('staff').insert({name:staff}).then(()=>{},()=>{});
  $('pubForm').classList.add('hidden');$('pubThanks').classList.remove('hidden');window.scrollTo(0,0);
}
function resetPublic(){$('pubEvaluator').value='';$('pubStaff').value='';$('pubComment').value='';document.querySelectorAll('#pubCriteria button.active').forEach(b=>b.classList.remove('active'));$('pubThanks').classList.add('hidden');$('pubForm').classList.remove('hidden');window.scrollTo(0,0);}

// ---------- ล็อกอิน ----------
function showLoginError(msg){const b=$('loginError');if(b){b.textContent=msg;b.classList.remove('hidden');}toast(msg,true);}
function loginErrorText(error){const m=String(error&&error.message||'').toLowerCase();
  if(m.indexOf('invalid login')>=0||m.indexOf('invalid credentials')>=0)return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if(m.indexOf('email not confirmed')>=0)return 'อีเมลนี้ยังไม่ได้ยืนยัน — ให้ผู้ดูแลปิด "Confirm email" หรือยืนยันบัญชีใน Supabase (Authentication → Users)';
  if(m.indexOf('rate limit')>=0||m.indexOf('too many')>=0)return 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
  if(m.indexOf('failed to fetch')>=0||m.indexOf('networkerror')>=0||m.indexOf('load failed')>=0)return 'เชื่อมต่อเซิร์ฟเวอร์ Supabase ไม่ได้ — ตรวจอินเทอร์เน็ต/VPN หรือค่าใน config.js';
  return 'เข้าสู่ระบบไม่สำเร็จ: '+(error&&error.message||'ไม่ทราบสาเหตุ');
}
function setLoginBtn(state){
  const b=$('loginBtn');if(!b)return;
  if(state==='loading'){b.disabled=true;b.classList.remove('ok');b.innerHTML='<span class="btn-spin"></span>กำลังเข้าสู่ระบบ...';}
  else if(state==='ok'){b.disabled=true;b.classList.add('ok');b.innerHTML='&#10003; เข้าสู่ระบบสำเร็จ';}
  else{b.disabled=false;b.classList.remove('ok');b.textContent='เข้าสู่ระบบ';}
}
function shakeLogin(){const c=document.querySelector('#login .login-card');if(c){c.classList.remove('shake');void c.offsetWidth;c.classList.add('shake');}}
async function doLogin(e){
  e.preventDefault();
  const eb=$('loginError');if(eb){eb.classList.add('hidden');eb.textContent='';}
  if(!sb){showLoginError('ยังไม่ได้ตั้งค่า Supabase ใน config.js');shakeLogin();return;}
  const email=($('loginUser').value||'').trim(),pass=$('loginPass').value||'';
  if(!email||!pass){showLoginError('กรุณากรอกอีเมลและรหัสผ่านให้ครบ');shakeLogin();return;}
  setLoginBtn('loading');
  try{
    const {data:d,error}=await sb.auth.signInWithPassword({email,password:pass});
    if(error){console.error('login error',error);setLoginBtn('idle');showLoginError(loginErrorText(error));shakeLogin();return;}
    setUser(d.user);setLoginBtn('ok');toast('เข้าสู่ระบบสำเร็จ');setTimeout(()=>{boot();setLoginBtn('idle');},650);
  }catch(ex){console.error('login exception',ex);setLoginBtn('idle');showLoginError(loginErrorText(ex));shakeLogin();}
}
async function doLogout(){if(sb)await sb.auth.signOut();showPublic();}

// ---------- ชั้นข้อมูล (แทน google.script.run) ----------
function rowToRecord(r){
  const scores={};criteria.forEach(c=>{const v=Number(r[c.key]||0);scores[c.key]={value:v,label:LABEL_MAP[v]||''};});
  const vals=criteria.map(c=>scores[c.key].value).filter(Number);
  const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
  return {rowNumber:r.id,id:r.id,timestampRaw:r.created_at,timestamp:fmtDateTime(r.created_at),evaluator:r.evaluator||'',staff:r.staff||'',scores,avg,band:scoreBand(avg),comment:r.comment||''};
}
function avgArr(a){return a.length?a.reduce((x,y)=>x+Number(y||0),0)/a.length:0;}
function uniqueSort(arr){return Array.from(new Set(arr.map(s=>String(s||'').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'th'));}
function summarizePerson(name,records){
  const rows=records.filter(r=>r.staff===name);
  if(!rows.length)return {name,count:0,avg:0,band:'ยังไม่มีข้อมูล',criteria:{},latest:'',trend:0,lastComment:''};
  const crit={};criteria.forEach(c=>{const v=rows.map(r=>r.scores[c.key].value).filter(Number);crit[c.key]=v.length?avgArr(v):0;});
  const avg=avgArr(rows.map(r=>r.avg).filter(Number));
  const chrono=rows.slice().sort((a,b)=>new Date(a.timestampRaw)-new Date(b.timestampRaw));
  const first=chrono[0]?chrono[0].avg:avg,last=chrono[chrono.length-1]?chrono[chrono.length-1].avg:avg,latestRow=chrono[chrono.length-1];
  return {name,count:rows.length,avg,band:scoreBand(avg),criteria:crit,latest:latestRow?latestRow.timestamp:'',trend:last-first,lastComment:latestRow?latestRow.comment:''};
}
function summarizeOverall(records,people){
  const total=records.length,evaluated=people.filter(p=>p.count).length,avgScore=total?avgArr(records.map(r=>r.avg)):0,criteriaAvg={};
  criteria.forEach(c=>criteriaAvg[c.key]=avgArr(records.map(r=>r.scores[c.key].value).filter(Number))||0);
  const lowest=criteria.slice().sort((a,b)=>(criteriaAvg[a.key]||0)-(criteriaAvg[b.key]||0))[0];
  const top=people.filter(p=>p.count).slice(0,5);
  const risks=people.filter(p=>p.count&&p.avg<3.5).sort((a,b)=>a.avg-b.avg).slice(0,5);
  const evaluators={};records.forEach(r=>evaluators[r.evaluator]=(evaluators[r.evaluator]||0)+1);
  return {total,evaluated,avgScore,band:scoreBand(avgScore),criteriaAvg,lowestKey:lowest?lowest.key:'',top,risks,evaluators};
}
async function loadData(){
  const [ev,st,sh]=await Promise.all([
    sb.from('evaluations').select('*').order('created_at',{ascending:false}),
    sb.from('staff').select('name').order('name'),
    sb.from('shifts').select('name').order('name')
  ]);
  if(ev.error)throw ev.error;
  const records=(ev.data||[]).map(rowToRecord);
  const staffNames=uniqueSort(records.map(r=>r.staff).concat((st.data||[]).map(x=>x.name)));
  const people=staffNames.map(n=>summarizePerson(n,records)).filter(Boolean).sort((a,b)=>b.avg-a.avg||a.name.localeCompare(b.name,'th'));
  const summary=summarizeOverall(records,people);
  const shiftNames=uniqueSort(records.map(r=>r.evaluator).concat((sh.data||[]).map(x=>x.name)));
  return {records,people,staffNames,shiftNames,summary};
}
async function refresh(){
  $('content').innerHTML=LOADING;
  try{data=await loadData();hydrateUser();render();}
  catch(e){toast((e&&e.message)||'โหลดข้อมูลไม่สำเร็จ',true);$('content').innerHTML='<div class="empty">โหลดข้อมูลไม่สำเร็จ</div>';}
}
// โหลดข้อมูลล่าสุดเงียบ ๆ (ใช้ก่อนสร้างรายงาน เพื่อให้เป็นปัจจุบันเสมอ)
async function ensureFresh(){try{data=await loadData();}catch(e){}}
// Realtime: อัปเดตแดชบอร์ด/สรุปทันทีเมื่อมีการประเมินใหม่ หรือมีการเพิ่ม/ลบรายชื่อ
let realtimeOn=false,liveT;
function startRealtime(){
  if(!sb||realtimeOn)return;realtimeOn=true;
  try{
    sb.channel('oso-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'evaluations'},liveRefresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'staff'},liveRefresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'shifts'},liveRefresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'app_settings'},()=>loadPerms(true))
      .subscribe();
  }catch(e){}
}
function liveRefresh(){clearTimeout(liveT);liveT=setTimeout(async()=>{try{data=await loadData();if(['dashboard','evaluations','people','insights'].indexOf(view)>=0)render();toast('อัปเดตข้อมูลล่าสุดแล้ว');}catch(e){}},800);}
function hydrateUser(){$('userName').textContent=user.displayName||user.email;$('userRole').textContent=user.role;$('avatar').textContent=(user.displayName||'U').slice(0,1).toUpperCase();if($('appVer'))$('appVer').textContent='เวอร์ชัน '+APP_VERSION;}
function showView(v,btn){
  if((v==='users'||v==='perms'||v==='audit')&&!user.isAdmin){toast('เฉพาะผู้ดูแลระบบ (admin) เท่านั้น',true);return;}
  if(v==='directory'&&!(user.isAdmin||can('manage_directory'))){toast('คุณไม่มีสิทธิ์จัดการรายชื่อ',true);return;}
  view=v;document.querySelectorAll('.nav button[data-view]').forEach(b=>b.classList.toggle('active',b===btn));$('side').classList.remove('open');render();
}
function toggleSide(){$('side').classList.toggle('open');}
function render(){const t={dashboard:'แดชบอร์ด',evaluations:'รายการประเมิน',people:'สรุปรายเจ้าหน้าที่',insights:'วิเคราะห์ภาพรวม',directory:'จัดการรายชื่อ',users:'จัดการผู้ใช้ระบบ',perms:'จัดการสิทธิ์',audit:'บันทึกการใช้งานระบบ',help:'คู่มือการใช้งาน'};$('pageTitle').textContent=t[view]||'แดชบอร์ด';({dashboard:renderDashboard,evaluations:renderEvaluations,people:renderPeople,insights:renderInsights,directory:renderDirectory,users:renderUsers,perms:renderPerms,audit:renderAudit,help:renderHelp}[view]||renderDashboard)();}
function stat(a,b,c,color){return '<div class="stat"><div class="stat-label">'+a+'</div><div class="stat-num" style="color:'+color+'">'+b+'</div><div class="mini">'+(c||'')+'</div></div>';}

// ---------- แดชบอร์ด ----------
function renderDashboard(){
  const s=data.summary||{},weak=criteria.find(c=>c.key===s.lowestKey),risk=(s.risks||[])[0],coverage=data.staffNames.length?Math.round((s.evaluated||0)/data.staffNames.length*100):0;
  $('content').innerHTML='<div class="exec"><div class="panel"><div class="panel-head"><div><div class="panel-title">สรุปภาพรวม</div><div class="mini">ภาพรวมผลประเมินสำหรับหน่วยงานตรวจคนเข้าเมือง</div></div></div><div class="exec-grid"><div class="exec-item"><b>ภาพรวมคะแนน</b><span class="tag '+tone(s.avgScore)+'">'+fmt(s.avgScore)+' / 5</span><div class="mini" style="margin-top:8px">'+esc(s.band||'-')+'</div></div><div class="exec-item"><b>จำนวนเจ้าหน้าที่ที่มีข้อมูล</b><span class="tag neutral">'+(s.evaluated||0)+' / '+(data.staffNames.length||s.evaluated||0)+' คน</span><div class="bar" style="margin-top:10px"><div class="fill" style="width:'+coverage+'%"></div></div></div><div class="exec-item"><b>หัวข้อที่ควรติดตาม</b><span class="tag weak">'+(weak?esc(weak.shortTitle):'-')+'</span><div class="mini" style="margin-top:8px">คะแนนเฉลี่ยต่ำสุด</div></div></div></div><div class="panel"><div class="panel-head"><div><div class="panel-title">ข้อเสนอแนะถัดไป</div><div class="mini">แนวทางติดตามสำหรับแต่ละผลัด</div></div></div><div class="next-steps">'+nextSteps(s,weak,risk)+'</div></div></div><div class="stats grid">'+stat('จำนวนผลประเมิน',s.total||0,'รายการ','var(--cyan)')+stat('เจ้าหน้าที่ที่ถูกประเมิน',s.evaluated||0,'คน','var(--mint)')+stat('คะแนนเฉลี่ย',fmt(s.avgScore),'เต็ม 5','var(--amber)')+stat('หัวข้อโฟกัส',weak?esc(weak.shortTitle):'-',s.band||'-','var(--rose)')+'</div><div class="dash grid"><div class="panel"><div class="panel-head"><div><div class="panel-title">ผลงานเด่น</div><div class="mini">ใช้เป็นตัวอย่างมาตรฐานบริการ</div></div><button class="btn" onclick="view=\'people\';render()">ดูทั้งหมด</button></div><div class="rank">'+((s.top||[]).map((p,i)=>rankRow(p,i+1,false)).join('')||'<div class="empty">ไม่มีข้อมูล</div>')+'</div></div><div class="panel"><div class="panel-head"><div><div class="panel-title">คะแนนรายหัวข้อ</div><div class="mini">ค่าเฉลี่ยตามหัวข้อแบบประเมิน</div></div></div><div class="criteria-list">'+criteriaRows(s.criteriaAvg||{})+'</div></div><div class="panel"><div class="panel-head"><div><div class="panel-title">รายการที่ควรติดตาม</div><div class="mini">กลุ่มที่ควรได้รับการติดตาม</div></div></div><div class="rank">'+((s.risks||[]).map((p,i)=>rankRow(p,i+1,true)).join('')||'<div class="empty">ไม่มีรายการติดตาม</div>')+'</div></div><div class="panel"><div class="panel-head"><div><div class="panel-title">จำนวนรายการตามผลัด</div><div class="mini">จำนวนรายการประเมินของแต่ละผลัด</div></div></div>'+evaluatorBars(s.evaluators||{})+'</div></div>';
}
function nextSteps(s,weak,risk){const steps=[];steps.push('บันทึกผลประเมินให้ครบ โดยเฉพาะเจ้าหน้าที่ที่ยังไม่มีข้อมูลล่าสุด');if(weak)steps.push('ติดตามหัวข้อ '+esc(weak.shortTitle)+' เนื่องจากเป็นหัวข้อที่มีคะแนนต่ำสุด');steps.push(risk?'ติดตามผลกับ '+esc(risk.name)+' และทบทวนข้อเสนอแนะก่อนรอบถัดไป':'ใช้เจ้าหน้าที่ที่มีคะแนนดีเป็นตัวอย่างมาตรฐานบริการ');return steps.map((x,i)=>'<div class="step"><div class="step-num">'+(i+1)+'</div><div>'+x+'</div></div>').join('');}
function criteriaRows(vals){return criteria.map(c=>{const v=num(vals[c.key]);return '<div class="criteria-row"><b>'+c.no+'</b><div><div>'+esc(c.shortTitle)+'</div><div class="bar" style="margin-top:7px"><div class="fill" style="width:'+pct(v)+'%;background:linear-gradient(90deg,'+c.color+',var(--mint))"></div></div></div><span class="tag '+tone(v)+'">'+fmt(v)+'</span></div>';}).join('')||'<div class="empty">ไม่มีข้อมูล</div>';}
function rankRow(p,i,risk){return '<div class="rank-row"><div><div class="rank-name">'+i+'. '+esc(p.name)+'</div><div class="rank-meta">'+p.count+' รายการ | '+esc(p.band)+' | แนวโน้ม '+(p.trend>=0?'+':'')+p.trend.toFixed(2)+'</div><div class="bar" style="margin-top:8px"><div class="fill" style="width:'+pct(p.avg)+'%;background:'+(risk?'linear-gradient(90deg,var(--rose),var(--amber))':'linear-gradient(90deg,var(--cyan),var(--mint))')+'"></div></div></div><div class="score">'+fmt(p.avg)+'</div></div>';}
function evaluatorBars(obj){const rows=Object.entries(obj).sort((a,b)=>b[1]-a[1]),max=Math.max(1,...rows.map(x=>x[1]));return rows.map(([k,v])=>'<div class="kpi-line"><span>'+esc(k||'-')+'</span><b>'+v+'</b></div><div class="bar" style="margin-bottom:8px"><div class="fill" style="width:'+Math.round(v/max*100)+'%;background:linear-gradient(90deg,var(--violet),var(--cyan))"></div></div>').join('')||'<div class="empty">ไม่มีข้อมูล</div>';}
function radar(vals){const cx=150,cy=128,r=86,levels=[.25,.5,.75,1];let rings='',axes='',pts=[];levels.forEach(l=>{rings+='<polygon class="radar-grid" points="'+criteria.map((c,i)=>{const a=-Math.PI/2+i*2*Math.PI/criteria.length;return (cx+Math.cos(a)*r*l)+','+(cy+Math.sin(a)*r*l);}).join(' ')+'"/>';});criteria.forEach((c,i)=>{const a=-Math.PI/2+i*2*Math.PI/criteria.length,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r,lx=cx+Math.cos(a)*(r+34),ly=cy+Math.sin(a)*(r+24);axes+='<line x1="'+cx+'" y1="'+cy+'" x2="'+x+'" y2="'+y+'" class="radar-grid"/><text x="'+lx+'" y="'+ly+'" text-anchor="middle" class="radar-label">'+esc(c.no)+'</text>';pts.push((cx+Math.cos(a)*r*(num(vals[c.key])/5))+','+(cy+Math.sin(a)*r*(num(vals[c.key])/5)));});return '<svg viewBox="0 0 300 260" width="100%" height="280">'+rings+axes+'<polygon class="radar-poly" points="'+pts.join(' ')+'"/><circle cx="'+cx+'" cy="'+cy+'" r="3" fill="#fff"/></svg><div class="mini">'+criteria.map(c=>c.no+'. '+esc(c.shortTitle)).join(' | ')+'</div>';}

// ---------- รายการประเมิน ----------
function toolbar(){return '<div class="toolbar"><input class="input search" value="'+esc(filter)+'" oninput="filter=this.value;render()" placeholder="ค้นหาชื่อเจ้าหน้าที่ ผลัด หรือข้อเสนอแนะ"><span class="mini">'+data.records.length+' รายการ</span></div>';}
function renderEvaluations(){const rows=data.records.filter(r=>!filter||(r.staff+' '+r.evaluator+' '+r.comment).toLowerCase().includes(filter.toLowerCase()));$('content').innerHTML=toolbar()+'<div class="table-wrap"><table><thead><tr><th>เวลา</th><th>เจ้าหน้าที่</th><th>ผลัด</th><th>เฉลี่ย</th>'+criteria.map(c=>'<th>'+c.no+'</th>').join('')+'<th>ข้อเสนอแนะ</th><th></th></tr></thead><tbody>'+(rows.map(evalRow).join('')||'<tr><td colspan="11" class="empty">ไม่มีข้อมูล</td></tr>')+'</tbody></table></div>';}
function evalRow(r){return '<tr><td class="nowrap">'+esc(r.timestamp)+'</td><td><b>'+esc(r.staff)+'</b><div class="mini">'+esc(r.band)+'</div></td><td>'+esc(r.evaluator)+'</td><td><span class="tag '+tone(r.avg)+'">'+fmt(r.avg)+'</span></td>'+criteria.map(c=>'<td><span class="tag '+tone(r.scores[c.key].value)+'">'+esc(r.scores[c.key].label||'-')+'</span></td>').join('')+'<td class="comment">'+esc(r.comment||'-')+'</td><td class="nowrap">'+(can('edit_eval')?'<button class="btn icon" onclick="openEval('+r.rowNumber+')">แก้ไข</button> ':'')+(can('delete_eval')?'<button class="btn icon danger" onclick="deleteEval('+r.rowNumber+')">x</button>':'')+(!can('edit_eval')&&!can('delete_eval')?'<span class="mini">—</span>':'')+'</td></tr>';}

// ---------- สรุปรายเจ้าหน้าที่ ----------
function renderPeople(){const rows=data.people.filter(p=>!filter||p.name.toLowerCase().includes(filter.toLowerCase()));$('content').innerHTML='<div class="toolbar"><input class="input search" value="'+esc(filter)+'" oninput="filter=this.value;render()" placeholder="ค้นหาชื่อเจ้าหน้าที่"><span class="mini">'+data.people.length+' คน</span></div><div class="heat"><div class="head">เจ้าหน้าที่</div>'+criteria.map(c=>'<div class="head">'+c.no+'. '+esc(c.shortTitle)+'</div>').join('')+rows.map(p=>'<div><b>'+esc(p.name)+'</b><div class="mini">'+p.count+' รายการ | avg '+fmt(p.avg)+'</div></div>'+criteria.map(c=>heatCell(p.criteria[c.key])).join('')).join('')+'</div><div class="dash grid" style="margin-top:16px"><div class="panel"><div class="panel-head"><div><div class="panel-title">อันดับคะแนนรายเจ้าหน้าที่</div><div class="mini">เลือกเจ้าหน้าที่เพื่อดูรายละเอียด</div></div></div><div class="rank">'+(rows.map((p,i)=>'<button class="btn" style="justify-content:space-between" onclick="selectedStaff=\''+js(p.name)+'\';renderProfile()"><span>'+(i+1)+'. '+esc(p.name)+'</span><b>'+fmt(p.avg)+'</b></button>').join('')||'<div class="empty">ไม่มีข้อมูล</div>')+'</div></div><div class="panel" id="profilePanel"><div class="empty">เลือกเจ้าหน้าที่เพื่อดูรายละเอียด</div></div></div>';if(selectedStaff)renderProfile();}
function heatCell(v){const color=v>=4.6?'#84cc16':v>=3.8?'#2dd4bf':v>=3?'#f59e0b':v>=2?'#fb7185':'#ef4444';return '<div class="cell" style="color:'+color+'">'+(v?fmt(v):'-')+'</div>';}
function renderProfile(){const p=data.people.find(x=>x.name===selectedStaff);if(!p||!$('profilePanel'))return;$('profilePanel').innerHTML='<div class="panel-head"><div><div class="panel-title">'+esc(p.name)+'</div><div class="mini">'+p.count+' รายการ | '+esc(p.band)+' | ล่าสุด '+esc(p.latest||'-')+'</div></div>'+(can('view_reports')?'<button class="btn" onclick="downloadPdf(\''+js(p.name)+'\')">PDF</button>':'')+'</div>'+radar(p.criteria)+'<div class="kpi-line"><span>คะแนนเฉลี่ย</span><b>'+fmt(p.avg)+'</b></div><div class="kpi-line"><span>แนวโน้ม</span><b>'+(p.trend>=0?'+':'')+p.trend.toFixed(2)+'</b></div><div style="margin-top:12px;color:#334155;line-height:1.6">'+esc(p.lastComment||'ยังไม่มีข้อเสนอแนะ')+'</div>';}

// ---------- วิเคราะห์ภาพรวม ----------
function renderInsights(){const s=data.summary||{},weak=criteria.find(c=>c.key===s.lowestKey),risks=s.risks||[],keywords=keywordInsight(data.records.map(r=>r.comment).filter(Boolean).join(' '));const wd=data.people.filter(p=>p.count),maxAvg=wd.length?Math.max.apply(null,wd.map(p=>p.avg)):0,stars=wd.filter(p=>Math.abs(p.avg-maxAvg)<0.005);$('content').innerHTML='<div class="dash grid"><div class="panel"><div class="panel-head"><div><div class="panel-title">วิเคราะห์ภาพรวม</div><div class="mini">สรุปจากคะแนนและข้อเสนอแนะ</div></div></div><div class="insight"><div class="insight-card"><b>ภาพรวมทีม</b>คะแนนเฉลี่ยอยู่ที่ '+fmt(s.avgScore)+' / 5 ('+esc(s.band||'-')+') จาก '+(s.total||0)+' รายการ</div><div class="insight-card"><b>หัวข้อที่ควรติดตาม</b>'+(weak?esc(weak.shortTitle):'-')+' มีคะแนนเฉลี่ยต่ำสุด ควรใช้เป็นหัวข้อติดตามรอบถัดไป</div><div class="insight-card"><b>กลุ่มติดตาม</b>'+(risks.length?risks.map(p=>esc(p.name)+' ('+fmt(p.avg)+')').join(', '):'ไม่พบกลุ่มเสี่ยงจากคะแนน')+'</div><div class="insight-card"><b>เจ้าหน้าที่ต้นแบบ'+(stars.length>1?' ('+stars.length+' คน)':'')+'</b>'+(stars.length?stars.map(p=>esc(p.name)).join(', ')+' มีคะแนนนำที่ '+fmt(maxAvg)+(maxAvg>=4.995?' (คะแนนเต็ม)':'')+' สามารถใช้เป็นตัวอย่างมาตรฐานบริการ':'ยังไม่มีข้อมูลเพียงพอ')+'</div></div></div><div class="panel"><div class="panel-head"><div><div class="panel-title">คำสำคัญจากข้อเสนอแนะ</div><div class="mini">คำที่พบในข้อเสนอแนะ</div></div></div>'+(keywords.map(k=>'<div class="kpi-line"><span>'+esc(k.word)+'</span><b>'+k.count+'</b></div><div class="bar" style="margin-bottom:8px"><div class="fill" style="width:'+Math.min(100,k.count*18)+'%;background:linear-gradient(90deg,var(--amber),var(--rose))"></div></div>').join('')||'<div class="empty">ยังไม่มีข้อเสนอแนะ</div>')+'</div></div>';}
function keywordInsight(text){return ['รวดเร็ว','ช้า','ดี','ดีเยี่ยม','สุภาพ','สื่อสาร','เข้าใจ','แก้ไข','ช่วยเหลือ','พึงพอใจ','บริการ','ติดตาม','ปัญหา'].map(w=>({word:w,count:(text.match(new RegExp(w,'g'))||[]).length})).filter(x=>x.count).sort((a,b)=>b.count-a.count).slice(0,10);}

// ---------- คู่มือการใช้งาน (Help) ----------
function renderHelp(){
  const roleNow=user.isAdmin?'admin':(user.role||'senior');
  const sec=(t,b)=>'<div class="panel"><div class="panel-title">'+t+'</div><div style="line-height:1.75;color:#28384f">'+b+'</div></div>';
  const ul=a=>'<ul style="margin:6px 0 0;padding-left:20px;line-height:1.9">'+a.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
  const ol=a=>'<ol style="margin:6px 0 0;padding-left:20px;line-height:1.9">'+a.map(x=>'<li>'+x+'</li>').join('')+'</ol>';
  const scoreLines=scoreOptions.map(o=>o.label+'='+o.value).join(' · ');
  const critList=criteria.map(c=>c.no+'. <b>'+esc(c.shortTitle)+'</b> ('+esc(c.title)+')');
  let h='';
  h+=sec('คู่มือการใช้งานระบบ OSO Evaluation by IMM',
    'ระบบประเมินเจ้าหน้าที่ Onsite Support สำหรับสำนักงานตรวจคนเข้าเมือง<br>บัญชีที่คุณใช้อยู่มีสิทธิ์: <span class="tag neutral">'+esc(roleNow)+'</span><br><br>ระบบแบ่งเป็น 2 ส่วน:'+ul([
      '<b>หน้าแบบประเมิน (สาธารณะ)</b> — เจ้าหน้าที่ ตม. ให้คะแนนได้เลย ไม่ต้องล็อกอิน',
      '<b>ระบบหลังบ้าน</b> — Senior / Manager / Admin ล็อกอินเพื่อดูสรุป ทำรายงาน และจัดการข้อมูล'
    ]));
  const eff=(role,key)=>{const c=CAPS.find(x=>x.key===key);if(perms&&perms[role]&&perms[role][key]!==undefined)return !!perms[role][key];return c?!!c.def[role]:false;};
  const yn=b=>b?'✔':'—',ctr=v=>'<td style="text-align:center">'+v+'</td>';
  let prows='<tr><td>ส่งแบบประเมิน</td>'+ctr('✔')+ctr('✔')+ctr('✔')+ctr('✔')+'</tr>';
  prows+='<tr><td>ดูแดชบอร์ด / วิเคราะห์ (เข้าระบบ)</td>'+ctr('—')+ctr('✔')+ctr('✔')+ctr('✔')+'</tr>';
  CAPS.forEach(c=>{prows+='<tr><td>'+esc(c.label)+'</td>'+ctr('—')+ctr(yn(eff('senior',c.key)))+ctr(yn(eff('manager',c.key)))+ctr('✔')+'</tr>';});
  prows+='<tr><td><b>จัดการผู้ใช้ / จัดการสิทธิ์ / บันทึกการใช้งาน</b></td>'+ctr('—')+ctr('—')+ctr('—')+ctr('<b>✔</b>')+'</tr>';
  h+=sec('สิทธิ์การใช้งานแต่ละระดับ (ปัจจุบัน)',
    '<div class="table-wrap"><table style="min-width:auto"><thead><tr><th>ความสามารถ</th><th>ผู้ประเมิน<br>(สาธารณะ)</th><th>senior</th><th>manager</th><th>admin</th></tr></thead><tbody>'+prows+
    '</tbody></table></div><div class="mini" style="margin-top:8px">ตารางนี้แสดง<b>สิทธิ์ที่ใช้อยู่จริง</b>ในระบบ — admin ปรับได้ที่เมนู “จัดการสิทธิ์” และมีผลกับผู้ใช้ที่ออนไลน์อยู่<b>ทันที</b> · เมนูจัดการผู้ใช้ / จัดการสิทธิ์ / บันทึกการใช้งาน สงวนเฉพาะ admin</div>');
  h+=sec('เกณฑ์การให้คะแนน',
    '<b>5 หัวข้อการประเมิน:</b>'+ul(critList)+
    '<br><b>ระดับคะแนนแต่ละหัวข้อ:</b> '+scoreLines+
    '<br><b>ระดับผลรวม (เฉลี่ย):</b> ≥4.60 ดีเยี่ยม · ≥3.80 ดี · ≥3.00 พอใช้ · ≥2.00 ต้องปรับปรุง · ต่ำกว่า 2.00 ไม่ผ่าน');
  h+=sec('A. สำหรับผู้ประเมิน (เจ้าหน้าที่ ตม. — หน้าสาธารณะ ไม่ต้องล็อกอิน)',
    ol([
      'เปิดลิงก์ระบบ จะเข้าหน้าแบบประเมินทันที',
      'กรอก <b>ผลัด/ชื่อผู้ประเมิน</b> และเลือก <b>เจ้าหน้าที่ Onsite Support</b> ที่จะประเมิน (พิมพ์ใหม่ได้ถ้าไม่มีในรายการ)',
      'ให้คะแนนให้ครบ <b>ทั้ง 5 หัวข้อ</b> (ถ้าข้ามจะมีกรอบแดงเตือนและส่งไม่ได้)',
      'กรอกข้อเสนอแนะเพิ่มเติม (ไม่บังคับ)',
      'กด <b>ส่งแบบประเมิน</b> → ขึ้นหน้าขอบคุณ กด “ประเมินรายการถัดไป” เพื่อทำคนต่อไป'
    ]));
  h+=sec('B. สำหรับ Senior / Manager (หลังล็อกอิน)',
    'เมนูด้านซ้ายและหน้าที่ใช้งานได้:'+ul([
      '<b>1. แดชบอร์ด</b> — สรุปภาพรวม: คะแนนเฉลี่ย, เจ้าหน้าที่ที่ถูกประเมิน, หัวข้อที่ควรติดตาม, ผลงานเด่น, รายการที่ควรติดตาม, จำนวนตามผลัด, ข้อเสนอแนะถัดไป',
      '<b>2. รายการประเมิน</b> — ดูทุกรายการ ค้นหาได้ · กด <b>แก้ไข</b> เพื่อแก้คะแนน/ข้อเสนอแนะ · กด <b>x</b> เพื่อลบ',
      '<b>3. สรุปรายเจ้าหน้าที่</b> — ตารางความร้อนรายหัวข้อ · คลิกชื่อเพื่อดูโปรไฟล์ + กราฟ radar + แนวโน้ม · ปุ่ม <b>PDF</b> ออกรายงานรายคน',
      '<b>4. วิเคราะห์ภาพรวม</b> — สรุปเชิงวิเคราะห์ทีม + คำสำคัญที่พบในข้อเสนอแนะ',
      '<b>จัดการรายชื่อ</b> — เพิ่ม/ลบ ผลัดและเจ้าหน้าที่ · ปุ่ม <b>ล้างชื่อซ้ำ</b> · <b>นำเข้า CSV</b> จากชีตเดิม',
      '<b>Tools</b> — ออกรายงาน DOCX, ส่งออก CSV, รีเฟรช, เปลี่ยนรหัสผ่าน'
    ])+
    '<div class="mini" style="margin-top:8px">Senior/Manager ทำได้ทุกอย่างข้างต้น แต่ <b>ไม่เห็นเมนู “จัดการผู้ใช้ระบบ”</b></div>');
  h+=sec('C. สำหรับ Admin (เพิ่มเติมจาก Senior/Manager)',
    'admin ทำได้ทุกอย่างของ senior/manager และมีเมนูพิเศษ <b>จัดการผู้ใช้ระบบ</b>:'+ul([
      '<b>เพิ่มผู้ใช้</b> — ใส่ email + รหัสผ่าน + เลือกสิทธิ์ (admin/senior/manager) บัญชีถูกยืนยันอัตโนมัติ พร้อมใช้ทันที',
      '<b>เปลี่ยนสิทธิ์</b> — เลือกจาก dropdown ในตารางผู้ใช้',
      '<b>ลบบัญชี</b> — กดปุ่มลบ (ลบบัญชีตัวเองไม่ได้)',
      '<b>จัดการสิทธิ์</b> — กำหนดว่า senior/manager ทำอะไรได้ (แก้/ลบประเมิน, จัดการรายชื่อ, นำเข้า CSV, ออกรายงาน) · กดบันทึกแล้ว<b>มีผลทันที</b>กับผู้ใช้ที่ออนไลน์อยู่ (ไม่ต้องล็อกอินใหม่) · ฟังก์ชันใหม่ของระบบจะเพิ่มในตารางสิทธิ์อัตโนมัติ',
      '<b>บันทึกการใช้งานระบบ (Audit Log)</b> — ดูประวัติว่าใครเพิ่ม/แก้ไข/ลบ/นำเข้า/เข้าระบบ/เปลี่ยนสิทธิ์ เมื่อไหร่ (admin ดูได้คนเดียว ค้นหาได้)'
    ])+
    '<br><b>ข้อกำหนดรหัสผ่าน:</b> อย่างน้อย 6 ตัวอักษร ควรผสมตัวอักษร+ตัวเลข เลี่ยงตัวเลขล้วน เช่น Onsite@2026');
  h+=sec('D. รายงานและการส่งออก',
    ul([
      '<b>รายงาน DOCX</b> — เมนู Tools หรือปุ่มมุมขวาบน → เลือกประเภท <b>รายวัน (ระบุช่วงวันที่ผ่านปฏิทิน)</b> / <b>รายเดือน</b> / <b>รายปี</b> (ค่าเริ่มต้นเป็นปัจจุบัน) → ได้ไฟล์ Word: KPI + กราฟแท่ง + ตารางทุกหัวข้อ + รายบุคคล + ข้อเสนอแนะ',
      '<b>รายงาน PDF (รายคน)</b> — หน้าสรุปรายเจ้าหน้าที่ → คลิกชื่อ → ปุ่ม PDF → กด Ctrl+P เลือก “Save as PDF”',
      '<b>ส่งออก CSV</b> — เมนู Tools ได้ไฟล์ทุกรายการเปิดใน Excel ได้',
      '<b>ส่งรายงานทางอีเมล (PDF)</b> — ในหน้าต่างรายงาน กรอกอีเมลผู้รับ (หลายคนคั่นด้วย ,) → กด “ดูตัวอย่าง PDF” ตรวจก่อน → “ส่งอีเมล” แนบไฟล์ PDF (ต้องตั้งค่า SMTP ก่อน — ดู SEND-EMAIL.md)'
    ]));
  h+=sec('E. การเข้าระบบและรหัสผ่าน',
    ul([
      '<b>เข้าสู่ระบบ</b> — กด “เข้าสู่ระบบ” ที่หน้าแบบประเมิน → ใส่ email + รหัสผ่าน',
      '<b>ลืมรหัสผ่าน</b> — หน้า login กด “ลืมรหัสผ่าน?” ระบบส่งลิงก์ไปอีเมล → ตั้งรหัสใหม่',
      '<b>เปลี่ยนรหัสผ่าน</b> — เมนู Tools → เปลี่ยนรหัสผ่าน (ตอนล็อกอินอยู่)',
      '<b>ออกจากระบบ</b> — ปุ่มมุมขวาบน'
    ]));
  h+=sec('F. ปัญหาที่พบบ่อย',
    ul([
      '<b>ส่งแบบประเมินไม่ได้</b> — ให้คะแนนครบทั้ง 5 หัวข้อ และกรอกผลัด+ชื่อเจ้าหน้าที่แล้วหรือยัง',
      '<b>ล็อกอินไม่ได้</b> — ดูข้อความสีแดง: รหัสไม่ถูกต้อง / ยังไม่ยืนยันอีเมล (แจ้ง admin) / เชื่อมต่อไม่ได้ (เช็กเน็ต-ปิด VPN)',
      '<b>ข้อมูลไม่อัปเดต</b> — กดปุ่มรีเฟรชในระบบ',
      '<b>เห็นหน้าจอเป็นของเก่า</b> — กด Ctrl+F5 หรือเปิดหน้าต่างใหม่ (เคลียร์แคช)'
    ]));
  $('content').innerHTML=h;
}

// ---------- จัดการรายชื่อ ----------
async function renderDirectory(){
  $('content').innerHTML=LOADING;
  const [s,sh]=await Promise.all([sb.from('staff').select('*').order('name'),sb.from('shifts').select('*').order('name')]);
  if(s.error||sh.error){$('content').innerHTML='<div class="empty">โหลดรายชื่อไม่สำเร็จ</div>';return;}
  $('content').innerHTML='<div class="toolbar"><button class="btn" onclick="dedupNames()">🧹 ล้างชื่อซ้ำ</button><span class="mini">รวมชื่อที่เหมือนกัน (ไม่สนช่องว่าง/ตัวพิมพ์) ให้เหลือรายการเดียว</span></div><div class="dash grid">'+dirPanel('ผลัด / ผู้ประเมิน (เจ้าหน้าที่ ตม.)','shifts',sh.data||[])+dirPanel('เจ้าหน้าที่ Onsite Support','staff',s.data||[])+'</div>'+(can('import_csv')?importPanel():'');
}
async function dedupNames(){
  if(!confirm('ล้างชื่อซ้ำในตารางรายชื่อ (staff และ shifts)?\nจะรวมชื่อที่เหมือนกันให้เหลือรายการเดียว'))return;
  let removed=0;
  for(const table of ['staff','shifts']){
    const {data,error}=await sb.from(table).select('id,name').order('id');
    if(error)continue;
    const seen=new Set(),dupIds=[];
    (data||[]).forEach(r=>{const k=nkey(r.name);if(seen.has(k))dupIds.push(r.id);else seen.add(k);});
    if(dupIds.length){const {error:de}=await sb.from(table).delete().in('id',dupIds);if(!de)removed+=dupIds.length;}
  }
  toast(removed?('ล้างชื่อซ้ำแล้ว '+removed+' รายการ'):'ไม่พบชื่อซ้ำ');
  renderDirectory();
}

// ---------- จัดการผู้ใช้ระบบ (เฉพาะ admin, ผ่าน Edge Function) ----------
// เรียก Edge Function แล้วดึงข้อความ error จริงจาก response body
async function adminFn(body){
  try{
    const {data,error}=await sb.functions.invoke('admin-users',{body});
    if(error){let msg=error.message||'error';try{if(error.context&&typeof error.context.json==='function'){const j=await error.context.json();if(j&&j.error)msg=j.error;}}catch(_){}return {error:msg};}
    if(data&&data.error)return {error:data.error};
    return {data:data||{}};
  }catch(ex){return {error:String((ex&&ex.message)||ex)};}
}
async function renderUsers(){
  if(!user.isAdmin){toast('เฉพาะผู้ดูแลระบบ (admin)',true);view='dashboard';return render();}
  $('content').innerHTML=LOADING;
  const r=await adminFn({action:'list'});
  if(r.error){
    $('content').innerHTML='<div class="panel"><div class="panel-title">จัดการผู้ใช้ระบบ</div><div class="empty" style="text-align:left;line-height:1.7">เรียกใช้ Edge Function ไม่สำเร็จ<br><b>'+esc(r.error)+'</b><br><br>ตรวจว่า:<br>1) deploy ฟังก์ชัน <code>admin-users</code> แล้ว<br>2) ตั้งความลับ <code>ADMIN_EMAILS="'+esc(user.email)+'"</code><br>ดูรายละเอียดในไฟล์ USER-MANAGEMENT.md</div></div>';return;
  }
  const users=(r.data&&r.data.users)||[];
  const roleSel=(id,r)=>'<select onchange="setUserRole(\''+id+'\',this.value)" class="input" style="min-height:34px;width:auto;padding:4px 10px">'+['admin','senior','manager'].map(x=>'<option value="'+x+'"'+(x===r?' selected':'')+'>'+x+'</option>').join('')+'</select>';
  $('content').innerHTML=
    '<div class="panel"><div class="panel-head"><div><div class="panel-title">เพิ่มผู้ใช้ใหม่</div><div class="mini">สร้างบัญชีล็อกอิน + กำหนดสิทธิ์ (admin มีสิทธิ์จัดการผู้ใช้ / senior, manager ไม่มี)</div></div></div>'+
    '<div class="form-grid"><div class="field"><label class="label">Email</label><input class="input" id="nuEmail" type="email" placeholder="user@example.com"></div><div class="field"><label class="label">รหัสผ่าน</label><input class="input" id="nuPass" type="text" placeholder="เช่น Onsite@2026"></div></div>'+
    '<div class="mini" style="background:#f2f7ff;border:1px solid var(--line);border-radius:10px;padding:10px 13px;margin-top:8px;line-height:1.7">📌 <b>ข้อกำหนดรหัสผ่าน</b><br>• อย่างน้อย 6 ตัวอักษร<br>• ควรผสม <b>ตัวอักษร (a-z, A-Z)</b> กับ <b>ตัวเลข</b> และมีสัญลักษณ์จะยิ่งดี<br>• หลีกเลี่ยง<b>ตัวเลขล้วน</b>หรือรหัสที่เดาง่าย — ระบบความปลอดภัยของ Supabase อาจปฏิเสธ<br>• ตัวอย่างที่ใช้ได้: <code>Onsite@2026</code>, <code>Imm2026!ok</code></div>'+
    '<div style="display:flex;gap:10px;align-items:flex-end;margin-top:12px"><div class="field" style="margin:0"><label class="label">สิทธิ์</label><select class="input" id="nuRole" style="width:auto"><option value="senior">senior</option><option value="manager">manager</option><option value="admin">admin</option></select></div><button class="btn primary" onclick="addUser()">+ เพิ่มผู้ใช้</button></div></div>'+
    '<div class="panel" style="margin-top:16px"><div class="panel-title">ผู้ใช้ทั้งหมด ('+users.length+')</div><div class="table-wrap"><table><thead><tr><th>Email</th><th>สิทธิ์</th><th>เข้าระบบล่าสุด</th><th></th></tr></thead><tbody>'+
    (users.map(u=>'<tr><td><b>'+esc(u.email)+'</b>'+(u.email===user.email?' <span class="tag neutral">คุณ</span>':'')+'</td><td>'+roleSel(u.id,u.role)+'</td><td class="nowrap">'+esc(u.last_sign_in_at?new Date(u.last_sign_in_at).toLocaleString('th-TH'):'-')+'</td><td class="nowrap">'+(u.email===user.email?'':'<button class="btn danger sm" onclick="deleteUser(\''+u.id+'\',\''+js(u.email)+'\')">ลบ</button>')+'</td></tr>').join('')||'<tr><td colspan="4" class="empty">ไม่มีผู้ใช้</td></tr>')+
    '</tbody></table></div></div>';
}
async function addUser(){
  const raw=($('nuEmail').value||'');
  // กรองให้เหลือเฉพาะ ASCII printable (ตัด zero-width / homoglyph / ช่องว่าง / control chars)
  const email=raw.normalize('NFKC').replace(/[^\x21-\x7E]/g,'').toLowerCase();
  const pass=$('nuPass').value||'',role=$('nuRole').value;
  if(email!==raw.trim().toLowerCase())console.warn('cleaned email:',JSON.stringify(raw),'->',email);
  if(!/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(email))return toast('รูปแบบอีเมลไม่ถูกต้อง: '+(email||'(ว่าง)'),true);
  if(pass.length<6)return toast('รหัสผ่านอย่างน้อย 6 ตัวอักษร',true);
  const r=await adminFn({action:'create',email,password:pass,role});
  if(r.error)return toast('เพิ่มไม่สำเร็จ: '+r.error,true);
  logAction('user_create','user',email+' ('+role+')');
  toast('เพิ่มผู้ใช้ '+email+' ('+role+') แล้ว');renderUsers();
}
async function setUserRole(id,role){
  const r=await adminFn({action:'updateRole',id,role});
  if(r.error)return toast('เปลี่ยนสิทธิ์ไม่สำเร็จ: '+r.error,true);
  logAction('user_role','user',id+' → '+role);
  toast('อัปเดตสิทธิ์เป็น '+role+' แล้ว');
}
async function deleteUser(id,email){
  if(!confirm('ลบบัญชีผู้ใช้ '+email+'?'))return;
  const r=await adminFn({action:'delete',id});
  if(r.error)return toast('ลบไม่สำเร็จ: '+r.error,true);
  logAction('user_delete','user',email);
  toast('ลบผู้ใช้แล้ว');renderUsers();
}
// ===== หน้าบันทึกการใช้งานระบบ (Audit Log) — admin =====
async function renderAudit(){
  if(!user.isAdmin){toast('เฉพาะผู้ดูแลระบบ (admin)',true);view='dashboard';return render();}
  $('content').innerHTML=LOADING;
  const {data,error}=await sb.from('audit_log').select('*').order('created_at',{ascending:false}).limit(500);
  if(error){$('content').innerHTML='<div class="panel"><div class="panel-title">บันทึกการใช้งานระบบ</div><div class="empty" style="text-align:left;line-height:1.7">อ่านบันทึกไม่สำเร็จ: <b>'+esc(error.message)+'</b><br><br>ตรวจว่า:<br>1) รัน schema.sql (ตาราง audit_log) แล้ว<br>2) ตั้ง role=admin ใน app_metadata ของบัญชีคุณ (อยู่ใน schema.sql) แล้ว<b>ออก-เข้าระบบใหม่ 1 ครั้ง</b></div></div>';return;}
  const rows=data||[];
  const actMap={create:'เพิ่ม',update:'แก้ไข',delete:'ลบ',import:'นำเข้า',login:'เข้าระบบ',dedup:'ล้างชื่อซ้ำ',permissions:'แก้ไขสิทธิ์',user_create:'เพิ่มผู้ใช้',user_role:'เปลี่ยนสิทธิ์ผู้ใช้',user_delete:'ลบผู้ใช้',password:'เปลี่ยนรหัสผ่าน',email:'ส่งอีเมลรายงาน'};
  const f=(filter||'').toLowerCase();
  const view2=rows.filter(r=>!f||((r.actor||'')+' '+(r.action||'')+' '+(r.entity||'')+' '+(r.detail||'')).toLowerCase().includes(f));
  $('content').innerHTML='<div class="toolbar"><input class="input search" value="'+esc(filter)+'" oninput="filter=this.value;render()" placeholder="ค้นหาผู้ใช้ การกระทำ หรือรายละเอียด"><button class="btn" onclick="filter=\'\';renderAudit()">รีเฟรช</button><span class="mini">'+rows.length+' รายการล่าสุด</span></div>'+
    '<div class="table-wrap"><table><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>ส่วน</th><th>รายละเอียด</th></tr></thead><tbody>'+
    (view2.map(r=>'<tr><td class="nowrap">'+esc(new Date(r.created_at).toLocaleString('th-TH'))+'</td><td>'+esc(r.actor||'-')+'</td><td><span class="tag neutral">'+esc(actMap[r.action]||r.action)+'</span></td><td>'+esc(r.entity||'-')+'</td><td class="comment">'+esc(r.detail||'-')+'</td></tr>').join('')||'<tr><td colspan="5" class="empty">ยังไม่มีบันทึก</td></tr>')+
    '</tbody></table></div>';
}
// ===== หน้าจัดการสิทธิ์ — admin =====
function renderPerms(){
  if(!user.isAdmin){toast('เฉพาะผู้ดูแลระบบ (admin)',true);view='dashboard';return render();}
  const cell=(role,c)=>{const cur=(perms[role]&&perms[role][c.key]!==undefined)?!!perms[role][c.key]:!!c.def[role];return '<input type="checkbox" data-role="'+role+'" data-cap="'+c.key+'"'+(cur?' checked':'')+' style="width:18px;height:18px;cursor:pointer">';};
  $('content').innerHTML='<div class="panel"><div class="panel-head"><div><div class="panel-title">จัดการสิทธิ์การใช้งาน</div><div class="mini">กำหนดว่าแต่ละบทบาททำอะไรได้ · admin มีสิทธิ์ทุกอย่างเสมอ · ฟังก์ชันใหม่ของระบบจะเพิ่มในตารางนี้อัตโนมัติ</div></div><button class="btn primary" onclick="savePerms()">บันทึกสิทธิ์</button></div>'+
    '<div class="table-wrap"><table style="min-width:auto"><thead><tr><th>ความสามารถ</th><th style="text-align:center">senior</th><th style="text-align:center">manager</th><th style="text-align:center">admin</th></tr></thead><tbody>'+
    CAPS.map(c=>'<tr><td>'+esc(c.label)+'</td><td style="text-align:center">'+cell('senior',c)+'</td><td style="text-align:center">'+cell('manager',c)+'</td><td style="text-align:center">✔</td></tr>').join('')+
    '<tr style="opacity:.7"><td>จัดการผู้ใช้ระบบ</td><td style="text-align:center">—</td><td style="text-align:center">—</td><td style="text-align:center">✔</td></tr>'+
    '<tr style="opacity:.7"><td>ดูบันทึกการใช้งาน + จัดการสิทธิ์</td><td style="text-align:center">—</td><td style="text-align:center">—</td><td style="text-align:center">✔</td></tr>'+
    '</tbody></table></div><div class="mini" style="margin-top:8px">หมายเหตุ: เมนูจัดการผู้ใช้ / บันทึกการใช้งาน / จัดการสิทธิ์ สงวนไว้สำหรับ admin เท่านั้น (ปรับให้บทบาทอื่นไม่ได้)</div></div>';
}
async function savePerms(){
  const next={senior:{},manager:{}};
  document.querySelectorAll('#content input[type=checkbox][data-cap]').forEach(b=>{next[b.dataset.role][b.dataset.cap]=b.checked;});
  const {error}=await sb.from('app_settings').upsert({key:'permissions',value:next,updated_at:new Date().toISOString()},{onConflict:'key'});
  if(error)return toast('บันทึกไม่สำเร็จ: '+error.message,true);
  perms=next;logAction('permissions','permissions','update');applyRoleUI();toast('บันทึกสิทธิ์แล้ว');
}
const LABEL2NUM={'ดีเยี่ยม':5,'ดี':4,'พอใช้':3,'ต้องปรับปรุง':2,'ไม่ผ่าน':1};
function parseImportDate(s){
  s=String(s==null?'':s).trim();if(!s)return null;
  let d=new Date(s);if(!isNaN(d.getTime()))return d;
  // รูปแบบ วัน/เดือน/ปี [เวลา] (รองรับ พ.ศ.)
  const m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(m){let yr=+m[3];if(yr>2200)yr-=543;d=new Date(yr,+m[2]-1,+m[1],+(m[4]||0),+(m[5]||0),+(m[6]||0));if(!isNaN(d.getTime()))return d;}
  return null;
}
function importPanel(){return '<div class="panel" style="margin-top:16px"><div class="panel-title">นำเข้าข้อมูลเก่า (CSV จาก Google Sheets)</div><p class="mini" style="margin:6px 0 12px;line-height:1.6">ส่งออกชีตเดิมเป็น CSV แล้วอัปโหลดที่นี่ — ลำดับคอลัมน์: <b>เวลา, ผลัด/ผู้ประเมิน, เจ้าหน้าที่, 5 คะแนน, ข้อเสนอแนะ</b> (คะแนนเป็นตัวเลข 1-5 หรือคำว่า ดีเยี่ยม/ดี/พอใช้/ต้องปรับปรุง/ไม่ผ่าน ก็ได้ มีแถวหัวตารางได้)</p><div class="dir-add"><input type="file" id="csvFile" accept=".csv" class="input" style="padding-top:8px"><button class="btn primary" onclick="importCSV()">นำเข้า</button></div></div>';}
function parseCSV(text){const rows=[];let i=0,f='',row=[],q=false;text=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');while(i<text.length){const ch=text[i];if(q){if(ch==='"'){if(text[i+1]==='"'){f+='"';i+=2;continue;}q=false;i++;continue;}f+=ch;i++;continue;}if(ch==='"'){q=true;i++;continue;}if(ch===','){row.push(f);f='';i++;continue;}if(ch==='\n'){row.push(f);rows.push(row);row=[];f='';i++;continue;}f+=ch;i++;}if(f.length||row.length){row.push(f);rows.push(row);}return rows;}
// เทียบชื่อแบบ normalize: ตัดช่องว่างหัวท้าย, ยุบช่องว่างซ้ำ, ไม่สนตัวพิมพ์
function normName(s){return String(s==null?'':s).trim().replace(/\s+/g,' ');}
function nkey(s){return normName(s).toLowerCase();}
// เพิ่มชื่อใหม่ลงตาราง โดยข้ามชื่อที่ซ้ำกัน (เทียบแบบ normalize) — ใช้ได้เมื่อล็อกอินแล้ว
async function syncTable(table,list){
  const cand=[],seen=new Set();
  (list||[]).forEach(s=>{const n=normName(s);if(!n)return;const k=n.toLowerCase();if(!seen.has(k)){seen.add(k);cand.push(n);}});
  if(!cand.length)return;
  const {data:ex}=await sb.from(table).select('name');
  const existing=new Set((ex||[]).map(x=>nkey(x.name)));
  const toInsert=cand.filter(n=>!existing.has(n.toLowerCase())).map(name=>({name}));
  if(toInsert.length)await sb.from(table).insert(toInsert);
}
async function syncDirectories(staffList,shiftList){try{await syncTable('staff',staffList);await syncTable('shifts',shiftList);}catch(e){}}
async function importCSV(){
  const file=$('csvFile').files[0];if(!file)return toast('เลือกไฟล์ CSV ก่อน',true);
  const text=await file.text();let rows=parseCSV(text).filter(r=>r.length>1&&r.join('').trim()!=='');
  if(!rows.length)return toast('ไฟล์ว่าง',true);
  const toScore=v=>{v=String(v||'').trim();if(LABEL2NUM[v]!=null)return LABEL2NUM[v];const n=parseInt(v,10);return (n>=1&&n<=5)?n:null;};
  if(toScore(rows[0][3])==null)rows=rows.slice(1);
  const recs=[];let skipped=0;
  for(const r of rows){const ev=(r[1]||'').trim(),st=(r[2]||'').trim();const sc=[toScore(r[3]),toScore(r[4]),toScore(r[5]),toScore(r[6]),toScore(r[7])];if(!ev||!st||sc.some(x=>x==null)){skipped++;continue;}const dd=parseImportDate(r[0]);const rec={created_at:(dd||new Date()).toISOString(),evaluator:ev,staff:st,speed:sc[0],problem_solving:sc[1],communication:sc[2],service_mind:sc[3],satisfaction:sc[4],comment:(r[8]||'').trim()||null};recs.push(rec);}
  if(!recs.length)return toast('ไม่พบแถวข้อมูลที่ถูกต้อง (ข้าม '+skipped+')',true);
  let ok=0;for(let j=0;j<recs.length;j+=200){const {error}=await sb.from('evaluations').insert(recs.slice(j,j+200));if(error){toast('นำเข้าผิดพลาด: '+error.message,true);return;}ok+=Math.min(200,recs.length-j);}
  await syncDirectories(recs.map(r=>r.staff),recs.map(r=>r.evaluator));
  logAction('import','evaluation',ok+' รายการ');
  toast('นำเข้าสำเร็จ '+ok+' รายการ + อัปเดตรายชื่อแล้ว'+(skipped?(' (ข้าม '+skipped+')'):''));refresh();
}
function dirPanel(title,type,items){return '<div class="panel"><div class="panel-head"><div><div class="panel-title">'+esc(title)+'</div><div class="mini">'+items.length+' รายชื่อ</div></div></div><div class="dir-add"><input class="input" id="add_'+type+'" placeholder="พิมพ์ชื่อแล้วกดเพิ่ม" onkeydown="if(event.key===\'Enter\')addDir(\''+type+'\')"><button class="btn primary" onclick="addDir(\''+type+'\')">เพิ่ม</button></div><div class="dir-list">'+(items.map(it=>'<div class="dir-item"><span>'+esc(it.name)+'</span><button class="btn icon danger" title="ลบ" onclick="delDir(\''+type+'\','+it.id+')">x</button></div>').join('')||'<div class="empty">ยังไม่มีรายชื่อ</div>')+'</div></div>';}
async function addDir(type){const el=$('add_'+type),name=normName(el.value);if(!name)return toast('กรุณากรอกชื่อ',true);const {data:ex}=await sb.from(type).select('name');if((ex||[]).some(x=>nkey(x.name)===nkey(name)))return toast('มีรายชื่อ "'+name+'" อยู่แล้ว (ถือว่าซ้ำ)',true);const {error}=await sb.from(type).insert({name});if(error)return toast('เพิ่มไม่สำเร็จ: '+error.message,true);el.value='';logAction('create',type,name);toast('เพิ่มแล้ว');renderDirectory();}
async function delDir(type,id){if(!confirm('ลบรายชื่อนี้?'))return;const {error}=await sb.from(type).delete().eq('id',id);if(error)return toast('ลบไม่สำเร็จ: '+error.message,true);logAction('delete',type,'id='+id);toast('ลบแล้ว');renderDirectory();}
async function addStaff(){const name=prompt('ชื่อเจ้าหน้าที่ Onsite Support');if(!name)return;const {error}=await sb.from('staff').insert({name:name.trim()});if(error)return toast('เพิ่มไม่สำเร็จ',true);toast('เพิ่มแล้ว');refresh();}

// ---------- Modal แก้ไขผลประเมิน ----------
function openEval(row){editRow=Number(row||0);const rec=editRow?data.records.find(r=>r.rowNumber===editRow):null;$('evalTitle').textContent=rec?'แก้ไขผลประเมิน':'บันทึกผลประเมิน';$('fEvaluator').value=rec?rec.evaluator:'';$('fStaff').value=rec?rec.staff:(selectedStaff||'');$('fComment').value=rec?rec.comment:'';$('staffList').innerHTML=data.staffNames.map(x=>'<option value="'+esc(x)+'">').join('');$('evaluatorList').innerHTML=(data.shiftNames||[]).map(x=>'<option value="'+esc(x)+'">').join('');$('criteriaForm').innerHTML=criteria.map(c=>criterionHtml(c,rec)).join('');$('evalModal').classList.add('open');}
function criterionHtml(c,rec){const value=rec?rec.scores[c.key].label:'';return '<div class="criterion"><div style="display:flex;justify-content:space-between;gap:10px"><div><div class="criterion-title">'+c.no+'. '+esc(c.shortTitle)+'</div><div class="mini">'+esc(c.title)+'</div></div><span class="tag neutral" id="pill-'+c.key+'">'+(value||'-')+'</span></div><ul class="points">'+c.points.map(p=>'<li>'+esc(p)+'</li>').join('')+'</ul><div class="seg">'+scoreOptions.map(o=>'<button type="button" style="--tone:'+scoreColor(o.value)+'" class="'+(o.label===value?'active':'')+'" data-key="'+c.key+'" data-value="'+o.label+'" onclick="pickScore(this)">'+esc(o.label)+'</button>').join('')+'</div></div>';}
function pickScore(btn){const key=btn.dataset.key;document.querySelectorAll('button[data-key="'+key+'"]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');$('pill-'+key).textContent=btn.dataset.value;}
function closeEval(){$('evalModal').classList.remove('open');editRow=0;}
async function saveEval(){
  const row={evaluator:$('fEvaluator').value.trim(),staff:$('fStaff').value.trim(),comment:$('fComment').value.trim()||null};
  if(!row.staff)return toast('กรุณาระบุชื่อเจ้าหน้าที่ Onsite Support',true);
  let missing=false;criteria.forEach(c=>{const b=document.querySelector('button[data-key="'+c.key+'"].active');const v=b?SCORE_MAP[b.dataset.value]:0;row[c.key]=v||null;if(!v)missing=true;});
  if(missing)return toast('กรุณาให้คะแนนให้ครบทุกหัวข้อ',true);
  $('saveEvalBtn').disabled=true;
  let error;
  if(editRow){({error}=await sb.from('evaluations').update(row).eq('id',editRow));}
  else{({error}=await sb.from('evaluations').insert(row));}
  $('saveEvalBtn').disabled=false;
  if(error)return toast('บันทึกไม่สำเร็จ: '+error.message,true);
  await syncDirectories([row.staff],[row.evaluator]);
  logAction(editRow?'update':'create','evaluation',row.staff+' / '+row.evaluator);
  toast('บันทึกแล้ว');closeEval();refresh();
}
async function deleteEval(id){if(!confirm('ลบผลประเมินรายการนี้?'))return;const {error}=await sb.from('evaluations').delete().eq('id',id);if(error)return toast('ลบไม่สำเร็จ: '+error.message,true);logAction('delete','evaluation','id='+id);toast('ลบแล้ว');refresh();}

// ---------- ส่งออก CSV ----------
async function exportCSV(){
  await ensureFresh();
  const head=['เวลา','ผลัด/ผู้ประเมิน','เจ้าหน้าที่'].concat(criteria.map(c=>c.shortTitle),['คะแนนเฉลี่ย','ข้อเสนอแนะ']);
  const rows=data.records.map(r=>[r.timestamp,r.evaluator,r.staff].concat(criteria.map(c=>r.scores[c.key].value||''),[fmt(r.avg),r.comment||'']));
  const csv=[head].concat(rows).map(row=>row.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='OSO_Evaluation_'+new Date().toISOString().slice(0,10)+'.csv';a.click();toast('ส่งออกแล้ว');
}

/* ============================================================
   รายงาน DOCX รายเดือน (สร้างในเบราว์เซอร์ด้วย JSZip)
   ============================================================ */
function dEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');}
function dRun(text,o){o=o||{};const sz=Math.round((o.sz||22)*1.3);const rpr='<w:rPr><w:rFonts w:ascii="TH Sarabun New" w:hAnsi="TH Sarabun New" w:cs="TH Sarabun New"/>'+(o.bold?'<w:b/><w:bCs/>':'')+'<w:color w:val="'+(o.color||'1f2937')+'"/><w:sz w:val="'+sz+'"/><w:szCs w:val="'+sz+'"/></w:rPr>';const lines=String(text==null?'':text).split('\n');let out='';for(let i=0;i<lines.length;i++){if(i>0)out+='<w:r>'+rpr+'<w:br/></w:r>';out+='<w:r>'+rpr+'<w:t xml:space="preserve">'+dEsc(lines[i])+'</w:t></w:r>';}return out;}
function dPar(text,o){o=o||{};const jc=o.align?'<w:jc w:val="'+o.align+'"/>':'';const shd=o.fill?'<w:shd w:val="clear" w:color="auto" w:fill="'+o.fill+'"/>':'';return '<w:p><w:pPr><w:spacing w:before="'+(o.before||0)+'" w:after="'+(o.after==null?60:o.after)+'" w:line="276" w:lineRule="auto"/>'+jc+shd+'</w:pPr>'+dRun(text,o)+'</w:p>';}
function dHeading(text){return dPar(text,{sz:26,bold:true,color:'1749c4',before:200,after:80});}
function dCellPar(text,o){o=o||{};const shd=o.fill?'<w:shd w:val="clear" w:color="auto" w:fill="'+o.fill+'"/>':'';return '<w:p><w:pPr><w:spacing w:before="20" w:after="20"/>'+(o.align?'<w:jc w:val="'+o.align+'"/>':'')+shd+'</w:pPr>'+dRun(text,o)+'</w:p>';}
function dTable(rows,widths,headerFill){
  const grid='<w:tblGrid>'+widths.map(w=>'<w:gridCol w:w="'+w+'"/>').join('')+'</w:tblGrid>';
  const borders='<w:tblBorders><w:top w:val="single" w:sz="4" w:color="D0D7E5"/><w:left w:val="single" w:sz="4" w:color="D0D7E5"/><w:bottom w:val="single" w:sz="4" w:color="D0D7E5"/><w:right w:val="single" w:sz="4" w:color="D0D7E5"/><w:insideH w:val="single" w:sz="4" w:color="D0D7E5"/><w:insideV w:val="single" w:sz="4" w:color="D0D7E5"/></w:tblBorders>';
  const trs=rows.map((cells,ri)=>{const isH=ri===0;return '<w:tr>'+cells.map((cell,ci)=>{const fill=isH?(headerFill||'E8F0FC'):null;return '<w:tc><w:tcPr><w:tcW w:w="'+widths[ci]+'" w:type="dxa"/>'+(fill?'<w:shd w:val="clear" w:color="auto" w:fill="'+fill+'"/>':'')+'<w:vAlign w:val="center"/></w:tcPr>'+dCellPar(cell,{sz:20,bold:isH,color:isH?'0b2f6b':'1f2937'})+'</w:tc>';}).join('')+'</w:tr>';}).join('');
  return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>'+borders+'</w:tblPr>'+grid+trs+'</w:tbl>'+dPar('',{after:60});
}
function dKpiCards(cards){
  // แถวเดียว 4 ช่อง
  const w=Math.floor(9000/cards.length);
  const rows=[cards.map(c=>c[0]),cards.map(c=>c[1]),cards.map(c=>c[2])];
  // ทำเป็นตาราง 3 แถว (label / value / sub)
  const grid='<w:tblGrid>'+cards.map(()=>'<w:gridCol w:w="'+w+'"/>').join('')+'</w:tblGrid>';
  const mk=(arr,o)=>'<w:tr>'+arr.map(t=>'<w:tc><w:tcPr><w:tcW w:w="'+w+'" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F2F7FF"/></w:tcPr>'+dCellPar(t,o)+'</w:tc>').join('')+'</w:tr>';
  return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="DCE5F2"/><w:left w:val="single" w:sz="4" w:color="DCE5F2"/><w:bottom w:val="single" w:sz="4" w:color="DCE5F2"/><w:right w:val="single" w:sz="4" w:color="DCE5F2"/><w:insideH w:val="single" w:sz="4" w:color="DCE5F2"/><w:insideV w:val="single" w:sz="4" w:color="DCE5F2"/></w:tblBorders></w:tblPr>'+grid+mk(rows[0],{sz:18,color:'6a7d9b',align:'center'})+mk(rows[1],{sz:34,bold:true,color:'0b2f6b',align:'center'})+mk(rows[2],{sz:18,color:'6a7d9b',align:'center'})+'</w:tbl>'+dPar('',{after:80});
}
function chartCanvas(criteriaAvg){
  const cv=document.createElement('canvas');cv.width=620;cv.height=300;const g=cv.getContext('2d');
  g.fillStyle='#ffffff';g.fillRect(0,0,cv.width,cv.height);
  const pad=44,baseY=250,h=190,bw=70,gap=(cv.width-pad*2-bw*criteria.length)/(criteria.length-1);
  g.strokeStyle='#e2e8f0';g.fillStyle='#94a3b8';g.font='11px Tahoma';
  for(let i=0;i<=5;i++){const y=baseY-h*i/5;g.beginPath();g.moveTo(pad,y);g.lineTo(cv.width-pad,y);g.stroke();g.fillText(String(i),pad-18,y+4);}
  criteria.forEach((c,i)=>{const v=num(criteriaAvg[c.key]);const x=pad+i*(bw+gap);const bh=h*v/5;
    g.fillStyle=c.color;g.fillRect(x,baseY-bh,bw,bh);
    g.fillStyle='#0b2f6b';g.font='bold 13px Tahoma';g.textAlign='center';g.fillText(v.toFixed(2),x+bw/2,baseY-bh-6);
    g.fillStyle='#475569';g.font='12px Tahoma';g.fillText(String(c.no),x+bw/2,baseY+18);g.textAlign='left';});
  return cv;
}
function chartPng(criteriaAvg){const b64=chartCanvas(criteriaAvg).toDataURL('image/png').split(',')[1];const bin=atob(b64);const arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return arr;}
function dImage(){const cx=620*9525,cy=300*9525;return '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="120"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="1" name="chart"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="chart.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';}

function reportPeriod(ym){const now=new Date();const m=String(ym||'').match(/^(\d{4})-(\d{1,2})$/);const year=m?Number(m[1]):now.getFullYear();const month=m?Number(m[2])-1:now.getMonth();const start=new Date(year,month,1),end=new Date(year,month+1,1);return {start,end,label:THAI_MONTHS[start.getMonth()]+' '+(start.getFullYear()+543),fileKey:year+'-'+String(month+1).padStart(2,'0')};}

function thaiDate(d){return d.getDate()+' '+THAI_MONTHS[d.getMonth()]+' '+(d.getFullYear()+543);}
async function makeReport(startDate,endDate,periodWord,periodLabel,fileSuffix){
  if(typeof JSZip==='undefined')return toast('โหลด JSZip ไม่สำเร็จ',true);
  const now=new Date();
  await ensureFresh();
  const records=data.records.filter(r=>{const d=new Date(r.timestampRaw);return d>=startDate&&d<endDate;});
  const people=uniqueSort(records.map(r=>r.staff)).map(n=>summarizePerson(n,records)).sort((a,b)=>b.avg-a.avg);
  const s=summarizeOverall(records,people),weak=criteria.find(c=>c.key===s.lowestKey),best=s.top&&s.top[0],risk=(s.risks||[])[0];
  toast('กำลังสร้าง DOCX...');
  let body='';
  body+=dPar('รายงานประเมินเจ้าหน้าที่ Onsite Support สำหรับเจ้าหน้าที่ตรวจคนเข้าเมือง '+periodWord+' '+periodLabel,{sz:34,bold:true,color:'111827',align:'center',after:60});
  body+=dPar('รายงานผลการประเมินเจ้าหน้าที่ Onsite Support โดยเจ้าหน้าที่ตรวจคนเข้าเมือง',{sz:20,color:'374151',align:'center',after:200});
  body+=dTable([['รอบรายงาน',periodLabel],['วันที่จัดทำ',now.toLocaleString('th-TH')],['จัดทำโดย',user.displayName||user.email],['แหล่งข้อมูล','OSO Evaluation (Supabase)']],[2600,6400],'F2F7FF');
  body+=dHeading('Dashboard Summary');
  body+=dKpiCards([['จำนวนประเมิน',String(s.total),'รายการ'],['เจ้าหน้าที่',String(s.evaluated),'คน'],['คะแนนเฉลี่ย',s.avgScore.toFixed(2),s.band],['หัวข้อโฟกัส',weak?weak.shortTitle:'-',weak?(s.criteriaAvg[weak.key]||0).toFixed(2):'-']]);
  body+=dHeading('กราฟคะแนนเฉลี่ยรายหัวข้อ');
  body+=dImage();
  body+=dHeading('คะแนนเฉลี่ยรายหัวข้อ');
  body+=dTable([['ลำดับ','หัวข้อประเมิน','คะแนนเฉลี่ย','ระดับ']].concat(criteria.map(c=>{const a=s.criteriaAvg[c.key]||0;return [String(c.no),c.shortTitle,a.toFixed(2),scoreBand(a)];})),[900,4500,1800,1800]);
  body+=dHeading('ประเด็นที่ควรติดตาม');
  const fr=(s.risks||[]).map((p,i)=>[String(i+1),p.name,p.avg.toFixed(2),p.band]);
  body+=fr.length?dTable([['ลำดับ','ชื่อเจ้าหน้าที่','คะแนนเฉลี่ย','ระดับ']].concat(fr),[900,4600,1800,1700]):dPar('ไม่พบเจ้าหน้าที่ที่มีคะแนนเฉลี่ยต่ำกว่าเกณฑ์ติดตามในรอบรายงานนี้',{color:'6a7d9b'});
  body+=dHeading('จำนวนรายการประเมินตามผลัด');
  const er=Object.entries(s.evaluators||{}).sort((a,b)=>b[1]-a[1]).map((x,i)=>[String(i+1),x[0]||'-',String(x[1])]);
  body+=er.length?dTable([['ลำดับ','ผลัดของเจ้าหน้าที่ตม.','จำนวนรายการ']].concat(er),[900,6000,2100]):dPar('ไม่มีข้อมูลผลัดในรอบรายงานนี้',{color:'6a7d9b'});
  body+=dHeading('ข้อเสนอแนะเชิงบริหาร');
  [records.length?'กำหนดให้แต่ละผลัดบันทึกผลการประเมินอย่างต่อเนื่องทุกเดือน เพื่อให้ข้อมูลเพียงพอต่อการติดตามแนวโน้มรายบุคคล':'เริ่มบันทึกผลการประเมินประจำเดือนให้ครบถ้วนก่อนใช้รายงานประกอบการตัดสินใจ',weak?'จัด coaching หรือ sharing session ในหัวข้อ "'+weak.shortTitle+'" เนื่องจากเป็นหัวข้อที่มีคะแนนเฉลี่ยต่ำสุดในรอบรายงาน':'ติดตามคะแนนรายหัวข้อหลังมีข้อมูลประเมินเพิ่มเติม',best?'นำแนวปฏิบัติของ '+best.name+' มาใช้เป็นตัวอย่างหรือ buddy model เพื่อยกระดับมาตรฐานการให้บริการของทีม':'คัดเลือกเจ้าหน้าที่ต้นแบบหลังมีข้อมูลประเมินเพียงพอ',risk?'จัดทำแผนติดตามรายบุคคลสำหรับ '+risk.name+' พร้อมกำหนดเป้าหมายการปรับปรุงในรอบถัดไป':'คงการติดตามตามรอบปกติ และเน้นรักษามาตรฐานบริการให้สม่ำเสมอ'].forEach((t,i)=>{body+=dPar((i+1)+'. '+t,{fill:'F4F6F9',after:40});});
  body+=dHeading('รายละเอียดสรุปรายบุคคล');
  const pr=people.filter(p=>p.count).map((p,i)=>[String(i+1),p.name,String(p.count),p.avg.toFixed(2),p.band]);
  body+=pr.length?dTable([['ลำดับ','ชื่อเจ้าหน้าที่','จำนวนครั้ง','คะแนนเฉลี่ย','ระดับ']].concat(pr),[800,3600,1400,1500,1700]):dPar('ไม่มีข้อมูลรายบุคคลในรอบรายงานนี้',{color:'6a7d9b'});
  body+=dHeading('ข้อเสนอแนะทั้งหมดในรอบรายงาน');
  const cm=records.filter(r=>r.comment);
  if(cm.length)cm.forEach(r=>{body+=dPar(r.staff+' ('+r.evaluator+') — '+r.timestamp,{sz:18,bold:true,color:'0b2f6b',before:80,after:20});body+=dPar(r.comment,{fill:'F4F6F9'});});
  else body+=dPar('ไม่มีข้อเสนอแนะในรอบรายงานนี้',{color:'6a7d9b'});

  const docXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr></w:body></w:document>';
  const ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const drels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/chart1.png"/></Relationships>';
  const zip=new JSZip();
  zip.file('[Content_Types].xml',ct);
  zip.folder('_rels').file('.rels',rels);
  const word=zip.folder('word');word.file('document.xml',docXml);word.folder('_rels').file('document.xml.rels',drels);
  word.folder('media').file('chart1.png',chartPng(s.criteriaAvg||{}));
  const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='OSO_Evaluation_'+fileSuffix+'.docx';a.click();toast('สร้างรายงาน DOCX แล้ว');
}
// ---------- เลือกช่วงรายงาน (modal ปฏิทิน) ----------
function openReportModal(){
  const now=new Date(),p2=n=>String(n).padStart(2,'0');
  const today=now.getFullYear()+'-'+p2(now.getMonth()+1)+'-'+p2(now.getDate());
  $('rptMonth').value=now.getFullYear()+'-'+p2(now.getMonth()+1);
  $('rptFrom').value=today;$('rptTo').value=today;
  const yr=now.getFullYear();let yo='';for(let y=yr+1;y>=yr-6;y--)yo+='<option value="'+y+'"'+(y===yr?' selected':'')+'>'+(y+543)+' ('+y+')</option>';
  $('rptYear').innerHTML=yo;
  $('rptType').value='month';updateReportFields();
  $('reportModal').classList.add('open');
}
function closeReport(){$('reportModal').classList.remove('open');}
function updateReportFields(){const t=$('rptType').value;$('rpt_day').classList.toggle('hidden',t!=='day');$('rpt_month').classList.toggle('hidden',t!=='month');$('rpt_year').classList.toggle('hidden',t!=='year');}
function computePeriod(){
  const t=$('rptType').value;let start,end,word,label,suffix;
  if(t==='day'){
    const f=$('rptFrom').value,to=$('rptTo').value;if(!f||!to){toast('เลือกช่วงวันที่ก่อน',true);return null;}
    let sa=new Date(f+'T00:00:00'),eb=new Date(to+'T00:00:00');if(eb<sa){const x=sa;sa=eb;eb=x;}
    start=sa;end=new Date(eb.getTime()+86400000);
    if(sa.getTime()===eb.getTime()){word='ประจำวันที่';label=thaiDate(sa);}else{word='ระหว่างวันที่';label=thaiDate(sa)+' ถึง '+thaiDate(eb);}
    suffix='Daily_'+f+(f===to?'':('_to_'+to));
  }else if(t==='month'){
    const m=$('rptMonth').value;if(!m){toast('เลือกเดือนก่อน',true);return null;}
    const a=m.split('-').map(Number);start=new Date(a[0],a[1]-1,1);end=new Date(a[0],a[1],1);
    word='ประจำเดือน';label=THAI_MONTHS[a[1]-1]+' '+(a[0]+543);suffix='Monthly_'+m;
  }else{
    const y=Number($('rptYear').value);start=new Date(y,0,1);end=new Date(y+1,0,1);
    word='ประจำปี';label='พ.ศ. '+(y+543);suffix='Year_'+y;
  }
  return {start,end,word,label,suffix};
}
async function runReport(action){
  const p=computePeriod();if(!p)return;
  if(action==='preview')return previewReportPDF(p.start,p.end,p.word,p.label);
  if(action==='email')return emailReportPDF(p.start,p.end,p.word,p.label,p.suffix);
  closeReport();toast('กำลังสร้าง DOCX...');await makeReport(p.start,p.end,p.word,p.label,p.suffix);
}
// เรียก Edge Function แบบทั่วไป (ดึงข้อความ error จริง)
async function callFn(name,body){
  try{const {data,error}=await sb.functions.invoke(name,{body});
    if(error){let msg=error.message||'error';try{if(error.context&&typeof error.context.json==='function'){const j=await error.context.json();if(j&&j.error)msg=j.error;}}catch(_){}return {error:msg};}
    if(data&&data.error)return {error:data.error};return {data:data||{}};
  }catch(ex){return {error:String((ex&&ex.message)||ex)};}
}
// สร้างเนื้อหารายงานเป็น HTML (ใช้ทั้งพรีวิวและสร้าง PDF)
function periodData(start,end){
  const records=data.records.filter(r=>{const d=new Date(r.timestampRaw);return d>=start&&d<end;});
  const people=uniqueSort(records.map(r=>r.staff)).map(n=>summarizePerson(n,records)).sort((a,b)=>b.avg-a.avg);
  return {records,people,s:summarizeOverall(records,people)};
}
function reportStyles(){return '<style>*{box-sizing:border-box}body{font-family:"TH Sarabun New","Sarabun",Tahoma,sans-serif;color:#1f2937;font-size:16px;line-height:1.5;margin:0;padding:24px}h1{color:#1749c4;font-size:25px;text-align:center;margin:0 0 4px}.sub{text-align:center;color:#374151;margin:0 0 16px;font-size:15px}h2{color:#0b2f6b;font-size:18px;border-bottom:2px solid #e8f0fc;padding-bottom:4px;margin:18px 0 8px}table{border-collapse:collapse;width:100%;margin:6px 0;font-size:15px}th,td{border:1px solid #d0d7e5;padding:6px 9px;text-align:left;vertical-align:top}thead th{background:#e8f0fc;color:#0b2f6b}.meta th{width:130px;background:#f2f7ff}.kpis{display:flex;gap:10px;margin:8px 0}.kpi{flex:1;border:1px solid #dce5f2;border-radius:8px;padding:10px;text-align:center;background:#f8fbff}.kpi .n{font-size:22px;font-weight:700;color:#0b2f6b}ul{margin:6px 0;padding-left:20px}li{margin-bottom:6px}@media print{.noprint{display:none}body{padding:10mm}}</style>';}
function buildReportInner(start,end,word,label){
  const {records,people,s}=periodData(start,end);
  const weak=criteria.find(c=>c.key===s.lowestKey),best=s.top&&s.top[0],risk=(s.risks||[])[0];
  const tbl=(head,rows)=>'<table><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="'+head.length+'" style="text-align:center;color:#888">ไม่มีข้อมูล</td></tr>')+'</tbody></table>';
  const chartUrl=chartCanvas(s.criteriaAvg||{}).toDataURL('image/png');
  let h='<h1>รายงานประเมินเจ้าหน้าที่ Onsite Support สำหรับเจ้าหน้าที่ตรวจคนเข้าเมือง '+esc(word)+' '+esc(label)+'</h1>';
  h+='<p class="sub">รายงานผลการประเมินเจ้าหน้าที่ Onsite Support โดยเจ้าหน้าที่ตรวจคนเข้าเมือง</p>';
  h+='<table class="meta"><tbody><tr><th>รอบรายงาน</th><td>'+esc(label)+'</td></tr><tr><th>วันที่จัดทำ</th><td>'+esc(new Date().toLocaleString('th-TH'))+'</td></tr><tr><th>จัดทำโดย</th><td>'+esc(user.displayName||user.email)+'</td></tr><tr><th>แหล่งข้อมูล</th><td>OSO Evaluation (Supabase)</td></tr></tbody></table>';
  h+='<h2>Dashboard Summary</h2><div class="kpis"><div class="kpi"><div class="n">'+s.total+'</div><div>จำนวนประเมิน (รายการ)</div></div><div class="kpi"><div class="n">'+s.evaluated+'</div><div>เจ้าหน้าที่ (คน)</div></div><div class="kpi"><div class="n">'+fmt(s.avgScore)+'</div><div>คะแนนเฉลี่ย ('+esc(s.band)+')</div></div><div class="kpi"><div class="n" style="font-size:17px">'+(weak?esc(weak.shortTitle):'-')+'</div><div>หัวข้อโฟกัส ('+(weak?fmt(s.criteriaAvg[weak.key]||0):'-')+')</div></div></div>';
  h+='<h2>กราฟคะแนนเฉลี่ยรายหัวข้อ</h2><div style="text-align:center;margin:6px 0"><img src="'+chartUrl+'" style="max-width:640px;width:100%;border:1px solid #e2e8f0;border-radius:8px"></div>';
  h+='<h2>คะแนนเฉลี่ยรายหัวข้อ</h2>'+tbl(['ลำดับ','หัวข้อประเมิน','คะแนนเฉลี่ย','ระดับ'],criteria.map(c=>{const a=s.criteriaAvg[c.key]||0;return [c.no,esc(c.shortTitle),fmt(a),esc(scoreBand(a))];}));
  h+='<h2>ประเด็นที่ควรติดตาม</h2>'+tbl(['ลำดับ','ชื่อเจ้าหน้าที่','คะแนนเฉลี่ย','ระดับ'],(s.risks||[]).map((p,i)=>[i+1,esc(p.name),fmt(p.avg),esc(p.band)]));
  h+='<h2>จำนวนรายการประเมินตามผลัด</h2>'+tbl(['ลำดับ','ผลัดของเจ้าหน้าที่ตม.','จำนวนรายการ'],Object.entries(s.evaluators||{}).sort((a,b)=>b[1]-a[1]).map((x,i)=>[i+1,esc(x[0]||'-'),x[1]]));
  const recs=[records.length?'กำหนดให้แต่ละผลัดบันทึกผลการประเมินอย่างต่อเนื่องทุกเดือน เพื่อให้ข้อมูลเพียงพอต่อการติดตามแนวโน้มรายบุคคล':'เริ่มบันทึกผลการประเมินประจำเดือนให้ครบถ้วนก่อนใช้รายงานประกอบการตัดสินใจ',weak?'จัด coaching หรือ sharing session ในหัวข้อ "'+weak.shortTitle+'" เนื่องจากเป็นหัวข้อที่มีคะแนนเฉลี่ยต่ำสุดในรอบรายงาน':'ติดตามคะแนนรายหัวข้อหลังมีข้อมูลประเมินเพิ่มเติม',best?'นำแนวปฏิบัติของ '+best.name+' มาใช้เป็นตัวอย่างหรือ buddy model เพื่อยกระดับมาตรฐานการให้บริการของทีม':'คัดเลือกเจ้าหน้าที่ต้นแบบหลังมีข้อมูลประเมินเพียงพอ',risk?'จัดทำแผนติดตามรายบุคคลสำหรับ '+risk.name+' พร้อมกำหนดเป้าหมายการปรับปรุงในรอบถัดไป':'คงการติดตามตามรอบปกติ และเน้นรักษามาตรฐานบริการให้สม่ำเสมอ'];
  h+='<h2>ข้อเสนอแนะเชิงบริหาร</h2><ol>'+recs.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol>';
  h+='<h2>รายละเอียดสรุปรายบุคคล</h2>'+tbl(['ลำดับ','ชื่อเจ้าหน้าที่','จำนวนครั้ง','คะแนนเฉลี่ย','ระดับ'],people.filter(p=>p.count).map((p,i)=>[i+1,esc(p.name),p.count,fmt(p.avg),esc(p.band)]));
  const cm=records.filter(r=>r.comment);
  h+='<h2>ข้อเสนอแนะทั้งหมดในรอบรายงาน</h2>'+(cm.length?'<ul>'+cm.map(r=>'<li><b>'+esc(r.staff)+'</b> ('+esc(r.evaluator)+') — '+esc(r.timestamp)+'<br>'+esc(r.comment)+'</li>').join('')+'</ul>':'<p style="color:#888">ไม่มีข้อเสนอแนะในรอบรายงานนี้</p>');
  return h;
}
async function previewReportPDF(start,end,word,label){
  await ensureFresh();
  const w=window.open('','_blank');if(!w)return toast('เบราว์เซอร์บล็อก popup',true);
  const html='<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>ตัวอย่างรายงาน</title>'+reportStyles()+'</head><body><div style="max-width:820px;margin:0 auto">'+buildReportInner(start,end,word,label)+'<div class="noprint" style="text-align:center;margin:22px 0"><button onclick="window.print()" style="padding:10px 22px;font-size:15px;background:#2563eb;color:#fff;border:0;border-radius:8px;cursor:pointer">🖨 พิมพ์ / บันทึกเป็น PDF</button></div></div></body></html>';
  w.document.write(html);w.document.close();
}
async function emailReportPDF(start,end,word,label,suffix){
  const to=($('rptEmail').value||'').trim();
  if(!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+([,;]\s*[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+)*$/.test(to))return toast('กรอกอีเมลผู้รับให้ถูกต้อง (หลายอีเมลคั่นด้วย , )',true);
  if(typeof html2pdf==='undefined')return toast('โหลดตัวสร้าง PDF ไม่สำเร็จ ลองรีเฟรช',true);
  await ensureFresh();toast('กำลังสร้าง PDF...');
  const wrap=document.createElement('div');wrap.style.cssText='position:fixed;left:-9999px;top:0;width:820px;background:#fff';
  wrap.innerHTML=reportStyles()+'<div>'+buildReportInner(start,end,word,label)+'</div>';
  document.body.appendChild(wrap);
  try{
    const opt={margin:8,image:{type:'jpeg',quality:0.95},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}};
    const durl=await html2pdf().set(opt).from(wrap).outputPdf('datauristring');
    const b64=durl.split(',')[1],fname='OSO_Evaluation_'+suffix+'.pdf';
    toast('กำลังส่งอีเมล...');
    const r=await callFn('send-report',{to:to,subject:'รายงานประเมินเจ้าหน้าที่ Onsite Support '+word+' '+label,filename:fname,pdfBase64:b64,message:'เรียน ผู้เกี่ยวข้อง\n\nแนบรายงานประเมินเจ้าหน้าที่ Onsite Support '+word+' '+label+' (ไฟล์ PDF)\n\nจัดทำโดย '+(user.displayName||user.email)});
    if(r.error)return toast('ส่งไม่สำเร็จ: '+r.error,true);
    logAction('email','report',to+' / '+label);toast('ส่งอีเมลแล้ว → '+to);closeReport();
  }catch(e){toast('สร้าง/ส่ง PDF ไม่สำเร็จ: '+((e&&e.message)||e),true);}
  finally{document.body.removeChild(wrap);}
}

/* ============================================================
   รายงานรายเจ้าหน้าที่ (PDF ผ่านการพิมพ์ของเบราว์เซอร์)
   ============================================================ */
async function downloadPdf(name){
  const w=window.open('','_blank');
  if(!w)return toast('เบราว์เซอร์บล็อก popup — อนุญาตก่อนแล้วลองใหม่',true);
  try{w.document.write('<!DOCTYPE html><meta charset="UTF-8"><body style="font-family:Tahoma,sans-serif;padding:24px;color:#334">กำลังเตรียมรายงานฉบับล่าสุด...</body>');}catch(_){}
  await ensureFresh();
  const p=data.people.find(x=>x.name===name);
  if(!p){try{w.close();}catch(_){}return toast('ไม่พบเจ้าหน้าที่',true);}
  const comments=data.records.filter(r=>r.staff===name&&r.comment).slice(0,5);
  const rowsHtml=criteria.map(c=>'<tr><td>'+esc(c.shortTitle)+'</td><td style="text-align:center">'+fmt(p.criteria[c.key])+'</td><td style="text-align:center">'+esc(scoreBand(p.criteria[c.key]))+'</td></tr>').join('');
  const cHtml=comments.length?comments.map(r=>'<li>'+esc(r.timestamp)+' — '+esc(r.comment)+'</li>').join(''):'<li style="color:#888">ยังไม่มีข้อเสนอแนะ</li>';
  const html='<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>รายงาน '+esc(name)+'</title>'+
    '<style>body{font-family:"TH Sarabun New","Sarabun",Tahoma,sans-serif;color:#1f2937;margin:32px;line-height:1.5;font-size:17px}h1{color:#1749c4;font-size:24px;margin:0 0 4px}.sub{color:#374151;margin:0 0 18px}.kpi{display:flex;gap:12px;margin:14px 0}.card{flex:1;border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#f8fafc}.card b{display:block;color:#0b2f6b;font-size:20px}.card span{color:#6a7d9b;font-size:12px}table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #d0d7e5;padding:8px 10px;font-size:14px}th{background:#e8f0fc;color:#0b2f6b;text-align:left}h2{color:#0b2f6b;font-size:15px;margin:18px 0 6px}ul{margin:6px 0;padding-left:20px}@media print{body{margin:14mm}}</style></head><body>'+
    '<h1>รายงานประเมินเจ้าหน้าที่ Onsite Support</h1><p class="sub">สำหรับเจ้าหน้าที่ตรวจคนเข้าเมือง</p>'+
    '<div class="kpi"><div class="card"><b>'+esc(name)+'</b><span>เจ้าหน้าที่ Onsite Support</span></div><div class="card"><b>'+fmt(p.avg)+' / 5</b><span>คะแนนเฉลี่ย ('+esc(p.band)+')</span></div><div class="card"><b>'+p.count+'</b><span>จำนวนครั้งที่ประเมิน</span></div></div>'+
    '<h2>คะแนนเฉลี่ยรายหัวข้อ</h2><table><thead><tr><th>หัวข้อ</th><th style="text-align:center">คะแนนเฉลี่ย</th><th style="text-align:center">ระดับ</th></tr></thead><tbody>'+rowsHtml+'</tbody></table>'+
    '<h2>ข้อเสนอแนะล่าสุด</h2><ul>'+cHtml+'</ul>'+
    '<p style="color:#888;font-size:12px;margin-top:24px">จัดทำเมื่อ '+new Date().toLocaleString('th-TH')+' — กด Ctrl+P เพื่อบันทึกเป็น PDF</p>'+
    '<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script></body></html>';
  w.document.open();w.document.write(html);w.document.close();
}
