import { NextResponse } from "next/server";
import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export function apiError(status: number, message: string, details?: unknown) {
  return new ApiError(status, message, details);
}

export async function parseJsonBody<TSchema extends z.ZodTypeAny>(request: Request, schema: TSchema): Promise<z.output<TSchema>> {
  const json = await request.json();
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    throw apiError(400, "Invalid request body", parsed.error.flatten());
  }

  return parsed.data;
}

export function withApiHandler<T extends any[], TResult>(handler: (...args: T) => Promise<TResult>) {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
      }

      const code =
        typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
          ? error.code
          : null;
      if (code === "P2025") {
        return NextResponse.json({ error: "Resource not found" }, { status: 404 });
      }
      if (code === "P2002") {
        return NextResponse.json({ error: "Conflict" }, { status: 409 });
      }

      console.error(error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
