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
    sb={from(t){ const d=t==='apps_surveys'?window.__ap:t==='evaluations'?window.__ev:[]; return {select(){ const p=Promise.resolve({data:d,error:null}); p.order=()=>Promise.resolve({data:d,error:null}); return p; }}; }};
  });
  await pg.evaluate(async()=>{
    hideAll(); $('app').classList.add('ready');
    setUser({email:'tester@x.th',app_metadata:{role:'admin'}}); user.displayName='ผู้ทดสอบ';
    data=await loadData(); hydrateUser();
  });
  // ---- หน้าจอ Onsite ----
  await pg.evaluate(()=>{ const b=document.querySelector('[data-view="sum_onsite"]'); showView('sum_onsite',b); });
  await pg.waitForSelector('#sumOn_c canvas');
  ok(await pg.locator('.nav-title',{hasText:'สรุปผลประเมิน'}).count()===1,'nav group present');
  ok(await pg.locator('button[data-view="sum_onsite"].active').count()===1,'onsite menu active');
  ok((await pg.textContent('#pageTitle')).includes('Onsite'),'title onsite');
  ok(await pg.locator('#content canvas').count()>=5,'onsite >=5 canvases ('+await pg.locator('#content canvas').count()+')');
  await pg.setViewportSize({width:1280,height:3200}); await pg.waitForTimeout(300); await pg.screenshot({path:path.join(OUT,'shot-onsite.png')}); await pg.setViewportSize({width:1280,height:900});
  // เลือกเดือน
  await pg.setViewportSize({width:1280,height:3200}); await pg.waitForTimeout(300); await pg.screenshot({path:path.join(OUT,'shot-onsite.png')}); await pg.setViewportSize({width:1280,height:900});
  await pg.selectOption('#content select','2026-07');
  await pg.waitForSelector('#sumOn_c canvas');
  ok((await pg.textContent('#content')).includes('กรกฎาคม 2569'),'period month label (Thai BE)');
  // ---- หน้าจอ APPS ----
  await pg.evaluate(()=>{ const b=document.querySelector('[data-view="sum_apps"]'); showView('sum_apps',b); });
  await pg.waitForSelector('#sumAp_1p canvas');
  ok((await pg.textContent('#pageTitle')).includes('APPS'),'title apps');
  ok(await pg.locator('#content canvas').count()>=7,'apps >=7 canvases ('+await pg.locator('#content canvas').count()+')');
  await pg.setViewportSize({width:1280,height:4600}); await pg.waitForTimeout(300); await pg.screenshot({path:path.join(OUT,'shot-apps.png')}); await pg.setViewportSize({width:1280,height:900});
  // เมนูเดิมยังทำงาน
  await pg.evaluate(()=>showView('dashboard',document.querySelector('[data-view="dashboard"]')));
  ok((await pg.textContent('#pageTitle'))==='แดชบอร์ด','old dashboard still renders');
  await pg.evaluate(()=>showView('apps_dashboard',document.querySelector('[data-view="apps_dashboard"]')));
  await pg.waitForSelector('#appsChartS1c canvas'); ok(true,'old APPS dashboard still renders');

  // ---- DOCX จริงผ่านปุ่ม (ดักการดาวน์โหลด) ----
  for(const [kind,view,name] of [['onsite','sum_onsite','Onsite'],['apps','sum_apps','APPS']]){
    await pg.evaluate(v=>showView(v,document.querySelector('[data-view="'+v+'"]')),view);
    await pg.waitForSelector('#sumExportBtn_'+kind);
    const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:30000}),pg.click('#sumExportBtn_'+kind)]);
    const f=path.join(OUT,'OSO_Summary_'+name+'.docx'); await dl.saveAs(f);
    ok(dl.suggestedFilename().startsWith('OSO_Summary_'+name+'_'),'download name '+dl.suggestedFilename());
    ok(fs.statSync(f).size>20000,name+' docx size '+fs.statSync(f).size);
  }
  // ช่วงเดือน + ว่างเปล่า
  const emptyOk=await pg.evaluate(async()=>{ const r=await __sumTest.buildOnsiteDocx('2020-01'); const r2=await __sumTest.buildAppsDocx('2020-01'); return !!r&&!!r2; });
  ok(emptyOk,'docx builds with empty period (onsite+apps)');
  ok(errs.length===0,'no page errors '+errs.join('|'));
  await br.close(); srv.close();
  console.log(fails?('FAILED '+fails):'ALL PASSED'); process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
