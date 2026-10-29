// Owner sign-in shared by /admin and /admin/network. Remembers the session on
// this device and quietly renews it, so you sign in once.
const KEY = "desiweb-session";
const $ = (id) => document.getElementById(id);

let s = null;
try {
  s = JSON.parse(localStorage.getItem(KEY) || "null");
} catch {
  /* private window: sign in each visit */
}
const save = (v) => {
  s = v;
  try {
    v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY);
  } catch {
    /* fine */
  }
};

async function post(body) {
  const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong."), { status: res.status });
  return data;
}

async function renew() {
  if (!s?.refresh) throw Object.assign(new Error("Please sign in."), { status: 401 });
  try {
    save(await post({ refresh: s.refresh }));
  } catch (e) {
    save(null);
    throw e;
  }
}

/** fetch() for the owner APIs: adds the sign-in, renews it once if it ran out. */
export async function api(url, method, body) {
  if (s && s.expiresAt && s.expiresAt * 1000 < Date.now() + 60_000) await renew();
  const go = () =>
    fetch(url, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${s?.token ?? ""}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  let res = await go();
  if (res.status === 401 && s?.refresh) {
    await renew();
    res = await go();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong."), { status: res.status });
  return data;
}

/** Wires the #login form. onReady loads the page; it runs right away if already signed in.
 *  Only a sign-in problem (401) brings the form back. Anything else stays signed in and shows on the page. */
export function signIn(onReady) {
  const html = document.documentElement;
  const note = (text) => {
    let p = $("panel-msg");
    if (!p) {
      p = Object.assign(document.createElement("p"), { id: "panel-msg", className: "msg err", role: "alert" });
      $("panel").prepend(p);
    }
    p.textContent = text;
    p.hidden = !text;
  };
  const askToSignIn = (text) => {
    html.classList.remove("signed");
    $("login").hidden = false;
    $("panel").hidden = true;
    $("login-msg").textContent = text;
  };
  const show = async () => {
    $("login").hidden = true;
    $("panel").hidden = false;
    $("signout")?.removeAttribute("hidden");
    try {
      await onReady();
      note("");
    } catch (e) {
      if (e.status === 401) askToSignIn("Please sign in.");
      else note(e.message);
    }
  };
  $("login").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("login-msg").textContent = "";
    try {
      save(await post({ email: $("email").value, password: $("pw").value }));
      $("pw").value = "";
      html.classList.add("signed");
      show();
    } catch (err) {
      $("login-msg").textContent = err.message;
    }
  });
  $("signout")?.addEventListener("click", () => {
    save(null);
    location.reload();
  });
  if (s) show();
  else askToSignIn("");
}
