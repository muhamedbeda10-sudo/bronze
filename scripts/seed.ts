// Demo and starting data, taken from the examples in the System Documentation.
//   npm run seed            master data + demo orders, logs, stock and users
//   npm run seed -- --force wipe the database first (a development database only!)
//
// The first admin comes from ADMIN_EMAIL / ADMIN_PASSWORD. The demo users
// (planner, supervisor, QC, store) get the same password.

import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/server/password";
import { applyStageAction, createWorkOrder } from "@/lib/server/workOrders";
import { ROLE_ACCESS, type Role } from "@/lib/domain/access";
import { addDays, today } from "@/lib/domain/dates";
import type { StageAction } from "@/lib/domain/routing";

const force = process.argv.includes("--force");

async function wipe() {
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.savedView.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.stockMove.deleteMany(),
    prisma.stockRow.deleteMany(),
    prisma.issueRequest.deleteMany(),
    prisma.overtimeRequest.deleteMany(),
    prisma.inspection.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.stageMove.deleteMany(),
    prisma.workOrderStage.deleteMany(),
    prisma.workOrder.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
    prisma.machine.deleteMany(),
    prisma.mold.deleteMany(),
    prisma.operator.deleteMany(),
    prisma.routeStage.deleteMany(),
    prisma.material.deleteMany(),
    prisma.process.deleteMany(),
    prisma.product.deleteMany(),
    prisma.workshop.deleteMany(),
    prisma.rejectionReason.deleteMany(),
    prisma.setting.deleteMany(),
  ]);
}

