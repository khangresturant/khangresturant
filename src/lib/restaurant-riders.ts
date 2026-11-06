export type RestaurantPaymentMode = "cash" | "bank" | "online" | "card" | "credit";

export type RestaurantStaffPerson = {
  id: string;
  name: string;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  permissions?: { phone?: string | null } | Record<string, unknown> | null;
};

export function staffPhone(
  person: { phone?: string | null; permissions?: { phone?: string | null } | Record<string, unknown> | null } | null | undefined
): string | null {
  const direct = person?.phone?.trim();
  if (direct) return direct;
  const nested = (person?.permissions as { phone?: string | null } | undefined)?.phone;
  return nested?.trim() || null;
}

export const RESTAURANT_PAYMENT_MODES: {
  id: RestaurantPaymentMode;
  label: string;
  labelUr: string;
}[] = [
  { id: "cash", label: "Cash", labelUr: "نقد" },
  { id: "bank", label: "Bank", labelUr: "بینک" },
  { id: "online", label: "Online", labelUr: "آن لائن" },
  { id: "card", label: "Card", labelUr: "کارڈ" },
  { id: "credit", label: "Credit", labelUr: "ادھار" },
];

export function isDeliveryService(serviceType?: string | null): boolean {
  return String(serviceType || "").toLowerCase().replace(/[-\s]/g, "_") === "delivery";
}

export function isDiningService(serviceType?: string | null): boolean {
  const s = String(serviceType || "").toLowerCase();
  return s === "dining" || s === "dine_in" || s === "dine-in";
}

export function isRiderStaff(person: { role?: string | null; name?: string | null }): boolean {
  const role = (person.role || "").toLowerCase();
  const name = (person.name || "").toLowerCase();
  return (
    role.includes("rider") ||
    role.includes("delivery") ||
    name.includes("rider") ||
    name.includes("delivery boy")
  );
}

/** Prefer staff marked rider/delivery; if none, show all (shop can still assign). */
export function filterRiderStaff<T extends { role?: string | null; name?: string | null }>(
  staff: T[]
): T[] {
  const riders = staff.filter(isRiderStaff);
  return riders.length ? riders : staff;
}

export function riderLabel(
  person: {
    name?: string | null;
    phone?: string | null;
    permissions?: { phone?: string | null } | Record<string, unknown> | null;
  } | null | undefined
): string {
  if (!person?.name) return "";
  const phone = staffPhone(person);
  return phone ? `${person.name} · ${phone}` : person.name;
}

export function restaurantPaymentLabel(mode?: string | null): string {
  const m = String(mode || "cash").toLowerCase();
  if (m === "bank" || m === "bank_transfer") return "BANK TRANSFER";
  if (m === "online" || m === "jazzcash" || m === "easypaisa" || m === "wallet") return "ONLINE";
  if (m === "card") return "CARD";
  if (m === "credit") return "CREDIT";
  return "CASH";
}

export function pickAccountForPayment(
  accounts: { id: string; name: string }[],
  mode: RestaurantPaymentMode
): string {
  if (!accounts.length) return "";
  const named = accounts.map((a) => ({ ...a, n: a.name.toLowerCase() }));
  if (mode === "cash") {
    return named.find((a) => a.n.includes("cash"))?.id || accounts[0].id;
  }
  if (mode === "online") {
    return (
      named.find(
        (a) =>
          a.n.includes("jazz") ||
          a.n.includes("easypaisa") ||
          a.n.includes("online") ||
          a.n.includes("wallet")
      )?.id ||
      named.find((a) => a.n.includes("bank"))?.id ||
      accounts[0].id
    );
  }
  if (mode === "bank" || mode === "card") {
    return named.find((a) => a.n.includes("bank"))?.id || accounts[0].id;
  }
  return accounts[0].id;
}

export function findStaffById(
  staff: RestaurantStaffPerson[],
  id?: string | null
): RestaurantStaffPerson | null {
  if (!id) return null;
  return staff.find((s) => s.id === id) || null;
}
