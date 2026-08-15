const css = document.createElement("link"); css.rel="stylesheet"; css.href="/src/admin.css"; document.head.appendChild(css);
import { supabase } from "./supabase.js";

const app = document.querySelector("#app");
const state = { user: null, profile: null, users: [], campaigns: [] };

function esc(v = "") { return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function money(v) { return `$${Number(v || 0).toFixed(2)}`; }
function num(v) { return Number(v || 0).toLocaleString("en-US"); }
function ctr(c) { return c?.impressions ? `${((c.clicks / c.impressions) * 100).toFixed(2)}%` : "0.00%"; }
function toast(msg) { const el = document.querySelector("#toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(window.__t); window.__t = setTimeout(() => el.classList.remove("show"), 2200); }

async function verifyAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in.");
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error) throw error;
  if (profile.role !== "admin") throw new Error("Akun ini bukan admin.");
  state.user = user; state.profile = profile;
}

async function loadData() {
  const [{ data: profiles, error: pe }, { data: campaigns, error: ce }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("campaigns").select("*").order("created_at", { ascending: false })
  ]);
  if (pe) throw pe; if (ce) throw ce;
  state.users = profiles || []; state.campaigns = campaigns || [];
}

function render() {
  const totalRevenue = state.campaigns.reduce((s,c) => s + Number(c.revenue || 0), 0);
  const totalImpressions = state.campaigns.reduce((s,c) => s + Number(c.impressions || 0), 0);
  const totalClicks = state.campaigns.reduce((s,c) => s + Number(c.clicks || 0), 0);

  app.innerHTML = `
    <main class="admin-page">
      <header class="topbar"><div><div class="eyebrow">ADMIN PANEL</div><h1>Campaign Management</h1></div><button id="logout" class="ghost">LOG OUT</button></header>
      <section class="summary"><div><span>USERS</span><strong>${num(state.users.length)}</strong></div><div><span>CAMPAIGNS</span><strong>${num(state.campaigns.length)}</strong></div><div><span>IMPRESSIONS</span><strong>${num(totalImpressions)}</strong></div><div><span>CLICKS</span><strong>${num(totalClicks)}</strong></div><div><span>REVENUE</span><strong>${money(totalRevenue)}</strong></div></section>
      <section class="panel">
        <div class="panel-head"><h2>Users</h2><div style="display:flex;gap:8px;align-items:center"><input id="userSearch" placeholder="Search name or email"><button id="newUser" class="primary">+ ADD USER</button></div></div>
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>Membership</th><th>Status</th><th>Role</th><th>Actions</th></tr></thead><tbody>${state.users.map(u => `<tr><td><strong>${esc(u.name)}</strong><small>${esc(u.id)}</small></td><td>${esc(u.membership)}</td><td><span class="badge">${esc(u.account_status)}</span></td><td>${esc(u.role)}</td><td><button class="edit-user" data-id="${u.id}">EDIT</button></td></tr>`).join("")}</tbody></table></div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Campaigns</h2><button id="newCampaign" class="primary">+ NEW CAMPAIGN</button></div>
        <div class="table-wrap"><table><thead><tr><th>Campaign</th><th>User</th><th>Offer URL</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>CPM</th><th>Revenue</th><th>Actions</th></tr></thead><tbody>${state.campaigns.map(c => { const u = state.users.find(x => x.id === c.user_id); return `<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(u?.name || c.user_id)}</td><td>${c.offer_url ? `<a href="${esc(c.offer_url)}" target="_blank" rel="noopener noreferrer">OPEN</a>` : "—"}</td><td>${num(c.impressions)}</td><td>${num(c.clicks)}</td><td>${ctr(c)}</td><td>${money(c.cpm)}</td><td>${money(c.revenue)}</td><td><button class="edit-campaign" data-id="${c.id}">EDIT</button><button class="delete-campaign danger" data-id="${c.id}">DELETE</button></td></tr>`; }).join("")}</tbody></table></div>
      </section>
    </main><div id="toast" class="toast"></div>`;

  document.querySelector("#logout").onclick = async () => { await supabase.auth.signOut(); location.reload(); };
  document.querySelector("#newUser").onclick = () => createUserForm();
  document.querySelector("#newCampaign").onclick = () => campaignForm();
  document.querySelectorAll(".edit-campaign").forEach(btn => { btn.onclick = () => campaignForm(state.campaigns.find(c => c.id === Number(btn.dataset.id))); });
  document.querySelectorAll(".delete-campaign").forEach(btn => { btn.onclick = async () => { if (!confirm("Delete this campaign?")) return; const { error } = await supabase.from("campaigns").delete().eq("id", Number(btn.dataset.id)); if (error) return toast(error.message); await loadData(); render(); toast("Campaign deleted."); }; });
  document.querySelectorAll(".edit-user").forEach(btn => { btn.onclick = () => userForm(state.users.find(u => u.id === btn.dataset.id)); });
  document.querySelector("#userSearch").oninput = (e) => { const q = e.target.value.toLowerCase(); document.querySelectorAll("tbody tr").forEach(row => { row.style.display = row.textContent.toLowerCase().includes(q) ? "" : "none"; }); };
}

