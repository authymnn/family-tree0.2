export type Gender = 'male' | 'female' | 'other';

export type SpouseStatus = 'married' | 'divorced' | 'widowed' | 'partner';

export interface SpouseLink {
  spouseId: string;
  status: SpouseStatus;
  familyName?: string;     // ชื่อบ้าน / ชื่อครอบครัว เช่น "บ้านบางรัก", "เรือนสวนเชียงใหม่"
  color?: string;          // สีประจำครอบครัวคู่นี้ (ถ้าไม่ตั้ง ระบบจะสุ่มให้อัตโนมัติ)
  marriageDate?: string;   // YYYY-MM-DD or YYYY
  marriagePlace?: string;  // สถานที่แต่งงาน / จดทะเบียนสมรส
  residence?: string;      // ที่อยู่ของครอบครัวคู่นี้
  note?: string;           // เรื่องราว / บันทึกของคู่นี้
}

export interface PhotoItem {
  id: string;
  url: string;           // Resized JPEG Data URL
  caption?: string;      // คำอธิบายภาพ
  date?: string;         // วันที่ถ่าย (optional)
}

export interface Person {
  id: string;
  title?: string;          // คำนำหน้า เช่น คุณ, ดร., นพ., พญ.
  firstName: string;       // ชื่อจริง
  lastName: string;        // นามสกุล
  maidenName?: string;     // นามสกุลเดิม (ก่อนสมรส)
  nickname?: string;       // ชื่อเล่น
  gender: Gender;
  photo?: string;          // รูปโปรไฟล์ Data URL (resized JPEG)
  gallery?: PhotoItem[];   // อัลบั้มรูปภาพเพิ่มเติม
  birthDate?: string;      // YYYY-MM-DD or YYYY
  birthPlace?: string;     // จังหวัด / สถานที่เกิด
  isDeceased: boolean;
  deathDate?: string;      // YYYY-MM-DD or YYYY
  occupation?: string;     // อาชีพ / ตำแหน่ง
  education?: string;      // การศึกษา
  phone?: string;          // เบอร์โทรศัพท์
  lineId?: string;         // Line ID
  address?: string;        // ที่อยู่ปัจจุบัน / จังหวัด
  branch?: string;         // สายตระกูล เช่น สายบ้านใหญ่, สายเชียงใหม่
  bio?: string;            // ประวัติย่อ / เรื่องเล่า
  notes?: string;          // หมายเหตุสำคัญ (เช่น โรคประจำตัว, แพ้อาหาร, ช่องทางติดต่อฉุกเฉิน)
  parentIds: string[];     // รหัสพ่อ/แม่ (สูงสุด 2 คน)
  spouses: SpouseLink[];   // คู่สมรส
  birthOrder?: number;     // ลำดับบุตร (1, 2, 3...)
  createdAt: string;
  updatedAt: string;
}

export interface FamilyTreeData {
  id: string;
  clanName: string;        // ชื่อตระกูล เช่น "ตระกูล กิตติวัฒนากุล"
  motto?: string;          // คติประจำตระกูล / คำอธิบายสั้น
  rootPersonId?: string;   // บรรพบุรุษหลัก
  members: Record<string, Person>;
  updatedAt: string;
}

export type ViewMode = 'tree' | 'directory' | 'kinship' | 'overview';

export type QuickAddRelation = 'child' | 'parent' | 'spouse' | 'sibling';

export type CardStyle = 'detailed' | 'compact' | 'photo-only';

export type TreeOrientation = 'top-down' | 'bottom-up' | 'left-right';

export type ThemePresetId = 'heirloom' | 'indigo' | 'crimson' | 'celadon' | 'midnight';

export type CanvasBackgroundType = 'dots' | 'tree' | 'house' | 'botanical' | 'custom';

export interface ThemeSettings {
  presetId: ThemePresetId;
  customPrimary?: string;
  customAccent?: string;
  bgType: CanvasBackgroundType;
  customBgImage?: string;  // Data URL of user-uploaded background image
  bgBlur: number;          // 0 - 18 px
  bgOpacity: number;       // 0.1 - 1.0
}

export interface SharedDisplayPreset {
  themeSettings: ThemeSettings;
  cardStyle: CardStyle;
  orientation: TreeOrientation;
  pushedAt: string;        // ISO timestamp so clients apply once per admin push
}
