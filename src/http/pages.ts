function page(title: string, content: string): string {
  return `<!doctype html>
<html lang="pl">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — KudoWatch</title>
<style>
  body { font: 16px system-ui, sans-serif; max-width: 42rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.5; color: #202225; }
  h1 { font-size: 1.75rem; }
</style>
<main><h1>${title}</h1>${content}</main>
</html>`;
}

export function authorizationNoticePage(authorizationUrl: string): string {
  const safeUrl = authorizationUrl.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  return page(
    "Połącz konto Strava",
    `<p>Nowe aktywności dostępne dla KudoWatch, również oznaczone jako „Tylko Ty”, będą publikowane na wspólnym kanale Discorda.</p><p><a href="${safeUrl}">Rozumiem i przechodzę do Stravy</a></p>`,
  );
}

export function authorizationSuccessPage(): string {
  return page(
    "Konto zostało połączone",
    "<p>Możesz zamknąć tę kartę i wrócić do Discorda.</p>",
  );
}

export function authorizationErrorPage(message: string): string {
  return page("Nie udało się połączyć konta", `<p>${message}</p>`);
}

