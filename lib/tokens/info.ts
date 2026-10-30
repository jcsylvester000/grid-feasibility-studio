/** Token details for a page: the user's balance and a product's cost (null when the product is not charged). */
import { getBalance } from "@/lib/db/repos/tokens";
import type { Product } from "@/lib/db/schema";
import { productInfo } from "@/lib/options/products";
import { tokenCost, tokenCosts, tokensEnabled } from "./config";

export type TokenInfo = { cost: number; balance: number; productName: string };

export async function tokenInfoFor(userId: string, product: string): Promise<TokenInfo | null> {
  const cost = tokenCost(product);
  if (!cost) return null;
  return { cost, balance: await getBalance(userId), productName: productInfo(product as Product).name };
}

/** The smallest cost of any charged product (0 when tokens are off). */
export const minTokenCost = () => (tokensEnabled() ? Math.min(...Object.values(tokenCosts()).filter((c): c is number => !!c && c > 0), Infinity) : 0);
