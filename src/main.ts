/*
 * Created with @iobroker/create-adapter v3.1.5
 */

import * as utils from '@iobroker/adapter-core';
import { clampPollInterval } from './lib/const';
import { SkodaOrderAuthError } from './lib/errors';
import { MySkodaApi } from './lib/myskoda-api';
import { MySkodaAuth } from './lib/myskoda-auth';
import { mapOrder, sanitizeId, type MappedOrder } from './lib/order-mapper';

interface StateDef {
    id: string;
    name: string;
    type: ioBroker.CommonType;
    role: string;
    unit?: string;
    val: ioBroker.StateValue;
}

class SkodaOrderStatus extends utils.Adapter {
    private pollTimer: ioBroker.Interval | undefined;
    private auth: MySkodaAuth | undefined;
    private api: MySkodaApi | undefined;
    private polling = false;
    private unloaded = false;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'skoda-order-status',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private async onReady(): Promise<void> {
        const username = (this.config.username || '').trim();
        const password = this.config.password || '';
        const pollInterval = clampPollInterval(this.config.pollInterval);

        if (!username || !password) {
            this.log.error('MySkoda email and password must be configured');
            await this.setConnection(false);
            return;
        }

        this.auth = new MySkodaAuth();
        this.api = new MySkodaApi(this.auth);

        try {
            await this.login(username, password);
        } catch (error) {
            this.log.error(`Authentication failed: ${(error as Error).message}`);
            await this.setConnection(false);
            return;
        }

        await this.poll();
        this.pollTimer = this.setInterval(() => {
            void this.poll();
        }, pollInterval * 1000);
        this.log.info(`Polling order status every ${pollInterval} seconds`);
    }

    private onUnload(callback: () => void): void {
        this.unloaded = true;
        try {
            if (this.pollTimer) {
                this.clearInterval(this.pollTimer);
                this.pollTimer = undefined;
            }
        } catch (error) {
            this.log.error(`Error during unloading: ${(error as Error).message}`);
        }
        callback();
    }

    private async login(username: string, password: string): Promise<void> {
        if (!this.auth) {
            throw new SkodaOrderAuthError('Auth client not initialized');
        }

        const storedToken = await this.loadRefreshToken();
        if (storedToken) {
            try {
                await this.auth.authorizeRefreshToken(storedToken);
                this.log.info('Authenticated with stored refresh token');
                await this.persistRefreshToken();
                return;
            } catch (error) {
                this.log.warn(`Refresh token login failed, retrying with password: ${(error as Error).message}`);
            }
        }

        await this.auth.authorize(username, password);
        this.log.info('Authenticated with MySkoda username and password');
        await this.persistRefreshToken();
    }

    private async poll(): Promise<void> {
        if (this.unloaded || this.polling || !this.api || !this.auth) {
            return;
        }
        this.polling = true;
        try {
            const orders = await this.api.discoverOrders();
            await this.persistRefreshToken();
            await this.setConnection(true);

            if (orders.length === 0) {
                this.log.warn('No open Skoda order was found in the MySkoda account');
                return;
            }

            for (const order of orders) {
                if (this.unloaded) {
                    return;
                }
                try {
                    const details = await this.api.fetchOrder(order.commissionId);
                    await this.writeOrder(
                        mapOrder({ ...details, commissionId: details.commissionId || order.commissionId }),
                    );
                } catch (error) {
                    this.log.error(`Failed to fetch order ${order.commissionId}: ${(error as Error).message}`);
                }
            }

            await this.persistRefreshToken();
        } catch (error) {
            const message = (error as Error).message;
            if (error instanceof SkodaOrderAuthError) {
                this.log.error(`Authentication failed: ${message}`);
            } else {
                this.log.error(`Failed to poll order status: ${message}`);
            }
            await this.setConnection(false);
        } finally {
            this.polling = false;
        }
    }

