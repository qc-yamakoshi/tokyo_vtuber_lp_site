export const siteConfig = {
  bookingUrl: "",
  inquiryUrl: "",
  xUrl: "",
  youtubeUrl: "",
  instagramUrl: "",
};

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
