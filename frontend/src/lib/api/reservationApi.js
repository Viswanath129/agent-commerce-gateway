import { apiClient } from "./apiClient.js";
export class ReservationApi {
    client;
    constructor(client = apiClient) {
        this.client = client;
    }
    /**
     * Retrieves active held & committed dual-resource reservations.
     */
    async getReservations() {
        return this.client.get("/dashboard/reservations");
    }
}
export const reservationApi = new ReservationApi();
