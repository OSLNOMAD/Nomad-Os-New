import express from "express";
import cors from "cors";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import { storage } from "./storage";
import { fetchCustomerFullData, fetchChargebeeCatalogItems, fetchChargebeeItemPrices, removeAddonFromSubscription, getSubscriptionCurrentItems, addTravelAddonToSubscription, addPrimeAddonToSubscription, verifySubscriptionOwnership, setApiLogContext, clearApiLogContext, addPromotionalCredit } from "./services";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimiter(windowMs: number, maxRequests: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    let key = req.ip || 'unknown';
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded: any = jwt.verify(token, JWT_SECRET!);
        key = `user:${decoded.customerId || decoded.email || key}`;
      } catch {
        key = `ip:${key}`;
      }
    } else {
      key = `ip:${key}`;
    }

    const routeKey = `${key}:${req.path}`;
    const now = Date.now();
    const entry = rateLimitStore.get(routeKey);

    if (entry && now < entry.resetAt) {
      if (entry.count >= maxRequests) {
        res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
        return res.status(429).json({
          error: 'Too many requests. Please wait before trying again.',
          retryAfter: Math.ceil((entry.resetAt - now) / 1000)
        });
      }
      entry.count++;
    } else {
      rateLimitStore.set(routeKey, { count: 1, resetAt: now + windowMs });
    }

    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

const customerApiLimiter = rateLimiter(30000, 5);
const heavyApiLimiter = rateLimiter(60000, 3);
const authLimiter = rateLimiter(60000, 10);

const app = express();
const PORT = process.env.NODE_ENV === "production" ? 5000 : 3001;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET environment variable is required");
  process.exit(1);
}

app.use(cors());
app.use(express.json());

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post("/api/auth/check-email", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const { checkChargebeeCustomer } = await import('./services');
    const { found: customerFound, customer: chargebeeCustomer } = await checkChargebeeCustomer(email);

    let customer = await storage.getCustomerByEmail(email);
    if (!customer) {
      customer = await storage.createCustomer({ 
        email,
        chargebeeCustomerId: customerFound && chargebeeCustomer?.id ? chargebeeCustomer.id : null
      });
    }

    res.json({ 
      customerFound, 
      customerId: customer.id,
      chargebeeData: customerFound ? chargebeeCustomer : null 
    });
  } catch (error) {
    console.error("Check email error:", error);
    res.status(500).json({ error: "Failed to check email" });
  }
});

app.post("/api/auth/send-phone-otp", authLimiter, async (req, res) => {
  try {
    const { phone, customerId } = req.body;

    if (!phone || !customerId) {
      return res.status(400).json({ error: "Phone and customerId are required" });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await storage.invalidateOtpCodes(phone, "phone");

    await storage.createOtpCode({
      customerId,
      code: otp,
      type: "phone",
      target: phone,
      expiresAt,
    });

    await storage.updateCustomer(customerId, { phone });

    await fetch("https://app.lrlos.com/webhook/twilio/sendotp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        indicator: "phone verification sign up",
        otp,
      }),
    });

    res.json({ success: true, message: "OTP sent to phone" });
  } catch (error) {
    console.error("Send phone OTP error:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

app.post("/api/auth/verify-phone-otp", async (req, res) => {
  try {
    const { phone, code, customerId } = req.body;

    if (!phone || !code || !customerId) {
      return res.status(400).json({ error: "Phone, code, and customerId are required" });
    }

    const otpRecord = await storage.getValidOtpCode(phone, code, "phone");

    if (!otpRecord) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    await storage.markOtpVerified(otpRecord.id);
    await storage.updateCustomer(customerId, { phoneVerified: true });

    res.json({ success: true, message: "Phone verified" });
  } catch (error) {
    console.error("Verify phone OTP error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});

app.post("/api/auth/send-email-otp", authLimiter, async (req, res) => {
  try {
    const { email, customerId } = req.body;

    if (!email || !customerId) {
      return res.status(400).json({ error: "Email and customerId are required" });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await storage.invalidateOtpCodes(email, "email");

    await storage.createOtpCode({
      customerId,
      code: otp,
      type: "email",
      target: email.toLowerCase(),
      expiresAt,
    });

    await fetch("https://app.lrlos.com/webhook/twilio/sendotp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        indicator: "email verification Sign up",
        otp,
      }),
    });

    res.json({ success: true, message: "OTP sent to email" });
  } catch (error) {
    console.error("Send email OTP error:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

app.post("/api/auth/verify-email-only", async (req, res) => {
  try {
    const { email, code, customerId } = req.body;

    if (!email || !code || !customerId) {
      return res.status(400).json({ error: "Email, code, and customerId are required" });
    }

    const otpRecord = await storage.getValidOtpCode(email.toLowerCase(), code, "email");

    if (!otpRecord) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    await storage.markOtpVerified(otpRecord.id);
    await storage.updateCustomer(customerId, { emailVerified: true });

    res.json({ 
      success: true, 
      message: "Email verified"
    });
  } catch (error) {
    console.error("Verify email OTP error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});

app.post("/api/auth/complete-signup", async (req, res) => {
  try {
    const { customerId, password, fullName } = req.body;

    if (!customerId || !password || !fullName) {
      return res.status(400).json({ error: "CustomerId, password, and full name are required" });
    }

    const existingCustomer = await storage.getCustomer(customerId);
    if (!existingCustomer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (!existingCustomer.emailVerified) {
      return res.status(400).json({ error: "Please verify your email first" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const customer = await storage.updateCustomer(customerId, { 
      passwordHash,
      fullName,
      isVerified: true 
    });
    
    await storage.updateLastLogin(customerId);

    const token = jwt.sign(
      { customerId, email: customer?.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    await storage.createSession({
      customerId,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.json({ 
      success: true, 
      message: "Account created and logged in",
      token,
      customer: {
        id: customer?.id,
        email: customer?.email,
        fullName: customer?.fullName,
        phone: customer?.phone,
        isVerified: customer?.isVerified,
        lastLoginAt: customer?.lastLoginAt,
        loginCount: customer?.loginCount,
        createdAt: customer?.createdAt,
      }
    });
  } catch (error) {
    console.error("Complete signup error:", error);
    res.status(500).json({ error: "Sign up failed" });
  }
});

app.post("/api/auth/signin", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const customer = await storage.getCustomerByEmail(email);

    if (!customer) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!customer.passwordHash) {
      return res.status(401).json({ error: "Please complete sign up first or use OTP login" });
    }

    const validPassword = await bcrypt.compare(password, customer.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    await storage.updateLastLogin(customer.id);

    const token = jwt.sign(
      { customerId: customer.id, email: customer.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    await storage.createSession({
      customerId: customer.id,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.json({
      success: true,
      token,
      customer: {
        id: customer.id,
        email: customer.email,
        fullName: customer.fullName,
        phone: customer.phone,
        isVerified: customer.isVerified,
        lastLoginAt: customer.lastLoginAt,
        loginCount: customer.loginCount,
      },
    });
  } catch (error) {
    console.error("Sign in error:", error);
    res.status(500).json({ error: "Sign in failed" });
  }
});

app.post("/api/auth/test-login", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const token = jwt.sign(
      { customerId: -1, email: email.toLowerCase(), isTest: true },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      token,
      customer: {
        id: -1,
        email: email.toLowerCase(),
        fullName: "Test User",
        phone: null,
        isVerified: true,
        chargebeeCustomerId: null,
        loginCount: 1,
        lastLoginAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Test login error:", error);
    res.status(500).json({ error: "Test login failed" });
  }
});

app.post("/api/auth/signin-otp", authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const customer = await storage.getCustomerByEmail(email);

    if (!customer) {
      return res.status(404).json({ error: "No account found with this email" });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await storage.invalidateOtpCodes(email.toLowerCase(), "signin");

    await storage.createOtpCode({
      customerId: customer.id,
      code: otp,
      type: "signin",
      target: email.toLowerCase(),
      expiresAt,
    });

    await fetch("https://app.lrlos.com/webhook/twilio/sendotp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        indicator: "sign in verification",
        otp,
      }),
    });

    res.json({ success: true, customerId: customer.id, message: "OTP sent to email" });
  } catch (error) {
    console.error("Sign in OTP error:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

app.post("/api/auth/verify-signin-otp", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "Email and code are required" });
    }

    const otpRecord = await storage.getValidOtpCode(email.toLowerCase(), code, "signin");

    if (!otpRecord) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    await storage.markOtpVerified(otpRecord.id);

    const customer = await storage.getCustomerByEmail(email);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    await storage.updateLastLogin(customer.id);

    const token = jwt.sign(
      { customerId: customer.id, email: customer.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    await storage.createSession({
      customerId: customer.id,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.json({
      success: true,
      token,
      customer: {
        id: customer.id,
        email: customer.email,
        fullName: customer.fullName,
        phone: customer.phone,
        isVerified: customer.isVerified,
        lastLoginAt: customer.lastLoginAt,
        loginCount: customer.loginCount,
      },
    });
  } catch (error) {
    console.error("Verify sign in OTP error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { customerId: number; email?: string; isTest?: boolean };

    if (decoded.isTest && decoded.email) {
      return res.json({
        customer: {
          id: -1,
          email: decoded.email,
          fullName: "Test User",
          phone: null,
          isVerified: true,
          lastLoginAt: new Date().toISOString(),
          loginCount: 1,
          createdAt: new Date().toISOString(),
        },
      });
    }

    const session = await storage.getSessionByToken(token);
    if (!session) {
      return res.status(401).json({ error: "Session expired" });
    }

    const customer = await storage.getCustomer(decoded.customerId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json({
      customer: {
        id: customer.id,
        email: customer.email,
        fullName: customer.fullName,
        phone: customer.phone,
        isVerified: customer.isVerified,
        lastLoginAt: customer.lastLoginAt,
        loginCount: customer.loginCount,
        createdAt: customer.createdAt,
      },
    });
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      await storage.deleteSession(token);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Logout failed" });
  }
});

app.post("/api/auth/check-existing-user", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const customer = await storage.getCustomerByEmail(email);
    
    if (customer && customer.passwordHash) {
      return res.json({ 
        exists: true, 
        hasPassword: true,
        message: "An account with this email already exists. Please sign in instead."
      });
    }

    res.json({ exists: false, hasPassword: false });
  } catch (error) {
    console.error("Check existing user error:", error);
    res.status(500).json({ error: "Failed to check user" });
  }
});

app.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const customer = await storage.getCustomerByEmail(email);

    if (!customer) {
      return res.status(404).json({ error: "No account found with this email" });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await storage.invalidateOtpCodes(email.toLowerCase(), "forgot_password");
    invalidateResetTokensForEmail(email);

    await storage.createOtpCode({
      customerId: customer.id,
      code: otp,
      type: "forgot_password",
      target: email.toLowerCase(),
      expiresAt,
    });

    await fetch("https://app.lrlos.com/webhook/twilio/sendotp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        indicator: "Email OTP forgot password",
        otp,
      }),
    });

    res.json({ success: true, customerId: customer.id, message: "OTP sent to email" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

const resetTokens = new Map<string, { email: string; expiresAt: Date }>();

function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function invalidateResetTokensForEmail(email: string): void {
  const normalizedEmail = email.toLowerCase();
  for (const [token, data] of resetTokens.entries()) {
    if (data.email === normalizedEmail) {
      resetTokens.delete(token);
    }
  }
}

app.post("/api/auth/verify-forgot-password-otp", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "Email and code are required" });
    }

    const otpRecord = await storage.getValidOtpCode(email.toLowerCase(), code, "forgot_password");

    if (!otpRecord) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    await storage.markOtpVerified(otpRecord.id);

    const customer = await storage.getCustomerByEmail(email);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    resetTokens.set(resetToken, { email: email.toLowerCase(), expiresAt });

    res.json({ 
      success: true, 
      customerId: customer.id,
      resetToken,
      message: "OTP verified. You can now reset your password."
    });
  } catch (error) {
    console.error("Verify forgot password OTP error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, password, resetToken } = req.body;

    if (!email || !password || !resetToken) {
      return res.status(400).json({ error: "Email, password, and reset token are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const tokenData = resetTokens.get(resetToken);
    if (!tokenData) {
      return res.status(400).json({ error: "Invalid or expired reset token. Please request a new verification code." });
    }

    if (tokenData.email !== email.toLowerCase()) {
      return res.status(400).json({ error: "Reset token does not match email" });
    }

    if (new Date() > tokenData.expiresAt) {
      resetTokens.delete(resetToken);
      return res.status(400).json({ error: "Reset token expired. Please request a new verification code." });
    }

    const customer = await storage.getCustomerByEmail(email);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await storage.updateCustomer(customer.id, { passwordHash });

    resetTokens.delete(resetToken);

    res.json({ success: true, message: "Password reset successfully. Please sign in with your new password." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

app.post("/api/auth/update-name", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const session = await storage.getSessionByToken(token);
    if (!session || new Date() > session.expiresAt) {
      return res.status(401).json({ error: "Session expired" });
    }

    const { fullName } = req.body;
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    await storage.updateCustomer(session.customerId, { fullName: fullName.trim() });
    res.json({ success: true, message: "Name updated successfully" });
  } catch (error) {
    console.error("Update name error:", error);
    res.status(500).json({ error: "Failed to update name" });
  }
});

app.post("/api/auth/update-password", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const session = await storage.getSessionByToken(token);
    if (!session || new Date() > session.expiresAt) {
      return res.status(401).json({ error: "Session expired" });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new passwords are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }

    const customer = await storage.getCustomer(session.customerId);
    if (!customer || !customer.passwordHash) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, customer.passwordHash);
    if (!isValidPassword) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await storage.updateCustomer(session.customerId, { passwordHash });
    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Update password error:", error);
    res.status(500).json({ error: "Failed to update password" });
  }
});

app.post("/api/auth/request-phone-change", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const session = await storage.getSessionByToken(token);
    if (!session || new Date() > session.expiresAt) {
      return res.status(401).json({ error: "Session expired" });
    }

    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const existingCustomer = await storage.getCustomerByPhone(phone);
    if (existingCustomer && existingCustomer.id !== session.customerId) {
      return res.status(400).json({ error: "This phone number is already in use by another account" });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await storage.invalidateOtpCodes(phone, "phone_change");

    await storage.createOtpCode({
      customerId: session.customerId,
      code: otp,
      type: "phone_change",
      target: phone,
      expiresAt,
    });

    await fetch("https://app.lrlos.com/webhook/twilio/sendotp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: phone,
        otp,
        indicator: "Phone verification for account update",
      }),
    });

    res.json({ success: true, message: "Verification code sent" });
  } catch (error) {
    console.error("Request phone change error:", error);
    res.status(500).json({ error: "Failed to send verification code" });
  }
});

app.post("/api/auth/verify-phone-change", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const session = await storage.getSessionByToken(token);
    if (!session || new Date() > session.expiresAt) {
      return res.status(401).json({ error: "Session expired" });
    }

    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ error: "Phone and code are required" });
    }

    const existingCustomer = await storage.getCustomerByPhone(phone);
    if (existingCustomer && existingCustomer.id !== session.customerId) {
      return res.status(400).json({ error: "This phone number is already in use by another account" });
    }

    const otpRecord = await storage.verifyOtpCode(phone, code, "phone_change");
    if (!otpRecord) {
      return res.status(400).json({ error: "Invalid or expired verification code" });
    }

    if (otpRecord.customerId !== session.customerId) {
      return res.status(400).json({ error: "Verification code does not match your account" });
    }

    await storage.updateCustomer(session.customerId, { phone });
    res.json({ success: true, message: "Phone number updated successfully" });
  } catch (error) {
    console.error("Verify phone change error:", error);
    res.status(500).json({ error: "Failed to verify phone number" });
  }
});

app.get("/api/customer/full-data", heavyApiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { customerId: number; email?: string; isTest?: boolean };

    let email: string;
    if (decoded.isTest && decoded.email) {
      email = decoded.email;
    } else {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }

      const customer = await storage.getCustomer(session.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      email = customer.email;
    }

    setApiLogContext({ customerEmail: email, triggeredBy: 'customer-full-data' });
    try {
      const fullData = await fetchCustomerFullData(email);
      res.json(fullData);
    } finally {
      clearApiLogContext();
    }
  } catch (error) {
    console.error("Fetch full data error:", error);
    clearApiLogContext();
    res.status(500).json({ error: "Failed to fetch customer data" });
  }
});

app.post("/api/chat", customerApiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { customerId: number; email?: string; isTest?: boolean };

    let email: string;
    if (decoded.isTest && decoded.email) {
      email = decoded.email;
    } else {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }

      const customer = await storage.getCustomer(session.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      email = customer.email;
    }

    const { message, conversationHistory } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    setApiLogContext({ customerEmail: email, triggeredBy: 'chat' });
    try {
      const { handleChatMessage } = await import('./chat');
      const fullData = await fetchCustomerFullData(email);
      const result = await handleChatMessage(
        fullData,
        email,
        message,
        conversationHistory || []
      );
      res.json(result);
    } finally {
      clearApiLogContext();
    }
  } catch (error: any) {
    clearApiLogContext();
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message || "Failed to process chat message" });
  }
});

app.post("/api/billing/collect-now-url", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let isTestToken = false;

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}

    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      customerEmail = customer.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Could not determine customer" });
    }

    const { chargebeeCustomerId, redirectUrl } = req.body;
    if (!chargebeeCustomerId) {
      return res.status(400).json({ error: "Chargebee customer ID is required" });
    }

    const { createCollectNowHostedPage } = await import('./services');
    const result = await createCollectNowHostedPage(
      chargebeeCustomerId,
      redirectUrl || `${req.protocol}://${req.get('host')}/dashboard?payment=success`
    );

    if (!result) {
      return res.status(500).json({ error: "Failed to create payment page" });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Collect now URL error:", error);
    res.status(500).json({ error: error.message || "Failed to create payment page" });
  }
});

app.post("/api/billing/update-payment-method-url", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let isTestToken = false;

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}

    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      customerEmail = customer.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Could not determine customer" });
    }

    const { chargebeeCustomerId, redirectUrl } = req.body;
    if (!chargebeeCustomerId) {
      return res.status(400).json({ error: "Chargebee customer ID is required" });
    }

    const { createUpdatePaymentMethodHostedPage } = await import('./services');
    const result = await createUpdatePaymentMethodHostedPage(
      chargebeeCustomerId,
      redirectUrl || `${req.protocol}://${req.get('host')}/dashboard?payment_updated=success`
    );

    if (!result) {
      return res.status(500).json({ error: "Failed to create payment method update page" });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Update payment method URL error:", error);
    res.status(500).json({ error: error.message || "Failed to create payment method update page" });
  }
});

app.post("/api/billing/collect-payment", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const session = await storage.getSessionByToken(token);
    if (!session) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const customer = await storage.getCustomer(session.customerId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const { invoiceId } = req.body;
    if (!invoiceId) {
      return res.status(400).json({ error: "Invoice ID is required" });
    }

    const { fetchChargebeeData, collectPaymentForInvoice } = await import('./services');
    const chargebeeData = await fetchChargebeeData(customer.email);
    
    const allInvoiceIds = chargebeeData.customers.flatMap(c => c.invoices.map(inv => inv.id));
    if (!allInvoiceIds.includes(invoiceId)) {
      return res.status(403).json({ error: "Invoice not found for this customer" });
    }

    const result = await collectPaymentForInvoice(invoiceId);

    if (!result.success) {
      return res.status(400).json({ error: result.error || "Payment collection failed" });
    }

    res.json({ success: true, message: "Payment collected successfully" });
  } catch (error: any) {
    console.error("Collect payment error:", error);
    res.status(500).json({ error: error.message || "Failed to collect payment" });
  }
});

