import { HTTP_TIMEOUT_MS } from './const';

type FetchFn<TResponse> = (input: string, init?: Record<string, unknown>) => Promise<TResponse>;

export async function fetchWithTimeout<TResponse>(
    fetchFn: FetchFn<TResponse>,
    url: string,
    init: Record<string, unknown> = {},
    timeoutMs = HTTP_TIMEOUT_MS,
): Promise<TResponse> {
    try {
        return await fetchFn(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
        const name = (error as Error).name;
        if (name === 'AbortError' || name === 'TimeoutError') {
            throw new Error(`Request timed out after ${timeoutMs} ms`);
        }
        throw error;
    }
}
