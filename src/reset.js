// The "set your password" page. The email link carries a one-time code; it is only used when you press Save.
import { post, save } from "./session.js";

const $ = (id) => document.getElementById(id);
const code = new URLSearchParams(location.search).get("code");
if (!code) $("msg").textContent = "This link is missing its code. Ask for a new one from the sign-in page.";

$("set").addEventListener("submit", async (e) => {
  e.preventDefault();
  if ($("pw").value !== $("pw2").value) return ($("msg").textContent = "Those don’t match.");
  try {
    save(await post({ code, password: $("pw").value }));
    history.replaceState(null, "", "/admin/reset");
    location.href = "/admin";
  } catch (err) {
    $("msg").textContent = err.message;
  }
});
