/**
 * Magic-link delivery. Resend is used when configured; otherwise the link is
 * printed to the server log so local development needs no email account.
 */
export async function sendMagicLink(email: string, url: string): Promise<{ delivered: boolean; devLink?: string }> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM ?? "DrinkMoreWater <onboarding@resend.dev>";

    if (!apiKey) {
        console.log(`[dev] magic link for ${email}: ${url}`);
        return { delivered: false, devLink: process.env.NODE_ENV === "production" ? undefined : url };
    }

    const html = `
        <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
            <h1 style="font-size:20px;margin:0 0 12px">Sign in to DrinkMoreWater</h1>
            <p style="font-size:15px;line-height:1.5;margin:0 0 20px">Tap the button below to sign in. It works once and expires in 20 minutes.</p>
            <a href="${url}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">Sign in</a>
            <p style="font-size:12px;color:#64748b;margin:24px 0 0">If you did not request this, you can ignore this email.</p>
        </div>
    `.trim();

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
            html
        })
    });

    if (!response.ok) {
        const body = await response.text();
        console.error(`Resend failed (${response.status}): ${body}`);
        return { delivered: false };
    }
    return { delivered: true };
}
