// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

const SECRET = new TextEncoder().encode("development-secret-key");

async function signTestToken(payload: object, expiresIn = "7d"): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(SECRET);
}

// Import after mocks are set up
const { createSession, getSession, deleteSession, verifySession } = await import("@/lib/auth");

describe("createSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets an auth-token cookie", async () => {
    await createSession("user-123", "test@example.com");
    expect(mockCookieStore.set).toHaveBeenCalledOnce();
    const [name] = mockCookieStore.set.mock.calls[0];
    expect(name).toBe("auth-token");
  });

  it("sets cookie with httpOnly and correct options", async () => {
    await createSession("user-123", "test@example.com");
    const [, , options] = mockCookieStore.set.mock.calls[0];
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("sets cookie with a valid JWT containing userId and email", async () => {
    await createSession("user-123", "test@example.com");
    const [, token] = mockCookieStore.set.mock.calls[0];
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, SECRET);
    expect(payload.userId).toBe("user-123");
    expect(payload.email).toBe("test@example.com");
  });
});

describe("getSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  it("returns the session payload for a valid token", async () => {
    const token = await signTestToken({ userId: "user-123", email: "test@example.com" });
    mockCookieStore.get.mockReturnValue({ value: token });
    const session = await getSession();
    expect(session?.userId).toBe("user-123");
    expect(session?.email).toBe("test@example.com");
  });

  it("returns null for an expired token", async () => {
    const token = await signTestToken({ userId: "user-123", email: "test@example.com" }, "-1s");
    mockCookieStore.get.mockReturnValue({ value: token });
    expect(await getSession()).toBeNull();
  });

  it("returns null for a tampered token", async () => {
    mockCookieStore.get.mockReturnValue({ value: "not.a.valid.jwt" });
    expect(await getSession()).toBeNull();
  });
});

describe("deleteSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the auth-token cookie", async () => {
    await deleteSession();
    expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
  });
});

describe("verifySession", () => {
  function makeRequest(token?: string): import("next/server").NextRequest {
    const url = "http://localhost/api/test";
    const headers = token ? { Cookie: `auth-token=${token}` } : {};
    return new (require("next/server").NextRequest)(url, { headers });
  }

  it("returns null when no cookie is present", async () => {
    expect(await verifySession(makeRequest())).toBeNull();
  });

  it("returns the session payload for a valid token", async () => {
    const token = await signTestToken({ userId: "user-abc", email: "user@example.com" });
    const session = await verifySession(makeRequest(token));
    expect(session?.userId).toBe("user-abc");
    expect(session?.email).toBe("user@example.com");
  });

  it("returns null for an expired token", async () => {
    const token = await signTestToken({ userId: "user-abc", email: "user@example.com" }, "-1s");
    expect(await verifySession(makeRequest(token))).toBeNull();
  });

  it("returns null for a tampered token", async () => {
    expect(await verifySession(makeRequest("bad.token.value"))).toBeNull();
  });
});
