import express from "express";
import cors from "cors";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import { storage } from "./storage";
import { fetchCustomerFullData } from "./services";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

app.post("/api/auth/send-phone-otp", async (req, res) => {
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

app.post("/api/auth/send-email-otp", async (req, res) => {
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

app.post("/api/auth/signin", async (req, res) => {
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

app.post("/api/auth/signin-otp", async (req, res) => {
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

app.post("/api/auth/forgot-password", async (req, res) => {
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

app.get("/api/customer/full-data", async (req, res) => {
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

    const fullData = await fetchCustomerFullData(email);
    res.json(fullData);
  } catch (error) {
    console.error("Fetch full data error:", error);
    res.status(500).json({ error: "Failed to fetch customer data" });
  }
});

app.post("/api/chat", async (req, res) => {
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

    const { handleChatMessage } = await import('./chat');
    const fullData = await fetchCustomerFullData(email);
    const result = await handleChatMessage(
      fullData,
      email,
      message,
      conversationHistory || []
    );

    res.json(result);
  } catch (error: any) {
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
    const session = await storage.getSessionByToken(token);
    if (!session) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const customer = await storage.getCustomer(session.customerId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
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
    const session = await storage.getSessionByToken(token);
    if (!session) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const customer = await storage.getCustomer(session.customerId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
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

app.post("/api/device/resume", async (req, res) => {
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

app.post("/api/device/status", async (req, res) => {
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

    const { getDeviceStatus } = await import('./services');
    const device = await getDeviceStatus(identifier, identifierType);

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json({ success: true, device });
  } catch (error: any) {
    console.error("Device status error:", error);
    res.status(500).json({ error: error.message || "Failed to get device status" });
  }
});

app.get("/api/device/plans", async (req, res) => {
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

app.post("/api/device/change-plan", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const session = await storage.getSessionByToken(token);
    let customerEmail: string | null = null;
    let isTest = false;
    
    if (!session) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded.isTest) {
          isTest = true;
          customerEmail = decoded.email;
        } else {
          return res.status(401).json({ error: "Invalid session" });
        }
      } catch {
        return res.status(401).json({ error: "Invalid session" });
      }
    } else {
      const customer = await storage.getCustomer(session.customerId);
      if (!customer) {
        return res.status(401).json({ error: "Customer not found" });
      }
      customerEmail = customer.email;
    }

    if (!customerEmail) {
      return res.status(401).json({ error: "Could not determine customer" });
    }

    const { identifier, identifierType = 'iccid', newPlan } = req.body;
    
    if (!identifier) {
      return res.status(400).json({ error: "Device identifier is required" });
    }
    if (!newPlan) {
      return res.status(400).json({ error: "New plan is required" });
    }

    // Verify device ownership by checking it belongs to customer's subscriptions
    const { fetchCustomerFullData, getDeviceStatus, changeDevicePlan } = await import('./services');
    const fullData = await fetchCustomerFullData(customerEmail);
    
    if (!fullData) {
      return res.status(400).json({ error: "Could not verify device ownership" });
    }

    // Check if identifier belongs to any of the customer's subscriptions
    const allSubscriptions = fullData.chargebee.customers.flatMap(c => c.subscriptions);
    const ownsDevice = allSubscriptions.some(sub => {
      if (identifierType === 'iccid' && sub.iccid === identifier) return true;
      if (identifierType === 'imei' && sub.imei === identifier) return true;
      if (identifierType === 'mdn' && sub.mdn === identifier) return true;
      return false;
    });

    if (!ownsDevice) {
      return res.status(403).json({ error: "You do not have permission to modify this device" });
    }

    // Get the actual current plan from ThingSpace (don't trust client)
    const deviceStatus = await getDeviceStatus(identifier, identifierType);
    if (!deviceStatus || !deviceStatus.carrier?.servicePlan) {
      return res.status(400).json({ error: "Could not determine current plan for this device" });
    }

    const currentPlan = deviceStatus.carrier.servicePlan;
    
    if (currentPlan === newPlan) {
      return res.status(400).json({ error: "New plan must be different from current plan" });
    }

    const result = await changeDevicePlan(identifier, identifierType, currentPlan, newPlan);

    if (!result.success) {
      return res.status(400).json({ error: result.error || "Failed to change plan" });
    }

    res.json({ success: true, requestId: result.requestId });
  } catch (error: any) {
    console.error("Change plan error:", error);
    res.status(500).json({ error: error.message || "Failed to change plan" });
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
