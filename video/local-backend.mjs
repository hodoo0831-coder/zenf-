/**
 * 로컬 시험 백엔드 — 실제 Worker 코드(wash-db · pbox-orikon-db · wh-stack)를 그대로 불러와
 * node:sqlite 로 만든 D1 흉내 위에서 돌리고, 브라우저의 workers.dev 요청을 이쪽으로 돌린다.
 * 데모 영상에서 "작업자 앱에 입력 → 관리자 화면에 자동 반영" 을 실제 코드로 보여주기 위한 것이다.
 * 여기 들어가는 값은 시연용 샘플이며 실제 현장 데이터가 아니다.
 */
import {DatabaseSync} from 'node:sqlite';
import path from 'path';
import {fileURLToPath,pathToFileURL} from 'url';
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');

/* ── D1 인터페이스 흉내: prepare().bind().first()/all()/run(), batch() ── */
function makeD1(){
  const db=new DatabaseSync(':memory:');
  const stmt=(sql,args=[])=>({
    bind:(...a)=>stmt(sql,a),
    first:async()=>db.prepare(sql).get(...args)||null,
    all:async()=>({results:db.prepare(sql).all(...args)}),
    run:async()=>{const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};},
    _sql:sql,_args:args,
  });
  return {raw:db,prepare:(s)=>stmt(s),
    batch:async(list)=>{const out=[];db.exec('BEGIN');try{for(const s of list)out.push(await s.run());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return out;},
    exec:async(s)=>db.exec(s)};
}

const WORK_RECORDS_DDL=`CREATE TABLE IF NOT EXISTS work_records(
  id TEXT PRIMARY KEY, system TEXT, date TEXT, worker TEXT, worker_count INTEGER, part TEXT, work_type TEXT,
  qty_plt REAL, qty_ea INTEGER, input_unit TEXT, start_time TEXT, end_time TEXT, man_hour REAL, memo TEXT, created_at TEXT)`;

export async function startBackend(){
  const mk=async(file)=>(await import(pathToFileURL(path.join(ROOT,file)).href)).default;
  const wash=await mk('wash-system/backend/wash-worker.js');
  const pbox=await mk('pbox-orikon-system/worker-api/worker.js');
  const wh=await mk('wh-stack/wh-stack-worker.js');
  const dbs={wash:makeD1(),pbox:makeD1(),wh:makeD1()};
  await dbs.pbox.exec(WORK_RECORDS_DDL);
  const hosts={
    'wash-db.hodoo0831.workers.dev':[wash,{DB:dbs.wash}],
    'pbox-orikon-db.hodoo0831.workers.dev':[pbox,{DB:dbs.pbox}],
    'wh-stack.hodoo0831.workers.dev':[wh,{DB:dbs.wh}],
  };
  /** Playwright context.route 핸들러 — 알려진 호스트는 Worker 로, 나머지는 막는다. 등록은 정규식으로(ctx.route(/^https:\/\//, handler)) — 'https://**' 글롭은 잡히지 않는다 */
  const handler=async(route)=>{
    const req=route.request();const u=new URL(req.url());
    if(u.hostname==='kma-proxy.hodoo0831.workers.dev'){/* 기상청 실황 프록시 흉내 — 시연용 고정값 */
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({temp:27.4,rh:63,baseTime:'1500'})});}
    const h=hosts[u.hostname];
    if(!h)return route.abort('failed');
    try{
      const init={method:req.method(),headers:req.headers()};
      if(!['GET','HEAD'].includes(req.method()))init.body=req.postDataBuffer()||undefined;
      const res=await h[0].fetch(new Request(req.url(),init),h[1]);
      const buf=Buffer.from(await res.arrayBuffer());
      const headers={};res.headers.forEach((v,k)=>{headers[k]=v;});
      await route.fulfill({status:res.status,headers,body:buf});
    }catch(e){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({ok:false,error:String(e)})});}
  };
  /** 직접 호출 — 샘플 데이터 넣기용 */
  const call=async(host,pathname,{method='GET',body}={})=>{const h=hosts[host];
    const r=await h[0].fetch(new Request('https://'+host+pathname,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),h[1]);return r.json();};
  return {handler,call,dbs};
}
