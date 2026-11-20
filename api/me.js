const {send,config,db,ensureUser,error}=require("../lib/server");
module.exports=async(req,res)=>{
  if(req.method!=="POST") return send(res,405,{error:"Method not allowed."});
  try{
    config();
    const user=await ensureUser(req);
    const [tasks,completed,referrals]=await Promise.all([
      db("zyro_tasks?is_active=eq.true&select=id,title,description,reward,task_type,task_url&order=created_at.asc"),
      db(`zyro_completed_tasks?user_id=eq.${encodeURIComponent(user.id)}&select=task_id`),
      db(`zyro_referrals?inviter_id=eq.${encodeURIComponent(user.id)}&select=id`)
    ]);
    const done=new Set(completed.map(x=>x.task_id));
    const daily=await db(`zyro_daily_rewards?user_id=eq.${encodeURIComponent(user.id)}&claim_date=eq.${new Date().toISOString().slice(0,10)}&select=id`);
    const reward=Number(process.env.ZYRO_DAILY_REWARD||0);
    return send(res,200,{user,tasks:tasks.map(t=>({...t,completed:done.has(t.id)})),referralCount:referrals.length,canClaimDaily:daily.length===0&&reward>0,dailyReward:reward});
  }catch(e){return error(res,e);}
};
