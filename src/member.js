import { supabase } from "./supabase.js";
import "./member.css";

const root = document.querySelector("#memberLanding");
const esc = (v="") => String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const params = new URLSearchParams(location.search);
const memberId = params.get("id") || params.get("member");

function renderMessage(title, text) {
  root.innerHTML = `<main class="landing"><section class="landing-card"><div class="landing-logo">◆</div><h1>${esc(title)}</h1><p>${esc(text)}</p><a class="landing-button" href="/">GO TO WEBSITE</a></section></main>`;
}

async function handleBannerClick(button, member) {
  if (button.dataset.busy === "1") return;
  button.dataset.busy = "1";
  button.setAttribute("aria-busy", "true");
  button.classList.add("is-loading");

  try {
    const { data, error } = await supabase.functions.invoke("banner-click", {
      body: { member_id: member.id },
    });

    if (error) throw error;

    if (data?.allowed && data?.offer_url) {
      window.location.assign(data.offer_url);
      return;
    }

    const message = data?.message || "Banner ini sudah diklik dari IP ini dalam 24 jam terakhir.";
    const retry = data?.retry_at ? ` Coba lagi setelah ${new Date(data.retry_at).toLocaleString("id-ID")}.` : "";
    button.classList.remove("is-loading");
    button.dataset.busy = "0";
    button.removeAttribute("aria-busy");
    button.innerHTML = `<span>${esc(message + retry)}</span>`;
    button.classList.add("is-blocked");
  } catch (error) {
    console.error("Banner click failed", error);
    button.dataset.busy = "0";
    button.removeAttribute("aria-busy");
    button.classList.remove("is-loading");
    button.innerHTML = "<span>Gagal memproses klik. Silakan coba lagi.</span>";
    setTimeout(() => {
      button.classList.remove("is-blocked");
      button.innerHTML = "<span>KLIK BANNER UNTUK MELANJUTKAN</span>";
    }, 3000);
  }
}

async function load() {
  if (!memberId) return renderMessage("Offer Not Found", "Link member belum lengkap.");
  const { data, error } = await supabase.rpc("get_public_member_landing", { p_member_id: memberId });
  if (error || !data?.length) return renderMessage("Offer Not Found", "Member atau offer ini tidak tersedia.");
  const member = data[0];
  document.title = `${member.name || "Member"} - Exclusive Offer`;

  const banner = (member.banner_code || "").trim();
  const bannerHtml = banner
    ? `<div class="banner-wrap"><iframe title="${esc(member.name || "Offer")} banner" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcdoc="${esc(banner)}"></iframe><button type="button" class="banner-click-layer" aria-label="Klik banner untuk melanjutkan"><span>KLIK BANNER UNTUK MELANJUTKAN</span></button></div>`
    : `<div class="banner-empty">Offer banner belum tersedia.</div>`;

  root.innerHTML = `<main class="landing"><section class="landing-hero"><div class="landing-logo">◆</div><p class="eyebrow">EXCLUSIVE OPPORTUNITY</p><h1>BOOST YOUR ONLINE EARNINGS</h1><p class="subtitle">Discover an exclusive opportunity from ${esc(member.name || "our member")}.</p></section><section class="landing-card offer-card"><div class="member-name">${esc(member.name || "Member")}</div>${bannerHtml}<div class="offer-copy"><h2>${esc(member.campaign_name || "Exclusive Offer")}</h2><p>Take the next step and explore this opportunity.</p>${member.offer_url ? `<a class="landing-button" href="${esc(member.offer_url)}" target="_blank" rel="noopener noreferrer">UNLOCK EXCLUSIVE ACCESS</a>` : ""}</div></section><p class="footer-note">Work Smarter. Earn More Online</p></main>`;

  const clickLayer = root.querySelector(".banner-click-layer");
  if (clickLayer && member.offer_url) {
    clickLayer.addEventListener("click", () => handleBannerClick(clickLayer, member));
  }
}

load();
