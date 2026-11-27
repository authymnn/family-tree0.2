import React, { useState } from 'react';
import {
  X,
  Image as ImageIcon,
  FileSpreadsheet,
  Copy,
  Download,
  Check,
  Share2,
} from 'lucide-react';
import { FamilyTreeData } from '../types/family';
import { ThemePalette } from '../utils/themes';
import { copyFamilyForGoogleSheets, downloadFamilyCsv } from '../utils/familyMerge';

interface ExportShareModalProps {
  data: FamilyTreeData;
  generationMap: Record<string, number>;
  palette: ThemePalette;
  onClose: () => void;
  onExportPng: () => Promise<void>;
}

export const ExportShareModal: React.FC<ExportShareModalProps> = ({
  data,
  generationMap,
  palette,
  onClose,
  onExportPng,
}) => {
  const [exportingPng, setExportingPng] = useState(false);
  const [copiedSheets, setCopiedSheets] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handlePng = async () => {
    setExportingPng(true);
    setErrorMsg('');
    try {
      await onExportPng();
      setStatusMsg('ดาวน์โหลดภาพผังตระกูล (PNG) เรียบร้อยแล้ว');
    } catch {
      setErrorMsg('ไม่สามารถสร้างไฟล์ภาพ PNG ได้');
    } finally {
      setExportingPng(false);
    }
  };

  const handleDownloadCsv = () => {
    setErrorMsg('');
    downloadFamilyCsv(data, generationMap);
    setStatusMsg('ดาวน์โหลดไฟล์ตาราง (.csv) สำหรับเปิดใน Excel / Google Sheets แล้ว');
  };

  const handleCopySheets = async () => {
    setErrorMsg('');
    try {
      await copyFamilyForGoogleSheets(data, generationMap);
      setCopiedSheets(true);
      setStatusMsg('คัดลอกข้อมูลตารางแล้ว! เปิด Google Sheets หรือ Excel แล้วกดวาง (Ctrl+V) ได้เลย');
      setTimeout(() => setCopiedSheets(false), 3000);
    } catch {
      setErrorMsg('เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ กรุณาใช้ปุ่มดาวน์โหลดไฟล์ Sheet (.csv) แทน');
    }
  };

  const handleDownloadJson = () => {
    setErrorMsg('');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (data.clanName || 'family_tree').replace(/[^a-zA-Z0-9ก-๙_-]+/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `${safeName}_backup_${dateStamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('ดาวน์โหลดไฟล์สำรอง (.json) เรียบร้อยแล้ว');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: palette.bgSurface,
          borderColor: palette.border,
          color: palette.textMain,
        }}
        className="w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
          className="px-6 py-4 border-b flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <div
              style={{ backgroundColor: palette.primary }}
              className="w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0"
            >
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold font-serif-thai">
                ดาวน์โหลดรูปผัง & ส่งออก Sheet
              </h2>
              <p style={{ color: palette.textMuted }} className="text-[11px]">
                สมาชิกทุกคนสามารถดาวน์โหลดหรือสำรองข้อมูลเก็บไว้ได้
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: palette.textMuted }}
            className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {statusMsg && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#E9F2EE] border border-[#C4DDD3] text-[#1D473B] text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#FCEEEB] border border-[#ECC5BC] text-[#9E3B28] text-xs">
              {errorMsg}
            </div>
          )}

          {/* 1. Download PNG Tree Image */}
          <button
            type="button"
            disabled={exportingPng}
            onClick={handlePng}
            style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
            className="w-full p-3.5 rounded-xl border hover:opacity-85 text-left flex items-center gap-3 transition-opacity cursor-pointer disabled:opacity-50"
          >
            <div
              style={{ backgroundColor: palette.primarySoft, color: palette.primary }}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            >
              <ImageIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">
                {exportingPng ? 'กำลังสร้างรูปผังความละเอียดสูง...' : 'ดาวน์โหลดรูปผังตระกูล (PNG)'}
              </div>
              <div style={{ color: palette.textMuted }} className="text-[11px]">
                ได้ภาพชัดระดับ 2x ตามรูปแบบและสีที่คุณเลือกอยู่ ส่งเข้ากลุ่ม LINE ได้เลย
              </div>
            </div>
          </button>

          {/* 2. Copy for Google Sheets / Excel */}
          <button
            type="button"
            onClick={handleCopySheets}
            style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
            className="w-full p-3.5 rounded-xl border hover:opacity-85 text-left flex items-center gap-3 transition-opacity cursor-pointer"
          >
            <div
              style={{ backgroundColor: palette.accentSoft, color: palette.accent }}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            >
              {copiedSheets ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">
                {copiedSheets ? 'คัดลอกเรียบร้อย! นำไปกด Ctrl+V ได้เลย' : 'คัดลอกตารางวางใน Google Sheets / Excel'}
              </div>
              <div style={{ color: palette.textMuted }} className="text-[11px]">
                คัดลอกครบทั้ง {Object.keys(data.members).length} คน พร้อมแยกคอลัมน์อัตโนมัติ (รุ่น, พี่น้อง, พ่อแม่, เบอร์โทร, หมายเหตุ)
              </div>
            </div>
          </button>

          {/* 3. Download Sheet (.csv) */}
          <button
            type="button"
            onClick={handleDownloadCsv}
            style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
            className="w-full p-3.5 rounded-xl border hover:opacity-85 text-left flex items-center gap-3 transition-opacity cursor-pointer"
          >
            <div
              style={{ backgroundColor: palette.primarySoft, color: palette.primary }}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">ดาวน์โหลดไฟล์ Sheet (.csv)</div>
              <div style={{ color: palette.textMuted }} className="text-[11px]">
                เปิดใน Microsoft Excel หรือนำเข้า Google Sheets ได้ทันที รองรับภาษาไทยสมบูรณ์
              </div>
            </div>
          </button>

          {/* 4. Backup JSON */}
          <button
            type="button"
            onClick={handleDownloadJson}
            style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
            className="w-full p-3.5 rounded-xl border hover:opacity-85 text-left flex items-center gap-3 transition-opacity cursor-pointer"
          >
            <div
              style={{ backgroundColor: palette.bgSurface, color: palette.textMuted, borderColor: palette.border }}
              className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
            >
              <Download className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">สำรองไฟล์ข้อมูลทั้งหมด (.json)</div>
              <div style={{ color: palette.textMuted }} className="text-[11px]">
                เก็บไฟล์สำรองข้อมูลผังตระกูลไว้ในเครื่อง (ปลอดภัย ไม่กระทบข้อมูลหลัก)
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
