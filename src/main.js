import "./style.css";
import { supabase } from "./supabase.js";

const app = document.querySelector("#app");
const state = { user: null, profile: null, members: [], selectedIndex: 0, unlockLocked: false, remaining: 0 };

function money(value) { return `$${Number(value || 0).toFixed(2)}`; }
function number(value) { return Number(value || 0).toLocaleString("en-US"); }
function ctr(profile) { if (!profile?.impressions) return "0.00%"; return `${((Number(profile.clicks || 0) / Number(profile.impressions || 0)) * 100).toFixed(2)}%`; }
function escapeHtml(value = "") { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function toast(message) { const el = document.querySelector("#toast"); if (!el) return; el.textContent = message; el.classList.add("show"); clearTimeout(window.__toast); window.__toast = setTimeout(() => el.classList.remove("show"), 2400); }

function loginView(message = "") {
  app.innerHTML = `<main class="login-shell"><section class="login-card"><div class="mini-logo">◆</div><h1>Welcome Back</h1><p>Login untuk membuka dashboard earnings Anda.</p><form id="loginForm"><label>Email</label><input id="email" type="email" autocomplete="email" placeholder="you@example.com" required><label>Password</label><input id="password" type="password" autocomplete="current-password" placeholder="Password" required><button class="primary" type="submit">LOGIN</button><div class="error">${escapeHtml(message)}</div></form><p class="hint">Akun dibuat melalui Supabase Auth.</p></section></main><div id="toast" class="toast"></div>`;
  document.querySelector("#loginForm").addEventListener("submit", async (event) => { event.preventDefault(); const email = document.querySelector("#email").value.trim(); const password = document.querySelector("#password").value; const button = event.submitter; button.disabled = true; button.textContent = "SIGNING IN..."; const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) { loginView(error.message); return; } await loadDashboard(); });
}

function selectedMember() { return state.members[state.selectedIndex] || null; }

async function getUnlockStatus() {
  const member = selectedMember();
  if (!member || !state.user) { state.remaining = 0; state.unlockLocked = true; return; }
  const limit = Number(member.unlock_limit || 0);
  const { data, error } = await supabase.from("offer_access_logs").select("id").eq("user_id", state.user.id).eq("offer_owner_id", member.id).gte("accessed_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if (error) { state.remaining = 0; state.unlockLocked = true; return; }
  state.remaining = Math.max(limit - (data?.length || 0), 0);
  state.unlockLocked = state.remaining <= 0;
}

function dashboardView() {
  const user = state.user;
  const p = state.profile;
  const member = selectedMember() || { id: p.id, name: p.name, membership: p.membership, campaign_name: p.campaign_name, impressions: p.impressions, clicks: p.clicks, cpm: p.cpm, revenue: p.revenue, unlock_limit: p.unlock_limit };
  const unlockClass = state.unlockLocked ? "unlock locked" : "unlock";
  const unlockText = state.unlockLocked ? "ACCESS TEMPORARILY LOCKED" : "🔒 UNLOCK EXCLUSIVE ACCESS";
  app.innerHTML = `<main class="page">
    <section class="hero"><h1>BOOST YOUR ONLINE EARNINGS</h1><p>Discover Exclusive Opportunities Used By Smart Digital Marketers Worldwide</p></section>
    <section class="card profile"><div><div class="eyebrow">USER NAME</div><h2>${escapeHtml(p?.name || user?.email || "User")}</h2><div class="eyebrow">EMAIL</div><p>${escapeHtml(user?.email || "-")}</p><div class="eyebrow">MEMBER SINCE</div><p>${p?.member_since ? new Date(p.member_since).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "-"}</p></div><div class="profile-status"><div><span>ACCOUNT STATUS</span><strong class="green">${escapeHtml(p?.account_status || "Verified")}</strong></div><div><span>MEMBERSHIP</span><strong>${escapeHtml(p?.membership || "Standard")}</strong></div></div></section>
    <section class="card campaign"><div class="eyebrow">ACTIVE OFFER</div><div class="campaign-name">${escapeHtml(member.name || "Member")}</div></section>
    <button id="unlockBtn" class="${unlockClass}" ${state.unlockLocked ? "disabled" : ""}>${unlockText}</button>
    <div class="actions"><button id="anotherBtn">← SEE ANOTHER OFFER</button><button id="moreBtn">🔥 SHOW ME MORE</button></div>
    <section class="stats"><div class="stat"><span>IMPRESSIONS</span><strong>${number(member.impressions)}</strong></div><div class="stat"><span>CLICKS</span><strong>${number(member.clicks)}</strong></div><div class="stat"><span>CTR</span><strong>${ctr(member)}</strong></div><div class="stat"><span>CPM</span><strong>${money(member.cpm)}</strong></div><div class="stat revenue"><span>REVENUE</span><strong>${money(member.revenue)}</strong></div></section>
    <div class="bottom-actions"><button id="logoutBtn" class="logout">LOG OUT</button>${p?.role === "admin" ? '<a class="admin-link" href="/admin.html">ADMIN PANEL</a>' : ""}</div>
  </main><div id="toast" class="toast"></div>`;
  document.querySelector("#logoutBtn").addEventListener("click", async () => { await supabase.auth.signOut(); state.user = null; state.profile = null; state.members = []; loginView(); });
  document.querySelector("#unlockBtn").addEventListener("click", unlockSelectedOffer);
  document.querySelector("#anotherBtn").addEventListener("click", async () => { state.selectedIndex = state.selectedIndex > 0 ? state.selectedIndex - 1 : state.members.length - 1; await getUnlockStatus(); dashboardView(); });
  document.querySelector("#moreBtn").addEventListener("click", async () => { state.selectedIndex = state.selectedIndex < state.members.length - 1 ? state.selectedIndex + 1 : 0; await getUnlockStatus(); dashboardView(); });
}

async function unlockSelectedOffer() {
  if (state.unlockLocked) return toast("ACCESS TEMPORARILY LOCKED");
  const member = selectedMember();
  if (!member) return toast("Member offer tidak tersedia.");
  const { data, error } = await supabase.rpc("unlock_offer", { p_offer_owner_id: member.id });
  if (error) return toast(error.message);
  if (!data?.allowed) {
    if (data?.reason === "limit") { state.unlockLocked = true; state.remaining = 0; dashboardView(); toast("ACCESS TEMPORARILY LOCKED"); }
    else if (data?.reason === "no_offer") toast("Offer belum tersedia untuk member ini.");
    else toast("Offer tidak tersedia.");
    return;
  }
  state.remaining = Number(data.remaining || 0);
  if (state.remaining <= 0) state.unlockLocked = true;
  if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
  if (state.unlockLocked) dashboardView();
}

async function loadDashboard() {
  const { data: { user }, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !user) { loginView(); return; }
  state.user = user;
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error) { loginView(`Profile error: ${error.message}`); return; }
  state.profile = profile;
  const { data: members, error: membersError } = await supabase.rpc("get_member_offers");
  if (membersError) { loginView(`Member data error: ${membersError.message}`); return; }
  state.members = members || [];
  const ownIndex = state.members.findIndex(m => m.id === user.id);
  state.selectedIndex = ownIndex >= 0 ? ownIndex : 0;
  await getUnlockStatus();
  dashboardView();
}

supabase.auth.onAuthStateChange((_event, session) => { if (session?.user) loadDashboard(); else loginView(); });
loadDashboard();
