import { resolveApiBaseUrl, toWebSocketUrl } from './env';

describe('env', () => {
  it('기본 API 주소는 운영 HTTPS 주소를 사용한다', () => {
    expect(resolveApiBaseUrl()).toBe('https://api.gajabike.shop');
  });

  it('API 주소 끝의 slash를 제거한다', () => {
    expect(resolveApiBaseUrl('https://example.ngrok-free.app/')).toBe('https://example.ngrok-free.app');
  });

  it('HTTP API 주소를 WebSocket 주소로 변환한다', () => {
    expect(toWebSocketUrl('http://localhost:8080', '/ws/v1/ai-routes')).toBe('ws://localhost:8080/ws/v1/ai-routes');
  });

  it('HTTPS API 주소를 보안 WebSocket 주소로 변환한다', () => {
    expect(toWebSocketUrl('https://api.gajabike.shop', '/ws/v1/ai-routes')).toBe('wss://api.gajabike.shop/ws/v1/ai-routes');
  });
});
