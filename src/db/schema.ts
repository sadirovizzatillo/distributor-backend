import {
  pgTable,
  serial,
  varchar,
  text,
  numeric,
  timestamp,
  integer,
  pgEnum
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const rolesEnum = pgEnum("role", ["agent", "user", "admin"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 12 }).notNull().unique(),
  role: varchar("role", { length: 20 }).default("user"),
  password: varchar("password", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  distributorId: integer("distributor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const shops = pgTable("shops", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: varchar("name", { length: 150 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  telegramBotLink: text("telegram_bot_link"),
  totalDebt: numeric("total_debt").default("0").notNull(),
  chatId: text("chat_id"),
  ownerName: varchar("owner_name", { length: 100 }),
  latitude: numeric("latitude", { precision: 10, scale: 8 }),
  longitude: numeric("longitude", { precision: 11, scale: 8 }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// payments table
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id), // ⭐ Which distributor
  shopId: integer("shop_id")
    .notNull()
    .references(() => shops.id),
  amount: numeric("amount").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).default("cash"),
  receivedBy: integer("received_by").references(() => users.id), // Employee who received
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  shopId: integer("shop_id")
    .notNull()
    .references(() => shops.id),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  remainingAmount: numeric("remaining_amount").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at").defaultNow()
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  priceAtTime: numeric("price_at_time", { precision: 12, scale: 2 }).notNull()
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .references(() => orders.id)
    .notNull(),
  amount: numeric("amount").notNull(),
  comment: text("comment"),
  paymentType: varchar("payment_type").notNull(), // CASH or CARD
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(), // employee or admin performing it
  createdAt: timestamp("created_at").defaultNow()
});

export const shopRelations = relations(shops, ({ many }) => ({
  orders: many(orders)
}));

export const orderRelations = relations(orders, ({ many, one }) => ({
  shop: one(shops, { fields: [orders.shopId], references: [shops.id] }),
  transactions: many(transactions)
}));

// Daily statistics table
export const dailyStatistics = pgTable("daily_statistics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  date: timestamp("date").notNull(),
  totalSales: numeric("total_sales", { precision: 12, scale: 2 }).default("0").notNull(),
  totalOrders: integer("total_orders").default(0).notNull(),
  totalPaymentsReceived: numeric("total_payments_received", { precision: 12, scale: 2 }).default("0").notNull(),
  totalDebt: numeric("total_debt", { precision: 12, scale: 2 }).default("0").notNull(),
  shopsWithDebt: integer("shops_with_debt").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})