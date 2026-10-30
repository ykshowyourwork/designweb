// The proposal deck (/proposal/<slug>), built from the same facts as the demo site.
// Same order as the MCM deck: goals, where you stand, your new site, who's ahead, what their sites do,
// what you get, the price, next steps. Only real numbers from the research; a missing one leaves its slide out.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const slug = location.pathname.split("/").filter(Boolean).pop();
const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
const n = (x) => Number(x || 0).toLocaleString();

function slides(d) {
  const s = d.site || {};
  const town = s.town || d.area || "";
  const out = [];
  const foot = (t) => `<p class="foot">${esc(t)}</p>`;

  out.push(`<section class="slide cover"><p class="eyebrow">Growth proposal · ${month}</p><h1>${esc(d.business)}</h1><p class="big">${esc(town)} · How to get found by people searching for ${esc(s.trade || "what you do")}.</p><p class="big" style="font-size:16px">Prepared by <b style="color:#f4f2ec">DesiWeb</b> · desiweb.org</p></section>`);

  out.push(`<section class="slide"><p class="eyebrow">Your goals</p><h2>We build around your numbers.</h2>
    <table class="table-blank"><tr><th>Question</th><th>Your answer</th></tr>
    <tr><td>New customers a month now?</td><td>[__]</td></tr><tr><td>New customers a month you want?</td><td>[__]</td></tr>
    <tr><td>How many jobs can you take a week?</td><td>[__]</td></tr><tr><td>The job you want more of?</td><td>[__]</td></tr></table></section>`);

  const status = [
    [`${n(d.reviews)} reviews`, d.rating ? `${Number(d.rating).toFixed(1)} stars on Google. That's real trust.` : "Real customers already vouch for you."],
    d.no_website || !d.website ? ["No website", "People can't see your prices, your work or book you."] : /facebook|instagram/i.test(d.website) ? ["Social link only", "Your listing points to social media, not a site that books."] : ["Website", "Your site isn't turning those searches into calls."],
    d.unclaimed_google ? ["Unclaimed listing", "Anyone can change your hours or photos."] : null,
  ].filter(Boolean);
  out.push(`<section class="slide"><p class="eyebrow">Where you stand</p><h2>${esc(s.finding || "Customers love you. Google doesn't show it yet.")}</h2>
    <div class="cards">${status.map(([h, p]) => `<div class="card"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join("")}</div>${foot(`Source: Google Maps and your Google listing, ${month}.`)}</section>`);

  out.push(`<section class="slide"><p class="eyebrow">Your new site</p><h2>It's already built. Take a look.</h2>
    <a class="link" href="/site/${esc(d.slug)}" target="_blank" rel="noopener">desiweb.org/site/${esc(d.slug)}</a>
    <div class="cards"><div class="card"><h3>${esc(s.cta || "Book")} in a tap</h3><p>Your services up front, with a button on every screen.</p></div>
    <div class="card"><h3>Your real work</h3><p>Your photos and reviews, full screen.</p></div>
    <div class="card"><h3>Story mode</h3><p>On phones it opens full screen. People swipe through like a story.</p></div></div>${foot("Private preview. Not on Google until you say go.")}</section>`);

  const top = s.maps?.top || [];
  if (top.length) {
    const rows = top.slice(0, 5).map((t, i) => `<tr class="${t.you ? "you" : ""}"><td>#${t.rank || i + 1}</td><td>${esc(t.name)}</td><td>${n(t.reviews)}</td><td>${t.site ? "Yes" : "No"}</td></tr>`).join("");
    const you = s.maps.rank ? `#${s.maps.rank}` : "not in the top 10";
    out.push(`<section class="slide"><p class="eyebrow">Who's ahead on Google Maps</p><h2>Search “${esc(s.maps.keyword)}” near you and you're ${esc(you)}.</h2>
      <table><tr><th>Spot</th><th>Business</th><th>Reviews</th><th>Website</th></tr>${rows}</table>${foot(`Google Maps, searched from your area, ${month}.`)}</section>`);
  }

  if (s.rivals?.length || s.improve?.length) {
    out.push(`<section class="slide light"><p class="eyebrow">What their sites do</p><h2>We studied the sites beating you. Yours does more.</h2>
      <div class="cards">${(s.rivals || []).slice(0, 3).map((r) => `<div class="card"><h3>${esc(r.name)}</h3><p>${esc((r.has || []).join(" · ") || "A basic site")}</p></div>`).join("")}</div>
      ${s.improve?.length ? `<ul>${s.improve.slice(0, 5).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</section>`);
  }

  if (s.money?.searches) {
    out.push(`<section class="slide money"><p class="eyebrow">What these searches are worth</p><div class="cards" style="max-width:1100px">
      <div><div class="num">~${n(s.money.searches)}</div><p class="big">searches a month near you for ${esc(s.trade || "your work")}</p></div>
      ${s.money.cpc ? `<div><div class="num">$${Number(s.money.cpc).toFixed(2)}</div><p class="big">what other businesses pay Google for one click</p></div>` : ""}</div>
      <p class="big">A site that shows up on its own gets these people for free.</p>${foot(`Google search counts and ad prices, ${month}.`)}</section>`);
  }

  out.push(`<section class="slide light"><p class="eyebrow">What you get</p><h2>Built to put you on the map.</h2><div class="cards">
    ${[["New website", "Fast on phones. Full pages for your best work, plus the areas you serve."], [`${s.cta || "Booking"} + deposits`, "Customers pick a time and pay a deposit."], ["Google Maps", "Your listing set up right, plus a link that makes reviews easy."], ["20 listings", "Apple Maps, Bing, Yelp and more, all showing the same info."], ["Every month", "New Google posts and articles, hosting and upkeep."]]
      .map(([h, p]) => `<div class="card"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join("")}</div>${foot("You own the website and everything we make. Live in about 2 weeks.")}</section>`);

  const price = s.price || { growth: "$3,500", monthly: "$300/mo", starter: "$1,750" };
  out.push(`<section class="slide"><p class="eyebrow">The price</p><h2>One new customer pays for it.</h2><div class="cards">
    <div class="card"><h3>Starter</h3><div class="num">${esc(price.starter || "$1,750")}</div><p>Your website, service pages and quote form. Ready for Google.</p></div>
    <div class="card hi"><h3>Growth</h3><div class="num">${esc(price.growth || "$3,500")}</div><p>+ ${esc(price.monthly || "$300/mo")}. Everything in Starter, plus booking, Google Maps work and new articles every month.</p></div></div>
    <p class="big">Half to start, half when the site goes live. Stop the monthly anytime.</p></section>`);

  out.push(`<section class="slide next"><p class="eyebrow">Next steps</p><h2>Live in about 2 weeks.</h2><ol>
    <li>Pay the deposit. The invoice comes by email.</li><li>Send your logo and any new photos.</li>
    <li>We set up your Google listing and 20 listings.</li><li>Your site goes live. Pay the rest.</li></ol>${foot("DesiWeb · gethelp@desiweb.org · desiweb.org")}</section>`);
  return out;
}

(async () => {
  try {
    const res = await fetch(`/api/site-data?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error();
    const d = await res.json();
    document.title = `${d.business} · Growth proposal · DesiWeb`;
    const deck = $("deck");
    deck.innerHTML = slides(d).join("");
    const all = [...deck.querySelectorAll(".slide")];
    const current = () => Math.round(deck.scrollTop / deck.clientHeight);
    const go = (i) => all[Math.max(0, Math.min(all.length - 1, i))].scrollIntoView({ behavior: "smooth" });
    const count = () => ($("count").textContent = `${current() + 1} / ${all.length}`);
    deck.addEventListener("scroll", count, { passive: true });
    count();
    $("prev").onclick = () => go(current() - 1);
    $("next").onclick = () => go(current() + 1);
    addEventListener("keydown", (e) => {
      if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(current() + 1); }
      if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); go(current() - 1); }
    });
    $("loading").hidden = true;
  } catch {
    $("loading").textContent = "This proposal isn't ready yet.";
  }
})();
