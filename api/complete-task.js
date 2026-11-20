const {send,config,db,ensureUser,error}=require("../lib/server");
module.exports=async(req,res)=>{
  if(req.method!=="POST") return send(res,405,{error:"Method not allowed."});
  try{
    const {bot}=config();
    const user=await ensureUser(req);
    const taskId=req.body?.taskId;
    if(!taskId) return send(res,400,{error:"Task ID is required."});
    const tasks=await db(`zyro_tasks?id=eq.${encodeURIComponent(taskId)}&is_active=eq.true&select=*`);
    const task=tasks[0]; if(!task) return send(res,404,{error:"Task not found."});
    if(task.task_type!=="telegram_join") return send(res,400,{error:"This task type does not support automatic verification yet."});
    const match=String(task.task_url||"").match(/t\.me\/([A-Za-z0-9_]+)/i);
    if(!match) return send(res,400,{error:"The Telegram task URL is invalid."});
    const chat=match[1].startsWith("@")?match[1]:"@"+match[1];
    const check=await fetch(`https://api.telegram.org/bot${bot}/getChatMember?chat_id=${encodeURIComponent(chat)}&user_id=${encodeURIComponent(user.telegram_id)}`);
    const status=await check.json();
    const member=status?.result;
    const valid=status.ok && member && (["creator","administrator","member"].includes(member.status)||(member.status==="restricted"&&member.is_member));
    if(!valid) return send(res,403,{error:"Join the Telegram channel first, then try again."});
    const result=await db("rpc/zyro_complete_task",{method:"POST",body:{p_telegram_id:user.telegram_id,p_task_id:task.id}});
    const item=Array.isArray(result)?result[0]:result;
    if(!item?.success) return send(res,409,{error:item?.message||"This task has already been completed."});
    const updated=await db(`zyro_users?telegram_id=eq.${encodeURIComponent(user.telegram_id)}&select=balance`);
    return send(res,200,{success:true,reward:item.reward,balance:updated[0]?.balance||0});
  }catch(e){return error(res,e);}
};
