"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import {
  addDays,
  BUDDHIST_OFFSET,
  daysInMonth,
  dmyToIso,
  isoToDmy,
  parseIsoDate,
  shiftMonth,
  todayInBangkok,
  toIsoDate,
} from "@/lib/dates";

// ช่องวันที่ของทั้งเว็บ: พิมพ์เป็น วว/ดด/ปปปป (พ.ศ. ให้ตรงกับวันที่ที่แสดงทั้งเว็บ) หรือกดไอคอนเลือกจากปฏิทิน
// แทน <input type="date"> ที่รูปแบบเปลี่ยนตามภาษาของ browser (เครื่องอังกฤษได้ mm/dd/yyyy) และแต่งปฏิทินไม่ได้
// ค่าที่ส่งไปกับฟอร์มยังเป็น "YYYY-MM-DD" ผ่าน hidden input ชื่อเดิม — โค้ดฝั่งฟอร์ม/API ไม่ต้องเปลี่ยน

const MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

type Props = {
  label: string;
  name: string;
  defaultValue?: string;
  min?: string;
  hint?: string;
  error?: string;
  className?: string;
};

/**
 * จัดสิ่งที่พิมพ์ให้เป็น วว/ดด/ปปปป ระหว่างพิมพ์: ใส่ / ให้เอง, พิมพ์ "9/" ได้ "09"
 * วางค่าแบบ 2026-10-09 ก็แปลงให้ (รวมถึงตอนเทสกรอกค่า ISO)
 */
function maskDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return isoToDmy(raw.trim());
  const segments = raw.replace(/[^\d/]/g, "").split("/");
  let digits = "";
  segments.forEach((seg, i) => {
    const typedSlashAfter = i < segments.length - 1;
    digits += typedSlashAfter && i < 2 && seg.length === 1 ? `0${seg}` : seg;
  });
  digits = digits.slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** เลื่อนวันไปเดือนอื่นโดยไม่ล้นเดือน (31 ม.ค. + 1 เดือน = 28/29 ก.พ.) */
function shiftDayByMonth(iso: string, delta: number): string {
  const [y, m] = shiftMonth(iso.slice(0, 7), delta).split("-").map(Number);
  return toIsoDate(y, m, Math.min(parseIsoDate(iso).d, daysInMonth(y, m)));
}

