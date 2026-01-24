import express from "express";
import cors from "cors";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { storage } from "./storage";

const app = express();
const PORT = 3001;
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

    const response = await fetch("https://app.lrlos.com/webhook/Chargebee/getcustomersusingemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, keyword: "signup" }),
    });

    const data = await response.json();
    const customerFound = Array.isArray(data) && data.length > 0;

    let customer = await storage.getCustomerByEmail(email);
    if (!customer) {
      customer = await storage.createCustomer({ 
        email,
        chargebeeCustomerId: customerFound && data[0]?.id ? data[0].id : null
      });
    }

    res.json({ 
      customerFound, 
      customerId: customer.id,
      chargebeeData: customerFound ? data[0] : null 
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
    const decoded = jwt.verify(token, JWT_SECRET) as { customerId: number };

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
