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
  type: varchar("type", { length: 20 }).notNull(),
  target: varchar("target", { length: 255 }).notNull(),
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

export const escalationTickets = pgTable("escalation_tickets", {
  id: serial("id").primaryKey(),
  ticketId: varchar("ticket_id", { length: 50 }).notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id),
  customerEmail: varchar("customer_email", { length: 255 }).notNull(),
  subscriptionId: varchar("subscription_id", { length: 255 }),
  iccid: varchar("iccid", { length: 50 }),
  imei: varchar("imei", { length: 50 }),
  issueType: varchar("issue_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).default("open"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  notificationEmail: varchar("notification_email", { length: 255 }),
});

export const customerFeedback = pgTable("customer_feedback", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id),
  customerEmail: varchar("customer_email", { length: 255 }).notNull(),
  feedbackType: varchar("feedback_type", { length: 50 }).notNull(),
  message: text("message").notNull(),
  rating: integer("rating"),
  adminResponse: text("admin_response"),
  respondedAt: timestamp("responded_at"),
  respondedBy: varchar("responded_by", { length: 255 }),
  status: varchar("status", { length: 20 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const portalSettings = pgTable("portal_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  description: varchar("description", { length: 255 }),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by", { length: 255 }),
});

export const cancellationRequests = pgTable("cancellation_requests", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id),
  customerEmail: varchar("customer_email", { length: 255 }).notNull(),
  subscriptionId: varchar("subscription_id", { length: 255 }).notNull(),
  subscriptionStatus: varchar("subscription_status", { length: 50 }),
  currentPrice: integer("current_price"),
  cancellationReason: varchar("cancellation_reason", { length: 100 }),
  reasonDetails: text("reason_details"),
  targetPrice: integer("target_price"),
  retentionOfferShown: varchar("retention_offer_shown", { length: 255 }),
  retentionOfferAccepted: boolean("retention_offer_accepted"),
  discountEligible: boolean("discount_eligible"),
  discountAppliedAt: timestamp("discount_applied_at"),
  troubleshootingOffered: boolean("troubleshooting_offered"),
  troubleshootingAccepted: boolean("troubleshooting_accepted"),
  preferredContactMethod: varchar("preferred_contact_method", { length: 20 }),
  preferredPhone: varchar("preferred_phone", { length: 20 }),
  preferredCallTime: varchar("preferred_call_time", { length: 100 }),
  zendeskTicketId: varchar("zendesk_ticket_id", { length: 100 }),
  slackMessageTs: varchar("slack_message_ts", { length: 100 }),
  status: varchar("status", { length: 50 }).default("started"),
  flowStep: varchar("flow_step", { length: 50 }).default("reason_selection"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const slowSpeedSessions = pgTable("slow_speed_sessions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id),
  customerEmail: varchar("customer_email", { length: 255 }).notNull(),
  subscriptionId: varchar("subscription_id", { length: 255 }).notNull(),
  iccid: varchar("iccid", { length: 50 }),
  imei: varchar("imei", { length: 50 }),
  mdn: varchar("mdn", { length: 20 }),
  issueOnset: varchar("issue_onset", { length: 50 }),
  modemMoved: boolean("modem_moved"),
  refreshPerformed: boolean("refresh_performed").default(false),
  refreshStartedAt: timestamp("refresh_started_at"),
  refreshCompletedAt: timestamp("refresh_completed_at"),
  syncExpiresAt: timestamp("sync_expires_at"),
  sessionState: varchar("session_state", { length: 50 }).default("started"),
  outdoorTestResult: varchar("outdoor_test_result", { length: 50 }),
  speedsImproved: boolean("speeds_improved"),
  escalated: boolean("escalated").default(false),
  escalationTicketId: varchar("escalation_ticket_id", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
export type EscalationTicket = typeof escalationTickets.$inferSelect;
export type InsertEscalationTicket = typeof escalationTickets.$inferInsert;
export type CustomerFeedback = typeof customerFeedback.$inferSelect;
export type InsertCustomerFeedback = typeof customerFeedback.$inferInsert;
export type SlowSpeedSession = typeof slowSpeedSessions.$inferSelect;
export type InsertSlowSpeedSession = typeof slowSpeedSessions.$inferInsert;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = typeof adminUsers.$inferInsert;
export type PortalSetting = typeof portalSettings.$inferSelect;
export type InsertPortalSetting = typeof portalSettings.$inferInsert;
export type CancellationRequest = typeof cancellationRequests.$inferSelect;
export type InsertCancellationRequest = typeof cancellationRequests.$inferInsert;

export const insertCustomerSchema = createInsertSchema(customers);
export const insertOtpCodeSchema = createInsertSchema(otpCodes);
