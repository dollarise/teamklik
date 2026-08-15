import "./style.css";
import { supabase } from "./supabase.js";

const app = document.querySelector("#app");
const state = { user: null, profile: null };

function money(value) { return `$${Number(value || 0).toFixed(2)}`; }
function number(value) { return Number(value || 0).toLocaleString("en-US"); }
function ctr(profile) {
  if (!profile?.impressions) return "0.00%";
  return `${((Number(profile.clicks || 0) / Number(profile.impressions || 0)) * 100).toFixed(2)}%`;
}
function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function toast(message) {
  const el = document.querySelector("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => el.classList.remove("show"), 2200);
}

function loginView(message = "") {
  app.innerHTML = `
    <main class="login-shell"><section class="login-card">
      <div class="mini-logo">◆</div><h1>Welcome Back</h1>
      <p>Login untuk membuka dashboard earnings Anda.</p>
      <form id="loginForm"><label>Email</label><input id="email" type="email" autocomplete="email" placeholder="you@example.com" required>
      <label>Password</label><input id="password" type="password" autocomplete="current-password" placeholder="Password" required>
      <button class="primary" type="submit">LOGIN</button><div class="error">${escapeHtml(message)}</div></form>
      <p class="hint">Akun dibuat melalui Supabase Auth.</p>
    </section></main><div id="toast" class="toast"></div>`;
  document.querySelector("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.querySelector("#email").value.trim();
    const password = document.querySelector("#password").value;
    const button = event.submitter; button.disabled = true; button.textContent = "SIGNING IN...";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { loginView(error.message); return; }
    await loadDashboard();
  });
}

function dashboardView() {
  const user = state.user;
  const p = state.profile;
  app.innerHTML = `
    <main class="page">
      <section class="hero"><h1>BOOST YOUR ONLINE EARNINGS</h1><p>Discover Exclusive Opportunities Used By Smart Digital Marketers Worldwide</p></section>
      <section class="card profile">
        <div><div class="eyebrow">USER NAME</div><h2>${escapeHtml(p?.name || user?.email || "User")}</h2>
          <div class="eyebrow">EMAIL</div><p>${escapeHtml(user?.email || "-")}</p>
          <div class="eyebrow">MEMBER SINCE</div><p>${p?.member_since ? new Date(p.member_since).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "-"}</p>
        </div>
        <div class="profile-status"><div><span>ACCOUNT STATUS</span><strong class="green">${escapeHtml(p?.account_status || "Verified")}</strong></div><div><span>MEMBERSHIP</span><strong>${escapeHtml(p?.membership || "Standard")}</strong></div></div>
      </section>
      <section class="card campaign"><div class="eyebrow">ACTIVE OFFER</div><div class="campaign-name">${escapeHtml(p?.campaign_name || "No offer")}</div>${p?.offer_url ? '<p class="muted">Offer tersedia untuk akun ini.</p>' : '<p class="muted">Belum ada offer untuk akun ini.</p>'}</section>
      <button id="unlockBtn" class="unlock">🔒 UNLOCK EXCLUSIVE ACCESS</button>
      <div class="actions"><button id="anotherBtn">← SEE ANOTHER OFFER</button><button id="moreBtn">🔥 SHOW ME MORE</button></div>
      <section class="stats"><div class="stat"><span>IMPRESSIONS</span><strong>${number(p?.impressions)}</strong></div><div class="stat"><span>CLICKS</span><strong>${number(p?.clicks)}</strong></div><div class="stat"><span>CTR</span><strong>${ctr(p)}</strong></div><div class="stat"><span>CPM</span><strong>${money(p?.cpm)}</strong></div><div class="stat revenue"><span>REVENUE</span><strong>${money(p?.revenue)}</strong></div></section>
      <div class="bottom-actions"><button id="logoutBtn" class="logout">LOG OUT</button>${p?.role === "admin" ? '<a class="admin-link" href="/admin.html">ADMIN PANEL</a>' : ""}</div>
    </main><div id="toast" class="toast"></div>`;
  document.querySelector("#logoutBtn").addEventListener("click", async () => { await supabase.auth.signOut(); state.user = null; state.profile = null; loginView(); });
  document.querySelector("#unlockBtn").addEventListener("click", () => {
    const url = p?.offer_url?.trim();
    if (!url) return toast("URL offer belum diatur untuk user ini.");
    try { const parsed = new URL(url); if (!/^https?:$/.test(parsed.protocol)) throw new Error(); window.open(parsed.href, "_blank", "noopener,noreferrer"); }
    catch { toast("URL offer tidak valid."); }
  });
  document.querySelector("#anotherBtn").addEventListener("click", () => toast("Saat ini satu offer disimpan langsung pada data user."));
  document.querySelector("#moreBtn").addEventListener("click", () => toast("Data offer dan analytics dikelola dari Admin Panel."));
}

async function loadDashboard() {
  const { data: { user }, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !user) { loginView(); return; }
  state.user = user;
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error) { loginView(`Profile error: ${error.message}`); return; }
  state.profile = profile;
  dashboardView();
}

supabase.auth.onAuthStateChange((_event, session) => { if (session?.user) loadDashboard(); else loginView(); });
loadDashboard();
