// Fills the demo site template from /api/site-data?slug=… (what the daily routine saved for this business).
// Everything shown comes from their Google listing, their reviews and our research. Nothing is made up:
// a missing photo shows an empty frame, a missing price says "Free quote".
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const html = document.documentElement;
const slug = location.pathname.split("/").filter(Boolean).pop();

// How each kind of business books, and what to say. Quote trades get "Get a free quote"; appointment trades get "Book".
const TRADES = [
  { match: /tree|roof|plumb|rooter|electric|hvac|fence|landscap|concrete|paint|clean|maid|pest|pool|moving|handyman|contractor/i, cta: "Get a free quote", short: "Free quote", accent: "#ff7a1a", steps: [["Call or send a photo", "Tell us what's going on. Photos help us price it."], ["Free estimate", "A fair price, often the same day."], ["We do the work", "Careful, insured and on time."], ["We clean up", "We leave it better than we found it."]] },
  { match: /nail|salon|barber|spa|lash|brow|wax|hair|beauty/i, cta: "Book now", short: "Book", accent: "#e8a0bf", steps: [["Pick your service", "Every price is posted."], ["Pick a time", "Book online in a few taps."], ["Get a reminder", "A text the day before."], ["Walk in, relax", "We take it from there."]] },
  { match: /auto|smog|tire|brake|mechanic|detail|body shop|car/i, cta: "Book a service", short: "Book", accent: "#d6a93b", steps: [["Pick a service", "Prices posted up front."], ["Pick a day", "Book online in a minute."], ["We do the work", "The work you booked, at the price you saw."], ["Drive away", "Pay at pickup."]] },
  { match: /wedding|photo|video|dj|venue|banquet|event|florist|flower/i, cta: "Check your date", short: "Check date", accent: "#c9a46a", steps: [["Check your date", "See if we're free on your day."], ["Talk it through", "A quick call about what you want."], ["Lock it in", "A deposit holds your date."], ["Enjoy the day", "We handle the rest."]] },
];
const DEFAULT = { cta: "Get in touch", short: "Contact", accent: "#4f86ff", steps: [["Reach out", "Call, text or send a request."], ["We reply fast", "Usually the same day."], ["We get it done", "Right the first time."], ["You're happy", "Or we make it right."]] };

function toast(t) {
  const el = document.querySelector(".toast");
  el.textContent = t || el.textContent;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 4000);
}

