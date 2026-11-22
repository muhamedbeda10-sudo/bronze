import { describe, expect, it } from "vitest";
import { selfLockout, validateUser } from "./users";

describe("users", () => {
  it("takes the role preset when no access is given", () => {
    const r = validateUser({ name: "Mona", email: "QC@x.com ", role: "QC_INSPECTOR" });
    expect(r.ok && r.value.email).toBe("qc@x.com");
    expect(r.ok && r.value.access.quality).toBe("F");
  });
  it("keeps the admin's own edits to access, cleaned", () => {
    const r = validateUser({ name: "A", email: "a@x.com", role: "PLANNER", access: { planning: "V", bogus: "F" } });
    expect(r.ok && r.value.access).toEqual({ planning: "V" });
  });
  it("refuses a bad email or role", () => {
    expect(validateUser({ name: "A", email: "nope", role: "PLANNER" }).ok).toBe(false);
    expect(validateUser({ name: "A", email: "a@x.com", role: "KING" }).ok).toBe(false);
  });
  it("never lets the admin lock themselves out", () => {
    const v = validateUser({ name: "A", email: "a@x.com", role: "ADMIN" });
    if (!v.ok) throw new Error();
    expect(selfLockout(true, { ...v.value, active: false })).toBeTruthy();
    expect(selfLockout(true, { ...v.value, access: { settings: "V" } })).toBeTruthy();
    expect(selfLockout(true, v.value)).toBeNull();
    expect(selfLockout(false, { ...v.value, active: false })).toBeNull();
  });
});
