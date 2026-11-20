# ZYRO Mini App — initial frontend package

Brand: ZYRO  
Telegram bot: @zyrobot

This is a GitHub-ready static frontend adaptation based on the supplied WAG website mirror. Presale pages and old verification pages have been excluded. The ZYRO mascot logo is installed.

## Important limitations
- This package is a frontend snapshot, not a complete working backend. The supplied archive did not include the original WAG server/API/database implementation.
- Telegram user authentication, account-age verification, rewards, tasks, referrals, and balance updates must be implemented and verified server-side before public launch.
- No blockchain, token withdrawals, presale, or mining are included in the initial ZYRO scope. ZYRO balances are intended to be off-chain database records.
- Review all remaining references and bundled application behavior before deployment.

## Deploy
This is a static site. Import this repository into Vercel with the project root set to `/` and no build command; output directory `.`. Do not commit any Supabase secret/service-role key.
