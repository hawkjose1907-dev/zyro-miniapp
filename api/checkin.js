const {send,config,db,ensureUser,error}=require("../lib/server");
module.exports=async(req,res)=>{
  if(req.method!=="POST") return send(res,405,{error:"Method not allowed."});
  try{
    config();
    const user=await ensureUser(req);
    const reward=Number(process.env.ZYRO_DAILY_REWARD||0);
    if(!Number.isFinite(reward)||reward<=0) return send(res,409,{error:"Daily reward is not configured yet."});
    const result=await db("rpc/zyro_claim_daily_reward",{method:"POST",body:{p_telegram_id:user.telegram_id,p_reward:reward}});
    const item=Array.isArray(result)?result[0]:result;
    if(!item?.success) return send(res,409,{error:item?.message||"You have already claimed today's reward."});
    const updated=await db(`zyro_users?telegram_id=eq.${encodeURIComponent(user.telegram_id)}&select=balance`);
    return send(res,200,{success:true,reward,balance:updated[0]?.balance||0});
  }catch(e){return error(res,e);}
};
