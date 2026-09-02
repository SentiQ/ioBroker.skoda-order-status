import { BASE_URL_SKODA, GARAGE_PATH, USER_AGENT } from './const';
import { SkodaOrderApiError } from './errors';
import type { MySkodaAuth } from './myskoda-auth';
import type { OrderDetails, OrderedVehicle } from './order-mapper';

/**
 * MySkoda REST client for ordered vehicles.
 */
export class MySkodaApi {
    public constructor(private readonly auth: MySkodaAuth) {}

    public async discoverOrders(): Promise<OrderedVehicle[]> {
        const garage = (await this.getJson(GARAGE_PATH)) as { orderedVehicles?: OrderedVehicle[] };
        return (garage.orderedVehicles || []).filter(vehicle => !!vehicle.commissionId);
    }

    public async fetchOrder(commissionId: string): Promise<OrderDetails> {
        return (await this.getJson(`/v2/garage/vehicles/ordered/${encodeURIComponent(commissionId)}`)) as OrderDetails;
    }

    private async getJson(path: string): Promise<unknown> {
        const token = await this.auth.getAccessToken();
        const response = await fetch(`${BASE_URL_SKODA}/api${path}`, {
            method: 'GET',
            headers: {
                authorization: `Bearer ${token}`,
                accept: 'application/json',
                'user-agent': USER_AGENT,
            },
        });
        const text = await response.text();
        if (!response.ok) {
            throw new SkodaOrderApiError(`Request to ${path} failed with status ${response.status}`);
        }
        try {
            return JSON.parse(text);
        } catch (error) {
            throw new SkodaOrderApiError(`Invalid JSON from ${path}: ${(error as Error).message}`);
        }
    }
}
