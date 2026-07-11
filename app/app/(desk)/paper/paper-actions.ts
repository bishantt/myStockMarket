"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { simulateFill, type Bucket, type TradeSide } from "@/lib/paper";
import { realizedPnl, type PaperTradeRow } from "@/lib/ledger";

/**
 * Paper-desk write actions (plan §7 P6 step 1 — the app writes user-state only, and paper trades are
 * the ONLY orders it ever places). A fill is simulated deterministically (lib/paper.simulateFill):
 * the reference open moved against the trader by half the bucket's at-open spread plus slippage. The
 * cost is always recorded. Input is validated at the boundary with zod; the login wall gates the desk.
 */

export type PaperResult = { ok: boolean; error?: string };

const openSchema = z.object({
  symbol: z.string().trim().min(1).max(8).transform((s) => s.toUpperCase()),
  side: z.enum(["buy", "sell"]),
  bucket: z.enum(["large-mid", "small"]),
  quantity: z.coerce.number().int().positive().max(1_000_000),
  referenceOpen: z.coerce.number().positive().max(1_000_000),
  // Optional: when this order follows a fired signal the user just viewed (drives cooling-off).
  signalViewedAt: z.string().datetime().optional().or(z.literal("").transform(() => undefined)),
});

/** Open a paper trade: simulate the fill from the reference open and record it. */
export async function openPaperTrade(_prev: PaperResult, formData: FormData): Promise<PaperResult> {
  const parsed = openSchema.safeParse({
    symbol: formData.get("symbol"),
    side: formData.get("side"),
    bucket: formData.get("bucket"),
    quantity: formData.get("quantity"),
    referenceOpen: formData.get("referenceOpen"),
    signalViewedAt: formData.get("signalViewedAt") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Check the order — symbol, quantity, and price are required." };

  const { symbol, side, bucket, quantity, referenceOpen, signalViewedAt } = parsed.data;
  const fill = simulateFill({ side: side as TradeSide, nextOpen: referenceOpen, bucket: bucket as Bucket });

  try {
    await db.paperTrade.create({
      data: {
        symbol,
        side,
        bucket,
        quantity,
        referenceOpen,
        fillPrice: fill.fillPrice,
        costBps: fill.costBps,
        signalViewedAt: signalViewedAt ? new Date(signalViewedAt) : null,
        status: "open",
      },
    });
    revalidatePath("/paper");
    return { ok: true };
  } catch (error) {
    console.error("openPaperTrade failed", error);
    return { ok: false, error: "Could not record the paper trade — please try again." };
  }
}

const closeSchema = z.object({
  tradeId: z.string().min(1),
  exitReferenceOpen: z.coerce.number().positive().max(1_000_000),
});

/** Close an open paper trade at the exit reference open, simulating the closing fill and P&L. */
export async function closePaperTrade(_prev: PaperResult, formData: FormData): Promise<PaperResult> {
  const parsed = closeSchema.safeParse({
    tradeId: formData.get("tradeId"),
    exitReferenceOpen: formData.get("exitReferenceOpen"),
  });
  if (!parsed.success) return { ok: false, error: "Enter a valid exit price to close the trade." };

  try {
    const trade = await db.paperTrade.findUnique({ where: { id: parsed.data.tradeId } });
    if (!trade) return { ok: false, error: "That trade no longer exists." };
    if (trade.status !== "open") return { ok: false, error: "That trade is already closed." };

    // Closing a long is a sell, closing a short is a buy — the exit pays the spread again.
    const exitSide: TradeSide = trade.side === "buy" ? "sell" : "buy";
    const exitFill = simulateFill({
      side: exitSide,
      nextOpen: parsed.data.exitReferenceOpen,
      bucket: trade.bucket as Bucket,
    });

    const closedShape: PaperTradeRow = {
      ...(trade as unknown as PaperTradeRow),
      status: "closed",
      exitFillPrice: exitFill.fillPrice,
    };
    const pnl = realizedPnl(closedShape);

    await db.paperTrade.update({
      where: { id: trade.id },
      data: {
        status: "closed",
        exitFillPrice: exitFill.fillPrice,
        closedAt: new Date(),
        realizedPnl: pnl,
      },
    });
    revalidatePath("/paper");
    return { ok: true };
  } catch (error) {
    console.error("closePaperTrade failed", error);
    return { ok: false, error: "Could not close the trade — please try again." };
  }
}
