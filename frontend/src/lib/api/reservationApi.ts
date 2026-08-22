import { apiClient, type ApiClient } from "./apiClient.js";
import type { Reservation } from "./types.js";

export class ReservationApi {
  constructor(private client: ApiClient = apiClient) {}

  /**
   * Retrieves active held & committed dual-resource reservations.
   */
  public async getReservations(): Promise<{ reservations: Reservation[] }> {
    return this.client.get<{ reservations: Reservation[] }>("/dashboard/reservations");
  }
}

export const reservationApi = new ReservationApi();
