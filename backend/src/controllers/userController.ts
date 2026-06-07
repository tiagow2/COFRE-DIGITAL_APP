import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { query } from "../database/connection";

/**
 * GET /api/user/profile
 * Pega perfil completo do usuário
 */
export async function getUserProfile(req: Request, res: Response) {
  try {
    const userId = req.headers["x-user-id"] as string;

    console.log("[GET /user/profile] Starting...");
    console.log("[GET /user/profile] User ID from header:", userId);

    if (!userId) {
      console.error("[GET /user/profile] ❌ User ID not provided");
      return res.status(401).json({ error: "User ID not provided" });
    }

    const result = await query(
      `SELECT id, email, firebase_uid, city, monthly_income, initial_balance, created_at, updated_at
       FROM users WHERE firebase_uid = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      console.error("[GET /user/profile] ❌ User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];
    console.log("[GET /user/profile] ✅ Found user:", user.id);

    res.json({
      id: user.id,
      email: user.email,
      city: user.city,
      monthlyIncome: parseFloat(user.monthly_income),
      initialBalance: parseFloat(user.initial_balance),
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  } catch (error: any) {
    console.error("[GET /user/profile] ❌ ERROR DETAILS:");
    console.error("Message:", error?.message);
    console.error("Code:", error?.code);
    console.error("Stack:", error?.stack);
    res.status(500).json({ 
      error: "Internal server error",
      details: error?.message || "Unknown error"
    });
  }
}

/**
 * PUT /api/user/profile
 * Atualiza perfil do usuário (renda, saldo inicial, cidade)
 */
export async function updateUserProfile(req: Request, res: Response) {
  try {
    const userId = req.headers["x-user-id"] as string;
    const { city, monthlyIncome, initialBalance } = req.body;

    console.log("[PUT /user/profile] Starting...");
    console.log("[PUT /user/profile] User ID from header:", userId);
    console.log(
      "[PUT /user/profile] Request body:",
      JSON.stringify(req.body, null, 2),
    );

    if (!userId) {
      console.error("[PUT /user/profile] ❌ User ID not provided in headers");
      return res.status(401).json({ error: "User ID not provided" });
    }

    // Validações básicas
    if (
      monthlyIncome !== undefined &&
      (isNaN(monthlyIncome) || monthlyIncome < 0)
    ) {
      console.error(
        "[PUT /user/profile] ❌ Invalid monthly income:",
        monthlyIncome,
      );
      return res.status(400).json({ error: "Invalid monthly income" });
    }

    if (
      initialBalance !== undefined &&
      (isNaN(initialBalance) || initialBalance < 0)
    ) {
      console.error(
        "[PUT /user/profile] ❌ Invalid initial balance:",
        initialBalance,
      );
      return res.status(400).json({ error: "Invalid initial balance" });
    }

    const updateFields = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (city !== undefined) {
      updateFields.push(`city = $${paramIndex++}`);
      updateValues.push(city);
      console.log("[PUT /user/profile] Adding city:", city);
    }

    if (monthlyIncome !== undefined) {
      updateFields.push(`monthly_income = $${paramIndex++}`);
      updateValues.push(monthlyIncome);
      console.log("[PUT /user/profile] Adding monthlyIncome:", monthlyIncome);
    }

    if (initialBalance !== undefined) {
      updateFields.push(`initial_balance = $${paramIndex++}`);
      updateValues.push(initialBalance);
      console.log("[PUT /user/profile] Adding initialBalance:", initialBalance);
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(userId);

    if (updateFields.length === 1) {
      console.error("[PUT /user/profile] ❌ No fields to update");
      return res.status(400).json({ error: "No fields to update" });
    }

    const updateQuery = `UPDATE users SET ${updateFields.join(", ")} WHERE firebase_uid = $${paramIndex} RETURNING *`;

    console.log("[PUT /user/profile] SQL Query:", updateQuery);
    console.log("[PUT /user/profile] Query values count:", updateValues.length);
    console.log("[PUT /user/profile] Query values:", JSON.stringify(updateValues, null, 2));
    console.log("[PUT /user/profile] paramIndex:", paramIndex);
    console.log("[PUT /user/profile] Executing query...");

    const result = await query(updateQuery, updateValues);

    console.log("[PUT /user/profile] Query executed successfully");
    console.log("[PUT /user/profile] Result rows count:", result.rows.length);

    if (result.rows.length === 0) {
      console.error("[PUT /user/profile] ❌ User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];
    console.log("[PUT /user/profile] ✅ Success! Updated user:", user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        city: user.city,
        monthlyIncome: parseFloat(user.monthly_income),
        initialBalance: parseFloat(user.initial_balance),
        updatedAt: user.updated_at,
      },
    });
  } catch (error: any) {
    console.error("[PUT /user/profile] ❌ ERROR DETAILS:");
    console.error("Message:", error?.message);
    console.error("Code:", error?.code);
    console.error("Stack:", error?.stack);
    console.error("Full error:", JSON.stringify(error, null, 2));
    
    res.status(500).json({ 
      error: "Internal server error",
      details: error?.message || "Unknown error",
      code: error?.code
    });
  }
}

/**
 * POST /api/user/create-profile
 * Cria perfil inicial do usuário (chamado na primeira vez)
 */
export async function createUserProfile(req: Request, res: Response) {
  try {
    const userId = req.headers["x-user-id"] as string;
    const { email, city, monthlyIncome, initialBalance } = req.body;

    console.log("[POST /user/create-profile] Starting...");
    console.log("[POST /user/create-profile] User ID from header:", userId);
    console.log(
      "[POST /user/create-profile] Request body:",
      JSON.stringify(req.body, null, 2),
    );

    if (!userId || !email) {
      console.error(
        "[POST /user/create-profile] ❌ User ID and/or email missing",
      );
      console.error(
        "[POST /user/create-profile] userId:",
        userId,
        "email:",
        email,
      );
      return res.status(400).json({ error: "User ID and email are required" });
    }

    // Validações
    if (
      monthlyIncome !== undefined &&
      (isNaN(monthlyIncome) || monthlyIncome < 0)
    ) {
      console.error(
        "[POST /user/create-profile] ❌ Invalid monthly income:",
        monthlyIncome,
      );
      return res.status(400).json({ error: "Invalid monthly income" });
    }

    if (
      initialBalance !== undefined &&
      (isNaN(initialBalance) || initialBalance < 0)
    ) {
      console.error(
        "[POST /user/create-profile] ❌ Invalid initial balance:",
        initialBalance,
      );
      return res.status(400).json({ error: "Invalid initial balance" });
    }

    const id = uuidv4();
    console.log("[POST /user/create-profile] Generated profile ID:", id);

    const result = await query(
      `INSERT INTO users (id, email, firebase_uid, city, monthly_income, initial_balance, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET city = $4, monthly_income = $5, initial_balance = $6, updated_at = NOW()
       RETURNING *`,
      [
        id,
        email,
        userId,
        city || null,
        monthlyIncome || 0,
        initialBalance || 0,
      ],
    );

    const user = result.rows[0];
    console.log(
      "[POST /user/create-profile] ✅ Profile created/updated:",
      user.id,
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        city: user.city,
        monthlyIncome: parseFloat(user.monthly_income),
        initialBalance: parseFloat(user.initial_balance),
        createdAt: user.created_at,
      },
    });
  } catch (error: any) {
    console.error("[POST /user/create-profile] ❌ ERROR DETAILS:");
    console.error("Message:", error?.message);
    console.error("Code:", error?.code);
    console.error("Stack:", error?.stack);
    console.error("Full error:", JSON.stringify(error, null, 2));
    res.status(500).json({ 
      error: "Internal server error",
      details: error?.message || "Unknown error",
      code: error?.code
    });
  }
}
