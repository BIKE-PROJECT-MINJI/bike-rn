import { mapRideParty, mapRidePartyList } from './partyMapper';

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
            title: '파티',
            capacity: 6,
            joinedCount: 2,
            currentUserMember: true,
          },
        ],
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 10, courseId: 3, joinedCount: 2, currentUserMember: true });
  });
});
