import { mapRideParty, mapRidePartyList, parseRidePartySocketMessage } from './partyMapper';

describe('partyMapper', () => {
  it('maps a wrapped ride party response', () => {
    const result = mapRideParty({
      data: {
        id: 10,
        courseId: 3,
        hostUserId: 7,
        title: '서울대입구 GPX 테스트 파티',
        scheduledStartAt: null,
        capacity: 6,
        joinedCount: 1,
        status: 'OPEN',
        currentUserMember: true,
        currentUserHost: true,
      },
    });

    expect(result).toEqual({
      id: 10,
      courseId: 3,
      hostUserId: 7,
      title: '서울대입구 GPX 테스트 파티',
      scheduledStartAt: null,
      capacity: 6,
      joinedCount: 1,
      status: 'OPEN',
      currentUserMember: true,
      currentUserHost: true,
    });
  });

  it('maps a wrapped ride party list response', () => {
    const result = mapRidePartyList({
      data: {
        items: [
          {
            id: 10,
            courseId: 3,
            hostUserId: 7,
            title: '파티',
            scheduledStartAt: null,
            capacity: 6,
            joinedCount: 2,
            status: 'RIDING',
            currentUserMember: true,
            currentUserHost: false,
          },
        ],
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 10, courseId: 3, joinedCount: 2, currentUserMember: true });
  });

  it('rejects an unknown party status instead of treating it as open', () => {
    expect(() => mapRideParty({
      data: {
        id: 10,
        courseId: 3,
        hostUserId: 7,
        title: '파티',
        scheduledStartAt: null,
        capacity: 6,
        joinedCount: 2,
        status: 'UNKNOWN',
        currentUserMember: true,
        currentUserHost: false,
      },
    })).toThrow();
  });

  it('parses a location broadcast and rejects malformed socket data', () => {
    const valid = JSON.stringify({
      type: 'location',
      data: {
        partyId: 10,
        userId: 7,
        latitude: 37.52,
        longitude: 126.92,
        accuracyM: 5,
        speedMps: 4,
        bearingDeg: 90,
        capturedAt: '2026-07-15T12:00:00+09:00',
      },
    });

    expect(parseRidePartySocketMessage(valid)).toMatchObject({ partyId: 10, userId: 7 });
    expect(parseRidePartySocketMessage('{broken')).toBeNull();
  });
});
