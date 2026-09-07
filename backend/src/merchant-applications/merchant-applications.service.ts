import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { User, UserRole } from '../database/entities/user.entity';
import { Restaurant } from '../database/entities/restaurant.entity';
import { MerchantApplication, MerchantApplicationDocument, DOCUMENT_KINDS, DocumentKind } from './merchant-application.entity';
import { ApplicationQueryDto, BankDto, SaveApplicationDto, SubmitApplicationDto } from './dto';
import { encryptPrivate, decryptPrivate } from './document-crypto';
import { PARTNER_TERMS } from './terms';

@Injectable()
export class MerchantApplicationsService {
  constructor(private readonly ds: DataSource) {}

  private async actor(id: string, manager = this.ds.manager) {
    const user = await manager.findOneBy(User, { id });
    if (!user) throw new ForbiddenException('Tài khoản không còn tồn tại.');
    return user;
  }
  private async admin(id: string, manager = this.ds.manager) {
    if ((await this.actor(id, manager)).role !== UserRole.ADMIN) throw new ForbiddenException('Chỉ Admin được xét duyệt hồ sơ.');
  }
  private editable(app: MerchantApplication) {
    if (!['DRAFT', 'REJECTED'].includes(app.status)) throw new ConflictException('Hồ sơ đã gửi hoặc đã duyệt, không thể chỉnh sửa.');
  }
  private async locked(userId: string, manager: EntityManager) {
    const app = await manager.findOne(MerchantApplication, { where: { userId }, lock: { mode: 'pessimistic_write' } });
    if (!app) throw new NotFoundException('Hãy lưu thông tin quán trước.');
    this.editable(app);
    return app;
  }
  async mine(userId: string) {
    await this.actor(userId);
    const app = await this.ds.manager.findOneBy(MerchantApplication, { userId });
    return app ? this.detail(app.id, userId) : null;
  }
  async save(userId: string, dto: SaveApplicationDto) {
    await this.ds.transaction(async (manager) => {
      // Khóa user để hai yêu cầu tạo nháp không tạo trùng hồ sơ.
      const user = await manager.findOne(User, { where: { id: userId }, lock: { mode: 'pessimistic_write' } });
      if (!user || user.role !== UserRole.CUSTOMER) throw new ForbiddenException('Chỉ tài khoản khách hàng được đăng ký đối tác mới.');
      let app = await manager.findOne(MerchantApplication, { where: { userId }, lock: { mode: 'pessimistic_write' } });
      if (app) this.editable(app);
      else app = manager.create(MerchantApplication, { userId, status: 'DRAFT' });
      app.shop = dto.shop;
      await manager.save(app);
    });
    return this.mine(userId);
  }
  async bank(userId: string, dto: BankDto) {
    const encrypted = encryptPrivate(Buffer.from(JSON.stringify(dto), 'utf8'));
    await this.ds.transaction(async (manager) => {
      const app = await this.locked(userId, manager);
      app.bankEncrypted = encrypted;
      await manager.save(app);
    });
    return this.mine(userId);
  }
  async upload(userId: string, kind: string, file?: { buffer: Buffer; mimetype: string; size: number }) {
    if (!DOCUMENT_KINDS.includes(kind as DocumentKind)) throw new BadRequestException('Loại giấy tờ không hợp lệ.');
    if (!file?.buffer?.length || file.size > 5 * 1024 * 1024) throw new BadRequestException('Chọn file JPG, PNG hoặc PDF tối đa 5 MB.');
    const bytes = file.buffer;
    const mime = bytes.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf'
      : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : '';
    if (!mime || mime !== file.mimetype) throw new BadRequestException('Nội dung file không đúng định dạng JPG, PNG hoặc PDF.');
    const encryptedContent = encryptPrivate(bytes);
    await this.ds.transaction(async (manager) => {
      const app = await this.locked(userId, manager);
      const existing = await manager.findOneBy(MerchantApplicationDocument, { applicationId: app.id, kind: kind as DocumentKind });
      const doc = manager.create(MerchantApplicationDocument, { ...(existing ? { id: existing.id } : {}), applicationId: app.id, kind: kind as DocumentKind, mimeType: mime, size: bytes.length, encryptedContent });
      await manager.save(doc);
    });
    return this.mine(userId);
  }
  async submit(userId: string, dto: SubmitApplicationDto) {
    if (dto.termsVersion !== PARTNER_TERMS.version) throw new ConflictException('Điều khoản đã thay đổi. Vui lòng tải lại và đọc trước khi xác nhận.');
    await this.ds.transaction(async (manager) => {
      const app = await this.locked(userId, manager);
      const bank = await manager.getRepository(MerchantApplication).createQueryBuilder('app').addSelect('app.bankEncrypted').where('app.id = :id', { id: app.id }).getOneOrFail();
      if (!bank.bankEncrypted) throw new BadRequestException('Chưa lưu thông tin tài khoản ngân hàng.');
      const docs = await manager.findBy(MerchantApplicationDocument, { applicationId: app.id });
      if (!DOCUMENT_KINDS.every((kind) => docs.some((doc) => doc.kind === kind))) throw new BadRequestException('Cần đủ CCCD hai mặt, giấy phép kinh doanh và giấy tờ VSATTP.');
      app.status = 'SUBMITTED'; app.agreements = dto.agreements; app.termsVersion = dto.termsVersion;
      app.acceptedAt = new Date(); app.submittedAt = new Date(); app.reviewedAt = null; app.reviewedById = null; app.rejectionReason = null;
      await manager.save(app);
    });
    return this.mine(userId);
  }
  async list(adminId: string, query: ApplicationQueryDto) {
    await this.admin(adminId);
    const qb = this.ds.getRepository(MerchantApplication).createQueryBuilder('app').leftJoin('app.user', 'user')
      .addSelect(['user.id', 'user.fullName', 'user.email']).orderBy('app.createdAt', 'DESC');
    if (query.status) qb.where('app.status = :status', { status: query.status });
    const [rows, total] = await qb.skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    // Không đưa tài khoản ngân hàng hoặc nội dung giấy tờ vào danh sách.
    return { data: rows.map((app) => ({ id: app.id, user: app.user, shop: app.shop, status: app.status, submittedAt: app.submittedAt, createdAt: app.createdAt })), total, page: query.page, limit: query.limit };
  }
  async detail(id: string, actorId: string) {
    const actor = await this.actor(actorId);
    const app = await this.ds.getRepository(MerchantApplication).createQueryBuilder('app').addSelect('app.bankEncrypted').where('app.id = :id', { id }).getOne();
    if (!app || (actor.role !== UserRole.ADMIN && app.userId !== actorId)) throw new NotFoundException('Không tìm thấy hồ sơ.');
    const owner = await this.actor(app.userId);
    const documents = await this.ds.manager.findBy(MerchantApplicationDocument, { applicationId: app.id });
    const { bankEncrypted, ...safe } = app;
    return { ...safe, user: { id: owner.id, fullName: owner.fullName, email: owner.email, phone: owner.phone },
      bank: bankEncrypted ? JSON.parse(decryptPrivate(bankEncrypted).toString('utf8')) as BankDto : null,
      documents: documents.map(({ id, kind, mimeType, size, updatedAt }) => ({ id, kind, mimeType, size, updatedAt })) };
  }
  async document(id: string, documentId: string, actorId: string) {
    const actor = await this.actor(actorId);
    const app = await this.ds.manager.findOneBy(MerchantApplication, { id });
    if (!app || (actor.role !== UserRole.ADMIN && app.userId !== actorId)) throw new NotFoundException('Không tìm thấy tài liệu.');
    const doc = await this.ds.getRepository(MerchantApplicationDocument).createQueryBuilder('doc').addSelect('doc.encryptedContent').where('doc.id = :documentId AND doc.applicationId = :id', { documentId, id }).getOne();
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.');
    return { content: decryptPrivate(doc.encryptedContent), mimeType: doc.mimeType, filename: `${doc.kind}.${doc.mimeType === 'application/pdf' ? 'pdf' : doc.mimeType === 'image/png' ? 'png' : 'jpg'}` };
  }
  async review(id: string, adminId: string, approve: boolean, reason?: string) {
    await this.admin(adminId);
    const candidate = await this.ds.manager.findOneBy(MerchantApplication, { id });
    if (!candidate) throw new NotFoundException('Không tìm thấy hồ sơ.');
    await this.ds.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id: candidate.userId }, lock: { mode: 'pessimistic_write' } });
      const app = await manager.findOneOrFail(MerchantApplication, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (approve && app.status === 'APPROVED') return;
      if (app.status !== 'SUBMITTED') throw new ConflictException('Chỉ xét duyệt hồ sơ đang chờ duyệt.');
      if (!user || user.role !== UserRole.CUSTOMER) throw new ConflictException('Vai trò tài khoản đã thay đổi. Vui lòng kiểm tra lại.');
      if (approve) {
        const shop = app.shop;
        const restaurant = await manager.save(Restaurant, manager.create(Restaurant, { name: shop.name, address: shop.address, category: shop.category, openingHours: shop.openingHours,
          location: { type: 'Point', coordinates: [shop.longitude, shop.latitude] }, ownerId: user.id, source: 'merchant', active: true }));
        app.restaurantId = restaurant.id; app.status = 'APPROVED'; app.rejectionReason = null;
        // Cập nhật có chọn field, không trả token Admin hay tự đăng nhập thay chủ hồ sơ.
        await manager.update(User, user.id, { role: UserRole.MERCHANT, refreshTokenHash: '' });
      } else { app.status = 'REJECTED'; app.rejectionReason = reason!.trim(); }
      app.reviewedById = adminId; app.reviewedAt = new Date();
      await manager.save(app);
    });
    return this.detail(id, adminId);
  }
}
