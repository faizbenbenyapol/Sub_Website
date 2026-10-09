// ข้อมูลคลังบริการเริ่มต้น — ราคาเป็นบาท (รวม VAT) เก็บเมื่อ 6 ต.ค. 2569 · ตรวจซ้ำและเพิ่มบริการ 9 ต.ค. 2569
// source: แหล่งที่ใช้ยืนยันราคา ("official" = หน้าเว็บของบริการเอง, "App Store TH" = ราคาซื้อในแอป iPhone ไทย
// ซึ่งบางบริการแพงกว่าสมัครผ่านเว็บ/Android) — ก่อน demo ให้สุ่มตรวจซ้ำ
// cancelSteps: 1 บรรทัด = 1 ขั้นตอน (เรนเดอร์เป็น <ol>)

export type SeedPlan = { name: string; price: number; cycle: "monthly" | "yearly"; maxMembers?: number };
export type SeedService = {
  slug: string;
  name: string;
  category: string;
  websiteUrl: string;
  source: string;
  plans: SeedPlan[];
  cancelSteps: string[];
};

export const seedCategories = [
  { slug: "video", name: "ดูหนัง/ซีรีส์", icon: "film" },
  { slug: "music", name: "ฟังเพลง", icon: "music" },
  { slug: "storage", name: "เก็บไฟล์", icon: "cloud" },
  { slug: "work", name: "ทำงาน", icon: "briefcase" },
  { slug: "game", name: "เกม", icon: "gamepad" },
  { slug: "other", name: "อื่น ๆ", icon: "dots" },
];

const appleCancel = [
  "บน iPhone เปิด การตั้งค่า แล้วแตะชื่อของคุณด้านบนสุด",
  "แตะ การสมัครรับ (Subscriptions)",
  "เลือกบริการที่ต้องการยกเลิก",
  "แตะ ยกเลิกการสมัครรับ แล้วยืนยัน — ใช้ได้ถึงวันสิ้นรอบบิลปัจจุบัน",
];

/** บริการที่ราคาอ้างอิงจาก App Store: ยกเลิกที่ร้านแอปที่สมัครไว้ */
const storeCancel = (app: string) => [
  ...appleCancel,
  `ถ้าสมัครผ่าน Android: Play Store → รูปโปรไฟล์ → การชำระเงินและการสมัครใช้บริการ → การสมัครใช้บริการ → ${app} → ยกเลิก`,
];

/** ขั้นตอนยกเลิกสำหรับบริการที่สมัครผ่าน Google Play / iPhone (ใส่ชื่อแอป) */
const googlePlayCancel = (app: string) => [
  "ถ้าสมัครผ่าน Google Play: เปิดแอป Play Store แตะรูปโปรไฟล์ → การชำระเงินและการสมัครใช้บริการ → การสมัครใช้บริการ",
  `เลือก ${app} แล้วแตะ ยกเลิกการสมัครใช้บริการ`,
  "ถ้าสมัครผ่าน iPhone: การตั้งค่า → ชื่อของคุณ → การสมัครรับ แล้วยกเลิกที่นั่น",
];

