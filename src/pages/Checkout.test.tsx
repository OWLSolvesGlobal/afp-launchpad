import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CartProvider } from "@/context/CartContext";
import Checkout from "@/pages/Checkout";
import OrderStatus from "@/pages/OrderStatus";
import {
  loadActiveOrder,
  rememberToken,
  saveActiveOrder,
  statusPath,
  tokenFor,
} from "@/lib/order-client";
import { validateDetails } from "@/lib/checkout-details";
import type { PublicOrder } from "@/lib/orders-core";

const TOKEN = "a".repeat(64);
const REF = "AFP-20261128-123";
const NOW = Date.parse("2026-11-28T15:00:00.000Z");

const BAG = [
  {
    id: "LV-romper::S::",
    sku: "LV-romper",
    slug: "babydoll-romper-black",
    name: "Babydoll Romper BLACK",
    priceCents: 13000,
    image: "",
    size: "S",
    color: "",
    quantity: 1,
  },
];

const CATALOG = {
  generatedAt: "2026-11-28T00:00:00.000Z",
  categories: ["Rompers"],
  config: {
    announcementBar: "",
    featuredSkus: [],
    heroOrder: [],
    paymentsCardEnabled: false,
    paymentsTransferEnabled: true,
    transferInstructions: "",
  },
  products: [
    {
      sku: "LV-romper",
      slug: "babydoll-romper-black",
      name: "Babydoll Romper BLACK",
      description: "",
      gender: "women",
      category: "Rompers",
      colors: [],
      priceCents: 13000,
      compareAtCents: null,
      sizes: ["S"],
      stock: { S: 2 },
      image: "",
      imageAlt: "",
      badge: null,
      active: true,
    },
  ],
};

