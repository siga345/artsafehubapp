import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { ApiError, apiError, parseJsonBody, withApiHandler } from "./api";

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

describe("ApiError", () => {
  it("is an instance of Error", () => {
    const err = new ApiError(400, "Bad request");
    expect(err).toBeInstanceOf(Error);
  });

  it("exposes status and message", () => {
    const err = new ApiError(422, "Unprocessable", { field: "email" });
    expect(err.status).toBe(422);
    expect(err.message).toBe("Unprocessable");
    expect(err.details).toEqual({ field: "email" });
  });

  it("apiError() returns an ApiError instance", () => {
    expect(apiError(500, "oops")).toBeInstanceOf(ApiError);
  });
});

// ---------------------------------------------------------------------------
// withApiHandler
// ---------------------------------------------------------------------------

describe("withApiHandler", () => {
  it("returns the handler result when no error is thrown", async () => {
    const handler = withApiHandler(async () => new Response("ok", { status: 200 }));
    const response = await handler();
    expect(response.status).toBe(200);
  });

  it("maps ApiError to the correct HTTP status and JSON body", async () => {
    const handler = withApiHandler(async () => {
      throw new ApiError(403, "Forbidden", { reason: "no access" });
    });
    const response = await handler();
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
    expect(body.details).toEqual({ reason: "no access" });
  });

  it("maps Prisma P2025 to 404", async () => {
    const handler = withApiHandler(async () => {
      const err = Object.assign(new Error("not found"), { code: "P2025" });
      throw err;
    });
    const response = await handler();
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Resource not found");
  });

  it("maps Prisma P2002 to 409", async () => {
    const handler = withApiHandler(async () => {
      const err = Object.assign(new Error("unique constraint"), { code: "P2002" });
      throw err;
    });
    const response = await handler();
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("Conflict");
  });

  it("maps unknown errors to 500", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withApiHandler(async () => {
      throw new Error("something exploded");
    });
    const response = await handler();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
    consoleSpy.mockRestore();
  });

  it("forwards handler arguments correctly", async () => {
    const handler = withApiHandler(async (a: number, b: number) => {
      return new Response(String(a + b), { status: 200 });
    });
    const response = await handler(2, 3);
    expect(await response.text()).toBe("5");
  });
});

// ---------------------------------------------------------------------------
// parseJsonBody
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const testSchema = z.object({
  name: z.string(),
  age: z.number().int().positive(),
});

describe("parseJsonBody", () => {
  it("parses a valid body against the schema", async () => {
    const req = makeRequest({ name: "Ivan", age: 30 });
    const result = await parseJsonBody(req, testSchema);
    expect(result).toEqual({ name: "Ivan", age: 30 });
  });

  it("throws ApiError 400 when required fields are missing", async () => {
    const req = makeRequest({ name: "Ivan" }); // missing age
    await expect(parseJsonBody(req, testSchema)).rejects.toBeInstanceOf(ApiError);
    await expect(parseJsonBody(makeRequest({ name: "Ivan" }), testSchema)).rejects.toMatchObject({
      status: 400,
      message: "Invalid request body",
    });
  });

  it("throws ApiError 400 when types are wrong", async () => {
    const req = makeRequest({ name: 42, age: "not-a-number" });
    await expect(parseJsonBody(req, testSchema)).rejects.toMatchObject({ status: 400 });
  });

  it("throws when body is not valid JSON", async () => {
    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{",
    });
    await expect(parseJsonBody(req, testSchema)).rejects.toThrow();
  });

  it("strips extra fields (Zod strip mode default)", async () => {
    const req = makeRequest({ name: "Ivan", age: 25, extra: "ignore" });
    const result = await parseJsonBody(req, testSchema);
    expect(result).not.toHaveProperty("extra");
  });
});
