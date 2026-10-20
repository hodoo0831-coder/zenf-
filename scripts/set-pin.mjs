#!/usr/bin/env node
/**
 * 접속 비밀번호(PIN) 일괄 교체 — 소스에는 SHA-256 해시만 있으니, 새 PIN 의 해시로 한꺼번에 바꾼다.
 *   node scripts/set-pin.mjs <새 PIN>
 * 줄 끝에 `zen-pin-hash` 표시가 있는 모든 해시 상수(플랫폼·세척실·창고·젠키퍼·히트워치·세이프티 보이스)를 바꾸고
 * 플랫폼(index.html·ZEN_Manufacturing_Platform_11.0.html)을 다시 빌드한다. 바꾼 뒤 커밋·배포해야 현장에 반영된다.
 * 주의: 4자리 숫자 PIN 은 해시여도 무차별 대입에 약하다 — 6자리 이상 + 문자 섞기를 권한다.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {execSync} from 'child_process';
const pin=process.argv[2];
if(!pin||pin.length<4){console.error('사용법: node scripts/set-pin.mjs <새 PIN (4자 이상)>');process.exit(1);}
if(pin.length<6)console.warn('경고: 6자 미만 PIN 은 쉽게 뚫린다. 6자리 이상을 권한다.');
const hash=crypto.createHash('sha256').update(pin,'utf8').digest('hex');
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const SKIP=new Set(['node_modules','.git','vendor','video']);
const exts=/\.(html|js|cjs|mjs)$/;
let changed=[];
(function walk(d){for(const n of fs.readdirSync(d,{withFileTypes:true})){
  if(n.isDirectory()){if(!SKIP.has(n.name))walk(path.join(d,n.name));continue;}
  if(!exts.test(n.name))continue;const f=path.join(d,n.name);
  const s=fs.readFileSync(f,'utf8');if(!s.includes('zen-pin-hash'))continue;
  let hit=0;const out=s.split('\n').map(l=>{if(!l.includes('zen-pin-hash'))return l;return l.replace(/[0-9a-f]{64}/,()=>{hit++;return hash;});}).join('\n');
  if(hit&&out!==s){fs.writeFileSync(f,out);changed.push(path.relative(ROOT,f)+' ('+hit+')');}
}})(ROOT);
// 빌드 산출물은 소스에서 다시 만든다(index.html 은 위 순회에서 마커가 없다 — 내장 앱 포함)
console.log('새 해시',hash);console.log('바뀐 파일\n  '+changed.join('\n  '));
try{execSync('node platform-src/build.cjs',{cwd:ROOT,stdio:'inherit'});}catch(e){console.error('빌드 실패 — 수동으로 node platform-src/build.cjs 를 실행하세요');process.exit(2);}
console.log('\n완료. git diff 로 확인한 뒤 커밋·배포하세요. 현장에는 새 PIN 을 따로 알려야 합니다.');
