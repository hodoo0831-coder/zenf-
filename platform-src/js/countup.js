
/* KPI 숫자 카운트업 — 뷰 렌더 시 자동 */
(function(){
  const orig=window.go;
  function countUp(root){
    root.querySelectorAll('.kpi .val, .ki .v').forEach(el=>{
      const tn=el.childNodes[0];
      if(!tn||tn.nodeType!==3)return;
      const raw=tn.textContent.trim();
      const m=raw.match(/^-?[\d,]+(\.\d+)?$/); if(!m)return;
      const to=parseFloat(raw.replace(/,/g,'')); if(isNaN(to))return;
      const dec=raw.includes('.')?(raw.split('.')[1]||'').length:0;
      const hasComma=raw.includes(','), t0=performance.now(), dur=750;
      (function tick(t){
        let k=Math.min(1,(t-t0)/dur); k=1-Math.pow(1-k,3);
        let v=(to*k).toFixed(dec);
        if(hasComma)v=(+v).toLocaleString(undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec});
        tn.textContent=v;
        if(k<1)requestAnimationFrame(tick); else tn.textContent=raw;
      })(t0);
    });
  }
  window.go=function(id){ orig(id); try{countUp(document.getElementById('view'));}catch(e){} };
})();

