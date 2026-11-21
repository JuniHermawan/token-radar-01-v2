# Launch Radar v2

A token launch radar: the 40 protocols on the watchlist (every protocol with at least $50M of TVL and no token on record), ranked by implied value, plus every other rankable pre-token protocol in the snapshot — 203 rows in all.

## How the radar scores

Each protocol gets one implied value from the snapshot alone: TVL × 0.25, × a growth multiple from its seven-day change (floored at −90%, linear to +150%, logarithmic past it, weighted 0.45), × a maturity multiple from how long it has run with no token (0.6 plus up to 0.4 over three years, unknown age counted as 365 days), × a reach multiple (0.03 per extra chain, up to five). The same function scores every row; no name is special-cased. The dashboard shows each multiplier beside the row it produced, with a driver tag naming which factor carries the row.

## Farm plans

Every row carries an eight-step farm plan: a fresh wallet, a primary action from the protocol's category, a second qualifying action, a weekly rhythm, a hold duration from its age, a risk note specific to its category, a points check on the protocol's own page, and a farm log with an exit plan. Capital comes from the protocol's TVL tier, gas from its first chain.

## How to use it

Open the dashboard and use the search, category, chain, driver and watchlist filters, or sort by implied value, TVL, seven-day growth, age or chains. Select a row for its model and farm plan. The model sandbox recomputes every row live.
