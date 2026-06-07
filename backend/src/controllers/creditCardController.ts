import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { query } from "../database/connection";

/**
 * GET /api/credit-cards
 * Lista todos os cartões de crédito do usuário
 */
export async function getCreditCards(req: Request, res: Response) {
  try {
    const firebaseUid = req.headers["x-user-id"] as string;

    if (!firebaseUid) {
      return res.status(401).json({ error: "User ID not provided" });
    }

    // Resolver firebase_uid → UUID interno
    const userResult = await query(
      `SELECT id FROM users WHERE firebase_uid = $1`,
      [firebaseUid],
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const userId = userResult.rows[0].id;

    const result = await query(
      `SELECT id, name, last_digits, limit_amount, used, due_date, color, created_at, updated_at
       FROM credit_cards WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );

    const cards = result.rows.map((card) => ({
      id: card.id,
      name: card.name,
      lastDigits: card.last_digits,
      limitAmount: parseFloat(card.limit_amount),
      used: parseFloat(card.used),
      dueDate: card.due_date,
      color: card.color,
      createdAt: card.created_at,
      updatedAt: card.updated_at,
    }));

    res.json({ cards });
  } catch (error) {
    console.error("Error fetching credit cards", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/credit-cards
 * Cria um novo cartão de crédito
 */
export async function createCreditCard(req: Request, res: Response) {
  try {
    const firebaseUid = req.headers["x-user-id"] as string;
    const { name, lastDigits, limitAmount, dueDate, color } = req.body;

    if (!firebaseUid) {
      return res.status(401).json({ error: "User ID not provided" });
    }

    if (!name || !lastDigits || !limitAmount) {
      return res.status(400).json({ error: "Name, last digits, and limit amount are required" });
    }

    if (isNaN(limitAmount) || limitAmount < 0) {
      return res.status(400).json({ error: "Invalid limit amount" });
    }

    if (lastDigits.length !== 4 || isNaN(parseInt(lastDigits))) {
      return res.status(400).json({ error: "Last digits must be 4 numbers" });
    }

    // Resolver firebase_uid → UUID interno
    const userResult = await query(
      `SELECT id FROM users WHERE firebase_uid = $1`,
      [firebaseUid],
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const userId = userResult.rows[0].id;

    const id = uuidv4();
    const result = await query(
      `INSERT INTO credit_cards (id, user_id, name, last_digits, limit_amount, used, due_date, color, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [
        id,
        userId,
        name,
        lastDigits,
        limitAmount,
        0,
        dueDate || null,
        color || "#1565C0",
      ],
    );

    const card = result.rows[0];
    res.json({
      success: true,
      card: {
        id: card.id,
        name: card.name,
        lastDigits: card.last_digits,
        limitAmount: parseFloat(card.limit_amount),
        used: parseFloat(card.used),
        dueDate: card.due_date,
        color: card.color,
        createdAt: card.created_at,
      },
    });
  } catch (error) {
    console.error("Error creating credit card", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PUT /api/credit-cards/:cardId
 * Atualiza um cartão de crédito
 */
export async function updateCreditCard(req: Request, res: Response) {
  try {
    const firebaseUid = req.headers["x-user-id"] as string;
    const { cardId } = req.params;
    const { name, limitAmount, used, dueDate, color } = req.body;

    if (!firebaseUid) {
      return res.status(401).json({ error: "User ID not provided" });
    }

    // Resolver firebase_uid → UUID interno
    const userResult = await query(`SELECT id FROM users WHERE firebase_uid = $1`, [firebaseUid]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const userId = userResult.rows[0].id;

    if (limitAmount !== undefined && (isNaN(limitAmount) || limitAmount < 0)) {
      return res.status(400).json({ error: "Invalid limit amount" });
    }

    if (used !== undefined && (isNaN(used) || used < 0)) {
      return res.status(400).json({ error: "Invalid used amount" });
    }

    const updateFields = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(name);
    }

    if (limitAmount !== undefined) {
      updateFields.push(`limit_amount = $${paramIndex++}`);
      updateValues.push(limitAmount);
    }

    if (used !== undefined) {
      updateFields.push(`used = $${paramIndex++}`);
      updateValues.push(used);
    }

    if (dueDate !== undefined) {
      updateFields.push(`due_date = $${paramIndex++}`);
      updateValues.push(dueDate);
    }

    if (color !== undefined) {
      updateFields.push(`color = $${paramIndex++}`);
      updateValues.push(color);
    }

    updateFields.push(`updated_at = NOW()`);

    const cardIdIndex = paramIndex;
    const userIdIndex = paramIndex + 1;
    updateValues.push(cardId, userId);

    if (updateFields.length === 1) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const updateQuery = `UPDATE credit_cards 
              SET ${updateFields.join(", ")} 
              WHERE id = $${cardIdIndex} AND user_id = $${userIdIndex}
              RETURNING *`;

    const result = await query(updateQuery, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Credit card not found" });
    }

    const card = result.rows[0];
    res.json({
      success: true,
      card: {
        id: card.id,
        name: card.name,
        lastDigits: card.last_digits,
        limitAmount: parseFloat(card.limit_amount),
        used: parseFloat(card.used),
        dueDate: card.due_date,
        color: card.color,
        updatedAt: card.updated_at,
      },
    });
  } catch (error) {
    console.error("Error updating credit card", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * DELETE /api/credit-cards/:cardId
 * Deleta um cartão de crédito
 */
export async function deleteCreditCard(req: Request, res: Response) {
  try {
    const firebaseUid = req.headers["x-user-id"] as string;
    const { cardId } = req.params;

    if (!firebaseUid) {
      return res.status(401).json({ error: "User ID not provided" });
    }

    // Resolver firebase_uid → UUID interno
    const userResult = await query(`SELECT id FROM users WHERE firebase_uid = $1`, [firebaseUid]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const userId = userResult.rows[0].id;

    await query(`DELETE FROM credit_cards WHERE id = $1 AND user_id = $2`, [
      cardId,
      userId,
    ]);

    res.json({ success: true, message: "Credit card deleted" });
  } catch (error) {
    console.error("Error deleting credit card", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
