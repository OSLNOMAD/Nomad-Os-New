import { pgTable, serial, varchar, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  passwordHash: text("password_hash"),
  chargebeeCustomerId: varchar("chargebee_customer_id", { length: 255 }),
  isVerified: boolean("is_verified").default(false),
  phoneVerified: boolean("phone_verified").default(false),
  emailVerified: boolean("email_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
  loginCount: integer("login_count").default(0),
});

export const otpCodes = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id),
  code: varchar("code", { length: 6 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'phone' or 'email'
  target: varchar("target", { length: 255 }).notNull(), // phone number or email
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
});

export const customersRelations = relations(customers, ({ many }) => ({
  otpCodes: many(otpCodes),
  sessions: many(sessions),
}));

export const otpCodesRelations = relations(otpCodes, ({ one }) => ({
  customer: one(customers, {
    fields: [otpCodes.customerId],
    references: [customers.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  customer: one(customers, {
    fields: [sessions.customerId],
    references: [customers.id],
  }),
}));

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;
export type OtpCode = typeof otpCodes.$inferSelect;
export type InsertOtpCode = typeof otpCodes.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

export const insertCustomerSchema = createInsertSchema(customers);
export const insertOtpCodeSchema = createInsertSchema(otpCodes);
