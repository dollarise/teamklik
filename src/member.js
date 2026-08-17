import { supabase } from "./supabase.js";
import "./member.css";

const root = document.querySelector("#memberLanding");
const esc = (v="") => String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const params = new URLSearchParams(location.search);
const memberId = params.get("id") || params.get("member");

function renderMessage(title, text) {
  root.innerHTML = `<main class="landing"><section class="landing-card"><div class="landing-logo">◆</div><h1>${esc(title)}</h1><p>${esc(text)}</p><a class="landing-button" href="/">GO TO WEBSITE</a></section></main>`;
}

async function load() {
  if (!memberId) return renderMessage("Offer Not Found", "Link member belum lengkap.");
  const { data, error } = await supabase.rpc("get_public_member_landing", { p_member_id: memberId });
  if (error || !data?.length) return renderMessage("Offer Not Found", "Member atau offer ini tidak tersedia.");
  const member = data[0];
  document.title = `${member.name || "Member"} - Exclusive Offer`;
  const banner = (member.banner_code || "").trim();
  const bannerHtml = banner ? `<div class="banner-wrap"><iframe title="${esc(member.name || "Offer")} banner" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcdoc="${esc(banner)}"></iframe></div>` : `<div class="banner-empty">Offer banner belum tersedia.</div>`;
  root.innerHTML = `<main class="landing"><section class="landing-hero"><div class="landing-logo">◆</div><p class="eyebrow">EXCLUSIVE OPPORTUNITY</p><h1>BOOST YOUR ONLINE EARNINGS</h1><p class="subtitle">Discover an exclusive opportunity from ${esc(member.name || "our member")}.</p></section><section class="landing-card offer-card"><div class="member-name">${esc(member.name || "Member")}</div>${bannerHtml}<div class="offer-copy"><h2>${esc(member.campaign_name || "Exclusive Offer")}</h2><p>Take the next step and explore this opportunity.</p>${member.offer_url ? `<a class="landing-button" href="${esc(member.offer_url)}" target="_blank" rel="noopener noreferrer">UNLOCK EXCLUSIVE ACCESS</a>` : ""}</div></section><p class="footer-note">Work Smarter. Earn More Online</p></main>`;
}
load();
