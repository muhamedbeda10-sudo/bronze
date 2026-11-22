"use client";

import dynamic from "next/dynamic";

// the charts library loads only on the pages that draw a chart, after the figures
export const DashboardCharts = dynamic(() => import("./DashboardCharts").then((m) => m.DashboardCharts), {
  ssr: false,
  loading: () => <div className="grid gap-4 xl:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="card" style={{ height: 330, opacity: 0.6 }} />)}</div>,
});
