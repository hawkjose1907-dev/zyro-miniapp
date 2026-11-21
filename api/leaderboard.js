const {send,config,ensureUser,db,error}=require("../lib/server");
module.exports=async(req,res)=>{
  if(req.method!=="POST") return send(res,405,{error:"Method not allowed."});
  try{
    config(); await ensureUser(req);
    const members=await db("zyro_users?select=username,first_name,balance&order=balance.desc&limit=20");
    return send(res,200,{members});
  }catch(e){return error(res,e);}
};