export const seedServices: SeedService[] = [
  // ─── ดูหนัง/ซีรีส์ ───
  {
    slug: "netflix",
    name: "Netflix",
    category: "video",
    websiteUrl: "https://www.netflix.com/th/",
    source: "official: help.netflix.com/en/node/24926/th",
    plans: [
      { name: "Mobile", price: 99, cycle: "monthly" },
      { name: "Basic", price: 169, cycle: "monthly" },
      { name: "Standard", price: 349, cycle: "monthly", maxMembers: 2 },
      { name: "Premium", price: 419, cycle: "monthly", maxMembers: 4 },
    ],
    cancelSteps: [
      "เข้า netflix.com แล้วเข้าสู่ระบบ",
      "กดรูปโปรไฟล์ → บัญชี",
      "กด ยกเลิกการเป็นสมาชิก",
      "กด เสร็จสิ้นการยกเลิก — ดูต่อได้จนถึงวันสิ้นรอบบิล",
    ],
  },
  {
    slug: "youtube-premium",
    name: "YouTube Premium",
    category: "video",
    websiteUrl: "https://www.youtube.com/premium",
    source: "iphone-droid.net (ราคาสมัครผ่าน Android/เว็บ เม.ย. 2569) — ผ่าน iOS แพงกว่า",
    plans: [
      { name: "Lite", price: 119, cycle: "monthly" },
      { name: "รายบุคคล", price: 199, cycle: "monthly" },
      { name: "รายบุคคล รายปี", price: 1990, cycle: "yearly" },
      { name: "ครอบครัว", price: 399, cycle: "monthly", maxMembers: 6 },
      { name: "นักเรียน/นักศึกษา", price: 129, cycle: "monthly" },
    ],
    cancelSteps: [
      "เข้า youtube.com/paid_memberships แล้วเข้าสู่ระบบ",
      "กด จัดการการเป็นสมาชิก ที่ YouTube Premium",
      "กด ปิดใช้งาน → ยกเลิก แล้วยืนยัน",
    ],
  },
  {
    slug: "disney-plus-hotstar",
    name: "Disney+ Hotstar",
    category: "video",
    websiteUrl: "https://www.hotstar.com/th",
    source: "whatsondisneyplus.com / AIS",
    plans: [
      { name: "Mobile", price: 99, cycle: "monthly" },
      { name: "Mobile รายปี", price: 799, cycle: "yearly" },
      { name: "Standard", price: 199, cycle: "monthly", maxMembers: 2 },
      { name: "Standard รายปี", price: 1590, cycle: "yearly", maxMembers: 2 },
      { name: "Premium", price: 289, cycle: "monthly", maxMembers: 4 },
      { name: "Premium รายปี", price: 2290, cycle: "yearly", maxMembers: 4 },
    ],
    cancelSteps: [
      "เข้า hotstar.com/th แล้วเข้าสู่ระบบ",
      "ไปที่ บัญชีของฉัน → การสมัครสมาชิก",
      "กด ยกเลิกการต่ออายุอัตโนมัติ แล้วยืนยัน",
      "ถ้าสมัครผ่าน AIS ให้ยกเลิกผ่านแอป myAIS หรือกด *700*1# แทน",
    ],
  },
  {
    slug: "hbo-max",
    name: "HBO Max",
    category: "video",
    websiteUrl: "https://www.hbomax.com/th/th",
    source: "blognone.com/node/142739",
    plans: [
      { name: "Mobile", price: 99, cycle: "monthly" },
      { name: "Standard", price: 199, cycle: "monthly", maxMembers: 2 },
      { name: "Standard รายปี", price: 1390, cycle: "yearly", maxMembers: 2 },
      { name: "Premium", price: 299, cycle: "monthly", maxMembers: 4 },
      { name: "Premium รายปี", price: 2090, cycle: "yearly", maxMembers: 4 },
    ],
    cancelSteps: [
      "เข้า hbomax.com แล้วเข้าสู่ระบบ",
      "กดรูปโปรไฟล์ → การตั้งค่า → การสมัครสมาชิก",
      "กด จัดการการสมัครสมาชิก → ยกเลิกการสมัครสมาชิก แล้วยืนยัน",
    ],
  },
  {
    slug: "prime-video",
    name: "Prime Video",
    category: "video",
    websiteUrl: "https://www.primevideo.com",
    source: "spendfigo.com",
    plans: [{ name: "รายเดือน", price: 149, cycle: "monthly" }],
    cancelSteps: [
      "เข้า primevideo.com แล้วเข้าสู่ระบบ",
      "ไปที่ บัญชีและการตั้งค่า → การเป็นสมาชิกและการสมัครรับ",
      "กด ยกเลิกการเป็นสมาชิก แล้วยืนยัน",
    ],
  },
  {
    slug: "apple-tv",
    name: "Apple TV",
    category: "video",
    websiteUrl: "https://www.apple.com/th/apple-tv-plus/",
    source: "official: apple.com/th/apple-tv-plus",
    plans: [{ name: "รายเดือน", price: 249, cycle: "monthly", maxMembers: 6 }],
    cancelSteps: appleCancel,
  },
  {
    slug: "iqiyi",
    name: "iQIYI",
    category: "video",
    websiteUrl: "https://www.iq.com",
    source: "iQIYI Thailand (X) / ผลค้นหา — ราคาปกติไม่รวมโปรค่ายมือถือ",
    plans: [
      { name: "VIP มาตรฐาน", price: 119, cycle: "monthly" },
      { name: "VIP มาตรฐาน รายปี", price: 1200, cycle: "yearly" },
      { name: "VIP พรีเมียม", price: 199, cycle: "monthly" },
    ],
    cancelSteps: [
      "เข้า iq.com แล้วเข้าสู่ระบบ",
      "ไปที่ ศูนย์ส่วนตัว → VIP ของฉัน → จัดการการต่ออายุอัตโนมัติ",
      "กด ยกเลิกการต่ออายุอัตโนมัติ แล้วยืนยัน",
      ...googlePlayCancel("iQIYI").slice(0, 1),
    ],
  },
  {
    slug: "viu",
    name: "Viu",
    category: "video",
    websiteUrl: "https://www.viu.com/ott/th/",
    source: "ผลค้นหา (ราคาปกติแบบต่ออายุอัตโนมัติ)",
    plans: [{ name: "Premium", price: 149, cycle: "monthly" }],
    cancelSteps: [
      "เข้า viu.com แล้วเข้าสู่ระบบ",
      "ไปที่ บัญชีของฉัน → การเป็นสมาชิก",
      "กด ยกเลิกการต่ออายุอัตโนมัติ แล้วยืนยัน",
      "ถ้าสมัครผ่านค่ายมือถือ ให้ยกเลิกผ่านแอปของค่าย",
    ],
  },
  {
    slug: "wetv",
    name: "WeTV",
    category: "video",
    websiteUrl: "https://wetv.vip/th",
    source: "AIS call center (ราคาปกติรายเดือน)",
    plans: [{ name: "VIP", price: 129, cycle: "monthly" }],
    cancelSteps: [
      "เปิดแอป WeTV → ฉัน → VIP ของฉัน",
      "กด จัดการการต่ออายุอัตโนมัติ → ยกเลิก",
      ...googlePlayCancel("WeTV"),
    ],
  },
  {
    slug: "bilibili",
    name: "Bilibili",
    category: "video",
    websiteUrl: "https://www.bilibili.tv/th",
    source: "App Store TH (แอป bilibili - Anime · Video HD ของ BILIBILI SINGAPORE)",
    plans: [
      { name: "Premium", price: 69, cycle: "monthly" },
      { name: "Premium รายปี", price: 639, cycle: "yearly" },
    ],
    cancelSteps: [
      "ถ้าสมัครบนเว็บ: เข้า bilibili.tv แล้วเข้าสู่ระบบ → รูปโปรไฟล์ → Premium → ยกเลิกการต่ออายุอัตโนมัติ",
      ...storeCancel("bilibili"),
    ],
  },
  {
    slug: "trueid-plus",
    name: "TrueID+",
    category: "video",
    websiteUrl: "https://www.trueid.net",
    source: "App Store TH (TrueID+ Monthly No Promotions / Yearly Package)",
    plans: [
      { name: "รายเดือน", price: 59, cycle: "monthly" },
      { name: "รายปี", price: 599, cycle: "yearly" },
    ],
    cancelSteps: [
      "ถ้าหักผ่านเบอร์ทรู: เปิดแอป True iService เพื่อดูและยกเลิกแพ็กเสริม",
      "ถ้าสมัครในแอป TrueID: ไปที่ บัญชี → แพ็กเกจของฉัน → ยกเลิกการต่ออายุ",
      "ถ้าสมัครผ่าน iPhone: การตั้งค่า → ชื่อของคุณ → การสมัครรับ → TrueID → ยกเลิก",
    ],
  },
  {
    slug: "monomax",
    name: "MONOMAX",
    category: "video",
    websiteUrl: "https://www.monomax.me",
    source: "App Store TH (Entertainment Monthly / Yearly, Sports Basic Monthly)",
    plans: [
      { name: "Entertainment", price: 139, cycle: "monthly" },
      { name: "Entertainment รายปี", price: 859, cycle: "yearly" },
      { name: "Sports Basic", price: 219, cycle: "monthly" },
    ],
    cancelSteps: [
      "เข้า monomax.me แล้วเข้าสู่ระบบ → บัญชีของฉัน → แพ็กเกจของฉัน",
      "กด ยกเลิกการต่ออายุอัตโนมัติ แล้วยืนยัน",
      "ถ้าสมัครผ่าน AIS หรือ iPhone ให้ยกเลิกที่ช่องทางที่สมัคร",
    ],
  },
  {
    slug: "crunchyroll",
    name: "Crunchyroll",
    category: "video",
    websiteUrl: "https://www.crunchyroll.com",
    source: "App Store TH",
    plans: [
      { name: "Fan", price: 99, cycle: "monthly" },
      { name: "Mega Fan", price: 119, cycle: "monthly", maxMembers: 4 },
      { name: "Mega Fan รายปี", price: 999, cycle: "yearly", maxMembers: 4 },
    ],
    cancelSteps: [
      "เข้า crunchyroll.com แล้วเข้าสู่ระบบ → รูปโปรไฟล์ → Settings → Membership Info",
      "กด Cancel Membership แล้วยืนยัน",
      "ถ้าสมัครผ่าน iPhone/Android ต้องยกเลิกที่ร้านแอปแทน",
    ],
  },

  // ─── ฟังเพลง ───
  {
    slug: "spotify",
    name: "Spotify",
    category: "music",
    websiteUrl: "https://www.spotify.com/th-th/premium/",
    source: "official: spotify.com/th-en/premium",
    plans: [
      { name: "Premium Individual", price: 149, cycle: "monthly" },
      { name: "Premium Student", price: 79, cycle: "monthly" },
      { name: "Premium Duo", price: 209, cycle: "monthly", maxMembers: 2 },
      { name: "Premium Family", price: 249, cycle: "monthly", maxMembers: 6 },
    ],
    cancelSteps: [
      "เข้า spotify.com/account แล้วเข้าสู่ระบบ (ยกเลิกในแอปไม่ได้)",
      "ไปที่ การสมัครใช้บริการ → จัดการแพ็กเกจ",
      "กด ยกเลิก Premium แล้วยืนยัน — บัญชีกลับเป็นแบบฟรีเมื่อสิ้นรอบบิล",
    ],
  },
  {
    slug: "apple-music",
    name: "Apple Music",
    category: "music",
    websiteUrl: "https://www.apple.com/th/apple-music/",
    source: "official: apple.com/th/apple-music",
    plans: [
      { name: "รายบุคคล", price: 149, cycle: "monthly" },
      { name: "ครอบครัว", price: 249, cycle: "monthly", maxMembers: 6 },
      { name: "นักศึกษา", price: 79, cycle: "monthly" },
    ],
    cancelSteps: appleCancel,
  },
  {
    slug: "joox",
    name: "JOOX VIP",
    category: "music",
    websiteUrl: "https://www.joox.com/th",
    source: "App Store TH (JOOX VIP monthly subscription)",
    plans: [{ name: "VIP", price: 129, cycle: "monthly" }],
    cancelSteps: ["ถ้าหักผ่านเบอร์มือถือ: ยกเลิกที่แอปของค่ายมือถือ", ...storeCancel("JOOX")],
  },
  {
    slug: "youtube-music",
    name: "YouTube Music",
    category: "music",
    websiteUrl: "https://music.youtube.com",
    source: "App Store TH (ราคา iPhone) — สมัครผ่านเว็บ/Android อาจถูกกว่า",
    plans: [
      { name: "รายบุคคล", price: 199, cycle: "monthly" },
      { name: "ครอบครัว", price: 319, cycle: "monthly", maxMembers: 6 },
    ],
    cancelSteps: [
      "เข้า youtube.com/paid_memberships แล้วเข้าสู่ระบบ",
      "กด จัดการการเป็นสมาชิก ที่ YouTube Music Premium",
      "กด ปิดใช้งาน → ยกเลิก แล้วยืนยัน",
    ],
  },

  // ─── เก็บไฟล์ ───
  {
    slug: "icloud-plus",
    name: "iCloud+",
    category: "storage",
    websiteUrl: "https://www.apple.com/th/icloud/",
    source: "official: support.apple.com/en-us/108047",
    plans: [
      { name: "50 GB", price: 35, cycle: "monthly" },
      { name: "200 GB", price: 99, cycle: "monthly", maxMembers: 6 },
      { name: "2 TB", price: 399, cycle: "monthly", maxMembers: 6 },
      { name: "6 TB", price: 1190, cycle: "monthly", maxMembers: 6 },
    ],
    cancelSteps: [
      "บน iPhone เปิด การตั้งค่า → ชื่อของคุณ → iCloud",
      "แตะ จัดการพื้นที่จัดเก็บบัญชี → เปลี่ยนแผนพื้นที่จัดเก็บข้อมูล",
      "แตะ ตัวเลือกการลดระดับ แล้วเลือก ฟรี 5 GB",
      "ตรวจว่าไฟล์ใน iCloud ไม่เกิน 5 GB ก่อนสิ้นรอบบิล ไม่งั้นข้อมูลใหม่จะไม่ถูกสำรอง",
    ],
  },
  {
    slug: "google-one",
    name: "Google One",
    category: "storage",
    websiteUrl: "https://one.google.com",
    source: "official: one.google.com/about/plans (gl=TH)",
    plans: [
      { name: "Lite 30 GB", price: 30, cycle: "monthly" },
      { name: "Basic 100 GB", price: 70, cycle: "monthly", maxMembers: 6 },
      { name: "Google AI Pro 5 TB", price: 750, cycle: "monthly", maxMembers: 6 },
    ],
    cancelSteps: [
      "เข้า one.google.com แล้วเข้าสู่ระบบ",
      "ไปที่ การตั้งค่า → ยกเลิกการเป็นสมาชิก",
      "ยืนยันการยกเลิก — พื้นที่จะกลับเป็น 15 GB เมื่อสิ้นรอบบิล",
    ],
  },
  {
    slug: "dropbox",
    name: "Dropbox",
    category: "storage",
    websiteUrl: "https://www.dropbox.com/plans",
    source: "App Store TH",
    plans: [
      { name: "Plus 2 TB", price: 379, cycle: "monthly" },
      { name: "Plus 2 TB รายปี", price: 3800, cycle: "yearly" },
      { name: "Family 2 TB", price: 609, cycle: "monthly", maxMembers: 6 },
      { name: "Professional 3 TB", price: 669, cycle: "monthly" },
    ],
    cancelSteps: [
      "เข้า dropbox.com แล้วเข้าสู่ระบบ → รูปโปรไฟล์ → การตั้งค่า → แผน",
      "กด ยกเลิกแผน แล้วทำตามขั้นตอน — กลับเป็น Basic 2 GB เมื่อสิ้นรอบบิล",
      "ถ้าสมัครผ่าน iPhone/Android ต้องยกเลิกที่ร้านแอปแทน",
    ],
  },

  // ─── ทำงาน ───
  {
    slug: "microsoft-365",
    name: "Microsoft 365",
    category: "work",
    websiteUrl: "https://www.microsoft.com/th-th/microsoft-365",
    source: "official: microsoft.com/th-th/microsoft-365/buy",
    plans: [
      { name: "Personal", price: 299, cycle: "monthly" },
      { name: "Personal รายปี", price: 2999, cycle: "yearly" },
      { name: "Family", price: 369, cycle: "monthly", maxMembers: 6 },
      { name: "Family รายปี", price: 3699, cycle: "yearly", maxMembers: 6 },
    ],
    cancelSteps: [
      "เข้า account.microsoft.com/services แล้วเข้าสู่ระบบ",
      "หา Microsoft 365 แล้วกด จัดการ",
      "กด ยกเลิกการสมัครใช้งาน (หรือปิดการเรียกเก็บเงินที่เกิดซ้ำ) แล้วยืนยัน",
    ],
  },
  {
    slug: "canva",
    name: "Canva Pro",
    category: "work",
    websiteUrl: "https://www.canva.com/th_th/pro/",
    source: "ผลค้นหา (comsiam.com, ก.ย. 2569)",
    plans: [{ name: "Pro", price: 230, cycle: "monthly" }],
    cancelSteps: [
      "เข้า canva.com แล้วเข้าสู่ระบบ",
      "ไปที่ การตั้งค่า → การเรียกเก็บเงินและแผน",
      "ที่ Canva Pro กด ยกเลิกการสมัครใช้บริการ แล้วยืนยัน",
    ],
  },
  {
    slug: "chatgpt",
    name: "ChatGPT",
    category: "work",
    websiteUrl: "https://chatgpt.com",
    source: "blognone.com/node/148456",
    plans: [
      { name: "Go", price: 259, cycle: "monthly" },
      { name: "Plus", price: 699, cycle: "monthly" },
    ],
    cancelSteps: [
      "เข้า chatgpt.com แล้วเข้าสู่ระบบ",
      "กดชื่อบัญชีมุมซ้ายล่าง → การตั้งค่า → บัญชี",
      "กด จัดการ ที่แผนปัจจุบัน → ยกเลิกแผน แล้วยืนยัน",
    ],
  },
  {
    slug: "claude",
    name: "Claude",
    category: "work",
    websiteUrl: "https://claude.ai",
    source: "App Store TH — สมัครผ่านเว็บคิดเป็นดอลลาร์ (Pro $20/เดือน) ยอดบาทขึ้นกับอัตราแลกเปลี่ยน",
    plans: [
      { name: "Pro", price: 699, cycle: "monthly" },
      { name: "Pro รายปี", price: 7990, cycle: "yearly" },
      { name: "Max 5x", price: 4990, cycle: "monthly" },
      { name: "Max 20x", price: 9990, cycle: "monthly" },
    ],
    cancelSteps: [
      "เข้า claude.ai แล้วเข้าสู่ระบบ → กดชื่อบัญชี → Settings → Billing",
      "กด Cancel plan แล้วยืนยัน — ใช้ได้ถึงวันสิ้นรอบบิล",
      "ถ้าสมัครผ่าน iPhone/Android ต้องยกเลิกที่ร้านแอปแทน",
    ],
  },
  {
    slug: "perplexity",
    name: "Perplexity Pro",
    category: "work",
    websiteUrl: "https://www.perplexity.ai",
    source: "App Store TH",
    plans: [
      { name: "Pro", price: 699, cycle: "monthly" },
      { name: "Pro รายปี", price: 6990, cycle: "yearly" },
    ],
    cancelSteps: [
      "เข้า perplexity.ai แล้วเข้าสู่ระบบ → Settings → Subscription",
      "กด Manage subscription → Cancel แล้วยืนยัน",
      "ถ้าสมัครผ่าน iPhone/Android ต้องยกเลิกที่ร้านแอปแทน",
    ],
  },
  {
    slug: "notion",
    name: "Notion",
    category: "work",
    websiteUrl: "https://www.notion.com/pricing",
    source: "App Store TH — สมัครผ่านเว็บคิดเป็นดอลลาร์",
    plans: [
      { name: "Plus", price: 399, cycle: "monthly" },
      { name: "Plus รายปี", price: 3990, cycle: "yearly" },
      { name: "Business", price: 899, cycle: "monthly" },
    ],
    cancelSteps: [
      "เปิด Notion → Settings → Billing (ต้องเป็นเจ้าของ workspace)",
      "กด Change plan → เปลี่ยนเป็น Free แล้วยืนยัน",
      "ถ้าสมัครผ่าน iPhone ต้องยกเลิกที่ การตั้งค่า → ชื่อของคุณ → การสมัครรับ",
    ],
  },
  {
    slug: "capcut",
    name: "CapCut Pro",
    category: "work",
    websiteUrl: "https://www.capcut.com",
    source: "App Store TH",
    plans: [
      { name: "Standard", price: 150, cycle: "monthly" },
      { name: "Standard รายปี", price: 909, cycle: "yearly" },
      { name: "Pro", price: 289, cycle: "monthly" },
    ],
    cancelSteps: storeCancel("CapCut"),
  },
  {
    slug: "adobe-photoshop",
    name: "Adobe Photoshop",
    category: "work",
    websiteUrl: "https://www.adobe.com/th/products/photoshop.html",
    source: "App Store TH (Photoshop Mobile & Web)",
    plans: [
      { name: "Mobile & Web", price: 299, cycle: "monthly" },
      { name: "Mobile & Web รายปี", price: 2490, cycle: "yearly" },
    ],
    cancelSteps: [
      "ถ้าสมัครกับ Adobe: เข้า account.adobe.com/plans → จัดการแผน → ยกเลิกแผน",
      "แผนรายปีที่จ่ายรายเดือนอาจมีค่าธรรมเนียมยกเลิกก่อนครบปี อ่านเงื่อนไขก่อนยืนยัน",
      "ถ้าสมัครผ่าน iPhone/Android ต้องยกเลิกที่ร้านแอปแทน",
    ],
  },
  {
    slug: "zoom",
    name: "Zoom Workplace Pro",
    category: "work",
    websiteUrl: "https://www.zoom.com",
    source: "App Store TH",
    plans: [
      { name: "Pro", price: 395, cycle: "monthly" },
      { name: "Pro รายปี", price: 3950, cycle: "yearly" },
    ],
    cancelSteps: [
      "เข้า zoom.us แล้วเข้าสู่ระบบ → การจัดการบัญชี → การเรียกเก็บเงิน",
      "ที่แผนปัจจุบัน กด ยกเลิกการสมัครสมาชิก แล้วยืนยัน",
      "ถ้าสมัครผ่าน iPhone ต้องยกเลิกที่ร้านแอปแทน",
    ],
  },
  {
    slug: "grammarly",
    name: "Grammarly Pro",
    category: "work",
    websiteUrl: "https://www.grammarly.com/plans",
    source: "App Store TH — สมัครผ่านเว็บคิดเป็นดอลลาร์",
    plans: [
      { name: "Pro", price: 989, cycle: "monthly" },
      { name: "Pro รายปี", price: 4500, cycle: "yearly" },
    ],
    cancelSteps: [
      "เข้า account.grammarly.com/subscription แล้วเข้าสู่ระบบ",
      "กด Cancel Subscription แล้วยืนยัน",
      "ถ้าสมัครผ่าน iPhone ต้องยกเลิกที่ร้านแอปแทน",
    ],
  },

  // ─── เกม ───
  {
    slug: "playstation-plus",
    name: "PlayStation Plus",
    category: "game",
    websiteUrl: "https://www.playstation.com/th-th/ps-plus/",
    source: "PlayStation Store TH (ราคา 12 เดือน)",
    plans: [
      { name: "Essential 12 เดือน", price: 2200, cycle: "yearly" },
      { name: "Extra 12 เดือน", price: 3720, cycle: "yearly" },
      { name: "Premium 12 เดือน", price: 4350, cycle: "yearly" },
    ],
    cancelSteps: [
      "บน PS5 ไปที่ การตั้งค่า → ผู้ใช้และบัญชี → บัญชี → การชำระเงินและการสมัครใช้งาน → การสมัครใช้งาน",
      "เลือก PlayStation Plus แล้วเลือก ปิดการต่ออายุอัตโนมัติ",
      "หรือเข้า playstation.com → การจัดการการสมัครใช้งาน บนเว็บ",
    ],
  },
  {
    slug: "discord-nitro",
    name: "Discord Nitro",
    category: "game",
    websiteUrl: "https://discord.com/nitro",
    source: "App Store TH",
    plans: [
      { name: "Nitro Basic", price: 79, cycle: "monthly" },
      { name: "Nitro", price: 219, cycle: "monthly" },
      { name: "Nitro รายปี", price: 2200, cycle: "yearly" },
    ],
    cancelSteps: [
      "เปิด Discord → การตั้งค่าผู้ใช้ (รูปเฟือง) → การสมัครสมาชิก",
      "กด ยกเลิก ที่ Nitro แล้วยืนยัน — ใช้ได้ถึงวันสิ้นรอบบิล",
      "ถ้าสมัครผ่าน iPhone ต้องยกเลิกที่ร้านแอปแทน",
    ],
  },

  // ─── อื่น ๆ ───
  {
    slug: "apple-one",
    name: "Apple One",
    category: "other",
    websiteUrl: "https://www.apple.com/th/apple-one/",
    source: "official: apple.com/th/apple-one",
    plans: [
      { name: "รายบุคคล", price: 369, cycle: "monthly" },
      { name: "ครอบครัว", price: 449, cycle: "monthly", maxMembers: 6 },
    ],
    cancelSteps: appleCancel,
  },
  {
    slug: "shopee-vip",
    name: "Shopee VIP",
    category: "other",
    websiteUrl: "https://shopee.co.th",
    source:
      "ข่าว/รีวิว (thairath.co.th, marketthink.co) — สมัครได้ในแอป Shopee เท่านั้น ราคาโปรเดือนแรกอาจต่างกัน",
    plans: [{ name: "รายเดือน", price: 49, cycle: "monthly" }],
    cancelSteps: [
      "เปิดแอป Shopee → ฉัน → ShopeeVIP",
      "กด จัดการการสมัคร → ยกเลิกการต่ออายุอัตโนมัติ แล้วยืนยัน",
      "สิทธิ์และโค้ดยังใช้ได้ถึงวันสิ้นรอบบิล",
    ],
  },
  {
    slug: "line-man-vip",
    name: "LINE MAN VIP",
    category: "other",
    websiteUrl: "https://lineman.line.me/linemanvip/",
    source: "official: lineman.line.me/linemanvip + wongnai.com",
    plans: [
      { name: "รายเดือน", price: 19, cycle: "monthly" },
      { name: "รายปี", price: 99, cycle: "yearly" },
    ],
    cancelSteps: [
      "เปิดแอป LINE MAN → อื่น ๆ → LINE MAN VIP",
      "กด จัดการแพ็กเกจ → ยกเลิกการต่ออายุ แล้วยืนยัน",
    ],
  },
  {
    slug: "grab-unlimited",
    name: "GrabUnlimited",
    category: "other",
    websiteUrl: "https://www.grab.com/th/grabunlimited/",
    source: "official: grab.com/th/grabunlimited",
    plans: [
      { name: "รายเดือน", price: 19, cycle: "monthly" },
      { name: "รายปี", price: 99, cycle: "yearly" },
    ],
    cancelSteps: [
      "เปิดแอป Grab → บัญชี → GrabUnlimited",
      "กด จัดการการเป็นสมาชิก → ยกเลิกการเป็นสมาชิก แล้วยืนยัน",
    ],
  },
  {
    slug: "telegram-premium",
    name: "Telegram Premium",
    category: "other",
    websiteUrl: "https://telegram.org",
    source: "App Store TH",
    plans: [
      { name: "รายเดือน", price: 179, cycle: "monthly" },
      { name: "รายปี", price: 1290, cycle: "yearly" },
    ],
    cancelSteps: storeCancel("Telegram"),
  },
];

