export function buildGetMyMailPage(baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GetMyMail</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
a{color:inherit;text-decoration:none}
header{background:#1e293b;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #334155;gap:12px;flex-wrap:wrap}
.h-title{font-size:1.1rem;font-weight:700;color:#f8fafc}
.h-sub{font-size:.75rem;color:#64748b;margin-top:2px}
.h-actions{display:flex;gap:8px;align-items:center;flex-shrink:0;flex-wrap:wrap}
.btn{border:none;padding:9px 16px;border-radius:7px;font-size:.83rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:filter .15s;white-space:nowrap}
.btn:hover:not(:disabled){filter:brightness(1.15)}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn-blue{background:#2563eb;color:#fff}
.btn-green{background:#16a34a;color:#fff}
.btn-amber{background:#d97706;color:#fff}
.btn-sm{padding:6px 12px;font-size:.78rem}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
.dot-green{background:#22c55e;box-shadow:0 0 6px #22c55e}
.dot-grey{background:#475569}
.dot-orange{background:#f97316;box-shadow:0 0 6px #f97316}
.spin{display:inline-block;width:12px;height:12px;border:2px solid transparent;border-top-color:currentColor;border-radius:50%;animation:sp .7s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
main{max-width:1200px;margin:0 auto;padding:20px;display:grid;grid-template-columns:1fr 350px;gap:18px}
@media(max-width:800px){main{grid-template-columns:1fr}}
.stats{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.stat{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:14px 18px}
.stat-lbl{font-size:.7rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.stat-val{font-size:1.9rem;font-weight:800;color:#f1f5f9;line-height:1.1;margin-top:3px}
.stat-sub{font-size:.7rem;color:#475569;margin-top:2px}
.card{background:#1e293b;border:1px solid #334155;border-radius:11px;overflow:hidden;margin-bottom:16px}
.card:last-child{margin-bottom:0}
.card-hdr{padding:13px 16px;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between}
.card-title{font-size:.85rem;font-weight:700;color:#f1f5f9}
.badge{background:#334155;color:#94a3b8;font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:20px}
.badge-blue{background:#1e3a5f;color:#60a5fa}
.sec-lbl{font-size:.68rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.07em;padding:6px 16px;background:#162032;border-bottom:1px solid #1e293b}
.e-row{padding:11px 16px;border-bottom:1px solid #1e293b;display:flex;gap:10px;align-items:flex-start;transition:background .15s;cursor:pointer}
.e-row:last-child{border-bottom:none}
.e-row:hover{background:#243447}
.avatar{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:700;flex-shrink:0;color:#fff}
.u-dot{width:6px;height:6px;border-radius:50%;background:#3b82f6;flex-shrink:0;margin-top:6px}
.u-dot-empty{width:6px;flex-shrink:0}
.e-body{flex:1;min-width:0}
.e-from{font-size:.78rem;font-weight:600;color:#cbd5e1;display:flex;justify-content:space-between}
.e-time{font-size:.7rem;color:#475569;font-weight:400}
.e-subj{font-size:.84rem;color:#f1f5f9;font-weight:500;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.e-prev{font-size:.73rem;color:#64748b;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ev-row{padding:11px 16px;border-bottom:1px solid #1e293b;display:flex;gap:10px;align-items:flex-start}
.ev-row:last-child{border-bottom:none}
.time-blk{background:#0f172a;border-radius:7px;padding:5px 8px;text-align:center;min-width:46px;flex-shrink:0}
.time-h{font-size:.9rem;font-weight:700;color:#60a5fa;line-height:1}
.time-m{font-size:.65rem;color:#475569}
.ev-body{flex:1;min-width:0}
.ev-title{font-size:.84rem;font-weight:600;color:#f1f5f9}
.ev-meta{font-size:.72rem;color:#64748b;margin-top:2px}
.ev-tag{display:inline-block;font-size:.65rem;font-weight:600;padding:1px 5px;border-radius:4px;margin-top:3px}
.tag-today{background:#1e3a5f;color:#60a5fa}
.tag-up{background:#1c2d1e;color:#4ade80}
.a-row{padding:10px 16px;border-bottom:1px solid #1e293b;display:flex;gap:10px;align-items:flex-start}
.a-row:last-child{border-bottom:none}
.a-pri{font-size:.65rem;font-weight:700;padding:2px 6px;border-radius:4px;flex-shrink:0;margin-top:2px}
.pri-high{background:#7f1d1d;color:#fca5a5}
.pri-medium{background:#1c2d1e;color:#6ee7b7}
.pri-low{background:#1e293b;color:#94a3b8}
.a-body{flex:1;min-width:0}
.a-title{font-size:.84rem;font-weight:600;color:#f1f5f9}
.a-next{font-size:.73rem;color:#64748b;margin-top:2px}
.a-proj{font-size:.68rem;color:#475569;margin-top:2px}
.empty{padding:24px 16px;text-align:center;color:#475569;font-size:.82rem}
/* Upload panel */
#uploadPanel{grid-column:1/-1;display:none}
#uploadPanel.open{display:block}
.upload-card{background:#1e293b;border:1px solid #d97706;border-radius:11px;padding:20px;margin-top:0}
.upload-card h3{font-size:.9rem;font-weight:700;color:#fcd34d;margin-bottom:10px}
.upload-card p{font-size:.78rem;color:#94a3b8;margin-bottom:12px}
textarea{width:100%;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:10px;font-family:"Courier New",monospace;font-size:.75rem;resize:vertical;min-height:160px;outline:none}
textarea:focus{border-color:#d97706}
.upload-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center}
.upload-result{font-size:.8rem;margin-top:8px;padding:8px 12px;border-radius:6px}
.upload-result.ok{background:#1c2d1e;color:#4ade80;border:1px solid #22c55e}
.upload-result.err{background:#2d1f1f;color:#f87171;border:1px solid #ef4444}
#toast{position:fixed;bottom:20px;right:20px;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 15px;font-size:.8rem;color:#e2e8f0;transform:translateY(60px);opacity:0;transition:all .25s;z-index:99}
#toast.show{transform:translateY(0);opacity:1}
#toast.ok{border-color:#22c55e}
#toast.err{border-color:#ef4444}
</style>
</head>
<body>
<header>
  <div>
    <div class="h-title">GetMyMail</div>
    <div class="h-sub" id="hSub">Loading...</div>
  </div>
  <div class="h-actions">
    <span id="hDot"><span class="dot dot-grey"></span></span>
    <button id="syncBtn" class="btn btn-blue" disabled>
      <span class="spin" id="spn" style="display:none"></span>
      Sync
    </button>
    <button id="copyBtn" class="btn btn-green" disabled>Copy JSON</button>
    <button id="uploadToggle" class="btn btn-amber">Upload from ChatGPT</button>
  </div>
</header>

<main>
  <div class="stats">
    <div class="stat"><div class="stat-lbl">Unread</div><div class="stat-val" id="sUnread">-</div><div class="stat-sub">emails</div></div>
    <div class="stat"><div class="stat-lbl">Today</div><div class="stat-val" id="sToday">-</div><div class="stat-sub">calendar events</div></div>
    <div class="stat"><div class="stat-lbl">Upcoming</div><div class="stat-val" id="sUp">-</div><div class="stat-sub">next 7 days</div></div>
  </div>

  <!-- Upload panel (hidden by default) -->
  <div id="uploadPanel">
    <div class="upload-card">
      <h3>Upload Updated Action List from ChatGPT</h3>
      <p>Paste the full JSON from ChatGPT below. This replaces your current action list in D1.</p>
      <textarea id="uploadJson" placeholder='{ "actions": [ ... ] }'></textarea>
      <div class="upload-actions">
        <button id="uploadBtn" class="btn btn-amber">Upload & Save</button>
        <button id="uploadCancel" class="btn btn-sm" style="background:#334155;color:#94a3b8">Cancel</button>
        <span id="uploadResult"></span>
      </div>
    </div>
  </div>

  <!-- Email column -->
  <div>
    <div class="card">
      <div class="card-hdr">
        <span class="card-title">Important &amp; Unread <span class="badge badge-blue" id="cImp">0</span></span>
      </div>
      <div id="impList"><div class="empty">Loading...</div></div>
    </div>
    <div class="card">
      <div class="card-hdr">
        <span class="card-title">Newsletters &amp; Marketing <span class="badge" id="cMkt">0</span></span>
      </div>
      <div id="mktList"><div class="empty">Loading...</div></div>
    </div>
    <div class="card">
      <div class="card-hdr">
        <span class="card-title">Action List <span class="badge" id="cActions">0</span></span>
      </div>
      <div id="actionList"><div class="empty">Loading...</div></div>
    </div>
  </div>

  <!-- Right column: Calendar -->
  <div>
    <div class="card">
      <div class="card-hdr"><span class="card-title">Calendar</span></div>
      <div id="calList"><div class="empty">Loading...</div></div>
    </div>
  </div>
</main>

<div id="toast"></div>

<script>
(function(){
const BASE = '${baseUrl}';
const TOKEN = '716180e24c87de8b699efd32198adbd9';
let lastData = null;

const COLS=['#6366f1','#ec4899','#14b8a6','#f59e0b','#8b5cf6','#06b6d4','#10b981','#ef4444'];
function aCol(s){let h=0;for(let i=0;i<s.length;i++)h=s.charCodeAt(i)+((h<<5)-h);return COLS[Math.abs(h)%COLS.length]}
function aInit(n){if(!n)return'?';const p=n.split(' ').filter(Boolean);return p.length>=2?(p[0][0]+p[p.length-1][0]).toUpperCase():n.slice(0,2).toUpperCase()}
function ago(iso){const d=Date.now()-new Date(iso).getTime(),m=Math.floor(d/60000),h=Math.floor(m/60),dy=Math.floor(h/24);return m<60?m+'m':h<24?h+'h':dy+'d'}
function sast(iso){const d=new Date(new Date(iso).getTime()+2*3600000);return d.getUTCHours().toString().padStart(2,'0')+':'+d.getUTCMinutes().toString().padStart(2,'0')}
function dFmt(iso){return new Date(iso).toLocaleDateString('en-ZA',{weekday:'short',month:'short',day:'numeric',timeZone:'Africa/Johannesburg'})}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function emailHtml(m){
  const name=m.sender_name||m.sender_email||'?';
  return '<a href="'+esc(m.web_link||'#')+'" target="_blank"><div class="e-row">'+(m.is_read?'<div class="u-dot-empty"></div>':'<div class="u-dot"></div>')+'<div class="avatar" style="background:'+aCol(name)+'">'+esc(aInit(name))+'</div><div class="e-body"><div class="e-from"><span>'+esc(name)+'</span><span class="e-time">'+ago(m.received_at)+'</span></div><div class="e-subj">'+esc(m.subject||'(no subject)')+'</div><div class="e-prev">'+esc((m.body_preview||'').slice(0,110))+'</div></div></div></a>'
}

function eventHtml(e,today){
  const t=sast(e.start_at),parts=t.split(':');
  return '<div class="ev-row"><div class="time-blk"><div class="time-h">'+parts[0]+':'+parts[1]+'</div><div class="time-m">SAST</div></div><div class="ev-body"><div class="ev-title">'+esc(e.subject||'(no title)')+'</div><div class="ev-meta">'+(e.location?esc(e.location)+' - ':'')+( today?'Today':esc(dFmt(e.start_at)))+'</div><span class="ev-tag '+(today?'tag-today':'tag-up')+'">'+(today?'Today':'Upcoming')+'</span></div></div>'
}

function actionHtml(a){
  const priClass=a.priority==='high'?'pri-high':a.priority==='medium'?'pri-medium':'pri-low';
  return '<div class="a-row"><span class="a-pri '+priClass+'">'+esc(a.priority)+'</span><div class="a-body"><div class="a-title">'+esc(a.title)+'</div>'+(a.next_action?'<div class="a-next">'+esc(a.next_action)+'</div>':'')+'<div class="a-proj">'+esc(a.project||'')+(a.recurrence?' | '+esc(a.recurrence):'')+'</div></div></div>'
}

async function load(){
  busy(true);
  try{
    const r=await fetch(BASE+'/brief',{headers:{Authorization:'Bearer '+TOKEN}});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const d=await r.json();
    lastData=d;

    document.getElementById('sUnread').textContent=d.emails.unread_count??0;
    document.getElementById('sToday').textContent=d.calendar.today_events.length;
    document.getElementById('sUp').textContent=d.calendar.upcoming_events.length;
    document.getElementById('hDot').innerHTML='<span class="dot '+(d.status==='complete'?'dot-green':'dot-orange')+'"></span>';
    document.getElementById('hSub').textContent=new Date().toLocaleString('en-ZA',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Johannesburg'});

    const imp=d.emails.important_messages||[];
    document.getElementById('cImp').textContent=imp.length;
    document.getElementById('impList').innerHTML=imp.length?imp.map(emailHtml).join(''):'<div class="empty">No important emails</div>';

    const mkt=d.emails.marketing_messages||[];
    document.getElementById('cMkt').textContent=mkt.length;
    document.getElementById('mktList').innerHTML=mkt.length?mkt.map(emailHtml).join(''):'<div class="empty">No newsletters today</div>';

    const te=d.calendar.today_events||[],ue=d.calendar.upcoming_events||[];
    let cal='';
    if(te.length) cal+='<div class="sec-lbl">Today</div>'+te.map(e=>eventHtml(e,true)).join('');
    if(ue.length) cal+='<div class="sec-lbl">Coming up</div>'+ue.map(e=>eventHtml(e,false)).join('');
    document.getElementById('calList').innerHTML=cal||'<div class="empty">No upcoming events</div>';

    const acts=(d.action_list&&d.action_list.actions)||[];
    const openActs=acts.filter(a=>a.status==='open');
    document.getElementById('cActions').textContent=openActs.length;
    document.getElementById('actionList').innerHTML=openActs.length?openActs.map(actionHtml).join(''):'<div class="empty">No open actions</div>';

    document.getElementById('copyBtn').disabled=false;
    toast('Loaded',false);
  }catch(e){toast('Error: '+e.message,true)}
  finally{busy(false)}
}

async function syncAndLoad(){
  busy(true);toast('Syncing...',false);
  try{
    await fetch(BASE+'/sync',{method:'POST',headers:{Authorization:'Bearer '+TOKEN}});
    await load();
  }catch(e){toast('Sync failed: '+e.message,true);busy(false)}
}

document.getElementById('syncBtn').addEventListener('click', syncAndLoad);

document.getElementById('copyBtn').addEventListener('click', async ()=>{
  if(!lastData) return;
  try{
    await navigator.clipboard.writeText(JSON.stringify(lastData,null,2));
    toast('Copied to clipboard!',false);
  }catch(e){toast('Copy failed: '+e.message,true)}
});

// Upload panel toggle
document.getElementById('uploadToggle').addEventListener('click',()=>{
  const panel=document.getElementById('uploadPanel');
  panel.classList.toggle('open');
  if(panel.classList.contains('open')) panel.scrollIntoView({behavior:'smooth'});
});
document.getElementById('uploadCancel').addEventListener('click',()=>{
  document.getElementById('uploadPanel').classList.remove('open');
  document.getElementById('uploadJson').value='';
  document.getElementById('uploadResult').textContent='';
});

document.getElementById('uploadBtn').addEventListener('click', async ()=>{
  const raw=document.getElementById('uploadJson').value.trim();
  const resultEl=document.getElementById('uploadResult');
  resultEl.className='';resultEl.textContent='';
  if(!raw){resultEl.className='upload-result err';resultEl.textContent='Paste JSON first.';return;}
  let payload;
  try{payload=JSON.parse(raw);}catch(e){resultEl.className='upload-result err';resultEl.textContent='Invalid JSON: '+e.message;return;}
  try{
    document.getElementById('uploadBtn').disabled=true;
    const r=await fetch(BASE+'/actions/import',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+TOKEN},
      body:JSON.stringify(payload)
    });
    const data=await r.json();
    if(r.ok){
      resultEl.className='upload-result ok';
      resultEl.textContent=data.message||'Imported successfully';
      document.getElementById('uploadJson').value='';
      setTimeout(()=>{
        document.getElementById('uploadPanel').classList.remove('open');
        load();
      },1500);
    }else{
      resultEl.className='upload-result err';
      resultEl.textContent='Error: '+(data.error||r.status);
    }
  }catch(e){
    resultEl.className='upload-result err';
    resultEl.textContent='Network error: '+e.message;
  }finally{
    document.getElementById('uploadBtn').disabled=false;
  }
});

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