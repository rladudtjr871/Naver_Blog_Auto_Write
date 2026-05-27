/**
 * Format ISO date string or Date object to a readable Korean date format.
 * Example: "2026-05-27T12:00:00Z" -> "2026년 05월 27일 21:00:00"
 */
export function formatKoreanDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  
  try {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return "-";

    const pad = (num: number) => String(num).padStart(2, "0");

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    return `${year}년 ${month}월 ${day}일 ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error("Date formatting failed:", error);
    return "-";
  }
}
