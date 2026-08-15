import "./style.css";
import { supabase } from "./supabase.js";

const app = document.querySelector("#app");

const state = {
  user: null,
  profile: null,
  campaigns: [],
  selectedCampaign: null
};

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function number(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function ctr(campaign) {
  if (!campaign || !campaign.impressions) return "0.00%";
  return `${((campaign.clicks / campaign.impressions) * 100).toFixed(2)}%`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    <main class="login-shell">
      <section class="login-card">
        <div class="mini-logo">◆</div>
        <h1>Welcome Back</h1>
        <p>Login untuk membuka dashboard earnings Anda.</p>

        <form id="loginForm">
          <label>Email</label>
          <input id="email" type="email" autocomplete="email" placeholder="you@example.com" required>

          <label>Password</label>
          <input id="password" type="password" autocomplete="current-password" placeholder="Password" required>

          <button class="primary" type="submit">LOGIN</button>
          <div class="error">${escapeHtml(message)}</div>
        </form>

        <p class="hint">Akun dibuat melalui Supabase Auth.</p>
      </section>
    </main>
    <div id="toast" class="toast"></div>
  `;

  document.querySelector("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.querySelector("#email").value.trim();
    const password = document.querySelector("#password").value;

    const button = event.submitter;
    button.disabled = true;
    button.textContent = "SIGNING IN...";

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      loginView(error.message);
      return;
    }

    await loadDashboard();
  });
}

function dashboardView() {
  const user = state.user;
  const profile = state.profile;
  const c = state.selectedCampaign;

  const options = state.campaigns.map(item =>
    `<option value="${item.id}" ${item.id === c?.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
  ).join("");

  app.innerHTML = `
    <main class="page">
      <section class="hero">
        <h1>BOOST YOUR ONLINE EARNINGS</h1>
        <p>Discover Exclusive Opportunities Used By Smart Digital Marketers Worldwide</p>
      </section>

      <section class="card profile">
        <div>
          <div class="eyebrow">USER NAME</div>
          <h2>${escapeHtml(profile?.name || user?.email || "User")}</h2>

          <div class="eyebrow">EMAIL</div>
          <p>${escapeHtml(user?.email || "-")}</p>

          <div class="eyebrow">MEMBER SINCE</div>
          <p>${profile?.member_since ? new Date(profile.member_since).toLocaleDateString("en-US", {
            year: "numeric", month: "long", day: "numeric"
          }) : "-"}</p>
        </div>

        <div class="profile-status">
          <div>
            <span>ACCOUNT STATUS</span>
            <strong class="green">${escapeHtml(profile?.account_status || "Verified")}</strong>
          </div>
          <div>
            <span>MEMBERSHIP</span>
            <strong>${escapeHtml(profile?.membership || "Standard")}</strong>
          </div>
        </div>
      </section>

      <section class="card campaign">
        <div class="eyebrow">ACTIVE CAMPAIGN</div>
        <div class="campaign-name">${escapeHtml(c?.name || "No campaign")}</div>
        ${state.campaigns.length ? `
          <select id="campaignSelect" aria-label="Select campaign">
            ${options}
          </select>
        ` : `<p class="muted">Belum ada campaign untuk akun ini.</p>`}
      </section>

      <button id="unlockBtn" class="unlock">🔒 UNLOCK EXCLUSIVE ACCESS</button>

      <div class="actions">
        <button id="anotherBtn">← SEE ANOTHER OFFER</button>
        <button id="moreBtn">🔥 SHOW ME MORE</button>
      </div>

      <section class="stats">
        <div class="stat">
          <span>IMPRESSIONS</span>
          <strong>${number(c?.impressions)}</strong>
        </div>
        <div class="stat">
          <span>CLICKS</span>
          <strong>${number(c?.clicks)}</strong>
        </div>
        <div class="stat">
          <span>CTR</span>
          <strong>${ctr(c)}</strong>
        </div>
        <div class="stat">
          <span>CPM</span>
          <strong>${money(c?.cpm)}</strong>
        </div>
        <div class="stat revenue">
          <span>REVENUE</span>
          <strong>${money(c?.revenue)}</strong>
        </div>
      </section>

      <div class="bottom-actions"><button id="logoutBtn" class="logout">LOG OUT</button>${profile?.role === "admin" ? '<a class="admin-link" href="/admin.html">ADMIN PANEL</a>' : ""}</div>
    </main>
    <div id="toast" class="toast"></div>
  `;

  document.querySelector("#logoutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    state.user = null;
    state.profile = null;
    state.campaigns = [];
    state.selectedCampaign = null;
    loginView();
  });

  document.querySelector("#unlockBtn").addEventListener("click", () => {
    toast("Hubungkan tombol ini ke URL offer Anda.");
  });

  document.querySelector("#moreBtn").addEventListener("click", () => {
    toast("Tambahkan detail campaign atau analytics di sini.");
  });

  document.querySelector("#anotherBtn").addEventListener("click", () => {
    if (state.campaigns.length < 2) {
      toast("Belum ada campaign lain.");
      return;
    }
    const current = state.campaigns.findIndex(x => x.id === state.selectedCampaign?.id);
    const next = state.campaigns[(current + 1) % state.campaigns.length];
    state.selectedCampaign = next;
    dashboardView();
  });

  const select = document.querySelector("#campaignSelect");
  if (select) {
    select.addEventListener("change", () => {
      const next = state.campaigns.find(x => x.id === Number(select.value));
      state.selectedCampaign = next || null;
      dashboardView();
    });
  }
}

async function loadDashboard() {
  const { data: { user }, error: sessionError } = await supabase.auth.getUser();

  if (sessionError || !user) {
    loginView();
    return;
  }

  state.user = user;

  const [{ data: profile, error: profileError }, { data: campaigns, error: campaignError }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("campaigns")
        .select("id, name, impressions, clicks, cpm, revenue, active")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("id", { ascending: false })
    ]);

  if (profileError) {
    loginView(`Profile error: ${profileError.message}`);
    return;
  }

  if (campaignError) {
    loginView(`Campaign error: ${campaignError.message}`);
    return;
  }

  state.profile = profile;
  state.campaigns = campaigns || [];
  state.selectedCampaign = state.campaigns[0] || null;

  dashboardView();
}

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    loadDashboard();
  } else {
    loginView();
  }
});

loadDashboard();