app.post("/api/billing/pay-early", heavyApiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { customerId: number; email?: string; isTest?: boolean };

    let customerEmail: string;
    let customerId: number;
    let chargebeeCustomerId: string | undefined;

    if (decoded.isTest && decoded.email) {
      customerEmail = decoded.email;
      customerId = -1;
    } else {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      customerEmail = customer.email;
      customerId = customer.id;
      chargebeeCustomerId = customer.chargebeeCustomerId || undefined;
    }

    const { subscriptionId, termsToCharge } = req.body;
    if (!subscriptionId) {
      return res.status(400).json({ error: "Subscription ID is required" });
    }
    if (!termsToCharge || termsToCharge < 1 || termsToCharge > 12) {
      return res.status(400).json({ error: "Number of terms must be between 1 and 12" });
    }

    const { verifySubscriptionOwnership, billFutureRenewals, chargebeeApiPost } = await import('./services');
    const owns = await verifySubscriptionOwnership(customerEmail, subscriptionId);
    if (!owns) {
      return res.status(403).json({ error: "Subscription not found for this customer" });
    }

    const { planId, planName } = req.body;
    const result = await billFutureRenewals(subscriptionId, termsToCharge);

    if (!result.success) {
      try {
        await storage.createEarlyPaymentLog({
          customerId,
          customerEmail,
          subscriptionId,
          chargebeeCustomerId,
          planId: planId || undefined,
          planName: planName || undefined,
          termsCharged: termsToCharge,
          status: "failed",
          errorMessage: result.error || "Failed to process early payment",
        });
      } catch (logErr) {
        console.error("Failed to log early payment failure:", logErr);
      }
      return res.status(400).json({ error: result.error || "Failed to process early payment" });
    }

    try {
      await storage.createEarlyPaymentLog({
        customerId,
        customerEmail,
        subscriptionId,
        chargebeeCustomerId,
        planId: planId || undefined,
        planName: planName || undefined,
        termsCharged: termsToCharge,
        invoiceId: result.invoiceId || undefined,
        totalAmount: result.total || undefined,
        status: "completed",
      });
    } catch (logErr) {
      console.error("Failed to log early payment:", logErr);
    }

    try {
      const totalFormatted = result.total ? `$${(result.total / 100).toFixed(2)}` : 'N/A';
      await chargebeeApiPost('/comments', {
        'entity_type': 'subscription',
        'entity_id': subscriptionId,
        'notes': `Customer paid early for ${termsToCharge} future renewal period(s) via the Customer Portal. Invoice ID: ${result.invoiceId || 'N/A'}. Total charged: ${totalFormatted}.`
      });
    } catch (commentErr) {
      console.error("Failed to add Chargebee comment for early payment:", commentErr);
    }

    res.json({
      success: true,
      invoiceId: result.invoiceId,
      total: result.total ? result.total / 100 : undefined,
      message: `Successfully billed for ${termsToCharge} future renewal(s)`,
    });
  } catch (error: any) {
    console.error("Pay early error:", error);
    res.status(500).json({ error: error.message || "Failed to process early payment" });
  }
});

app.get("/api/billing/invoice/:invoiceId/pdf", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const session = await storage.getSessionByToken(token);
    
    let customerEmail: string | null = null;
    
    if (session) {
      const customer = await storage.getCustomer(session.customerId);
      if (customer) {
        customerEmail = customer.email;
      }
    } else {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded.isTest) {
          customerEmail = decoded.email || "test@example.com";
        }
      } catch {}
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const { invoiceId } = req.params;
    if (!invoiceId) {
      return res.status(400).json({ error: "Invoice ID is required" });
    }

    const { fetchChargebeeData, getInvoicePdfUrl } = await import('./services');
    const chargebeeData = await fetchChargebeeData(customerEmail);
    
    const allInvoiceIds = chargebeeData.customers.flatMap(c => c.invoices.map(inv => inv.id));
    if (!allInvoiceIds.includes(invoiceId)) {
      return res.status(403).json({ error: "Invoice not found for this customer" });
    }

    const result = await getInvoicePdfUrl(invoiceId);

    if (!result) {
      return res.status(500).json({ error: "Failed to generate invoice PDF" });
    }

    res.json({ downloadUrl: result.url, validTill: result.validTill });
  } catch (error: any) {
    console.error("Invoice PDF error:", error);
    res.status(500).json({ error: error.message || "Failed to get invoice PDF" });
  }
});

app.get("/api/billing/credit-note/:creditNoteId/pdf", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const session = await storage.getSessionByToken(token);
    
    let customerEmail: string | null = null;
    
    if (session) {
      const customer = await storage.getCustomer(session.customerId);
      if (customer) {
        customerEmail = customer.email;
      }
    } else {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded.isTest) {
          customerEmail = decoded.email || "test@example.com";
        }
      } catch {}
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const { creditNoteId } = req.params;
    if (!creditNoteId) {
      return res.status(400).json({ error: "Credit Note ID is required" });
    }

    const { fetchChargebeeData, getCreditNotePdfUrl } = await import('./services');
    const chargebeeData = await fetchChargebeeData(customerEmail);
    
    const allCreditNoteIds = chargebeeData.customers.flatMap(c => c.creditNotes.map(cn => cn.id));
    if (!allCreditNoteIds.includes(creditNoteId)) {
      return res.status(403).json({ error: "Credit note not found for this customer" });
    }

    const result = await getCreditNotePdfUrl(creditNoteId);

    if (!result) {
      return res.status(500).json({ error: "Failed to generate credit note PDF" });
    }

    res.json({ downloadUrl: result.url, validTill: result.validTill });
  } catch (error: any) {
    console.error("Credit Note PDF error:", error);
    res.status(500).json({ error: error.message || "Failed to get credit note PDF" });
  }
});

app.post("/api/device/suspend", heavyApiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let isTestToken = false;

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}

    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      customerEmail = customer.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Could not determine customer" });
    }

    const { identifier, identifierType = 'iccid' } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: "Device identifier is required" });
    }

    const { suspendDevice } = await import('./services');
    const result = await suspendDevice(identifier, identifierType);

    if (!result.success) {
      return res.status(400).json({ error: result.error || "Failed to suspend device" });
    }

    res.json({ 
      success: true, 
      message: "Device suspend request submitted",
      requestId: result.requestId 
    });
  } catch (error: any) {
    console.error("Suspend device error:", error);
    res.status(500).json({ error: error.message || "Failed to suspend device" });
  }
});

app.post("/api/device/resume", heavyApiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let isTestToken = false;

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}

    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      customerEmail = customer.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Could not determine customer" });
    }

    const { identifier, identifierType = 'iccid' } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: "Device identifier is required" });
    }

    const { resumeDevice } = await import('./services');
    const result = await resumeDevice(identifier, identifierType);

    if (!result.success) {
      return res.status(400).json({ error: result.error || "Failed to resume device" });
    }

    res.json({ 
      success: true, 
      message: "Device resume request submitted",
      requestId: result.requestId 
    });
  } catch (error: any) {
    console.error("Resume device error:", error);
    res.status(500).json({ error: error.message || "Failed to resume device" });
  }
});

app.post("/api/device/status", customerApiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let isTestToken = false;

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}

    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      customerEmail = customer.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Could not determine customer" });
    }

    const { identifier, identifierType = 'iccid' } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: "Device identifier is required" });
    }

    setApiLogContext({ customerEmail: customerEmail || undefined, triggeredBy: 'device-status' });
    try {
      const { getDeviceStatus } = await import('./services');
      const device = await getDeviceStatus(identifier, identifierType);

      if (!device) {
        return res.status(404).json({ error: "Device not found" });
      }

      res.json({ success: true, device });
    } finally {
      clearApiLogContext();
    }
  } catch (error: any) {
    clearApiLogContext();
    console.error("Device status error:", error);
    res.status(500).json({ error: error.message || "Failed to get device status" });
  }
});

app.post("/api/device/activate-line", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let customerId: number | null = null;
    let isTestToken = false;

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}

    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      customerEmail = customer.email;
      customerId = customer.id;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Could not determine customer" });
    }

    const { 
      imei, 
      iccid, 
      subscriptionId, 
      subscriptionStatus,
      chargebeeCustomerId,
      customerFirstName,
      customerLastName,
      inGracePeriod,
      dueInvoicesCount,
      totalDues,
      notificationEmail 
    } = req.body;

    if (!iccid && !imei) {
      return res.status(400).json({ error: "ICCID or IMEI is required" });
    }

    const webhookPayload = {
      imei: imei || "",
      iccid: iccid || "",
      customerEmail: notificationEmail || customerEmail,
      subscriptionId: subscriptionId || "",
      subscriptionStatus: subscriptionStatus || "unknown",
      customerId: chargebeeCustomerId || String(customerId || ""),
      customerFirstName: customerFirstName || "",
      customerLastName: customerLastName || "",
      inGracePeriod: inGracePeriod || false,
      dueInvoicesCount: dueInvoicesCount || 0,
      totalDues: totalDues || 0,
      lineState: "not_found",
      source: "customer_portal_troubleshoot"
    };

    console.log("Sending activate line webhook:", webhookPayload);

    const response = await fetch("https://app.lrlos.com/webhook/botpress/activateline", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(webhookPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Activate line webhook error:", errorText);
      return res.status(500).json({ error: "Failed to submit activation request" });
    }

    res.json({ 
      success: true, 
      message: "Line activation request submitted",
      notificationEmail: notificationEmail || customerEmail
    });
  } catch (error: any) {
    console.error("Activate line error:", error);
    res.status(500).json({ error: error.message || "Failed to submit activation request" });
  }
});

app.post("/api/escalation/check", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let isTestToken = false;

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}

    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      customerEmail = customer.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Could not determine customer" });
    }

    const { subscriptionId, iccid } = req.body;

    const existingTicket = await storage.getRecentEscalation(
      customerEmail,
      subscriptionId || null,
      iccid || null
    );

    if (existingTicket) {
      const createdAt = new Date(existingTicket.createdAt!);
      const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
      
      res.json({
        hasRecentEscalation: true,
        ticketId: existingTicket.ticketId,
        createdAt: existingTicket.createdAt,
        hoursRemaining: Math.max(0, Math.ceil(24 - hoursSinceCreation)),
        canEscalateAgain: hoursSinceCreation >= 24
      });
    } else {
      res.json({
        hasRecentEscalation: false,
        canEscalateAgain: true
      });
    }
  } catch (error: any) {
    console.error("Check escalation error:", error);
    res.status(500).json({ error: error.message || "Failed to check escalation status" });
  }
});

app.post("/api/escalation/create", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let customerId: number | null = null;
    let isTestToken = false;

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}

    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      customerEmail = customer.email;
      customerId = customer.id;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Could not determine customer" });
    }

    const { subscriptionId, iccid, imei, issueType, notificationEmail } = req.body;

    const existingTicket = await storage.getRecentEscalation(
      customerEmail,
      subscriptionId || null,
      iccid || null
    );

    if (existingTicket) {
      const createdAt = new Date(existingTicket.createdAt!);
      const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceCreation < 24) {
        return res.status(400).json({
          error: "An escalation ticket already exists for this issue",
          ticketId: existingTicket.ticketId,
          hoursRemaining: Math.ceil(24 - hoursSinceCreation)
        });
      }
    }

    const ticketId = `ESC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const ticket = await storage.createEscalationTicket({
      ticketId,
      customerId: customerId,
      customerEmail: customerEmail.toLowerCase(),
      subscriptionId: subscriptionId || null,
      iccid: iccid || null,
      imei: imei || null,
      issueType: issueType || "line_restoration",
      notificationEmail: notificationEmail || null
    });

    console.log("Escalation ticket created:", ticketId);

    res.json({
      success: true,
      ticketId: ticket.ticketId,
      message: "Escalation ticket created successfully"
    });
  } catch (error: any) {
    console.error("Create escalation error:", error);
    res.status(500).json({ error: error.message || "Failed to create escalation ticket" });
  }
});

app.post("/api/troubleshooting/submit-ticket", customerApiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let customerId: number | null = null;

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (decoded.isTest) {
        customerEmail = decoded.email;
      }
    } catch (e) {}

    if (!customerEmail) {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      customerEmail = customer.email;
      customerId = customer.id;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Could not determine customer" });
    }

    const {
      subscriptionId,
      iccid,
      imei,
      mdn,
      issueType,
      contactMethod,
      phone,
      callTime,
      additionalNotes,
      lineStatus,
      servicePlan,
      troubleshootingSteps
    } = req.body;

    if (!contactMethod) {
      return res.status(400).json({ error: "Please select a preferred contact method" });
    }
    if (contactMethod === 'phone' && !phone) {
      return res.status(400).json({ error: "Phone number is required when choosing phone contact" });
    }
    if (!additionalNotes || additionalNotes.trim().length < 10) {
      return res.status(400).json({ error: "Please provide at least 10 characters describing your issue" });
    }

    const customer = await storage.getCustomerByEmail(customerEmail);

    const zendeskSubdomain = process.env.ZENDESK_SUBDOMAIN;
    const zendeskEmail = process.env.ZENDESK_EMAIL;
    const zendeskToken = process.env.ZENDESK_API_TOKEN;

    const groupIdSetting = await storage.getPortalSetting("zendesk_troubleshooting_group_id");
    const groupId = groupIdSetting?.value || "41909825396372";
    const assigneeIdSetting = await storage.getPortalSetting("zendesk_troubleshooting_assignee_id");
    const assigneeId = assigneeIdSetting?.value && assigneeIdSetting.value !== 'none' ? assigneeIdSetting.value : null;

    let zendeskTicketId: string | null = null;

    if (zendeskSubdomain && zendeskEmail && zendeskToken) {
      try {
        const issueLabel = issueType === 'slow_speed' ? 'Slow Speed' : issueType === 'no_internet' ? 'No Internet' : issueType === 'line_restoration' ? 'Line Restoration' : (issueType || 'General').replace(/_/g, ' ');

        const ticketBody: any = {
          ticket: {
            subject: `Troubleshooting Support - ${issueLabel} - ${subscriptionId || 'N/A'}`,
            comment: {
              body: `Customer troubleshooting support request submitted through portal.

═══════════════════════════════════════
CUSTOMER INFORMATION
═══════════════════════════════════════
Customer Email: ${customerEmail}
Customer Name: ${customer?.fullName || "N/A"}
Subscription ID: ${subscriptionId || "N/A"}

═══════════════════════════════════════
DEVICE INFORMATION
═══════════════════════════════════════
ICCID: ${iccid || "N/A"}
IMEI: ${imei || "N/A"}
MDN: ${mdn || "N/A"}
Current Line Status: ${lineStatus || "Unknown"}
Service Plan: ${servicePlan || "N/A"}

═══════════════════════════════════════
ISSUE DETAILS
═══════════════════════════════════════
Issue Type: ${issueLabel}
${troubleshootingSteps ? `Troubleshooting Steps Completed:\n${troubleshootingSteps}` : "Customer completed all automated troubleshooting steps via portal."}

═══════════════════════════════════════
CONTACT PREFERENCES
═══════════════════════════════════════
Preferred Contact: ${contactMethod === "email" ? "Email" : "Phone Call"}
${contactMethod === 'phone' && phone ? `Phone Number: ${phone}` : ""}
${callTime ? `Preferred Call Time: ${callTime}` : ""}

═══════════════════════════════════════
CUSTOMER'S DESCRIPTION
═══════════════════════════════════════
${additionalNotes.trim()}

═══════════════════════════════════════
ACTION REQUIRED: Tier 1 Support - Please follow up with customer within 24 hours using their preferred contact method.`,
              public: false
            },
            requester: { email: customerEmail, name: customer?.fullName || customerEmail },
            group_id: parseInt(groupId),
            priority: "normal",
            tags: ["troubleshooting", "tier1_support", "portal", issueType || "general"]
          }
        };

        if (assigneeId) {
          ticketBody.ticket.assignee_id = parseInt(assigneeId);
        }

        const zendeskResponse = await fetch(
          `https://${zendeskSubdomain}.zendesk.com/api/v2/tickets.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Basic " + Buffer.from(`${zendeskEmail}/token:${zendeskToken}`).toString("base64")
            },
            body: JSON.stringify(ticketBody)
          }
        );

        if (zendeskResponse.ok) {
          const zendeskData = await zendeskResponse.json() as any;
          zendeskTicketId = zendeskData.ticket?.id?.toString();
          console.log("Troubleshooting Zendesk ticket created:", zendeskTicketId);
        } else {
          console.error("Troubleshooting Zendesk ticket creation failed:", await zendeskResponse.text());
        }
      } catch (zendeskError) {
        console.error("Zendesk API error:", zendeskError);
      }
    }

    res.json({
      success: true,
      ticketId: zendeskTicketId || `TS-${Date.now().toString(36).toUpperCase()}`,
      message: "Support ticket created successfully"
    });
  } catch (error: any) {
    console.error("Troubleshooting ticket error:", error);
    res.status(500).json({ error: error.message || "Failed to create support ticket" });
  }
});

app.post("/api/feedback", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const session = await storage.getSessionByToken(token);
    let customerId: number | null = null;
    let customerEmail = "";

    if (session) {
      customerId = session.customerId;
      const customer = await storage.getCustomer(session.customerId);
      customerEmail = customer?.email || "";
    } else {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded.isTest) {
          customerEmail = decoded.email || "test@example.com";
        } else {
          return res.status(401).json({ error: "Invalid session" });
        }
      } catch {
        return res.status(401).json({ error: "Invalid session" });
      }
    }

    const { feedbackType, message, rating } = req.body;

    if (!feedbackType || !message) {
      return res.status(400).json({ error: "Feedback type and message are required" });
    }

    const feedback = await storage.createFeedback({
      customerId,
      customerEmail: customerEmail.toLowerCase(),
      feedbackType,
      message,
      rating: rating || null
    });

    console.log("Feedback submitted:", feedback.id);

    res.json({
      success: true,
      message: "Thank you for your feedback!"
    });
  } catch (error: any) {
    console.error("Feedback submission error:", error);
    res.status(500).json({ error: error.message || "Failed to submit feedback" });
  }
});

app.get("/api/feedback", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const session = await storage.getSessionByToken(token);
    let customerEmail = "";

    if (session) {
      const customer = await storage.getCustomer(session.customerId);
      customerEmail = customer?.email || "";
    } else {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded.isTest) {
          customerEmail = decoded.email || "test@example.com";
        } else {
          return res.status(401).json({ error: "Invalid session" });
        }
      } catch {
        return res.status(401).json({ error: "Invalid session" });
      }
    }

    const feedback = await storage.getFeedbackByCustomer(customerEmail);
    
    res.json({ feedback });
  } catch (error: any) {
    console.error("Get feedback error:", error);
    res.status(500).json({ error: error.message || "Failed to get feedback" });
  }
});

app.post("/api/slow-speed/check-eligibility", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let isTestToken = false;

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}

    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      customerEmail = customer.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Could not determine customer" });
    }

    const { subscriptionId } = req.body;
    if (!subscriptionId) {
      return res.status(400).json({ error: "Subscription ID is required" });
    }

    const recentRefresh = await storage.getRecentSlowSpeedRefresh(customerEmail, subscriptionId);

    if (recentRefresh) {
      const refreshStartedAt = new Date(recentRefresh.refreshStartedAt!);
      const syncExpiresAt = recentRefresh.syncExpiresAt ? new Date(recentRefresh.syncExpiresAt) : null;
      const daysSinceRefresh = (Date.now() - refreshStartedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      const now = Date.now();
      const isSyncing = syncExpiresAt && now < syncExpiresAt.getTime();
      const syncMinutesRemaining = isSyncing ? Math.ceil((syncExpiresAt!.getTime() - now) / (1000 * 60)) : 0;

      res.json({
        canRefresh: daysSinceRefresh >= 7 && !isSyncing,
        lastRefreshDate: refreshStartedAt.toISOString(),
        daysSinceRefresh: Math.floor(daysSinceRefresh),
        daysUntilNextRefresh: Math.max(0, Math.ceil(7 - daysSinceRefresh)),
        isSyncing,
        syncMinutesRemaining,
        lastSessionId: recentRefresh.id,
        speedsImproved: recentRefresh.speedsImproved
      });
    } else {
      res.json({
        canRefresh: true,
        lastRefreshDate: null,
        daysSinceRefresh: null,
        daysUntilNextRefresh: 0,
        isSyncing: false,
        syncMinutesRemaining: 0,
        lastSessionId: null,
        speedsImproved: null
      });
    }
  } catch (error: any) {
    console.error("Check slow speed eligibility error:", error);
    res.status(500).json({ error: error.message || "Failed to check eligibility" });
  }
});

