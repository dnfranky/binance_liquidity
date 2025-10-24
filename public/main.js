
const $ = (s)=>document.querySelector(s);
const $tbody = $("#table tbody");
const $status = $("#statusText");
const $error = $("#errorBox");
const $refreshNow=$("#refreshNow");
const $auto=$("#autoRefresh");
const $period=$("#autoPeriod");
const $min24=$("#min24hVol");
const $minVol=$("#minVolPct");
const $openWith=$("#openWith");
const $tabs=document.querySelectorAll(".tab");
const $sortBetween=$("#sortBetween");

let autoTimer=null;
let last24=0;
let mode="between";
let T24=new Map(); // symbol->{last,high,low,volQuote,volPct}

// proxy json helper
async function api(path){
  const r=await fetch(`/api/proxy?p=${encodeURIComponent(path)}`);
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

function pct(a,b){ if(!a||!b) return 0; return (a/b-1)*100; }
function fmt(n,d=2){ return Number(n).toLocaleString(undefined,{maximumFractionDigits:d}); }
function base(sym){ return sym.replace("USDT",""); }
function tv(sym){ return `https://www.tradingview.com/chart/?symbol=BINANCE:${base(sym)}USDT.P&interval=1`; }
function cg(sym){ return `https://www.coinglass.com/pro/futures/LiquidationHeatMap?coin=${base(sym)}`; }
function binance(sym){ return `https://www.binance.com/en/futures/${sym}?type=perpetual`; }

function openFor(sym){
  const t=$openWith.value;
  const map={ tv:tv(sym), coinglass:cg(sym), binance:binance(sym) };
  window.open(map[t], "_blank", "noopener");
}

async function load24h(){
  const arr=await api("/fapi/v1/ticker/24hr");
  const map=new Map();
  for(const t of arr){
    if(!t.symbol.endsWith("USDT")) continue;
    const last=Number(t.lastPrice);
    const high=Number(t.highPrice);
    const low =Number(t.lowPrice);
    const volQ=Number(t.quoteVolume);
    const volpct = ((Math.max(0,high-low))/last)*100;
    map.set(t.symbol,{last,high,low,volQuote:volQ,volPct:volpct});
  }
  T24=map; last24=Date.now();
}

function filteredSymbols(){
  const min24=Number($min24.value||0);
  const minVol=Number($minVol.value||0);
  const list=[];
  for(const [s,t] of T24.entries()){
    if(t.volQuote>=min24 && t.volPct>=minVol) list.push(s);
  }
  // sort by % distance to high/low depending on mode
  const key=$sortBetween.value;
  if(mode==="between"){
    list.sort((a,b)=>{
      const ta=T24.get(a), tb=T24.get(b);
      const aUp=pct(ta.high,ta.last), bUp=pct(tb.high,tb.last);
      const aDn=pct(ta.last,ta.low),  bDn=pct(tb.last,tb.low);
      const ka = key==="toHigh"?aUp : key==="toLow"?aDn : ta.volPct;
      const kb = key==="toHigh"?bUp : key==="toLow"?bDn : tb.volPct;
      return ka-kb; // asc
    });
  }
  return list.slice(0,200);
}

function render(){
  $tbody.innerHTML="";
  const list=filteredSymbols();
  for(const s of list){
    const t=T24.get(s);
    const toHigh=pct(t.high,t.last);
    const toLow=pct(t.last,t.low);
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td><a class="link" href="#" data-s="${s}">${s}</a></td>
      <td>${fmt(t.last, t.last>10?2:6)}</td>
      <td>${fmt(t.high, t.high>10?2:6)}</td>
      <td>${fmt(t.low,  t.low>10?2:6)}</td>
      <td>${fmt(toHigh,2)}%</td>
      <td>${fmt(toLow,2)}%</td>
      <td>${fmt(t.volPct,2)}%</td>
      <td>${fmt(t.volQuote,0)}</td>
      <td>${new Date().toLocaleTimeString()}</td>
      <td><button class="open" data-s="${s}">Open</button></td>
    `;
    $tbody.appendChild(tr);
  }
  // bind clicks
  $tbody.querySelectorAll("a.link").forEach(a=>{
    a.addEventListener("click",(e)=>{ e.preventDefault(); openFor(e.target.dataset.s); });
  });
  $tbody.querySelectorAll("button.open").forEach(b=>{
    b.addEventListener("click",()=> openFor(b.dataset.s));
  });
}

async function refresh(){
  try{
    $error.hidden=true; $error.textContent="";
    $refreshNow.classList.add("loading"); $refreshNow.disabled=true;
    await load24h();
    render();
    $status.textContent=`Active symbols: ${filteredSymbols().length}. Last update ${new Date().toLocaleTimeString()}`;
  }catch(e){
    $error.hidden=false; $error.textContent = String(e).slice(0,280);
  }finally{
    $refreshNow.classList.remove("loading"); $refreshNow.disabled=false;
  }
}

function setupAuto(){
  if(autoTimer){ clearInterval(autoTimer); autoTimer=null; }
  if($auto.checked){
    autoTimer=setInterval(refresh, Number($period.value||60000));
  }
}

// events
$refreshNow.addEventListener("click", refresh);
[$auto,$period,$min24,$minVol,$sortBetween].forEach(el=>el.addEventListener("change", ()=>{ if(el===$auto||el===$period) setupAuto(); render(); }));
$tabs.forEach(t=>t.addEventListener("click",()=>{
  $tabs.forEach(x=>x.classList.remove("active"));
  t.classList.add("active");
  mode=t.dataset.mode;
  render();
}));

// boot
(async function(){
  await refresh(); setupAuto();
})();
