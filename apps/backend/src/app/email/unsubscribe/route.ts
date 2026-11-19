import { t } from "../../../../../../packages/config/src/copy";
import { agentConfig } from "../../../../../../packages/config/src/public";
import { html, layout, validToken } from "@/lib/email/content";
import { unsubscribe } from "@/lib/email/service";
function input(request: Request) {
  const url = new URL(request.url);
  const user = url.searchParams.get("user") || "",
    token = url.searchParams.get("token") || "";
  return { user, token, valid: validToken("unsubscribe", user, token) };
}
function page(content: string, status = 200) {
  return new Response(
    layout(t("backend.fdec9c7793"), content, agentConfig.brand.name),
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
      },
    },
  );
}
export async function GET(request: Request) {
  try {
    const p = input(request);
    if (!p.valid) return page(t("backend.e0ed85949f"), 400);
    return page(
      `<p>Stop welcome and weekly personal-edit emails? Sign-in codes and edits you explicitly request will remain available.</p><form method="post" action="?user=${html(p.user)}&amp;token=${html(p.token)}"><button style="padding:14px 24px;border:0;border-radius:28px;background:#193e3a;color:white">Unsubscribe</button></form>`,
    );
  } catch {
    return page(t("backend.152475766c"), 503);
  }
}
export async function POST(request: Request) {
  try {
    const p = input(request);
    if (!p.valid) return page(t("backend.555a803170"), 400);
    await unsubscribe(p.user);
    return page(t("backend.15e01b2f4f"));
  } catch {
    return page(t("backend.dedf2c3f45"), 503);
  }
}