app.post("/api/slow-speed/start-session", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let customerId: number | null = null;
    let isTestToken = false;

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}

    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      customerEmail = customer.email;
      customerId = customer.id;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Could not determine customer" });
    }

    const { subscriptionId, iccid, imei, mdn, issueOnset, modemMoved } = req.body;
    
    if (!subscriptionId) {
      return res.status(400).json({ error: "Subscription ID is required" });
    }

    const newSession = await storage.createSlowSpeedSession({
      customerId,
      customerEmail: customerEmail.toLowerCase(),
      subscriptionId,
      iccid: iccid || null,
      imei: imei || null,
      mdn: mdn || null,
      issueOnset: issueOnset || null,
      modemMoved: modemMoved || null,
      sessionState: "qualification"
    });

    console.log("Slow speed session started:", newSession.id);

    res.json({
      success: true,
      sessionId: newSession.id
    });
  } catch (error: any) {
    console.error("Start slow speed session error:", error);
    res.status(500).json({ error: error.message || "Failed to start session" });
  }
});

app.post("/api/slow-speed/update-session", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    let isTestToken = false;

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (decoded.isTest) {
        isTestToken = true;
      }
    } catch (e) {}

    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
    }

    const { sessionId, ...updateData } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    const updated = await storage.updateSlowSpeedSession(sessionId, updateData);

    if (!updated) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json({
      success: true,
      session: updated
    });
  } catch (error: any) {
    console.error("Update slow speed session error:", error);
    res.status(500).json({ error: error.message || "Failed to update session" });
  }
});

app.post("/api/slow-speed/start-refresh", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let isTestToken = false;

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}

    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      customerEmail = customer.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Could not determine customer" });
    }

    const { sessionId, subscriptionId, mdn } = req.body;
    
    if (!sessionId || !subscriptionId) {
      return res.status(400).json({ error: "Session ID and Subscription ID are required" });
    }

    const recentRefresh = await storage.getRecentSlowSpeedRefresh(customerEmail, subscriptionId);
    if (recentRefresh) {
      const refreshStartedAt = new Date(recentRefresh.refreshStartedAt!);
      const daysSinceRefresh = (Date.now() - refreshStartedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceRefresh < 7) {
        return res.status(400).json({ 
          error: "A line refresh was recently performed. Please wait before refreshing again.",
          daysUntilNextRefresh: Math.ceil(7 - daysSinceRefresh)
        });
      }
    }

    const now = new Date();
    const syncExpiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const updated = await storage.updateSlowSpeedSession(sessionId, {
      refreshPerformed: true,
      refreshStartedAt: now,
      syncExpiresAt: syncExpiresAt,
      sessionState: "refresh_suspend"
    });

    console.log("Slow speed refresh started for session:", sessionId);

    res.json({
      success: true,
      session: updated,
      syncExpiresAt: syncExpiresAt.toISOString()
    });
  } catch (error: any) {
    console.error("Start refresh error:", error);
    res.status(500).json({ error: error.message || "Failed to start refresh" });
  }
});

app.post("/api/slow-speed/complete-refresh", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    let isTestToken = false;

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (decoded.isTest) {
        isTestToken = true;
      }
    } catch (e) {}

    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
    }

    const { sessionId, speedsImproved, outdoorTestResult } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    const updated = await storage.updateSlowSpeedSession(sessionId, {
      refreshCompletedAt: new Date(),
      sessionState: "completed",
      speedsImproved: speedsImproved ?? null,
      outdoorTestResult: outdoorTestResult || null
    });

    res.json({
      success: true,
      session: updated
    });
  } catch (error: any) {
    console.error("Complete refresh error:", error);
    res.status(500).json({ error: error.message || "Failed to complete refresh" });
  }
});

app.get("/api/slow-speed/session/:sessionId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    let isTestToken = false;

    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (decoded.isTest) {
        isTestToken = true;
      }
    } catch (e) {}

    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) {
        return res.status(401).json({ error: "Invalid session" });
      }
    }

    const sessionId = parseInt(req.params.sessionId);
    const slowSpeedSession = await storage.getSlowSpeedSession(sessionId);

    if (!slowSpeedSession) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(slowSpeedSession);
  } catch (error: any) {
    console.error("Get slow speed session error:", error);
    res.status(500).json({ error: error.message || "Failed to get session" });
  }
});

app.get("/api/device/plans", customerApiLimiter, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const session = await storage.getSessionByToken(token);
    let isTest = false;
    
    if (!session) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded.isTest) {
          isTest = true;
        } else {
          return res.status(401).json({ error: "Invalid session" });
        }
      } catch {
        return res.status(401).json({ error: "Invalid session" });
      }
    }

    const { getAvailablePlans } = await import('./services');
    const allPlans = await getAvailablePlans();

    if (!allPlans) {
      return res.status(500).json({ error: "Failed to fetch available plans" });
    }

    // Filter to only show specific approved plans
    const allowedPlanCodes = [
      '59142x48526x84777',
      '59142x48526x90274',
      '59145x48526x84777',
      '64186x48526x75803x84777',
      '64186x48526x73578x76193',
      '64186x48526x84777',
      '64186x48526x54307x90274',
      'Static 5G Bus Internet 100MBPS'
    ];
    
    const plans = allPlans.filter((plan: any) => 
      allowedPlanCodes.includes(plan.code) || allowedPlanCodes.includes(plan.name)
    );

    res.json({ success: true, plans });
  } catch (error: any) {
    console.error("Get plans error:", error);
    res.status(500).json({ error: error.message || "Failed to get plans" });
  }
});

// Admin API endpoints
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const admin = await storage.getAdminByEmail(email);
    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ adminId: admin.id, email: admin.email, isAdmin: true }, JWT_SECRET!, { expiresIn: '24h' });
    res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
  } catch (error: any) {
    console.error("Admin login error:", error);
    res.status(500).json({ error: error.message || "Login failed" });
  }
});

app.get("/api/admin/feedback", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (!decoded.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
    } catch (e) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const feedback = await storage.getAllFeedback();
    res.json({ feedback });
  } catch (error: any) {
    console.error("Get feedback error:", error);
    res.status(500).json({ error: error.message || "Failed to get feedback" });
  }
});

app.post("/api/admin/feedback/:id/respond", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    let adminEmail: string;
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET!);
      if (!decoded.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      adminEmail = decoded.email;
    } catch (e) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { id } = req.params;
    const { response } = req.body;
    
    if (!response) {
      return res.status(400).json({ error: "Response is required" });
    }

    const updated = await storage.updateFeedbackResponse(parseInt(id), response, adminEmail);
    if (!updated) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    res.json({ success: true, feedback: updated });
  } catch (error: any) {
    console.error("Respond to feedback error:", error);
    res.status(500).json({ error: error.message || "Failed to respond" });
  }
});

app.post("/api/subscription/pause/check-eligibility", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let isTestToken = false;
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}
    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) return res.status(401).json({ error: "Invalid or expired session" });
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      customerEmail = customer.email;
    }
    if (!customerEmail) return res.status(401).json({ error: "Unable to identify customer" });

    const { subscriptionId } = req.body;
    if (!subscriptionId) return res.status(400).json({ error: "Subscription ID is required" });

    const { hasTravelAddon: hasTravelAddonFn, checkSubscriptionPaymentStatus } = await import('./services');
    const fullData = await fetchCustomerFullData(customerEmail);

    let targetSub: any = null;
    let targetCustomerId: string = '';
    for (const cbCust of fullData.chargebee.customers) {
      for (const sub of cbCust.subscriptions) {
        if (sub.id === subscriptionId) {
          targetSub = sub;
          targetCustomerId = cbCust.id;
          break;
        }
      }
      if (targetSub) break;
    }

    if (!targetSub) return res.status(404).json({ error: "Subscription not found" });

    if (targetSub.status !== 'active') {
      return res.json({
        eligible: false,
        reason: 'only_active',
        message: 'Only active subscriptions can be paused.'
      });
    }

    const isPaid = targetSub.totalDues === 0 && targetSub.dueInvoicesCount === 0;
    if (!isPaid) {
      return res.json({
        eligible: false,
        reason: 'unpaid',
        message: 'You need to settle your outstanding balance before you can pause your subscription.',
        totalDues: targetSub.totalDues,
        dueInvoicesCount: targetSub.dueInvoicesCount
      });
    }

    const travelCheck = hasTravelAddonFn(targetSub.subscriptionItems);

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const pauseMonthsUsed = await storage.getPauseMonthsUsedInPeriod(subscriptionId, oneYearAgo);
    const remainingMonths = Math.max(0, 6 - pauseMonthsUsed);

    if (remainingMonths === 0) {
      return res.json({
        eligible: false,
        reason: 'limit_reached',
        message: 'You have reached the maximum pause limit of 6 months in the past 365 days.',
        pauseMonthsUsed,
        remainingMonths: 0
      });
    }

    const maxDuration = Math.min(3, remainingMonths);

    res.json({
      eligible: true,
      hasTravelAddon: travelCheck.found,
      travelAddonItemPriceId: travelCheck.itemPriceId,
      pauseMonthsUsed,
      remainingMonths,
      maxDuration,
      subscriptionId,
      chargebeeCustomerId: targetCustomerId
    });
  } catch (error: any) {
    console.error("Pause eligibility check error:", error);
    res.status(500).json({ error: error.message || "Failed to check pause eligibility" });
  }
});

app.post("/api/subscription/pause/add-travel-addon", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let isTestToken = false;
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}
    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) return res.status(401).json({ error: "Invalid or expired session" });
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      customerEmail = customer.email;
    }
    if (!customerEmail) return res.status(401).json({ error: "Unable to identify customer" });

    const { subscriptionId } = req.body;
    if (!subscriptionId) return res.status(400).json({ error: "Subscription ID is required" });

    const fullData = await fetchCustomerFullData(customerEmail);
    let ownsSubscription = false;
    for (const cbCust of fullData.chargebee.customers) {
      if (cbCust.subscriptions.some(s => s.id === subscriptionId)) {
        ownsSubscription = true;
        break;
      }
    }
    if (!ownsSubscription) return res.status(403).json({ error: "You do not own this subscription" });

    const { addTravelAddonToSubscription } = await import('./services');
    const result = await addTravelAddonToSubscription(subscriptionId);

    if (result.success) {
      res.json({ success: true, invoiceId: result.invoiceId });
    } else {
      res.status(400).json({ error: result.error || "Failed to add travel addon" });
    }
  } catch (error: any) {
    console.error("Add travel addon error:", error);
    res.status(500).json({ error: error.message || "Failed to add travel addon" });
  }
});

app.post("/api/subscription/pause/check-addon-payment", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let isTestToken = false;
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}
    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) return res.status(401).json({ error: "Invalid or expired session" });
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      customerEmail = customer.email;
    }
    if (!customerEmail) return res.status(401).json({ error: "Unable to identify customer" });

    const { subscriptionId } = req.body;
    if (!subscriptionId) return res.status(400).json({ error: "Subscription ID is required" });

    const fullData = await fetchCustomerFullData(customerEmail);
    let targetSub: any = null;
    for (const cbCust of fullData.chargebee.customers) {
      for (const sub of cbCust.subscriptions) {
        if (sub.id === subscriptionId) {
          targetSub = sub;
          break;
        }
      }
      if (targetSub) break;
    }
    if (!targetSub) return res.status(403).json({ error: "You do not own this subscription" });

    const { checkSubscriptionPaymentStatus, hasTravelAddon: hasTravelAddonFn } = await import('./services');
    const paymentStatus = await checkSubscriptionPaymentStatus(subscriptionId);
    const hasTravelNow = hasTravelAddonFn(targetSub.subscriptionItems).found;

    res.json({
      isPaid: paymentStatus.isPaid,
      hasTravelAddon: hasTravelNow,
      totalDues: paymentStatus.totalDues,
      dueInvoicesCount: paymentStatus.dueInvoicesCount
    });
  } catch (error: any) {
    console.error("Check addon payment error:", error);
    res.status(500).json({ error: error.message || "Failed to check payment status" });
  }
});

app.post("/api/subscription/pause/execute", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let customerId: number | null = null;
    let isTestToken = false;
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}
    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) return res.status(401).json({ error: "Invalid or expired session" });
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      customerEmail = customer.email;
      customerId = customer.id;
    }
    if (!customerEmail) return res.status(401).json({ error: "Unable to identify customer" });
    if (customerId === null) {
      const customerByEmail = await storage.getCustomerByEmail(customerEmail);
      if (customerByEmail) {
        customerId = customerByEmail.id;
      } else {
        return res.status(404).json({ error: "Customer not found in database" });
      }
    }

    const { subscriptionId, durationMonths, pauseReason, pauseReasonDetails } = req.body;
    if (!subscriptionId) return res.status(400).json({ error: "Subscription ID is required" });
    if (!durationMonths || durationMonths < 1 || durationMonths > 3) {
      return res.status(400).json({ error: "Duration must be between 1 and 3 months" });
    }
    if (!pauseReason) return res.status(400).json({ error: "Pause reason is required" });
    if (!pauseReasonDetails || !pauseReasonDetails.trim()) {
      return res.status(400).json({ error: "Please provide details about why you are pausing" });
    }

    const fullData = await fetchCustomerFullData(customerEmail);
    let targetSub: any = null;
    let targetCustomerId: string = '';
    for (const cbCust of fullData.chargebee.customers) {
      for (const sub of cbCust.subscriptions) {
        if (sub.id === subscriptionId) {
          targetSub = sub;
          targetCustomerId = cbCust.id;
          break;
        }
      }
      if (targetSub) break;
    }

    if (!targetSub) return res.status(404).json({ error: "Subscription not found" });
    if (targetSub.status !== 'active') {
      return res.status(400).json({ error: "Only active subscriptions can be paused" });
    }

    const isPaid = targetSub.totalDues === 0 && targetSub.dueInvoicesCount === 0;
    if (!isPaid) {
      return res.status(400).json({ error: "Please settle your outstanding balance before pausing" });
    }

    const { hasTravelAddon: hasTravelAddonFn, pauseChargebeeSubscription } = await import('./services');
    const travelCheck = hasTravelAddonFn(targetSub.subscriptionItems);
    if (!travelCheck.found) {
      return res.status(400).json({ error: "Travel add-on is required to pause subscription" });
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const pauseMonthsUsed = await storage.getPauseMonthsUsedInPeriod(subscriptionId, oneYearAgo);
    const remainingMonths = Math.max(0, 6 - pauseMonthsUsed);

    if (durationMonths > remainingMonths) {
      return res.status(400).json({
        error: `You can only pause for ${remainingMonths} more month(s) in this period`
      });
    }

    const now = new Date();
    const pauseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const nextBillingDate = targetSub.nextBillingAt ? new Date(targetSub.nextBillingAt) : null;
    const billingDayOfMonth = nextBillingDate ? nextBillingDate.getUTCDate() : pauseDate.getDate();

    const resumeDate = new Date(pauseDate);
    resumeDate.setMonth(resumeDate.getMonth() + durationMonths);
    resumeDate.setDate(billingDayOfMonth);

    const result = await pauseChargebeeSubscription(subscriptionId, 0, Math.floor(resumeDate.getTime() / 1000));

    if (result.success) {
      await storage.createSubscriptionPause({
        customerId: customerId,
        customerEmail: customerEmail,
        subscriptionId,
        chargebeeCustomerId: targetCustomerId,
        pauseDurationMonths: durationMonths,
        pauseDate,
        resumeDate,
        travelAddonAdded: false,
        travelAddonItemPriceId: travelCheck.itemPriceId,
        pauseReason: pauseReason,
        pauseReasonDetails: pauseReasonDetails.trim(),
        status: 'active',
      });

      res.json({
        success: true,
        pauseDate: pauseDate.toISOString(),
        resumeDate: resumeDate.toISOString(),
        durationMonths
      });
    } else {
      res.status(400).json({ error: result.error || "Failed to pause subscription" });
    }
  } catch (error: any) {
    console.error("Execute pause error:", error);
    res.status(500).json({ error: error.message || "Failed to pause subscription" });
  }
});

app.get("/api/subscription/pause/history/:subscriptionId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let isTestToken = false;
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}
    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) return res.status(401).json({ error: "Invalid or expired session" });
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      customerEmail = customer.email;
    }
    if (!customerEmail) return res.status(401).json({ error: "Unable to identify customer" });

    const { subscriptionId } = req.params;
    const fullData = await fetchCustomerFullData(customerEmail);
    let ownsSubscription = false;
    for (const cbCust of fullData.chargebee.customers) {
      if (cbCust.subscriptions.some(s => s.id === subscriptionId)) {
        ownsSubscription = true;
        break;
      }
    }
    if (!ownsSubscription) return res.status(403).json({ error: "You do not own this subscription" });

    const pauses = await storage.getSubscriptionPausesBySubscription(subscriptionId);
    res.json({ pauses });
  } catch (error: any) {
    console.error("Fetch pause history error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch pause history" });
  }
});

app.post("/api/cancellation/start", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | undefined;

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.isTest) {
        customerEmail = decoded.email;
      }
    } catch {}

    if (!customerEmail) {
      const session = await storage.getSessionByToken(token);
      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      const customer = await storage.getCustomer(session.customerId);
      customerEmail = customer?.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Customer not found" });
    }

    const { subscriptionId, subscriptionStatus, currentPrice, dueInvoiceCount } = req.body;
    if (!subscriptionId) {
      return res.status(400).json({ error: "Subscription ID is required" });
    }

    const customer = await storage.getCustomerByEmail(customerEmail);
    
    const existingRequests = await storage.getCancellationRequestsByCustomer(customerEmail);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentOpenRequest = existingRequests.find(r => 
      r.subscriptionId === subscriptionId && 
      r.createdAt && r.createdAt > twentyFourHoursAgo &&
      r.status !== "retained" && r.flowStep === "completed"
    );

    if (recentOpenRequest) {
      return res.json({
        success: false,
        hasExistingRequest: true,
        existingRequestId: recentOpenRequest.id,
        ticketId: recentOpenRequest.zendeskTicketId,
        message: "You already have an active cancellation request from the last 24 hours. Our team will reach out to you soon."
      });
    }
    
    const cancellationRequest = await storage.createCancellationRequest({
      customerId: customer?.id,
      customerEmail,
      subscriptionId,
      subscriptionStatus,
      currentPrice,
      dueInvoiceCount: dueInvoiceCount || 0,
      status: "started",
      flowStep: "reason_selection"
    });

    res.json({ success: true, requestId: cancellationRequest.id });
  } catch (error: any) {
    console.error("Start cancellation error:", error);
    res.status(500).json({ error: error.message || "Failed to start cancellation flow" });
  }
});