function createUserForm() {
  app.innerHTML += `<div class="modal" id="modal"><form class="modal-card" id="createUserForm"><h2>Create New User</h2><label>Name</label><input id="newName" placeholder="Full name" required><label>Email</label><input id="newEmail" type="email" placeholder="user@example.com" required><label>Password</label><input id="newPassword" type="password" minlength="8" placeholder="Minimum 8 characters" required><label>Membership</label><select id="newMembership"><option>Standard</option><option>Premium</option><option>VIP</option></select><label>Account Status</label><select id="newStatus"><option>Verified</option><option>Pending</option><option>Suspended</option></select><label>Role</label><select id="newRole"><option value="user">user</option><option value="admin">admin</option></select><div class="modal-actions"><button type="button" id="cancel">CANCEL</button><button class="primary" type="submit">CREATE USER</button></div></form></div>`;
  document.querySelector("#cancel").onclick = () => document.querySelector("#modal").remove();
  document.querySelector("#createUserForm").onsubmit = async (e) => { e.preventDefault(); const submit = e.currentTarget.querySelector("button[type=submit]"); submit.disabled = true; submit.textContent = "CREATING..."; const { data, error } = await supabase.functions.invoke("admin-create-user", { body: { name: document.querySelector("#newName").value.trim(), email: document.querySelector("#newEmail").value.trim(), password: document.querySelector("#newPassword").value, membership: document.querySelector("#newMembership").value, account_status: document.querySelector("#newStatus").value, role: document.querySelector("#newRole").value } }); if (error) { submit.disabled = false; submit.textContent = "CREATE USER"; return toast(error.message); } if (!data?.ok) { submit.disabled = false; submit.textContent = "CREATE USER"; return toast(data?.error || "Could not create user."); } document.querySelector("#modal").remove(); await loadData(); render(); toast("User created successfully."); };
}

function campaignForm(c = null) {
  const editing = !!c;
  const options = state.users.map(u => `<option value="${u.id}" ${u.id === c?.user_id ? "selected" : ""}>${esc(u.name)} — ${esc(u.id)}</option>`).join("");
  app.innerHTML += `<div class="modal" id="modal"><form class="modal-card" id="campaignForm"><h2>${editing ? "Edit Campaign" : "New Campaign"}</h2><label>User</label><select id="cUser" required>${options}</select><label>Name</label><input id="cName" value="${esc(c?.name || "")}" required><label>Offer URL</label><input id="cOfferUrl" type="url" value="${esc(c?.offer_url || "")}" placeholder="https://example.com/offer" required><label>Impressions</label><input id="cImp" type="number" min="0" value="${c?.impressions ?? 0}" required><label>Clicks</label><input id="cClicks" type="number" min="0" value="${c?.clicks ?? 0}" required><label>CPM</label><input id="cCpm" type="number" min="0" step="0.01" value="${c?.cpm ?? 0}" required><label>Revenue</label><input id="cRevenue" type="number" min="0" step="0.01" value="${c?.revenue ?? 0}" required><label class="check"><input id="cActive" type="checkbox" ${c?.active !== false ? "checked" : ""}> Active</label><div class="modal-actions"><button type="button" id="cancel">CANCEL</button><button class="primary" type="submit">SAVE</button></div></form></div>`;

  document.querySelector("#cancel").onclick = () => document.querySelector("#modal").remove();
  document.querySelector("#campaignForm").onsubmit = async (e) => {
    e.preventDefault();
    const offerUrl = document.querySelector("#cOfferUrl").value.trim();
    try { const parsed = new URL(offerUrl); if (!/^https?:$/.test(parsed.protocol)) throw new Error(); } catch { return toast("Offer URL harus berupa http:// atau https:// URL yang valid."); }
    const payload = { user_id: document.querySelector("#cUser").value, name: document.querySelector("#cName").value.trim(), offer_url: offerUrl, impressions: Number(document.querySelector("#cImp").value), clicks: Number(document.querySelector("#cClicks").value), cpm: Number(document.querySelector("#cCpm").value), revenue: Number(document.querySelector("#cRevenue").value), active: document.querySelector("#cActive").checked };
    const result = editing ? await supabase.from("campaigns").update(payload).eq("id", c.id) : await supabase.from("campaigns").insert(payload);
    if (result.error) return toast(result.error.message);
    document.querySelector("#modal").remove(); await loadData(); render(); toast("Campaign saved.");
  };
}

function userForm(u) {
  app.innerHTML += `<div class="modal" id="modal"><form class="modal-card" id="userForm"><h2>Edit User</h2><label>Name</label><input id="uName" value="${esc(u.name)}" required><label>Membership</label><select id="uMembership">${["Standard","Premium","VIP"].map(x => `<option ${u.membership === x ? "selected" : ""}>${x}</option>`).join("")}</select><label>Status</label><select id="uStatus">${["Verified","Pending","Suspended"].map(x => `<option ${u.account_status === x ? "selected" : ""}>${x}</option>`).join("")}</select><label>Role</label><select id="uRole">${["user","admin"].map(x => `<option ${u.role === x ? "selected" : ""}>${x}</option>`).join("")}</select><div class="modal-actions"><button type="button" id="cancel">CANCEL</button><button class="primary" type="submit">SAVE</button></div></form></div>`;
  document.querySelector("#cancel").onclick = () => document.querySelector("#modal").remove();
  document.querySelector("#userForm").onsubmit = async (e) => { e.preventDefault(); const payload = { name: document.querySelector("#uName").value.trim(), membership: document.querySelector("#uMembership").value, account_status: document.querySelector("#uStatus").value, role: document.querySelector("#uRole").value }; const { error } = await supabase.from("profiles").update(payload).eq("id", u.id); if (error) return toast(error.message); document.querySelector("#modal").remove(); await loadData(); render(); toast("User updated."); };
}

async function start() {
  try { await verifyAdmin(); await loadData(); render(); }
  catch (e) { app.innerHTML = `<main class="login-shell"><section class="login-card"><h1>Admin Access</h1><p>${esc(e.message)}</p><button class="primary" id="back">BACK TO LOGIN</button></section></main>`; document.querySelector("#back").onclick = () => location.href = "/"; }
}
start();
