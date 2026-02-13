function redirectToSignIn() {
  if (typeof window !== "undefined") {
    const callbackUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/signin?callbackUrl=${callbackUrl}`;
  }
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);

  if (response.status === 401) {
    redirectToSignIn();
    throw new Error("Unauthorized");
  }

  return response;
}

export async function apiFetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await apiFetch(input, init);

  if (!response.ok) {
    throw new Error("Failed to fetch");
  }

  return response.json() as Promise<T>;
}
