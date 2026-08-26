import "./style.css";
import { supabase } from "./supabase.js";

const app = document.querySelector("#app");

const state = {
  user: null,
  profile: null,
  members: [],
  selectedIndex: 0,
  unlockLocked: false,
  remaining: 0
};

const SELECTED_MEMBER_KEY = "teamklik_selected_member_id";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1E2QjwSCs1Gdc_3m54xVLTbIkR0P74XdLcrg5UoOC1Pg";

const esc = (v = "") =>
  String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const selectedMember = () =>
  state.members[state.selectedIndex] || null;

function saveSelectedMember() {
  const m = selectedMember();
  if (m?.id) sessionStorage.setItem(SELECTED_MEMBER_KEY, m.id);
}

function restoreSelectedMember() {
  const savedId = sessionStorage.getItem(SELECTED_MEMBER_KEY);
  if (!savedId || !state.members.length) return;

  const savedIndex = state.members.findIndex(member => String(member.id) === String(savedId));
  if (savedIndex >= 0) {
    state.selectedIndex = savedIndex;
  }
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
        <input id="email" type="email" required>

        <label>Password</label>
        <input id="password" type="password" required>

        <button class="primary" type="submit">
          LOGIN
        </button>

        <div class="error">
          ${esc(message)}
        </div>
      </form>

      <p class="hint">
        Akun dibuat melalui Supabase Auth.
      </p>

    </section>
  </main>
  `;

  document.querySelector("#loginForm").onsubmit = async e => {
    e.preventDefault();

    const { error } =
      await supabase.auth.signInWithPassword({
        email: document.querySelector("#email").value.trim(),
        password: document.querySelector("#password").value
      });

    if (error) {
      loginView(error.message);
      return;
    }

    await loadDashboard();
  };
}


async function getUnlockStatus() {

  const member = selectedMember();

  if (!member || !state.user) {
    state.remaining = 0;
    state.unlockLocked = true;
    return;
  }

  const limit = Number(member.unlock_limit || 0);

  const { data, error } =
    await supabase
      .from("offer_access_logs")
      .select("id")
      .eq("user_id", state.user.id)
      .eq("offer_owner_id", member.id)
      .gte(
        "accessed_at",
        new Date(Date.now() - 60 * 60 * 1000)
          .toISOString()
      );

  if (error) {
    state.remaining = 0;
    state.unlockLocked = true;
    return;
  }

  state.remaining =
    Math.max(limit - (data?.length || 0), 0);

  state.unlockLocked =
    state.remaining <= 0;
}


function setBanner() {

  const frame =
    document.querySelector("#bannerFrame");

  const member = selectedMember();

  if (!frame) return;

  const code =
    (member?.banner_code || "").trim();

  frame.srcdoc = `
<style>
html, body {
  margin:0;
  padding:0;
  width:100%;
  overflow:hidden;
  background:transparent;
}

img {
  max-width:100%;
  height:auto;
  display:block;
}

a {
  display:block;
}
</style>
${code}
`;
}


function dashboardView() {

  const p = state.profile;

  const member =
    selectedMember() || {
      id:p.id,
      name:p.name,
      banner_code:null
    };


  const unlockClass =
    state.unlockLocked
      ? "unlock locked"
      : "unlock";


  const unlockText =
    state.unlockLocked
      ? "ACCESS TEMPORARILY LOCKED"
      : "🔒 UNLOCK EXCLUSIVE ACCESS";


  app.innerHTML = `

  <main class="page">

    <section class="card campaign">

      <div class="eyebrow">
        ACTIVE OFFER
      </div>


      <div class="banner-wrap">

        <iframe
          id="bannerFrame"
          title="Active offer banner"
          loading="lazy"
          sandbox="
          allow-scripts
          allow-popups
          allow-popups-to-escape-sandbox">
        </iframe>

      </div>

    </section>


    <div class="offer-member">
      <h2>
        ${esc(member.name || "Member")}
      </h2>
    </div>


    <button
      id="unlockBtn"
      class="${unlockClass}"
      ${state.unlockLocked ? "disabled" : ""}>

      ${unlockText}

    </button>


    <div class="actions">

      <button id="anotherBtn">
        ← SEE ANOTHER OFFER
      </button>


      <button id="moreBtn">
        🔥 SHOW ME MORE
      </button>

    </div>



    <div class="bottom-actions">

      <a
       class="sheet-link"
       href="${SHEET_URL}"
       target="_blank">

       VIEW INFORMATION

      </a>


      <button id="logoutBtn"
       class="logout">

       LOG OUT

      </button>


      ${
        p?.role === "admin"
        ? `<a class="admin-link"
          href="/admin.html">
          ADMIN PANEL
          </a>`
        : ""
      }


    </div>


  </main>

  <div id="toast"
  class="toast"></div>

  `;


  setBanner();


  document.querySelector("#logoutBtn")
  .onclick = async () => {

    await supabase.auth.signOut();

    sessionStorage.removeItem(
      SELECTED_MEMBER_KEY
    );

    loginView();

  };


  document.querySelector("#unlockBtn")
  .onclick = unlockSelectedOffer;


  document.querySelector("#anotherBtn")
  .onclick = async () => {

    state.selectedIndex =
      state.selectedIndex > 0
      ? state.selectedIndex - 1
      : state.members.length - 1;

    saveSelectedMember();

    await getUnlockStatus();

    dashboardView();

  };


  document.querySelector("#moreBtn")
  .onclick = async () => {

    state.selectedIndex =
      state.selectedIndex <
      state.members.length - 1
      ? state.selectedIndex + 1
      : 0;

    saveSelectedMember();

    await getUnlockStatus();

    dashboardView();

  };

}



async function unlockSelectedOffer(){

  if(state.unlockLocked)
    return;


  const member =
    selectedMember();


  const {data,error} =
    await supabase.rpc(
      "unlock_offer",
      {
        p_offer_owner_id:
        member.id
      }
    );


  if(error)
    return;


  if(data?.url)
    window.open(
      data.url,
      "_blank"
    );

}



async function loadDashboard(){

 const {
  data:{user}
 } =
 await supabase.auth.getUser();


 if(!user){
   loginView();
   return;
 }


 state.user=user;


 const {data:profile,error}
 =
 await supabase
 .from("profiles")
 .select("*")
 .eq("id",user.id)
 .single();



 if(error){
   loginView(error.message);
   return;
 }


 state.profile=profile;


 const {data:members}
 =
 await supabase.rpc(
  "get_member_offers"
 );


 state.members =
 members || [];


 // Keep the currently selected offer when the dashboard is rebuilt
 // (for example after returning from an Unlock tab or an auth-state refresh).
 // Only Previous/Next should change the selected offer.
 restoreSelectedMember();

 // On a completely fresh session, start from the first offer and persist it.
 if (!sessionStorage.getItem(SELECTED_MEMBER_KEY) && state.members.length) {
   state.selectedIndex = 0;
   saveSelectedMember();
 }


 await getUnlockStatus();


 dashboardView();

}



supabase.auth
.onAuthStateChange(
(_event,session)=>{

 if(session?.user)
   loadDashboard();

 else
   loginView();

});


loadDashboard();
