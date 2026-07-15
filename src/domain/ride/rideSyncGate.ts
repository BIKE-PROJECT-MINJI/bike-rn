export type RideSyncGate = {
  readonly run: (clientRideId: string, operation: () => Promise<void>) => Promise<void>;
};

export function createRideSyncGate(): RideSyncGate {
  const inFlight = new Map<string, Promise<void>>();
  return {
    run(clientRideId, operation) {
      const existing = inFlight.get(clientRideId);
      if (existing) {
        return existing;
      }
      const started = operation().finally(() => {
        inFlight.delete(clientRideId);
      });
      inFlight.set(clientRideId, started);
      return started;
    },
  };
}