app.post("/api/cancellation/submit-reason", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | undefined;

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.isTest) {
        customerEmail = decoded.email;
      }
    } catch {}

    if (!customerEmail) {
      const session = await storage.getSessionByToken(token);
      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      const customer = await storage.getCustomer(session.customerId);
      customerEmail = customer?.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Customer not found" });
    }

    const { requestId, reason, reasonDetails } = req.body;
    if (!requestId || !reason) {
      return res.status(400).json({ error: "Request ID and reason are required" });
    }

    const request = await storage.getCancellationRequest(requestId);
    if (!request || request.customerEmail.toLowerCase() !== customerEmail.toLowerCase()) {
      return res.status(404).json({ error: "Cancellation request not found" });
    }

    const hasRecentDiscount = await storage.checkRecentDiscountForSubscription(request.subscriptionId);
    const isUnpaid = request.subscriptionStatus === "non_renewing" || 
                     request.subscriptionStatus === "cancelled" ||
                     request.subscriptionStatus === "paused";
    const hasDueInvoices = (request.dueInvoiceCount || 0) > 0;
    const canTroubleshoot = !isUnpaid && !hasDueInvoices;

    let nextStep = "retention_offer";
    let discountEligible = !hasRecentDiscount;
    
    if (reason === "too_expensive") {
      nextStep = hasRecentDiscount ? "contact_preference" : "price_negotiation";
    } else if ((reason === "slow_speeds" || reason === "not_reliable") && canTroubleshoot) {
      nextStep = "troubleshooting_offer";
    } else if (hasRecentDiscount) {
      nextStep = "contact_preference";
    }

    await storage.updateCancellationRequest(requestId, {
      cancellationReason: reason,
      reasonDetails,
      discountEligible,
      flowStep: nextStep
    });

    res.json({ success: true, nextStep, reason, discountEligible, isUnpaid });
  } catch (error: any) {
    console.error("Submit reason error:", error);
    res.status(500).json({ error: error.message || "Failed to submit reason" });
  }
});

app.post("/api/cancellation/submit-target-price", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | undefined;

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.isTest) {
        customerEmail = decoded.email;
      }
    } catch {}

    if (!customerEmail) {
      const session = await storage.getSessionByToken(token);
      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      const customer = await storage.getCustomer(session.customerId);
      customerEmail = customer?.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Customer not found" });
    }

    const { requestId, targetPrice } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: "Request ID is required" });
    }

    const request = await storage.getCancellationRequest(requestId);
    if (!request || request.customerEmail.toLowerCase() !== customerEmail.toLowerCase()) {
      return res.status(404).json({ error: "Cancellation request not found" });
    }

    let retentionOffer: { type: string; description: string; discountAmount: number; newPrice: number; duration: string } | null = null;
    const currentPrice = request.currentPrice || 9995;
    
    if (targetPrice && targetPrice > 0) {
      const discount20 = Math.round(currentPrice * 0.8);
      const discount20Amount = Math.round(currentPrice * 0.2);
      
      if (targetPrice <= discount20) {
        retentionOffer = {
          type: "percentage_discount",
          description: "20% off for the next 2 months",
          discountAmount: discount20Amount,
          newPrice: discount20,
          duration: "2 months"
        };
      } else {
        const flatDiscount = 2000;
        retentionOffer = {
          type: "flat_discount",
          description: "$20 off for the next month",
          discountAmount: flatDiscount,
          newPrice: currentPrice - flatDiscount,
          duration: "1 month"
        };
      }
    }

    await storage.updateCancellationRequest(requestId, {
      targetPrice,
      retentionOfferShown: retentionOffer ? JSON.stringify(retentionOffer) : null,
      flowStep: "retention_offer"
    });

    res.json({ success: true, retentionOffer });
  } catch (error: any) {
    console.error("Submit target price error:", error);
    res.status(500).json({ error: error.message || "Failed to submit target price" });
  }
});

app.post("/api/cancellation/respond-to-offer", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | undefined;

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.isTest) {
        customerEmail = decoded.email;
      }
    } catch {}

    if (!customerEmail) {
      const session = await storage.getSessionByToken(token);
      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      const customer = await storage.getCustomer(session.customerId);
      customerEmail = customer?.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Customer not found" });
    }

    const { requestId, accepted, offerType } = req.body;
    if (!requestId || typeof accepted !== "boolean") {
      return res.status(400).json({ error: "Request ID and acceptance status required" });
    }

    const request = await storage.getCancellationRequest(requestId);
    if (!request || request.customerEmail.toLowerCase() !== customerEmail.toLowerCase()) {
      return res.status(404).json({ error: "Cancellation request not found" });
    }

    if (accepted) {
      await storage.updateCancellationRequest(requestId, {
        retentionOfferAccepted: true,
        discountAppliedAt: new Date(),
        status: "retained",
        flowStep: "completed",
        completedAt: new Date()
      });
      res.json({ success: true, outcome: "retained", message: "Great! Your discount will be applied to your next invoice." });
    } else {
      await storage.updateCancellationRequest(requestId, {
        retentionOfferAccepted: false,
        flowStep: "contact_preference"
      });
      res.json({ success: true, nextStep: "contact_preference" });
    }
  } catch (error: any) {
    console.error("Respond to offer error:", error);
    res.status(500).json({ error: error.message || "Failed to process response" });
  }
});

app.post("/api/cancellation/troubleshooting-response", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | undefined;

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.isTest) {
        customerEmail = decoded.email;
      }
    } catch {}

    if (!customerEmail) {
      const session = await storage.getSessionByToken(token);
      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      const customer = await storage.getCustomer(session.customerId);
      customerEmail = customer?.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Customer not found" });
    }

    const { requestId, accepted } = req.body;
    if (!requestId || typeof accepted !== "boolean") {
      return res.status(400).json({ error: "Request ID and acceptance status required" });
    }

    const request = await storage.getCancellationRequest(requestId);
    if (!request || request.customerEmail.toLowerCase() !== customerEmail.toLowerCase()) {
      return res.status(404).json({ error: "Cancellation request not found" });
    }

    await storage.updateCancellationRequest(requestId, {
      troubleshootingOffered: true,
      troubleshootingAccepted: accepted,
      flowStep: accepted ? "troubleshooting_redirect" : "retention_offer"
    });

    if (accepted) {
      res.json({ success: true, redirect: "/troubleshoot", subscriptionId: request.subscriptionId });
    } else {
      res.json({ success: true, nextStep: "retention_offer" });
    }
  } catch (error: any) {
    console.error("Troubleshooting response error:", error);
    res.status(500).json({ error: error.message || "Failed to process response" });
  }
});

app.post("/api/cancellation/submit-contact", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | undefined;

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.isTest) {
        customerEmail = decoded.email;
      }
    } catch {}

    if (!customerEmail) {
      const session = await storage.getSessionByToken(token);
      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      const customer = await storage.getCustomer(session.customerId);
      customerEmail = customer?.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Customer not found" });
    }

    const { requestId, contactMethod, phone, callTime, additionalNotes } = req.body;
    if (!requestId || !contactMethod) {
      return res.status(400).json({ error: "Request ID and contact method required" });
    }
    if (!additionalNotes || additionalNotes.trim().length < 50) {
      return res.status(400).json({ error: "Please provide at least 50 characters explaining your concerns" });
    }

    const request = await storage.getCancellationRequest(requestId);
    if (!request || request.customerEmail.toLowerCase() !== customerEmail.toLowerCase()) {
      return res.status(404).json({ error: "Cancellation request not found" });
    }

    await storage.updateCancellationRequest(requestId, {
      preferredContactMethod: contactMethod,
      preferredPhone: phone,
      preferredCallTime: callTime,
      additionalNotes: additionalNotes.trim(),
      flowStep: "creating_ticket"
    });

    const customer = await storage.getCustomerByEmail(customerEmail);

    const zendeskSubdomain = process.env.ZENDESK_SUBDOMAIN;
    const zendeskEmail = process.env.ZENDESK_EMAIL;
    const zendeskToken = process.env.ZENDESK_API_TOKEN;
    const slackToken = process.env.SLACK_BOT_TOKEN;

    const groupIdSetting = await storage.getPortalSetting("zendesk_cancellation_group_id");
    const channelIdSetting = await storage.getPortalSetting("slack_channel_id");
    const cancellationAssigneeSetting = await storage.getPortalSetting("zendesk_cancellation_assignee_id");

    const groupId = groupIdSetting?.value || "41909825396372";
    const channelId = channelIdSetting?.value || "D09CQ87C6UU";
    const cancellationAssigneeId = cancellationAssigneeSetting?.value && cancellationAssigneeSetting.value !== 'none' ? cancellationAssigneeSetting.value : null;

    let zendeskTicketId = null;
    let slackMessageTs = null;

    if (zendeskSubdomain && zendeskEmail && zendeskToken) {
      try {
        const discountStatus = request.retentionOfferAccepted === true 
          ? "✅ DISCOUNT ACCEPTED - Customer accepted the retention offer and will continue service"
          : request.retentionOfferAccepted === false 
            ? "❌ DISCOUNT DECLINED - Customer rejected the retention offer"
            : request.discountEligible === false 
              ? "⚠️ NOT ELIGIBLE - Customer received a discount within the last 2 months"
              : "N/A - No retention offer presented";

        const ticketBody: any = {
          ticket: {
            subject: `Cancellation Request - ${request.subscriptionId}`,
            comment: {
              body: `Customer cancellation request submitted through portal.

═══════════════════════════════════════
CUSTOMER INFORMATION
═══════════════════════════════════════
Customer Email: ${customerEmail}
Customer Name: ${customer?.fullName || "N/A"}
Subscription ID: ${request.subscriptionId}
Subscription Status: ${request.subscriptionStatus || "N/A"}
Current Price: $${((request.currentPrice || 0) / 100).toFixed(2)}/month

═══════════════════════════════════════
CANCELLATION DETAILS
═══════════════════════════════════════
Reason: ${request.cancellationReason?.replace(/_/g, " ").toUpperCase()}
${request.reasonDetails ? `Additional Details: ${request.reasonDetails}` : ""}
${request.targetPrice ? `Target Price Requested: $${(request.targetPrice / 100).toFixed(2)}/month` : ""}

═══════════════════════════════════════
RETENTION OFFER STATUS
═══════════════════════════════════════
Offer Shown: ${request.retentionOfferShown || "None"}
${discountStatus}
${request.troubleshootingOffered ? `Troubleshooting Offered: ${request.troubleshootingAccepted ? "Accepted" : "Declined"}` : ""}

═══════════════════════════════════════
CONTACT PREFERENCES
═══════════════════════════════════════
Preferred Contact: ${contactMethod === "email" ? "Email" : "Phone Call"}
${phone ? `Phone Number: ${phone}` : ""}
${callTime ? `Best Time to Call: ${callTime}` : ""}

═══════════════════════════════════════
CUSTOMER'S CONCERNS
═══════════════════════════════════════
${additionalNotes}

═══════════════════════════════════════
ACTION REQUIRED: Please follow up with customer within 24 hours to complete cancellation or retention process.`,
              public: false
            },
            requester: { email: customerEmail, name: customer?.fullName || customerEmail },
            group_id: parseInt(groupId),
            priority: "high",
            tags: ["cancellation", "retention", "portal"]
          }
        };

        if (cancellationAssigneeId) {
          ticketBody.ticket.assignee_id = parseInt(cancellationAssigneeId);
        }

        const zendeskResponse = await fetch(
          `https://${zendeskSubdomain}.zendesk.com/api/v2/tickets.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Basic " + Buffer.from(`${zendeskEmail}/token:${zendeskToken}`).toString("base64")
            },
            body: JSON.stringify(ticketBody)
          }
        );

        if (zendeskResponse.ok) {
          const zendeskData = await zendeskResponse.json();
          zendeskTicketId = zendeskData.ticket?.id?.toString();
          console.log("Zendesk ticket created:", zendeskTicketId);
        } else {
          console.error("Zendesk ticket creation failed:", await zendeskResponse.text());
        }
      } catch (zendeskError) {
        console.error("Zendesk API error:", zendeskError);
      }
    }

    if (slackToken && channelId) {
      try {
        const discountEmoji = request.retentionOfferAccepted === true 
          ? ":white_check_mark:" 
          : request.retentionOfferAccepted === false 
            ? ":x:" 
            : ":grey_question:";
        const discountStatusShort = request.retentionOfferAccepted === true 
          ? "Accepted" 
          : request.retentionOfferAccepted === false 
            ? "Declined" 
            : "N/A";

        const reasonDetailsText = request.reasonDetails ? `\n\n*Customer's Comments:*\n>${request.reasonDetails.replace(/\n/g, '\n>')}` : '';
        
        const slackMessage = {
          channel: channelId,
          text: `:rotating_light: *New Cancellation Request* <@U09HLQ6229K> <@U09J3KB0HFB>`,
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: "New Cancellation Request", emoji: true }
            },
            {
              type: "section",
              text: { type: "mrkdwn", text: "<@U09HLQ6229K> <@U09J3KB0HFB>" }
            },
            {
              type: "section",
              fields: [
                { type: "mrkdwn", text: `*Customer:*\n${customer?.fullName || customerEmail}` },
                { type: "mrkdwn", text: `*Email:*\n${customerEmail}` },
                { type: "mrkdwn", text: `*Subscription:*\n${request.subscriptionId}` },
                { type: "mrkdwn", text: `*Current Price:*\n$${((request.currentPrice || 0) / 100).toFixed(2)}/mo` },
                { type: "mrkdwn", text: `*Reason:*\n${request.cancellationReason?.replace(/_/g, " ")}` },
                { type: "mrkdwn", text: `*Discount:* ${discountEmoji}\n${discountStatusShort}` }
              ]
            },
            ...(request.reasonDetails ? [{
              type: "section",
              text: { type: "mrkdwn", text: `*Customer's Comments:*\n>${request.reasonDetails.replace(/\n/g, '\n>')}` }
            }] : []),
            {
              type: "section",
              fields: [
                { type: "mrkdwn", text: `*Contact Method:*\n${contactMethod === "email" ? "Email" : `Phone: ${phone || "N/A"}`}` },
                { type: "mrkdwn", text: `*Zendesk Ticket:*\n${zendeskTicketId ? `<https://${zendeskSubdomain}.zendesk.com/agent/tickets/${zendeskTicketId}|#${zendeskTicketId}>` : "Failed to create"}` }
              ]
            },
            {
              type: "context",
              elements: [
                { type: "mrkdwn", text: `Submitted via Customer Portal • ${new Date().toLocaleString()}` }
              ]
            }
          ]
        };

        const slackResponse = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${slackToken}`
          },
          body: JSON.stringify(slackMessage)
        });

        if (slackResponse.ok) {
          const slackData = await slackResponse.json();
          if (slackData.ok) {
            slackMessageTs = slackData.ts;
            console.log("Slack message sent:", slackMessageTs);
          } else {
            console.error("Slack API error:", slackData.error);
          }
        }
      } catch (slackError) {
        console.error("Slack API error:", slackError);
      }
    }

    await storage.updateCancellationRequest(requestId, {
      zendeskTicketId,
      slackMessageTs,
      status: "pending_callback",
      flowStep: "completed",
      completedAt: new Date()
    });

    res.json({
      success: true,
      ticketId: zendeskTicketId,
      message: `Your cancellation request has been submitted (Ticket #${zendeskTicketId || "pending"}). A member of our retention team will reach out to you within the next 24 hours via ${contactMethod === "phone" ? "phone call" : "email"}.`
    });
  } catch (error: any) {
    console.error("Submit contact error:", error);
    res.status(500).json({ error: error.message || "Failed to submit contact preferences" });
  }
});

app.get("/api/cancellation/:requestId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | undefined;

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.isTest) {
        customerEmail = decoded.email;
      }
    } catch {}

    if (!customerEmail) {
      const session = await storage.getSessionByToken(token);
      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      const customer = await storage.getCustomer(session.customerId);
      customerEmail = customer?.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Customer not found" });
    }

    const { requestId } = req.params;
    const request = await storage.getCancellationRequest(parseInt(requestId));
    
    if (!request || request.customerEmail.toLowerCase() !== customerEmail.toLowerCase()) {
      return res.status(404).json({ error: "Cancellation request not found" });
    }

    res.json({ request });
  } catch (error: any) {
    console.error("Get cancellation request error:", error);
    res.status(500).json({ error: error.message || "Failed to get cancellation request" });
  }
});

app.get("/api/cancellation/history/:subscriptionId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    let customerEmail: string | undefined;

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.isTest) {
        customerEmail = decoded.email;
      }
    } catch {}

    if (!customerEmail) {
      const session = await storage.getSessionByToken(token);
      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      const customer = await storage.getCustomer(session.customerId);
      customerEmail = customer?.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Customer not found" });
    }

    const { subscriptionId } = req.params;
    const allRequests = await storage.getCancellationRequestsByCustomer(customerEmail);
    const subscriptionRequests = allRequests.filter(r => r.subscriptionId === subscriptionId && r.flowStep === "completed");

    const zendeskSubdomain = process.env.ZENDESK_SUBDOMAIN;
    const zendeskEmail = process.env.ZENDESK_EMAIL;
    const zendeskToken = process.env.ZENDESK_API_TOKEN;

    const requestsWithStatus = await Promise.all(subscriptionRequests.map(async (request) => {
      let ticketStatus = null;
      
      if (request.zendeskTicketId && zendeskSubdomain && zendeskEmail && zendeskToken) {
        try {
          const ticketResponse = await fetch(
            `https://${zendeskSubdomain}.zendesk.com/api/v2/tickets/${request.zendeskTicketId}.json`,
            {
              headers: {
                "Authorization": "Basic " + Buffer.from(`${zendeskEmail}/token:${zendeskToken}`).toString("base64")
              }
            }
          );
          if (ticketResponse.ok) {
            const ticketData = await ticketResponse.json();
            ticketStatus = ticketData.ticket?.status || null;
          }
        } catch (err) {
          console.error("Failed to fetch Zendesk ticket status:", err);
        }
      }

      return {
        id: request.id,
        subscriptionId: request.subscriptionId,
        cancellationReason: request.cancellationReason,
        reasonDetails: request.reasonDetails,
        additionalNotes: request.additionalNotes,
        retentionOfferAccepted: request.retentionOfferAccepted,
        preferredContactMethod: request.preferredContactMethod,
        zendeskTicketId: request.zendeskTicketId,
        ticketStatus,
        status: request.status,
        createdAt: request.createdAt,
        completedAt: request.completedAt
      };
    }));

    res.json({ requests: requestsWithStatus });
  } catch (error: any) {
    console.error("Get cancellation history error:", error);
    res.status(500).json({ error: error.message || "Failed to get cancellation history" });
  }
});

app.get("/api/admin/settings", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const settings = await storage.getAllPortalSettings();
    res.json({ settings });
  } catch (error: any) {
    console.error("Get settings error:", error);
    res.status(500).json({ error: error.message || "Failed to get settings" });
  }
});

app.post("/api/admin/settings", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    let adminEmail: string | undefined;
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      adminEmail = decoded.email;
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { key, value } = req.body;
    if (!key || !value) {
      return res.status(400).json({ error: "Key and value are required" });
    }

    const updated = await storage.updatePortalSetting(key, value, adminEmail || "admin");
    if (!updated) {
      return res.status(404).json({ error: "Setting not found" });
    }

    res.json({ success: true, setting: updated });
  } catch (error: any) {
    console.error("Update setting error:", error);
    res.status(500).json({ error: error.message || "Failed to update setting" });
  }
});

