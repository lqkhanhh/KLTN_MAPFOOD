import { request } from '../../api';
export const DOCUMENT_LABELS = { identity_front: 'CCCD mặt trước', identity_back: 'CCCD mặt sau', business_license: 'Giấy phép kinh doanh', food_safety: 'Giấy tờ VSATTP' };
export const APPLICATION_LABELS = { DRAFT: 'Bản nháp', SUBMITTED: 'Chờ Admin duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Cần bổ sung hồ sơ' };
export interface PartnerApplication {
  id: string; status: keyof typeof APPLICATION_LABELS;
  shop: { name: string; address: string; latitude: number; longitude: number; category: string; openingHours: string };
  bank: { bankName: string; accountNumber: string; accountHolder: string } | null;
  user: { fullName: string; email: string; phone?: string };
  documents: { id: string; kind: keyof typeof DOCUMENT_LABELS; mimeType: string; size: number }[];
  termsVersion?: string; acceptedAt?: string; submittedAt?: string; rejectionReason?: string;
  agreements?: { accuracy: boolean; terms: boolean; documentReview: boolean };
}
export interface PartnerTerms { version: string; title: string; notice: string; sections: { title: string; text: string }[] }
export async function downloadDocument(app: PartnerApplication, doc: PartnerApplication['documents'][number]) {
  const blob = await request(`/merchant-applications/${app.id}/documents/${doc.id}`, { responseType: 'blob' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `${doc.kind}.${doc.mimeType === 'application/pdf' ? 'pdf' : doc.mimeType === 'image/png' ? 'png' : 'jpg'}`;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
