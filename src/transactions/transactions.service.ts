import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { db } from "../db/db";
import { orders, transactions, users } from "src/db/schema";
import { CreateTransactionDto } from "./dto/create-transaction.dto";

@Injectable()
export class TransactionService {
  async create(dto: CreateTransactionDto) {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, dto.orderId)
    });

    if (!order) throw new NotFoundException("Order not found");

    const user = await db.query.users.findFirst({
      where: eq(users.id, dto.userId)
    });

    if (!user) throw new NotFoundException("User not found");

    const remaining = Number(order.remainingAmount);

    if (dto.amount > remaining) {
      throw new BadRequestException(
        `Payment cannot exceed remaining amount (${remaining})`
      );
    }

    // 1) Create transaction
    const [trx] = await db
      .insert(transactions)
      .values({
        orderId: dto.orderId,
        amount: dto.amount.toFixed(2),
        comment: dto.comment,
        paymentType: dto.paymentType,
        userId: dto.userId
      })
      .returning();

    // 2) Update order remainingAmount
    await db
      .update(orders)
      .set({
        remainingAmount: (remaining - dto.amount).toFixed(2)
      })
      .where(eq(orders.id, dto.orderId));

    return trx;
  }

  async getOrderTransactions(orderId: number) {
    return db.query.transactions.findMany({
      where: eq(transactions.orderId, orderId)
    });
  }
}