/**
 * โลโก้ของแต่ละบริการ เก็บไว้ใน public/logos (ไม่พึ่งเว็บภายนอกตอน demo)
 * ไอคอนเว็บของบริการ หรือไอคอนแอปจาก App Store (256px) เมื่อไอคอนเว็บความละเอียดต่ำ
 * Netflix/Spotify เป็น SVG จาก Simple Icons (CC0) · LINE MAN/TrueID ใช้ไอคอนเว็บเพราะไอคอนแอปติดสติกเกอร์โปรโมชัน
 */
export const seedLogos: Record<string, string> = {
  netflix: "/logos/netflix.svg",
  "youtube-premium": "/logos/youtube-premium.png",
  "disney-plus-hotstar": "/logos/disney-plus-hotstar.png",
  "hbo-max": "/logos/hbo-max.png",
  "prime-video": "/logos/prime-video.png",
  "apple-tv": "/logos/apple-tv.png",
  iqiyi: "/logos/iqiyi.png",
  viu: "/logos/viu.png",
  wetv: "/logos/wetv.png",
  spotify: "/logos/spotify.svg",
  "apple-music": "/logos/apple-music.png",
  "icloud-plus": "/logos/icloud-plus.png",
  "google-one": "/logos/google-one.png",
  "microsoft-365": "/logos/microsoft-365.png",
  canva: "/logos/canva.png",
  chatgpt: "/logos/chatgpt.png",
  "playstation-plus": "/logos/playstation-plus.png",
  "apple-one": "/logos/apple-one.png",
  bilibili: "/logos/bilibili.png",
  "trueid-plus": "/logos/trueid-plus.png",
  monomax: "/logos/monomax.png",
  crunchyroll: "/logos/crunchyroll.png",
  joox: "/logos/joox.png",
  "youtube-music": "/logos/youtube-music.png",
  dropbox: "/logos/dropbox.png",
  claude: "/logos/claude.png",
  perplexity: "/logos/perplexity.png",
  notion: "/logos/notion.png",
  capcut: "/logos/capcut.png",
  "adobe-photoshop": "/logos/adobe-photoshop.png",
  zoom: "/logos/zoom.png",
  grammarly: "/logos/grammarly.png",
  "discord-nitro": "/logos/discord-nitro.png",
  "shopee-vip": "/logos/shopee-vip.png",
  "line-man-vip": "/logos/line-man-vip.png",
  "grab-unlimited": "/logos/grab-unlimited.png",
  "telegram-premium": "/logos/telegram-premium.png",
};
