-- Run this once in Supabase SQL Editor after the six ZYRO tables have been created.
-- The Vercel server uses the service-role key; never expose that key in browser code.

create or replace function public.zyro_claim_daily_reward(
  p_telegram_id text,
  p_reward numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.zyro_users%rowtype;
  v_claim_id uuid;
begin
  if p_reward is null or p_reward <= 0 then
    return jsonb_build_object('success', false, 'message', 'Daily reward is not configured.');
  end if;

  select * into v_user from public.zyro_users
  where telegram_id = p_telegram_id for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'User profile not found.');
  end if;

  insert into public.zyro_daily_rewards(user_id, reward, claim_date)
  values (v_user.id, p_reward, current_date)
  on conflict (user_id, claim_date) do nothing
  returning id into v_claim_id;

  if v_claim_id is null then
    return jsonb_build_object('success', false, 'message', 'You have already claimed today’s reward.');
  end if;

  update public.zyro_users
  set balance = coalesce(balance, 0) + p_reward, last_seen_at = now()
  where id = v_user.id;

  insert into public.zyro_transactions(user_id, amount, transaction_type, description)
  values (v_user.id, p_reward, 'daily_reward', 'Daily check-in reward');

  return jsonb_build_object('success', true, 'reward', p_reward);
end;
$$;

create or replace function public.zyro_complete_task(
  p_telegram_id text,
  p_task_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.zyro_users%rowtype;
  v_task public.zyro_tasks%rowtype;
  v_done_id uuid;
begin
  select * into v_user from public.zyro_users
  where telegram_id = p_telegram_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'User profile not found.');
  end if;

  select * into v_task from public.zyro_tasks
  where id = p_task_id and is_active = true;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Task not found.');
  end if;

  insert into public.zyro_completed_tasks(user_id, task_id)
  values (v_user.id, v_task.id)
  on conflict (user_id, task_id) do nothing
  returning id into v_done_id;

  if v_done_id is null then
    return jsonb_build_object('success', false, 'message', 'This task has already been completed.');
  end if;

  update public.zyro_users
  set balance = coalesce(balance, 0) + coalesce(v_task.reward, 0), last_seen_at = now()
  where id = v_user.id;

  insert into public.zyro_transactions(user_id, amount, transaction_type, description)
  values (v_user.id, coalesce(v_task.reward, 0), 'task_reward', 'Task: ' || v_task.title);

  return jsonb_build_object('success', true, 'reward', coalesce(v_task.reward, 0));
end;
$$;

revoke all on function public.zyro_claim_daily_reward(text,numeric) from public, anon, authenticated;
revoke all on function public.zyro_complete_task(text,uuid) from public, anon, authenticated;
grant execute on function public.zyro_claim_daily_reward(text,numeric) to service_role;
grant execute on function public.zyro_complete_task(text,uuid) to service_role;
