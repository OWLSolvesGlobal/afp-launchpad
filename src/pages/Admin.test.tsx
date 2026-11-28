import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Admin from "@/pages/Admin";
import { ago, whatsappLink } from "@/admin/api";

const REF = "AFP-20261128-123";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const detail = (overrides: Record<string, unknown> = {}) => ({
  ref: REF,
  status: "proof_uploaded",
  customerName: "Test <b>Customer</b>",
  totalCents: 14500,
  fulfillment: "delivery",
  pickupLocation: "",
  paymentMethod: "cibc_qr",
  createdAt: "2026-11-28T15:00:00.000Z",
  expiresAt: "2026-11-28T16:00:00.000Z",
  proofUploadedAt: "2026-11-28T15:10:00.000Z",
  paidAt: null,
  deliveredAt: null,
  closedAt: null,
  hasProof: true,
  needsLoyverse: false,
  itemCount: 1,
  customerPhone: "246 555 0100",
  customerEmail: "customer@example.com",
  deliveryAddress: "12 Test Road <script>alert(1)</script>",
  subtotalCents: 13000,
  shippingCents: 1500,
  closedReason: "",
  marketingOptIn: false,
  items: [{ sku: "LV-romper", name: "Babydoll Romper BLACK", size: "S", quantity: 1, priceCents: 13000 }],
  history: [{ at: "2026-11-28T15:00:00.000Z", actor: "customer", action: "order_reserved", detail: null }],
  ...overrides,
});

let calls: { url: string; init?: RequestInit }[] = [];
function mock(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      return handler(url, init);
    }),
  );
}
const signedIn = (rest: (url: string, init?: RequestInit) => Response) => (url: string, init?: RequestInit) =>
  url === "/api/admin/me" ? json({ email: "alofitnesspro@outlook.com" }) : rest(url, init);

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/*" element={<Admin />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the portal page", () => {
  it("shows only a sign-in screen when the API refuses, and asks for no data", async () => {
    mock(() => json({ error: "Please sign in to the AFP portal." }, 403));
    renderAt("/admin/orders");
    expect(await screen.findByText("Please sign in.")).toBeInTheDocument();
    expect(screen.queryByText("Orders.")).toBeNull();
    expect(calls.map((c) => c.url)).toEqual(["/api/admin/me"]);
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  });

  it("treats a redirect to the sign-in page as signed out", async () => {
    mock(() => Object.defineProperty(new Response(null, { status: 200 }), "type", { value: "opaqueredirect" }));
    renderAt("/admin");
    expect(await screen.findByText("Please sign in.")).toBeInTheDocument();
  });

  it("says so warmly when nothing needs the owner", async () => {
    mock(
      signedIn((url) =>
        url.startsWith("/api/admin/summary")
          ? json({ proofsWaiting: 0, toDeliver: 0, heldUnpaid: 0, needsLoyverse: 0, paidTodayCount: 2, paidTodayCents: 29000 })
          : json({ orders: [] }),
      ),
    );
    renderAt("/admin");
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument();
    expect(screen.getByText("BDS $290.00")).toBeInTheDocument();
  });
});

describe("checking a payment", () => {
  it("keeps Mark paid disabled until the bank check is ticked, then sends the confirmation", async () => {
    mock(
      signedIn((url, init) => {
        if (url === `/api/admin/orders/${REF}/paid`) return json({ order: detail({ status: "paid", paidAt: "2026-11-28T15:20:00.000Z", needsLoyverse: true }) });
        if (url === `/api/admin/orders/${REF}` && !init?.method) return json({ order: detail() });
        return json({ orders: [] });
      }),
    );
    renderAt(`/admin/orders/${REF}`);
    const button = await screen.findByRole("button", { name: "Mark paid" });
    expect(button).toBeDisabled();
    expect(screen.getByText("Amount to find").nextSibling).toHaveTextContent("BDS $145.00");
    expect(screen.getByText("Reference to find").nextSibling).toHaveTextContent(REF);

    fireEvent.click(screen.getByLabelText(/I have checked the bank account and can see BDS \$145.00 with reference AFP-20261128-123/));
    expect(button).toBeEnabled();
    fireEvent.click(button);

    expect(await screen.findByText("Ring this sale up in Loyverse")).toBeInTheDocument();
    const post = calls.find((c) => c.url.endsWith("/paid"))!;
    expect(post.init?.method).toBe("POST");
    expect(JSON.parse(String(post.init?.body))).toEqual({ confirmed: true });
    expect((post.init?.headers as Record<string, string>)["x-afp-admin"]).toBe("1");
  });

  it("will not reject without a reason", async () => {
    mock(signedIn((url, init) => (url === `/api/admin/orders/${REF}` && !init?.method ? json({ order: detail() }) : json({ orders: [] }))));
    renderAt(`/admin/orders/${REF}`);
    fireEvent.click(await screen.findByRole("button", { name: /The money isn't there: reject/ }));
    const reject = screen.getByRole("button", { name: "Reject and release the items" });
    expect(reject).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason the customer will see"), { target: { value: "No payment found." } });
    expect(reject).toBeEnabled();
  });

  it("shows what a customer typed as text, never as markup", async () => {
    mock(signedIn((url, init) => (url === `/api/admin/orders/${REF}` && !init?.method ? json({ order: detail() }) : json({ orders: [] }))));
    renderAt(`/admin/orders/${REF}`);
    expect(await screen.findByRole("heading", { name: "Test <b>Customer</b>" })).toBeInTheDocument();
    expect(screen.getByText("12 Test Road <script>alert(1)</script>")).toBeInTheDocument();
    expect(document.querySelector("main script")).toBeNull();
    expect(document.querySelector("main b")).toBeNull();
  });

  it("tells the owner when the order has already moved on", async () => {
    mock(
      signedIn((url, init) => {
        if (url.endsWith("/paid")) return json({ error: "This order has already moved on. The screen has been refreshed." }, 409);
        if (url === `/api/admin/orders/${REF}` && !init?.method) return json({ order: detail() });
        return json({ orders: [] });
      }),
    );
    renderAt(`/admin/orders/${REF}`);
    fireEvent.click(await screen.findByLabelText(/I have checked the bank account/));
    fireEvent.click(screen.getByRole("button", { name: "Mark paid" }));
    expect(await screen.findByText(/already moved on/)).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => c.url === `/api/admin/orders/${REF}`).length).toBeGreaterThan(1));
  });
});

describe("portal helpers", () => {
  it("turn local phone numbers into WhatsApp links", () => {
    expect(whatsappLink("246 555 0100", "Hi")).toBe("https://wa.me/12465550100?text=Hi");
    expect(whatsappLink("555 0100", "Hi")).toBe("https://wa.me/12465550100?text=Hi");
    expect(whatsappLink("+1 (246) 555-0100", "Hi")).toBe("https://wa.me/12465550100?text=Hi");
    expect(whatsappLink("+44 7700 900123", "Hi")).toBe("https://wa.me/447700900123?text=Hi");
  });
  it("describe waiting time in plain words", () => {
    const now = Date.parse("2026-11-28T15:00:00.000Z");
    expect(ago("2026-11-28T14:48:00.000Z", now)).toBe("12 min ago");
    expect(ago("2026-11-28T12:00:00.000Z", now)).toBe("3 hr ago");
    expect(ago("2026-11-26T15:00:00.000Z", now)).toBe("2 days ago");
  });
});