// Zendesk Groups & Users (admin)
app.get("/api/admin/zendesk/groups", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded.isAdmin) return res.status(403).json({ error: "Admin access required" });
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const zendeskSubdomain = process.env.ZENDESK_SUBDOMAIN;
    const zendeskEmail = process.env.ZENDESK_EMAIL;
    const zendeskToken = process.env.ZENDESK_API_TOKEN;
    if (!zendeskSubdomain || !zendeskEmail || !zendeskToken) {
      return res.status(500).json({ error: "Zendesk credentials not configured" });
    }

    const authString = Buffer.from(`${zendeskEmail}/token:${zendeskToken}`).toString('base64');
    const response = await fetch(`https://${zendeskSubdomain}.zendesk.com/api/v2/groups.json`, {
      headers: { 'Authorization': `Basic ${authString}`, 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      return res.status(502).json({ error: "Failed to fetch Zendesk groups" });
    }

    const data = await response.json() as any;
    const groups = (data.groups || []).map((g: any) => ({
      id: String(g.id),
      name: g.name,
      description: g.description || ''
    }));

    res.json({ groups });
  } catch (error: any) {
    console.error("Fetch Zendesk groups error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch Zendesk groups" });
  }
});

app.get("/api/admin/zendesk/users", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded.isAdmin) return res.status(403).json({ error: "Admin access required" });
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const zendeskSubdomain = process.env.ZENDESK_SUBDOMAIN;
    const zendeskEmail = process.env.ZENDESK_EMAIL;
    const zendeskToken = process.env.ZENDESK_API_TOKEN;
    if (!zendeskSubdomain || !zendeskEmail || !zendeskToken) {
      return res.status(500).json({ error: "Zendesk credentials not configured" });
    }

    const groupId = req.query.group_id as string;
    const authString = Buffer.from(`${zendeskEmail}/token:${zendeskToken}`).toString('base64');
    
    let url = `https://${zendeskSubdomain}.zendesk.com/api/v2/users.json?role=agent&per_page=100`;
    if (groupId) {
      url = `https://${zendeskSubdomain}.zendesk.com/api/v2/groups/${groupId}/users.json?per_page=100`;
    }

    const response = await fetch(url, {
      headers: { 'Authorization': `Basic ${authString}`, 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      return res.status(502).json({ error: "Failed to fetch Zendesk users" });
    }

    const data = await response.json() as any;
    const users = (data.users || []).map((u: any) => ({
      id: String(u.id),
      name: u.name,
      email: u.email
    }));

    res.json({ users });
  } catch (error: any) {
    console.error("Fetch Zendesk users error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch Zendesk users" });
  }
});

// Admin Cancellation Requests endpoints
app.get("/api/admin/cancellations", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const cancellations = await storage.getAllCancellationRequests();
    res.json({ cancellations });
  } catch (error: any) {
    console.error("Get cancellations error:", error);
    res.status(500).json({ error: error.message || "Failed to get cancellations" });
  }
});

app.get("/api/admin/cancellations/export", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const cancellations = await storage.getAllCancellationRequests();
    
    // Build CSV
    const headers = [
      "ID",
      "Date",
      "Customer Email",
      "Subscription ID",
      "Status",
      "MRR ($)",
      "Cancellation Reason",
      "Reason Details",
      "Discount Offered",
      "Discount Accepted",
      "Discount Eligible",
      "Troubleshooting Offered",
      "Troubleshooting Accepted",
      "Contact Method",
      "Phone",
      "Preferred Call Time",
      "Zendesk Ticket ID",
      "Additional Notes"
    ];
    
    // Helper to escape CSV values (handle quotes, newlines, commas)
    const escapeCSV = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      return str.replace(/"/g, '""').replace(/\r?\n/g, ' ');
    };
    
    const rows = cancellations.map(c => [
      c.id,
      c.createdAt ? new Date(c.createdAt).toISOString() : "",
      escapeCSV(c.customerEmail),
      escapeCSV(c.subscriptionId),
      escapeCSV(c.status || "started"),
      c.currentPrice ? (c.currentPrice / 100).toFixed(2) : "",
      escapeCSV(c.cancellationReason),
      escapeCSV(c.reasonDetails),
      escapeCSV(c.retentionOfferShown),
      c.retentionOfferAccepted ? "Yes" : "No",
      c.discountEligible ? "Yes" : "No",
      c.troubleshootingOffered ? "Yes" : "No",
      c.troubleshootingAccepted ? "Yes" : "No",
      escapeCSV(c.preferredContactMethod),
      escapeCSV(c.preferredPhone),
      escapeCSV(c.preferredCallTime),
      escapeCSV(c.zendeskTicketId),
      escapeCSV(c.additionalNotes)
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=cancellation-requests-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
  } catch (error: any) {
    console.error("Export cancellations error:", error);
    res.status(500).json({ error: error.message || "Failed to export cancellations" });
  }
});

app.get("/api/admin/pause-logs", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const pauses = await storage.getAllSubscriptionPauses();
    res.json({ pauses });
  } catch (error: any) {
    console.error("Get pause logs error:", error);
    res.status(500).json({ error: error.message || "Failed to get pause logs" });
  }
});

app.get("/api/admin/pause-logs/export", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const pauses = await storage.getAllSubscriptionPauses();

    const headers = [
      "ID", "Date", "Customer Email", "Subscription ID", "Chargebee Customer ID",
      "Duration (months)", "Pause Date", "Resume Date", "Travel Add-on Added",
      "Travel Add-on ID", "Reason", "Reason Details", "Status"
    ];

    const escapeCSV = (val: string | number | boolean | null | undefined): string => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      return str.replace(/"/g, '""').replace(/\r?\n/g, ' ');
    };

    const rows = pauses.map(p => [
      p.id,
      p.createdAt ? new Date(p.createdAt).toISOString() : "",
      escapeCSV(p.customerEmail),
      escapeCSV(p.subscriptionId),
      escapeCSV(p.chargebeeCustomerId),
      p.pauseDurationMonths,
      p.pauseDate ? new Date(p.pauseDate).toISOString().split('T')[0] : "",
      p.resumeDate ? new Date(p.resumeDate).toISOString().split('T')[0] : "",
      p.travelAddonAdded ? "Yes" : "No",
      escapeCSV(p.travelAddonItemPriceId),
      escapeCSV(p.pauseReason),
      escapeCSV(p.pauseReasonDetails),
      escapeCSV(p.status)
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=pause-logs-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
  } catch (error: any) {
    console.error("Export pause logs error:", error);
    res.status(500).json({ error: error.message || "Failed to export pause logs" });
  }
});

// Test endpoint for cancellation Slack message
app.post("/api/admin/test-cancellation-slack", async (req, res) => {
  try {
    const slackToken = process.env.SLACK_BOT_TOKEN;
    if (!slackToken) {
      return res.status(400).json({ error: "SLACK_BOT_TOKEN not configured" });
    }
    
    const channelId = (await storage.getPortalSetting('slack_channel_id'))?.value || 'C09DACN82VD';
    const zendeskSubdomain = process.env.ZENDESK_SUBDOMAIN || 'nomadinternet';
    
    const testMessage = {
      channel: channelId,
      text: `:rotating_light: *New Cancellation Request* <@U09HLQ6229K> <@U09J3KB0HFB>`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "New Cancellation Request", emoji: true }
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: "<@U09HLQ6229K> <@U09J3KB0HFB>" }
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Customer:*\nTest Customer` },
            { type: "mrkdwn", text: `*Email:*\ntest@example.com` },
            { type: "mrkdwn", text: `*Subscription:*\nTEST-SUB-12345` },
            { type: "mrkdwn", text: `*Current Price:*\n$99.00/mo` },
            { type: "mrkdwn", text: `*Reason:*\ntoo expensive` },
            { type: "mrkdwn", text: `*Discount:* :white_check_mark:\nAccepted` }
          ]
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Customer's Comments:*\n>I really enjoyed the service but it's just not in my budget right now.\n>Maybe I'll come back when prices are lower.` }
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Contact Method:*\nPhone: (555) 123-4567` },
            { type: "mrkdwn", text: `*Zendesk Ticket:*\n<https://${zendeskSubdomain}.zendesk.com/agent/tickets/99999|#99999>` }
          ]
        },
        {
          type: "context",
          elements: [
            { type: "mrkdwn", text: `[TEST MESSAGE] Submitted via Customer Portal • ${new Date().toLocaleString()}` }
          ]
        }
      ]
    };
    
    const slackResponse = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${slackToken}`
      },
      body: JSON.stringify(testMessage)
    });
    
    const slackResult = await slackResponse.json();
    if (!slackResult.ok) {
      console.error("Slack test message failed:", slackResult);
      return res.status(500).json({ error: slackResult.error || "Failed to send test message" });
    }
    
    res.json({ success: true, message: "Test cancellation message sent to Slack" });
  } catch (error: any) {
    console.error("Test Slack message error:", error);
    res.status(500).json({ error: error.message || "Failed to send test message" });
  }
});

app.post("/api/admin/seed", async (req, res) => {
  try {
    const { email, password, name, adminSecret } = req.body;
    
    const validSecret = process.env.ADMIN_SEED_SECRET;
    const isProduction = process.env.NODE_ENV === "production";
    
    if (isProduction && (!validSecret || adminSecret !== validSecret)) {
      return res.status(403).json({ error: "Invalid admin secret" });
    }
    
    if (!isProduction && adminSecret !== "dev-seed-only" && adminSecret !== validSecret) {
      return res.status(403).json({ error: "Invalid admin secret" });
    }

    const targetEmail = email || "bryan@nomadinternet.com";
    const targetPassword = password || "Awais@0301";
    const targetName = name || "Bryan";

    const existingAdmin = await storage.getAdminByEmail(targetEmail);
    if (existingAdmin) {
      return res.json({ message: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash(targetPassword, 10);
    const admin = await storage.createAdmin({
      email: targetEmail,
      password: hashedPassword,
      name: targetName
    });

    res.json({ success: true, message: "Admin created", adminId: admin.id });
  } catch (error: any) {
    console.error("Seed admin error:", error);
    res.status(500).json({ error: error.message || "Failed to seed admin" });
  }
});

// Fetch all Chargebee catalog items (plans and add-ons including archived)
app.get("/api/admin/chargebee-catalog", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { adminId: number };
    if (!decoded.adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fetch items and item prices in parallel
    const [itemsResult, pricesResult] = await Promise.all([
      fetchChargebeeCatalogItems(),
      fetchChargebeeItemPrices()
    ]);

    if (!itemsResult.success) {
      return res.status(500).json({ error: itemsResult.error });
    }

    if (!pricesResult.success) {
      return res.status(500).json({ error: pricesResult.error });
    }

    // Generate planNames map format
    const planNamesMap: Record<string, string> = {};
    
    // Add items
    if (itemsResult.items) {
      for (const item of itemsResult.items) {
        planNamesMap[item.id] = item.name;
      }
    }
    
    // Add item prices (these are what subscriptions actually reference)
    if (pricesResult.itemPrices) {
      for (const price of pricesResult.itemPrices) {
        // Store with full price ID
        planNamesMap[price.id] = price.name;
        // Also store without currency/period suffix for flexible matching
        const baseId = price.id.replace(/-USD-(Monthly|Yearly|Annual|Weekly|Daily)$/i, '');
        if (!planNamesMap[baseId]) {
          planNamesMap[baseId] = price.name;
        }
      }
    }

    res.json({
      success: true,
      items: itemsResult.items,
      itemPrices: pricesResult.itemPrices,
      planNamesMap,
      totalItems: itemsResult.items?.length || 0,
      totalItemPrices: pricesResult.itemPrices?.length || 0
    });
  } catch (error: any) {
    console.error("Fetch Chargebee catalog error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch catalog" });
  }
});

app.get("/api/plan-change/options", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const planId = req.query.planId as string;
    if (!planId) return res.status(400).json({ error: "Plan ID is required" });

    const { getPlanChangeOptions } = await import('../shared/planChangeConfig');
    const options = getPlanChangeOptions(planId);

    res.json({ options: options || [] });
  } catch (error: any) {
    console.error("Get plan change options error:", error);
    res.status(500).json({ error: error.message || "Failed to get plan options" });
  }
});

app.post("/api/plan-change/execute", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    let customerId: number | null = null;
    let isTestToken = false;
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded.isTest) {
        isTestToken = true;
        customerEmail = decoded.email;
      }
    } catch (e) {}
    if (!isTestToken) {
      const session = await storage.getSessionByToken(token);
      if (!session) return res.status(401).json({ error: "Invalid or expired session" });
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      customerEmail = customer.email;
      customerId = customer.id;
    }
    if (!customerEmail) return res.status(401).json({ error: "Unable to identify customer" });
    if (customerId === null) {
      const customerByEmail = await storage.getCustomerByEmail(customerEmail);
      if (customerByEmail) {
        customerId = customerByEmail.id;
      } else {
        return res.status(404).json({ error: "Customer not found in database" });
      }
    }

    const { subscriptionId, newPlanId, chargebeeCustomerId } = req.body;
    if (!subscriptionId) return res.status(400).json({ error: "Subscription ID is required" });
    if (!newPlanId) return res.status(400).json({ error: "New plan ID is required" });

    const { getPlanChangeOptions } = await import('../shared/planChangeConfig');
    const { fetchCustomerFullData } = await import('./services');

    const fullData = await fetchCustomerFullData(customerEmail);
    let targetSub: any = null;
    let targetChargebeeCustomerId: string = '';
    for (const cbCust of fullData.chargebee.customers) {
      for (const sub of cbCust.subscriptions) {
        if (sub.id === subscriptionId) {
          targetSub = sub;
          targetChargebeeCustomerId = cbCust.id;
          break;
        }
      }
      if (targetSub) break;
    }

    if (!targetSub) return res.status(404).json({ error: "Subscription not found" });
    if (targetSub.status !== 'active') {
      return res.status(400).json({ error: "Only active subscriptions can change plans" });
    }

    const options = getPlanChangeOptions(targetSub.planId);
    if (!options || !options.find((o: any) => o.planId === newPlanId)) {
      return res.status(400).json({ error: "This plan change is not allowed for your current plan" });
    }

    const selectedOption = options.find((o: any) => o.planId === newPlanId)!;

    const { changeSubscriptionPlan } = await import('./services');
    const result = await changeSubscriptionPlan(subscriptionId, newPlanId);

    if (result.success) {
      await storage.createPlanChangeVerification({
        customerId,
        customerEmail,
        subscriptionId,
        chargebeeCustomerId: chargebeeCustomerId || targetChargebeeCustomerId,
        currentPlanId: targetSub.planId,
        currentPlanName: targetSub.planName || targetSub.planId,
        currentPrice: Math.round(targetSub.planAmount * 100),
        requestedPlanId: newPlanId,
        requestedPlanName: newPlanId,
        requestedPrice: Math.round(selectedOption.price * 100),
        status: 'completed',
        chargebeeUpdated: true,
      });

      return res.json({ success: true, message: "Plan change scheduled successfully" });
    } else {
      return res.status(500).json({ error: result.error || "Failed to change plan" });
    }
  } catch (error: any) {
    console.error("Plan change execution error:", error);
    res.status(500).json({ error: error.message || "Failed to execute plan change" });
  }
});

app.post("/api/plan-change/cancel-scheduled", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    let customerEmail: string | null = null;
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded.isTest) {
        customerEmail = decoded.email;
      }
    } catch (e) {}
    if (!customerEmail) {
      const session = await storage.getSessionByToken(token);
      if (!session) return res.status(401).json({ error: "Invalid or expired session" });
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      customerEmail = customer.email;
    }
    if (!customerEmail) return res.status(401).json({ error: "Unable to identify customer" });

    const { subscriptionId } = req.body;
    if (!subscriptionId) return res.status(400).json({ error: "Subscription ID is required" });

    const { fetchCustomerFullData, removeScheduledChanges } = await import('./services');
    const fullData = await fetchCustomerFullData(customerEmail);
    let found = false;
    for (const cbCust of fullData.chargebee.customers) {
      for (const sub of cbCust.subscriptions) {
        if (sub.id === subscriptionId) {
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) return res.status(404).json({ error: "Subscription not found" });

    const result = await removeScheduledChanges(subscriptionId);
    if (result.success) {
      return res.json({ success: true, message: "Scheduled changes cancelled successfully" });
    } else {
      return res.status(500).json({ error: result.error || "Failed to cancel scheduled changes" });
    }
  } catch (error: any) {
    console.error("Cancel scheduled changes error:", error);
    res.status(500).json({ error: error.message || "Failed to cancel scheduled changes" });
  }
});

app.get("/api/admin/plan-changes", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (!decoded.isAdmin) return res.status(403).json({ error: "Admin access required" });
    } catch (e) {
      return res.status(401).json({ error: "Invalid admin token" });
    }

    const planChanges = await storage.getAllPlanChangeVerifications();
    res.json({ planChanges });
  } catch (error: any) {
    console.error("Get plan changes error:", error);
    res.status(500).json({ error: error.message || "Failed to get plan changes" });
  }
});

app.get("/api/admin/plan-changes/export", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (!decoded.isAdmin) return res.status(403).json({ error: "Admin access required" });
    } catch (e) {
      return res.status(401).json({ error: "Invalid admin token" });
    }

    const planChanges = await storage.getAllPlanChangeVerifications();

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const headers = ['Date', 'Customer Email', 'Subscription ID', 'Current Plan', 'Current Price', 'New Plan', 'New Price', 'Status'];
    const rows = planChanges.map(pc => [
      pc.createdAt ? new Date(pc.createdAt).toISOString() : '',
      escapeCSV(pc.customerEmail),
      escapeCSV(pc.subscriptionId),
      escapeCSV(pc.currentPlanId),
      pc.currentPrice ? `$${(pc.currentPrice / 100).toFixed(2)}` : '',
      escapeCSV(pc.requestedPlanId),
      pc.requestedPrice ? `$${(pc.requestedPrice / 100).toFixed(2)}` : '',
      escapeCSV(pc.status)
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=plan-changes.csv');
    res.send(csv);
  } catch (error: any) {
    console.error("Export plan changes error:", error);
    res.status(500).json({ error: error.message || "Failed to export plan changes" });
  }
});

app.get("/api/admin/addon-logs", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (!decoded.isAdmin) return res.status(403).json({ error: "Admin access required" });
    } catch (e) {
      return res.status(401).json({ error: "Invalid admin token" });
    }

    const addonLogs = await storage.getAllAddonLogs();
    res.json({ addonLogs });
  } catch (error: any) {
    console.error("Get addon logs error:", error);
    res.status(500).json({ error: error.message || "Failed to get addon logs" });
  }
});

app.get("/api/admin/addon-logs/export", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (!decoded.isAdmin) return res.status(403).json({ error: "Admin access required" });
    } catch (e) {
      return res.status(401).json({ error: "Invalid admin token" });
    }

    const addonLogs = await storage.getAllAddonLogs();

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const headers = ['Date', 'Customer Email', 'Subscription ID', 'Action', 'Add-on', 'Add-on Family', 'Item Price ID', 'Price', 'Invoice ID', 'Status', 'Error'];
    const rows = addonLogs.map(log => [
      log.createdAt ? new Date(log.createdAt).toISOString() : '',
      escapeCSV(log.customerEmail),
      escapeCSV(log.subscriptionId),
      escapeCSV(log.action),
      escapeCSV(log.addonName),
      escapeCSV(log.addonFamily),
      escapeCSV(log.addonItemPriceId),
      log.addonPrice ? `$${(log.addonPrice / 100).toFixed(2)}` : '',
      escapeCSV(log.invoiceId),
      escapeCSV(log.status),
      escapeCSV(log.errorMessage)
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=addon-logs-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error: any) {
    console.error("Export addon logs error:", error);
    res.status(500).json({ error: error.message || "Failed to export addon logs" });
  }
});

app.get("/api/admin/early-payment-logs", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (!decoded.isAdmin) return res.status(403).json({ error: "Admin access required" });
    } catch (e) {
      return res.status(401).json({ error: "Invalid admin token" });
    }

    const logs = await storage.getAllEarlyPaymentLogs();
    res.json({ earlyPaymentLogs: logs });
  } catch (error: any) {
    console.error("Get early payment logs error:", error);
    res.status(500).json({ error: error.message || "Failed to get early payment logs" });
  }
});

app.get("/api/admin/early-payment-logs/export", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (!decoded.isAdmin) return res.status(403).json({ error: "Admin access required" });
    } catch (e) {
      return res.status(401).json({ error: "Invalid admin token" });
    }

    const logs = await storage.getAllEarlyPaymentLogs();

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const headers = ['Date', 'Customer Email', 'Subscription ID', 'Plan', 'Terms Charged', 'Invoice ID', 'Total Amount', 'Status', 'Error'];
    const rows = logs.map(log => [
      log.createdAt ? new Date(log.createdAt).toISOString() : '',
      escapeCSV(log.customerEmail),
      escapeCSV(log.subscriptionId),
      escapeCSV(log.planName || log.planId),
      String(log.termsCharged),
      escapeCSV(log.invoiceId),
      log.totalAmount ? `$${(log.totalAmount / 100).toFixed(2)}` : '',
      escapeCSV(log.status),
      escapeCSV(log.errorMessage)
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=early-payment-logs-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error: any) {
    console.error("Export early payment logs error:", error);
    res.status(500).json({ error: error.message || "Failed to export early payment logs" });
  }
});

app.get("/api/admin/api-logs", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (!decoded.isAdmin) return res.status(403).json({ error: "Admin access required" });
    } catch (e) {
      return res.status(401).json({ error: "Invalid admin token" });
    }

    const limit = parseInt(req.query.limit as string) || 500;
    const apiLogs = await storage.getExternalApiLogs(Math.min(limit, 2000));
    res.json({ apiLogs });
  } catch (error: any) {
    console.error("Get API logs error:", error);
    res.status(500).json({ error: error.message || "Failed to get API logs" });
  }
});

app.get("/api/admin/api-logs/export", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (!decoded.isAdmin) return res.status(403).json({ error: "Admin access required" });
    } catch (e) {
      return res.status(401).json({ error: "Invalid admin token" });
    }

    const apiLogs = await storage.getExternalApiLogs(2000);

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const headers = ['Date', 'Service', 'Endpoint', 'Method', 'Status Code', 'Duration (ms)', 'Success', 'Error', 'Customer Email', 'Triggered By'];
    const rows = apiLogs.map(log => [
      log.createdAt ? new Date(log.createdAt).toISOString() : '',
      escapeCSV(log.service),
      escapeCSV(log.endpoint),
      escapeCSV(log.method),
      log.statusCode || '',
      log.durationMs || '',
      log.success ? 'Yes' : 'No',
      escapeCSV(log.errorMessage),
      escapeCSV(log.customerEmail),
      escapeCSV(log.triggeredBy)
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=api-logs-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error: any) {
    console.error("Export API logs error:", error);
    res.status(500).json({ error: error.message || "Failed to export API logs" });
  }
});

app.get("/api/admin/api-logs/stats", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (!decoded.isAdmin) return res.status(403).json({ error: "Admin access required" });
    } catch (e) {
      return res.status(401).json({ error: "Invalid admin token" });
    }

    const apiLogs = await storage.getExternalApiLogs(2000);
    const now = Date.now();
    const last24h = apiLogs.filter(l => l.createdAt && (now - new Date(l.createdAt).getTime()) < 86400000);

    const byService: Record<string, { total: number; failed: number; avgDuration: number }> = {};
    for (const log of last24h) {
      if (!byService[log.service]) {
        byService[log.service] = { total: 0, failed: 0, avgDuration: 0 };
      }
      byService[log.service].total++;
      if (!log.success) byService[log.service].failed++;
      byService[log.service].avgDuration += (log.durationMs || 0);
    }
    for (const svc of Object.keys(byService)) {
      byService[svc].avgDuration = Math.round(byService[svc].avgDuration / byService[svc].total);
    }

    res.json({
      totalLast24h: last24h.length,
      failedLast24h: last24h.filter(l => !l.success).length,
      byService
    });
  } catch (error: any) {
    console.error("Get API stats error:", error);
    res.status(500).json({ error: error.message || "Failed to get API stats" });
  }
});

app.post("/api/admin/payment-analysis", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded.isAdmin) return res.status(403).json({ error: "Admin access required" });
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const CHARGEBEE_API_KEY = process.env.CHARGEBEE_API_KEY;
    const CHARGEBEE_SITE = process.env.CHARGEBEE_SITE;

    if (!CHARGEBEE_API_KEY || !CHARGEBEE_SITE) {
      return res.status(500).json({ error: "Chargebee credentials not configured" });
    }

    const { customers } = req.body;
    if (!customers || !Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ error: "customers array is required" });
    }

    const cbAuth = `Basic ${Buffer.from(`${CHARGEBEE_API_KEY}:`).toString('base64')}`;
    const cbBase = `https://${CHARGEBEE_SITE}.chargebee.com/api/v2`;

    async function analyzeCustomer(customer: any): Promise<any> {
      const { customer_id, customer_name, email, previous_success_amount, current_success_amount, delta } = customer;
      let reason = "Unable to determine";
      let subscription_status = "unknown";
      let billing_date: string | null = null;
      let last_payment_date: string | null = null;

      try {
        const headers = { 'Authorization': cbAuth, 'Content-Type': 'application/json' };

        const [subsRes, invoicesRes, txnsRes] = await Promise.all([
          fetch(`${cbBase}/subscriptions?customer_id[is]=${encodeURIComponent(customer_id)}`, { headers }),
          fetch(`${cbBase}/invoices?customer_id[is]=${encodeURIComponent(customer_id)}&sort_by[desc]=date&limit=5`, { headers }),
          fetch(`${cbBase}/transactions?customer_id[is]=${encodeURIComponent(customer_id)}&sort_by[desc]=date&limit=10`, { headers }),
        ]);

        const subsData = subsRes.ok ? await subsRes.json() : { list: [] };
        const invoicesData = invoicesRes.ok ? await invoicesRes.json() : { list: [] };
        const txnsData = txnsRes.ok ? await txnsRes.json() : { list: [] };

        const subscriptions = (subsData.list || []).map((s: any) => s.subscription);
        const invoices = (invoicesData.list || []).map((i: any) => i.invoice);
        const transactions = (txnsData.list || []).map((t: any) => t.transaction);

        if (subscriptions.length === 0) {
          reason = "No active subscriptions found in Chargebee";
          subscription_status = "none";
          return { customer_id, customer_name, email, previous_success_amount, current_success_amount, delta, reason, subscription_status, billing_date, last_payment_date };
        }

        const allCancelled = subscriptions.every((s: any) => s.status === "cancelled");
        const anyPaused = subscriptions.some((s: any) => s.status === "paused");
        const activeSubs = subscriptions.filter((s: any) => s.status === "active" || s.status === "in_trial" || s.status === "non_renewing");

        if (allCancelled) {
          const lastCancelled = subscriptions
            .filter((s: any) => s.cancelled_at)
            .sort((a: any, b: any) => (b.cancelled_at || 0) - (a.cancelled_at || 0))[0];
          const cancelDate = lastCancelled?.cancelled_at
            ? new Date(lastCancelled.cancelled_at * 1000).toISOString().split('T')[0]
            : "unknown date";
          reason = `Subscription cancelled on ${cancelDate}`;
          subscription_status = "cancelled";
          return { customer_id, customer_name, email, previous_success_amount, current_success_amount, delta, reason, subscription_status, billing_date, last_payment_date };
        }

        const pausedSubs = subscriptions.filter((s: any) => s.status === "paused");
        if (pausedSubs.length > 0 && activeSubs.length === 0) {
          const pausedSub = pausedSubs[0];
          const resumeDate = pausedSub.resume_date ? new Date(pausedSub.resume_date * 1000).toISOString().split('T')[0] : null;
          reason = resumeDate ? `Subscription paused (resumes ${resumeDate})` : "Subscription paused";
          subscription_status = "paused";
          return { customer_id, customer_name, email, previous_success_amount, current_success_amount, delta, reason, subscription_status, billing_date, last_payment_date };
        }

        if (activeSubs.length > 0) {
          const activeSub = activeSubs.sort((a: any, b: any) => (b.current_term_start || 0) - (a.current_term_start || 0))[0];
          subscription_status = activeSub.status;

          const nextBilling = activeSub.next_billing_at ? new Date(activeSub.next_billing_at * 1000) : null;
          const billingDay = nextBilling ? nextBilling.getDate() : null;
          billing_date = nextBilling ? nextBilling.toISOString().split('T')[0] : null;

          const successfulTxns = transactions.filter((t: any) => t.status === "success" && t.type === "payment");
          if (successfulTxns.length > 0) {
            last_payment_date = new Date(successfulTxns[0].date * 1000).toISOString().split('T')[0];
          }

          const paidInvoices = invoices.filter((inv: any) => inv.status === "paid");
          const unpaidInvoices = invoices.filter((inv: any) => inv.status === "payment_due" || inv.status === "not_paid");

          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();

          const paidThisMonth = paidInvoices.find((inv: any) => {
            if (!inv.paid_at) return false;
            const paidDate = new Date(inv.paid_at * 1000);
            return paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear;
          });

          const ordinal = (n: number) => {
            const s = ["th", "st", "nd", "rd"];
            const v = n % 100;
            return n + (s[(v - 20) % 10] || s[v] || s[0]);
          };

          const currentTermStart = activeSub.current_term_start ? new Date(activeSub.current_term_start * 1000) : null;
          const actualBillingDay = currentTermStart ? currentTermStart.getDate() : billingDay;

          if (actualBillingDay !== null && Math.abs(actualBillingDay - 15) > 3) {
            if (paidThisMonth) {
              const paidDate = new Date(paidThisMonth.paid_at * 1000).toISOString().split('T')[0];
              reason = `Previous payment was a late retry; actual billing date is ${ordinal(actualBillingDay)}, already paid on ${paidDate}`;
            } else if (unpaidInvoices.length > 0) {
              const unpaidDate = new Date(unpaidInvoices[0].date * 1000).toISOString().split('T')[0];
              reason = `Previous payment was a late retry; actual billing date is ${ordinal(actualBillingDay)}, unpaid invoice from ${unpaidDate}`;
            } else {
              reason = `Previous payment was a late retry; actual billing date is ${ordinal(actualBillingDay)}`;
            }
            return { customer_id, customer_name, email, previous_success_amount, current_success_amount, delta, reason, subscription_status, billing_date, last_payment_date };
          }

          if (unpaidInvoices.length > 0) {
            const latestError = transactions.find((t: any) => t.status === "failure");
            const errorDetail = latestError?.error_text || "card declined/insufficient funds";
            reason = `Payment failing - ${errorDetail}`;
            return { customer_id, customer_name, email, previous_success_amount, current_success_amount, delta, reason, subscription_status, billing_date, last_payment_date };
          }

          if (paidThisMonth) {
            const paidDate = new Date(paidThisMonth.paid_at * 1000).toISOString().split('T')[0];
            reason = `Already paid on ${paidDate} - billing date shifted`;
            return { customer_id, customer_name, email, previous_success_amount, current_success_amount, delta, reason, subscription_status, billing_date, last_payment_date };
          }

          reason = "Active subscription - no recent payment found";
        }
      } catch (err: any) {
        reason = `Error analyzing: ${err.message || "unknown error"}`;
      }

      return { customer_id, customer_name, email, previous_success_amount, current_success_amount, delta, reason, subscription_status, billing_date, last_payment_date };
    }

    const results: any[] = [];
    const batchSize = 5;
    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(analyzeCustomer));
      results.push(...batchResults);
    }

    res.json({ results });
  } catch (error: any) {
    console.error("Payment analysis error:", error);
    res.status(500).json({ error: error.message || "Failed to run payment analysis" });
  }
});

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(distPath, "index.html"));
    } else {
      next();
    }
  });
}

