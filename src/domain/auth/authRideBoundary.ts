export type AuthRideTransitionHandler = (nextUserId: number | null) => Promise<void>;

let authRideTransitionHandler: AuthRideTransitionHandler | null = null;

export function registerAuthRideTransitionHandler(handler: AuthRideTransitionHandler): void {
  authRideTransitionHandler = handler;
}

export async function pauseRideForAuthTransition(nextUserId: number | null): Promise<void> {
  if (authRideTransitionHandler === null) {
    throw new MissingAuthRideTransitionHandlerError();
  }
  await authRideTransitionHandler(nextUserId);
}

class MissingAuthRideTransitionHandlerError extends Error {
  constructor() {
    super('인증 전환 전에 주행 수집을 보호할 경계가 등록되지 않았습니다.');
    this.name = 'MissingAuthRideTransitionHandlerError';
  }
}