function render(d) {
  const s = d.site || {};
  const trade = TRADES.find((t) => t.match.test(`${s.trade} ${d.category} ${d.business}`)) || DEFAULT;
  const cta = s.cta || trade.cta;
  const short = s.cta_short || (s.cta ? s.cta.split(" ").slice(0, 2).join(" ") : trade.short);
  const tel = String(d.phone || "").replace(/[^\d+]/g, "");
  const town = s.town || d.area || "";
  document.title = `${d.business} · ${s.trade ? s.trade[0].toUpperCase() + s.trade.slice(1) : "Preview"} in ${town}`;
  html.style.setProperty("--accent", s.accent || trade.accent);

  // Header
  $("brand-name").textContent = d.business;
  $("brand-sub").textContent = [s.trade && s.trade[0].toUpperCase() + s.trade.slice(1), town].filter(Boolean).join(" · ");
  $("mark").innerHTML = s.logo ? `<img src="${esc(s.logo)}" alt="" />` : esc(d.business.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase());
  ["nav-cta", "hero-cta", "book-btn", "form-cta", "dock-book"].forEach((id) => ($(id).textContent = id === "dock-book" ? short : cta));
  $("sheet-title").textContent = cta;

  // Hero
  const hero = s.hero || (s.photos || [])[0];
  $("hero-photo").style.backgroundImage = `linear-gradient(100deg,rgba(11,11,12,.97) 0%,rgba(11,11,12,.82) 42%,rgba(11,11,12,.25) 100%)${hero ? `,url("${hero}")` : ""}`;
  $("plx").style.backgroundImage = hero ? `url("${hero}")` : "none";
  $("hero-pill").textContent = d.rating ? `★ ${Number(d.rating).toFixed(1)} · ${Number(d.reviews || 0).toLocaleString()} Google reviews` : (s.trade || "");
  $("hero-title").innerHTML = esc(s.headline || `${s.trade || "Done right"} in`) + ` <em>${esc(s.headline_town || town.split(",")[0])}.</em>`;
  $("hero-lead").textContent = s.lead || `${d.business} in ${town}. ${s.services?.some((x) => x.price) ? "Every service and price, right here. " : s.services?.length ? "Every service, right here. " : ""}${cta} in a few taps.`;
  if (tel) {
    for (const id of ["hero-call", "book-call"]) { $(id).href = `tel:${tel}`; $(id).textContent = `Call ${d.phone}`; }
    $("dock-call").href = `tel:${tel}`;
    $("dock-text").href = `sms:${tel}`;
  } else ["hero-call", "book-call", "dock-call", "dock-text"].forEach((id) => $(id).remove());
  $("badges").innerHTML = (s.badges || [d.reviews && `${d.reviews} Google reviews`, "Prices up front", "Fast replies", s.address && "Local and nearby"]).filter(Boolean).map((b) => `<span>${esc(b)}</span>`).join("");

  // Band: the four facts
  const band = s.band || [
    d.rating && [`${Number(d.rating).toFixed(1)}★`, "on Google"],
    d.reviews && [Number(d.reviews).toLocaleString(), "reviews"],
    s.hours_short && [s.hours_short, "open"],
    [short, "online, any time"],
  ].filter(Boolean);
  $("band-in").innerHTML = band.slice(0, 4).map(([b, t]) => `<div><b>${esc(b)}</b><span>${esc(t)}</span></div>`).join("");

  // Services
  const svcs = s.services?.length ? s.services : [];
  $("svc-title").textContent = s.services_title || "What we do.";
  $("svc-note").textContent = svcs.some((x) => x.price) ? "Prices up front. Book right here." : "Tell us what you need. We'll get you a price fast.";
  $("svc").innerHTML = svcs.length
    ? svcs.map((x) => `<a class="card rv" href="#book" data-pick="${esc(x.name)}"><div class="row"><h3>${esc(x.name)}</h3><span class="cost">${esc(x.price || "Free quote")}</span></div>${x.blurb ? `<p>${esc(x.blurb)}</p>` : ""}<span class="go">${esc(cta)} →</span></a>`).join("")
    : `<div class="card"><p>Your services and prices go here.</p></div>`;
  $("service").innerHTML = svcs.map((x) => `<option>${esc(x.name)}</option>`).join("") + "<option>Something else</option>";

  // Gallery
  const photos = (s.photos || []).filter(Boolean);
  $("work-note").textContent = photos.length ? `From ${d.business}.` : "";
  $("gallery").innerHTML = (photos.length ? photos : [null, null, null]).slice(0, 9).map((p, i) =>
    p ? `<button class="shot rv" type="button" data-i="${i}"><img loading="lazy" src="${esc(p)}" alt="${esc(d.business)} photo ${i + 1}" /></button>` : `<div class="shot empty">Your best job photo here</div>`).join("");

  // Reviews
  $("rev-title").textContent = d.reviews ? `${Number(d.reviews).toLocaleString()} reviews. ${Number(d.rating).toFixed(1)} stars.` : "What customers say.";
  const revs = s.reviews || [];
  $("rev").innerHTML = revs.length
    ? revs.slice(0, 6).map((r) => `<div class="card rv"><span class="stars">★★★★★</span><p>“${esc(r.q)}”</p><cite>${esc(r.who || "Google review")}</cite></div>`).join("")
    : `<div class="card rv"><p>Your best Google reviews show here, pulled in automatically.</p></div>`;
  $("topics").innerHTML = (s.topics || []).slice(0, 10).map((t) => `<span>${esc(t)}</span>`).join("");

  // Steps, areas, FAQ, footer
  $("steps").innerHTML = (s.steps || trade.steps).map(([h, p]) => `<div class="step rv"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join("");
  const towns = s.towns?.length ? s.towns : [town.split(",")[0]].filter(Boolean);
  $("areas-title").textContent = `${towns[0] || town} & nearby.`;
  const pills = towns.map((t) => `<span>${esc(t)}</span>`).join("");
  $("areas-1").innerHTML = pills + pills;
  $("areas-2").innerHTML = [...towns].reverse().map((t) => `<span>${esc(t)}</span>`).join("").repeat(2);
  $("book-eyebrow").textContent = cta;
  $("book-title").textContent = s.book_title || "Let's get you on the calendar.";
  $("book-lead").textContent = s.book_lead || "Send a request and we'll text you back fast. Prefer to talk? Just call.";
  const faq = s.faq?.length ? s.faq : [[`Where are you?`, s.address || `${town}. We serve the towns nearby too.`], ["How do I book?", `Tap “${cta}” or call us.`]];
  $("faq-list").innerHTML = faq.map(([q, a]) => `<details class="rv"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");
  $("foot-big").innerHTML = `Ready?<br><span>${esc(cta)}.</span>`;
  $("foot-cols").innerHTML = `<div><b>${esc(d.business)}</b><br>${esc(s.address || town)}<br>${tel ? `<a href="tel:${tel}">${esc(d.phone)}</a>` : ""}</div><div><b>Services</b><br>${svcs.slice(0, 4).map((x) => esc(x.name)).join("<br>")}</div><div><b>Areas</b><br>${towns.slice(0, 4).map(esc).join("<br>")}</div>`;
  $("notes-list").innerHTML = (s.improve?.length ? s.improve : ["Built to show up on Google for the searches your customers make."])
    .concat(["Every photo, review and fact here comes from your Google listing. We confirm the rest with you."])
    .map((x) => `<li>${esc(x)}</li>`).join("");
  return photos;
}

// ── Motion, story mode, sheet, full-screen photos (same as the MCM build) ──
function wire(photos) {
  const main = document.querySelector("main");
  const isStory = () => html.classList.contains("story");
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))), { threshold: 0.15 });
  document.querySelectorAll(".rv").forEach((el, i) => { el.style.transitionDelay = (i % 4) * 90 + "ms"; io.observe(el); });

  const plx = $("plx");
  let tick = false;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const move = () => { tick = false; const r = plx.parentElement.getBoundingClientRect(); plx.style.transform = `translate3d(0,${((r.top + r.height / 2 - innerHeight / 2) * -0.28).toFixed(1)}px,0)`; };
  const onScroll = () => { if (!tick && !still) { tick = true; requestAnimationFrame(move); } };
  addEventListener("scroll", onScroll, { passive: true });
  main.addEventListener("scroll", onScroll, { passive: true });

  const service = $("service");
  const form = document.querySelector("form[data-demo]");
  const formHome = form.parentElement;
  const sheet = document.querySelector(".sheet");
  const openSheet = () => { sheet.querySelector(".sheet-card").appendChild(form); sheet.hidden = false; };
  const closeSheet = () => { sheet.hidden = true; formHome.appendChild(form); };
  sheet.querySelector(".x").onclick = closeSheet;
  sheet.onclick = (e) => e.target === sheet && closeSheet();
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-pick],[data-sheet],a[href='#book']");
    if (!a) return;
    if (a.dataset.pick) service.value = a.dataset.pick;
    if (isStory()) { e.preventDefault(); openSheet(); }
  });
  form.onsubmit = (e) => { e.preventDefault(); toast(); };

  const lb = document.querySelector(".lb");
  const lbImg = lb.querySelector("img");
  let at = 0;
  const show = (i) => { at = (i + photos.length) % photos.length; lbImg.src = photos[at]; lb.querySelector(".cap").textContent = `${at + 1} / ${photos.length}`; };
  $("gallery").addEventListener("click", (e) => { const b = e.target.closest(".shot[data-i]"); if (b) { show(+b.dataset.i); lb.hidden = false; } });
  lb.querySelector(".x").onclick = () => (lb.hidden = true);
  lb.querySelector(".prev").onclick = () => show(at - 1);
  lb.querySelector(".next").onclick = () => show(at + 1);
  lb.onclick = (e) => e.target === lb && (lb.hidden = true);
  addEventListener("keydown", (e) => { if (lb.hidden) return; if (e.key === "Escape") lb.hidden = true; if (e.key === "ArrowLeft") show(at - 1); if (e.key === "ArrowRight") show(at + 1); });
  let x0 = null;
  lb.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  lb.addEventListener("touchend", (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(at + (dx < 0 ? 1 : -1)); x0 = null; });

  const modeBtn = $("mode");
  const notes = $("notes");
  const notesHome = notes.nextElementSibling;
  let loopIO = null;
  function setMode(story, remember) {
    html.classList.toggle("story", story);
    modeBtn.textContent = story ? "Classic mode" : "Story mode";
    main.querySelector(".loop")?.remove();
    loopIO?.disconnect();
    if (story) {
      main.appendChild(notes);
      const clone = main.querySelector(".hero").cloneNode(true);
      clone.classList.add("loop");
      clone.setAttribute("aria-hidden", "true");
      main.appendChild(clone);
      loopIO = new IntersectionObserver((en) => en[0].intersectionRatio > 0.9 && (main.scrollTop = 0), { root: main, threshold: [0.9] });
      loopIO.observe(clone);
      main.scrollTop = 0;
    } else {
      closeSheet();
      document.body.insertBefore(notes, notesHome);
    }
    if (remember) try { localStorage.setItem("site-mode", story ? "story" : "classic"); } catch {}
    onScroll();
  }
  modeBtn.onclick = () => setMode(!isStory(), true);
  const narrow = matchMedia("(max-width: 767px)");
  narrow.addEventListener("change", () => { try { localStorage.removeItem("site-mode"); } catch {} setMode(narrow.matches, false); });
  setMode(isStory(), false);
}

(async () => {
  try {
    const res = await fetch(`/api/site-data?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error();
    const d = await res.json();
    wire(render(d));
    $("loading").hidden = true;
  } catch {
    $("loading").textContent = "This preview isn't ready yet.";
  }
})();
