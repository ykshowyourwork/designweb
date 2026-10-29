// The "set your password" page. The link in the email lands here with a one-time token after the #.
import { post, save } from "./session.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.hash.slice(1));
const token = params.get("access_token");
if (!token) $("msg").textContent = params.get("error_description") || "This link is missing its code. Ask for a new one from the sign-in page.";

$("set").addEventListener("submit", async (e) => {
  e.preventDefault();
  if ($("pw").value !== $("pw2").value) return ($("msg").textContent = "Those don’t match.");
  try {
    save(await post({ token, password: $("pw").value }));
    history.replaceState(null, "", "/admin/reset");
    location.href = "/admin";
  } catch (err) {
    $("msg").textContent = err.message;
  }
});