    private async writeOrder(mapped: MappedOrder): Promise<void> {
        const commissionId = mapped.commissionId;
        if (!commissionId) {
            this.log.warn('Skipping order without commissionId');
            return;
        }

        const deviceId = sanitizeId(commissionId);
        await this.setObjectNotExistsAsync(deviceId, {
            type: 'device',
            common: {
                name: mapped.deviceName,
            },
            native: {
                commissionId,
            },
        });
        await this.extendObjectAsync(deviceId, {
            common: {
                name: mapped.deviceName,
            },
        });

        const states: StateDef[] = [
            { id: 'orderStatus', name: 'Order status', type: 'string', role: 'value', val: mapped.orderStatus },
            {
                id: 'orderStatusLabel',
                name: 'Order status label',
                type: 'string',
                role: 'text',
                val: mapped.orderStatusLabel,
            },
            { id: 'commissionId', name: 'Commission ID', type: 'string', role: 'text', val: mapped.commissionId },
            { id: 'model', name: 'Model', type: 'string', role: 'text', val: mapped.model },
            { id: 'trimLevel', name: 'Trim level', type: 'string', role: 'text', val: mapped.trimLevel },
            { id: 'exteriorColour', name: 'Exterior colour', type: 'string', role: 'text', val: mapped.exteriorColour },
            { id: 'interiorColour', name: 'Interior colour', type: 'string', role: 'text', val: mapped.interiorColour },
            {
                id: 'batteryKwh',
                name: 'Battery capacity',
                type: 'number',
                role: 'value',
                unit: 'kWh',
                val: mapped.batteryKwh,
            },
            {
                id: 'maxPerformanceKw',
                name: 'Max performance',
                type: 'number',
                role: 'value',
                unit: 'kW',
                val: mapped.maxPerformanceKw,
            },
            { id: 'dealerId', name: 'Dealer ID', type: 'string', role: 'text', val: mapped.dealerId },
            {
                id: 'activationState',
                name: 'Activation state',
                type: 'string',
                role: 'value',
                val: mapped.activationState,
            },
            {
                id: 'orderConfirmedDate',
                name: 'Order confirmed date',
                type: 'string',
                role: 'date',
                val: mapped.orderConfirmedDate,
            },
            {
                id: 'inProductionDate',
                name: 'In production date',
                type: 'string',
                role: 'date',
                val: mapped.inProductionDate,
            },
            {
                id: 'inDeliveryDate',
                name: 'In delivery date',
                type: 'string',
                role: 'date',
                val: mapped.inDeliveryDate,
            },
            {
                id: 'toHandoverDate',
                name: 'To handover date',
                type: 'string',
                role: 'date',
                val: mapped.toHandoverDate,
            },
            {
                id: 'checkpointsReached',
                name: 'Checkpoints reached',
                type: 'string',
                role: 'json',
                val: JSON.stringify(mapped.checkpointsReached),
            },
            {
                id: 'checkpointsPending',
                name: 'Checkpoints pending',
                type: 'string',
                role: 'json',
                val: JSON.stringify(mapped.checkpointsPending),
            },
            { id: 'lastPoll', name: 'Last poll', type: 'string', role: 'date', val: new Date().toISOString() },
        ];

        for (const state of states) {
            const id = `${deviceId}.${state.id}`;
            await this.setObjectNotExistsAsync(id, {
                type: 'state',
                common: {
                    name: state.name,
                    type: state.type,
                    role: state.role,
                    read: true,
                    write: false,
                    unit: state.unit,
                },
                native: {},
            });
            await this.setState(id, { val: state.val, ack: true });
        }
    }

    private async setConnection(connected: boolean): Promise<void> {
        await this.setState('info.connection', { val: connected, ack: true });
    }

    private async loadRefreshToken(): Promise<string | undefined> {
        await this.ensureRefreshTokenObject();
        const state = await this.getStateAsync('info.refreshToken');
        if (typeof state?.val === 'string' && state.val) {
            try {
                const decrypted = this.decrypt(state.val);
                if (decrypted) {
                    return decrypted;
                }
            } catch {
                return state.val;
            }
        }
        if (this.config.refreshToken) {
            return this.config.refreshToken;
        }
        return undefined;
    }

    private async persistRefreshToken(): Promise<void> {
        const token = this.auth?.getRefreshToken();
        if (!token) {
            return;
        }
        this.config.refreshToken = token;
        try {
            await this.ensureRefreshTokenObject();
            await this.setState('info.refreshToken', { val: this.encrypt(token), ack: true });
        } catch (error) {
            this.log.debug(`Could not persist refresh token: ${(error as Error).message}`);
        }
    }

    private async ensureRefreshTokenObject(): Promise<void> {
        await this.setObjectNotExistsAsync('info.refreshToken', {
            type: 'state',
            common: {
                name: 'Refresh token',
                type: 'string',
                role: 'text',
                read: true,
                write: false,
                expert: true,
            },
            native: {},
        });
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new SkodaOrderStatus(options);
} else {
    // otherwise start the instance directly
    (() => new SkodaOrderStatus())();
}
