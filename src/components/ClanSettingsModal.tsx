import React, { useRef, useState } from 'react';
import {
  X,
  Download,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  FilePlus2,
  Check,
} from 'lucide-react';
import { FamilyTreeData } from '../types/family';
import { validateImportedData } from '../utils/familyOps';

interface ClanSettingsModalProps {
  data: FamilyTreeData;
  canEdit?: boolean;
  onClose: () => void;
  onUpdateClanInfo: (clanName: string, motto: string) => void;
  onImportData: (imported: FamilyTreeData) => void;
  onExportPng: () => Promise<void>;
  onResetSample: () => void;
  onStartFresh: (newClanName: string) => void;
}

export const ClanSettingsModal: React.FC<ClanSettingsModalProps> = ({
  data,
  canEdit = true,
  onClose,
  onUpdateClanInfo,
  onImportData,
  onExportPng,
  onResetSample,
  onStartFresh,
}) => {
  const [clanName, setClanName] = useState(data.clanName);
  const [motto, setMotto] = useState(data.motto || '');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [exportingPng, setExportingPng] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'none' | 'fresh' | 'sample'>('none');
  const [freshName, setFreshName] = useState('ตระกูล...');
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clanName.trim()) return;
    onUpdateClanInfo(clanName.trim(), motto.trim());
    setStatusMsg('บันทึกชื่อและคติประจำตระกูลเรียบร้อยแล้ว');
    setTimeout(() => setStatusMsg(''), 2500);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (data.clanName || 'family_tree').replace(/[^a-zA-Z0-9ก-๙_-]+/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.download = `${safeName}_${dateStamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('ดาวน์โหลดไฟล์สำรอง (.json) เรียบร้อยแล้ว');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const validated = validateImportedData(parsed);
        if (!validated) {
          setErrorMsg('รูปแบบไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์ .json ที่ส่งออกจากแอพนี้');
          return;
        }
        onImportData(validated);
        onClose();
      } catch {
        setErrorMsg('ไม่สามารถอ่านไฟล์ JSON ได้ กรุณาตรวจสอบไฟล์อีกครั้ง');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportPngClick = async () => {
    setExportingPng(true);
    setErrorMsg('');
    try {
      await onExportPng();
      setStatusMsg('ดาวน์โหลดภาพผังตระกูล (PNG) เรียบร้อยแล้ว');
    } catch {
      setErrorMsg('ไม่สามารถสร้างภาพ PNG ได้');
    } finally {
      setExportingPng(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1C2B26]/40 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#E5DFD5] overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-[#FAF8F4] border-b border-[#EAE4DA] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1C2B26] font-serif-thai">
              ตั้งค่าตระกูล & สำรองข้อมูล
            </h2>
            <p className="text-xs text-[#64716C]">
              ข้อมูลทั้งหมดบันทึกอัตโนมัติในเครื่อง และสามารถส่งออกเพื่อแชร์ให้ญาติได้
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64716C] hover:bg-[#EAE4DA] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {statusMsg && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#E9F2EE] border border-[#C4DDD3] text-[#1D473B] text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              {statusMsg}
            </div>
          )}
          {errorMsg && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#FCEEEB] border border-[#ECC5BC] text-[#9E3B28] text-xs">
              {errorMsg}
            </div>
          )}

          {/* Clan Name & Motto */}
          {canEdit && (
            <form onSubmit={handleSaveInfo} className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#8C8477]">
                ข้อมูลประจำตระกูล
              </h4>
              <div>
                <label className="block text-xs font-medium text-[#53615C] mb-1">ชื่อตระกูล</label>
                <input
                  type="text"
                  value={clanName}
                  onChange={(e) => setClanName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#DDD6CA] focus:outline-none focus:border-[#2E6254]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#53615C] mb-1">
                  คติประจำตระกูล / คำอธิบาย
                </label>
                <input
                  type="text"
                  value={motto}
                  onChange={(e) => setMotto(e.target.value)}
                  placeholder="เช่น รากฐานมั่นคง เชื่อมโยงสายใย จากรุ่นสู่รุ่น"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#DDD6CA] focus:outline-none focus:border-[#2E6254]"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#2E6254] text-white text-xs font-medium hover:bg-[#234E42] transition-colors cursor-pointer"
              >
                บันทึกชื่อตระกูล
              </button>
            </form>
          )}

          {/* Export / Import */}
          <div className={`space-y-2.5 ${canEdit ? 'pt-4 border-t border-[#F0ECE4]' : ''}`}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[#8C8477]">
              ส่งออก & นำเข้าข้อมูล
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleExportJson}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-[#E5DFD5] hover:border-[#2E6254] hover:bg-[#FAF8F4] text-left transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-[#E9F2EE] text-[#2E6254] flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#1C2B26]">สำรองไฟล์ JSON</div>
                  <div className="text-[11px] text-[#7C8782]">เก็บสำรองหรือส่งต่อให้ญาติ</div>
                </div>
              </button>

              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-[#E5DFD5] hover:border-[#2E6254] hover:bg-[#FAF8F4] text-left transition-colors cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#F8E7DE] text-[#B5653B] flex items-center justify-center shrink-0">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#1C2B26]">นำเข้าไฟล์ JSON</div>
                      <div className="text-[11px] text-[#7C8782]">กู้คืนหรือเปิดผังจากไฟล์</div>
                    </div>
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </>
              )}
            </div>

            <button
              type="button"
              disabled={exportingPng}
              onClick={handleExportPngClick}
              className="w-full flex items-center gap-2.5 p-3 rounded-xl border border-[#E5DFD5] hover:border-[#2E6254] hover:bg-[#FAF8F4] text-left transition-colors cursor-pointer disabled:opacity-50"
            >
              <div className="w-9 h-9 rounded-lg bg-[#F2EEE7] text-[#5C5347] flex items-center justify-center shrink-0">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#1C2B26]">
                  {exportingPng ? 'กำลังสร้างรูปภาพความละเอียดสูง...' : 'ดาวน์โหลดภาพผังตระกูล (PNG)'}
                </div>
                <div className="text-[11px] text-[#7C8782]">
                  เหมาะสำหรับส่งเข้ากลุ่ม LINE ครอบครัว หรือสั่งพิมพ์เก็บไว้
                </div>
              </div>
            </button>
          </div>

          {/* Start Fresh / Load Sample */}
          {canEdit && (
            <div className="space-y-2.5 pt-4 border-t border-[#F0ECE4]">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#8C8477]">
                เริ่มต้นตระกูลใหม่ / ข้อมูลตัวอย่าง
              </h4>

              {confirmMode === 'none' && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmMode('fresh')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DDD6CA] text-xs font-medium text-[#1C2B26] hover:bg-[#FAF8F4] cursor-pointer"
                  >
                    <FilePlus2 className="w-3.5 h-3.5 text-[#2E6254]" />
                    เริ่มสร้างผังตระกูลใหม่ (ล้างข้อมูลเดิม)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmMode('sample')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DDD6CA] text-xs font-medium text-[#53615C] hover:bg-[#FAF8F4] cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    โหลดข้อมูลตัวอย่าง (ตระกูลกิตติวัฒนากุล)
                  </button>
                </div>
              )}

              {confirmMode === 'fresh' && (
                <div className="p-3.5 rounded-xl bg-[#FAF8F4] border border-[#E5DFD5] space-y-2.5">
                  <div className="text-xs font-medium text-[#1C2B26]">
                    ตั้งชื่อตระกูลใหม่ของคุณ (ข้อมูลเดิมจะถูกแทนที่ สามารถสำรอง JSON ไว้ก่อนได้)
                  </div>
                  <input
                    type="text"
                    value={freshName}
                    onChange={(e) => setFreshName(e.target.value)}
                    placeholder="เช่น ตระกูล ศรีสุข"
                    className="w-full px-3 py-1.5 text-sm rounded-xl border border-[#DDD6CA] bg-white focus:outline-none focus:border-[#2E6254]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onStartFresh(freshName.trim() || 'ผังตระกูลของฉัน');
                        onClose();
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-[#2E6254] text-white text-xs font-medium cursor-pointer"
                    >
                      เริ่มสร้างตระกูลใหม่
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmMode('none')}
                      className="px-3.5 py-1.5 rounded-lg bg-white border border-[#DDD6CA] text-xs text-[#53615C] cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}

              {confirmMode === 'sample' && (
                <div className="p-3.5 rounded-xl bg-[#FCEEEB] border border-[#ECC5BC] space-y-2.5">
                  <p className="text-xs text-[#8E3224]">
                    ยืนยันโหลดข้อมูลตัวอย่างตระกูล 4 รุ่น? ข้อมูลปัจจุบันจะถูกแทนที่
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onResetSample();
                        onClose();
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-[#B54735] text-white text-xs font-medium cursor-pointer"
                    >
                      ยืนยันโหลดตัวอย่าง
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmMode('none')}
                      className="px-3.5 py-1.5 rounded-lg bg-white border border-[#DDD6CA] text-xs text-[#53615C] cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