/** ช่องวันที่ วว/ดด/ปปปป (พ.ศ.) พร้อมปุ่มเปิดปฏิทิน — ส่งค่าจริงเป็น YYYY-MM-DD ผ่าน hidden input ชื่อ name */
export function DateField({ label, name, defaultValue = "", min, hint, error, className = "" }: Props) {
  const id = useId();
  const calendarId = `${id}-calendar`;
  const messageId = `${id}-message`;

  const [text, setText] = useState(defaultValue ? isoToDmy(defaultValue) : "");
  const iso = dmyToIso(text);
  // พิมพ์ครบแล้วแต่ใช้ไม่ได้ บอกทันทีว่าผิดตรงไหน — ที่พบบ่อยคือติดมือพิมพ์ปี ค.ศ.
  const typoError =
    text.length === 10 && !iso
      ? Number(text.slice(6)) < 2400
        ? "ใส่ปีเป็น พ.ศ. เช่น 2569"
        : "ไม่มีวันที่นี้ในปฏิทิน"
      : undefined;
  const shownError = typoError ?? error;
  const message = shownError ?? hint;
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState("");
  const [view, setView] = useState(""); // เดือนที่ปฏิทินแสดง "YYYY-MM"
  const [focused, setFocused] = useState(""); // วันที่มีโฟกัสคีย์บอร์ดในตาราง

  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  /** วางปฏิทินใต้ช่อง (ถ้าล่างไม่พอค่อยขึ้นบน) ไม่ให้ล้นขอบจอ */
  function place() {
    const anchor = inputRef.current?.getBoundingClientRect();
    const pop = popoverRef.current;
    if (!anchor || !pop) return;
    const gap = 6;
    const fitsBelow = anchor.bottom + gap + pop.offsetHeight <= window.innerHeight;
    const top =
      fitsBelow || anchor.top < pop.offsetHeight + gap
        ? anchor.bottom + gap
        : anchor.top - gap - pop.offsetHeight;
    const left = Math.min(Math.max(8, anchor.left), window.innerWidth - pop.offsetWidth - 8);
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
  }

  /** เปิดปฏิทินที่วันที่เลือกไว้ หรือวันนี้ (ไม่ต่ำกว่า min) */
  function onToggle(e: { newState: string }) {
    if (e.newState !== "open") return setOpen(false);
    const now = todayInBangkok();
    const start = iso ?? (min && now < min ? min : now);
    setToday(now);
    setView(start.slice(0, 7));
    setFocused(start);
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (open) place();
  }, [open, view]);

  // ตามช่องไปเมื่อหน้าเลื่อนหรือจอเปลี่ยนขนาดระหว่างเปิด
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // ย้ายโฟกัสไปวันที่ตามคีย์บอร์ด
  useEffect(() => {
    if (open) gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }, [open, focused]);

  /** เลือกวันจากปฏิทิน (ค่าว่าง = ล้าง) แล้วปิดปฏิทินและคืนโฟกัสให้ช่องพิมพ์ */
  function choose(date: string) {
    setText(date ? isoToDmy(date) : "");
    popoverRef.current?.hidePopover();
    inputRef.current?.focus();
  }

  /** ย้ายโฟกัสคีย์บอร์ดไปวันใหม่ และเปลี่ยนเดือนที่แสดงตามถ้าข้ามเดือน */
  function moveFocus(date: string) {
    setFocused(date);
    setView(date.slice(0, 7));
  }

  /** ปุ่มลูกศร/PageUp/PageDown ในตารางวัน เลื่อนทีละวัน สัปดาห์ หรือเดือน */
  function onGridKey(e: KeyboardEvent) {
    const step: Record<string, () => string> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => shiftDayByMonth(focused, -1),
      PageDown: () => shiftDayByMonth(focused, 1),
    };
    if (!step[e.key]) return;
    e.preventDefault();
    moveFocus(step[e.key]());
  }

  /** วันนี้เลือกไม่ได้หรือไม่ (ก่อน min) */
  const disabled = (date: string) => Boolean(min && date < min);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-caption font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="วว/ดด/ปปปป (พ.ศ.)"
          value={text}
          onChange={(e) => setText(maskDate(e.target.value))}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={`figure h-12 w-full rounded-control border bg-glass-strong pr-13 pl-4 text-body text-text placeholder:font-sans placeholder:text-text-faint ${
            shownError ? "border-danger" : "border-line-strong focus:border-paid"
          } focus:outline-none focus-visible:outline-2 focus-visible:outline-paid`}
        />
        {/* ค่าที่ส่งจริง: ISO ถ้าวันที่ถูกต้อง ไม่งั้นส่งข้อความที่พิมพ์ไป ให้ validation ตอบว่ารูปแบบไม่ถูกต้อง */}
        <input type="hidden" name={name} value={iso ?? text} />
        <button
          type="button"
          popoverTarget={calendarId}
          aria-label={`เลือก${label}จากปฏิทิน`}
          aria-expanded={open}
          className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-[10px] text-text-muted hover:bg-glass-strong hover:text-text"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
            <path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {message && (
        <p id={messageId} className={`text-caption ${shownError ? "text-danger" : "text-text-muted"}`}>
          {message}
        </p>
      )}

      <div
        ref={popoverRef}
        id={calendarId}
        popover="auto"
        role="dialog"
        aria-label={`ปฏิทินเลือก${label}`}
        onToggle={onToggle}
        className="fixed inset-auto m-0 w-[19.5rem] rounded-control border border-line-strong bg-surface p-3 text-text shadow-[0_18px_48px_rgb(0_0_0/0.55)]"
      >
        {open && (
          <Calendar
            view={view}
            today={today}
            selected={iso}
            focused={focused}
            gridRef={gridRef}
            isDisabled={disabled}
            onMonth={(delta) => moveFocus(shiftDayByMonth(focused, delta))}
            onKey={onGridKey}
            onPick={choose}
            canGoBack={!min || shiftMonth(view, -1) >= min.slice(0, 7)}
          />
        )}
      </div>
    </div>
  );
}

