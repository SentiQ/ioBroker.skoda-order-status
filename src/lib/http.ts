import { HTTP_TIMEOUT_MS } from './const';

type FetchFn<TResponse> = (input: string, init?: Record<string, unknown>) => Promise<TResponse>;

export async function fetchWithTimeout<TResponse>(
    fetchFn: FetchFn<TResponse>,
    url: string,
    init: Record<string, unknown> = {},
    timeoutMs = HTTP_TIMEOUT_MS,
): Promise<TResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetchFn(url, { ...init, signal: controller.signal });
    } catch (error) {
        if ((error as Error).name === 'AbortError') {
            throw new Error(`Request timed out after ${timeoutMs} ms`);
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}