async function main() {
  if (await prisma.workOrder.count()) {
    if (!force) {
      console.log("The database already holds work orders — nothing done. Use --force on a development database to start over.");
      return;
    }
    await wipe();
  } else if (force) {
    await wipe();
  }

  const email = (process.env.ADMIN_EMAIL ?? "admin@lotfybronze.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "change-me-now";
  if (password.length < 8) throw new Error("ADMIN_PASSWORD needs at least 8 characters.");
  const pw = hashPassword(password);

  // ---- workshops (each code once — §14)
  const ws = Object.fromEntries(
    await Promise.all(
      [
        ["WS-01", "Melting & Pouring", "Melting & Pouring", "Eng. Hany Fathy"],
        ["WS-02", "Machining", "Machining", "Eng. Mahmoud Saad"],
        ["WS-03", "Pattern & Core Prep", "Pattern & Core Prep", "Mr. Sayed Ali"],
        ["WS-04", "Sand Molding", "Sand Molding", "Mr. Ashraf Kamal"],
        ["WS-05", "Shakeout & Fettling", "Shakeout & Fettling", "Mr. Reda Nabil"],
        ["WS-06", "Quality", "Inspection", "Eng. Mona Adel"],
        ["WS-07", "Centrifugal Casting", "Mold Prepare", "Eng. Karim Hosny"],
        ["WS-08", "Drawing & Cutting", "Drawing / Cutting", "Mr. Tarek Samir"],
      ].map(async ([code, name, stageName, supervisor]) => [code, await prisma.workshop.create({ data: { code: code!, name: name!, stageName, supervisor } })] as const),
    ),
  );

  // ---- rejection reasons
  const reasons = await Promise.all(
    [
      ["REJ-01", "Porosity", "Gas holes in the casting"],
      ["REJ-02", "Inclusions", "Sand or slag trapped in the metal"],
      ["REJ-03", "Cracks", "Hot tears or cold cracks"],
      ["REJ-04", "Shrinkage", "Shrinkage cavities at thick sections"],
      ["REJ-05", "Dimensional error", "Out of drawing tolerance after machining"],
      ["REJ-06", "Cold shut", "Metal streams that did not fuse"],
    ].map(([code, name, description]) => prisma.rejectionReason.create({ data: { code: code!, name: name!, description } })),
  );

  // ---- products
  const prod = Object.fromEntries(
    await Promise.all(
      [
        ["Bushings", "OD_ID_L", "PRC-01, PRC-02"],
        ["Bars", "OD_ID_L", "PRC-02, PRC-03"],
        ["Plates", "W_L_H", "PRC-01"],
        ["Impellers", "IMPELLER", "PRC-01"],
        ["Custom", "CUSTOM", "PRC-01"],
      ].map(async ([name, dimensionFormat, compatibleProcesses]) => [name, await prisma.product.create({ data: { name: name!, dimensionFormat: dimensionFormat!, compatibleProcesses } })] as const),
    ),
  );

  // ---- processes and their routes
  const proc = Object.fromEntries(
    await Promise.all(
      [
        ["PRC-01", "Sand Casting", "Green-sand molds; impellers, plates and large parts", "RT-01", "Impellers, Plates, Bushings, Custom"],
        ["PRC-02", "Centrifugal Casting", "Spinning mold (vertical or horizontal), used for bushings", "RT-02", "Bushings, Bars"],
        ["PRC-03", "Continuous Casting", "Long bars cast continuously", "RT-03", "Bars"],
      ].map(async ([code, name, description, routeCode, compatibleProducts]) => [code, await prisma.process.create({ data: { code: code!, name: name!, description, routeCode: routeCode!, compatibleProducts } })] as const),
    ),
  );
  const routes: [string, string, string, number, boolean, string][] = [
    ["RT-01", "Pattern & Core Prep", "WS-03", 6, false, "Skilled"],
    ["RT-01", "Sand Molding", "WS-04", 8, false, "Semi-Skilled"],
    ["RT-01", "Melting & Pouring", "WS-01", 4, false, "Skilled"],
    ["RT-01", "Shakeout & Fettling", "WS-05", 5, false, "Unskilled"],
    ["RT-01", "Machining", "WS-02", 12, false, "Skilled"],
    ["RT-01", "Inspection", "WS-06", 3, true, "Skilled"],
    ["RT-02", "Mold Prepare", "WS-07", 3, false, "Semi-Skilled"],
    ["RT-02", "Melting & Pouring", "WS-01", 4, false, "Skilled"],
    ["RT-02", "Drawing", "WS-08", 2, false, "Semi-Skilled"],
    ["RT-02", "Cutting", "WS-08", 2, false, "Semi-Skilled"],
    ["RT-02", "Quality", "WS-06", 2, true, "Skilled"],
    ["RT-02", "Machining", "WS-02", 10, false, "Skilled"],
    ["RT-02", "Final Quality", "WS-06", 2, true, "Skilled"],
    ["RT-03", "Melting & Pouring", "WS-01", 3, false, "Skilled"],
    ["RT-03", "Cutting", "WS-08", 1, false, "Semi-Skilled"],
    ["RT-03", "Quality", "WS-06", 1, true, "Skilled"],
  ];
  const stageNo: Record<string, number> = {};
  for (const [routeCode, name, wsCode, stdTimeMin, qcRequired, skillLevel] of routes) {
    stageNo[routeCode] = (stageNo[routeCode] ?? 0) + 1;
    await prisma.routeStage.create({ data: { routeCode, stageNo: stageNo[routeCode]!, name, workshopId: ws[wsCode]!.id, stdTimeMin, qcRequired, skillLevel, operatorsRequired: qcRequired ? 1 : 2 } });
  }

  // ---- materials (each with its own density — §14)
  const mat = Object.fromEntries(
    await Promise.all(
      [
        ["BRZ-08", "C90500", "Tin bronze", 8.91, "Cu 88, Sn 10, Zn 2", 3, "PRC-02"],
        ["BRZ-01", "RG7", "Leaded tin bronze", 8.8, "Cu 83, Sn 7, Pb 6, Zn 4", 3, "PRC-02"],
        ["BRZ-02", "LG2", "Leaded gunmetal", 8.75, "Cu 85, Sn 5, Pb 5, Zn 5", 3, "PRC-01"],
        ["BRZ-05", "CuAl10Ni5Fe4", "Nickel aluminium bronze", 7.6, "Cu 80, Al 10, Ni 5, Fe 4", 4, "PRC-01"],
        ["BRZ-10", "C95400", "Aluminium bronze", 7.45, "Cu 85, Al 11, Fe 4", 4, "PRC-03"],
      ].map(async ([code, name, family, density, composition, scrapPct, p]) => [code, await prisma.material.create({ data: { code: code as string, name: name as string, family: family as string, density: density as number, composition: composition as string, scrapPct: scrapPct as number, defaultProcessId: proc[p as string]!.id } })] as const),
    ),
  );

  // ---- operators
  const opNames = ["Ahmed Mostafa", "Mohamed Hassan", "Mahmoud Ibrahim", "Khaled Youssef", "Omar Farouk", "Hassan Ali", "Mostafa Gamal", "Ibrahim Saeed", "Walid Fawzy", "Yasser Abdelaziz", "Sherif Lotfy", "Amr Salah"];
  const opWs = ["WS-01", "WS-01", "WS-02", "WS-02", "WS-03", "WS-04", "WS-05", "WS-07", "WS-07", "WS-08", "WS-06", "WS-04"];
  const ops = await Promise.all(opNames.map((name, i) => prisma.operator.create({ data: { code: `OP-${String(i + 1).padStart(2, "0")}`, name, workshopId: ws[opWs[i]!]!.id, skillLevel: i % 3 === 0 ? "Skilled" : "Semi-Skilled" } })));

  // ---- machines (each code once — §14)
  const machineRows: [string, string, string, string, number | null, string | null, number | null][] = [
    ["MAC-01", "WS-01", "Induction Furnace A", "Furnace", 500, "kg/hr", 1000],
    ["MAC-02", "WS-01", "Induction Furnace B", "Furnace", 300, "kg/hr", 600],
    ["MAC-03", "WS-02", "CNC Lathe 1", "CNC Lathe", 6, "pcs/hr", null],
    ["MAC-04", "WS-02", "CNC Lathe 2", "CNC Lathe", 5, "pcs/hr", null],
    ["MAC-05", "WS-07", "Vertical Centrifugal Machine", "Centrifugal", 8, "pcs/hr", 400],
    ["MAC-06", "WS-07", "Horizontal Centrifugal Machine", "Centrifugal", 6, "pcs/hr", 800],
    ["MAC-07", "WS-08", "Band Saw", "Saw", 20, "cuts/hr", null],
    ["MAC-08", "WS-04", "Molding Line", "Molding", 10, "molds/hr", null],
    ["MAC-09", "WS-05", "Shot Blast Machine", "Blasting", 30, "pcs/hr", null],
    ["MAC-10", "WS-03", "Core Shooter", "Core making", 15, "cores/hr", null],
  ];
  const mac = Object.fromEntries(
    await Promise.all(
      machineRows.map(async ([code, w, name, type, productionRate, rateUnit, capacity], i) => [code, await prisma.machine.create({ data: { code, workshopId: ws[w]!.id, name, type, productionRate, rateUnit, capacity, number: String(i + 1), setupMin: 30, changeoverMin: 20, maintIntervalDays: 30, defaultOperatorId: ops.find((o) => o.workshopId === ws[w]!.id)?.id ?? null } })] as const),
    ),
  );

  // ---- molds
  await prisma.mold.createMany({
    data: [
      { moldNo: "MLD-C-100", processId: proc["PRC-02"]!.id, productId: prod.Bushings!.id, description: "Centrifugal die Ø100", diaMin: 80, diaMax: 120, lenMin: 50, lenMax: 400, processTimeMin: 12, type: "Permanent", maintCycle: 500, approxWeightKg: 6.5 },
      { moldNo: "MLD-C-250", processId: proc["PRC-02"]!.id, productId: prod.Bushings!.id, description: "Centrifugal die Ø250", diaMin: 200, diaMax: 300, lenMin: 100, lenMax: 600, processTimeMin: 20, type: "Permanent", maintCycle: 400, approxWeightKg: 42 },
      { moldNo: "PAT-IMP-350", processId: proc["PRC-01"]!.id, productId: prod.Impellers!.id, description: "Impeller pattern Ø350, 6 blades", diaMin: 340, diaMax: 360, processTimeMin: 90, type: "Wooden pattern", maintCycle: 150, approxWeightKg: 28.5 },
      { moldNo: "PAT-IMP-520", processId: proc["PRC-01"]!.id, productId: prod.Impellers!.id, description: "Impeller pattern Ø520, 7 blades", diaMin: 510, diaMax: 530, processTimeMin: 140, type: "Aluminium pattern", maintCycle: 300, approxWeightKg: 74 },
    ],
  });
  const molds = await prisma.mold.findMany();
  const mold = (no: string) => molds.find((m) => m.moldNo === no)!.id;

  // ---- settings
  await prisma.setting.createMany({
    data: [
      { key: "companyName", value: "Lotfy Bronze" },
      { key: "companyEmail", value: "info@lotfybronze.com" },
      { key: "rawAllowancePct", value: "15" },
      { key: "defaultDensity", value: "8.8" },
      { key: "machineHoursPerDay", value: "16" },
    ],
  });

  // ---- users
  const users: [string, string, Role, string | null][] = [
    [email, "System Admin", "ADMIN", null],
    ["gm@lotfybronze.com", "Ahmed Lotfy", "GENERAL_MANAGER", null],
    ["planner@lotfybronze.com", "Nour Elsayed", "PLANNER", null],
    ["melting@lotfybronze.com", "Hany Fathy", "WORKSHOP_SUPERVISOR", "WS-01"],
    ["qc@lotfybronze.com", "Mona Adel", "QC_INSPECTOR", null],
    ["store@lotfybronze.com", "Samy Fouad", "STORE_KEEPER", null],
    ["tech@lotfybronze.com", "Rania Magdy", "TECHNICAL_OFFICE", null],
  ];
  const created = await Promise.all(
    users.map(([e, name, role, w], i) => {
      // the admin holds every module in full
      const access = i === 0 ? Object.fromEntries(Object.keys(ROLE_ACCESS.ADMIN).concat(["planning", "workOrders", "workshop", "quality", "inventory", "overtime", "dashboard"]).map((m) => [m, "F"])) : ROLE_ACCESS[role];
      return prisma.user.create({ data: { email: e, name, role, access, passwordHash: pw, workshopId: w ? ws[w]!.id : null, position: role.replace(/_/g, " ").toLowerCase() } });
    }),
  );
  const admin = { id: created[0]!.id, name: created[0]!.name };
  const planner = { id: created[2]!.id, name: created[2]!.name };
  const qc = { id: created[4]!.id, name: created[4]!.name };

  // ---- raw stock
  const t0 = today();
  const rawKg: Record<string, number> = { "BRZ-08": 2400, "BRZ-01": 1800, "BRZ-02": 950, "BRZ-05": 620, "BRZ-10": 300 };
  for (const [code, kg] of Object.entries(rawKg)) {
    const r = await prisma.stockRow.create({ data: { kind: "RAW", materialId: mat[code]!.id, unit: "kg", totalQty: kg, reservedQty: Math.round(kg * 0.2), description: mat[code]!.name } });
    await prisma.stockMove.create({ data: { stockRowId: r.id, delta: kg, reason: "ADD", ref: "Opening balance", userName: admin.name } });
  }

  // ---- demo work orders: [woNo, daysAgo, lines, actions to play]
  type L = { p: string; m: string; pr: string; od?: number; id?: number; len?: number; w?: number; h?: number; qty: number; mold?: string; prio?: 1 | 2 | 3; due: number; notes?: string };
  const orders: { no: string; ago: number; lines: L[]; play: StageAction[][] }[] = [
    { no: "14444", ago: 20, lines: [{ p: "Bars", m: "BRZ-08", pr: "PRC-02", od: 300, id: 200, len: 10, qty: 10, due: 2 }, { p: "Bushings", m: "BRZ-08", pr: "PRC-02", od: 100, id: 20, len: 100, qty: 10, mold: "MLD-C-100", due: 5 }], play: [["START", "NEXT", "START", "NEXT", "START", "NEXT", "START", "NEXT"], ["START", "NEXT", "START"]] },
    { no: "2526", ago: 18, lines: [{ p: "Impellers", m: "BRZ-05", pr: "PRC-01", od: 350, qty: 4, mold: "PAT-IMP-350", prio: 3, due: -2, notes: "Drawing DWG-IMP-350 rev C" }], play: [["START", "NEXT", "START", "NEXT", "START", "NEXT", "START"]] },
    { no: "2531", ago: 16, lines: [{ p: "Bushings", m: "BRZ-01", pr: "PRC-02", od: 250, id: 180, len: 300, qty: 6, mold: "MLD-C-250", prio: 2, due: -5 }], play: [["START", "NEXT", "START", "NEXT", "START", "NEXT", "START", "NEXT", "QC_PASS", "START", "NEXT", "QC_PASS"]] },
    { no: "2540", ago: 15, lines: [{ p: "Bars", m: "BRZ-10", pr: "PRC-03", od: 60, len: 1000, qty: 30, due: -8 }], play: [["START", "NEXT", "START", "NEXT", "QC_PASS"]] },
    { no: "2544", ago: 12, lines: [{ p: "Plates", m: "BRZ-02", pr: "PRC-01", w: 300, len: 500, h: 25, qty: 8, due: 6 }], play: [["START", "NEXT", "START", "REWORK"]] },
    { no: "2547", ago: 10, lines: [{ p: "Bushings", m: "BRZ-08", pr: "PRC-02", od: 120, id: 80, len: 150, qty: 40, prio: 2, due: 3 }, { p: "Bushings", m: "BRZ-08", pr: "PRC-02", od: 90, id: 60, len: 120, qty: 25, due: 3 }, { p: "Bars", m: "BRZ-08", pr: "PRC-02", od: 70, id: 30, len: 250, qty: 12, due: 4 }], play: [["START", "NEXT", "START", "NEXT", "START", "NEXT", "START", "NEXT"], ["START", "NEXT"], []] },
    { no: "2550", ago: 8, lines: [{ p: "Impellers", m: "BRZ-02", pr: "PRC-01", od: 520, qty: 2, mold: "PAT-IMP-520", prio: 3, due: 9 }], play: [["START", "NEXT", "START", "NEXT", "START", "NEXT", "START", "NEXT", "START", "NEXT"]] },
    { no: "2553", ago: 6, lines: [{ p: "Bushings", m: "BRZ-01", pr: "PRC-02", od: 160, id: 110, len: 200, qty: 18, due: 12 }], play: [["WAIT_MATERIAL"]] },
    { no: "2555", ago: 5, lines: [{ p: "Custom", m: "BRZ-05", pr: "PRC-01", od: 400, id: 120, len: 180, qty: 3, due: 15, notes: "Customer drawing pending approval" }], play: [["WAIT_TECH_OFFICE"]] },
    { no: "2558", ago: 3, lines: [{ p: "Bars", m: "BRZ-10", pr: "PRC-03", od: 45, len: 1000, qty: 50, due: 10 }], play: [["START", "NEXT", "START"]] },
    { no: "2560", ago: 2, lines: [{ p: "Bushings", m: "BRZ-08", pr: "PRC-02", od: 200, id: 150, len: 250, qty: 14, prio: 2, due: 14 }], play: [[]] },
    { no: "2561", ago: 1, lines: [{ p: "Plates", m: "BRZ-02", pr: "PRC-01", w: 200, len: 400, h: 20, qty: 6, due: 20 }], play: [[]] },
    { no: "2562", ago: 1, lines: [{ p: "Bars", m: "BRZ-01", pr: "PRC-02", od: 80, id: 40, len: 300, qty: 20, due: 18 }], play: [["START", "NEXT", "START", "NEXT", "START", "NEXT", "START", "NEXT", "QC_REJECT_LAST"]] },
  ];

  const allIds: number[] = [];
  for (const o of orders) {
    const woDate = addDays(t0, -o.ago);
    const ids = await createWorkOrder(
      {
        woNo: o.no,
        woDate,
        lines: o.lines.map((l) => ({
          productId: prod[l.p]!.id,
          materialId: mat[l.m]!.id,
          processId: proc[l.pr]!.id,
          od: l.od ?? null,
          innerDia: l.id ?? null,
          length: l.len ?? null,
          width: l.w ?? null,
          height: l.h ?? null,
          qty: l.qty,
          moldId: l.mold ? mold(l.mold) : null,
          priority: l.prio ?? 1,
          startDate: addDays(woDate, 1),
          atpDate: addDays(t0, l.due - 1),
          dueDate: addDays(t0, l.due),
          dimensionNotes: l.notes ?? null,
          commentNotes: null,
        })),
      },
      planner,
    );
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      allIds.push(id);
      await prisma.workOrder.update({ where: { id }, data: { createdAt: woDate } });
      let n = 0;
      for (const a of o.play[i] ?? []) {
        const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id } });
        const isQc = a.startsWith("QC_");
        await applyStageAction(id, wo.version, a, isQc ? qc : planner, {
          qc: isQc ? { qtyInspected: wo.qty, qtyRejected: a === "QC_PASS" ? (n % 3 === 0 ? 1 : 0) : Math.max(1, Math.round(wo.qty * 0.3)), reasonId: a === "QC_PASS" ? (n % 3 === 0 ? reasons[0]!.id : null) : reasons[n % reasons.length]!.id } : undefined,
          note: a === "REWORK" ? "Mold wall cracked — re-mold" : null,
        });
        n++;
      }
      // spread the moves over the order's life so the history reads like a real one
      const moves = await prisma.stageMove.findMany({ where: { workOrderId: id }, orderBy: { id: "asc" } });
      for (let k = 0; k < moves.length; k++) {
        const at = new Date(addDays(woDate, Math.min(o.ago, Math.round(((k + 1) * o.ago) / (moves.length + 1)))).getTime() + (8 + (k % 8)) * 3_600_000);
        await prisma.stageMove.update({ where: { id: moves[k]!.id }, data: { at } });
        if (moves[k]!.action === "COMPLETE") await prisma.workOrder.update({ where: { id }, data: { completedAt: at } });
        if (k === 0) await prisma.workOrder.update({ where: { id }, data: { startedAt: at } });
      }
      const insp = await prisma.inspection.findMany({ where: { workOrderId: id } });
      for (const x of insp) {
        const mv = moves.find((m) => m.action.startsWith("QC_") || m.action === "COMPLETE");
        if (mv) await prisma.inspection.update({ where: { id: x.id }, data: { at: (await prisma.stageMove.findUnique({ where: { id: mv.id } }))!.at } });
      }
    }
  }

  // ---- workshop activity: the last 14 days, on the orders that ran
  const wos = await prisma.workOrder.findMany({ where: { id: { in: allIds }, stageIndex: { not: null } }, include: { stages: true } });
  const machinesByWs = new Map<number, number[]>();
  for (const m of Object.values(mac)) machinesByWs.set(m.workshopId, [...(machinesByWs.get(m.workshopId) ?? []), m.id]);
  let seq = 0;
  for (let back = 13; back >= 0; back--) {
    const date = addDays(t0, -back);
    for (const wo of wos) {
      for (const st of wo.stages.filter((s) => s.seq <= (wo.stageIndex ?? 0) && !s.qcRequired && s.workshopId)) {
        if ((seq++ + back) % 4 !== 0) continue;
        const machineIds = machinesByWs.get(st.workshopId!) ?? [];
        const machineId = machineIds.length ? machineIds[seq % machineIds.length]! : null;
        const op = ops.filter((o) => o.workshopId === st.workshopId);
        const shift = seq % 3 === 0 ? "NIGHT" : "DAY";
        const hrs = 2 + (seq % 5);
        const produced = Math.max(1, Math.round(wo.qty / (2 + (seq % 3))));
        const scrap = seq % 5 === 0 ? 1 : 0;
        const start = shift === "DAY" ? 8 + (seq % 4) : 20 + (seq % 3);
        await prisma.activity.create({
          data: {
            date,
            workshopId: st.workshopId!,
            machineId,
            shift,
            operatorId: op.length ? op[seq % op.length]!.id : null,
            supervisor: Object.values(ws).find((w) => w.id === st.workshopId)?.supervisor ?? null,
            priority: wo.priority,
            workOrderId: wo.id,
            stageName: st.name,
            taskStatus: seq % 6 === 0 ? "UNDER_PROCESS" : "COMPLETE",
            startTime: `${String(start % 24).padStart(2, "0")}:00`,
            endTime: `${String((start + hrs) % 24).padStart(2, "0")}:00`,
            durationHrs: hrs,
            qtyProduced: produced,
            qtyScrap: scrap,
            rejectionReasonId: scrap ? reasons[seq % reasons.length]!.id : null,
            createdByName: "Hany Fathy",
          },
        });
      }
    }
    // setup / maintenance on a furnace every few days
    if (back % 3 === 0) {
      await prisma.activity.create({ data: { date, workshopId: ws["WS-01"]!.id, machineId: mac["MAC-01"]!.id, shift: "DAY", supervisor: "Eng. Hany Fathy", taskStatus: "COMPLETE", startTime: "07:00", endTime: "08:30", durationHrs: 1.5, notes: "Lining check and crucible change", createdByName: "Hany Fathy" } });
    }
  }

  // ---- issue requests and WIP raw material
  const issueRows: [string, number, string, string, string][] = [
    ["BRZ-08", 180, "WS-01", "14444", "ISSUED"],
    ["BRZ-05", 140, "WS-01", "2526", "ISSUED"],
    ["BRZ-01", 220, "WS-01", "2553", "PENDING"],
    ["BRZ-10", 90, "WS-01", "2558", "PENDING"],
  ];
  let reqN = 1;
  for (const [m, kg, w, no, status] of issueRows) {
    const wo = await prisma.workOrder.findFirst({ where: { woNo: no } });
    await prisma.issueRequest.create({
      data: { reqNo: `IR-${String(reqN++).padStart(4, "0")}`, date: addDays(t0, -reqN), materialId: mat[m]!.id, qtyKg: kg, workshopId: ws[w]!.id, workOrderId: wo?.id ?? null, status, requestedBy: "Hany Fathy", processedBy: status === "ISSUED" ? "Samy Fouad" : null, processedAt: status === "ISSUED" ? addDays(t0, -reqN + 1) : null },
    });
    if (status === "ISSUED") {
      const raw = await prisma.stockRow.findFirst({ where: { kind: "RAW", materialId: mat[m]!.id } });
      if (raw) {
        await prisma.stockRow.update({ where: { id: raw.id }, data: { totalQty: { decrement: kg } } });
        await prisma.stockMove.create({ data: { stockRowId: raw.id, delta: -kg, reason: "ISSUE", ref: `IR-${String(reqN - 1).padStart(4, "0")}`, userName: "Samy Fouad" } });
      }
      const wip = await prisma.stockRow.create({ data: { kind: "WIP_RAW", materialId: mat[m]!.id, workshopId: ws[w]!.id, unit: "kg", totalQty: kg, description: `${mat[m]!.name} at ${ws[w]!.name}` } });
      await prisma.stockMove.create({ data: { stockRowId: wip.id, delta: kg, reason: "RECEIVE_WIP_RAW", ref: `IR-${String(reqN - 1).padStart(4, "0")}`, userName: "Samy Fouad" } });
    }
  }
  const wip = await prisma.workOrder.findFirst({ where: { woNo: "2526" } });
  await prisma.stockRow.create({ data: { kind: "WIP", productId: prod.Impellers!.id, materialId: mat["BRZ-05"]!.id, workOrderId: wip?.id, unit: "pcs", totalQty: 4, reservedQty: 4, reservedNote: "1 – 2526", description: "Impeller Ø350 rough castings" } });

  // ---- overtime
  const otRows: [number, string, string, string, number, string, string][] = [
    [0, "OP-01", "WS-01", "16:00", 3, "Finish the pour for urgent order 2526", "PENDING"],
    [0, "OP-03", "WS-02", "16:00", 2, "Machining backlog", "PENDING"],
    [-2, "OP-09", "WS-07", "16:00", 4, "Centrifugal run for 2547", "APPROVED"],
    [-4, "OP-02", "WS-01", "16:00", 2, "Furnace relining", "APPROVED"],
    [-6, "OP-07", "WS-05", "16:00", 2, "Fettling backlog", "REJECTED"],
  ];
  for (const [d, opCode, w, from, hours, reason, status] of otRows) {
    const op = ops.find((o) => o.code === opCode)!;
    await prisma.overtimeRequest.create({
      data: { date: addDays(t0, d), operatorId: op.id, workshopId: ws[w]!.id, fromTime: from, toTime: `${16 + hours}:00`, hours, reason, status, requestedBy: "Hany Fathy", processedBy: status === "PENDING" ? null : planner.name, processedById: status === "PENDING" ? null : planner.id, processedAt: status === "PENDING" ? null : addDays(t0, d) },
    });
  }

  // ---- a conversation on the urgent impeller, with a mention
  const imp = await prisma.workOrder.findFirst({ where: { woNo: "2526" } });
  const qcUser = created[4]!;
  if (imp) {
    await prisma.comment.create({ data: { entity: "WorkOrder", entityId: imp.id, userId: planner.id, userName: planner.name, body: `@[${qcUser.name}](${qcUser.id}) the customer needs these 4 impellers by Thursday — please inspect them first when they reach Inspection.` } });
    await prisma.comment.create({ data: { entity: "WorkOrder", entityId: imp.id, userId: qcUser.id, userName: qcUser.name, body: "Noted. Send the balancing report with them." } });
    await prisma.notification.create({ data: { userId: qcUser.id, kind: "mention", title: `${planner.name} mentioned you on 2526-1`, body: "the customer needs these 4 impellers by Thursday…", link: `/work-orders/${imp.id}` } });
  }

  console.log(`Seeded. Sign in as ${email} with ADMIN_PASSWORD. Demo users (same password): ${users.slice(1).map((u) => u[0]).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