const order = (overrides: Partial<PublicOrder> = {}): PublicOrder => ({
  ref: REF,
  status: "reserved",
  createdAt: new Date(NOW).toISOString(),
  expiresAt: new Date(NOW + 60 * 60_000).toISOString(),
  fulfillment: "pickup",
  pickupLocation: "AFP HQ — St Michael",
  items: [{ sku: "LV-romper", name: "Babydoll Romper BLACK", size: "S", quantity: 1, priceCents: 13000 }],
  // Deliberately not what the browser would calculate, to prove the page shows the server's figure.
  subtotalCents: 13000,
  shippingCents: 0,
  totalCents: 13900,
  paymentMethod: null,
  proofUploadedAt: null,
  proofUploadsLeft: 3,
  rejectedReason: null,
  ...overrides,
});

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let calls: { url: string; init?: RequestInit }[] = [];
function mockFetch(handler: Handler) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/catalog")) return json(CATALOG);
      calls.push({ url, init });
      return handler(url, init);
    }),
  );
}

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <CartProvider>
          <Routes>
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order/:ref" element={<OrderStatus />} />
            <Route path="*" element={<div>elsewhere</div>} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const fillDetails = () => {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Test Customer" } });
  fireEvent.change(screen.getByLabelText("Phone or WhatsApp number"), { target: { value: "246 555 0100" } });
  fireEvent.click(screen.getByRole("radio", { name: /Pickup/ }));
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("afp-cart-v2", JSON.stringify(BAG));
  window.scrollTo = vi.fn() as never;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("order links and tokens", () => {
  it("carry the token after the #, never in the query string", () => {
    const path = statusPath(REF, TOKEN);
    expect(path).toBe(`/order/${REF}#${TOKEN}`);
    expect(path).not.toContain("?");
  });

  it("read the token from the link, else from this device's memory", () => {
    expect(tokenFor(REF, `#${TOKEN}`)).toBe(TOKEN);
    expect(tokenFor(REF, "")).toBeNull();
    expect(tokenFor(REF, "#not-a-token")).toBeNull();
    rememberToken(REF, TOKEN);
    expect(tokenFor(REF, "")).toBe(TOKEN);
    expect(tokenFor("AFP-20261128-999", "")).toBeNull();
  });
});

describe("details validation matches the server's", () => {
  const ok = { name: "Test Customer", phone: "+1 246 555 0100", email: "", address: "12 Test Road, St Michael" };
  it("accepts good details and needs an address only for delivery", () => {
    expect(validateDetails(ok, "delivery")).toEqual({});
    expect(validateDetails({ ...ok, address: "" }, "pickup")).toEqual({});
    expect(validateDetails({ ...ok, address: "" }, "delivery").address).toBeTruthy();
  });
  it("flags each bad field", () => {
    expect(validateDetails({ ...ok, name: "A" }, "pickup").name).toBeTruthy();
    expect(validateDetails({ ...ok, phone: "call me" }, "pickup").phone).toBeTruthy();
    expect(validateDetails({ ...ok, email: "nope" }, "pickup").email).toBeTruthy();
  });
});

describe("checkout: details step", () => {
  it("shows field errors tied to their fields and sends nothing", async () => {
    mockFetch(() => json({}, 500));
    renderAt("/checkout");
    fireEvent.click(await screen.findByRole("button", { name: "Reserve my items and pay" }));
    const name = screen.getByLabelText("Full name");
    expect(name).toHaveAttribute("aria-invalid", "true");
    const describedBy = name.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy.split(" ").pop()!)).toHaveTextContent("Please enter your name.");
    expect(document.activeElement).toBe(name);
    expect(calls).toHaveLength(0);
  });

  it("sends item, size and quantity only, and one order on a double tap", async () => {
    let release: (r: Response) => void = () => {};
    mockFetch(() => new Promise<Response>((resolve) => (release = resolve)));
    renderAt("/checkout");
    await screen.findByLabelText("Full name");
    fillDetails();
    const button = screen.getByRole("button", { name: "Reserve my items and pay" });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.submit(button.closest("form")!);
    await waitFor(() => expect(calls).toHaveLength(1));

    const sent = JSON.parse(String(calls[0].init?.body));
    expect(sent.items).toEqual([{ sku: "LV-romper", size: "S", quantity: 1 }]);
    expect(JSON.stringify(sent)).not.toMatch(/price|total|cents/i);
    expect(sent.customer).toEqual({ name: "Test Customer", phone: "246 555 0100", email: "", address: "" });

    await act(async () => release(json({ order: order(), token: TOKEN, serverTime: new Date(NOW).toISOString(), payment: { bank: null } }, 201)));
    // Now on the Pay step, showing the server's total and reference.
    expect(await screen.findByText("02 — Pay")).toBeInTheDocument();
    expect(screen.getAllByText("BDS $139.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText(REF).length).toBeGreaterThan(0);
    expect(calls).toHaveLength(1);
    // The bag is emptied only after the order exists, and kept for a cancel.
    expect(JSON.parse(localStorage.getItem("afp-cart-v2")!)).toEqual([]);
    expect(loadActiveOrder()).toMatchObject({ ref: REF, token: TOKEN, bag: BAG });
  });

  it("says exactly which item is short and lets the customer fix the bag", async () => {
    localStorage.setItem("afp-cart-v2", JSON.stringify([{ ...BAG[0], quantity: 3 }]));
    mockFetch(() =>
      json(
        {
          error: "Some items just sold out or have fewer left than you asked for.",
          field: "items",
          unavailable: [{ sku: "LV-romper", name: "Babydoll Romper BLACK", size: "S", requested: 3, available: 2 }],
        },
        409,
      ),
    );
    renderAt("/checkout");
    await screen.findByLabelText("Full name");
    fillDetails();
    fireEvent.click(screen.getByRole("button", { name: "Reserve my items and pay" }));
    expect(await screen.findByText(/only 2 left/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change to 2" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("afp-cart-v2")!)[0].quantity).toBe(2));
    // The bag was kept: nothing was reserved.
    expect(loadActiveOrder()).toBeNull();
  });

  it("stays calm when ordering is unavailable or rate-limited", async () => {
    for (const [status, text] of [
      [503, /Ordering isn't available right now. Your bag is safe/],
      [429, /Too many orders in a short time/],
    ] as const) {
      mockFetch(() => json({ error: "Too many orders in a short time. Please wait a few minutes and try again." }, status));
      renderAt("/checkout");
      await screen.findByLabelText("Full name");
      fillDetails();
      fireEvent.click(screen.getByRole("button", { name: "Reserve my items and pay" }));
      expect(await screen.findByText(text)).toBeInTheDocument();
      expect(screen.getAllByRole("link", { name: /Need help\? WhatsApp us/ }).length).toBeGreaterThan(0);
      expect(JSON.parse(localStorage.getItem("afp-cart-v2")!)).toHaveLength(1);
      cleanup();
    }
  });

  it("shows a changed price before the customer continues", async () => {
    localStorage.setItem("afp-cart-v2", JSON.stringify([{ ...BAG[0], priceCents: 12000 }]));
    mockFetch(() => json({}, 500));
    renderAt("/checkout");
    expect(await screen.findByText(/Babydoll Romper BLACK is now BDS \$130.00 \(was BDS \$120.00\)/)).toBeInTheDocument();
    await waitFor(() => expect(JSON.parse(localStorage.getItem("afp-cart-v2")!)[0].priceCents).toBe(13000));
  });

  it("has no order-on-WhatsApp path, only the help link and the overseas note", async () => {
    mockFetch(() => json({}, 500));
    renderAt("/checkout");
    await screen.findByLabelText("Full name");
    expect(screen.queryByText(/Send Order on WhatsApp/i)).toBeNull();
    expect(screen.queryByText(/order on WhatsApp/i)).toBeNull();
    expect(screen.getByText(/Ordering from overseas\?/)).toBeInTheDocument();
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  });
});

describe("checkout: an order in progress", () => {
  const withOrder = (o: PublicOrder, extra: Handler = () => json({}, 500)) =>
    mockFetch((url, init) => {
      if (url === `/api/orders/${REF}` && !init?.method) {
        expect((init?.headers as Record<string, string>)["x-order-token"]).toBe(TOKEN);
        return json({ order: o, serverTime: new Date(NOW).toISOString(), payment: { bank: null } });
      }
      return extra(url, init);
    });

  it("resumes the same order after a refresh, at the step the customer was on", async () => {
    localStorage.setItem("afp-cart-v2", "[]");
    saveActiveOrder({ ref: REF, token: TOKEN, bag: BAG });
    sessionStorage.setItem(`afp-order-stage-${REF}`, "upload");
    withOrder(order());
    renderAt("/checkout");
    expect(await screen.findByText("03 — Upload proof of payment")).toBeInTheDocument();
    expect(screen.getByText("Upload proof").closest("li")).toHaveAttribute("aria-current", "step");
    expect(calls.every((c) => !c.init?.method)).toBe(true); // nothing new was created
  });

  it("hides bank transfer until bank details exist, and shows them when they do", async () => {
    saveActiveOrder({ ref: REF, token: TOKEN, bag: BAG });
    withOrder(order());
    renderAt("/checkout");
    expect(await screen.findByText("Pay with CIBC 1st Pay")).toBeInTheDocument();
    expect(screen.queryByText(/Bank transfer/i)).toBeNull();
    cleanup();

    mockFetch(() =>
      json({
        order: order(),
        serverTime: new Date(NOW).toISOString(),
        payment: { bank: { bank: "Test Bank", accountName: "AFP Test", accountNumber: "000111222", branch: "", swift: "TESTBB00" } },
      }),
    );
    renderAt("/checkout");
    fireEvent.click(await screen.findByRole("radio", { name: /Bank transfer/ }));
    expect(screen.getByText("000111222")).toBeInTheDocument();
    expect(screen.getByText("TESTBB00")).toBeInTheDocument();
  });

  it("cancelling releases the order and puts the bag back", async () => {
    localStorage.setItem("afp-cart-v2", "[]");
    saveActiveOrder({ ref: REF, token: TOKEN, bag: BAG });
    withOrder(order(), (url, init) => {
      expect(url).toBe(`/api/orders/${REF}/cancel`);
      expect(init?.method).toBe("POST");
      return json({ order: order({ status: "cancelled" }), serverTime: new Date(NOW).toISOString() });
    });
    renderAt("/checkout");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel this order" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel it" }));
    expect(await screen.findByText("Order cancelled.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to my bag" }));
    expect(await screen.findByLabelText("Full name")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("afp-cart-v2")!)).toEqual(BAG);
    expect(loadActiveOrder()).toBeNull();
  });

  it("after proof it says the payment is being checked, never that it is paid", async () => {
    saveActiveOrder({ ref: REF, token: TOKEN, bag: BAG });
    withOrder(order({ status: "proof_uploaded", paymentMethod: "cibc_qr", proofUploadsLeft: 2 }));
    renderAt("/checkout");
    expect(await screen.findByText("We're checking your payment.")).toBeInTheDocument();
    expect(screen.queryByText(/Payment confirmed/)).toBeNull();
    expect(screen.getByText("Done").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: /Replace your proof/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel this order" })).toBeNull();
    // Checkout has done its job: the next visit starts fresh.
    await waitFor(() => expect(loadActiveOrder()).toBeNull());
  });
});

