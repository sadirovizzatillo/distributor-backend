import { Injectable, NotFoundException } from "@nestjs/common";
import { db } from "../db/db";
import { shops } from "../db/schema";
import { eq } from "drizzle-orm";
import { CreateShopDto } from "./dto/create-shop.dto";
import { UpdateShopDto } from "./dto/update-shop.dto";

@Injectable()
export class ShopsService {
  async create(data: CreateShopDto) {
    const { latitude, longitude, ...rest } = data;
    const values = {
      ...rest,
      latitude: latitude != null ? String(latitude) : undefined,
      longitude: longitude != null ? String(longitude) : undefined,
    };
    const [newShop] = await db.insert(shops).values(values).returning();

    const botUsername = process.env.TELEGRAM_BOT_USERNAME; // or from env: process.env.TELEGRAM_BOT_USERNAME
    const telegramBotLink = `https://t.me/${botUsername}?start=shop_${newShop.id}`;

    await db
      .update(shops)
      .set({ telegramBotLink })
      .where(eq(shops.id, newShop.id));

    return { ...newShop, telegramBotLink };
  }

  async updateChatId(shopId: string, chatId: string) {
    const result = await db
      .update(shops)
      .set({ chatId })
      .where(eq(shops.id, Number(shopId)))
      .returning();

    return result[0];
  }

  async findByChatId(chatId: string) {
    const result = await db
      .select()
      .from(shops)
      .where(eq(shops.chatId, chatId))
      .limit(1);

    return result[0];
  }

  async findAllByUserId(userId: string) {
    console.log(userId);
    return db
      .select()
      .from(shops)
      .where(eq(shops.userId, Number(userId)));
  }

  async findAll() {
    return db.select().from(shops);
  }

  async findOne(id: number) {
    const [shop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, id));

    if (!shop) throw new NotFoundException("Shop not found");

    return shop;
  }

  async update(id: number, data: UpdateShopDto) {
    const { latitude, longitude, ...rest } = data;
    const values: Record<string, unknown> = { ...rest };
    if (latitude !== undefined) {
      values.latitude = latitude != null ? String(latitude) : null;
    }
    if (longitude !== undefined) {
      values.longitude = longitude != null ? String(longitude) : null;
    }
    const [updatedShop] = await db
      .update(shops)
      .set(values)
      .where(eq(shops.id, id))
      .returning();

    if (!updatedShop) throw new NotFoundException("Shop not found");

    return updatedShop;
  }

  async remove(id: number) {
    const [deletedShop] = await db
      .delete(shops)
      .where(eq(shops.id, id))
      .returning();

    if (!deletedShop) throw new NotFoundException("Shop not found");

    return deletedShop;
  }
}
