# ZYRO Mini App — V1 foundation

- ZYRO-branded dark interface using the supplied ZYRO logo.
- Telegram Mini App `initData` is validated server-side.
- Supabase is accessed only from Vercel serverless functions using the service-role secret.
- Daily check-in and Telegram channel task rewards use transactional SQL RPC functions.
- Referral links and referral counts are tracked; referral rewards are intentionally not issued until their rule/amount is confirmed.
- Telegram account creation date is not available from the standard Telegram Mini App user payload, so no unverified account-age claim is shown.
- No mining, presale, blockchain transfer, wallet connection, or withdrawals in V1.

## Setup

1. Keep the project root at the repository root in Vercel.
2. Add these Vercel Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (secret; server-side only)
   - `TELEGRAM_BOT_TOKEN` (secret)
   - `ZYRO_DAILY_REWARD` (set the amount after deciding the reward rule)
3. Run `database.sql` in Supabase SQL Editor.
4. Add Telegram channel tasks to `zyro_tasks` with `task_type = 'telegram_join'` and a public `task_url` such as `https://t.me/yourchannel`. The bot must be an administrator in the channel for reliable membership verification.
5. Configure @zyrobot as a Telegram Mini App and set its URL to the Vercel deployment URL.

## Notes

This is an initial functional foundation, not a finished production launch. Test with a private Telegram bot and test accounts first. Do not publish the Supabase service-role key or Telegram bot token in frontend code or GitHub.
