/* ===== 보고서 미리보기 오버레이 =====
   새 창(window.open)은 부모와 같은 URL을 물려받아 뒤로가기를 가로챌 수 없고,
   되레 앱이 한 번 더 로드될 수 있다. 앱 안에서 전체화면으로 띄우면
   닫기·뒤로가기가 모두 자연스럽게 동작한다. 문서는 iframe(srcdoc)으로
   격리해 보고서 스타일이 앱 CSS와 충돌하지 않게 한다. */
let _docOpen=false;
function openDocView(html,title){
  closeDocView(true);
  const ov=document.createElement('div');
  ov.id='docOv';
  ov.innerHTML=`<div class="docbar">
      <button class="btn" onclick="closeDocView()">✕ 닫기</button>
      <b>${escHtml(title||'보고서')}</b>
      <button class="btn p" style="margin-left:auto" onclick="printDocView()"> 인쇄 / PDF 저장</button>
    </div><iframe id="docFrame" title="${escHtml(title||'보고서')}"></iframe>`;
  document.body.appendChild(ov);
  const fr=document.getElementById('docFrame');
  fr.srcdoc=html;
  document.body.style.overflow='hidden';
  _docOpen=true;
  try{history.pushState({zenDoc:1},'');}catch(e){}
}
function printDocView(){
  const fr=document.getElementById('docFrame');
  if(!fr){window.print();return;}
  try{fr.contentWindow.focus();fr.contentWindow.print();}
  catch(e){window.print();}
}
function closeDocView(silent){
  const ov=document.getElementById('docOv');
  if(ov)ov.remove();
  document.body.style.overflow='';
  if(_docOpen&&!silent){_docOpen=false;try{if(history.state&&history.state.zenDoc)history.back();}catch(e){}}
  else _docOpen=false;
}
window.addEventListener('popstate',function(){ if(document.getElementById('docOv'))closeDocView(true); });

