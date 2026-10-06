import type { Metadata } from "next";
import { CategoryManager } from "@/components/admin/category-manager";
import { listCategoriesAdmin } from "@/server/services/admin-catalog";

export const metadata: Metadata = { title: "หมวดหมู่ · หลังบ้าน" };

/** จัดการหมวดหมู่ (US-H1) */
export default async function AdminCategoriesPage() {
  return <CategoryManager categories={await listCategoriesAdmin()} />;
}
