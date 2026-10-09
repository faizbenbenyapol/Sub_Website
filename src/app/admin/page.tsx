import type { Metadata } from "next";
import { BarList } from "@/components/charts/bar-list";
import { LineChart } from "@/components/charts/line-chart";
import { formatBaht } from "@/lib/money";
import { getAdminDashboard } from "@/server/services/admin-users";

export const metadata: Metadata = { title: "ภาพรวมระบบ · หลังบ้าน" };

/** Dashboard admin (US-H5): ตัวเลขสรุป 4 ตัว + Top 10 บริการ + สัดส่วนหมวด + ผู้ใช้ใหม่ 30 วัน */
export default async function AdminHome() {
  const { totals, topServices, byCategory, newUsersDaily } = await getAdminDashboard();
  const stats = [
    { label: "ผู้ใช้ทั้งหมด", value: totals.users.toLocaleString("th-TH"), unit: "คน" },
    {
      label: "รายการที่ใช้งานอยู่",
      value: totals.activeSubscriptions.toLocaleString("th-TH"),
      unit: "รายการ",
    },
    {
      label: "จ่ายเฉลี่ยต่อคนต่อเดือน",
      value: formatBaht(totals.avgMonthlyPerUser, { short: true }),
      unit: "",
    },
    { label: "อีเมลที่ส่งเดือนนี้", value: totals.emailsThisMonth.toLocaleString("th-TH"), unit: "ฉบับ" },
  ];
  const newUsers = newUsersDaily.reduce((s, d) => s + d.count, 0);

  return (
    <>
      <h1 className="text-h2 font-bold">ภาพรวมระบบ</h1>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 border-b border-line pb-8 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-caption text-text-muted">{s.label}</dt>
            <dd className="mt-1">
              <span className="figure text-h2 leading-none">{s.value}</span>
              {s.unit && <span className="ml-1 text-caption text-text-muted">{s.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-caption text-text-faint">
        ค่าเฉลี่ยคิดจากผู้ใช้ที่มีรายการใช้งานอยู่อย่างน้อย 1 รายการ · รายปีหาร 12
      </p>

      <section aria-labelledby="new-users-heading" className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="new-users-heading" className="text-h3 font-bold">
            ผู้ใช้ใหม่รายวัน
          </h2>
          <p className="text-caption text-text-muted">
            30 วันล่าสุด รวม <span className="figure text-text">{newUsers}</span> คน
          </p>
        </div>
        <div className="glass mt-4 rounded-card p-4">
          <LineChart data={newUsersDaily} label="ผู้ใช้ใหม่รายวัน" />
        </div>
      </section>

      <div className="mt-10 grid gap-10 xl:grid-cols-2">
        <section aria-labelledby="top-heading">
          <h2 id="top-heading" className="text-h3 font-bold">
            บริการที่มีคนใช้มากที่สุด
          </h2>
          <p className="mt-1 text-caption text-text-muted">จำนวนรายการที่ใช้งานอยู่ · 10 อันดับแรก</p>
          <div className="mt-4">
            {topServices.length ? (
              <BarList
                label="จำนวนผู้ใช้ต่อบริการ"
                format="count"
                unit="รายการ"
                data={topServices.map((s) => ({ label: s.name, value: s.count }))}
              />
            ) : (
              <p className="text-text-muted">ยังไม่มีผู้ใช้เพิ่มรายการจากรวมบริการ</p>
            )}
          </div>
        </section>
        <section aria-labelledby="cat-heading">
          <h2 id="cat-heading" className="text-h3 font-bold">
            สัดส่วนตามหมวด
          </h2>
          <p className="mt-1 text-caption text-text-muted">
            จำนวนรายการที่ใช้งานอยู่ รวมรายการที่ผู้ใช้เพิ่มเอง
          </p>
          <div className="mt-4">
            {byCategory.length ? (
              <BarList
                label="จำนวนรายการตามหมวด"
                format="count"
                unit="รายการ"
                data={byCategory.map((c) => ({ label: c.name, value: c.count }))}
              />
            ) : (
              <p className="text-text-muted">ยังไม่มีรายการ</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
