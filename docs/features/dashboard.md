# Dashboard

Filters: from, to (default the last 30 days), workshop, process — kept in the address.
**Overview (now):** open work orders (and how many are on the floor), delayed orders (open and past due), completed today, material required (raw req. + allowance of open orders).
**Production (the period):** output vs plan % = pieces completed ÷ pieces due; rejection rate % = (scrap logged + pieces QC rejected) ÷ (produced + scrap logged); machine utilization % = hours machines worked on orders ÷ (active machines × days × machine hours a day) — setup and maintenance do not count; approved overtime hours; completed orders; average delivery time (WO date → completion).
Charts: daily trend (pieces due vs completed), status distribution, rejections by reason, utilization by workshop.
Export to Excel writes the KPIs and every chart's table; PDF prints the page.
The formulas are in `lib/domain/kpi.ts` (tested).
