import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { parseRidePartySocketMessage } from '../../domain/party/partyMapper';
import type { RidePartyLocation } from '../../domain/party/partyModels';
import { issueRidePartySocketToken } from '../../domain/party/partyService';
import { resolveApiBaseUrl, toWebSocketUrl } from '../../shared/config/env';
import {
  partyReconnectDelayMs,
  partySocketTerminalMessage,
  shouldReconnectPartySocket,
  shouldRetryPartyLocationError,
  toPartyLocationPayload,
  visiblePartyLocations,
} from './partyLocationSharingModel';

export type PartySharingStatus = 'OFF' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export function usePartyLocationSharing(
  partyId: number | null,
  accessToken: string | null,
  enabled: boolean,
) {
  const [status, setStatus] = useState<PartySharingStatus>('OFF');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locations, setLocations] = useState<ReadonlyMap<number, RidePartyLocation>>(new Map());
  const [freshnessNowMs, setFreshnessNowMs] = useState(Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const timer = setInterval(() => setFreshnessNowMs(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || partyId === null || accessToken === null) {
      setStatus('OFF');
      setErrorMessage(null);
      setLocations(new Map());
      return;
    }
    let disposed = false;
    let socket: WebSocket | null = null;
    let locationSubscription: Location.LocationSubscription | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAllowed = true;

    const stopLocation = () => {
      locationSubscription?.remove();
      locationSubscription = null;
    };
    const scheduleReconnect = (attempt: number) => {
      if (disposed) {
        return;
      }
      setStatus('RECONNECTING');
      reconnectTimer = setTimeout(() => void connect(attempt + 1), partyReconnectDelayMs(attempt));
    };
    const startLocation = async (connectedSocket: WebSocket) => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        reconnectAllowed = false;
        setStatus('ERROR');
        setErrorMessage('파티 위치 공유를 켜려면 정확한 위치 권한이 필요합니다.');
        connectedSocket.close(1000, 'location permission required');
        return;
      }
      locationSubscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3_000, distanceInterval: 5 },
        (location) => {
          if (connectedSocket.readyState === WebSocket.OPEN) {
            connectedSocket.send(JSON.stringify(toPartyLocationPayload(location)));
          }
        },
      );
    };
    const connect = async (attempt: number) => {
      setStatus(attempt === 0 ? 'CONNECTING' : 'RECONNECTING');
      try {
        const issued = await issueRidePartySocketToken(partyId, accessToken);
        if (disposed) {
          return;
        }
        const path = `/ws/v1/parties/${partyId}/locations?socketToken=${encodeURIComponent(issued.socketToken)}`;
        const nextSocket = new WebSocket(toWebSocketUrl(resolveApiBaseUrl(), path));
        socket = nextSocket;
        nextSocket.onopen = () => {
          setStatus('CONNECTED');
          setErrorMessage(null);
          void startLocation(nextSocket);
        };
        nextSocket.onmessage = (event) => {
          const location = typeof event.data === 'string' ? parseRidePartySocketMessage(event.data) : null;
          if (location !== null) {
            setLocations((current) => new Map(current).set(location.userId, location));
          }
        };
        nextSocket.onerror = () => setErrorMessage('파티 위치 연결이 끊어져 다시 연결하고 있습니다.');
        nextSocket.onclose = (event) => {
          stopLocation();
          if (reconnectAllowed && shouldReconnectPartySocket(event.code)) {
            scheduleReconnect(attempt);
          } else if (!disposed) {
            reconnectAllowed = false;
            setStatus('ERROR');
            const terminalMessage = partySocketTerminalMessage(event.code, event.reason);
            if (terminalMessage !== null) {
              setErrorMessage(terminalMessage);
            }
          }
        };
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '파티 위치 연결을 시작하지 못했습니다.');
        if (shouldRetryPartyLocationError(error)) {
          scheduleReconnect(attempt);
        } else {
          reconnectAllowed = false;
          setStatus('ERROR');
        }
      }
    };

    void connect(0);
    return () => {
      disposed = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }
      stopLocation();
      socket?.close();
    };
  }, [accessToken, enabled, partyId]);

  return { status, errorMessage, locations: visiblePartyLocations(locations, freshnessNowMs) } as const;
}