describe("order status page", () => {
  const statusPage = (o: PublicOrder) => {
    mockFetch((url, init) => {
      const token = (init?.headers as Record<string, string> | undefined)?.["x-order-token"];
      if (url === `/api/orders/${REF}` && token === TOKEN) {
        return json({ order: o, serverTime: new Date(NOW).toISOString(), payment: { bank: null } });
      }
      return json({ error: "We couldn't find that order." }, 404);
    });
    renderAt(statusPath(REF, TOKEN));
  };

  it("describes every status in plain words with only the actions that fit", async () => {
    const cases: [PublicOrder["status"], string, { upload: boolean; cancel: boolean; replace: boolean }][] = [
      ["reserved", "Waiting for your payment.", { upload: true, cancel: true, replace: false }],
      ["proof_uploaded", "We're checking your payment.", { upload: false, cancel: false, replace: true }],
      ["paid", "Payment confirmed.", { upload: false, cancel: false, replace: false }],
      ["delivered", "Order complete.", { upload: false, cancel: false, replace: false }],
      ["expired", "This order ran out of time.", { upload: false, cancel: false, replace: false }],
      ["rejected", "We couldn't confirm your payment.", { upload: false, cancel: false, replace: false }],
      ["cancelled", "Order cancelled.", { upload: false, cancel: false, replace: false }],
    ];
    for (const [status, title, can] of cases) {
      statusPage(order({ status, rejectedReason: status === "rejected" ? "Amount did not match." : null }));
      expect(await screen.findByText(title)).toBeInTheDocument();
      expect(Boolean(screen.queryByRole("button", { name: "I've paid: upload my proof" }))).toBe(can.upload);
      expect(Boolean(screen.queryByRole("button", { name: "Cancel this order" }))).toBe(can.cancel);
      expect(Boolean(screen.queryByRole("button", { name: /Replace your proof/ }))).toBe(can.replace);
      if (status === "rejected") expect(screen.getByText("Amount did not match.")).toBeInTheDocument();
      if (status === "expired") expect(screen.getByText(/already paid, message us on WhatsApp/)).toBeInTheDocument();
      expect(screen.getAllByText("BDS $139.00").length).toBeGreaterThan(0);
      cleanup();
    }
  });

  it("shows one neutral page for a wrong token, a missing token and an unknown order", async () => {
    mockFetch(() => json({ error: "We couldn't find that order." }, 404));
    for (const path of [`/order/${REF}#${"b".repeat(64)}`, `/order/${REF}`, "/order/AFP-20261128-999#" + TOKEN, "/order/nonsense"]) {
      renderAt(path);
      expect(await screen.findByText("We couldn't find that order.")).toBeInTheDocument();
      cleanup();
    }
    // No token, or a malformed reference: nothing is even asked of the server.
    expect(calls.map((c) => c.url)).toEqual([`/api/orders/${REF}`, "/api/orders/AFP-20261128-999"]);
    expect(calls.every((c) => !c.url.includes("?"))).toBe(true);
  });

  it("remembers a working link so the same device can return without it", async () => {
    statusPage(order());
    await screen.findByText("Waiting for your payment.");
    await waitFor(() => expect(tokenFor(REF, "")).toBe(TOKEN));
  });
});
