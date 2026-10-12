export function buildGetMyMailPage(baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Morning Brief</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0f172a;--surface:#1e293b;--surface2:#162032;--border:#334155;
  --text:#e2e8f0;--text2:#94a3b8;--text3:#64748b;--text4:#475569;
  --blue:#3b82f6;--blue-dim:#1e3a5f;--green:#22c55e;--green-dim:#1c2d1e;
  --amber:#f59e0b;--amber-dim:#422006;--red:#ef4444;--red-dim:#450a0a;
  --purple:#8b5cf6;--teal:#14b8a6;
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;font-size:15px}
a{color:inherit;text-decoration:none}
button{font-family:inherit}

/* ── Header ── */
header{background:var(--surface);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);gap:10px;flex-wrap:wrap;position:sticky;top:0;z-index:50}
.h-brand{display:flex;align-items:center;gap:10px}
.h-icon{width:32px;height:32px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0}
.h-title{font-size:1rem;font-weight:700;color:#f8fafc;line-height:1}
.h-sub{font-size:.72rem;color:var(--text3);margin-top:2px}
.h-btns{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.btn{border:none;padding:8px 14px;border-radius:8px;font-size:.8rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:filter .15s,opacity .15s;white-space:nowrap;line-height:1}
.btn:hover:not(:disabled){filter:brightness(1.12)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-blue{background:#2563eb;color:#fff}
.btn-green{background:#16a34a;color:#fff}
.btn-amber{background:#d97706;color:#fff}
.btn-ghost{background:var(--border);color:var(--text2)}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
.dot-green{background:var(--green);box-shadow:0 0 6px var(--green)}
.dot-grey{background:var(--text4)}
.dot-orange{background:#f97316;box-shadow:0 0 6px #f97316}
.spin{display:inline-block;width:11px;height:11px;border:2px solid transparent;border-top-color:currentColor;border-radius:50%;animation:sp .7s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}

/* ── Layout ── */
main{max-width:1280px;margin:0 auto;padding:16px}

/* ── Financial bar ── */
.fin-bar{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.fin-chip{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 16px;display:flex;flex-direction:column;gap:2px;min-width:140px;flex:1}
.fin-lbl{font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3)}
.fin-val{font-size:1.1rem;font-weight:800;color:#f1f5f9;line-height:1.2}
.fin-sub{font-size:.68rem;color:var(--text4)}

/* ── Stats row ── */
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 16px}
.stat-lbl{font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3)}
.stat-val{font-size:1.6rem;font-weight:800;color:#f1f5f9;line-height:1.1;margin-top:2px}
.stat-sub{font-size:.68rem;color:var(--text4);margin-top:1px}

/* ── Section title ── */
.section-title{font-size:.78rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px;display:flex;align-items:center;gap:8px}
.section-title::after{content:'';flex:1;height:1px;background:var(--border)}

/* ── Action list ── */
#actionsSection{margin-bottom:20px}
.proj-group{margin-bottom:12px}
.proj-header{display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:10px 10px 0 0;border-bottom:none}
.proj-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.proj-name{font-size:.78rem;font-weight:700;color:var(--text2);flex:1}
.proj-count{font-size:.68rem;color:var(--text4);background:var(--border);padding:1px 7px;border-radius:20px}
.action-card{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--border);padding:13px 16px;border-bottom:1px solid var(--surface2);transition:background .15s}
.action-card:last-child{border-radius:0 0 10px 10px;border-bottom:1px solid var(--border)}
.proj-group .action-card:first-of-type:last-of-type{border-radius:0 0 10px 10px}
.action-card:hover{background:#1a2a3e}
.action-card.pri-high{border-left-color:#ef4444}
.action-card.pri-medium{border-left-color:#22c55e}
.action-card.pri-low{border-left-color:#475569}
.ac-top{display:flex;align-items:flex-start;gap:10px}
.ac-title{font-size:.88rem;font-weight:600;color:#f1f5f9;flex:1;line-height:1.3}
.ac-badges{display:flex;gap:5px;flex-shrink:0;align-items:flex-start;flex-wrap:wrap;justify-content:flex-end}
.badge{font-size:.63rem;font-weight:700;padding:2px 7px;border-radius:20px;white-space:nowrap}
.badge-high{background:var(--red-dim);color:#fca5a5}
.badge-medium{background:var(--green-dim);color:#6ee7b7}
.badge-low{background:var(--border);color:var(--text2)}
.badge-due{background:#422006;color:#fcd34d}
.badge-overdue{background:var(--red-dim);color:#fca5a5}
.badge-rec{background:#1e1b4b;color:#a5b4fc}
.ac-next{font-size:.76rem;color:var(--text3);margin-top:6px;line-height:1.4;padding-left:0}
.ac-next::before{content:'→ ';color:var(--blue);font-weight:700}
.ac-meta{display:flex;gap:10px;margin-top:6px;flex-wrap:wrap}
.ac-meta-item{font-size:.68rem;color:var(--text4)}

/* ── Two-col below actions ── */
.below-grid{display:grid;grid-template-columns:1fr 340px;gap:16px}
@media(max-width:860px){.below-grid{grid-template-columns:1fr}}

/* ── Card ── */
.card{background:var(--surface);border:1px solid var(--border);border-radius:11px;overflow:hidden;margin-bottom:14px}
.card:last-child{margin-bottom:0}
.card-hdr{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.card-title{font-size:.82rem;font-weight:700;color:#f1f5f9}
.count-badge{background:var(--border);color:var(--text2);font-size:.66rem;font-weight:700;padding:2px 7px;border-radius:20px}
.count-badge-blue{background:var(--blue-dim);color:#60a5fa}

/* ── Email rows ── */
.sec-lbl{font-size:.65rem;font-weight:700;color:var(--text4);text-transform:uppercase;letter-spacing:.07em;padding:5px 16px;background:var(--surface2);border-bottom:1px solid var(--border)}
.e-row{padding:10px 16px;border-bottom:1px solid var(--surface2);display:flex;gap:9px;align-items:flex-start;transition:background .15s;cursor:pointer}
.e-row:last-child{border-bottom:none}
.e-row:hover{background:#1a2a3e}
.avatar{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.73rem;font-weight:700;flex-shrink:0;color:#fff}
.u-dot{width:6px;height:6px;border-radius:50%;background:var(--blue);flex-shrink:0;margin-top:5px}
.u-dot-e{width:6px;flex-shrink:0}
.e-body{flex:1;min-width:0}
.e-from{font-size:.75rem;font-weight:600;color:#cbd5e1;display:flex;justify-content:space-between;gap:6px}
.e-time{font-size:.68rem;color:var(--text4);font-weight:400;flex-shrink:0}
.e-subj{font-size:.82rem;color:#f1f5f9;font-weight:500;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.e-prev{font-size:.71rem;color:var(--text3);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ── Calendar rows ── */
.ev-row{padding:10px 16px;border-bottom:1px solid var(--surface2);display:flex;gap:9px;align-items:flex-start}
.ev-row:last-child{border-bottom:none}
.time-blk{background:var(--bg);border-radius:7px;padding:5px 8px;text-align:center;min-width:44px;flex-shrink:0}
.time-h{font-size:.88rem;font-weight:700;color:#60a5fa;line-height:1}
.time-m{font-size:.62rem;color:var(--text4)}
.ev-body{flex:1;min-width:0}
.ev-title{font-size:.82rem;font-weight:600;color:#f1f5f9}
.ev-meta{font-size:.7rem;color:var(--text3);margin-top:2px}
.ev-tag{display:inline-block;font-size:.63rem;font-weight:600;padding:1px 6px;border-radius:4px;margin-top:3px}
.tag-today{background:var(--blue-dim);color:#60a5fa}
.tag-up{background:var(--green-dim);color:#4ade80}

/* ── Upload panel ── */
#uploadPanel{display:none;margin-bottom:16px}
#uploadPanel.open{display:block}
.upload-card{background:var(--surface);border:1px solid #d97706;border-radius:11px;padding:18px}
.upload-card h3{font-size:.88rem;font-weight:700;color:#fcd34d;margin-bottom:8px}
.upload-card p{font-size:.76rem;color:var(--text2);margin-bottom:12px}
textarea{width:100%;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:7px;padding:10px;font-family:"Courier New",monospace;font-size:.73rem;resize:vertical;min-height:150px;outline:none}
textarea:focus{border-color:#d97706}
.upload-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center}
.upload-result{font-size:.78rem;margin-top:8px;padding:8px 12px;border-radius:7px}
.upload-result.ok{background:var(--green-dim);color:#4ade80;border:1px solid var(--green)}
.upload-result.err{background:var(--red-dim);color:#f87171;border:1px solid var(--red)}

/* ── Empty ── */
.empty{padding:22px 16px;text-align:center;color:var(--text4);font-size:.8rem}

/* ── Toast ── */
#toast{position:fixed;bottom:20px;right:20px;background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:10px 16px;font-size:.78rem;color:var(--text);transform:translateY(60px);opacity:0;transition:all .25s;z-index:99;max-width:280px}
#toast.show{transform:translateY(0);opacity:1}
#toast.ok{border-color:var(--green)}
#toast.err{border-color:var(--red)}

/* ── Mobile tweaks ── */
@media(max-width:600px){
  header{padding:11px 14px}
  .h-btns{gap:5px}
  .btn{padding:7px 11px;font-size:.76rem}
  main{padding:12px}
  .fin-bar{gap:7px}
  .fin-chip{min-width:100px;padding:9px 12px}
  .stats{grid-template-columns:repeat(3,1fr);gap:7px}
  .stat{padding:10px 12px}
  .stat-val{font-size:1.3rem}
  .action-card{padding:11px 13px}
  #toast{right:12px;bottom:12px;left:12px;max-width:none}
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
    <span id="hDot"><span class="dot dot-grey"></span></span>
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
      <h3>Upload Updated JSON from Gemini</h3>
      <p>Paste the full Master JSON from Gemini. This replaces the stored action list.</p>
      <textarea id="uploadJson" placeholder='Paste JSON here…'></textarea>
      <div class="upload-actions">
        <button id="uploadBtn" class="btn btn-amber">Upload &amp; Save</button>
        <button id="uploadCancel" class="btn btn-ghost">Cancel</button>
        <span id="uploadResult"></span>
      </div>
    </div>
  </div>

  <!-- Financial state bar -->
  <div class="fin-bar" id="finBar" style="display:none"></div>

  <!-- Stats -->
  <div class="stats">
    <div class="stat">
      <div class="stat-lbl">Open Actions</div>
      <div class="stat-val" id="sActions">-</div>
      <div class="stat-sub" id="sActSub">loading</div>
    </div>
    <div class="stat">
      <div class="stat-lbl">Unread</div>
      <div class="stat-val" id="sUnread">-</div>
      <div class="stat-sub">emails</div>
    </div>
    <div class="stat">
      <div class="stat-lbl">Calendar</div>
      <div class="stat-val" id="sCal">-</div>
      <div class="stat-sub">events today</div>
    </div>
  </div>

  <!-- Action List -->
  <section id="actionsSection">
    <div class="section-title">Action List</div>
    <div id="actionGroups"><div class="empty" style="background:var(--surface);border:1px solid var(--border);border-radius:11px">Loading…</div></div>
  </section>

  <!-- Email + Calendar -->
  <div class="below-grid">
    <div>
      <div class="section-title">Email</div>
      <div class="card">
        <div class="card-hdr">
          <span class="card-title">Important &amp; Unread</span>
          <span class="count-badge count-badge-blue" id="cImp">0</span>
        </div>
        <div id="impList"><div class="empty">Loading…</div></div>
      </div>
      <div class="card">
        <div class="card-hdr">
          <span class="card-title">Newsletters &amp; Marketing</span>
          <span class="count-badge" id="cMkt">0</span>
        </div>
        <div id="mktList"><div class="empty">Loading…</div></div>
      </div>
    </div>
    <div>
      <div class="section-title">Calendar</div>
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

// ── Colour helpers ──────────────────────────────────────────────────────
const PAL=['#6366f1','#ec4899','#14b8a6','#f59e0b','#8b5cf6','#06b6d4','#10b981','#ef4444','#0ea5e9','#a855f7'];
const PROJ_COLS=['#3b82f6','#22c55e','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#ef4444','#0ea5e9'];
function strCol(s,palette){let h=0;for(let i=0;i<s.length;i++)h=s.charCodeAt(i)+((h<<5)-h);return palette[Math.abs(h)%palette.length]}
function initials(n){if(!n)return'?';const p=n.split(' ').filter(Boolean);return p.length>=2?(p[0][0]+p[p.length-1][0]).toUpperCase():n.slice(0,2).toUpperCase()}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function ago(iso){const d=Date.now()-new Date(iso).getTime(),m=Math.floor(d/60000),h=Math.floor(m/60),dy=Math.floor(h/24);return m<2?'now':m<60?m+'m':h<24?h+'h':dy+'d'}
function sast(iso){const d=new Date(new Date(iso).getTime()+2*3600000);return d.getUTCHours().toString().padStart(2,'0')+':'+d.getUTCMinutes().toString().padStart(2,'0')}
function dFmt(iso){return new Date(iso).toLocaleDateString('en-ZA',{weekday:'short',month:'short',day:'numeric',timeZone:'Africa/Johannesburg'})}
function dueDays(iso){if(!iso)return null;const d=Math.ceil((new Date(iso)-new Date())/(86400000));return d}

// ── Action list rendering ───────────────────────────────────────────────
function renderActions(acts){
  const open=acts.filter(a=>a.status==='open');
  document.getElementById('sActions').textContent=open.length;

  const high=open.filter(a=>a.priority==='high').length;
  document.getElementById('sActSub').textContent=high>0?high+' high priority':'all on track';

  if(!open.length){
    document.getElementById('actionGroups').innerHTML='<div class="empty" style="background:var(--surface);border:1px solid var(--border);border-radius:11px">No open actions</div>';
    return;
  }

  // Group by project
  const groups={};
  const ORDER=['high','medium','low'];
  const sorted=[...open].sort((a,b)=>ORDER.indexOf(a.priority)-ORDER.indexOf(b.priority));

  for(const a of sorted){
    const proj=a.project||'General';
    if(!groups[proj])groups[proj]=[];
    groups[proj].push(a);
  }

  let html='';
  for(const [proj,items] of Object.entries(groups)){
    const col=strCol(proj,PROJ_COLS);
    html+='<div class="proj-group">';
    html+='<div class="proj-header">';
    html+='<div class="proj-dot" style="background:'+col+'"></div>';
    html+='<span class="proj-name">'+esc(proj)+'</span>';
    html+='<span class="proj-count">'+items.length+'</span>';
    html+='</div>';
    for(const a of items){
      const priClass='action-card pri-'+a.priority;
      const dd=dueDays(a.due_date);
      let dueBadge='';
      if(dd!==null){
        if(dd<0) dueBadge='<span class="badge badge-overdue">Overdue '+Math.abs(dd)+'d</span>';
        else if(dd===0) dueBadge='<span class="badge badge-overdue">Due today</span>';
        else if(dd<=7) dueBadge='<span class="badge badge-due">Due in '+dd+'d</span>';
        else dueBadge='<span class="badge badge-due">'+new Date(a.due_date).toLocaleDateString('en-ZA',{day:'numeric',month:'short'})+'</span>';
      }
      const priBadge='<span class="badge badge-'+a.priority+'">'+a.priority+'</span>';
      const recBadge=a.recurrence?'<span class="badge badge-rec">↻</span>':'';
      html+='<div class="'+priClass+'">';
      html+='<div class="ac-top">';
      html+='<div class="ac-title">'+esc(a.title)+'</div>';
      html+='<div class="ac-badges">'+priBadge+dueBadge+recBadge+'</div>';
      html+='</div>';
      if(a.next_action) html+='<div class="ac-next">'+esc(a.next_action)+'</div>';
      html+='<div class="ac-meta">';
      if(a.recurrence) html+='<span class="ac-meta-item">↻ '+esc(a.recurrence)+'</span>';
      if(a.migration_key) html+='<span class="ac-meta-item" style="color:#334155">'+esc(a.migration_key)+'</span>';
      html+='</div>';
      html+='</div>';
    }
    html+='</div>';
  }
  document.getElementById('actionGroups').innerHTML=html;
}

// ── Financial bar ───────────────────────────────────────────────────────
function renderFinancial(fin){
  if(!fin||!Object.keys(fin).length)return;
  const bar=document.getElementById('finBar');
  bar.style.display='flex';
  const labels={
    admyt_balance:'Admyt',sanral_balance:'SANRAL',
    city_of_cape_town_mooiverwacht:'CCT Mooiverwacht',
    osro:'OSRO',vashti_tenant_invoice:'Vashti Invoice'
  };
  let html='';
  for(const [k,v] of Object.entries(fin)){
    const lbl=labels[k]||k.replace(/_/g,' ').replace(/\\b\\w/g,c=>c.toUpperCase());
    const isBalance=k.includes('balance');
    html+='<div class="fin-chip">';
    html+='<div class="fin-lbl">'+esc(lbl)+'</div>';
    html+='<div class="fin-val" style="color:'+(isBalance?'#4ade80':'#e2e8f0')+'">'+esc(String(v))+'</div>';
    html+='</div>';
  }
  bar.innerHTML=html;
}

// ── Email rendering ─────────────────────────────────────────────────────
function emailHtml(m){
  const name=m.sender_name||m.sender_email||'?';
  const col=strCol(name,PAL);
  return '<a href="'+esc(m.web_link||'#')+'" target="_blank" rel="noopener">'
    +'<div class="e-row">'
    +(m.is_read?'<div class="u-dot-e"></div>':'<div class="u-dot"></div>')
    +'<div class="avatar" style="background:'+col+'">'+esc(initials(name))+'</div>'
    +'<div class="e-body">'
    +'<div class="e-from"><span>'+esc(name)+'</span><span class="e-time">'+ago(m.received_at)+'</span></div>'
    +'<div class="e-subj">'+esc(m.subject||'(no subject)')+'</div>'
    +'<div class="e-prev">'+esc((m.body_preview||'').slice(0,100))+'</div>'
    +'</div></div></a>';
}

// ── Calendar rendering ──────────────────────────────────────────────────
function eventHtml(e,today){
  const t=sast(e.start_at);
  return '<div class="ev-row">'
    +'<div class="time-blk"><div class="time-h">'+t+'</div><div class="time-m">SAST</div></div>'
    +'<div class="ev-body">'
    +'<div class="ev-title">'+esc(e.subject||'(no title)')+'</div>'
    +'<div class="ev-meta">'+(e.location?esc(e.location)+' · ':'')+( today?'Today':esc(dFmt(e.start_at)))+'</div>'
    +'<span class="ev-tag '+(today?'tag-today':'tag-up')+'">'+(today?'Today':'Upcoming')+'</span>'
    +'</div></div>';
}

// ── Main load ───────────────────────────────────────────────────────────
async function load(){
  busy(true);
  try{
    const r=await fetch(BASE+'/brief',{headers:{Authorization:'Bearer '+TOKEN}});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();
    lastData=d;

    document.getElementById('hDot').innerHTML='<span class="dot '+(d.status==='complete'?'dot-green':'dot-orange')+'"></span>';
    document.getElementById('hSub').textContent=new Date().toLocaleString('en-ZA',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Johannesburg'});
    document.getElementById('sUnread').textContent=d.emails?.unread_count??0;
    document.getElementById('sCal').textContent=(d.calendar?.today_events||[]).length;

    // Financial state
    renderFinancial(d.financial_and_operational_state);

    // Actions
    const acts=(d.action_list&&d.action_list.actions)||[];
    renderActions(acts);

    // Email
    const imp=d.emails?.important_messages||[];
    document.getElementById('cImp').textContent=imp.length;
    document.getElementById('impList').innerHTML=imp.length?imp.map(emailHtml).join(''):'<div class="empty">No important emails</div>';

    const mkt=d.emails?.marketing_messages||[];
    document.getElementById('cMkt').textContent=mkt.length;
    document.getElementById('mktList').innerHTML=mkt.length?mkt.map(emailHtml).join(''):'<div class="empty">No newsletters</div>';

    // Calendar
    const te=d.calendar?.today_events||[],ue=d.calendar?.upcoming_events||[];
    let cal='';
    if(te.length)cal+='<div class="sec-lbl">Today</div>'+te.map(e=>eventHtml(e,true)).join('');
    if(ue.length)cal+='<div class="sec-lbl">Coming up</div>'+ue.map(e=>eventHtml(e,false)).join('');
    document.getElementById('calList').innerHTML=cal||'<div class="empty">No upcoming events</div>';

    document.getElementById('copyBtn').disabled=false;
    toast('Loaded ✓',false);
  }catch(e){toast('Error: '+e.message,true)}
  finally{busy(false)}
}

async function syncAndLoad(){
  busy(true);toast('Syncing…',false);
  try{
    await fetch(BASE+'/sync',{method:'POST',headers:{Authorization:'Bearer '+TOKEN}});
    await load();
  }catch(e){toast('Sync failed: '+e.message,true);busy(false)}
}

// ── Events ──────────────────────────────────────────────────────────────
document.getElementById('syncBtn').addEventListener('click',syncAndLoad);

document.getElementById('copyBtn').addEventListener('click',async()=>{
  if(!lastData)return;
  try{await navigator.clipboard.writeText(JSON.stringify(lastData,null,2));toast('Copied ✓',false);}
  catch(e){toast('Copy failed: '+e.message,true)}
});

document.getElementById('uploadToggle').addEventListener('click',()=>{
  const p=document.getElementById('uploadPanel');
  p.classList.toggle('open');
  if(p.classList.contains('open'))p.scrollIntoView({behavior:'smooth',block:'start'});
});

document.getElementById('uploadCancel').addEventListener('click',()=>{
  document.getElementById('uploadPanel').classList.remove('open');
  document.getElementById('uploadJson').value='';
  document.getElementById('uploadResult').textContent='';
});

document.getElementById('uploadBtn').addEventListener('click',async()=>{
  const raw=document.getElementById('uploadJson').value.trim();
  const el=document.getElementById('uploadResult');
  el.className='';el.textContent='';
  if(!raw){el.className='upload-result err';el.textContent='Paste JSON first.';return;}
  let payload;
  try{payload=JSON.parse(raw);}catch(e){el.className='upload-result err';el.textContent='Invalid JSON: '+e.message;return;}
  try{
    document.getElementById('uploadBtn').disabled=true;
    const r=await fetch(BASE+'/actions/import',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+TOKEN},
      body:JSON.stringify(payload)
    });
    const data=await r.json();
    if(r.ok){
      el.className='upload-result ok';el.textContent=data.message||'Imported successfully';
      document.getElementById('uploadJson').value='';
      setTimeout(()=>{document.getElementById('uploadPanel').classList.remove('open');load();},1500);
    }else{
      el.className='upload-result err';el.textContent='Error: '+(data.error||r.status);
    }
  }catch(e){el.className='upload-result err';el.textContent='Network error: '+e.message;}
  finally{document.getElementById('uploadBtn').disabled=false;}
});

// ── Utilities ────────────────────────────────────────────────────────────
function busy(on){
  document.getElementById('spn').style.display=on?'inline-block':'none';
  document.getElementById('syncBtn').disabled=on;
}
let toastTimer;
function toast(msg,err){
  const el=document.getElementById('toast');
  el.textContent=msg;el.className='show '+(err?'err':'ok');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='',3000);
}

load();
})();
</script>
</body>
</html>`;
}

export const buildExportJsonPage = buildGetMyMailPage;
