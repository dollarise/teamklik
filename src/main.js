import "./style.css";
import { supabase } from "./supabase.js";

const app = document.querySelector("#app");
const state = { user:null, profile:null, members:[], selectedIndex:0, unlockLocked:false, remaining:0 };
const SELECTED_MEMBER_KEY = "teamklik_selected_member_id";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1E2QjwSCs1Gdc_3m54xVLTbIkR0P74XdLcrg5UoOC1Pg";
const esc = (v="") => String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const toast = message => { const el=document.querySelector("#toast"); if(!el)return; el.textContent=message; el.classList.add("show"); clearTimeout(window.__toast); window.__toast=setTimeout(()=>el.classList.remove("show"),2400); };
const selectedMember = () => state.members[state.selectedIndex] || null;
function saveSelectedMember(){ const m=selectedMember(); if(m?.id)sessionStorage.setItem(SELECTED_MEMBER_KEY,m.id); }
function loginView(message=""){
  app.innerHTML=`<main class="login-shell"><section class="login-card"><div class="mini-logo">◆</div><h1>Welcome Back</h1><p>Login untuk membuka dashboard earnings Anda.</p><form id="loginForm"><label>Email</label><input id="email" type="email" autocomplete="email" placeholder="you@example.com" required><label>Password</label><input id="password" type="password" autocomplete="current-password" placeholder="Password" required><button class="primary" type="submit">LOGIN</button><div class="error">${esc(message)}</div></form><p class="hint">Akun dibuat melalui Supabase Auth.</p></section></main><div id="toast" class="toast"></div>`;
  document.querySelector("#loginForm").onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;button.textContent="SIGNING IN...";const {error}=await supabase.auth.signInWithPassword({email:document.querySelector("#email").value.trim(),password:document.querySelector("#password").value});if(error){loginView(error.message);return;}await loadDashboard();};
}
async function getUnlockStatus(){
  const member=selectedMember(); if(!member||!state.user){state.remaining=0;state.unlockLocked=true;return;}
  const limit=Number(member.unlock_limit||0);
  const {data,error}=await supabase.from("offer_access_logs").select("id").eq("user_id",state.user.id).eq("offer_owner_id",member.id).gte("accessed_at",new Date(Date.now()-60*60*1000).toISOString());
  if(error){state.remaining=0;state.unlockLocked=true;return;}
  state.remaining=Math.max(limit-(data?.length||0),0);state.unlockLocked=state.remaining<=0;
}
function setBanner(){
  const frame=document.querySelector("#bannerFrame");
  const member=selectedMember();
  if(!frame)return;
  const code=(member?.banner_code||"").trim();
  frame.srcdoc=code || `<html><body style="margin:0;font-family:Arial,sans-serif;background:#f4f6f8;display:grid;place-items:center;color:#777"><div>Banner belum tersedia untuk offer ini.</div></body></html>`;
}
function dashboardView(){
  const p=state.profile; const user=state.user; const member=selectedMember()||{id:p.id,name:p.name,banner_code:null,unlock_limit:p.unlock_limit};
  const profileName=String(p?.name||"").trim();
  const emailLocal=String(user?.email||"").split("@")[0].trim();
  const displayName=profileName && profileName.toLowerCase()!==emailLocal.toLowerCase() ? profileName : "User";
  const displayMemberName=member.id===p?.id ? displayName : String(member.name||"Member").trim() || "Member";
  const unlockClass=state.unlockLocked?"unlock locked":"unlock";
  const unlockText=state.unlockLocked?"ACCESS TEMPORARILY LOCKED":"🔒 UNLOCK EXCLUSIVE ACCESS";
  app.innerHTML=`<main class="page"><section class="hero"><h1>BOOST YOUR ONLINE EARNINGS</h1><p>Discover Exclusive Opportunities Used By Smart Digital Marketers Worldwide</p></section>
  <section class="card profile"><div class="eyebrow">USER NAME</div><h2>${esc(displayName)}</h2></section>
  <section class="card campaign"><div class="eyebrow">ACTIVE OFFER</div><div class="banner-wrap"><iframe id="bannerFrame" title="Active offer banner" loading="lazy" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"></iframe></div></section>
  <div class="offer-member"><h2>${esc(displayMemberName)}</h2></div>
  <button id="unlockBtn" class="${unlockClass}" ${state.unlockLocked?"disabled":""}>${unlockText}</button>
  <div class="actions"><button id="anotherBtn">← SEE ANOTHER OFFER</button><button id="moreBtn">🔥 SHOW ME MORE</button></div>
  <div class="bottom-actions"><a id="sheetBtn" class="sheet-link" href="${SHEET_URL}" target="_blank" rel="noopener noreferrer">VIEW INFORMATION</a><button id="logoutBtn" class="logout">LOG OUT</button>${p?.role==="admin"?'<a class="admin-link" href="/admin.html">ADMIN PANEL</a>':""}</div></main><div id="toast" class="toast"></div>`;
  setBanner();
  document.querySelector("#logoutBtn").onclick=async()=>{await supabase.auth.signOut();sessionStorage.removeItem(SELECTED_MEMBER_KEY);state.user=null;state.profile=null;state.members=[];loginView();};
  document.querySelector("#unlockBtn").onclick=unlockSelectedOffer;
  document.querySelector("#anotherBtn").onclick=async()=>{state.selectedIndex=state.selectedIndex>0?state.selectedIndex-1:state.members.length-1;saveSelectedMember();await getUnlockStatus();dashboardView();};
  document.querySelector("#moreBtn").onclick=async()=>{state.selectedIndex=state.selectedIndex<state.members.length-1?state.selectedIndex+1:0;saveSelectedMember();await getUnlockStatus();dashboardView();};
}
async function unlockSelectedOffer(){
  if(state.unlockLocked)return toast("ACCESS TEMPORARILY LOCKED");
  const member=selectedMember();if(!member)return toast("Member offer tidak tersedia.");saveSelectedMember();
  const {data,error}=await supabase.rpc("unlock_offer",{p_offer_owner_id:member.id});
  if(error)return toast(error.message);
  if(!data?.allowed){if(data?.reason==="limit"){state.unlockLocked=true;state.remaining=0;dashboardView();toast("ACCESS TEMPORARILY LOCKED");}else if(data?.reason==="ip_limit")toast("IP telah gunakan member lain silahkan tunggu 1 X 24 Jam");else if(data?.reason==="no_offer")toast("Offer belum tersedia untuk member ini.");else toast(data?.message||"Offer tidak tersedia.");return;}
  state.remaining=Number(data.remaining||0);if(state.remaining<=0)state.unlockLocked=true;if(data.url)window.open(data.url,"_blank","noopener,noreferrer");if(state.unlockLocked)dashboardView();
}
async function loadDashboard(){
  const {data:{user},error:sessionError}=await supabase.auth.getUser();if(sessionError||!user){loginView();return;}state.user=user;
  const {data:profile,error}=await supabase.from("profiles").select("*").eq("id",user.id).single();if(error){loginView(`Profile error: ${error.message}`);return;}state.profile=profile;
  const {data:members,error:membersError}=await supabase.rpc("get_member_offers");if(membersError){loginView(`Member data error: ${membersError.message}`);return;}state.members=members||[];
  const savedMemberId=sessionStorage.getItem(SELECTED_MEMBER_KEY);const savedIndex=savedMemberId?state.members.findIndex(m=>m.id===savedMemberId):-1;
  if(savedIndex>=0)state.selectedIndex=savedIndex;else{const ownIndex=state.members.findIndex(m=>m.id===user.id);state.selectedIndex=ownIndex>=0?ownIndex:0;saveSelectedMember();}
  await getUnlockStatus();dashboardView();
}
supabase.auth.onAuthStateChange((_event,session)=>{if(session?.user)loadDashboard();else loginView();});
loadDashboard();
