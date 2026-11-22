# Inventory

Lists: Raw Materials (kg), FG Products (pcs), WIP Product (pcs), WIP Raw Material (kg) — each with Total, Reserved and Available (= Total − Reserved).
Full inventory access adds, adjusts (with a reason), removes and uploads lines; every quantity change goes into the **Stock Ledger** with its reason and who made it.
One raw-material line per material; an upload sets it.
A completed work order adds its pieces to FG stock automatically.
**Issue Request:** a workshop asks for metal (material, kg, work order); the store issues it — raw stock down, the workshop's WIP raw material up, both in the ledger — or rejects it with a reason. An issue beyond the stock on hand is refused.
