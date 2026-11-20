(() => {
const tg = window.Telegram?.WebApp;

try {
tg?.ready();
tg?.expand();
tg?.setHeaderColor?.("#080b12");
tg?.setBackgroundColor?.("#080b12");
} catch (_) {}

const $ = (id) => document.getElementById(id);

const BOT_USERNAME = "zyrominiappbot";

const TON_MANIFEST =
"https://zyro-miniapp.vercel.app/tonconnect-manifest.json";

const state = {
user: null,
tasks: [],
view: "home",
referralCount: 0,
tonWallet: null,
tonUI: null,
tonInitStarted: false
};

const initData = tg?.initData || "";

const startParam =
tg?.initDataUnsafe?.start_param ||
new URLSearchParams(location.search).get("ref") ||
"";

const notice = (msg) => {
const el = $("notice");
if (el) el.textContent = msg || "";
};

const fmt = (n) =>
Number(n || 0).toLocaleString(undefined, {
maximumFractionDigits: 4
});

// API REQUEST
async function api(path, body = {}) {
const res = await fetch(path, {
method: "POST",
headers: {
"Content-Type": "application/json",
"X-Telegram-Init-Data": initData
},
body: JSON.stringify(body)
});

const data = await res.json().catch(() => ({
error: "Invalid server response"
}));

if (!res.ok) {
throw new Error(data.error || "Request failed");
}

return data;
}

// OPEN TELEGRAM CHANNEL OR EXTERNAL LINK
function openTaskLink(url) {
if (!url) {
notice("Task link is not available.");
return;
}

try {
if (url.includes("t.me/") && tg?.openTelegramLink) {
tg.openTelegramLink(url);
} else if (tg?.openLink) {
tg.openLink(url);
} else {
window.open(url, "blank", "noopener,noreferrer");
}
} catch () {
window.location.href = url;
}
}

// BALANCE
function setBalance(value) {
$("balance").textContent = fmt(value);
}

// USER
function setUser(user) {
state.user = user;

setBalance(user.balance);

const name =
user.first_name ||
"ZYRO member";

$("greeting").textContent = "Welcome, ${name}";
}

// DAILY CHECK-IN
function setCheckin(canClaim, reward, message) {
$("checkin-btn").disabled = !canClaim;

$("checkin-btn").textContent = canClaim
? "Claim ${fmt(reward)} ZYRO"
: "Claimed";

$("checkin-copy").textContent =
message ||
(canClaim
? "Your daily reward is ready."
: "Your next daily reward will be available tomorrow.");
}

// PAGE NAVIGATION
function activate(view) {
const allowedViews = [
"home",
"tasks",
"friends",
"leaderboard",
"profile"
];

if (!allowedViews.includes(view)) {
view = "home";
}

state.view = view;

const home = $("home-view");
const box = $("content-view");

document.querySelectorAll(".nav-item").forEach((button) => {
button.classList.toggle(
"active",
button.dataset.view === view
);
});

if (view === "home") {
home.hidden = false;
box.hidden = true;

window.scrollTo({
  top: 0,
  behavior: "smooth"
});

return;

}

home.hidden = true;
box.hidden = false;

if (view === "tasks") renderTasks();
if (view === "friends") renderFriends();
if (view === "leaderboard") renderLeaderboard();
if (view === "profile") renderProfile();

window.scrollTo({
top: 0,
behavior: "smooth"
});
}

// TELEGRAM ICON
const telegramIcon = "<svg viewBox="0 0 48 48" width="38" height="38" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"> <circle cx="24" cy="24" r="24" fill="#229ED9"/> <path d="M36.8 13.1 32.4 34c-.3 1.5-1.2 1.9-2.4 1.2l-7-5.2-3.4 3.3c-.4.4-.7.7-1.4.7l.5-7.1 13-11.7c.6-.5-.1-.8-.9-.3L14.7 25.1l-6.9-2.2c-1.5-.5-1.5-1.5.3-2.2l27-10.4c1.2-.4 2.2.3 1.7 2.8Z" fill="#FFFFFF"/> </svg>";

// X ICON
const xIcon = "<svg viewBox="0 0 48 48" width="38" height="38" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"> <rect width="48" height="48" rx="12" fill="#000000"/> <path d="M27.4 21.8 38.1 9h-3.8l-8.6 10.3L18.8 9H8l11.2 16.3L8 39h3.8l9.2-11 7.7 11H40L27.4 21.8Zm-4.1 4.9-1.1-1.6-8.5-12.1h3.4l6.8 9.7 1.1 1.6 8.9 12.7h-3.4l-7.2-10.3Z" fill="#FFFFFF"/> </svg>";

// TASKS PAGE
function renderTasks() {
const box = $("content-view");

box.innerHTML = "<h3>Available Tasks</h3>";

if (!state.tasks.length) {
box.insertAdjacentHTML(
"beforeend",
'<div class="empty">There are no active tasks yet. Please check back later.</div>'
);
return;
}

state.tasks.forEach((task) => {
const row = document.createElement("div");
row.className = "list-row";

const info = document.createElement("div");

if (
  task.task_type === "telegram_join" ||
  task.task_type === "x_follow"
) {
  info.style.display = "flex";
  info.style.alignItems = "center";
  info.style.gap = "12px";

  const icon = document.createElement("div");

  icon.innerHTML =
    task.task_type === "telegram_join"
      ? telegramIcon
      : xIcon;

  icon.style.width = "38px";
  icon.style.height = "38px";
  icon.style.flexShrink = "0";

  const textInfo = document.createElement("div");
  textInfo.innerHTML = "<strong></strong><small></small>";

  textInfo.querySelector("strong").textContent = task.title;
  textInfo.querySelector("small").textContent =
    `Reward: ${fmt(task.reward)} ZYRO`;

  info.append(icon, textInfo);

} else {
  info.innerHTML = "<strong></strong><small></small>";

  info.querySelector("strong").textContent = task.title;
  info.querySelector("small").textContent =
    `Reward: ${fmt(task.reward)} ZYRO`;
}

const btn = document.createElement("button");
btn.className = "row-action";

let opened = false;

if (task.completed) {
  btn.textContent = "Completed ✓";
  btn.disabled = true;

} else if (task.task_type === "telegram_join") {
  btn.textContent = "Open channel";

} else if (task.task_type === "x_follow") {
  btn.textContent = "Follow on X";

} else {
  btn.textContent = "Open task";
}

btn.onclick = async () => {

  if (task.completed) return;

  // TELEGRAM TASK
  if (task.task_type === "telegram_join") {

    if (!opened) {
      if (!task.task_url) {
        notice("Channel link is missing.");
        return;
      }

      openTaskLink(task.task_url);
      opened = true;

      btn.textContent = "Verify membership";
      notice("Join the channel, then tap Verify membership.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Checking…";

    try {
      const result = await api("/api/complete-task", {
        taskId: task.id
      });

      setBalance(result.balance);

      if (state.user) {
        state.user.balance = result.balance;
      }

      task.completed = true;
      btn.textContent = "Completed ✓";

      notice(`+${fmt(result.reward)} ZYRO added.`);

    } catch (error) {
      btn.disabled = false;
      btn.textContent = "Verify membership";
      notice(error.message);
    }

    return;
  }

  // X TASK
  if (task.task_type === "x_follow") {

    if (!opened) {
      openTaskLink(task.task_url);

      opened = true;
      btn.textContent = "Claim 100 ZYRO";

      notice("You can now claim your X task reward.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Claiming…";

    try {
      const result = await api("/api/complete-task", {
        taskId: task.id
      });

      setBalance(result.balance);

      if (state.user) {
        state.user.balance = result.balance;
      }

      task.completed = true;

      btn.textContent = "Completed ✓";

      notice(`+${fmt(result.reward)} ZYRO added to your balance.`);

    } catch (error) {
      btn.disabled = false;
      btn.textContent = "Claim 100 ZYRO";
      notice(error.message);
    }

    return;
  }

  // OTHER TASKS
  if (task.task_url) {
    openTaskLink(task.task_url);
  } else {
    notice("Task link is not available.");
  }
};

row.append(info, btn);
box.append(row);

});
}

// FRIENDS PAGE
function renderFriends() {
const box = $("content-view");

box.innerHTML = "<h3>Invite Friends</h3>";

const link = state.user?.referral_code
? "https://t.me/${BOT_USERNAME}?startapp=ref_${state.user.referral_code}"
: "";

const description = document.createElement("p");
description.className = "empty";
description.textContent =
"Invite your friends and grow the ZYRO community.";

box.append(description);

const row = document.createElement("div");
row.className = "list-row";

const info = document.createElement("div");
info.innerHTML = "<strong>Your invite link</strong><small></small>";

info.querySelector("small").textContent =
link || "Not available";

const btn = document.createElement("button");
btn.className = "row-action";
btn.textContent = "Share";

btn.onclick = async () => {
if (!link) {
notice("Invite link is not available.");
return;
}

const text = "Join me on ZYRO! 🚀";

const shareUrl =
  `https://t.me/share/url?url=${encodeURIComponent(link)}` +
  `&text=${encodeURIComponent(text)}`;

try {
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(shareUrl);
    notice("Choose a Telegram chat to share ZYRO.");
    return;
  }

  if (navigator.share) {
    await navigator.share({
      title: "Join ZYRO",
      text,
      url: link
    });

    notice("Share completed.");
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(link);
    notice("Invite link copied!");
    return;
  }

  const input = document.createElement("textarea");
  input.value = link;
  input.style.position = "fixed";
  input.style.opacity = "0";

  document.body.appendChild(input);
  input.select();

  const copied = document.execCommand("copy");
  input.remove();

  notice(
    copied
      ? "Invite link copied!"
      : "Please copy your invite link manually."
  );

} catch (error) {
  if (error.name === "AbortError") return;

  try {
    await navigator.clipboard.writeText(link);
    notice("Invite link copied!");
  } catch (_) {
    notice("Unable to share. Please copy your invite link.");
  }
}

};

row.append(info, btn);
box.append(row);

const count = document.createElement("div");
count.className = "profile-info";

const label = document.createElement("span");
label.textContent = "Successful invites";

const value = document.createElement("strong");
value.textContent = state.referralCount;

count.append(label, value);
box.append(count);

const rewardInfo = document.createElement("div");
rewardInfo.className = "empty";
rewardInfo.textContent =
"Earn 100 ZYRO for every friend who completes their first daily check-in.";

box.append(rewardInfo);
}

// LEADERBOARD PAGE
async function renderLeaderboard() {
const box = $("content-view");

box.innerHTML =
"<h3>🏆 Top 100 ZYRO</h3>" +
'<div class="empty">Loading rankings…</div>';

try {
const data = await api("/api/leaderboard");

box.innerHTML = "<h3>🏆 Top 100 ZYRO</h3>";

const members = (data.members || []).slice(0, 100);

if (!members.length) {
  box.insertAdjacentHTML(
    "beforeend",
    '<div class="empty">No members yet.</div>'
  );
  return;
}

members.forEach((member, index) => {
  const rank = index + 1;

  const row = document.createElement("div");
  row.className = "list-row";

  if (rank <= 3) {
    row.classList.add("top-rank");
  }

  row.innerHTML =
    '<div class="rank-user">' +
    '<span class="rank-medal"></span>' +
    '<div><strong></strong><small></small></div>' +
    '</div>' +
    '<strong class="rank-balance"></strong>';

  const medal = row.querySelector(".rank-medal");

  if (rank === 1) medal.textContent = "🥇";
  else if (rank === 2) medal.textContent = "🥈";
  else if (rank === 3) medal.textContent = "🥉";
  else medal.textContent = `#${rank}`;

  row.querySelector(".rank-user div strong").textContent =
    member.first_name || "ZYRO member";

  row.querySelector(".rank-user div small").textContent =
    rank <= 3 ? "" : `Rank #${rank}`;

  row.querySelector(".rank-balance").textContent =
    `${fmt(member.balance)} ZYRO`;

  box.append(row);
});

} catch (error) {
box.innerHTML = "<h3>🏆 Top 100 ZYRO</h3>";

const message = document.createElement("div");
message.className = "empty";
message.textContent = error.message;

box.append(message);

}
}

// SHORTEN WALLET ADDRESS
function shortenAddress(address) {
if (!address) return "";

if (address.length <= 16) {
return address;
}

return (
address.substring(0, 6) +
"..." +
address.substring(address.length - 6)
);
}

// UPDATE HEADER WALLET BUTTON
function updateHeaderWalletButton() {
const button = $("ton-header-button");
const label = $("ton-header-label");

if (!button || !label) return;

const wallet =
state.tonWallet ||
state.tonUI?.wallet ||
null;

const address = wallet?.account?.address;

if (address) {
label.textContent = shortenAddress(address);
button.classList.add("wallet-connected");
button.title = address;
button.setAttribute(
"aria-label",
"Connected TON wallet ${address}. Tap to disconnect."
);
} else {
label.textContent = "CONNECT";
button.classList.remove("wallet-connected");
button.title = "Connect TON Wallet";
button.setAttribute(
"aria-label",
"Connect TON Wallet"
);
}
}

// TON CONNECT: INITIALIZE ONCE
function initializeTonConnect() {
if (state.tonUI) {
return state.tonUI;
}

if (state.tonInitStarted) {
return null;
}

state.tonInitStarted = true;

const tonLibrary = window.TON_CONNECT_UI;

if (!tonLibrary?.TonConnectUI) {
console.error("TON Connect library is not available.");
notice("TON Connect could not be loaded. Please refresh the app.");
return null;
}

try {
state.tonUI = new tonLibrary.TonConnectUI({
manifestUrl: TON_MANIFEST,
uiPreferences: {
theme: "DARK",
borderRadius: "m"
}
});

state.tonUI.onStatusChange(
  (wallet) => {
    state.tonWallet = wallet || null;
    updateHeaderWalletButton();
  },
  (error) => {
    console.error("TON Connect error:", error);
    notice("TON wallet connection error. Please try again.");
  }
);

state.tonUI.connectionRestored
  .then(() => {
    state.tonWallet = state.tonUI?.wallet || null;
    updateHeaderWalletButton();
  })
  .catch((error) => {
    console.error("TON connection restore error:", error);
  });

return state.tonUI;

} catch (error) {
console.error("TON Connect initialization failed:", error);
notice("TON Connect initialization failed.");
return null;
}
}

// HEADER WALLET BUTTON ACTION
async function handleHeaderWalletClick() {
const button = $("ton-header-button");

if (!button) return;

const ui = initializeTonConnect();

if (!ui) {
notice("TON Connect could not be loaded. Please refresh the app.");
return;
}

const wallet =
state.tonWallet ||
ui.wallet ||
null;

button.disabled = true;

try {
if (wallet?.account?.address) {
button.classList.add("wallet-loading");

  await ui.disconnect();

  state.tonWallet = null;
  updateHeaderWalletButton();

  notice("TON wallet disconnected.");

} else {
  button.classList.add("wallet-loading");

  await ui.openModal();
}

} catch (error) {
console.error("TON wallet action failed:", error);
notice(error.message || "Unable to connect TON wallet.");

} finally {
button.disabled = false;
button.classList.remove("wallet-loading");
updateHeaderWalletButton();
}
}

// PROFILE PAGE
function renderProfile() {
const box = $("content-view");

box.innerHTML = "<h3>Your Profile</h3>";

const row = document.createElement("div");
row.className = "profile-line";

if (state.user?.photo_url) {
const img = document.createElement("img");
img.className = "avatar";
img.src = state.user.photo_url;
img.alt = "Profile";

row.append(img);

}

const txt = document.createElement("div");
txt.innerHTML = "<strong></strong><small></small>";

txt.querySelector("strong").textContent =
state.user?.first_name || "ZYRO member";

txt.querySelector("small").textContent =
state.user?.username
? "@${state.user.username}"
: "Telegram member";

row.append(txt);
box.append(row);

const balance = document.createElement("div");
balance.className = "profile-info";
balance.innerHTML =
"<span>ZYRO Balance</span><strong></strong>";

balance.querySelector("strong").textContent =
"${fmt(state.user?.balance)} ZYRO";

box.append(balance);

const referral = document.createElement("div");
referral.className = "profile-info";
referral.innerHTML =
"<span>Successful invites</span><strong></strong>";

referral.querySelector("strong").textContent =
state.referralCount;

box.append(referral);
}

// NAVIGATION BUTTONS
document.querySelectorAll(".nav-item").forEach((button) => {
button.addEventListener("click", () => {
activate(button.dataset.view);
});
});

// HEADER WALLET BUTTON
$("ton-header-button")?.addEventListener(
"click",
handleHeaderWalletClick
);

// INITIAL HEADER STATE
updateHeaderWalletButton();

// DAILY REWARD BUTTON
$("checkin-btn").addEventListener("click", async () => {
$("checkin-btn").disabled = true;
notice("Processing your daily reward…");

try {
const data = await api("/api/checkin");

setBalance(data.balance);

if (state.user) {
  state.user.balance = data.balance;
}

setCheckin(
  false,
  0,
  "Your daily reward has been added."
);

let message =
  `+${fmt(data.reward)} ZYRO added to your balance.`;

if (Number(data.referral_reward) > 0) {
  message += " Your inviter received 100 ZYRO!";
}

notice(message);

} catch (error) {
notice(error.message);
$("checkin-btn").disabled = false;
}
});

// INITIALIZE APP
async function boot() {
// Restore any previously connected TON wallet.
initializeTonConnect();

if (!initData) {
$("greeting").textContent =
"Open ZYRO in Telegram";

setCheckin(
  false,
  0,
  "Please launch this app from @zyrominiappbot in Telegram."
);

notice("Telegram authentication is required.");
return;

}

try {
const data = await api("/api/me", {
startParam
});

setUser(data.user);

state.tasks = data.tasks || [];
state.referralCount = data.referralCount || 0;

setCheckin(
  data.canClaimDaily,
  data.dailyReward,
  data.canClaimDaily
    ? "Your daily reward is ready."
    : "You have already checked in today."
);

activate("home");

} catch (error) {
notice(error.message);

$("greeting").textContent =
  "Unable to load your account";

setCheckin(
  false,
  0,
  "Please try again later."
);

}
}

// START APP AND HIDE SPLASH
boot();

setTimeout(() => {
$("zyro-splash")?.classList.add("hide");
}, 2000);

})();
