export function buildGetMyMailPage(baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Morning Brief</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* ── Reset & tokens ─────────────────────────────────────────────── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  /* Surfaces — each step is one stop lighter */
  --bg:       #0d1117;
  --s0:       #161b22;   /* card background */
  --s1:       #1c2330;   /* card header / divider rows */
  --s2:       #21273a;   /* hover state */
  --border:   #30363d;
  --border-s: #21273a;   /* subtle inner border */

  /* Type — four-stop scale */
  --t1: #f0f6fc;          /* primary: headings, titles */
  --t2: #c9d1d9;          /* secondary: body text, sender names */
  --t3: #8b949e;          /* tertiary: metadata, timestamps */
  --t4: #484f58;          /* quaternary: disabled, separators */

  /* Accent colours */
  --blue:   #58a6ff;
  --green:  #3fb950;
  --amber:  #d29922;
  --red:    #f85149;
  --purple: #bc8cff;
  --teal:   #39d353;

  /* Semantic surfaces */
  --blue-s:   rgba(88,166,255,.12);
  --green-s:  rgba(63,185,80,.12);
  --amber-s:  rgba(210,153,34,.14);
  --red-s:    rgba(248,81,73,.12);
  --purple-s: rgba(188,140,255,.12);

  /* Spacing — 4 px grid */
  --r:  8px;   /* base radius */
  --r2: 12px;  /* card radius */
}

body{
  font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  background:var(--bg);
  color:var(--t2);
  min-height:100vh;
  font-size:14px;
  line-height:1.5;
  -webkit-font-smoothing:antialiased;
}
a{color:inherit;text-decoration:none}
button{font-family:inherit}

