import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

type LoaderData = {
  hasKlaviyoPrivateKey: boolean;
  klaviyoKeyMasked: string | null;
};

type ActionData = {
  success: boolean;
  message: string;
  hasKlaviyoPrivateKey: boolean;
  klaviyoKeyMasked: string | null;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop =
    (await prisma.shop.findUnique({
      where: { shopDomain: session.shop },
    })) ||
    (await prisma.shop.create({
      data: {
        shopDomain: session.shop,
        accessToken: session.accessToken || "",
      },
    }));

  const key = shop.klaviyoPrivateKey || null;
  const masked =
    key && key.length > 8
      ? `${key.slice(0, 4)}${"*".repeat(Math.max(0, key.length - 8))}${key.slice(-4)}`
      : key
        ? `${key.slice(0, 2)}****`
        : null;

  return {
    hasKlaviyoPrivateKey: !!key,
    klaviyoKeyMasked: masked,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "save");
  const rawKey = String(formData.get("klaviyoPrivateKey") || "").trim();
  const key = intent === "delete" ? null : rawKey.length ? rawKey : null;

  if (intent === "save" && !key) {
    return {
      success: false,
      message: "Please enter a valid Klaviyo Private API key.",
      hasKlaviyoPrivateKey: false,
      klaviyoKeyMasked: null,
    } satisfies ActionData;
  }

  await prisma.shop.upsert({
    where: { shopDomain: session.shop },
    create: {
      shopDomain: session.shop,
      accessToken: session.accessToken || "",
      klaviyoPrivateKey: key,
    },
    update: {
      klaviyoPrivateKey: key,
      accessToken: session.accessToken || undefined,
    },
  });

  const masked =
    key && key.length > 8
      ? `${key.slice(0, 4)}${"*".repeat(Math.max(0, key.length - 8))}${key.slice(-4)}`
      : key
        ? `${key.slice(0, 2)}****`
        : null;

  return {
    success: true,
    message:
      intent === "delete"
        ? "Klaviyo key deleted successfully."
        : "Klaviyo key saved successfully.",
    hasKlaviyoPrivateKey: !!key,
    klaviyoKeyMasked: masked,
  } satisfies ActionData;
};

export default function Settings() {
  const loaderData = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();

  const hasSavedKey =
    actionData?.hasKlaviyoPrivateKey ?? loaderData.hasKlaviyoPrivateKey;
  const maskedKey = actionData?.klaviyoKeyMasked ?? loaderData.klaviyoKeyMasked;

  return (
    <s-page heading="Settings">
      <s-section heading="Klaviyo Integration">
        <s-paragraph>
          Add your Klaviyo Private API Key so the Marketing button can trigger
          your Klaviyo flow.
        </s-paragraph>
        {actionData?.message && (
          <s-banner tone={actionData.success ? "success" : "critical"}>
            {actionData.message}
          </s-banner>
        )}
        <Form method="post">
          <div style={{ maxWidth: 480 }}>
            <label htmlFor="klaviyoPrivateKey">Private API Key</label>
            <input
              id="klaviyoPrivateKey"
              name="klaviyoPrivateKey"
              type="password"
              defaultValue=""
              placeholder="pk_live_..."
              style={{
                width: "100%",
                marginTop: 6,
                padding: "8px 10px",
                border: "1px solid #d6d6d6",
                borderRadius: 8,
              }}
            />
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <s-button type="submit" name="intent" value="save">Save</s-button>
            {hasSavedKey && (
              <s-button type="submit" name="intent" value="delete" variant="secondary">
                Delete saved key
              </s-button>
            )}
          </div>
        </Form>

        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-paragraph>
            Saved key status: <strong>{hasSavedKey ? "Saved" : "Not saved"}</strong>
          </s-paragraph>
          {maskedKey && (
            <s-paragraph>
              Current saved key: <code>{maskedKey}</code>
            </s-paragraph>
          )}
        </s-box>

        <s-paragraph>
          Tip: In Klaviyo, create a Flow triggered by the custom event
          <strong> Wishlist Marketing Email</strong>.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
