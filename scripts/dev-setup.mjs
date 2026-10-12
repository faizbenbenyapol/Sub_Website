// รันอัตโนมัติก่อน `npm run dev` (predev) — ให้ผู้ตรวจแตกไฟล์ → import SQL → npm run dev ได้เลย
// 1) ยังไม่มี node_modules → npm install ให้
// 2) ยังไม่มี .env → สร้างจาก .env.example พร้อมสุ่ม secret และเลือก DATABASE_URL ตามฐานข้อมูลที่เปิดอยู่
// มี .env อยู่แล้วจะไม่แตะเลย · ใช้แค่ node:* เพราะรันได้ก่อนติดตั้ง package
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { connect } from "node:net";

const XAMPP_URL = "mysql://root:@localhost:3306/tadyang";
const DOCKER_URL = "mysql://tadyang:tadyang@localhost:3307/tadyang";

/** เช็กว่ามีโปรแกรมรอรับที่พอร์ตนี้บนเครื่องหรือไม่ */
function portOpen(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port, timeout: 1000 });
    const done = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

/** แทนค่าบรรทัด KEY=... ใน .env */
function setKey(text, key, value) {
  return text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
}

/** สร้าง .env สำหรับรันบนเครื่องตัวเอง — Docker (3307) ก่อน ไม่งั้นใช้ XAMPP (3306, root ไม่มีรหัส) */
async function createEnv() {
  const dbUrl = (await portOpen(3307)) ? DOCKER_URL : XAMPP_URL;
  const secret = (bytes) => randomBytes(bytes).toString("base64url");

  let text = readFileSync(".env.example", "utf8");
  text = setKey(text, "DATABASE_URL", dbUrl);
  text = setKey(text, "SESSION_SECRET", secret(48));
  text = setKey(text, "CRON_SECRET", secret(24));
  text = setKey(text, "DEMO_LOGIN", "true");
  writeFileSync(".env", text);

  console.log(`[dev-setup] สร้าง .env แล้ว — DATABASE_URL=${dbUrl}`);
  console.log(
    "[dev-setup] ถ้า MySQL ของเครื่องนี้มีรหัส root หรือใช้พอร์ตอื่น ให้แก้ DATABASE_URL ใน .env แล้วรันใหม่",
  );
}

if (!existsSync("node_modules")) {
  console.log("[dev-setup] ยังไม่มี node_modules — กำลัง npm install (ครั้งแรกใช้เวลาสักครู่)");
  execSync("npm install", { stdio: "inherit" });
}

if (!existsSync(".env")) await createEnv();