/* ── Header ─────────────────────────────────────────────────────── */
header{
  background:var(--s0);
  padding:12px 20px;
  display:flex;align-items:center;justify-content:space-between;
  border-bottom:1px solid var(--border);
  gap:12px;flex-wrap:wrap;
  position:sticky;top:0;z-index:50;
  backdrop-filter:blur(12px);
}
.h-brand{display:flex;align-items:center;gap:10px}
.h-icon{
  width:30px;height:30px;
  background:linear-gradient(135deg,#1f6feb,#8957e5);
  border-radius:8px;display:flex;align-items:center;justify-content:center;
  font-size:.9rem;flex-shrink:0;
}
.h-title{font-size:.9375rem;font-weight:600;color:var(--t1);letter-spacing:-.01em}
.h-sub{font-size:.75rem;color:var(--t3);margin-top:1px;font-weight:400}
.h-btns{display:flex;gap:8px;align-items:center;flex-wrap:wrap}

/* Buttons — pill-shaped, SF-weight */
.btn{
  border:none;
  padding:7px 14px;
  border-radius:20px;
  font-size:.8125rem;font-weight:500;
  cursor:pointer;
  display:inline-flex;align-items:center;gap:5px;
  transition:opacity .15s,filter .15s;
  white-space:nowrap;line-height:1;
  letter-spacing:.01em;
}
.btn:hover:not(:disabled){filter:brightness(1.1)}
.btn:active:not(:disabled){filter:brightness(.95)}
.btn:disabled{opacity:.35;cursor:not-allowed}
.btn-blue{background:#1f6feb;color:#fff}
.btn-green{background:#238636;color:#fff}
.btn-amber{background:#9e6a03;color:#fff}
.btn-ghost{background:var(--s1);color:var(--t2);border:1px solid var(--border)}

/* Status dot */
.sdot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}
.sdot-green{background:var(--green);box-shadow:0 0 5px var(--green)}
.sdot-grey{background:var(--t4)}
.sdot-orange{background:#db6d28;box-shadow:0 0 5px #db6d28}

/* Spinner */
.spin{
  display:inline-block;width:11px;height:11px;
  border:1.5px solid transparent;border-top-color:currentColor;
  border-radius:50%;animation:spin .65s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── Main container ──────────────────────────────────────────────── */
main{max-width:1200px;margin:0 auto;padding:20px 20px 40px}

/* ── Financial chips ─────────────────────────────────────────────── */
.fin-bar{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
.fin-chip{
  background:var(--s0);
  border:1px solid var(--border);
  border-radius:var(--r2);
  padding:12px 16px;
  display:flex;flex-direction:column;gap:3px;
  min-width:120px;flex:1;
}
.fin-label{
  font-size:.6875rem;font-weight:500;
  color:var(--t3);
  letter-spacing:.02em;
}
.fin-value{
  font-size:1.0625rem;font-weight:600;
  color:var(--t1);line-height:1.2;
}
.fin-value.is-balance{color:var(--green)}

/* ── Summary tiles ──────────────────────────────────────────────── */
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:24px}
.tile{
  background:var(--s0);border:1px solid var(--border);
  border-radius:var(--r2);padding:16px 18px;
}
.tile-label{font-size:.6875rem;font-weight:500;color:var(--t3);letter-spacing:.02em}
.tile-value{font-size:1.75rem;font-weight:700;color:var(--t1);line-height:1;margin-top:4px;letter-spacing:-.02em}
.tile-sub{font-size:.75rem;color:var(--t3);margin-top:3px;font-weight:400}
.tile-sub.alert{color:var(--amber)}

/* ── Section heading ─────────────────────────────────────────────── */
.sec-heading{
  font-size:.8125rem;font-weight:600;
  color:var(--t3);
  margin:0 0 12px;
  display:flex;align-items:center;gap:10px;
  letter-spacing:.01em;
}
.sec-heading::after{content:'';flex:1;height:1px;background:var(--border)}

/* ── Action groups ───────────────────────────────────────────────── */
#actionsSection{margin-bottom:28px}
.proj-group{margin-bottom:10px;border-radius:var(--r2);overflow:hidden;border:1px solid var(--border)}
.proj-header{
  display:flex;align-items:center;gap:9px;
  padding:9px 14px;
  background:var(--s1);
  border-bottom:1px solid var(--border);
}
.proj-swatch{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.proj-name{font-size:.8125rem;font-weight:600;color:var(--t2);flex:1}
.proj-count{
  font-size:.6875rem;font-weight:500;
  color:var(--t4);
  background:var(--border);
  padding:1px 8px;border-radius:20px;
}

/* Action card */
.ac{
  background:var(--s0);
  border-left:2.5px solid transparent;
  padding:14px 16px;
  border-bottom:1px solid var(--border-s);
  transition:background .12s;
}
.ac:last-child{border-bottom:none}
.ac:hover{background:var(--s2)}
.ac.high{border-left-color:var(--red)}
.ac.medium{border-left-color:var(--green)}
.ac.low{border-left-color:var(--t4)}

/* Action title row */
.ac-row1{display:flex;align-items:flex-start;gap:10px;margin-bottom:0}
.ac-title{
  font-size:.9375rem;font-weight:600;
  color:var(--t1);
  flex:1;line-height:1.4;
  letter-spacing:-.01em;
}
.ac-pills{display:flex;gap:5px;flex-shrink:0;align-items:center;flex-wrap:wrap;justify-content:flex-end;padding-top:2px}

/* Pill badges — uniform height */
.pill{
  display:inline-flex;align-items:center;
  font-size:.6875rem;font-weight:500;
  padding:2px 8px;border-radius:20px;
  white-space:nowrap;line-height:1.4;
}
.pill-high{background:var(--red-s);color:#ffa198}
.pill-med{background:var(--green-s);color:#7ee787}
.pill-low{background:var(--s1);color:var(--t3)}
.pill-due{background:var(--amber-s);color:#d29922}
.pill-over{background:var(--red-s);color:#ffa198}
.pill-rec{background:var(--purple-s);color:var(--purple);letter-spacing:.02em}

/* Next action */
.ac-next{
  font-size:.8125rem;font-weight:400;
  color:var(--t3);
  margin-top:5px;line-height:1.5;
  padding-left:14px;
  position:relative;
}
.ac-next::before{
  content:'';
  position:absolute;left:2px;top:6px;
  width:6px;height:6px;border-radius:50%;
  background:var(--blue);opacity:.7;
}

/* Metadata footer */
.ac-foot{
  display:flex;gap:14px;margin-top:7px;flex-wrap:wrap;
  align-items:center;
}
.ac-foot-item{
  font-size:.6875rem;font-weight:400;
  color:var(--t4);
  display:flex;align-items:center;gap:3px;
}
.ac-key{
  font-size:.6875rem;font-weight:500;
  color:var(--border);
  font-variant-numeric:tabular-nums;
  letter-spacing:.02em;
}

/* ── Two-col below ───────────────────────────────────────────────── */
.below-grid{display:grid;grid-template-columns:1fr 320px;gap:16px}
@media(max-width:820px){.below-grid{grid-template-columns:1fr}}

/* ── Card ─────────────────────────────────────────────────────────── */
.card{
  background:var(--s0);border:1px solid var(--border);
  border-radius:var(--r2);overflow:hidden;
  margin-bottom:12px;
}
.card:last-child{margin-bottom:0}
.card-hdr{
  padding:11px 16px;
  border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;
}
.card-title{font-size:.875rem;font-weight:600;color:var(--t1)}
.c-badge{
  font-size:.6875rem;font-weight:500;
  background:var(--s1);color:var(--t3);
  padding:2px 8px;border-radius:20px;
}
.c-badge-blue{background:var(--blue-s);color:var(--blue)}

/* ── Divider row label ───────────────────────────────────────────── */
.divlbl{
  font-size:.6875rem;font-weight:500;
  color:var(--t4);
  padding:5px 16px;
  background:var(--s1);
  border-bottom:1px solid var(--border-s);
  letter-spacing:.02em;
}

/* ── Email rows ──────────────────────────────────────────────────── */
.e-row{
  padding:11px 16px;
  border-bottom:1px solid var(--border-s);
  display:flex;gap:10px;align-items:flex-start;
  transition:background .12s;cursor:pointer;
}
.e-row:last-child{border-bottom:none}
.e-row:hover{background:var(--s2)}
.avatar{
  width:32px;height:32px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-size:.75rem;font-weight:600;
  flex-shrink:0;color:#fff;
  letter-spacing:-.01em;
}
.unread-dot{width:6px;height:6px;border-radius:50%;background:var(--blue);flex-shrink:0;margin-top:7px}
.unread-dot-empty{width:6px;flex-shrink:0}
.e-body{flex:1;min-width:0}
.e-from{
  font-size:.8125rem;font-weight:500;
  color:var(--t2);
  display:flex;justify-content:space-between;gap:8px;
  align-items:baseline;
}
.e-time{font-size:.6875rem;color:var(--t4);font-weight:400;flex-shrink:0}
.e-subj{
  font-size:.875rem;color:var(--t1);font-weight:500;
  margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.e-prev{
  font-size:.75rem;color:var(--t3);font-weight:400;
  margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}

/* ── Calendar rows ───────────────────────────────────────────────── */
.ev-row{
  padding:11px 16px;
  border-bottom:1px solid var(--border-s);
  display:flex;gap:10px;align-items:flex-start;
}
.ev-row:last-child{border-bottom:none}
.time-blk{
  background:var(--bg);border-radius:var(--r);
  padding:5px 9px;text-align:center;min-width:46px;flex-shrink:0;
  border:1px solid var(--border);
}
.time-h{font-size:.9375rem;font-weight:600;color:var(--blue);line-height:1;letter-spacing:-.01em}
.time-sub{font-size:.625rem;color:var(--t4);font-weight:400;letter-spacing:.03em;margin-top:1px}
.ev-body{flex:1;min-width:0}
.ev-title{font-size:.875rem;font-weight:500;color:var(--t1)}
.ev-meta{font-size:.75rem;color:var(--t3);margin-top:2px}
.ev-pill{
  display:inline-flex;font-size:.6875rem;font-weight:500;
  padding:2px 7px;border-radius:20px;margin-top:4px;
}
.ev-today{background:var(--blue-s);color:var(--blue)}
.ev-soon{background:var(--green-s);color:var(--green)}

/* ── Upload panel ────────────────────────────────────────────────── */
#uploadPanel{display:none;margin-bottom:20px}
#uploadPanel.open{display:block}
.upload-card{
  background:var(--s0);
  border:1px solid #9e6a03;
  border-radius:var(--r2);padding:20px;
}
.upload-card h3{font-size:.9375rem;font-weight:600;color:#d29922;margin-bottom:6px}
.upload-card p{font-size:.8125rem;color:var(--t3);margin-bottom:14px;line-height:1.6}
textarea{
  width:100%;
  background:var(--bg);color:var(--t1);
  border:1px solid var(--border);border-radius:var(--r);
  padding:10px 12px;
  font-family:'SF Mono','Fira Code',monospace;
  font-size:.75rem;resize:vertical;min-height:140px;outline:none;
  line-height:1.6;
}
textarea:focus{border-color:#9e6a03;box-shadow:0 0 0 3px rgba(158,106,3,.2)}
.upload-row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center}
.upload-msg{
  font-size:.8125rem;margin-top:10px;
  padding:9px 13px;border-radius:var(--r);
}
.upload-msg.ok{background:var(--green-s);color:#7ee787;border:1px solid rgba(63,185,80,.3)}
.upload-msg.err{background:var(--red-s);color:#ffa198;border:1px solid rgba(248,81,73,.3)}

/* ── Empty state ─────────────────────────────────────────────────── */
.empty{
  padding:28px 16px;text-align:center;
  color:var(--t4);font-size:.875rem;font-weight:400;
}

/* ── Toast ───────────────────────────────────────────────────────── */
#toast{
  position:fixed;bottom:24px;right:24px;
  background:var(--s0);border:1px solid var(--border);
  border-radius:10px;padding:11px 16px;
  font-size:.8125rem;font-weight:500;color:var(--t1);
  transform:translateY(70px);opacity:0;
  transition:transform .22s cubic-bezier(.34,1.56,.64,1),opacity .22s;
  z-index:99;max-width:300px;
  box-shadow:0 8px 24px rgba(0,0,0,.4);
}
#toast.show{transform:translateY(0);opacity:1}
#toast.ok{border-color:rgba(63,185,80,.5)}
#toast.err{border-color:rgba(248,81,73,.5)}

/* ── Mobile ──────────────────────────────────────────────────────── */
@media(max-width:600px){
  header{padding:10px 14px}
  .h-title{font-size:.875rem}
  .h-btns{gap:6px}
  .btn{padding:6px 12px;font-size:.75rem}
  main{padding:14px 14px 36px}
  .fin-bar{gap:6px}
  .fin-chip{min-width:0;padding:10px 12px}
  .fin-value{font-size:.9375rem}
  .tiles{gap:6px}
  .tile{padding:13px 14px}
  .tile-value{font-size:1.5rem}
  .ac-title{font-size:.875rem}
  .ac-next{font-size:.75rem}
  #toast{right:14px;bottom:14px;left:14px;max-width:none;text-align:center}
}
</style>
</head>
<body>

<header>
  <div class="h-brand">
    <div class="h-icon">📋</div>
    <div>
      <div class="h-title">Morning Brief</div>
      <div class="h-sub" id="hSub">Loading…</div>
    </div>
  </div>
  <div class="h-btns">
    <span id="hDot"><span class="sdot sdot-grey"></span></span>
    <button id="syncBtn" class="btn btn-blue" disabled>
      <span class="spin" id="spn" style="display:none"></span>Sync
    </button>
    <button id="copyBtn" class="btn btn-green" disabled>Copy JSON</button>
    <button id="uploadToggle" class="btn btn-amber">New Upload</button>
  </div>
</header>

<main>

  <!-- Upload panel -->
  <div id="uploadPanel">
    <div class="upload-card">
      <h3>Upload updated JSON from Gemini</h3>
      <p>Paste the complete Master JSON. This replaces the stored action list.</p>
      <textarea id="uploadJson" placeholder="Paste JSON here…" spellcheck="false"></textarea>
      <div class="upload-row">
        <button id="uploadBtn" class="btn btn-amber">Upload &amp; Save</button>
        <button id="uploadCancel" class="btn btn-ghost">Cancel</button>
      </div>
      <div id="uploadResult"></div>
    </div>
  </div>

  <!-- Financial state -->
  <div class="fin-bar" id="finBar" style="display:none"></div>

  <!-- Summary tiles -->
  <div class="tiles">
    <div class="tile">
      <div class="tile-label">Open actions</div>
      <div class="tile-value" id="sActions">—</div>
      <div class="tile-sub alert" id="sActSub"></div>
    </div>
    <div class="tile">
      <div class="tile-label">Unread emails</div>
      <div class="tile-value" id="sUnread">—</div>
      <div class="tile-sub">in inbox</div>
    </div>
    <div class="tile">
      <div class="tile-label">Today's calendar</div>
      <div class="tile-value" id="sCal">—</div>
      <div class="tile-sub">events</div>
    </div>
  </div>

  <!-- Actions -->
  <section id="actionsSection">
    <div class="sec-heading">Actions</div>
    <div id="actionGroups">
      <div class="empty" style="background:var(--s0);border:1px solid var(--border);border-radius:var(--r2)">Loading…</div>
    </div>
  </section>

  <!-- Email + Calendar -->
  <div class="below-grid">
    <div>
      <div class="sec-heading">Email</div>
      <div class="card">
        <div class="card-hdr">
          <span class="card-title">Important &amp; unread</span>
          <span class="c-badge c-badge-blue" id="cImp">0</span>
        </div>
        <div id="impList"><div class="empty">Loading…</div></div>
      </div>
      <div class="card">
        <div class="card-hdr">
          <span class="card-title">Newsletters &amp; marketing</span>
          <span class="c-badge" id="cMkt">0</span>
        </div>
        <div id="mktList"><div class="empty">Loading…</div></div>
      </div>
    </div>
    <div>
      <div class="sec-heading">Calendar</div>
      <div class="card">
        <div id="calList"><div class="empty">Loading…</div></div>
      </div>
    </div>
  </div>

</main>
<div id="toast"></div>

<script>
(function(){
'use strict';
const BASE='${baseUrl}';
const TOKEN='716180e24c87de8b699efd32198adbd9';
let lastData=null;

// ── Helpers ──────────────────────────────────────────────────────────
const PAL=['#58a6ff','#bc8cff','#3fb950','#d29922','#f85149','#39d353','#79c0ff','#d2a8ff'];
const PCOLS=['#388bfd','#3fb950','#d29922','#bc8cff','#f85149','#56d364','#2f81f7','#db61a2'];
function hCol(s,p){let h=0;for(let i=0;i<s.length;i++)h=s.charCodeAt(i)+((h<<5)-h);return p[Math.abs(h)%p.length]}
function ini(n){if(!n)return'?';const w=n.split(' ').filter(Boolean);return w.length>=2?(w[0][0]+w[w.length-1][0]).toUpperCase():n.slice(0,2).toUpperCase()}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function ago(iso){const d=Date.now()-new Date(iso).getTime(),m=Math.floor(d/60000),h=Math.floor(m/60),dy=Math.floor(h/24);return m<2?'now':m<60?m+'m':h<24?h+'h':dy+'d'}
function sast(iso){const d=new Date(new Date(iso).getTime()+2*3600000);return d.getUTCHours().toString().padStart(2,'0')+':'+d.getUTCMinutes().toString().padStart(2,'0')}
function dFmt(iso){return new Date(iso).toLocaleDateString('en-ZA',{weekday:'short',month:'short',day:'numeric',timeZone:'Africa/Johannesburg'})}
function dueDays(iso){if(!iso)return null;return Math.ceil((new Date(iso)-Date.now())/86400000)}

// ── Financial bar ─────────────────────────────────────────────────
function renderFinancial(fin){
  if(!fin||!Object.keys(fin).length)return;
  const bar=document.getElementById('finBar');
  bar.style.display='flex';
  const LABELS={
    admyt_balance:'Admyt',
    sanral_balance:'SANRAL',
    city_of_cape_town_mooiverwacht:'CCT Mooiverwacht',
    osro:'OSRO',
    vashti_tenant_invoice:'Vashti Invoice'
  };
  bar.innerHTML=Object.entries(fin).map(([k,v])=>{
    const lbl=LABELS[k]||k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    const balance=k.includes('balance');
    return '<div class="fin-chip">'
      +'<div class="fin-label">'+esc(lbl)+'</div>'
      +'<div class="fin-value'+(balance?' is-balance':'')+'">'+esc(String(v))+'</div>'
      +'</div>';
  }).join('');
}

// ── Action list ────────────────────────────────────────────────────
function renderActions(acts){
  const open=acts.filter(a=>a.status==='open');
  document.getElementById('sActions').textContent=open.length||'0';
  const high=open.filter(a=>a.priority==='high').length;
  const sub=document.getElementById('sActSub');
  if(high>0){sub.textContent=high+' high priority';sub.style.color='#d29922';}
  else{sub.textContent='All on track';sub.style.color='var(--t3)';}

  if(!open.length){
    document.getElementById('actionGroups').innerHTML='<div class="empty" style="background:var(--s0);border:1px solid var(--border);border-radius:var(--r2)">No open actions</div>';
    return;
  }

  // Sort: high → medium → low, then group by project
  const ORDER={high:0,medium:1,low:2};
  const sorted=[...open].sort((a,b)=>(ORDER[a.priority]??9)-(ORDER[b.priority]??9));
  const groups=Object.create(null);
  for(const a of sorted){
    const p=a.project||'General';
    (groups[p]=groups[p]||[]).push(a);
  }

  document.getElementById('actionGroups').innerHTML=Object.entries(groups).map(([proj,items])=>{
    const col=hCol(proj,PCOLS);
    const cards=items.map(a=>{
      const dd=dueDays(a.due_date);
      let duePill='';
      if(dd!==null){
        if(dd<0)       duePill='<span class="pill pill-over">'+Math.abs(dd)+'d overdue</span>';
        else if(dd===0)duePill='<span class="pill pill-over">Due today</span>';
        else if(dd<=7) duePill='<span class="pill pill-due">'+dd+'d left</span>';
        else           duePill='<span class="pill pill-due">'+new Date(a.due_date).toLocaleDateString('en-ZA',{day:'numeric',month:'short'})+'</span>';
      }
      const priPill={high:'<span class="pill pill-high">High</span>',medium:'<span class="pill pill-med">Medium</span>',low:'<span class="pill pill-low">Low</span>'}[a.priority]||'';
      const recPill=a.recurrence?'<span class="pill pill-rec">↻ Recurring</span>':'';

      const foot=[];
      if(a.recurrence)foot.push('<span class="ac-foot-item">↻ '+esc(a.recurrence)+'</span>');
      if(a.migration_key)foot.push('<span class="ac-key">'+esc(a.migration_key)+'</span>');

      return '<div class="ac '+a.priority+'">'
        +'<div class="ac-row1">'
        +'<div class="ac-title">'+esc(a.title)+'</div>'
        +'<div class="ac-pills">'+priPill+duePill+recPill+'</div>'
        +'</div>'
        +(a.next_action?'<div class="ac-next">'+esc(a.next_action)+'</div>':'')
        +(foot.length?'<div class="ac-foot">'+foot.join('')+'</div>':'')
        +'</div>';
    }).join('');

    return '<div class="proj-group">'
      +'<div class="proj-header">'
      +'<div class="proj-swatch" style="background:'+col+'"></div>'
      +'<span class="proj-name">'+esc(proj)+'</span>'
      +'<span class="proj-count">'+items.length+'</span>'
      +'</div>'
      +cards
      +'</div>';
  }).join('');
}

// ── Email ──────────────────────────────────────────────────────────
function emailHtml(m){
  const name=m.sender_name||m.sender_email||'?';
  return '<a href="'+esc(m.web_link||'#')+'" target="_blank" rel="noopener">'
    +'<div class="e-row">'
    +(m.is_read?'<div class="unread-dot-empty"></div>':'<div class="unread-dot"></div>')
    +'<div class="avatar" style="background:'+hCol(name,PAL)+'">'+esc(ini(name))+'</div>'
    +'<div class="e-body">'
    +'<div class="e-from"><span>'+esc(name)+'</span><span class="e-time">'+ago(m.received_at)+'</span></div>'
    +'<div class="e-subj">'+esc(m.subject||'(no subject)')+'</div>'
    +'<div class="e-prev">'+esc((m.body_preview||'').slice(0,100))+'</div>'
    +'</div></div></a>';
}

// ── Calendar ───────────────────────────────────────────────────────
function eventHtml(e,today){
  return '<div class="ev-row">'
    +'<div class="time-blk"><div class="time-h">'+sast(e.start_at)+'</div><div class="time-sub">SAST</div></div>'
    +'<div class="ev-body">'
    +'<div class="ev-title">'+esc(e.subject||'(no title)')+'</div>'
    +'<div class="ev-meta">'+(e.location?esc(e.location)+' · ':'')+( today?'Today':esc(dFmt(e.start_at)))+'</div>'
    +'<span class="ev-pill '+(today?'ev-today':'ev-soon')+'">'+(today?'Today':'Upcoming')+'</span>'
    +'</div></div>';
}

// ── Load ──────────────────────────────────────────────────────────
async function load(){
  busy(true);
  try{
    const r=await fetch(BASE+'/brief',{headers:{Authorization:'Bearer '+TOKEN}});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();
    lastData=d;

    const statusOk=d.status==='complete';
    document.getElementById('hDot').innerHTML='<span class="sdot '+(statusOk?'sdot-green':'sdot-orange')+'"></span>';
    document.getElementById('hSub').textContent=new Date().toLocaleString('en-ZA',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Johannesburg'});
    document.getElementById('sUnread').textContent=d.emails?.unread_count??'0';
    document.getElementById('sCal').textContent=(d.calendar?.today_events||[]).length;

    renderFinancial(d.financial_and_operational_state);
    renderActions((d.action_list&&d.action_list.actions)||[]);

    const imp=d.emails?.important_messages||[];
    document.getElementById('cImp').textContent=imp.length;
    document.getElementById('impList').innerHTML=imp.length?imp.map(emailHtml).join(''):'<div class="empty">No important emails</div>';

    const mkt=d.emails?.marketing_messages||[];
    document.getElementById('cMkt').textContent=mkt.length;
    document.getElementById('mktList').innerHTML=mkt.length?mkt.map(emailHtml).join(''):'<div class="empty">No newsletters</div>';

    const te=d.calendar?.today_events||[],ue=d.calendar?.upcoming_events||[];
    let cal='';
    if(te.length)cal+='<div class="divlbl">Today</div>'+te.map(e=>eventHtml(e,true)).join('');
    if(ue.length)cal+='<div class="divlbl">Coming up</div>'+ue.map(e=>eventHtml(e,false)).join('');
    document.getElementById('calList').innerHTML=cal||'<div class="empty">No upcoming events</div>';

    document.getElementById('copyBtn').disabled=false;
    toast('Loaded',false);
  }catch(e){toast('Error: '+e.message,true)}
  finally{busy(false)}
}

async function syncAndLoad(){
  busy(true);toast('Syncing…',false);
  try{
    await fetch(BASE+'/sync',{method:'POST',headers:{Authorization:'Bearer '+TOKEN}});
    await load();
  }catch(e){toast('Sync failed',true);busy(false)}
}

// ── Wire up ───────────────────────────────────────────────────────
document.getElementById('syncBtn').addEventListener('click',syncAndLoad);

document.getElementById('copyBtn').addEventListener('click',async()=>{
  if(!lastData)return;
  try{await navigator.clipboard.writeText(JSON.stringify(lastData,null,2));toast('Copied to clipboard',false);}
  catch(e){toast('Copy failed',true)}
});

document.getElementById('uploadToggle').addEventListener('click',()=>{
  const p=document.getElementById('uploadPanel');
  p.classList.toggle('open');
  if(p.classList.contains('open'))p.scrollIntoView({behavior:'smooth',block:'start'});
});
document.getElementById('uploadCancel').addEventListener('click',()=>{
  document.getElementById('uploadPanel').classList.remove('open');
  document.getElementById('uploadJson').value='';
  document.getElementById('uploadResult').innerHTML='';
});

document.getElementById('uploadBtn').addEventListener('click',async()=>{
  const raw=document.getElementById('uploadJson').value.trim();
  const el=document.getElementById('uploadResult');
  el.className='';el.innerHTML='';
  if(!raw){el.className='upload-msg err';el.textContent='Paste JSON first.';return;}
  let payload;
  try{payload=JSON.parse(raw);}
  catch(e){el.className='upload-msg err';el.textContent='Invalid JSON: '+e.message;return;}
  try{
    document.getElementById('uploadBtn').disabled=true;
    const r=await fetch(BASE+'/actions/import',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+TOKEN},
      body:JSON.stringify(payload)
    });
    const data=await r.json();
    if(r.ok){
      el.className='upload-msg ok';el.textContent=data.message||'Imported successfully';
      document.getElementById('uploadJson').value='';
      setTimeout(()=>{document.getElementById('uploadPanel').classList.remove('open');load();},1600);
    }else{
      el.className='upload-msg err';el.textContent='Error: '+(data.error||r.status);
    }
  }catch(e){el.className='upload-msg err';el.textContent='Network error: '+e.message;}
  finally{document.getElementById('uploadBtn').disabled=false;}
});

function busy(on){
  document.getElementById('spn').style.display=on?'inline-block':'none';
  document.getElementById('syncBtn').disabled=on;
}
let toastTimer;
function toast(msg,err){
  const el=document.getElementById('toast');
  el.textContent=msg;el.className='show '+(err?'err':'ok');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='',2800);
}

load();
})();
</script>
</body>
</html>`;
}

export const buildExportJsonPage = buildGetMyMailPage;
