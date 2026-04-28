import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect, useSearchParams } from "react-router";

type WishlistRow = {
  id: string;
  productId: string;
  variantId?: string | null;
  addedAt?: string;
};

const FALLBACK_API_BASE_URL =
  "https://carrying-remained-clay-vegetable.trycloudflare.com";

const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    return window.PremierWishlistApiBaseUrl || FALLBACK_API_BASE_URL;
  }
  return FALLBACK_API_BASE_URL;
};

export default function WishlistPage() {
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get("customerId") || "";

  const [items, setItems] = useState<WishlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadWishlist = async () => {
      setLoading(true);
      setError(null);

      if (customerId) {
        try {
          const response = await fetch(
            `${getApiBaseUrl()}/api/wishlist?customerId=${encodeURIComponent(
              customerId,
            )}`,
          );
          const data = await response.json();
          if (!isCancelled) {
            setItems(data.wishlist || []);
          }
        } catch (err) {
          if (!isCancelled) {
            setError(err instanceof Error ? err.message : String(err));
          }
        } finally {
          if (!isCancelled) setLoading(false);
        }
        return;
      }

      if (!isCancelled) {
        setItems([]);
        setError("Please login first.");
        setLoading(false);
      }
    };

    loadWishlist();

    return () => {
      isCancelled = true;
    };
  }, [customerId]);

  const removeItem = async (item: WishlistRow) => {
    if (!item) return;

    if (!customerId) {
      setError("Please login first.");
      return;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/wishlist/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wishlistItemId: item.id }),
      });
      const result = await response.json();
      if (!result.success) {
        setError(result.error || "Failed to remove item");
        return;
      }
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <main style={{ padding: "32px 20px", maxWidth: "960px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "12px" }}>Your Wishlist</h1>
      {loading && <p>Loading wishlist...</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {!loading && !items.length && <p>Your wishlist is empty.</p>}

      {!loading && !!items.length && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((item) => (
            <li
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid #e5e5e5",
                borderRadius: "10px",
                padding: "12px 16px",
                marginBottom: "12px",
              }}
            >
              <div>
                <div>Product ID: {item.productId}</div>
                {item.variantId && <div>Variant ID: {item.variantId}</div>}
                {item.addedAt && <div>Added: {item.addedAt}</div>}
              </div>
              <button
                type="button"
                onClick={() => removeItem(item)}
                style={{
                  border: "1px solid #111",
                  padding: "8px 12px",
                  borderRadius: "999px",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export const loader = async (_args: LoaderFunctionArgs) => {
  return redirect("/pages/premier-wishlist");
};
