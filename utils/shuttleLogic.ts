import shuttleSchedule from '../assets/data/shuttleSchedule.json';
import type { Campus } from "../constants/buildings";

export interface ShuttleInfo {
    nextDeparture: string | null;
    nextThreeDepartures: string[];
    estimatedArrival: string | null;
    serviceUnavailable: boolean;
    message?: string;
}

export const calculateArrivalTime = (departureTime: string): string => {
    const [hours, minutes] = departureTime.split(':').map(Number);
    const arrivalDate = new Date();
    arrivalDate.setHours(hours, minutes + 30, 0, 0);

    const hh = arrivalDate.getHours().toString().padStart(2, '0');
    const mm = arrivalDate.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

export const getShuttleInfo = (campus: Campus, currentTime: Date): ShuttleInfo => {
    const dayOfWeek = currentTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Weekend check: 0 (Sunday), 6 (Saturday)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return {
            nextDeparture: null,
            nextThreeDepartures: [],
            estimatedArrival: null,
            serviceUnavailable: true,
            message: 'Service unavailable on weekends.',
        };
    }

    const isFriday = dayOfWeek === 5;
    const dayType = isFriday ? 'friday' : 'mondayToThursday';
    const dayScheduleRecord = shuttleSchedule.schedule[dayType as keyof typeof shuttleSchedule.schedule];
    const schedule = dayScheduleRecord[campus as keyof typeof dayScheduleRecord];

    if (!schedule) {
        throw new Error(`Invalid campus input: ${campus}`);
    }

    const hh = currentTime.getHours().toString().padStart(2, '0');
    const mm = currentTime.getMinutes().toString().padStart(2, '0');
    const currentHHMM = `${hh}:${mm}`;

    const futureDepartures = schedule.filter((time: string) => time >= currentHHMM);

    if (futureDepartures.length === 0) {
        return {
            nextDeparture: null,
            nextThreeDepartures: [],
            estimatedArrival: null,
            serviceUnavailable: true,
            message: 'No more shuttles today.',
        };
    }

    const nextDeparture = futureDepartures[0];
    const nextThreeDepartures = futureDepartures.slice(0, 3);
    const estimatedArrival = calculateArrivalTime(nextDeparture);

    return {
        nextDeparture,
        nextThreeDepartures,
        estimatedArrival,
        serviceUnavailable: false,
    };
};
