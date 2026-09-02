import { STATUS_LABELS } from './const';

export interface OrderCheckpoint {
    status?: string;
    date?: string;
    label?: string;
}

export interface VehicleSpecification {
    model?: string;
    trimLevel?: string;
    exteriorColour?: string;
    interiorColour?: string;
    battery?: {
        capacityInKWh?: number;
    };
    maxPerformanceInKW?: number;
}

export interface OrderedVehicle {
    commissionId: string;
    name?: string;
    model?: string;
}

export interface OrderDetails {
    orderStatus?: string;
    commissionId?: string;
    name?: string;
    vehicleSpecification?: VehicleSpecification;
    checkPoints?: OrderCheckpoint[];
    dealer?: {
        servicePartnerId?: string;
    };
    activationState?: string;
}

export interface MappedCheckpoint {
    status: string | undefined;
    label: string | undefined;
    date: string | undefined;
}

export interface MappedOrder {
    deviceName: string;
    orderStatus: string | null;
    orderStatusLabel: string | null;
    commissionId: string | null;
    model: string | null;
    trimLevel: string | null;
    exteriorColour: string | null;
    interiorColour: string | null;
    batteryKwh: number | null;
    maxPerformanceKw: number | null;
    dealerId: string | null;
    activationState: string | null;
    orderConfirmedDate: string | null;
    inProductionDate: string | null;
    inDeliveryDate: string | null;
    toHandoverDate: string | null;
    checkpointsReached: MappedCheckpoint[];
    checkpointsPending: MappedCheckpoint[];
}

export function sanitizeId(id: string): string {
    const sanitized = id
        .replace(/[^A-Za-z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    return sanitized || 'order';
}

export function statusLabel(orderStatus: string | undefined | null): string | null {
    if (!orderStatus) {
        return null;
    }
    return STATUS_LABELS[orderStatus] ?? orderStatus;
}

export function checkpointDate(checkpoints: OrderCheckpoint[] | undefined, status: string): string | null {
    if (!checkpoints) {
        return null;
    }
    for (const item of checkpoints) {
        if (item.status === status && item.date) {
            return item.date;
        }
    }
    return null;
}

export function splitCheckpoints(checkpoints: OrderCheckpoint[] | undefined): {
    reached: MappedCheckpoint[];
    pending: MappedCheckpoint[];
} {
    const reached: MappedCheckpoint[] = [];
    const pending: MappedCheckpoint[] = [];

    for (const checkpoint of checkpoints || []) {
        const entry: MappedCheckpoint = {
            status: checkpoint.status,
            label: statusLabel(checkpoint.status) ?? checkpoint.status,
            date: checkpoint.date,
        };
        if (checkpoint.date) {
            reached.push(entry);
        } else {
            pending.push(entry);
        }
    }

    return { reached, pending };
}

export function mapOrder(data: OrderDetails): MappedOrder {
    const spec = data.vehicleSpecification || {};
    const checkpoints = data.checkPoints || [];
    const { reached, pending } = splitCheckpoints(checkpoints);
    const model = spec.model || data.name || null;

    return {
        deviceName: model || 'Skoda order',
        orderStatus: data.orderStatus ?? null,
        orderStatusLabel: statusLabel(data.orderStatus),
        commissionId: data.commissionId ?? null,
        model,
        trimLevel: spec.trimLevel ?? null,
        exteriorColour: spec.exteriorColour ?? null,
        interiorColour: spec.interiorColour ?? null,
        batteryKwh: spec.battery?.capacityInKWh ?? null,
        maxPerformanceKw: spec.maxPerformanceInKW ?? null,
        dealerId: data.dealer?.servicePartnerId ?? null,
        activationState: data.activationState ?? null,
        orderConfirmedDate: checkpointDate(checkpoints, 'ORDER_CONFIRMED'),
        inProductionDate: checkpointDate(checkpoints, 'IN_PRODUCTION'),
        inDeliveryDate: checkpointDate(checkpoints, 'IN_DELIVERY'),
        toHandoverDate: checkpointDate(checkpoints, 'TO_HANDOVER'),
        checkpointsReached: reached,
        checkpointsPending: pending,
    };
}