async function seedPortalSettings() {
  const defaultSettings = [
    { key: 'slack_channel_id', value: 'C09DACN82VD', description: 'Slack channel for cancellation notifications' },
    { key: 'zendesk_cancellation_group_id', value: '41909825396372', description: 'Zendesk Retention & Cancellations group ID' },
    { key: 'zendesk_troubleshooting_group_id', value: '41909825396372', description: 'Zendesk Tier 1 Support group ID for troubleshooting tickets' }
  ];

  for (const setting of defaultSettings) {
    const existing = await storage.getPortalSetting(setting.key);
    if (!existing) {
      await storage.updatePortalSetting(setting.key, setting.value, 'system');
      console.log(`Seeded portal setting: ${setting.key}`);
    }
  }

  const defaultCreditConfigs = [
    { issueType: "service_not_working", label: "My service wasn't working", creditType: "percentage", creditAmountCents: 0, creditPercentage: 25, maxCreditCents: 5000, description: "Service outage or quality issues - offers percentage of plan price as credit" },
    { issueType: "incorrect_charge", label: "I was charged incorrectly", creditType: "fixed", creditAmountCents: 2000, creditPercentage: 0, description: "Double charge, overcharge, or billing error - offers fixed credit amount" },
    { issueType: "cancelled_still_charged", label: "I cancelled but was still charged", creditType: "fixed", creditAmountCents: 0, creditPercentage: 0, description: "Escalation only - customer claims cancellation but still billed" },
    { issueType: "equipment_return", label: "I returned equipment and want a refund", creditType: "fixed", creditAmountCents: 0, creditPercentage: 0, description: "Escalation only - customer claims equipment was returned" },
    { issueType: "unhappy_with_service", label: "I'm unhappy with my service", creditType: "fixed", creditAmountCents: 2500, creditPercentage: 0, description: "General dissatisfaction - offers loyalty credit to retain customer" },
    { issueType: "other_billing", label: "Other billing question", creditType: "fixed", creditAmountCents: 1500, creditPercentage: 0, description: "General billing inquiry - offers small goodwill credit" },
  ];

  for (const config of defaultCreditConfigs) {
    const existing = await storage.getBillingCreditConfig(config.issueType);
    if (!existing) {
      await storage.upsertBillingCreditConfig({ ...config, enabled: true, updatedBy: "system" });
      console.log(`Seeded billing credit config: ${config.issueType}`);
    }
  }
}

// ==================== BILLING RESOLUTION CENTER ====================

app.get("/api/billing-resolution/config", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const session = await storage.getSessionByToken(token);
    if (!session) {
      try { jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: "Invalid token" }); }
    }
    const configs = await storage.getAllBillingCreditConfigs();
    const enabledConfigs = configs.filter(c => c.enabled);
    res.json({ configs: enabledConfigs.map(c => ({ issueType: c.issueType, label: c.label, description: c.description })) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get config" });
  }
});

app.post("/api/billing-resolution/start", customerApiLimiter, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const session = await storage.getSessionByToken(token);
    let customerId: number | null = null;
    let customerEmail = "";

    if (session) {
      customerId = session.customerId;
      const customer = await storage.getCustomer(session.customerId);
      customerEmail = customer?.email || "";
    } else {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        customerEmail = decoded.email || "";
        const decodedId = decoded.customerId;
        if (decodedId && decodedId > 0) {
          const customerExists = await storage.getCustomer(decodedId);
          customerId = customerExists ? decodedId : null;
        }
      } catch { return res.status(401).json({ error: "Invalid token" }); }
    }

    const { issueType, issueDetails, subscriptionId } = req.body;
    if (!issueType) return res.status(400).json({ error: "Issue type is required" });

    const config = await storage.getBillingCreditConfig(issueType);
    if (!config || !config.enabled) return res.status(400).json({ error: "This issue type is not available" });

    const escalationTypes = ["cancelled_still_charged", "equipment_return"];
    const isEscalation = escalationTypes.includes(issueType);

    let chargebeeCustomerId: string | null = null;
    let subscriptionStatus: string | null = null;
    let subscriptionPrice: number | null = null;
    let creditOfferCents = 0;

    if (customerEmail) {
      try {
        setApiLogContext({ customerEmail, triggeredBy: "billing_resolution" });
        const data = await fetchCustomerFullData(customerEmail);
        clearApiLogContext();

        if (data.chargebee?.customers?.length > 0) {
          const cbCustomer = data.chargebee.customers[0];
          chargebeeCustomerId = cbCustomer.id;

          if (subscriptionId) {
            const sub = cbCustomer.subscriptions.find((s: any) => s.id === subscriptionId);
            if (sub) {
              subscriptionStatus = sub.status;
              subscriptionPrice = sub.planAmount;
            }
          } else if (cbCustomer.subscriptions.length > 0) {
            const activeSub = cbCustomer.subscriptions.find((s: any) => s.status === "active") || cbCustomer.subscriptions[0];
            subscriptionStatus = activeSub.status;
            subscriptionPrice = activeSub.planAmount;
          }
        }
      } catch (err) {
        console.error("Error fetching Chargebee data for billing resolution:", err);
      }
    }

    if (!isEscalation && config.creditType === "fixed") {
      creditOfferCents = config.creditAmountCents;
    } else if (!isEscalation && config.creditType === "percentage" && subscriptionPrice) {
      creditOfferCents = Math.round((subscriptionPrice * 100 * (config.creditPercentage || 0)) / 100);
      if (config.maxCreditCents && creditOfferCents > config.maxCreditCents) {
        creditOfferCents = config.maxCreditCents;
      }
    }

    const resolution = await storage.createBillingResolution({
      customerId,
      customerEmail,
      chargebeeCustomerId,
      issueType,
      issueDetails: issueDetails || null,
      subscriptionId: subscriptionId || null,
      subscriptionStatus,
      subscriptionPrice: subscriptionPrice ? Math.round(subscriptionPrice * 100) : null,
      creditOffered: isEscalation ? null : creditOfferCents,
      creditType: isEscalation ? null : config.creditType,
      outcome: isEscalation ? "escalation_pending" : "credit_offered",
    });

    res.json({
      resolutionId: resolution.id,
      isEscalation,
      issueType,
      creditOffer: isEscalation ? null : {
        amountCents: creditOfferCents,
        amountDisplay: `$${(creditOfferCents / 100).toFixed(2)}`,
        type: config.creditType,
        description: `Account credit of $${(creditOfferCents / 100).toFixed(2)} will be applied to your next billing cycle`
      },
      subscriptionStatus,
      subscriptionPrice: subscriptionPrice ? `$${subscriptionPrice.toFixed(2)}` : null,
    });
  } catch (error: any) {
    console.error("Billing resolution start error:", error);
    res.status(500).json({ error: error.message || "Failed to start billing resolution" });
  }
});

app.post("/api/billing-resolution/accept-credit", heavyApiLimiter, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const session = await storage.getSessionByToken(token);
    if (!session) {
      try { jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: "Invalid token" }); }
    }

    const { resolutionId } = req.body;
    if (!resolutionId) return res.status(400).json({ error: "Resolution ID required" });

    const resolution = await storage.getBillingResolution(resolutionId);
    if (!resolution) return res.status(404).json({ error: "Resolution not found" });
    if (resolution.outcome !== "credit_offered") return res.status(400).json({ error: "Credit offer no longer available" });

    let creditApplied = false;
    let chargebeeCreditId: string | null = null;

    if (resolution.chargebeeCustomerId && resolution.creditOffered && resolution.creditOffered > 0) {
      const creditResult = await addPromotionalCredit(
        resolution.chargebeeCustomerId,
        resolution.creditOffered,
        `Portal Billing Resolution - ${resolution.issueType}: ${resolution.issueDetails || "Customer accepted credit offer"}`
      );
      if (creditResult.success) {
        creditApplied = true;
        chargebeeCreditId = creditResult.creditId || null;
      } else {
        console.error("Failed to apply Chargebee credit:", creditResult.error);
      }
    }

    await storage.updateBillingResolution(resolutionId, {
      outcome: creditApplied ? "credit_accepted" : "credit_failed",
      creditApplied,
      chargebeeCreditId,
    });

    if (creditApplied) {
      res.json({
        success: true,
        message: `A credit of $${((resolution.creditOffered || 0) / 100).toFixed(2)} has been applied to your account. It will be automatically used on your next invoice.`
      });
    } else {
      res.status(500).json({ error: "We were unable to apply the credit at this time. Please contact support." });
    }
  } catch (error: any) {
    console.error("Accept credit error:", error);
    res.status(500).json({ error: error.message || "Failed to accept credit" });
  }
});

