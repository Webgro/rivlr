import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";

if (!connectionString && process.env.NODE_ENV !== "production") {
  // Don't throw at import time so build works without env; queries will fail.
  console.warn("[rivlr] No DATABASE_URL/POSTGRES_URL set — DB calls will fail.");
}

// Single connection — postgres-js handles pooling. Set max=1 for serverless.
const client = postgres(connectionString, { max: 1, prepare: false });

export const db = drizzle(client, { schema });
export { schema };
export {
  TAG_COLOR_NAMES,
  type TagColor,
  type TrackedProduct,
  type Tag,
  type ProductGroup,
  type AlertLog,
  type LinkSuggestion,
} from "./schema";
