// รัน: ต้องมี playwright-core + jszip ใน node_modules (npm i playwright-core jszip ที่โฟลเดอร์ชั่วคราว แล้ว NODE_PATH=<path>/node_modules node test-summary.cjs). OUT=โฟลเดอร์เก็บ docx/png
// Browser e2e for summary-report.js: real Edge, mocked Supabase, real canvas + JSZip + DOCX output
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.env.SITE || 'D:/Ai Tools/Claude/OSO Evaluation by IMM/Github';
const OUT = process.env.OUT || require('os').tmpdir();
const mime = {'.html':'text/html','.js':'text/javascript','.png':'image/png','.css':'text/css'};
const srv = http.createServer((q,r)=>{ let p=decodeURIComponent(q.url.split('?')[0]); if(p==='/')p='/index.html'; const f=path.join(ROOT,p); fs.readFile(f,(e,b)=>{ if(e){r.writeHead(404);r.end();return;} r.writeHead(200,{'content-type':(mime[path.extname(f)]||'application/octet-stream')+'; charset=utf-8'}); r.end(b); }); });
let fails = 0; const ok=(c,m)=>{ if(!c){fails++;console.log('FAIL',m);} else console.log('ok  ',m); };

(async()=>{
  await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
  const br = await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const pg = await (await br.newContext({viewport:{width:1280,height:900},locale:'th-TH'})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  // ไม่ให้เขียน/อ่านข้อมูลจริง
  await pg.route(/supabase\.co/,r=>r.abort());
  await pg.goto('http://localhost:'+port+'/',{waitUntil:'domcontentloaded'});
  await pg.waitForFunction(()=>typeof JSZip!=='undefined'&&window.appsSummaryApi&&window.__sumTest,null,{timeout:30000});

  await pg.evaluate(()=>{
    const rnd=(()=>{let s=7;return()=> (s=(s*16807)%2147483647)/2147483647;})();
    const staff=['สมชาย ใจดี','สมหญิง รักงาน','วิชัย มั่นคง','นภา สดใส','ประเสริฐ ตั้งใจ','มาลี ศรีสุข','อนันต์ เก่งกาจ','กมล ขยันดี'];
    const shifts=['ผลัด 1','ผลัด 2','ผลัด 3','ผลัด 4'];
    const keys=['speed','problem_solving','communication','service_mind','satisfaction'];
    const ev=[]; let id=1;
    [[2026,6],[2026,7],[2026,8]].forEach(([y,m],mi)=>{ for(let i=0;i<22;i++){ const row={id:id++,created_at:new Date(y,m,3+i).toISOString(),evaluator:shifts[i%4],staff:staff[(i*3+mi)%8],comment:i%7===0?'ให้บริการดี รวดเร็ว #'+id:''};
      keys.forEach(k=>{ const b=staff.indexOf(row.staff)===7?2:4; row[k]=Math.max(1,Math.min(5,Math.round(b+(rnd()-.4)*2+mi*.2))); }); ev.push(row); } });
    window.__ev=ev;
    const ag=['เจ้าหน้าที่ตำรวจตรวจคนเข้าเมือง (IMMIGRATION)','เจ้าหน้าที่ศุลกากร (CUSTOMS)','ท่าอากาศยานเชียงราย (CEI)','ท่าอากาศยานสมุย (USM)'];
    const du=['1-6 เดือน','6 เดือน - 1 ปี','1-3 ปี','มากกว่า 3 ปี'];
    const ap=[]; [[2026,7],[2026,8]].forEach(([y,m],mi)=>{ for(let i=0;i<18;i++){ const r={id:ap.length+1,created_at:new Date(y,m,2+i).toISOString(),agency:ag[i%4],duration:du[i%4],suggestion:i%6===0?'อยากให้ตอบเร็วขึ้น':'-'};
      ['s1_1','s1_2','s1_3','s2_1','s2_2','s2_3','s2_4','s2_5','s2_6','s2_7'].forEach(k=>{ r[k]=Math.max(1,Math.min(4,Math.round(3.3+(rnd()-.5)*2.4-(k==='s2_7'?1:0)))); }); ap.push(r); } });
    window.__ap=ap;
    const sn=['นางสาวณัฏฐา บัวศรีจันทร์ (แนน)','นายธีธัช ทีรฆาภิบาล (เบส)'], stf=['สมชาย ใจดี','สมหญิง รักงาน','วิชัย มั่นคง','นภา สดใส'];
    const SK=['troubleshooting','accuracy','communication','service_mind','case_handling','housekeeping'];
    const se=[]; [[2026,5],[2026,6],[2026,7],[2026,8]].forEach(([y,m],mi)=>{ for(let i=0;i<5;i++){ const r={id:se.length+1,created_at:new Date(y,m,2+i*3).toISOString(),senior:sn[i%2],staff:stf[(i+mi)%4],comment:i===1?'ทำงานได้ดี \'ทดสอบ\' มีเครื่องหมายคำพูด':''}; SK.forEach(k=>r[k]=Math.max(1,Math.min(5,Math.round(4+(rnd()-.5)*2-(r.staff===stf[3]?1.6:0))))); se.push(r); } });
    window.__se=se; window.__ins=[]; window.__del=[]; window.__sn=sn.map((n,i)=>({id:i+1,name:n})); window.__stf=stf.map((n,i)=>({id:i+1,name:n}));
    sb={from(t){ const src={apps_surveys:window.__ap,evaluations:window.__ev,senior_evaluations:window.__se,senior_names:window.__sn,staff:window.__stf}; const d=src[t]||[]; const q={select(){return q;},order(){return q;},range(a,b){return Promise.resolve({data:d.slice(a,b+1),error:null});},then(res,rej){return Promise.resolve({data:d,error:null}).then(res,rej);},insert(r){ window.__ins.push([t,r]); return Promise.resolve({error:null}); },delete(){ return {eq(c,v){ window.__del.push([t,c,v]); return Promise.resolve({error:null}); }}; }}; return q; }};
  });
  await pg.evaluate(async()=>{
    hideAll(); $('app').classList.add('ready');
    setUser({email:'tester@x.th',app_metadata:{role:'admin'}}); user.displayName='ผู้ทดสอบ';
    data=await loadData(); hydrateUser();
  });
  // ---- หน้าจอ Onsite ----
  await pg.evaluate(()=>{ const b=document.querySelector('[data-view="sum_onsite"]'); showView('sum_onsite',b); });
  await pg.waitForSelector('#on_c canvas');
  ok(await pg.locator('.nav-title',{hasText:'สรุปผลประเมิน'}).count()===1,'nav group present');
  ok(await pg.locator('button[data-view="sum_onsite"].active').count()===1,'onsite menu active');
  ok((await pg.textContent('#pageTitle')).includes('Onsite'),'title onsite');
  ok(await pg.locator('#content canvas').count()>=5,'onsite >=5 canvases ('+await pg.locator('#content canvas').count()+')');
  await pg.setViewportSize({width:1280,height:3200}); await pg.waitForTimeout(300); await pg.screenshot({path:path.join(OUT,'shot-onsite.png')}); await pg.setViewportSize({width:1280,height:900});
  // เลย์เอาต์สมดุล: การ์ดกราฟในแถวเดียวกันกว้างเท่ากัน อยู่แถวเดียวกัน และกราฟไม่ล้นการ์ด
  async function layoutOk(label){ const r=await pg.evaluate(()=>{ const rows=[...document.querySelectorAll('.sum-grid')].map(g=>{ const cs=[...g.querySelectorAll('.sum-card')]; const rc=cs.map(c=>c.getBoundingClientRect()); const cv=cs.map(c=>c.querySelector('canvas')).filter(Boolean).map(c=>c.getBoundingClientRect()); return {n:cs.length,sameTop:rc.every(x=>Math.abs(x.top-rc[0].top)<2),sameW:rc.length<2||rc.every(x=>Math.abs(x.width-rc[0].width)<2),sameH:rc.length<2||rc.every(x=>Math.abs(x.height-rc[0].height)<2),fit:cv.every((x,i)=>x.right<=rc[i].right+1&&x.left>=rc[i].left-1),filled:cs.length===cv.length,cvw:cv.map(x=>Math.round(x.width))}; }); return {rows,hscroll:document.documentElement.scrollWidth>document.documentElement.clientWidth+2}; });
    ok(r.rows.length>=3,label+' grid rows '+r.rows.length); ok(r.rows.every(x=>x.sameTop&&x.sameW&&x.sameH&&x.fit&&x.filled),label+' cards aligned/equal/fit '+JSON.stringify(r.rows.map(x=>x.cvw))); ok(!r.hscroll,label+' no horizontal scroll'); }
  await layoutOk('onsite@1280');
  // เลือกเดือน
  await pg.setViewportSize({width:1280,height:3200}); await pg.waitForTimeout(300); await pg.screenshot({path:path.join(OUT,'shot-onsite.png')}); await pg.setViewportSize({width:1280,height:900});
  await pg.selectOption('#content select','2026-07');
  await pg.waitForSelector('#on_c canvas');
  ok((await pg.textContent('#content')).includes('กรกฎาคม 2569'),'period month label (Thai BE)');
  // ---- หน้าจอ APPS ----
  await pg.evaluate(()=>{ const b=document.querySelector('[data-view="sum_apps"]'); showView('sum_apps',b); });
  await pg.waitForSelector('#ap_1p canvas');
  ok((await pg.textContent('#pageTitle')).includes('APPS'),'title apps');
  await layoutOk('apps@1280');
  ok(await pg.locator('#content canvas').count()>=7,'apps >=7 canvases ('+await pg.locator('#content canvas').count()+')');
  await pg.setViewportSize({width:1280,height:4600}); await pg.waitForTimeout(300); await pg.screenshot({path:path.join(OUT,'shot-apps.png')}); await pg.setViewportSize({width:1280,height:900});
  // เมนูเดิมยังทำงาน
  await pg.evaluate(()=>showView('dashboard',document.querySelector('[data-view="dashboard"]')));
  ok((await pg.textContent('#pageTitle'))==='แดชบอร์ด','old dashboard still renders');
  await pg.evaluate(()=>showView('apps_dashboard',document.querySelector('[data-view="apps_dashboard"]')));
  await pg.waitForSelector('#appsC_1p canvas'); ok(true,'old APPS dashboard still renders');
  await layoutOk('old-apps-dashboard@1280'); await pg.setViewportSize({width:1920,height:1080}); await pg.waitForTimeout(700); await pg.waitForSelector('#appsC_1p canvas'); await layoutOk('old-apps-dashboard@1920'); await pg.screenshot({path:path.join(OUT,'shot-old-apps-1920.png'),fullPage:false});
  await pg.evaluate(()=>showView('sum_onsite',document.querySelector('[data-view="sum_onsite"]'))); await pg.waitForTimeout(500); await layoutOk('onsite@1920'); await pg.setViewportSize({width:1280,height:900}); await pg.waitForTimeout(700); await layoutOk('onsite@1280-after-resize');
  await pg.setViewportSize({width:420,height:900}); await pg.waitForTimeout(800); ok(!(await pg.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2)),'no horizontal scroll at 420px'); await pg.screenshot({path:path.join(OUT,'shot-mobile.png')}); await pg.setViewportSize({width:1280,height:900});

  // ---- แดชบอร์ด: กราฟแนวโน้มทุกเดือน (รวมกรณีเดือนเยอะ) ----
  await pg.evaluate(()=>showView('dashboard',document.querySelector('[data-view="dashboard"]')));
  await pg.waitForSelector('#dash_tr canvas'); ok(true,'Onsite dashboard has all-months trend (3 months)');
  await pg.evaluate(()=>showView('apps_dashboard',document.querySelector('[data-view="apps_dashboard"]')));
  await pg.waitForSelector('#appsC_tr canvas'); ok(true,'APPS dashboard has all-months trend');
  await pg.evaluate(async()=>{ const ev=[]; let id=1000; for(let m=0;m<26;m++){ const d=new Date(2024,m,5); ['A','B'].forEach((n,i)=>{ const row={id:id++,created_at:d.toISOString(),evaluator:'ผลัด 1',staff:'ทดสอบ '+n,comment:''}; ['speed','problem_solving','communication','service_mind','satisfaction'].forEach(k=>row[k]=Math.max(1,Math.min(5,Math.round(3+Math.sin(m/2)+i*.5)))); ev.push(row); }); } window.__ev=window.__ev.concat(ev); data=await loadData(); });
  await pg.evaluate(()=>showView('dashboard',document.querySelector('[data-view="dashboard"]'))); await pg.waitForSelector('#dash_tr canvas');
  const dn=await pg.evaluate(()=>({pts:__sumTest.onsiteCompute('all').monthly.length}));
  ok(dn.pts>=26,'monthly series is not capped at 12 ('+dn.pts+' months)');
  await pg.locator('#dash_tr').screenshot({path:path.join(OUT,'shot-trend-many.png')});
  // ================= Senior ประเมิน Onsite =================
  ok(await pg.locator('[data-view="sum_senior"]').count()===1&&await pg.locator('[data-view="senior_list"]').count()===1,'senior menus present (summary + list)');
  // รายการ
  await pg.evaluate(()=>showView('senior_list',document.querySelector('[data-view="senior_list"]')));
  await pg.waitForSelector('table tbody tr');
  ok((await pg.locator('table tbody tr').count())===20,'senior list shows 20 rows ('+await pg.locator('table tbody tr').count()+')');
  ok((await pg.textContent('#pageTitle')).includes('Senior'),'senior list title');
  await pg.fill('.toolbar input.search','ธีธัช'); await pg.waitForTimeout(150);
  ok((await pg.locator('table tbody tr').count())===8,'senior list search filters (by senior name)');
  pg.once('dialog',d=>d.accept()); await pg.locator('table tbody tr').first().locator('button').click(); await pg.waitForTimeout(300);
  ok((await pg.evaluate(()=>window.__del.length))===1&&(await pg.evaluate(()=>window.__del[0][0]))==='senior_evaluations','senior delete calls senior_evaluations.delete');
  // สรุป
  await pg.evaluate(()=>showView('sum_senior',document.querySelector('[data-view="sum_senior"]')));
  await pg.waitForSelector('#on_c canvas');
  ok((await pg.textContent('#pageTitle')).includes('Senior'),'senior summary title');
  ok((await pg.locator('#content canvas').count())>=5,'senior summary canvases ('+await pg.locator('#content canvas').count()+')');
  ok((await pg.textContent('#content')).includes('Senior ผู้ประเมิน'),'senior summary labels evaluators as Senior');
  ok((await pg.textContent('#content')).includes('เอกสาร'),'senior summary uses the 6 Senior criteria');
  await layoutOk('senior@1280');
  const crit6=await pg.evaluate(()=>({n:criteria.length,k:criteria[0].key})); ok(crit6.n===5&&crit6.k==='speed','global criteria restored after senior render (no leak)');
  await pg.setViewportSize({width:1280,height:3400}); await pg.waitForTimeout(300); await pg.screenshot({path:path.join(OUT,'shot-senior.png')}); await pg.setViewportSize({width:1280,height:900});
  {
    const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:30000}),pg.click('#sumExportBtn_senior')]);
    const f=path.join(OUT,'OSO_Summary_Senior.docx'); await dl.saveAs(f);
    ok(dl.suggestedFilename().startsWith('OSO_Summary_Senior_'),'senior docx name '+dl.suggestedFilename());
    const JSZip=require('jszip'); const z=await JSZip.loadAsync(fs.readFileSync(f)); const d=await z.file('word/document.xml').async('string'); const txt=d.replace(/<[^>]+>/g,'|');
    ['Dashboard Summary','โดย Senior','ประเด็นที่ควรติดตาม','จำนวนรายการประเมินตาม Senior ผู้ประเมิน','ข้อเสนอแนะเชิงบริหาร','รายละเอียดสรุปรายบุคคล','ข้อเสนอแนะทั้งหมดในรอบรายงาน','OSO Evaluation — Senior Evaluation'].forEach(k=>ok(txt.includes(k),'senior docx has: '+k));
    const tbls=d.split('<w:tbl>').slice(1).map(x=>x.split('</w:tbl>')[0]);
    ok(tbls.every(x=>/<w:tblW w:w="10106" w:type="dxa"\/><w:jc w:val="center"\/>/.test(x)),'senior docx tables full width + centred');
    ok([...d.matchAll(/<wp:extent cx="(\d+)"/g)].every(m=>+m[1]===673*9525)&&(d.match(/<wp:extent/g)||[]).length>=4,'senior docx images full width');
    ok(txt.includes('มีเครื่องหมายคำพูด'),'senior docx keeps comment with quotes');
    for(const f2 of Object.keys(z.files)) if(/\.(xml|rels)$/.test(f2)) { const x=await z.file(f2).async('string'); if(!x.startsWith('<?xml')) ok(false,'xml header '+f2); }
  }
  // หน้าสาธารณะ ?form=senior
  {
    const pg2=await (await br.newContext({viewport:{width:420,height:900},locale:'th-TH'})).newPage(); const e2=[]; pg2.on('pageerror',e=>e2.push(String(e)));
    await pg2.route(/supabase\.co/,r=>r.abort());
    await pg2.goto('http://localhost:'+port+'/?form=senior',{waitUntil:'domcontentloaded'});
    await pg2.waitForSelector('#seniorForm',{timeout:30000});
    ok(await pg2.evaluate(()=>getComputedStyle(document.getElementById('pubSwitchBar')).display==='none'),'deep link hides the tab bar');
    ok(await pg2.evaluate(()=>document.getElementById('pubForm').classList.contains('hidden')&&!document.getElementById('seniorFormHost').classList.contains('hidden')),'only senior form visible');
    ok((await pg2.textContent('#pubHeroTitle')).includes('Senior'),'banner says Senior');
    ok(await pg2.locator('[data-scard]').count()===6,'form has 6 criteria cards');
    await pg2.evaluate(()=>{ window.__ins=[]; sb={from(t){ const d=t==='senior_names'?[{name:'นายธีธัช ทีรฆาภิบาล (เบส)'}]:t==='staff'?[{name:'นายปวริศ พบหิรัญ (โต๊ด)'}]:[]; const q={select(){return q;},order(){return q;},then(a,b){return Promise.resolve({data:d,error:null}).then(a,b);},insert(r){ window.__ins.push([t,r]); return Promise.resolve({error:null}); }}; return q; }}; seniorReset(); });
    await pg2.waitForFunction(()=>document.querySelectorAll('#senSenior option').length===2&&document.querySelectorAll('#senStaff option').length===2);
    ok(true,'dropdowns filled from senior_names + staff');
    await pg2.click('#senSubmit'); await pg2.waitForTimeout(200);
    ok((await pg2.evaluate(()=>window.__ins.length))===0,'submit without selections is blocked');
    await pg2.selectOption('#senSenior',{index:1}); await pg2.selectOption('#senStaff',{index:1});
    for(const k of ['troubleshooting','accuracy','communication','service_mind','case_handling']) await pg2.click('#senCriteria button[data-sk="'+k+'"][data-value="5"]');
    await pg2.click('#senSubmit'); await pg2.waitForTimeout(200);
    ok((await pg2.evaluate(()=>window.__ins.length))===0&&await pg2.locator('.pub-crit.invalid').count()===1,'submit with 5/6 criteria blocked + highlights the missing one');
    ok((await pg2.textContent('#senProg')).trim()==='5 จาก 6','progress shows 5 of 6');
    await pg2.waitForTimeout(3500); await pg2.screenshot({path:path.join(OUT,'shot-senior-form-fill.png'),fullPage:true});
    await pg2.click('#senCriteria button[data-sk="housekeeping"][data-value="3"]'); await pg2.fill('#senComment','ข้อเสนอแนะ \'ทดสอบ\'');
    await pg2.click('#senSubmit'); await pg2.waitForSelector('#seniorThanks:not(.hidden)');
    const ins=await pg2.evaluate(()=>window.__ins);
    ok(ins.length===1&&ins[0][0]==='senior_evaluations','inserts into senior_evaluations once');
    const row=ins[0][1]; ok(row.senior.includes('ธีธัช')&&row.staff.includes('ปวริศ')&&row.troubleshooting===5&&row.case_handling===5&&row.housekeeping===3&&row.comment==="ข้อเสนอแนะ 'ทดสอบ'",'payload correct '+JSON.stringify(row));
    ok(await pg2.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2),'public form no horizontal scroll @420');
    await pg2.screenshot({path:path.join(OUT,'shot-senior-form.png'),fullPage:true});
    ok(e2.length===0,'no page errors on public senior page '+e2.join('|'));
    // tab (without deep link) on normal page
    await pg2.goto('http://localhost:'+port+'/',{waitUntil:'domcontentloaded'}); await pg2.waitForSelector('[data-pubtab="senior"]');
    await pg2.click('[data-pubtab="senior"]'); await pg2.waitForSelector('#seniorForm');
    ok(await pg2.evaluate(()=>document.getElementById('pubForm').classList.contains('hidden')&&document.querySelector('[data-pubtab="senior"]').classList.contains('active')),'tab switches to senior');
    await pg2.click('[data-pubtab="onsite"]');
    ok(await pg2.evaluate(()=>!document.getElementById('pubForm').classList.contains('hidden')&&document.getElementById('seniorFormHost').classList.contains('hidden')),'tab back to onsite hides senior form');
    await pg2.click('[data-pubtab="apps"]');
    ok(await pg2.evaluate(()=>document.getElementById('seniorFormHost').classList.contains('hidden')&&!document.getElementById('appsFormHost').classList.contains('hidden')),'tab to apps still works');
    await pg2.context().close();
  }
  // QR + directory
  await pg.evaluate(()=>openQrModal()); await pg.waitForTimeout(400);
  ok((await pg.textContent('#qrUrlSenior')).includes('?form=senior')&&await pg.locator('#qrSenior img, #qrSenior canvas').count()>0,'QR modal shows senior link + QR');
  await pg.evaluate(()=>closeQrModal());
  await pg.evaluate(()=>showView('directory',document.querySelector('[data-view="directory"]'))); await pg.waitForTimeout(500);
  ok((await pg.textContent('#content')).includes('Senior ผู้ประเมิน'),'directory has Senior list panel');
  // ---- DOCX จริงผ่านปุ่ม (ดักการดาวน์โหลด) ----
  for(const [kind,view,name] of [['onsite','sum_onsite','Onsite'],['apps','sum_apps','APPS']]){
    await pg.evaluate(v=>showView(v,document.querySelector('[data-view="'+v+'"]')),view);
    await pg.waitForSelector('#sumExportBtn_'+kind);
    const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:30000}),pg.click('#sumExportBtn_'+kind)]);
    const f=path.join(OUT,'OSO_Summary_'+name+'.docx'); await dl.saveAs(f);
    ok(dl.suggestedFilename().startsWith('OSO_Summary_'+name+'_'),'download name '+dl.suggestedFilename());
    { const JSZip=require('jszip'); const z=await JSZip.loadAsync(fs.readFileSync(f)); const d=await z.file('word/document.xml').async('string');
      const tbls=d.split('<w:tbl>').slice(1).map(x=>x.split('</w:tbl>')[0]);
      ok(tbls.length>=3,name+' tables '+tbls.length);
      ok(tbls.every(t=>/<w:tblW w:w="10106" w:type="dxa"\/><w:jc w:val="center"\/>/.test(t)),name+' every table is 10106 wide + centred');
      ok(tbls.every(t=>{ const g=[...t.matchAll(/<w:gridCol w:w="(\d+)"/g)].map(m=>+m[1]).reduce((a,b)=>a+b,0); return g===10106; }),name+' every grid sums to 10106');
      ok(tbls.every(t=>{ const rows=t.split('<w:tr>').slice(1); return rows.every(r=>[...r.matchAll(/<w:tcW w:w="(\d+)"/g)].map(m=>+m[1]).reduce((a,b)=>a+b,0)===10106); }),name+' every row of cells sums to 10106');
      { const txt=d.replace(/<[^>]+>/g,'|'); const need=['รอบรายงาน','วันที่จัดทำ','จัดทำโดย','แหล่งข้อมูล','Dashboard Summary','ประเด็นที่ควรติดตาม','ข้อเสนอแนะเชิงบริหาร',name==='APPS'?'รายละเอียดสรุปรายหน่วยงาน':'รายละเอียดสรุปรายบุคคล',name==='APPS'?'จำนวนผู้ประเมินตามหน่วยงาน':'จำนวนรายการประเมินตามผลัด','ข้อเสนอแนะ'];
        need.forEach(k=>ok(txt.includes(k),name+' docx has section/field: '+k)); }
      ok([...d.matchAll(/<wp:extent cx="(\d+)"/g)].every(m=>+m[1]===673*9525),name+' every image is full content width (673px)');
      ok(!/<w:pgMar[^>]*w:left="(?!900)/.test(d)&&/w:pgSz w:w="11906"/.test(d)&&/w:left="900"/.test(d)&&/w:right="900"/.test(d),name+' page 11906 - 2x900 margins = 10106'); }
    ok(fs.statSync(f).size>20000,name+' docx size '+fs.statSync(f).size);
  }
  // ป้ายชื่อยาวต้องไม่ล้นความกว้าง (ไม่ทับแท่งกราฟ)
  const wr=await pg.evaluate(()=>{ const {g}=__sumTest.mk(620,10); g.font='12px Tahoma, "Noto Sans Thai", sans-serif';
    const T=['2. ระบบมีประโยชน์สามารถช่วยสนับสนุนภารกิจของหน่วยงานได้','4. คู่มือการใช้งานช่วยเพิ่มความเข้าใจในการใช้งานระบบให้กับเจ้าหน้าที่','7. การแจ้งข้อมูลข่าวสารการ Upgrade ระบบ (วิธีการ / ความชัดเจน / เข้าใจง่าย)','ก'.repeat(300)];
    return T.map(t=>{ const L=__sumTest.wrapTH(g,t,200,2); return {n:L.length,max:Math.max(...L.map(l=>g.measureText(l).width))}; }); });
  ok(wr.every(x=>x.n<=2&&x.max<=200.5),'wrapTH never exceeds width/lines '+JSON.stringify(wr));
  // ข้อเสนอแนะเชิงบริหาร: หลายคนได้ 5.00 → รายชื่อย่อย; ไม่มีใครต่ำกว่าเกณฑ์ → ข้อความคงมาตรฐาน
  const rec=await pg.evaluate(()=>{ const mk=(avg)=>({recs:[],people:[{name:'A',count:1,avg},{name:'B',count:2,avg},{name:'C',count:1,avg}],s:{total:4,evaluated:3,avgScore:avg,band:'x',criteriaAvg:{},lowestKey:'speed',top:[{name:'A',avg}],risks:[],evaluators:{}}}); const r=__sumTest.onsiteSections(mk(5)); return {subs:(r.recs.find(x=>x.subs)||{}).subs, last:r.recs[r.recs.length-1].text, followEmpty:r.follow.rows.length}; });
  ok(rec.subs&&rec.subs.length===3,'recs list all 5.00 staff as sub-bullets'); ok(rec.last.includes('คงการติดตามตามรอบปกติ')&&rec.followEmpty===0,'no risks -> keep-standard recommendation');
  // ช่วงเดือน + ว่างเปล่า
  const emptyOk=await pg.evaluate(async()=>{ const r=await __sumTest.buildOnsiteDocx('2020-01'); const r2=await __sumTest.buildAppsDocx('2020-01'); return !!r&&!!r2; });
  ok(emptyOk,'docx builds with empty period (onsite+apps)');
  ok(errs.length===0,'no page errors '+errs.join('|'));
  await br.close(); srv.close();
  console.log(fails?('FAILED '+fails):'ALL PASSED'); process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