app.post("/api/billing-resolution/decline-credit", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const session = await storage.getSessionByToken(token);
    if (!session) {
      try { jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: "Invalid token" }); }
    }

    const { resolutionId } = req.body;
    if (!resolutionId) return res.status(400).json({ error: "Resolution ID required" });

    const resolution = await storage.getBillingResolution(resolutionId);
    if (!resolution) return res.status(404).json({ error: "Resolution not found" });

    await storage.updateBillingResolution(resolutionId, { outcome: "credit_declined" });

    res.json({ success: true, resolutionId });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to decline credit" });
  }
});

app.post("/api/billing-resolution/escalate", heavyApiLimiter, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const session = await storage.getSessionByToken(token);
    let customerId: number | null = null;
    let customerEmail = "";
    let customerName = "";

    if (session) {
      customerId = session.customerId;
      const customer = await storage.getCustomer(session.customerId);
      customerEmail = customer?.email || "";
      customerName = customer?.fullName || customerEmail;
    } else {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        customerEmail = decoded.email || "";
        customerId = decoded.customerId || null;
        customerName = customerEmail;
      } catch { return res.status(401).json({ error: "Invalid token" }); }
    }

    const { resolutionId, contactMethod, contactPhone, additionalNotes, proofFileData, proofFileName, trackingNumber } = req.body;
    if (!resolutionId) return res.status(400).json({ error: "Resolution ID required" });

    const resolution = await storage.getBillingResolution(resolutionId);
    if (!resolution) return res.status(404).json({ error: "Resolution not found" });

    const issueLabels: Record<string, string> = {
      service_not_working: "Service Not Working / Quality Issue",
      incorrect_charge: "Incorrect Charge / Overcharge",
      cancelled_still_charged: "Cancelled But Still Being Charged",
      equipment_return: "Equipment Return - Refund Request",
      unhappy_with_service: "Unhappy With Service",
      other_billing: "Other Billing Question",
    };

    let zendeskTicketId: string | null = null;
    const zendeskSubdomain = process.env.ZENDESK_SUBDOMAIN;
    const zendeskEmail = process.env.ZENDESK_EMAIL;
    const zendeskToken = process.env.ZENDESK_API_TOKEN;

    if (zendeskSubdomain && zendeskEmail && zendeskToken) {
      try {
        const groupIdSetting = await storage.getPortalSetting("zendesk_troubleshooting_group_id");
        const groupId = groupIdSetting?.value || "41909825396372";

        let ticketBody: string = `
═══════════════════════════════════════
BILLING RESOLUTION CENTER - ESCALATION
═══════════════════════════════════════
Issue Type: ${issueLabels[resolution.issueType] || resolution.issueType}
Customer: ${customerName} (${customerEmail})
Chargebee ID: ${resolution.chargebeeCustomerId || "N/A"}
Subscription: ${resolution.subscriptionId || "N/A"}
Subscription Status: ${resolution.subscriptionStatus || "N/A"}
Subscription Price: ${resolution.subscriptionPrice ? `$${(resolution.subscriptionPrice / 100).toFixed(2)}` : "N/A"}`;

        if (resolution.creditOffered && resolution.outcome === "credit_declined") {
          ticketBody += `\n\nCredit Offered: $${(resolution.creditOffered / 100).toFixed(2)} - DECLINED by customer`;
        }

        if (resolution.issueType === "equipment_return") {
          ticketBody += `\n\n═══════════════════════════════════════
EQUIPMENT RETURN DETAILS
═══════════════════════════════════════
Tracking Number: ${trackingNumber || "Not provided"}
Proof of Return: ${proofFileName ? `Attached - ${proofFileName}` : "Not provided"}`;
        }

        ticketBody += `\n\n═══════════════════════════════════════
CUSTOMER'S DESCRIPTION
═══════════════════════════════════════
${resolution.issueDetails || "No details provided"}`;

        if (additionalNotes) {
          ticketBody += `\n\nAdditional Notes: ${additionalNotes}`;
        }

        ticketBody += `\n\n═══════════════════════════════════════
CONTACT PREFERENCE
═══════════════════════════════════════
Preferred Contact: ${contactMethod === "phone" ? `Phone - ${contactPhone || "not provided"}` : "Email"}`;

        ticketBody += `\n\n═══════════════════════════════════════
ACTION REQUIRED: Review billing issue and respond to customer within 24 hours.`;

        const zendeskTicketBody: any = {
          ticket: {
            subject: `[Billing Resolution] ${issueLabels[resolution.issueType] || resolution.issueType} - ${customerName}`,
            comment: { body: ticketBody, public: false },
            requester: { email: customerEmail, name: customerName },
            group_id: parseInt(groupId),
            priority: "normal",
            tags: ["billing_resolution", "portal", resolution.issueType]
          }
        };

        const zendeskResponse = await fetch(
          `https://${zendeskSubdomain}.zendesk.com/api/v2/tickets.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Basic " + Buffer.from(`${zendeskEmail}/token:${zendeskToken}`).toString("base64")
            },
            body: JSON.stringify(zendeskTicketBody)
          }
        );

        if (zendeskResponse.ok) {
          const zendeskData = await zendeskResponse.json() as any;
          zendeskTicketId = zendeskData.ticket?.id?.toString();
          console.log("Billing resolution Zendesk ticket created:", zendeskTicketId);

          if (proofFileData && proofFileName && zendeskTicketId) {
            try {
              const uploadUrl = `https://${zendeskSubdomain}.zendesk.com/api/v2/uploads.json?filename=${encodeURIComponent(proofFileName)}`;
              const fileBuffer = Buffer.from(proofFileData.split(",").pop() || "", "base64");
              const uploadRes = await fetch(uploadUrl, {
                method: "POST",
                headers: {
                  "Authorization": "Basic " + Buffer.from(`${zendeskEmail}/token:${zendeskToken}`).toString("base64"),
                  "Content-Type": "application/binary"
                },
                body: fileBuffer
              });
              if (uploadRes.ok) {
                const uploadData = await uploadRes.json() as any;
                const uploadToken = uploadData.upload?.token;
                if (uploadToken) {
                  await fetch(
                    `https://${zendeskSubdomain}.zendesk.com/api/v2/tickets/${zendeskTicketId}.json`,
                    {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Basic " + Buffer.from(`${zendeskEmail}/token:${zendeskToken}`).toString("base64")
                      },
                      body: JSON.stringify({
                        ticket: {
                          comment: {
                            body: `Proof of return attached: ${proofFileName}`,
                            public: false,
                            uploads: [uploadToken]
                          }
                        }
                      })
                    }
                  );
                }
              }
            } catch (uploadErr) {
              console.error("Failed to upload proof to Zendesk:", uploadErr);
            }
          }
        } else {
          console.error("Zendesk ticket creation failed:", await zendeskResponse.text());
        }
      } catch (zendeskError) {
        console.error("Zendesk API error:", zendeskError);
      }
    }

    const slackToken = process.env.SLACK_BOT_TOKEN;
    if (slackToken) {
      try {
        await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${slackToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            channel: "#billing-resolutions",
            text: `Billing Resolution Escalation`,
            blocks: [
              { type: "header", text: { type: "plain_text", text: "Billing Resolution Escalated" } },
              { type: "section", fields: [
                { type: "mrkdwn", text: `*Customer:*\n${customerName}` },
                { type: "mrkdwn", text: `*Email:*\n${customerEmail}` },
                { type: "mrkdwn", text: `*Issue:*\n${issueLabels[resolution.issueType] || resolution.issueType}` },
                { type: "mrkdwn", text: `*Zendesk:*\n${zendeskTicketId ? `<https://${zendeskSubdomain}.zendesk.com/agent/tickets/${zendeskTicketId}|#${zendeskTicketId}>` : "Failed"}` },
              ]},
              ...(resolution.creditOffered && resolution.outcome === "credit_declined" ? [
                { type: "section", text: { type: "mrkdwn", text: `Credit of $${(resolution.creditOffered / 100).toFixed(2)} was offered but *declined* by customer.` } }
              ] : []),
            ]
          })
        });
      } catch (slackErr) {
        console.error("Slack notification error:", slackErr);
      }
    }

    await storage.updateBillingResolution(resolutionId, {
      outcome: "escalated",
      zendeskTicketId,
      contactMethod: contactMethod || null,
      contactPhone: contactPhone || null,
      additionalNotes: additionalNotes || null,
      proofFileName: proofFileName || null,
      trackingNumber: trackingNumber || null,
    });

    res.json({
      success: true,
      ticketId: zendeskTicketId || `BR-${Date.now().toString(36).toUpperCase()}`,
      message: "Your billing issue has been escalated to our support team. We'll reach out within 24 hours."
    });
  } catch (error: any) {
    console.error("Billing resolution escalate error:", error);
    res.status(500).json({ error: error.message || "Failed to escalate" });
  }
});

app.get("/api/billing-resolution/history", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const session = await storage.getSessionByToken(token);
    let customerEmail = "";
    if (session) {
      const customer = await storage.getCustomer(session.customerId);
      customerEmail = customer?.email || "";
    } else {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        customerEmail = decoded.email || "";
      } catch { return res.status(401).json({ error: "Invalid token" }); }
    }

    const resolutions = await storage.getBillingResolutionsByCustomer(customerEmail);
    res.json({ resolutions });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get history" });
  }
});

// ==================== SERVICE ISSUE INTAKE + DOWNTIME CREDIT ENGINE ====================

async function resolveCustomerFromToken(token: string): Promise<{ customerId: number | null; customerEmail: string } | null> {
  const session = await storage.getSessionByToken(token);
  if (session) {
    const customer = await storage.getCustomer(session.customerId);
    return { customerId: session.customerId, customerEmail: customer?.email || "" };
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as any;
    const email = decoded.email || "";
    const decodedId = decoded.customerId;
    let customerId: number | null = null;
    if (decodedId && decodedId > 0) {
      const exists = await storage.getCustomer(decodedId);
      customerId = exists ? decodedId : null;
    }
    return { customerId, customerEmail: email };
  } catch {
    return null;
  }
}

app.post("/api/service-issue/start", customerApiLimiter, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const customer = await resolveCustomerFromToken(token);
    if (!customer) return res.status(401).json({ error: "Invalid token" });

    const { issueCategory, outageStatus, outageStart, outageEnd, outageTimezone, impactType, impactDetails, contactedSupportDuring, supportContactMethod, supportContactDetails, subscriptionId } = req.body;
    if (!issueCategory) return res.status(400).json({ error: "Issue category is required" });

    let chargebeeCustomerId: string | null = null;
    let invoiceId: string | null = null;
    let invoiceTotal: number | null = null;
    let termDays: number | null = null;
    let proratedAmount: number | null = null;
    let recommendedCredit: number | null = null;
    let cooldownBlocked = false;
    let cooldownReason: string | null = null;
    let priorCreditDate: Date | null = null;
    let priorCreditAmount: number | null = null;

    if (customer.customerEmail) {
      try {
        setApiLogContext({ customerEmail: customer.customerEmail, triggeredBy: "service_issue" });
        const data = await fetchCustomerFullData(customer.customerEmail);
        clearApiLogContext();

        if (data.chargebee?.customers?.length > 0) {
          const cbCustomer = data.chargebee.customers[0];
          chargebeeCustomerId = cbCustomer.id;

          const activeSub = subscriptionId
            ? cbCustomer.subscriptions.find((s: any) => s.id === subscriptionId)
            : cbCustomer.subscriptions.find((s: any) => s.status === "active") || cbCustomer.subscriptions[0];

          if (activeSub) {
            const recurringInvoices = cbCustomer.invoices
              .filter((inv: any) => inv.recurring && inv.status === "paid" && (inv.subscriptionId === activeSub.id || !inv.subscriptionId))
              .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

            if (recurringInvoices.length > 0) {
              const latestInvoice = recurringInvoices[0];
              invoiceId = latestInvoice.id;
              invoiceTotal = Math.round(latestInvoice.total * 100);
              termDays = activeSub.billingPeriod === 12 ? 365 : activeSub.billingPeriod === 6 ? 180 : 30;
            }
          }
        }
      } catch (err) {
        console.error("Error fetching Chargebee data for service issue:", err);
      }
    }

    if (issueCategory === "no_connection" && outageStatus === "resolved" && outageStart && outageEnd) {
      const start = new Date(outageStart);
      const end = new Date(outageEnd);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return res.status(400).json({ error: "Invalid dates provided" });
      if (end.getTime() <= start.getTime()) return res.status(400).json({ error: "End date must be after start date" });
      if (end.getTime() > Date.now()) return res.status(400).json({ error: "End date cannot be in the future" });
      const maxDurationMs = 90 * 24 * 60 * 60 * 1000;
      if (end.getTime() - start.getTime() > maxDurationMs) return res.status(400).json({ error: "Reported outage duration exceeds 90 days maximum" });
      const durationHours = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60)));
      const outageDays = durationHours / 24;

      if (invoiceTotal && termDays) {
        proratedAmount = Math.round(invoiceTotal * (outageDays / termDays));
        const cap = Math.round(invoiceTotal * 0.50);
        recommendedCredit = Math.min(proratedAmount, cap);
      }

      const recentDowntime = await storage.getRecentDowntimeCredit(customer.customerEmail, 30);
      if (recentDowntime) {
        cooldownBlocked = true;
        cooldownReason = "A downtime credit was already applied within the last 30 days";
        priorCreditDate = recentDowntime.createdAt;
        priorCreditAmount = recentDowntime.creditAmountApplied;
      }
    }

    if (issueCategory === "slow_speeds") {
      const recentGoodwill = await storage.getRecentGoodwillCredit(customer.customerEmail, 60);
      if (recentGoodwill) {
        cooldownBlocked = true;
        cooldownReason = "A goodwill credit was already applied within the last 60 days";
        priorCreditDate = recentGoodwill.createdAt;
        priorCreditAmount = recentGoodwill.creditAmountApplied;
      }
    }

    let outageDurationHours: number | null = null;
    if (outageStart && outageEnd) {
      const start = new Date(outageStart);
      const end = new Date(outageEnd);
      outageDurationHours = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60)));
    }

    const report = await storage.createServiceIssueReport({
      customerId: customer.customerId,
      customerEmail: customer.customerEmail,
      chargebeeCustomerId,
      subscriptionId: subscriptionId || null,
      issueCategory,
      outageStatus: outageStatus || null,
      outageStart: outageStart ? new Date(outageStart) : null,
      outageEnd: outageEnd ? new Date(outageEnd) : null,
      outageTimezone: outageTimezone || null,
      outageDurationHours,
      impactType: impactType || null,
      impactDetails: impactDetails || null,
      contactedSupportDuring: contactedSupportDuring || false,
      supportContactMethod: supportContactMethod || null,
      supportContactDetails: supportContactDetails || null,
      invoiceId,
      invoiceTotal,
      termDays,
      proratedAmount,
      recommendedCredit,
      creditType: issueCategory === "slow_speeds" ? "goodwill" : issueCategory === "no_connection" ? "downtime" : null,
      status: issueCategory === "no_connection" && outageStatus === "active" ? "active_outage" : "pending",
      outcome: "pending",
      cooldownBlocked,
      cooldownReason,
      priorCreditDate,
      priorCreditAmount,
    });

    const goodwillAmount = 1000;

    res.json({
      reportId: report.id,
      issueCategory,
      outageStatus: outageStatus || null,
      chargebeeCustomerId,
      invoiceId,
      invoiceTotal: invoiceTotal ? invoiceTotal / 100 : null,
      termDays,
      outageDurationHours,
      proratedAmount: proratedAmount ? proratedAmount / 100 : null,
      recommendedCredit: recommendedCredit ? recommendedCredit / 100 : null,
      creditCapPercent: 50,
      cooldownBlocked,
      cooldownReason,
      priorCreditDate: priorCreditDate?.toISOString() || null,
      priorCreditAmount: priorCreditAmount ? priorCreditAmount / 100 : null,
      goodwillAmount: issueCategory === "slow_speeds" && !cooldownBlocked ? goodwillAmount / 100 : null,
      creditOptions: issueCategory === "no_connection" && outageStatus === "resolved" && !cooldownBlocked && recommendedCredit ? {
        options: [
          { percent: 25, amount: Math.round((invoiceTotal || 0) * 0.25) / 100, label: "25% credit" },
          { percent: 50, amount: Math.round(Math.min(proratedAmount || 0, (invoiceTotal || 0) * 0.50)) / 100, label: "50% credit (recommended)" },
        ],
        maxPercent: 50,
        invoiceTotal: invoiceTotal ? invoiceTotal / 100 : 0,
      } : null,
    });
  } catch (error: any) {
    console.error("Service issue start error:", error);
    res.status(500).json({ error: error.message || "Failed to start service issue report" });
  }
});

app.post("/api/service-issue/accept-credit", heavyApiLimiter, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const customerInfo = await resolveCustomerFromToken(token);
    if (!customerInfo) return res.status(401).json({ error: "Invalid token" });

    const { reportId, creditPercent, creditType } = req.body;
    if (!reportId) return res.status(400).json({ error: "Report ID required" });

    const report = await storage.getServiceIssueReport(reportId);
    if (!report) return res.status(404).json({ error: "Report not found" });
    if (report.customerEmail !== customerInfo.customerEmail) return res.status(403).json({ error: "Not authorized" });
    if (report.creditApplied) return res.status(400).json({ error: "Credit was already applied" });
    if (report.cooldownBlocked) return res.status(400).json({ error: report.cooldownReason || "Credit is not eligible at this time" });

    let creditAmountCents = 0;
    let appliedCreditType = creditType || report.creditType || "downtime";

    if (appliedCreditType === "goodwill") {
      creditAmountCents = 1000;
    } else if (appliedCreditType === "downtime") {
      const percent = creditPercent || 50;
      if (percent > 50) return res.status(400).json({ error: "Credit cannot exceed 50% of invoice total" });
      if (!report.invoiceTotal) return res.status(400).json({ error: "Invoice data not available for credit calculation" });
      creditAmountCents = Math.round(report.invoiceTotal * (percent / 100));
    }

    if (creditAmountCents <= 0) return res.status(400).json({ error: "Invalid credit amount" });

    let creditApplied = false;
    let chargebeeCreditId: string | null = null;

    if (report.chargebeeCustomerId) {
      const desc = appliedCreditType === "goodwill"
        ? `Portal Goodwill Credit - Slow speed complaint`
        : `Portal Downtime Credit - Service outage ${report.outageStart?.toISOString().split('T')[0] || ''} to ${report.outageEnd?.toISOString().split('T')[0] || ''} (${report.outageDurationHours}h)`;
      const creditResult = await addPromotionalCredit(report.chargebeeCustomerId, creditAmountCents, desc);
      if (creditResult.success) {
        creditApplied = true;
        chargebeeCreditId = creditResult.creditId || null;
      } else {
        console.error("Failed to apply credit:", creditResult.error);
      }
    }

    await storage.updateServiceIssueReport(reportId, {
      selectedCreditPercent: creditPercent || (appliedCreditType === "goodwill" ? null : 50),
      creditAmountApplied: creditAmountCents,
      creditType: appliedCreditType,
      creditApplied,
      chargebeeCreditId,
      outcome: creditApplied ? "credit_applied" : "credit_failed",
      status: creditApplied ? "credit_applied" : "credit_failed",
    });

    if (creditApplied) {
      res.json({
        success: true,
        message: `A credit of $${(creditAmountCents / 100).toFixed(2)} has been applied to your account and will be used on your next invoice.`,
        creditAmount: creditAmountCents / 100,
      });
    } else {
      res.status(500).json({ error: "We were unable to apply the credit at this time. Please contact support." });
    }
  } catch (error: any) {
    console.error("Accept service issue credit error:", error);
    res.status(500).json({ error: error.message || "Failed to accept credit" });
  }
});

