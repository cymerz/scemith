export async function readableFailure(failure: unknown): Promise<string> {
  if (failure instanceof Response) {
    let message: string | undefined;
    try {
      const body = await failure.text();
      if (body.trim()) {
        try {
          const data: unknown = JSON.parse(body);
          if (data && typeof data === "object" && "error" in data) {
            const error = data.error;
            if (typeof error === "string") message = error;
            else if (error && typeof error === "object" && "message" in error && typeof error.message === "string") message = error.message;
          }
        } catch {}
      }
    } catch {}

    if (message && /<\/?[a-z][^>]*>/i.test(message)) message = undefined;
    if (!message?.trim()) {
      message = failure.status === 429
        ? "Too many requests, please try again in a minute"
        : failure.status >= 500
          ? "The AI service is unavailable right now"
          : "Could not generate a schema. Please try again.";
    }
    const retryAfter = failure.headers.get("Retry-After");
    return retryAfter ? `${message} (Retry after: ${retryAfter})` : message;
  }

  return failure instanceof TypeError
    ? "Unable to reach the AI service. Check your connection and try again."
    : "Could not generate a schema. Please try again.";
}