/** ตารางเดือน: หัวเดือน + ปุ่มเลื่อน, วันในสัปดาห์, วันที่ (roving focus), ปุ่มวันนี้/ล้าง */
function Calendar({
  view,
  today,
  selected,
  focused,
  gridRef,
  isDisabled,
  onMonth,
  onKey,
  onPick,
  canGoBack,
}: {
  view: string;
  today: string;
  selected: string | null;
  focused: string;
  gridRef: RefObject<HTMLDivElement | null>;
  isDisabled: (date: string) => boolean;
  onMonth: (delta: number) => void;
  onKey: (e: KeyboardEvent) => void;
  onPick: (date: string) => void;
  canGoBack: boolean;
}) {
  const [y, m] = view.split("-").map(Number);
  const leading = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = Array.from({ length: daysInMonth(y, m) }, (_, i) => toIsoDate(y, m, i + 1));

  return (
    <>
      <div className="flex items-center justify-between pb-2">
        <MonthButton
          label="เดือนก่อน"
          disabled={!canGoBack}
          onClick={() => onMonth(-1)}
          d="m14.5 6-6 6 6 6"
        />
        <p aria-live="polite" className="font-display font-semibold">
          {MONTHS[m - 1]} <span className="figure">{y + BUDDHIST_OFFSET}</span>
        </p>
        <MonthButton label="เดือนถัดไป" onClick={() => onMonth(1)} d="m9.5 6 6 6-6 6" />
      </div>

      <div className="grid grid-cols-7 text-center text-caption text-text-faint">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1">
            {w}
          </span>
        ))}
      </div>

      <div
        ref={gridRef}
        role="group"
        aria-label="วันที่"
        onKeyDown={onKey}
        className="grid grid-cols-7 gap-0.5"
      >
        {Array.from({ length: leading }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((date) => {
          const off = isDisabled(date);
          const isSelected = date === selected;
          const isToday = date === today;
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              tabIndex={date === focused ? 0 : -1}
              aria-label={`${Number(date.slice(8))} ${MONTHS[m - 1]} ${y + BUDDHIST_OFFSET}`}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-disabled={off || undefined}
              onClick={() => !off && onPick(date)}
              className={`figure flex aspect-square items-center justify-center rounded-[10px] text-caption focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-paid ${
                isSelected
                  ? "bg-paid font-semibold text-night"
                  : off
                    ? "cursor-not-allowed text-text-faint/45"
                    : `hover:bg-glass-strong ${isToday ? "font-semibold text-paid ring-1 ring-line-strong ring-inset" : ""}`
              }`}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between border-t border-line pt-2">
        <button
          type="button"
          onClick={() => onPick("")}
          className="min-h-10 rounded-[10px] px-3 text-caption text-text-muted hover:bg-glass-strong hover:text-text"
        >
          ล้าง
        </button>
        <button
          type="button"
          disabled={isDisabled(today)}
          onClick={() => onPick(today)}
          className="min-h-10 rounded-[10px] px-3 text-caption font-semibold text-link hover:bg-glass-strong disabled:opacity-40"
        >
          วันนี้
        </button>
      </div>
    </>
  );
}

/** ปุ่มลูกศรเลื่อนเดือนในปฏิทิน (disabled เมื่อย้อนไปก่อนวันที่เลือกได้) */
function MonthButton({
  label,
  d,
  disabled,
  onClick,
}: {
  label: string;
  d: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-10 items-center justify-center rounded-[10px] text-text-muted hover:bg-glass-strong hover:text-text disabled:pointer-events-none disabled:opacity-30"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d={d} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