app.post("/api/service-issue/escalate", heavyApiLimiter, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const customerInfo = await resolveCustomerFromToken(token);
    if (!customerInfo) return res.status(401).json({ error: "Invalid token" });

    const { reportId, contactMethod, contactPhone, additionalNotes } = req.body;
    if (!reportId) return res.status(400).json({ error: "Report ID required" });

    const report = await storage.getServiceIssueReport(reportId);
    if (!report) return res.status(404).json({ error: "Report not found" });
    if (report.customerEmail !== customerInfo.customerEmail) return res.status(403).json({ error: "Not authorized" });

    let zendeskTicketId: string | null = null;

    const zendeskSubdomain = process.env.ZENDESK_SUBDOMAIN;
    const zendeskEmail = process.env.ZENDESK_EMAIL;
    const zendeskApiToken = process.env.ZENDESK_API_TOKEN;

    if (zendeskSubdomain && zendeskEmail && zendeskApiToken) {
      try {
        const categoryLabel = report.issueCategory === "no_connection" ? "No Connection" : report.issueCategory === "slow_speeds" ? "Slow Speeds" : "Other";
        const body = [
          `Service Issue Report #${report.id}`,
          `Issue: ${categoryLabel}`,
          report.outageStatus ? `Outage Status: ${report.outageStatus}` : null,
          report.outageStart ? `Outage Start: ${report.outageStart.toISOString()}` : null,
          report.outageEnd ? `Outage End: ${report.outageEnd.toISOString()}` : null,
          report.outageDurationHours ? `Duration: ${report.outageDurationHours} hours` : null,
          report.impactType ? `Impact: ${report.impactType}` : null,
          report.impactDetails ? `Details: ${report.impactDetails}` : null,
          report.invoiceTotal ? `Invoice Total: $${(report.invoiceTotal / 100).toFixed(2)}` : null,
          report.recommendedCredit ? `Recommended Credit: $${(report.recommendedCredit / 100).toFixed(2)}` : null,
          report.cooldownBlocked ? `Cooldown: ${report.cooldownReason}` : null,
          additionalNotes ? `Customer Notes: ${additionalNotes}` : null,
          `Contact: ${contactMethod || "email"}${contactPhone ? ` - ${contactPhone}` : ""}`,
        ].filter(Boolean).join("\n");

        const zendeskResponse = await fetch(
          `https://${zendeskSubdomain}.zendesk.com/api/v2/tickets.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${Buffer.from(`${zendeskEmail}/token:${zendeskApiToken}`).toString("base64")}`,
            },
            body: JSON.stringify({
              ticket: {
                subject: `Service Issue - ${categoryLabel} - ${report.customerEmail}`,
                comment: { body },
                requester: { email: report.customerEmail },
                priority: report.cooldownBlocked ? "normal" : "high",
                tags: ["service_issue", report.issueCategory, "portal_submission"],
              },
            }),
          }
        );

        if (zendeskResponse.ok) {
          const zendeskData = await zendeskResponse.json() as any;
          zendeskTicketId = zendeskData.ticket?.id?.toString() || null;
        }
      } catch (err) {
        console.error("Zendesk ticket creation failed:", err);
      }
    }

    await storage.updateServiceIssueReport(reportId, {
      outcome: "escalated",
      status: "escalated",
      zendeskTicketId,
      contactMethod: contactMethod || "email",
      contactPhone: contactPhone || null,
      additionalNotes: additionalNotes || null,
    });

    res.json({
      success: true,
      ticketId: zendeskTicketId,
      message: zendeskTicketId
        ? `Support ticket #${zendeskTicketId} has been created. Our billing team will review your case and reach out via ${contactMethod || "email"}.`
        : "Your request has been submitted to our support team. We'll reach out via " + (contactMethod || "email") + ".",
    });
  } catch (error: any) {
    console.error("Service issue escalate error:", error);
    res.status(500).json({ error: error.message || "Failed to escalate" });
  }
});

app.post("/api/service-issue/submit-ticket", customerApiLimiter, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const customerInfo = await resolveCustomerFromToken(token);
    if (!customerInfo) return res.status(401).json({ error: "Invalid token" });

    const { reportId, contactMethod, contactPhone, additionalNotes } = req.body;
    if (!reportId) return res.status(400).json({ error: "Report ID required" });

    const report = await storage.getServiceIssueReport(reportId);
    if (!report) return res.status(404).json({ error: "Report not found" });
    if (report.customerEmail !== customerInfo.customerEmail) return res.status(403).json({ error: "Not authorized" });

    let zendeskTicketId: string | null = null;
    const zendeskSubdomain = process.env.ZENDESK_SUBDOMAIN;
    const zendeskEmail = process.env.ZENDESK_EMAIL;
    const zendeskApiToken = process.env.ZENDESK_API_TOKEN;

    if (zendeskSubdomain && zendeskEmail && zendeskApiToken) {
      try {
        const body = [
          `Active Service Issue Report #${report.id}`,
          `Issue: Service not working (Active Outage)`,
          report.outageStart ? `Started: ${report.outageStart.toISOString()}` : "Started: Customer unsure of exact time",
          report.impactDetails ? `Details: ${report.impactDetails}` : null,
          additionalNotes ? `Customer Notes: ${additionalNotes}` : null,
          `Contact: ${contactMethod || "email"}${contactPhone ? ` - ${contactPhone}` : ""}`,
        ].filter(Boolean).join("\n");

        const zendeskResponse = await fetch(
          `https://${zendeskSubdomain}.zendesk.com/api/v2/tickets.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${Buffer.from(`${zendeskEmail}/token:${zendeskApiToken}`).toString("base64")}`,
            },
            body: JSON.stringify({
              ticket: {
                subject: `Active Outage - Troubleshooting Needed - ${report.customerEmail}`,
                comment: { body },
                requester: { email: report.customerEmail },
                priority: "urgent",
                tags: ["active_outage", "troubleshooting", "portal_submission"],
              },
            }),
          }
        );

        if (zendeskResponse.ok) {
          const zendeskData = await zendeskResponse.json() as any;
          zendeskTicketId = zendeskData.ticket?.id?.toString() || null;
        }
      } catch (err) {
        console.error("Zendesk ticket creation failed:", err);
      }
    }

    await storage.updateServiceIssueReport(reportId, {
      outcome: "ticket_submitted",
      status: "ticket_submitted",
      zendeskTicketId,
      contactMethod: contactMethod || "email",
      contactPhone: contactPhone || null,
      additionalNotes: additionalNotes || null,
    });

    res.json({
      success: true,
      ticketId: zendeskTicketId,
      message: zendeskTicketId
        ? `Troubleshooting ticket #${zendeskTicketId} has been created. Our team will reach out shortly to help restore your service.`
        : "Your troubleshooting request has been submitted. Our team will reach out shortly.",
    });
  } catch (error: any) {
    console.error("Service issue submit ticket error:", error);
    res.status(500).json({ error: error.message || "Failed to submit ticket" });
  }
});

app.post("/api/service-issue/upload-proof", customerApiLimiter, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const customerInfo = await resolveCustomerFromToken(token);
    if (!customerInfo) return res.status(401).json({ error: "Invalid token" });

    const { reportId, proofFileData, proofFileName } = req.body;
    if (!reportId) return res.status(400).json({ error: "Report ID required" });

    const report = await storage.getServiceIssueReport(reportId);
    if (!report) return res.status(404).json({ error: "Report not found" });
    if (report.customerEmail !== customerInfo.customerEmail) return res.status(403).json({ error: "Not authorized" });

    const existingNames = report.proofFileNames ? report.proofFileNames + "," + proofFileName : proofFileName;
    const existingData = report.proofFileData ? report.proofFileData + "|||" + proofFileData : proofFileData;

    await storage.updateServiceIssueReport(reportId, {
      proofFileNames: existingNames,
      proofFileData: existingData,
    });

    res.json({ success: true, message: "Proof uploaded successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to upload proof" });
  }
});

app.get("/api/service-issue/history", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const customerInfo = await resolveCustomerFromToken(token);
    if (!customerInfo) return res.status(401).json({ error: "Invalid token" });

    const reports = await storage.getServiceIssuesByCustomer(customerInfo.customerEmail);
    res.json({ reports });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get history" });
  }
});

// Admin service issue endpoints
app.get("/api/admin/service-issues", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    try { const d = jwt.verify(token, JWT_SECRET!) as any; if (!d.isAdmin) return res.status(403).json({ error: "Admin access required" }); } catch { return res.status(401).json({ error: "Invalid token" }); }

    const reports = await storage.getAllServiceIssueReports();
    res.json({ reports });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get service issues" });
  }
});

app.post("/api/admin/service-issues/:id/apply-credit", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET!) as any;
    if (!decoded.isAdmin) return res.status(403).json({ error: "Admin access required" });

    const reportId = parseInt(req.params.id);
    const { creditAmount, creditType, adminNotes } = req.body;

    const report = await storage.getServiceIssueReport(reportId);
    if (!report) return res.status(404).json({ error: "Report not found" });
    if (report.creditApplied) return res.status(400).json({ error: "Credit already applied" });

    const creditAmountCents = Math.round((creditAmount || 0) * 100);
    if (creditAmountCents <= 0) return res.status(400).json({ error: "Invalid credit amount" });

    let creditApplied = false;
    let chargebeeCreditId: string | null = null;

    if (report.chargebeeCustomerId) {
      const desc = `Admin Applied ${creditType || "downtime"} Credit - Service Issue #${reportId} - by ${decoded.email || "admin"}`;
      const creditResult = await addPromotionalCredit(report.chargebeeCustomerId, creditAmountCents, desc);
      if (creditResult.success) {
        creditApplied = true;
        chargebeeCreditId = creditResult.creditId || null;
      }
    }

    await storage.updateServiceIssueReport(reportId, {
      creditAmountApplied: creditAmountCents,
      creditType: creditType || "downtime",
      creditApplied,
      chargebeeCreditId,
      outcome: creditApplied ? "credit_applied" : "credit_failed",
      status: creditApplied ? "credit_applied" : "credit_failed",
      adminNotes: adminNotes || null,
      reviewedBy: decoded.email || "admin",
      reviewedAt: new Date(),
    });

    res.json({ success: creditApplied, message: creditApplied ? "Credit applied successfully" : "Failed to apply credit" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to apply credit" });
  }
});

app.get("/api/admin/service-issues/export", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    try { const d = jwt.verify(token, JWT_SECRET!) as any; if (!d.isAdmin) return res.status(403).json({ error: "Admin access required" }); } catch { return res.status(401).json({ error: "Invalid token" }); }

    const reports = await storage.getAllServiceIssueReports();
    const csvHeader = "ID,Date,Email,Category,Outage Status,Duration (hrs),Invoice Total,Recommended Credit,Credit Applied,Credit Amount,Credit Type,Outcome,Zendesk Ticket\n";
    const csvRows = reports.map(r =>
      `${r.id},${r.createdAt?.toISOString()?.split("T")[0] || ""},${r.customerEmail},${r.issueCategory},${r.outageStatus || ""},${r.outageDurationHours || ""},${r.invoiceTotal ? (r.invoiceTotal / 100).toFixed(2) : ""},${r.recommendedCredit ? (r.recommendedCredit / 100).toFixed(2) : ""},${r.creditApplied},${r.creditAmountApplied ? (r.creditAmountApplied / 100).toFixed(2) : ""},${r.creditType || ""},${r.outcome},${r.zendeskTicketId || ""}`
    ).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=service_issues_${new Date().toISOString().split("T")[0]}.csv`);
    res.send(csvHeader + csvRows);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to export" });
  }
});

// Admin billing resolution endpoints
app.get("/api/admin/billing-resolutions", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    try { jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: "Invalid token" }); }

    const resolutions = await storage.getAllBillingResolutions();
    res.json({ resolutions });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get resolutions" });
  }
});

app.get("/api/admin/billing-credit-config", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    try { jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: "Invalid token" }); }

    const configs = await storage.getAllBillingCreditConfigs();
    res.json({ configs });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get credit configs" });
  }
});

app.post("/api/admin/billing-credit-config", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const { issueType, label, creditType, creditAmountCents, creditPercentage, maxCreditCents, enabled, description } = req.body;
    if (!issueType || !label) return res.status(400).json({ error: "Issue type and label required" });

    const config = await storage.upsertBillingCreditConfig({
      issueType,
      label,
      creditType: creditType || "fixed",
      creditAmountCents: creditAmountCents || 0,
      creditPercentage: creditPercentage || 0,
      maxCreditCents: maxCreditCents || null,
      enabled: enabled !== false,
      description: description || null,
      updatedBy: decoded.email || "admin",
    });

    res.json({ config });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update credit config" });
  }
});

app.get("/api/admin/billing-resolutions/export", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    try { jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: "Invalid token" }); }

    const resolutions = await storage.getAllBillingResolutions();
    const csvHeader = "ID,Date,Email,Issue Type,Subscription Status,Credit Offered,Outcome,Zendesk Ticket,Contact Method\n";
    const csvRows = resolutions.map(r =>
      `${r.id},${r.createdAt?.toISOString()?.split("T")[0] || ""},${r.customerEmail},${r.issueType},${r.subscriptionStatus || ""},${r.creditOffered ? (r.creditOffered / 100).toFixed(2) : ""},${r.outcome},${r.zendeskTicketId || ""},${r.contactMethod || ""}`
    ).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=billing_resolutions.csv");
    res.send(csvHeader + csvRows);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to export" });
  }
});

app.get("/api/subscription/addons/available", customerApiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { customerId: number; email?: string };
    if (!decoded.email) return res.status(401).json({ error: "Unauthorized" });

    const { subscriptionId } = req.query;
    if (!subscriptionId || typeof subscriptionId !== 'string') {
      return res.status(400).json({ error: "subscriptionId is required" });
    }

    const ownership = await verifySubscriptionOwnership(subscriptionId, decoded.email);
    if (!ownership.owned) {
      return res.status(403).json({ error: ownership.error || "Access denied" });
    }

    const itemsResult = await getSubscriptionCurrentItems(subscriptionId);
    if (!itemsResult.success || !itemsResult.items) {
      return res.status(400).json({ error: itemsResult.error || "Failed to get subscription items" });
    }

    const { getAvailableAddonsForSubscription } = await import("../shared/addonConfig");
    const { available, alreadyActive } = getAvailableAddonsForSubscription(itemsResult.items);

    const currentAddons = itemsResult.items
      .filter(item => item.itemType === 'addon')
      .map(item => ({
        itemPriceId: item.itemPriceId,
        amount: item.amount,
        quantity: item.quantity,
      }));

    res.json({ available, alreadyActive, currentAddons });
  } catch (error: any) {
    console.error("Get available addons error:", error);
    res.status(500).json({ error: error.message || "Failed to get available add-ons" });
  }
});

app.post("/api/subscription/addons/add", heavyApiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { customerId: number; email?: string };
    if (!decoded.email) return res.status(401).json({ error: "Unauthorized" });

    const { subscriptionId, addonFamily } = req.body;
    if (!subscriptionId || !addonFamily) {
      return res.status(400).json({ error: "subscriptionId and addonFamily are required" });
    }

    const ownership = await verifySubscriptionOwnership(subscriptionId, decoded.email);
    if (!ownership.owned) {
      return res.status(403).json({ error: ownership.error || "Access denied" });
    }

    const { getAddonByFamily } = await import("../shared/addonConfig");
    const addonDef = getAddonByFamily(addonFamily);
    if (!addonDef) {
      return res.status(400).json({ error: "Invalid add-on" });
    }

    const itemsResult = await getSubscriptionCurrentItems(subscriptionId);
    if (!itemsResult.success || !itemsResult.items) {
      return res.status(400).json({ error: "Failed to verify subscription" });
    }

    const { getAvailableAddonsForSubscription } = await import("../shared/addonConfig");
    const { available } = getAvailableAddonsForSubscription(itemsResult.items);
    const isAvailable = available.some(a => a.family === addonFamily);
    if (!isAvailable) {
      return res.status(400).json({ error: "This add-on is already active on your subscription" });
    }

    let result: any = null;
    if (addonFamily === 'travel') {
      result = await addTravelAddonToSubscription(subscriptionId);
    } else if (addonFamily === 'prime') {
      result = await addPrimeAddonToSubscription(subscriptionId);
    } else {
      return res.status(400).json({ error: "Unknown add-on family" });
    }

    try {
      await storage.createAddonLog({
        customerId: decoded.customerId,
        customerEmail: decoded.email,
        subscriptionId,
        chargebeeCustomerId: ownership.customerId || null,
        action: 'add',
        addonFamily,
        addonItemPriceId: addonDef.itemPriceId,
        addonName: addonDef.displayName,
        addonPrice: Math.round(addonDef.price * 100),
        invoiceId: result.invoiceId || null,
        status: result.success ? 'completed' : 'failed',
        errorMessage: result.success ? null : (result.error || null),
      });
    } catch (logErr) {
      console.error("Failed to log addon operation:", logErr);
    }

    if (result.success) {
      return res.json({ success: true, invoiceId: result.invoiceId, message: `${addonDef.displayName} added successfully` });
    } else {
      return res.status(400).json({ error: result.error || "Failed to add add-on" });
    }
  } catch (error: any) {
    console.error("Add addon error:", error);
    res.status(500).json({ error: error.message || "Failed to add add-on" });
  }
});

app.post("/api/subscription/addons/remove", heavyApiLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { customerId: number; email?: string };
    if (!decoded.email) return res.status(401).json({ error: "Unauthorized" });

    const { subscriptionId, addonFamily } = req.body;
    if (!subscriptionId || !addonFamily) {
      return res.status(400).json({ error: "subscriptionId and addonFamily are required" });
    }

    const ownership = await verifySubscriptionOwnership(subscriptionId, decoded.email);
    if (!ownership.owned) {
      return res.status(403).json({ error: ownership.error || "Access denied" });
    }

    const { getAddonByFamily } = await import("../shared/addonConfig");
    const addonDef = getAddonByFamily(addonFamily);
    if (!addonDef) {
      return res.status(400).json({ error: "Invalid add-on" });
    }

    const result = await removeAddonFromSubscription(subscriptionId, addonDef.itemPriceId);

    try {
      await storage.createAddonLog({
        customerId: decoded.customerId,
        customerEmail: decoded.email,
        subscriptionId,
        chargebeeCustomerId: ownership.customerId || null,
        action: 'remove',
        addonFamily,
        addonItemPriceId: addonDef.itemPriceId,
        addonName: addonDef.displayName,
        addonPrice: Math.round(addonDef.price * 100),
        invoiceId: null,
        status: result.success ? 'completed' : 'failed',
        errorMessage: result.success ? null : (result.error || null),
      });
    } catch (logErr) {
      console.error("Failed to log addon removal:", logErr);
    }

    if (result.success) {
      return res.json({ success: true, message: `${addonDef.displayName} removed successfully` });
    } else {
      return res.status(400).json({ error: result.error || "Failed to remove add-on" });
    }
  } catch (error: any) {
    console.error("Remove addon error:", error);
    res.status(500).json({ error: error.message || "Failed to remove add-on" });
  }
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server running on port ${PORT}`);
  await seedPortalSettings();
});
