const {send,config,db,ensureUser,error}=require("../lib/server");

module.exports=async(req,res)=>{
  if(req.method!=="POST")
    return send(res,405,{error:"Method not allowed."});

  try{
    config();

    const user=await ensureUser(req);

    const [tasks,completed,referrals,daily]=await Promise.all([
      db("zyro_tasks?is_active=eq.true&select=id,title,description,reward,task_type,task_url&order=created_at.asc"),

      db(`zyro_completed_tasks?user_id=eq.${encodeURIComponent(user.id)}&select=task_id`),

      db(`zyro_referrals?inviter_id=eq.${encodeURIComponent(user.id)}&select=id`),

      db(`zyro_daily_rewards?user_id=eq.${encodeURIComponent(user.id)}&select=claimed_at&order=claimed_at.desc&limit=1`)
    ]);

    const done=new Set(completed.map(x=>x.task_id));

    const reward=Number(process.env.ZYRO_DAILY_REWARD||0);

    const serverNow=Date.now();

    const lastClaim=daily[0]?.claimed_at
      ? new Date(daily[0].claimed_at).getTime()
      : 0;

    const nextClaimAt=lastClaim
      ? lastClaim+(24*60*60*1000)
      : null;

    const canClaimDaily=
      reward>0 &&
      (!nextClaimAt || serverNow>=nextClaimAt);

    return send(res,200,{
      user,
      tasks:tasks.map(t=>({...t,completed:done.has(t.id)})),
      referralCount:referrals.length,
      canClaimDaily,
      dailyReward:reward,
      nextClaimAt,
      serverNow
    });

  }catch(e){
    return error(res,e);
  }
};
