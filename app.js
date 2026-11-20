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

const state = {
user: null,
tasks: [],
view: "home",
referralCount: 0
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
window.open(url, "_blank", "noopener,noreferrer");
}
} catch (_) {
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

$("greeting").textContent = `Welcome, ${name}`;
}

// DAILY CHECK-IN
function setCheckin(canClaim, reward, message) {
$("checkin-btn").disabled = !canClaim;

$("checkin-btn").textContent = canClaim
? `Claim ${fmt(reward)} ZYRO`
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
info.innerHTML = "<strong></strong><small></small>";

info.querySelector("strong").textContent = task.title;
info.querySelector("small").textContent =
`Reward: ${fmt(task.reward)} ZYRO`;

const btn = document.createElement("button");
btn.className = "row-action";

btn.textContent = task.completed
? "Completed"
: task.task_type === "telegram_join"
? "Open channel"
: "Open task";

btn.disabled = !!task.completed;

let opened = false;

btn.onclick = async () => {
if (
task.task_type === "telegram_join" &&
!opened
) {
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

if (task.task_type === "telegram_join") {
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
btn.textContent = "Completed";

notice(`+${fmt(result.reward)} ZYRO added.`);
} catch (error) {
btn.disabled = false;
btn.textContent = "Verify membership";
notice(error.message);
}

return;
}

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
? `https://t.me/${BOT_USERNAME}?startapp=ref_${state.user.referral_code}`
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

// LEADERBOARD PAGE - TOP 100
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
rank <= 3 ? `TOP ${rank}` : `Rank #${rank}`;

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
? `@${state.user.username}`
: "Telegram member";

row.append(txt);
box.append(row);

const balance = document.createElement("div");
balance.className = "profile-info";
balance.innerHTML =
"<span>ZYRO Balance</span><strong></strong>";

balance.querySelector("strong").textContent =
`${fmt(state.user?.balance)} ZYRO`;

box.append(balance);

const referral = document.createElement("div");
referral.className = "profile-info";
referral.innerHTML =
"<span>Successful invites</span><strong></strong>";

referral.querySelector("strong").textContent =
state.referralCount;

box.append(referral);

const note = document.createElement("div");
note.className = "empty";

note.textContent =
"Your ZYRO balance is an internal app record. No blockchain transfers or withdrawals are available in this version.";

box.append(note);
}

// NAVIGATION BUTTONS
document.querySelectorAll(".nav-item").forEach((button) => {
button.addEventListener("click", () => {
activate(button.dataset.view);
});
});

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
