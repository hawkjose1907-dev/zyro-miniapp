const crypto = require("crypto");

function send(res, status, data) {
  res.status(status).setHeader("Content-Type","application/json; charset=utf-8").send(JSON.stringify(data));
}
function config() {
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bot=process.env.TELEGRAM_BOT_TOKEN;
  if(!url || !key || !bot) throw new Error("Server configuration is incomplete. Add SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and TELEGRAM_BOT_TOKEN in Vercel.");
  return {url:url.replace(/\/$/,""),key,bot};
}
function safeEqual(a,b) {
  const aa=Buffer.from(a,"hex"), bb=Buffer.from(b,"hex");
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
function verifyInitData(initData, botToken) {
  if(!initData) throw new Error("Open this app inside Telegram using @zyrominiappbot.");
  const params=new URLSearchParams(initData);
  const hash=params.get("hash");
  if(!hash) throw new Error("Telegram authentication data is missing.");
  const pairs=[];
  for(const [k,v] of params.entries()) if(k!=="hash") pairs.push(`${k}=${v}`);
  pairs.sort();
  const secret=crypto.createHmac("sha256","WebAppData").update(botToken).digest();
  const calculated=crypto.createHmac("sha256",secret).update(pairs.join("\n")).digest("hex");
  if(!safeEqual(calculated,hash)) throw new Error("Telegram authentication could not be verified.");
  const authDate=Number(params.get("auth_date")||0);
  if(!authDate || Math.floor(Date.now()/1000)-authDate>86400) throw new Error("Telegram session expired. Reopen the app.");
  let user;
  try{user=JSON.parse(params.get("user")||"{}");}catch(_){throw new Error("Invalid Telegram user data.");}
  if(!user.id) throw new Error("Telegram user information is missing.");
  return {user,startParam:params.get("start_param")||""};
}
function getInitData(req) {
  if(req.headers["x-telegram-init-data"]) return req.headers["x-telegram-init-data"];
  return req.body?.initData || "";
}
async function db(path, options={}) {
  const {url,key}=config();
  const response=await fetch(`${url}/rest/v1/${path}`,{
    method:options.method||"GET",
    headers:{
      apikey:key,Authorization:`Bearer ${key}`,
      "Content-Type":"application/json",
      Prefer:options.prefer||"return=representation",
      ...(options.headers||{})
    },
    body:options.body===undefined?undefined:JSON.stringify(options.body)
  });
  const text=await response.text();
  let data;try{data=text?JSON.parse(text):null;}catch(_){data=text;}
  if(!response.ok) throw new Error(data?.message||data?.hint||`Database request failed (${response.status}).`);
  return data;
}
async function telegram(req) {
  const {bot}=config();
  return verifyInitData(getInitData(req),bot);
}
async function ensureUser(req) {
  const {user,startParam:verifiedStartParam}=await telegram(req);
  const startParam=verifiedStartParam || req.body?.startParam || "";
  const tid=String(user.id);
  let rows=await db(`zyro_users?telegram_id=eq.${encodeURIComponent(tid)}&select=*`);
  if(!rows.length){
    let inviter=null;
    const code=startParam.startsWith("ref_")?startParam.slice(4):"";
    if(code){
      const found=await db(`zyro_users?referral_code=eq.${encodeURIComponent(code)}&select=id,telegram_id&limit=1`);
      if(found.length && found[0].telegram_id!==tid) inviter=found[0];
    }
    const referralCode=crypto.randomBytes(5).toString("hex").toUpperCase();
    const created=await db("zyro_users",{method:"POST",body:{
      telegram_id:tid,username:user.username||null,first_name:user.first_name||null,
      photo_url:user.photo_url||null,referral_code:referralCode,
      referred_by:inviter?inviter.telegram_id:null
    }});
    rows=created;
    if(inviter && created[0]){
      await db("zyro_referrals",{method:"POST",prefer:"return=minimal",body:{
        inviter_id:inviter.id,invited_id:created[0].id,reward:0
      }}).catch(()=>{});
    }
  } else {
    rows=await db(`zyro_users?id=eq.${encodeURIComponent(rows[0].id)}`,{method:"PATCH",body:{
      username:user.username||null,first_name:user.first_name||null,photo_url:user.photo_url||null,last_seen_at:new Date().toISOString()
    }});
    if(!rows.length) rows=await db(`zyro_users?telegram_id=eq.${encodeURIComponent(tid)}&select=*`);
  }
  if(!rows[0]) throw new Error("Could not create or load your ZYRO profile.");
  return rows[0];
}
function error(res,e) {
  const msg=e?.message||"Unexpected server error.";
  const status=/Telegram|session|Open this app|authentication/i.test(msg)?401:500;
  return send(res,status,{error:msg});
}
module.exports={send,config,db,telegram,ensureUser,error};
