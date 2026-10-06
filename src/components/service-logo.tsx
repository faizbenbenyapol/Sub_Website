/* eslint-disable @next/next/no-img-element -- โลโก้มาจาก URL ที่ admin ใส่ได้ทุกโดเมน จึงไม่ใช้ next/image */

const SIZES = {
  xs: "size-5 text-[10px]",
  sm: "size-8 text-caption",
  md: "size-10 text-body",
  lg: "size-16 text-h3",
} as const;

/** โลโก้บริการ: มีรูปใช้รูปบนพื้นขาว ไม่มีรูปใช้ตัวอักษรแรกบนพื้นแก้ว (docs/03 ข้อ 5) */
export function ServiceLogo({
  name,
  logoUrl,
  size = "md",
}: {
  name: string;
  logoUrl: string | null;
  size?: keyof typeof SIZES;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={`${SIZES[size]} shrink-0 rounded-logo bg-white object-contain p-1`}
        loading="lazy"
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${SIZES[size]} glass inline-flex shrink-0 items-center justify-center rounded-logo font-display font-bold`}
    >
      {Array.from(name.trim())[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
