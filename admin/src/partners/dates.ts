/** Partner end dates and billing months follow Vietnam time, whatever the admin's own time zone. */
const VN = "Asia/Ho_Chi_Minh";

/** "2026-12-31" → the last second of that day in Vietnam. */
export const endOfVnDay = (date: string) => `${date}T23:59:59+07:00`;

/** ISO instant → "yyyy-mm-dd" of that moment in Vietnam, for date inputs. */
export const vnDateValue = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: VN }).format(new Date(iso));

/** "yyyy-MM" of the current month in Vietnam. */
export const currentVnMonth = () => vnDateValue(new Date().toISOString()).slice(0, 7);

export const isExpired = (expiresAt: string | null) => !!expiresAt && new Date(expiresAt) <= new Date();
