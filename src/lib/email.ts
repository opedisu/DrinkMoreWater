/**
 * Magic-link delivery. Resend is used when configured; otherwise the link is
 * printed to the server log so local development needs no email account.
 */

const BRAND = "#0284c7";
const INK = "#0f172a";
const MUTED = "#64748b";

/**
 * Email is not the web. Webfonts are unreliable, SVG is stripped by Gmail,
 * and Outlook on Windows renders through Word, which ignores padding on
 * inline elements. So: a system font stack, a PNG mark, and a button built
 * as a single-cell table rather than a padded anchor.
 *
 * The layout also has to survive images being blocked, which is the default
 * in several clients, so nothing load-bearing lives in the image.
 */
function magicLinkHtml(url: string, origin: string): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Sign in to DrinkMoreWater</title>
<style>
  @media (prefers-color-scheme: dark) {
    .page { background: #03101c !important; }
    .card { background: #0a2036 !important; border-color: #1e3a52 !important; }
    .ink { color: #eef6fc !important; }
    .muted { color: #8fa9bd !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;">
  <!-- Inbox preview line. Hidden in the body, so it is not said twice. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Your sign-in link, good for 20 minutes.
  </div>

  <table class="page" role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table class="card" role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:460px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;
                      padding:32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
          <tr>
            <td style="padding-bottom:20px;">
              <img src="${origin}/icons/icon-192.png" width="44" height="44" alt="DrinkMoreWater"
                   style="display:block;border:0;border-radius:11px;">
            </td>
          </tr>
          <tr>
            <td class="ink" style="font-size:21px;font-weight:600;letter-spacing:-0.02em;color:${INK};padding-bottom:10px;">
              Sign in to DrinkMoreWater
            </td>
          </tr>
          <tr>
            <td class="muted" style="font-size:15px;line-height:1.55;color:${MUTED};padding-bottom:24px;">
              Tap the button below to sign in. It works once and expires in 20 minutes.
            </td>
          </tr>
          <tr>
            <td>
              <!-- A table, because Word drops padding on an inline anchor. -->
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${BRAND};border-radius:10px;">
                    <a href="${url}"
                       style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;
                              color:#ffffff;text-decoration:none;">Sign in</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="muted" style="font-size:12.5px;line-height:1.6;color:${MUTED};padding-top:24px;">
              If the button does not work, paste this into your browser:<br>
              <span style="word-break:break-all;color:${BRAND};">${url}</span>
            </td>
          </tr>
          <tr>
            <td class="muted" style="font-size:12.5px;line-height:1.6;color:${MUTED};padding-top:18px;">
              If you did not request this, you can ignore this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendMagicLink(email: string, url: string): Promise<{ delivered: boolean; devLink?: string }> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM ?? "DrinkMoreWater <onboarding@resend.dev>";

    if (!apiKey) {
        console.log(`[dev] magic link for ${email}: ${url}`);
        return { delivered: false, devLink: process.env.NODE_ENV === "production" ? undefined : url };
    }

    // The mark is served by the app itself, so it follows whichever host the
    // link was built for rather than being pinned to one domain.
    let origin: string;
    try {
        origin = new URL(url).origin;
    } catch {
        origin = "https://drinkmorewater.app";
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from,
            to: [email],
            subject: "Your DrinkMoreWater sign-in link",
            text: `Tap to sign in: ${url}\n\nThe link works once and expires in 20 minutes.`,
            html: magicLinkHtml(url, origin)
        })
    });

    if (!response.ok) {
        const body = await response.text();
        console.error(`Resend failed (${response.status}): ${body}`);
        return { delivered: false };
    }
    return { delivered: true };
}