function exportInsightPdf(){
  const P=insightPack();
  const tag=(v,good,warn)=>{const s=_insStatus(v,good,warn);return `<span style="color:${s.c};font-weight:700">${s.t}</span>`;};
  const rows=P.lines.map((l,i)=>{const s=_insStatus(l.ach,90,80),ds=l.defect<=1.5?{c:'#4a8a60'}:{c:'#c25a52'};
    return `<tr style="background:${i%2?'#f7f8f8':'#fff'}"><td><b>${l.key}</b></td><td class="num">${l.target.toLocaleString()}</td><td class="num">${l.actual.toLocaleString()}</td><td class="num" style="color:${s.c};font-weight:700">${l.ach}%</td><td class="num">${l.oee}%</td><td class="num" style="color:${ds.c};font-weight:700">${l.defect}%</td><td style="color:${s.c};font-weight:700">${s.t}</td></tr>`;}).join('');
  const kpiCard=(l,v,c)=>`<div class="kc" style="border-top-color:${c||'#1D3A5F'}"><div class="l">${l}</div><div class="n">${v}</div></div>`;
  const lossCard=(l,v,f)=>`<div class="lc"><div class="l">${l}</div><div class="n">${v}</div><div class="f">${f}</div></div>`;
  const _html=`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>ZEN 분석·보고 ${P.day}</title><style>
    @page{size:A4;margin:16mm 14mm}
    *{box-sizing:border-box}
    body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#1b2736;margin:0;background:#fff;min-width:820px}
    @media print{body{min-width:0}
    .head{background:#fff;color:#fff;padding:26px 34px;border-radius:0 0 14px 14px}
    .head .eb{font-size:10.5px;letter-spacing:3px;color:var(--muted);font-weight:700}
    .head h1{font-size:24px;margin:6px 0 4px;font-weight:700}
    .head .sub{font-size:12px;color:#b9c9e2}
    .wrap{padding:22px 34px 10px}
    .note{background:#f7f8f8;border:1px solid #e3e7e9;color:#145c38;border-radius:9px;padding:9px 13px;font-size:11.5px;font-weight:700;margin-bottom:16px}
    .brief{background:#ffffff;border-left:4px solid #0f2438;border-radius:8px;padding:11px 15px;font-size:13.5px;font-weight:700;margin-bottom:18px}
    h2{font-size:14.5px;color:#1d3a5f;margin:22px 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e9f3}
    .kgrid{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-bottom:6px}
    .kc{border-top:3px solid #1D3A5F;background:#ffffff;border-radius:0 0 9px 9px;padding:10px 11px}
    .kc .l{font-size:10.5px;color:#5f6b7a;font-weight:700}
    .kc .n{font-size:19px;font-weight:700;color:#1d3a5f;margin-top:2px}
    table{width:100%;border-collapse:collapse;font-size:11.5px}
    th{background:#1d3a5f;color:#fff;text-align:left;padding:8px 9px;font-size:11px}
    td{padding:7px 9px;border-bottom:1px solid #edf1f6}
    td.num{text-align:right;font-variant-numeric:tabular-nums}
    .lgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:8px}
    .lc{background:#ffffff;border:1px solid #e3e7e9;border-radius:9px;padding:10px 12px}
    .lc .l{font-size:10.5px;color:#9f4040;font-weight:700}
    .lc .n{font-size:16.5px;font-weight:700;color:#b3261e;margin-top:2px}
    .lc .f{font-size:9.5px;color:#a8746f;margin-top:3px}
    .lc.tot{background:#1d3a5f;border-color:#1d3a5f}.lc.tot .l{color:#b9c9e2}.lc.tot .n{color:#fff}.lc.tot .f{color:#8fa6c4}
    .lc.ref{background:#ffffff;border-color:#dbe3ee}.lc.ref .l{color:#5f6b7a}.lc.ref .n{color:#42546b}.lc.ref .f{color:#8a97a8}
    .foot{margin-top:26px;padding-top:12px;border-top:1px solid #e2e9f3;font-size:10px;color:#9aa7b8;display:flex;justify-content:space-between}
    .pbar{position:fixed;top:14px;right:16px;display:flex;gap:8px;z-index:99}.pbtn{background:#1d3a5f;color:#fff;border:0;border-radius:9px;padding:10px 18px;font-weight:700;cursor:pointer;font-family:inherit;min-height:40px}.pbtn.ghost{background:#fff;color:#1d3a5f;border:1.5px solid #cbd6e4}
    @media print{.pbar{display:none}.head{border-radius:0}}
  </style></head><body>
    
    <div class="head"><div class="eb">2026 제2회 ZAIC · ZEN MANUFACTURING PLATFORM</div><h1>분석·보고 — 경영 요약</h1><div class="sub">AP 헤어앤뷰티 사업장 · 제니엘 제조사업부 사업3팀 · ${P.day}</div></div>
    <div class="wrap">
      <div class="note">${P.note}</div>
      <div class="brief"> ${P.brief.oneLine.replace(/</g,'&lt;')}</div>
      <h2>① 핵심 지표</h2>
      <div class="kgrid">
        ${kpiCard('OEE',P.oee+'%',_insStatus(P.oee,80,70).c)}
        ${kpiCard('계획 준수율',P.tp.ach+'%',_insStatus(P.tp.ach,90,80).c)}
        ${kpiCard('불량률',P.df+'%',P.df<=1.5?'#4a8a60':'#c25a52')}
        ${kpiCard('업무도급',P.hc.office+'명')}
        ${kpiCard('생산도급',P.hc.prod+'명 +'+P.hc.prodDelta,'#0f2438')}
      </div>
      <h2>② 라인별 KPI 실측</h2>
      <table><thead><tr><th>라인</th><th>목표</th><th>실적</th><th>달성률</th><th>OEE</th><th>불량률</th><th>판정</th></tr></thead><tbody>${rows}</tbody></table>
      <h2>③ LOSS 추정 <span style="font-weight:700;color:#8a97a8;font-size:10.5px">가정 단가 ${P.AS.price}원/개 · 시급 ${P.AS.wage.toLocaleString()}원</span></h2>
      <div class="lgrid">
        ${lossCard('불량 LOSS',P.won(P.lossDef)+'원',P.defUnits.toLocaleString()+'개 × '+P.AS.price+'원')}
        ${lossCard('잔업 LOSS',P.won(P.lossOT)+'원',P.otH+'h × 1.5배')}
        <div class="lc tot"><div class="l">실손실 합계</div><div class="n">${P.won(P.lossDef+P.lossOT)}원</div><div class="f">불량 + 잔업</div></div>
        <div class="lc ref"><div class="l">미달성 기회금액 <span style="font-weight:700">(손실 아님)</span></div><div class="n">${P.won(P.lossOpp)}원</div><div class="f">${P.missUnits.toLocaleString()}개 미달 × ${P.AS.price}원 · 목표는 기준 시드</div></div>
      </div>
      <div class="foot"><span>ZEN Manufacturing Platform · 자동 생성 문서 — 기준값 기반 추정치이며 실시간 현장 입력이 아닙니다</span><span>${P.day}</span></div>
    </div>
    <script>setTimeout(function(){try{window.print()}catch(e){}},450)<\/script>
  </body></html>`;
  openDocView(_html,'분석·보고 — 경영 요약');
}
function _crc32(u8){let c=~0;for(let i=0;i<u8.length;i++){c^=u8[i];for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xEDB88320:c>>>1;}return(~c)>>>0;}
function _u16(n){return new Uint8Array([n&255,(n>>>8)&255]);}
function _u32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);}
function zipStore(files){
  const enc=new TextEncoder(), chunks=[], cds=[]; let off=0;
  files.forEach(f=>{
    const name=enc.encode(f.name), data=typeof f.data==='string'?enc.encode(f.data):f.data, crc=_crc32(data);
    const loc=new Uint8Array(30+name.length); loc.set([0x50,0x4b,0x03,0x04,0x14,0,0,0,0,0,0,0,0,0]);
    loc.set(_u32(crc),14); loc.set(_u32(data.length),18); loc.set(_u32(data.length),22);
    loc.set(_u16(name.length),26); loc.set(name,30);
    chunks.push(loc,data);
    const cen=new Uint8Array(46+name.length); cen.set([0x50,0x4b,0x01,0x02,0x14,0,0x14,0,0,0,0,0,0,0,0,0]);
    cen.set(_u32(crc),16); cen.set(_u32(data.length),20); cen.set(_u32(data.length),24);
    cen.set(_u16(name.length),28); cen.set(_u32(off),42); cen.set(name,46);
    cds.push(cen); off+=loc.length+data.length;
  });
  const cd=cds.reduce((a,b)=>a+b.length,0), body=chunks.reduce((a,b)=>a+b.length,0);
  const eocd=new Uint8Array(22); eocd.set([0x50,0x4b,0x05,0x06,0,0,0,0]);
  eocd.set(_u16(files.length),8); eocd.set(_u16(files.length),10); eocd.set(_u32(cd),12); eocd.set(_u32(body),16);
  const out=new Uint8Array(body+cd+22); let p=0;
  chunks.forEach(x=>{out.set(x,p);p+=x.length;}); cds.forEach(x=>{out.set(x,p);p+=x.length;}); out.set(eocd,p);
  return out;
}
/* ---- PPTX 도형 헬퍼 (16:9, EMU 단위) ---- */
const PPT_W=12192000, PPT_H=6858000;
let _pptIdSeq=1; function _pptId(){return ++_pptIdSeq;}
function _pptEsc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function pptBg(hex){return `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${hex}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>`;}
function pptRect(x,y,cx,cy,hex,opts){
  opts=opts||{};
  const geom=opts.round?'roundRect':'rect';
  const line=opts.line?`<a:ln w="${opts.lineW||12700}"><a:solidFill><a:srgbClr val="${opts.line}"/></a:solidFill></a:ln>`:'<a:ln><a:noFill/></a:ln>';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${_pptId()}" name="shape"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(cx)}" cy="${Math.round(cy)}"/></a:xfrm><a:prstGeom prst="${geom}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>${line}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;
}
function pptText(x,y,cx,cy,text,opts){
  opts=opts||{};
  const sz=opts.sz||1400, color=opts.color||'1B2736', bold=opts.b?'1':'0', align=opts.align||'l', anchor=opts.anchor||'t';
  const paras=String(text).split('\n').map(t=>`<a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="ko-KR" sz="${sz}" b="${bold}" dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Malgun Gothic"/><a:ea typeface="Malgun Gothic"/><a:cs typeface="Malgun Gothic"/></a:rPr><a:t>${_pptEsc(t)}</a:t></a:r></a:p>`).join('');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${_pptId()}" name="tx"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(cx)}" cy="${Math.round(cy)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="${anchor}"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`;
}
function pptTile(x,y,cx,cy,label,value,accentHex,bgHex){
  return pptRect(x,y,cx,cy,bgHex||'F4F7FB')
    +pptRect(x,y,26000,cy,accentHex||'0EA75C')
    +pptText(x+64000,y+50000,cx-100000,320000,label,{sz:1050,color:'5F7288',b:1})
    +pptText(x+64000,y+cy-620000,cx-100000,560000,value,{sz:2400,color:'1B2736',b:1});
}
function pptTableCell(text,w,opts){
  opts=opts||{};
  const fill=opts.fill?`<a:solidFill><a:srgbClr val="${opts.fill}"/></a:solidFill>`:'<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>';
  const color=opts.color||'1B2736', bold=opts.b?'1':'0', sz=opts.sz||1200, align=opts.align||'l';
  return `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="ko-KR" sz="${sz}" b="${bold}" dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Malgun Gothic"/><a:ea typeface="Malgun Gothic"/></a:rPr><a:t>${_pptEsc(text)}</a:t></a:r></a:p></a:txBody><a:tcPr marL="45000" marR="45000" marT="30000" marB="30000" anchor="ctr">${fill}</a:tcPr></a:tc>`;
}
function pptTable(x,y,cx,rowH,colWidths,headerRow,dataRows){
  const grid=colWidths.map(w=>`<a:gridCol w="${Math.round(w)}"/>`).join('');
  const hdr=`<a:tr h="${Math.round(rowH*1.05)}">`+headerRow.map((t,i)=>pptTableCell(t,colWidths[i],{fill:'1D3A5F',color:'FFFFFF',b:1,sz:1200,align:i===0?'l':'r'})).join('')+`</a:tr>`;
  const rows=dataRows.map((r,ri)=>`<a:tr h="${Math.round(rowH)}">`+r.map((cell,ci)=>{
    const c=(typeof cell==='object')?cell:{t:cell};
    return pptTableCell(c.t,colWidths[ci],{fill:c.fill||(ri%2?'F4F7FB':'FFFFFF'),color:c.color||'1B2736',b:c.b,sz:1150,align:ci===0?'l':'r'});
  }).join('')+`</a:tr>`).join('');
  const cy=Math.round(rowH*1.05)+dataRows.length*Math.round(rowH);
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${_pptId()}" name="tbl"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(cx)}" cy="${cy}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>${grid}</a:tblGrid>${hdr}${rows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}
function exportInsightPpt(){
  const P=insightPack();
  const M=560000; // 여백
  const slideXml=body=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld>${body}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  const tree=(bg,shapes)=>`${bg||''}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree>`;
  const footer=t=>pptText(M,PPT_H-420000,PPT_W-2*M,320000,t,{sz:1000,color:'9AA7B8'});

  /* 슬라이드 1 — 표지 */
  const s1=slideXml(tree(pptBg('16283F'),
    pptRect(M,2100000,900000,26000,'0EA75C')
    +pptText(M,2260000,8000000,420000,'2026 제2회 ZAIC',{sz:1400,color:'8FD8B9',b:1})
    +pptText(M,2740000,10800000,1000000,'ZEN 분석·보고',{sz:4400,color:'FFFFFF',b:1})
    +pptText(M,3760000,10800000,500000,P.day+' · AP 헤어앤뷰티 사업장',{sz:1600,color:'B9C9E2'})
    +pptText(M,4160000,10800000,420000,'제니엘 제조사업부 사업3팀',{sz:1300,color:'7F93B3'})
    +pptText(M,PPT_H-620000,10800000,420000,'기준값·가정 산식 기반 추정 · 실시간 현장 입력 아님',{sz:1000,color:'5D7396'})
  ));

  /* 슬라이드 2 — 핵심 지표 */
  const tileW=(PPT_W-2*M-4*80000)/5, tileY=1500000, tileH=1500000;
  const tiles=[
    {l:'OEE',v:P.oee+'%',c:_insStatus(P.oee,80,70).c==='#c25a52'?'D64545':_insStatus(P.oee,80,70).c==='#cb9447'?'E8940A':'0EA75C'},
    {l:'계획 준수율',v:P.tp.ach+'%',c:'2F6FED'},
    {l:'불량률',v:P.df+'%',c:P.df<=1.5?'0EA75C':'D64545'},
    {l:'업무도급',v:P.hc.office+'명',c:'8A63D2'},
    {l:'생산도급',v:P.hc.prod+'명',c:'0EA75C'}
  ];
  const tilesXml=tiles.map((t,i)=>pptTile(M+i*(tileW+80000),tileY,tileW,tileH,t.l,t.v,t.c)).join('');
  const s2=slideXml(tree(pptBg('FFFFFF'),
    pptText(M,420000,9000000,500000,'핵심 지표',{sz:2200,color:'16283F',b:1})
    +pptText(M,900000,9000000,400000,P.day+' 기준',{sz:1200,color:'8A97A8'})
    +tilesXml
    +pptRect(M,tileY+tileH+220000,PPT_W-2*M,1200000,'EEF8F2',{round:true,line:'CDEEDA'})
    +pptText(M+220000,tileY+tileH+380000,PPT_W-2*M-440000,900000,' '+P.brief.oneLine,{sz:1300,color:'145C38',b:1})
    +footer('ZEN Manufacturing Platform · 제니엘 제조사업부 사업3팀')
  ));

  /* 슬라이드 3 — 라인별 KPI */
  const colW=[2200000,1700000,1700000,1700000,1500000,1500000];
  const header=['라인','목표','실적','달성률','OEE','불량률'];
  const rows3=P.lines.map(l=>[
    {t:l.key,b:1},
    {t:l.target.toLocaleString()},
    {t:l.actual.toLocaleString()},
    {t:l.ach+'%',color:_insStatus(l.ach,90,80).c==='#c25a52'?'D64545':_insStatus(l.ach,90,80).c==='#cb9447'?'B8860B':'0B7A43',b:1},
    {t:l.oee+'%'},
    {t:l.defect+'%',color:l.defect<=1.5?'0B7A43':'D64545',b:1}
  ]);
  const s3=slideXml(tree(pptBg('FFFFFF'),
    pptText(M,420000,9000000,500000,'라인별 KPI 실측',{sz:2200,color:'16283F',b:1})
    +pptText(M,900000,9000000,400000,'목표 대비 실적 · '+P.lines.length+'개 라인',{sz:1200,color:'8A97A8'})
    +pptTable(M,1600000,PPT_W-2*M,560000,colW,header,rows3)
    +footer('ZEN Manufacturing Platform · 제니엘 제조사업부 사업3팀')
  ));

  /* 슬라이드 4 — LOSS 추정 · 도급 인력 */
  const lossW=(PPT_W-2*M-3*80000)/4;
  const lossXml=[
    {l:'불량 LOSS',v:P.won(P.lossDef)+'원',f:P.defUnits.toLocaleString()+'개 × '+P.AS.price+'원'},
    {l:'잔업 LOSS',v:P.won(P.lossOT)+'원',f:P.otH+'h × 1.5배'}
  ].map((c,i)=>pptRect(M+i*(lossW+80000),1500000,lossW,1500000,'FEF2F2',{round:true,line:'FBD5D5'})
    +pptText(M+i*(lossW+80000)+70000,1560000,lossW-120000,320000,c.l,{sz:1050,color:'9F4040',b:1})
    +pptText(M+i*(lossW+80000)+70000,2100000,lossW-120000,500000,c.v,{sz:1900,color:'B3261E',b:1})
    +pptText(M+i*(lossW+80000)+70000,2620000,lossW-120000,320000,c.f,{sz:900,color:'A8746F'})
  ).join('')
  +pptRect(M+2*(lossW+80000),1500000,lossW,1500000,'16283F',{round:true})
  +pptText(M+2*(lossW+80000)+70000,1560000,lossW-120000,320000,'실손실 합계',{sz:1050,color:'B9C9E2',b:1})
  +pptText(M+2*(lossW+80000)+70000,2100000,lossW-120000,500000,P.won(P.lossDef+P.lossOT)+'원',{sz:1900,color:'FFFFFF',b:1})
  +pptText(M+2*(lossW+80000)+70000,2620000,lossW-120000,320000,'불량 + 잔업',{sz:900,color:'8FA6C4'})
  +pptRect(M+3*(lossW+80000),1500000,lossW,1500000,'F7F9FC',{round:true,line:'DBE3EE'})
  +pptText(M+3*(lossW+80000)+70000,1560000,lossW-120000,320000,'미달성 기회금액 (손실 아님)',{sz:1000,color:'5F6B7A',b:1})
  +pptText(M+3*(lossW+80000)+70000,2100000,lossW-120000,500000,P.won(P.lossOpp)+'원',{sz:1900,color:'42546B',b:1})
  +pptText(M+3*(lossW+80000)+70000,2620000,lossW-120000,320000,P.missUnits.toLocaleString()+'개 미달 · 목표는 기준 시드',{sz:900,color:'8A97A8'});
  const s4=slideXml(tree(pptBg('FFFFFF'),
    pptText(M,420000,9000000,500000,'LOSS 추정 · 도급 인력',{sz:2200,color:'16283F',b:1})
    +pptText(M,900000,9000000,400000,'가정 단가 '+P.AS.price+'원/개 · 시급 '+P.AS.wage.toLocaleString()+'원',{sz:1200,color:'8A97A8'})
    +lossXml
    +pptTile(M,3300000,tileW,1300000,'업무도급',P.hc.office+'명','8A63D2')
    +pptTile(M+tileW+80000,3300000,tileW,1300000,'생산도급',P.hc.prod+'명 (+'+P.hc.prodDelta+')','0EA75C')
    +pptTile(M+2*(tileW+80000),3300000,tileW,1300000,'도급 합계',P.tot+'명','2F6FED')
    +footer('ZEN Manufacturing Platform · 제니엘 제조사업부 사업3팀 · 자동 생성 문서')
  ));

  const files=[
    {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide4.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>'},
    {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>'},
    {name:'ppt/presentation.xml',data:`<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/><p:sldId id="258" r:id="rId3"/><p:sldId id="259" r:id="rId4"/></p:sldIdLst><p:sldSz cx="${PPT_W}" cy="${PPT_H}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`},
    {name:'ppt/_rels/presentation.xml.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide4.xml"/></Relationships>'},
    {name:'ppt/slides/slide1.xml',data:s1},
    {name:'ppt/slides/slide2.xml',data:s2},
    {name:'ppt/slides/slide3.xml',data:s3},
    {name:'ppt/slides/slide4.xml',data:s4}
  ];
  const blob=new Blob([zipStore(files)],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
  const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download='ZEN_분석보고_'+new Date().toISOString().slice(0,10)+'.pptx';a.click();URL.revokeObjectURL(u);
  toast('분석·보고를 PPT 4슬라이드로 내보냈습니다');
}
function prodStatus(){
  const L=myLines();const tp=totProd();const ends=L.map(l=>l.end).sort();
  const rows=L.map(l=>{const a=G.achieve(l),col=sc(a,70,60);return `<div class="barrow"><div class="nm">${l.key}</div><div>${pbar(a,col)}<div class="mini" style="margin-top:4px">CAPA 부하 ${G.load(l)}% · 예상종료 ${l.end}</div></div><div class="vv" style="color:${col}">${a}%</div></div>`;}).join('');
  const tbl=L.map(l=>{const a=G.achieve(l);return `<tr><td>${l.key}</td><td>${l.target.toLocaleString()}</td><td>${l.actual.toLocaleString()}</td><td style="color:${sc(a,70,60)}">${a}%</td><td>${G.load(l)}%</td><td>${l.end}</td></tr>`;}).join('');
  const trend=[{label:'07',v:14},{label:'08',v:22},{label:'09',v:26},{label:'10',v:25},{label:'11',v:24},{label:'12',v:12},{label:'13',v:23}];
  const behind=L.filter(l=>G.achieve(l)<70).sort((a,b)=>G.achieve(a)-G.achieve(b));
  const over=L.filter(l=>G.load(l)>=100);
  const recos=[];
  if(behind.length)recos.push({lv:'crit',r:`${behind[0].key} 달성률 ${G.achieve(behind[0])}%`,s:`예상종료 ${behind[0].end} · 인력·설비 점검`});
  if(over.length)recos.push({lv:'warn',r:`CAPA 초과 ${over.length}라인`,s:`${over.map(l=>l.key).join(', ')} · 잔업 검토`});
  recos.push({lv:tp.ach>=80?'ok':'warn',r:`전체 달성률 ${tp.ach}%`,s:`실적 ${(tp.a/1000).toFixed(0)}천 / 목표 ${(tp.t/1000).toFixed(0)}천개`});
  const aib=aiBand('생산','달성률 70% · CAPA 100%',`${behind.length?`<b>${behind.map(l=>l.key).join('·')}</b> 달성률 70% 미만 — 지연 위험.`:'전 라인 달성률 정상 범위.'} 최지연 종료 ${ends[ends.length-1]}${over.length?` · CAPA 초과 ${over.length}라인`:''}.`,recos);
  return `
  <div class="grid g4" style="margin-bottom:14px">
    <div class="kpi"><div class="ic" data-ic="target"></div><div class="lab">금일 목표 수량</div><div class="val">${(tp.t/1000).toFixed(0)}<small>천개</small></div></div>
    <div class="kpi"><div class="ic" data-ic="check"></div><div class="lab">현재 실적</div><div class="val">${(tp.a/1000).toFixed(0)}<small>천개</small></div><div class="delta">달성률 ${tp.ach}%</div></div>
    <div class="kpi"><div class="ic" data-ic="gauge"></div><div class="lab">평균 CAPA 부하율</div><div class="val">${Math.round(DB.lines.reduce((a,l)=>a+G.load(l),0)/DB.lines.length)}<small>%</small></div></div>
    <div class="kpi"><div class="ic" data-ic="clock"></div><div class="lab">전 라인 예상 종료</div><div class="val">${ends[ends.length-1]}</div><div class="delta neg">최지연 라인 기준</div></div>
  </div>
  ${aib}
  <div class="grid g2" style="grid-template-columns:1.2fr 1fr">
    <div class="card"><h3>라인별 목표 대비 실적 <span class="hint">실적/목표</span></h3>${rows}</div>
    <div class="card"><h3>시간대별 생산 추이 <span class="hint">시간당 산출(천개)</span></h3>${lineChart(trend,{max:30,stroke:'#22a05f',fill:'#22a05f22',colorAt:()=>'#22a05f'})}<div class="mini" style="text-align:center">점심시간(12시) 감소 구간</div></div>
  </div>
  ${ledger('라인별 생산 현황 상세','목표·실적·달성률·CAPA 부하·예상종료 — '+L.length+'개 라인','<table class="tb"><thead><tr><th>라인</th><th>목표</th><th>실적</th><th>달성률</th><th>CAPA 부하</th><th>예상 종료</th></tr></thead><tbody>'+tbl+'</tbody></table>')}`;
};
V.labor=()=>realAppBar([
    {t:'인력 T/O 계산기',u:laborURL()}
  ])+laborStatus()+ledger('인력 부하율·필요 T/O 계산기 (그룹별)','주CAPA·정규인원·보유 TO 108 · 신장율 시뮬 · 계획표 업로드 — 클릭하여 펼침','<iframe class="safe" src="'+laborURL()+'" title="인력 부족·여유 자동계산" style="height:1480px"></iframe>');
/* 간접작업 실투입 인원 — P-BOX·오리콘 실적에서 실시간 산출 */
function laborLiveCard(){
  const A=laborLive();
  if(!A)return `<div class="card" style="margin-bottom:14px"><h3>간접작업 실투입 인원 <span class="hint">실적 앱 미연결</span></h3>
    <p class="mini">P-BOX·오리콘 실적이 연결되면 <b>날짜별 실제 투입 인원·공수</b>가 여기 실시간으로 표시됩니다.
    아래 라인별 배치는 기준·수동 입력값입니다.</p></div>`;
  const d=A.trend.map(x=>({label:x.date.slice(5),v:x.n}));
  const dm=Math.max(4,...A.trend.map(x=>x.n));
  const bars=A.trend.map(x=>{const on=x.date===A.date;
    return `<div style="flex:1;min-width:34px;display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="font-size:11px;font-weight:700;color:${on?'#0f2438':'#5f6d77'}">${x.n}</div>
      <div style="width:100%;height:${Math.round(x.n/dm*56)+4}px;border-radius:4px 4px 0 0;background:${on?'#0f2438':'#c7d2dd'}"></div>
      <div class="mini" style="font-size:10px">${x.date.slice(5)}</div></div>`;}).join('');
  const top=[...A.names].slice(0,12).map(n=>`<span class="chip" style="margin:2px 3px 0 0">${n}</span>`).join('');
  return `<div class="card" style="margin-bottom:14px"><h3>간접작업 실투입 인원
    <span class="hint">P-BOX·오리콘 실적 실측 · ${A.date} 기준</span>
    <span class="chip" style="margin-left:auto;background:#f7f8f8;color:#0f2438">실측</span></h3>
    <div class="grid g4" style="margin-bottom:12px">
      <div class="kpi"><div class="lab">실투입 인원</div><div class="val">${A.n}<small>명</small></div><div class="delta">최근 ${A.trend.length}일 평균 ${A.avg}명</div></div>
      <div class="kpi"><div class="lab">투입 공수</div><div class="val">${A.mh}<small>MH</small></div><div class="delta">1인 ${A.perHead}h</div></div>
      <div class="kpi"><div class="lab">최근 추이</div><div class="sp" style="margin-top:6px">${spark(A.trend.map(x=>x.n),{color:'#0f2438',w:104,h:26})}</div></div>
      <div class="kpi"><div class="lab">집계 기준</div><div class="val" style="font-size:15px">작업자 실명</div><div class="delta">공동작업은 인원수로 분배</div></div>
    </div>
    <div style="display:flex;gap:6px;align-items:flex-end;padding:4px 2px 0">${bars}</div>
    <div class="mini" style="margin-top:12px;line-height:1.7"><b>투입 인원</b> ${top}${A.names.length>12?` <span class="mut2">외 ${A.names.length-12}명</span>`:''}
      <br><span class="mut2">간접작업(P-BOX·오리콘) 실적에 기록된 인원만 집계됩니다. 라인 생산 인원은 출퇴근·배치를 기록하는 연결 시스템이 없어 아래 기준값으로 표시됩니다.</span></div>
  </div>`;
}
/* 보유인원 대비 출근 현황 — '일단위 인원 현황(26년)' 10/01 기준 (센터 관리 대장 수치). 도급 구분별 합계만 표시 */
const CONTRACT_STAFF={asof:'10/01',rows:[
  {g:'생산도급',n:'간접 (센터장·계획·주임·PM 등)',to:44,now:42},
  {g:'생산도급',n:'직접 정규 (OP·작업자)',to:95,now:83,key:1},
  {g:'생산도급',n:'비정규 (직접)',to:35,now:32},
  {g:'생산도급',n:'생산도급 총원',to:174,now:157,sum:1,leave:16},
  {g:'업무도급',n:'정규 (공작·세척·적재·포장재·원료·내용물)',to:80,now:76},
  {g:'업무도급',n:'비정규',to:18,now:18},
  {g:'업무도급',n:'업무도급 총원',to:98,now:94,sum:1,leave:4}]};
function contractStaffCard(){
  const R=CONTRACT_STAFF.rows;
  const tr=R.map(r=>{const d=r.now-r.to;return `<tr${r.sum?' style="font-weight:800;background:var(--tint)"':''}><td>${r.n}</td><td>${r.to}</td><td>${r.now}</td><td class="${d<0?'neg':'zero'}">${d}</td><td>${r.leave!=null?r.leave:'·'}</td></tr>`;}).join('');
  return `<div class="card" style="margin-bottom:14px"><h3>도급별 보유인원 대비 출근 <span class="hint">${CONTRACT_STAFF.asof} 기준 · 일단위 인원 현황(26년)</span></h3><div style="overflow-x:auto"><table class="tb"><thead><tr><th>구분</th><th>보유인원</th><th>출근</th><th>과부족</th><th>휴가·이동</th></tr></thead><tbody>${tr}</tbody></table></div><div class="mini" style="margin-top:8px">직접 정규 보유인원 95명이 아래 라인별 배치(필요)의 기준입니다. 출근 83명은 라인별 투입 합계와 같습니다.</div></div>`;
}
function laborStatus(){
  function people(l){let c=[];for(let i=0;i<l.on;i++)c.push(pi('on'));for(let i=0;i<l.leave;i++)c.push(pi('leave'));for(let i=0;i<l.edu;i++)c.push(pi('edu'));for(let i=0;i<Math.max(0,l.need-G.cur(l));i++)c.push(pi('empty'));return c.join('');}
  const L=myLines();
  const boxes=L.map(l=>{const d=G.cur(l)-l.need;return `<div class="lbox ${l.cls}"><div class="lh"><span class="lname">${l.label}</span><span class="pill">${d<0?d+'명':d>0?'+'+d+'명':'정상'}</span></div><div class="cnt">${G.cur(l)}<small> / ${l.need}명</small></div><div class="ppl">${people(l)}</div></div>`;}).join('');
  const tbl=L.map(l=>{const d=G.cur(l)-l.need;return `<tr><td>${l.key}</td><td>${l.need}</td><td>${G.cur(l)}</td><td class="${d<0?'neg':d>0?'pos':'zero'}">${d>0?'+'+d:d}</td><td><span class="sdot ${d<0?'s-red':'s-green'}"></span></td></tr>`;}).join('');
  const surplus=L.filter(l=>G.cur(l)-l.need>0).map(l=>l.key);
  const deficit=L.filter(l=>G.cur(l)-l.need<0);
  const gap=headNeed()-headCur();
  const recos=deficit.slice(0,2).map((l,i)=>({lv:i===0?'crit':'warn',r:`${surplus[i]||'여유 라인'} → ${l.key} 1명 이동`,s:`결원 ${l.need-G.cur(l)}명 중 1명 재배치`}));
  recos.push({lv:'warn',r:`잔업 — 잔여 부족 ${Math.max(0,shortSum()-Math.min(2,surplus.length))}명`,s:'재배치 후 잔여분 잔업 (인건비 검토)'});
  const aib=aiBand('인력','투입 < 필요',`부족 <b>${gap}명</b> — ${deficit.map(l=>l.key).join('·')||'없음'} 결원. ${surplus.length?`여유 ${surplus.join('·')}에서 재배치 우선`:'여유 라인 없음 · 잔업/증원 검토'}.`,recos);
  return `
  <div class="grid g4" style="margin-bottom:14px">
    <div class="kpi"><div class="ic" data-ic="users"></div><div class="lab">총 필요 인원</div><div class="val">${headNeed()}<small>명</small></div></div>
    <div class="kpi"><div class="ic" data-ic="users"></div><div class="lab">현재 투입</div><div class="val">${headCur()}<small>명</small></div></div>
    <div class="kpi"><div class="ic" data-ic="alert"></div><div class="lab">부족 인원</div><div class="val neg">${gap}<small>명</small></div></div>
    <div class="kpi"><div class="ic" data-ic="clock"></div><div class="lab">연차</div><div class="val" style="color:#b8860b">${DB.work[1].n}<small>명</small></div></div>
  </div>
  ${aib}
  ${scoped()?'':contractStaffCard()}
  ${laborLiveCard()}
  <div class="grid g2" style="grid-template-columns:1.3fr 1fr">
    <div class="card"><h3>공장 배치도 <span class="hint">라인별 배치 — 기준·수동 입력값</span></h3><div class="lines-grid">${boxes}</div></div>
    <div class="card"><h3>라인별 인력 현황 <span class="hint">필요 · 현재 · 과부족</span></h3><table class="tb"><thead><tr><th>구역</th><th>필요</th><th>현재</th><th>과부족</th><th>상태</th></tr></thead><tbody>${tbl}</tbody></table></div>
  </div>`;
};
/* 실물 앱 열기 — internal: 스킴은 내장 blob으로 해석, 준비 전이면 안내 */
function openApp(u){const r=(typeof sysResolve==='function')?sysResolve(u):u;if(!r){toast('내장 앱을 준비 중입니다. 잠시 후 다시 눌러주세요.');return;}window.open(r,'_blank');}
const realAppBar=(items)=>`<div class="card" style="margin-bottom:14px;display:flex;gap:9px;align-items:center;flex-wrap:wrap;padding:12px 15px">
  <b style="font-size:13px;letter-spacing:.5px;color:#0f2438">● 실물 앱</b>
  ${items.map(x=>`<button onclick="openApp('${x.u}')" style="border:1.5px solid #c7d2dd;background:var(--tint);color:#0f2438;font-weight:700;font-size:12.5px;padding:7px 13px;border-radius:999px;cursor:pointer">${x.t}</button>`).join('')}
  <span class="hint" style="margin-left:auto">실제 배포 시스템 — 새 창에서 열림</span></div>`;
V.clean=()=>{
  const ranked=[...myLines()].map(l=>({l,s:G.cleanScore(l)})).sort((a,b)=>b.s-a.s);
  const rows=ranked.map((r,i)=>{const l=r.l,col=sc(r.s,50,75,true);const cyc=Math.round(Math.min(1,l.clElapsed/8)*100),tr=Math.round(l.clTransfer*100),ld=Math.round(Math.min(1,l.actual/l.capa)*100);
    const reason=l.clTransfer>=1?'색상 전환(백→적)·세척주기 초과':l.clTransfer>=0.5?'제품 전환·잔류물 위험':l.clElapsed>=8?'세척주기 초과(기준 8h)':'동일 제품 연속 생산';
    return `<div class="it"><div class="rank ${i===0?'top':''}">${i+1}</div><div style="flex:1"><div style="font-weight:700">${l.key} 라인 <span class="chip" style="margin-left:6px">경과 ${l.clElapsed}h</span></div><div class="mini" style="margin-top:3px">${reason} · <span class="mut2">전환 ${tr} + 주기 ${cyc} + 부하 ${ld}</span></div></div><div style="text-align:right;min-width:70px"><div class="big" style="color:${col};font-size:20px">${r.s}</div><div class="mini">점</div></div></div>`;}).join('');
  const need=ranked.filter(r=>r.s>=75);
  const top=ranked[0];const order=ranked.filter(r=>r.s>=50).map((r,i)=>`${i+1}.${r.l.key}`).join(' → ');
  const aib=aiBand('세척','우선순위 75점',`${need.length?`<b>${top.l.key}</b> ${top.s}점 — ${top.l.clTransfer>=1?'색상전환+주기초과':'세척주기 초과'}로 즉시 세척 대상.`:'즉시 세척 대상 없음(전 라인 75점 미만).'} CIP 2기 병렬 시 오전 내 완료 가능.`,[
    {lv:top.s>=75?'crit':'warn',r:`${top.l.key} 즉시 세척`,s:`${top.s}점 ≥ 75 임계`},
    {lv:'warn',r:'CIP 2기 병렬 가동',s:'유휴 1기 투입 → 대기 단축'},
    {lv:'ok',r:'권장 순서',s:order}]);
  return realAppBar([
    {t:'세척실 관리자 대시보드',u:LIVE_URL.wash},
    {t:'세척실 현장용 앱',u:'internal:gz:washW'}
  ])+`
  <div class="grid g4" style="margin-bottom:14px">
    <div class="kpi"><div class="ic" data-ic="droplet"></div><div class="lab">세척 필요 라인</div><div class="val ${need.length?'neg':'pos'}">${need.length}<small>건</small></div><div class="delta">75점 이상</div></div>
    <div class="kpi"><div class="ic" data-ic="alert"></div><div class="lab">최우선 세척</div><div class="val">${top.l.key}</div><div class="delta neg">점수 ${top.s}</div></div>
    <div class="kpi"><div class="ic" data-ic="droplet"></div><div class="lab">CIP 가동</div><div class="val">1<small>/2기</small></div></div>
    <div class="kpi"><div class="ic" data-ic="clock"></div><div class="lab">평균 세척 소요</div><div class="val">42<small>분</small></div></div>
  </div>
  ${aib}
  <div class="grid g2" style="grid-template-columns:1.4fr 1fr">
    <div class="card"><h3>세척 우선순위 자동 계산 <span class="hint">전환40 + 주기35 + 부하25</span></h3><div class="list">${rows}</div></div>
    <div class="card"><h3>우선순위 산정식 <span class="hint">코드화된 판단 기준</span></h3>
      <div class="reco"><div class="ic" data-ic="droplet"></div><div class="tx"><div class="r">제품/색상 전환 · 가중 40%</div><div class="s">동일 0 · 제품전환 0.5 · 색상+알러지 1.0</div></div></div>
      <div class="reco"><div class="ic" data-ic="clock"></div><div class="tx"><div class="r">세척주기 경과 · 가중 35%</div><div class="s">경과시간 ÷ 기준주기(8h), 최대 1.0</div></div></div>
      <div class="reco"><div class="ic" data-ic="flask"></div><div class="tx"><div class="r">생산부하/오염도 · 가중 25%</div><div class="s">실적 ÷ CAPA (누적 오염 proxy)</div></div></div>
    </div>
  </div>`;
};
/* 기준값(데모) 창고 구역 — 실 엑셀 업로드 시 DB.wh로 자동 대체 */
/* 실측 — 프로덕션 D1(wh-stack.stock) 2026-08-12 점검분 */
const DEFAULT_WH_ZONES=[
  {name:'HnB동 1층',count:762,capa:627},{name:'J동 공작반 2층',count:100,capa:85},
  {name:'1층 튜브',count:78,capa:72},{name:'OC동 적치구역',count:214,capa:208},
  {name:'임가공[천막]',count:149,capa:148},{name:'L동 박스창고',count:481,capa:481},
  {name:'1층 종이상자',count:136,capa:136},{name:'FnC동 튜브',count:240,capa:242},
  {name:'제칭량·저장실',count:11,capa:12},{name:'FnC동 염모제',count:140,capa:155},
  {name:'지하 B구역',count:31,capa:37},{name:'지하 A구역',count:89,capa:136},
];
function whGrowth(){ // 익주 예측 성장률 — 실데이터면 전체 적치율 주간 추세, 없으면 기준 +6%
  if(DB.wh&&DB.wh.weeks.length>=2){const a=whTotRate(DB.wh.weeks[0]),b=whTotRate(DB.wh.weeks[1]);if(b)return Math.max(-.1,Math.min(.2,(a-b)/b));}
  return 0.06;
}
function whHeat(r){return r>=100?'#dc4b4b':r>=90?'#e8823a':r>=70?'#e3b341':'#3f9d6b';}
function whLayout(){
  const zones=whZones();
  const g=whGrowth();
  const Z=zones.map(z=>{const pred=Math.max(0,Math.round(z.rate*(1+g)));const free=Math.max(0,z.capa-z.count);
    return {...z,pred,free,st:z.rate>=100?'초과':pred>=100?'포화 임박':z.rate>=90?'주의':'여유'};});
  const satNow=Z.filter(z=>z.rate>=100).length, satPred=Z.filter(z=>z.rate<100&&z.pred>=100);
  const recIn=[...Z].filter(z=>z.pred<90).sort((a,b)=>b.free-a.free)[0];
  const over=[...Z].filter(z=>z.rate>=100).sort((a,b)=>b.rate-a.rate)[0];
  const dest=[...Z].filter(z=>z.pred<80).sort((a,b)=>b.free-a.free)[0];
  const short=n=>n.replace(/\[.*?\]/g,'').split(' ')[0];
  const tiles=Z.map(z=>{const c=whHeat(z.rate);const alert=z.rate>=100||z.pred>=100;
    return `<div class="whz${alert?' al':''}" style="--hc:${c}">
      <div class="zn">${z.name}</div>
      <div class="zr">${z.rate}<small>%</small></div>
      <div class="zp">→ 익주 <b style="color:${whHeat(z.pred)}">${z.pred}%</b></div>
      <div class="zc">${z.count}/${z.capa} PLT · 여유 ${z.free}</div>
      <span class="zt" style="background:${c}">${z.st}</span></div>`;}).join('');
  const rule=(t)=>`<span class="prule" style="display:inline-block;margin-top:6px">적용 기준 ${t}</span>`;
  const preds=[
    {lv:satNow?'crit':'ok',ic:'package',r:`현재 CAPA 초과 ${satNow}구역`,s:over?`${short(over.name)} ${over.rate}% — 즉시 재배치·출하 우선`:'초과 구역 없음',rule:'적치율 ≥ 100%'},
    {lv:satPred.length?'warn':'ok',ic:'activity',r:`익주 포화 예측 ${satPred.length}구역`,s:satPred.length?`${satPred.map(z=>short(z.name)).join('·')} → 사전 분산 필요 (추세 ${(g*100).toFixed(0)}%↑)`:'익주 포화 예측 없음',rule:'예측 적치율 ≥ 100%'},
    {lv:'ok',ic:'truck',r:recIn?`권장 입고 구역 · ${short(recIn.name)}`:'권장 입고 구역 없음',s:recIn?`여유 ${recIn.free} PLT 최대 · 예측 ${recIn.pred}% 안정`:'-',rule:'여유 최대 & 예측 < 90%'},
    {lv:over&&dest?'warn':'ok',ic:'package',r:over&&dest?`권장 재배치 · ${short(over.name)} → ${short(dest.name)}`:'재배치 불필요',s:over&&dest?`초과 ${over.count-over.capa} PLT를 여유 구역으로 이관`:'전 구역 여유',rule:'초과분 → 예측<80% 구역'},
  ];
  const predCards=preds.map(x=>`<div class="pred ${x.lv}"><div class="ph"><span class="ico sm ${x.lv==='crit'?'r':x.lv==='warn'?'a':''}">${svic(x.ic,15)}</span><span class="pr">${x.r}</span></div><div class="ps">${x.s}</div><div class="prule">적용 기준 ${x.rule}</div></div>`).join('');
  return `<div class="card" style="margin-bottom:16px"><h3><span style="display:inline-flex;vertical-align:-3px;color:var(--accent)">${svic('package',16)}</span> 창고 예측 배치도 <span class="hint">구역별 적치 히트맵 · 익주 포화 예측 · 권장 입고/재배치</span>
    <span style="margin-left:auto;display:inline-flex;gap:9px;align-items:center;font-size:11px;color:var(--muted)">
      <span class="whlg"><i style="background:#3f9d6b"></i>여유</span><span class="whlg"><i style="background:#e3b341"></i>70%+</span><span class="whlg"><i style="background:#e8823a"></i>90%+</span><span class="whlg"><i style="background:#dc4b4b"></i>초과</span></span></h3>
    <div class="whmap">${tiles}</div>
    <div class="predgrid" style="margin-top:14px">${predCards}</div></div>`;
}
V.stock=()=>{
  // ===== 실제 창고 구역별 적치(주1회) =====
  let whSection='';
  if(DB.wh){
    const wk=DB.wh.weeks[whWeek]||DB.wh.weeks[0];
    const wz=whZones(), wt=whZoneTotal(wz), liveN=wz.filter(z=>z.live).length;
    const tr=wt.rate;
    const over=wz.filter(z=>z.rate>=100);
    const maxZone=[...wz].sort((a,b)=>b.rate-a.rate)[0];
    const _dom=Math.max(120,Math.ceil(maxZone.rate/10)*10);
    const whBar=(rate)=>{const col=rate>=100?'#dc4b4b':rate>=90?'#d98a2b':'#4f7cb0';const w=Math.min(100,rate/_dom*100);const mk=(100/_dom*100).toFixed(1);const base=Math.min(w,+mk);const over=Math.max(0,w-mk);return `<div class="pbar" style="position:relative;height:11px"><i style="width:${base}%;background:${rate>=90&&rate<100?col:'#4f7cb0'}"></i><i style="position:absolute;top:0;left:${mk}%;height:100%;width:${over}%;background:#dc4b4b"></i><span style="position:absolute;top:-2px;bottom:-2px;left:${mk}%;width:1.5px;background:#8a99ad"></span></div>`;};
    const zoneRows=wz.map(z=>{const col=z.rate>=100?'#dc4b4b':z.rate>=90?'#d98a2b':'#4f7cb0';return `<div class="barrow" style="grid-template-columns:160px 1fr 80px"><div class="nm">${z.name}${z.live?' <span class="chip" style="background:#f7f8f8;color:#0f2438;font-size:10px;padding:1px 5px">실측</span>':''}</div><div>${whBar(z.rate)}<div class="mini" style="margin-top:4px">적재 ${z.count} / CAPA ${z.capa}${z.count>z.capa?' · <span style="color:#dc4b4b">초과 '+(z.count-z.capa)+'</span>':''}</div></div><div class="vv" style="color:${col}">${z.rate}%</div></div>`;}).join('');
    const trend=[...DB.wh.weeks].reverse().map(w=>({label:w.label,v:whTotRate(w)}));
    const tabs=DB.wh.weeks.map((w,i)=>`<button class="btn ${i===whWeek?'p':''}" style="padding:6px 11px" onclick="whWeek=${i};go('stock')">${w.label}</button>`).join(' ');
    whSection=`
    <div class="card" style="margin-bottom:16px"><h3>창고 구역별 적치율 <span class="hint">${liveN?`창고 앱 실측 · ${whLiveDate()||'-'} 점검 ${liveN}/${WH_APP_ZONES.length}구역`:`주1회 구역별 점검 · ${wk.label} 기준 · 실 엑셀 연동`}</span><span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">${tabs}</span></h3>
      <div class="grid g4" style="margin-bottom:14px">
        <div class="kpi"><div class="lab">전체 적치율</div><div class="val" style="color:${tr>=100?'#dc4b4b':tr>=90?'#d98a2b':'#3f74b5'}">${tr}<small>%</small></div><div class="delta">적재 ${wt.count.toLocaleString()} / CAPA ${wt.capa.toLocaleString()}</div></div>
        <div class="kpi"><div class="lab">CAPA 초과 구역</div><div class="val ${over.length?'neg':'pos'}">${over.length}<small>구역</small></div><div class="delta neg">${over.slice(0,2).map(z=>z.name.split(' ')[0]).join(', ')||'없음'}</div></div>
        <div class="kpi"><div class="lab">최고 적치 구역</div><div class="val" style="font-size:16px">${maxZone.name}</div><div class="delta neg">${maxZone.rate}%</div></div>
        <div class="kpi"><div class="lab">점검 주차</div><div class="val">${DB.wh.weeks.length}<small>주</small></div><div class="delta">최신 ${DB.wh.weeks[0].label}</div></div>
      </div>
      <div class="grid g2" style="grid-template-columns:1.5fr 1fr">
        <div class="card" style="box-shadow:none"><h3 style="font-size:13px;border:none;padding:0;margin-bottom:10px">구역별 적치율 <span class="hint">100% 초과 빨강 · 90%+ 주황</span></h3>${zoneRows}</div>
        <div class="card" style="box-shadow:none"><h3 style="font-size:13px;border:none;padding:0;margin-bottom:10px">전체 적치율 추이 <span class="hint">주별 %</span></h3>${lineChart(trend,{max:120,stroke:'#3f74b5',fill:'#3f74b518',colorAt:v=>v>=100?'#dc4b4b':'#3f74b5'})}
          <div class="reco warn" style="margin-top:10px"><div class="ic" data-ic="package"></div><div class="tx"><div class="r">HnB 1층 · 임가공[천막] 상시 초과</div><div class="s">CAPA 초과 구역 재배치 또는 적재 CAPA 상향 검토 필요</div></div></div></div>
      </div>
    </div>`;
  }else{
    const _ln=whLiveN();
    whSection=`<div class="card" style="margin-bottom:16px"><h3>창고 구역별 적치율 <span class="hint">${_ln?`창고 앱 실측 · ${whLiveDate()||'-'} 점검 ${_ln}/${WH_APP_ZONES.length}구역`:'주1회 점검'}</span></h3><p class="mini">${_ln?'창고 현장 입력 앱의 실측을 받고 있습니다. 주차별 추이를 보려면 구역별 적치 점검 엑셀을':'구역별 적치 점검 엑셀을'} <a onclick="go('data')" style="color:#3f74b5;cursor:pointer">기준 · 연동</a>에서 업로드하세요.</p></div>`;
  }
  const _zs=whZones();
  const overN=_zs.filter(z=>z.rate>=100).length;
  const trAll=Math.round(_zs.reduce((a,z)=>a+z.count,0)/_zs.reduce((a,z)=>a+z.capa,0)*100);
  const srecos=[];
  if(overN)srecos.push({lv:'crit',r:`적치 초과 ${overN}구역 재배치`,s:'CAPA 상향 또는 출하 우선 조정'});
  srecos.push({lv:(trAll>=100)?'crit':(trAll>=90)?'warn':'ok',r:`전체 적치율 ${trAll!=null?trAll+'%':'-'}`,s:overN?'초과 구역 우선 조정':'적정 범위'});
  srecos.push({lv:'ok',r:'출하·재배치 조정',s:'초과 구역 우선 출하로 여유 확보'});
  const aib=aiBand('창고','적치율 100%',`${overN?`적치 <b>초과 ${overN}구역</b> — 재배치·출하 우선.`:'전 구역 적치 적정.'} 전체 적치율 ${trAll!=null?trAll+'%':'-'}.`,srecos);
  return realAppBar([
    {t:'창고 관리자 대시보드',u:LIVE_URL.whAdmin},
    {t:'창고 현장 입력 앱',u:LIVE_URL.whWorker},
    {t:'현장 입력 앱(내장)',u:'internal:gz:whW'}
  ])+`
  ${aib}
  ${whLayout()}
  ${whSection}`;
};
V.orikonwash=()=>{
  const s=(DB.extSys||[]).find(x=>x.id==='orikon');
  return realAppBar([
    {t:'P-BOX 관리자 대시보드',u:LIVE_URL.pboxAdmin},
    {t:'오리콘 관리자 대시보드',u:LIVE_URL.orikonAdmin},
    {t:'작업자 입력 앱',u:LIVE_URL.orikonWorker}
  ])+renderLive()+(s?sysCard(s):'');
};
V.safe=()=>{
  const nsys=(DB.extSys||[]).filter(s=>inAgent(s,'safe')).length;
  const tabs=[{k:'status',label:'현황'},{k:'sys',label:'연동 시스템'+(nsys?' ('+nsys+')':'')}];
  const t=vtabActive('safe',tabs);
  return realAppBar([
    {t:'젠키퍼',u:LIVE_URL.safe},
    {t:'히트워치',u:LIVE_URL.heat}
  ])+vtabsBar('safe',tabs)+(t==='sys'?(renderSysLinks('safe')||'<div class="card"><p class="mini">연동 시스템이 없습니다.</p></div>'):safeStatus());
};
function safeStatus(){
  const w=DB.safety;const risks=[
    {n:'폭염 (옥외·고열작업)',lv:w.wbgt>=31?'매우높음':w.wbgt>=28?'높음':'보통',c:w.wbgt>=28?'t-red':'t-amber',s:`WBGT ${w.wbgt}℃ · 기온 ${w.temp}℃ 습도 ${w.humid}%`},
    {n:'협착 위험 — 튜브 라인 성형기',lv:'중간',c:'t-amber',s:'방호덮개 점검 필요'},
    {n:'미끄럼 — 세척 구역 바닥',lv:'중간',c:'t-amber',s:'세척수 배수·미끄럼 방지 매트'},
    {n:'화학물질 취급 — 염모 라인',lv:'낮음',c:'t-green',s:'보호구 착용 양호'},
  ];
  const tbmTime={'튜브':'07:05','치약충전':'07:08','일회용':'-','초격차':'07:02','HnB':'07:12','FnC':'07:06'};
  const tbm=myLines().map(l=>{const done=w.tbmDone.includes(l.key);return `<tr><td>${l.key}</td><td><span class="tag ${done?'t-green':'t-red'}">${done?'실시':'미실시'}</span></td><td>${tbmTime[l.key]||'-'}</td></tr>`;}).join('');
  const undone=myLines().filter(l=>!w.tbmDone.includes(l.key)).map(l=>l.key);
  const aib=aiBand('안전','TBM 100% · WBGT 28℃',`${undone.length?`<b>${undone.join('·')}</b> TBM 미실시 — 작업 전 완료 필요.`:'전 라인 TBM 완료.'} WBGT ${w.wbgt}℃ ${w.wbgt>=28?'경고 — 시간당 휴식·수분 조치':'정상 범위'}.`,[
    {lv:undone.length?'crit':'ok',r:undone.length?`TBM 미실시 ${undone.length}라인`:'TBM 전 라인 완료',s:undone.join(',')||'실시율 100%'},
    {lv:w.wbgt>=28?'warn':'ok',r:`폭염 ${w.wbgt>=31?'위험':w.wbgt>=28?'경고':'주의'}`,s:`WBGT ${w.wbgt}℃ ≥ 28 → 휴식·수분`},
    {lv:'warn',r:'고위험 요인 점검',s:'튜브 협착 · 세척 미끄럼'}]);
  return `
  <div class="grid g4" style="margin-bottom:14px">
    <div class="kpi"><div class="ic" data-ic="thermometer"></div><div class="lab">폭염 지수 WBGT</div><div class="val" style="color:${sc(w.wbgt,28,31,true)}">${w.wbgt}<small>℃</small></div><div class="delta neg">${w.wbgt>=31?'위험':w.wbgt>=28?'경고':'주의'} 단계</div></div>
    <div class="kpi"><div class="ic" data-ic="shield"></div><div class="lab">무재해 일수</div><div class="val pos">${w.noAccident}<small>일</small></div><div class="delta">목표 200일</div></div>
    <div class="kpi"><div class="ic" data-ic="report"></div><div class="lab">TBM 실시율</div><div class="val">${myLines().filter(l=>w.tbmDone.includes(l.key)).length}<small>/${myLines().length} 라인</small></div><div class="delta neg">${undone.join(',')||'전 라인 완료'}</div></div>
    <div class="kpi"><div class="ic" data-ic="alert"></div><div class="lab">위험요인</div><div class="val">4<small>건</small></div><div class="delta neg">고위험 ${w.wbgt>=28?1:0}건</div></div>
  </div>
  ${aib}
  <div class="grid g2" style="grid-template-columns:1.2fr 1fr;margin-bottom:14px">
    <div class="card"><h3>위험요인 자동 추천 <span class="hint">라인·환경 종합</span></h3>${risks.map(r=>`<div class="reco ${r.c==='t-red'?'bad':r.c==='t-amber'?'warn':''}"><div class="ic">${r.c==='t-red'?svic('alert',16):r.c==='t-amber'?svic('alert',16):svic('check',16)}</div><div class="tx"><div class="r">${r.n} <span class="tag ${r.c}" style="margin-left:6px">${r.lv}</span></div><div class="s">${r.s}</div></div></div>`).join('')}</div>
    <div class="card"><h3>폭염 단계별 조치 <span class="hint">WBGT ${w.wbgt}℃</span></h3>
      <div class="reco warn"><div class="ic" data-ic="droplet"></div><div class="tx"><div class="r">수분·이온음료 비치</div><div class="s">고열 작업구간 3개소 상시 비치</div></div></div>
      <div class="reco warn"><div class="ic" data-ic="clock"></div><div class="tx"><div class="r">시간당 10분 휴식</div><div class="s">옥외·성형/사출 구간 강제 휴식</div></div></div>
      <div class="reco"><div class="ic" data-ic="spark"></div><div class="tx"><div class="r">냉방·환기 강화</div><div class="s">이동식 냉방기 2대 추가 배치</div></div></div>
      <div class="reco"><div class="ic" data-ic="bell"></div><div class="tx"><div class="r">TBM 폭염 특별교육</div><div class="s">온열질환 초기증상·응급조치 전파</div></div></div>
    </div>
  </div>
  ${ledger('라인별 TBM(Tool Box Meeting) 실시 현황','작업 전 안전점검 실시 여부·시각 — '+myLines().length+'개 라인','<table class="tb"><thead><tr><th>라인</th><th>실시 여부</th><th>실시 시각</th></tr></thead><tbody>'+tbm+'</tbody></table>')}`;
};
V.qual=()=>{
  const df=avgDefect();const worst=[...myLines()].sort((a,b)=>b.defect-a.defect)[0];
  const maxC=Math.max(...DB.paretoVals),totC=DB.paretoVals.reduce((a,b)=>a+b,0);let cum=0;
  const cols=['#dc4b4b','#d98a2b','#d98a2b','#3b82f6','#6d84a3'];
  const par=DB.paretoNames.map((n,i)=>{cum+=DB.paretoVals[i];const wd=DB.paretoVals[i]/maxC*100;return `<div class="barrow" style="grid-template-columns:96px 1fr 96px"><div class="nm">${n}</div><div>${pbar(wd,cols[i%cols.length])}</div><div class="vv mut2">${DB.paretoVals[i]}건 · 누적 ${Math.round(cum/totC*100)}%</div></div>`;}).join('');
  const lrows=myLines().map(l=>{const col=sc(l.defect,2.0,2.5,true);return `<tr><td>${l.key}</td><td style="color:${col}">${l.defect}%</td><td><span class="sdot ${l.defect>=2.5?'s-red':l.defect>=2.0?'s-amber':'s-green'}"></span></td></tr>`;}).join('');
  const aib=aiBand('품질','불량률 1.5%',`평균 불량률 <b>${df}%</b> ${df>1.5?'— 목표 1.5% 초과.':'— 목표 이내.'} 최다 유형 ${DB.paretoNames[0]}(${Math.round(DB.paretoVals[0]/totC*100)}%) · 최다 라인 ${worst.key}(${worst.defect}%).`,[
    {lv:'crit',r:`인쇄 불량 (${worst.key})`,s:'색상전환 후 판압 편차 · 세척+판압 재교정'},
    {lv:'warn',r:'캡 체결 불량',s:'토크값 하한 근접 · 체결 토크 점검'},
    {lv:'ok',r:'충전량 편차',s:'충전 노즐 정기 캘리브레이션'}]);
  return `
  <div class="grid g4" style="margin-bottom:14px">
    <div class="kpi"><div class="ic" data-ic="flask"></div><div class="lab">평균 불량률</div><div class="val" style="color:${df>1.5?'#ffcf5a':'#22a05f'}">${df}<small>%</small></div><div class="delta ${df>1.5?'neg':'pos'}">목표 1.5%</div></div>
    <div class="kpi"><div class="ic" data-ic="activity"></div><div class="lab">주간 평균</div><div class="val">${(DB.qualTrend.reduce((a,b)=>a+b.v,0)/DB.qualTrend.length).toFixed(1)}<small>%</small></div></div>
    <div class="kpi"><div class="ic" data-ic="target"></div><div class="lab">최다 불량 유형</div><div class="val" style="font-size:19px">${DB.paretoNames[0]}</div><div class="delta neg">전체의 ${Math.round(DB.paretoVals[0]/totC*100)}%</div></div>
    <div class="kpi"><div class="ic" data-ic="alert"></div><div class="lab">불량 최다 라인</div><div class="val">${worst.key}</div><div class="delta neg">${worst.defect}%</div></div>
  </div>
  ${aib}
  <div class="grid g2" style="grid-template-columns:1fr 1fr">
    <div class="card"><h3>불량률 추이 <span class="hint">최근 7일</span></h3>${lineChart(DB.qualTrend,{max:2.5,stroke:'#d98a2b',fill:'#d98a2b22',colorAt:v=>v>=2.0?'#dc4b4b':'#d98a2b'})}<div class="mini" style="text-align:center">목표 1.5% 초과 추이</div></div>
    <div class="card"><h3>불량 원인 분석 (파레토) <span class="hint">유형별 건수</span></h3>${par}<div class="mini" style="margin-top:8px">상위 2개 유형이 전체의 ${Math.round((DB.paretoVals[0]+DB.paretoVals[1])/totC*100)}% → 우선 개선</div></div>
  </div>
  ${ledger('라인별 불량률','라인별 불량률·상태 — '+myLines().length+'개 라인','<table class="tb"><thead><tr><th>라인</th><th>불량률</th><th>상태</th></tr></thead><tbody>'+lrows+'</tbody></table>')}`;
};
V.kpi=()=>{
  const L=myLines();const oee=avgOEE();const tp=totProd();const df=avgDefect();
  const avgA=Math.round(L.reduce((a,l)=>a+l.oeeA,0)/L.length);
  const avgP=Math.round(L.reduce((a,l)=>a+l.oeeP,0)/L.length);
  const avgQ=+(L.reduce((a,l)=>a+(100-l.defect),0)/L.length).toFixed(1);
  const totMH=L.reduce((a,l)=>a+l.on*8,0);
  const upph=totMH?Math.round(tp.a/totMH):0;
  const otH=DB.otTrend.reduce((a,b)=>a+b.v,0);
  const AS={price:300,wage:12000,otMul:1.5}; // 가정: 개당 단가·시급·잔업배수
  const missUnits=L.reduce((a,l)=>a+Math.max(0,l.target-l.actual),0);
  const defUnits=L.reduce((a,l)=>a+Math.round(l.actual*l.defect/100),0);
  const lossDef=defUnits*AS.price, lossOT=Math.round(otH*AS.wage*AS.otMul), lossOpp=missUnits*AS.price;
  const laborCost=totMH*AS.wage, unitLabor=tp.a?Math.round(laborCost/tp.a):0;
  const won=n=>n>=1e8?(n/1e8).toFixed(1)+'억':n>=1e4?Math.round(n/1e4).toLocaleString()+'만':n.toLocaleString();
  const bars=L.map(l=>({label:l.key,v:G.oee(l),color:G.oee(l)>=80?'#4a8a60':G.oee(l)>=70?'#cb9447':'#c25a52'}));
  const comp=(lab,v,c)=>`<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span class="muted" style="font-weight:700">${lab}</span><span class="tnum" style="font-weight:700;color:${c}">${v}%</span></div>${pbar(v,c)}</div>`;
  const lossrow=(lab,amt,c,desc)=>`<div class="barrow" style="grid-template-columns:1fr auto;padding:8px 0"><div><div class="nm" style="font-size:12.5px">${lab}</div><div class="mini">${desc}</div></div><div class="vv tnum" style="color:${c};font-size:14px">${won(amt)}<span style="font-size:10px;color:var(--muted)"> 원</span></div></div>`;
  const tbl=L.map(l=>{const o=G.oee(l),col=o>=80?'#4a8a60':o>=70?'#cb9447':'#c25a52';const up=Math.round(l.actual/(l.on*8||1));const ld=Math.round(l.actual*l.defect/100)*AS.price;return `<tr><td>${l.key}</td><td>${G.achieve(l)}%</td><td>${l.oeeA}%</td><td>${l.oeeP}%</td><td>${(100-l.defect).toFixed(1)}%</td><td style="color:${col};font-weight:700">${o}%</td><td>${up}</td><td>${won(ld)}원</td></tr>`;}).join('');
  const _mn=Math.min(avgA,avgP,avgQ);const _mnLab=_mn===avgP?'성능 Performance':_mn===avgA?'가동률 Availability':'양품률 Quality';
  const aib=aiBand('분석·보고','OEE 80% · LOSS',`OEE <b>${oee}%</b> ${oee>=80?'양호':'개선 필요'} — 3요소 중 <b>${_mnLab} ${_mn}%</b>가 병목. 발생 LOSS ${won(lossDef+lossOT)}원 · 미달성 기회금액 ${won(lossOpp)}원.`,[
    {lv:oee>=80?'ok':'crit',r:`${_mnLab} ${_mn}% 병목`,s:'OEE 3요소 최저 → 우선 개선'},
    {lv:'warn',r:`불량손실 ${won(lossDef)}원`,s:`불량 ${defUnits.toLocaleString()}개 저감 우선`},
    {lv:'warn',r:`잔업 초과 ${won(lossOT)}원`,s:`잔업 ${otH}h · 재배치로 절감`}]);
  return `
  <div class="kstrip">
    <div class="ki"><div class="l">설비종합효율 OEE</div><div class="v tnum" style="color:${oee>=80?'var(--ok)':'#cb9447'}">${oee}<small>%</small></div><div class="d muted">가동 ${avgA}·성능 ${avgP}·양품 ${avgQ}</div></div>
    <div class="ki"><div class="l">인시생산성</div><div class="v tnum">${upph}<small>개/인·h</small></div><div class="d muted">${(tp.a/1000).toFixed(0)}천개 ÷ ${totMH}MH</div></div>
    <div class="ki"><div class="l">계획 준수율</div><div class="v tnum" style="color:${tp.ach>=90?'var(--ok)':'#cb9447'}">${tp.ach}<small>%</small></div><div class="d muted">실적/목표</div></div>
    <div class="ki"><div class="l">불량률</div><div class="v tnum">${df}<small>%</small></div><div class="d muted">${Math.round(df*10000).toLocaleString()} PPM</div></div>
    <div class="ki"><div class="l">인당 원단위</div><div class="v tnum">${unitLabor}<small>원/개</small></div><div class="d muted">인건비÷생산(가정)</div></div>
    <div class="ki"><div class="l">무재해</div><div class="v tnum">${DB.safety.noAccident}<small>일</small></div><div class="d muted">목표 200</div></div>
  </div>
  ${aib}
  <div class="grid g2" style="grid-template-columns:1.25fr 1fr;margin-bottom:14px">
    <div class="card"><h3>OEE 구성 분해 <span class="hint">OEE = 가동률 × 성능 × 양품률</span></h3>
      <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
        <div style="text-align:center">${gauge(oee,{color:oee>=80?'#4a8a60':'#cb9447',size:118})}<div class="mini" style="margin-top:4px">종합 OEE</div></div>
        <div style="flex:1;min-width:210px">${comp('가동률 Availability',avgA,'#3f74b5')}${comp('성능 Performance',avgP,'#14b8a6')}${comp('양품률 Quality',avgQ,'#4a8a60')}<div class="mini" style="margin-top:6px">${avgA}% × ${avgP}% × ${avgQ}% ≈ <b style="color:var(--navy)">${oee}%</b></div></div>
      </div>
      <div style="margin-top:14px"><div class="chead" style="margin-bottom:8px">라인별 OEE</div>${barsChart(bars,{max:100})}</div>
    </div>
    <div class="card"><h3>원가 · LOSS 분석 <span class="hint">맨아워 기반 · 단가 가정</span></h3>
      <div class="grid g2" style="gap:10px;margin-bottom:4px">
        <div class="kpi" style="box-shadow:none;padding:12px"><div class="lab">총 인건비(가정)</div><div class="val" style="font-size:19px">${won(laborCost)}<small>원</small></div><div class="delta">MH ${totMH}×${AS.wage.toLocaleString()}</div></div>
        <div class="kpi" style="box-shadow:none;padding:12px"><div class="lab">인당 원단위</div><div class="val" style="font-size:19px">${unitLabor}<small>원/개</small></div><div class="delta">인건비÷생산량</div></div>
      </div>
      ${lossrow('불량 발생손실',lossDef,'#c25a52','불량 '+defUnits.toLocaleString()+'개 × '+AS.price+'원')}
      ${lossrow('잔업 초과 인건비',lossOT,'#cb9447','잔업 '+otH+'h × '+AS.wage.toLocaleString()+'원 ×'+AS.otMul)}
      ${lossrow('계획 미달 기회손실',lossOpp,'#8a99ad','미달 '+missUnits.toLocaleString()+'개 × '+AS.price+'원')}
      <div class="reco warn" style="margin-top:8px"><div class="ic" data-ic="alert"></div><div class="tx"><div class="r">발생 LOSS ${won(lossDef+lossOT)}원 · 미달성 기회금액 ${won(lossOpp)}원</div><div class="s">단가·시급은 가정값입니다. 실단가 입력 시 자동 반영 예정.</div></div></div>
    </div>
  </div>
  <div class="grid g2" style="grid-template-columns:1fr 1fr;margin-bottom:14px">
    <div class="card"><div class="chead" style="margin-bottom:10px">불량률 추이</div>${lineChart(DB.qualTrend,{max:3,stroke:'#c25a52',fill:'#c25a5218',colorAt:v=>v>1.5?'#c25a52':'#4a8a60'})}</div>
    <div class="card"><div class="chead" style="margin-bottom:10px">요일별 잔업</div>${lineChart(DB.otTrend,{max:40,stroke:'#cb9447',fill:'#cb944718',colorAt:v=>v>=30?'#c25a52':'#cb9447'})}</div>
  </div>
  ${ledger('라인별 KPI 상세','OEE 구성 · 인시생산성(UPPH) · 불량손실 — '+L.length+'개 라인','<table class="tb"><thead><tr><th>라인</th><th>달성률</th><th>가동</th><th>성능</th><th>양품</th><th>OEE</th><th>UPPH</th><th>불량손실</th></tr></thead><tbody>'+tbl+'</tbody></table>')}`;
};
V.report=()=>{
  const tp=totProd(),oee=avgOEE(),df=avgDefect();const orders=DB.stock.filter(s=>G.stock(s).need);
  const topLines=myLines().filter(l=>G.achieve(l)>=80).map(l=>l.key).join('·');
  const lowLines=myLines().filter(l=>G.achieve(l)<70).map(l=>l.key).join('·');
  const brief=buildDailyBrief();
  return `
  <div class="card" id="dailyBrief" style="margin-bottom:14px"><h3><span style="display:inline-flex;vertical-align:-3px;color:var(--accent)">${svic('spark',16)}</span> 보고문 자동 생성 <span class="hint">8개 Agent 실데이터 종합 · 관리자 한 줄 + 메신저 보고문</span><span style="margin-left:auto;display:flex;gap:6px"><button class="btn" onclick="go('report')">↻ 재생성</button><button class="btn" onclick="dlDailyBrief()">↓ 저장</button></span></h3>
    <div class="reco" style="margin-bottom:12px"><div class="ic" data-ic="report" style="color:var(--accent)"></div><div class="tx"><div class="r">${brief.oneLine.replace(/</g,'&lt;')}</div><div class="s">관리자 한 줄 요약 · <a onclick="copyDailyBrief('one')" style="color:#3f74b5;cursor:pointer;font-weight:700">복사</a></div></div></div>
    <div style="position:relative"><pre class="briefbox">${brief.msg.replace(/</g,'&lt;')}</pre><button class="btn p" style="position:absolute;top:11px;right:11px" onclick="copyDailyBrief('msg')">복사</button></div>
  </div>
  ${(()=>{ /* 7월 마감 수지 — 프로덕션 D1(suji-portal-db.facts) 실측 */
    const M=[{m:'12월',v:3.86},{m:'1월',v:3.64},{m:'2월',v:2.99},{m:'3월',v:3.74},{m:'4월',v:4.17},{m:'5월',v:3.76},{m:'6월',v:4.17},{m:'7월',v:5.35}];
    const avg=(M.reduce((a,x)=>a+x.v,0)/M.length).toFixed(2);
    const bars=M.map((x,i)=>({label:x.m,v:x.v,color:i===M.length-1?'#4a8a60':x.v>=4?'#3f74b5':'#8aa8c8'}));
    return `<div class="card" style="margin-bottom:14px"><h3><span style="display:inline-flex;vertical-align:-3px;color:var(--accent)">${svic('db',16)}</span> 7월 마감 수지 — 실측 <span class="hint">수지 포털 D1(facts) · FY2026 · 아모레 · 업로드 자동 집계</span></h3>
    <div class="kstrip" style="margin-bottom:12px">
      <div class="ki"><div class="l">누적 매출 (8개월)</div><div class="v tnum">31.7<small>억</small></div><div class="d muted">월평균 ${avg}억 · 연 환산 ≈ 47.6억</div></div>
      <div class="ki"><div class="l">7월 매출 — 최고치</div><div class="v tnum" style="color:var(--ok)">5.35<small>억</small></div><div class="d muted">전월 4.17억 · <b style="color:#4a8a60">▲28.4%</b></div></div>
      <div class="ki"><div class="l">인원</div><div class="v tnum">89<small>명</small></div><div class="d muted">전월 대비 동일</div></div>
      <div class="ki"><div class="l">인당 매출 — 최고</div><div class="v tnum" style="color:var(--ok)">601<small>만원</small></div><div class="d muted">급여 2.83억 · 효율 개선</div></div>
    </div>
    <div class="chead" style="margin-bottom:8px">월별 매출 추이 (2025.12 ~ 2026.7 · 억원)</div>${barsChart(bars,{max:5.6})}
    <div class="mini" style="margin-top:8px">정산 엑셀 업로드 → 자동 적재·분석 · 7월 <b>최고치 경신</b></div></div>`;})()}
  <div class="grid g3" style="margin-bottom:14px">
    ${[['일간 보고서',todayKR(),'','t-blue','생성 가능','daily'],['주간 보고서',weekKR(),'','t-blue','생성 가능','weekly'],['월 마감 보고서',prevMonthKR()+' · v4.0','','t-green','도구 열기','monthly']].map(r=>`<a class="cardlink" onclick="openReport('${r[5]}')"><div class="card"><div style="display:flex;gap:11px;align-items:center"><div style="width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:20px;background:#f7f8f8;border:1px solid var(--line2);flex:0 0 auto">${r[2]}</div><div style="flex:1;min-width:0"><div style="font-weight:700">${r[0]}</div><div class="mini">${r[1]}</div></div><span class="tag ${r[3]}">${r[4]}</span></div></div></a>`).join('')}
  </div>
  ${dualEmbed('monthly','월 마감 자동 보고서',svic('report',16),monthlyURL(),'74vh','monthlyReport')}
  ${ledger('일간 생산일보 (문서형)','8개 Agent 데이터 자동 취합 · 정식 문서 양식 — 클릭하여 펼침',`<div style="text-align:right;margin:2px 0 8px"><button class="btn" onclick="exportReport()">↓ 내보내기</button></div><div class="report-doc"><h4>AP 헤어앤뷰티 사업장 생산일보 — ${todayKR()}</h4><div class="kv">작성: ZEN Report Agent · 자동 생성 · 데이터원: ${dataSource}</div><p><b>1. 생산 실적</b><br>전 라인 목표 ${(tp.t/1000).toFixed(0)}천개 대비 실적 ${(tp.a/1000).toFixed(0)}천개(달성률 ${tp.ach}%). ${topLines||'-'} 정상, ${lowLines||'없음'} 부진.</p><p><b>2. 인력 현황</b><br>필요 ${headNeed()}명 대비 투입 ${headCur()}명(${headNeed()-headCur()}명 부족), 연차 ${DB.work[1].n}명. 여유 라인 재배치 및 잔업으로 대응 예정.</p><p><b>3. 품질</b><br>평균 불량률 ${df}%(목표 1.5%). 주요 원인 ${DB.paretoNames[0]}·${DB.paretoNames[1]}. 최다 라인 조치 진행.</p><p><b>4. 안전</b><br>WBGT ${DB.safety.wbgt}℃ 폭염 ${DB.safety.wbgt>=28?'경고':'주의'}. 휴식·수분 조치. 무재해 ${DB.safety.noAccident}일.</p><p><b>5. 자재/설비</b><br>${orders.length?orders.map(s=>s.name).join('·')+' 긴급 발주 요청':'자재 발주 이슈 없음'}. 완제품 창고 ${DB.warehouse[0].fill}% 포화. 전 라인 OEE ${oee}%.</p><ul><li><b>금일 조치:</b> 인력 재배치, 발주 ${orders.length}건, 세척 ${myLines().filter(l=>G.cleanScore(l)>=75).length}라인</li><li><b>익일 리스크:</b> 자재 미입고 시 라인 중단 · 폭염 지속</li></ul></div>`)}`;
};

