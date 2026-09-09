import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddMessages1789000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE message_sender_role AS ENUM ('customer', 'merchant')`);
    await queryRunner.query(`CREATE TABLE messages (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "senderId" uuid NOT NULL,
      "senderRole" message_sender_role NOT NULL, content varchar(2000) NOT NULL, "isRead" boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "CHK_messages_content" CHECK (length(trim(content)) > 0),
      CONSTRAINT "FK_messages_order" FOREIGN KEY ("orderId") REFERENCES orders(id) ON DELETE CASCADE,
      CONSTRAINT "FK_messages_sender" FOREIGN KEY ("senderId") REFERENCES users(id) ON DELETE CASCADE
    )`);
    await queryRunner.query('CREATE INDEX "IDX_messages_order_created" ON messages ("orderId", "createdAt", id)');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE messages'); await queryRunner.query('DROP TYPE message_sender_role');
  }
}
